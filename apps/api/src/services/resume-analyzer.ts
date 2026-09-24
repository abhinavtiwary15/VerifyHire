import { GoogleGenerativeAI } from '@google/generative-ai'
import axios from 'axios'
import { prisma } from '../plugins/prisma'
import crypto from 'crypto'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
const gemini = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

export const resumeAnalyzerService = {
  async analyze(candidateId: string) {
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate || !candidate.resumeText) {
      return { aiGeneratedScore: 0, perplexityScore: 100, burstinessScore: 100, workHistoryScore: 50, stylometricScore: 80 }
    }

    // Step 1: Call Python AI microservice for perplexity/burstiness
    let aiScores = { aiGeneratedScore: 0, perplexityScore: 100, burstinessScore: 100, stylometricScore: 80 }
    try {
      const pyRes = await axios.post(
        `${process.env.AI_SERVICE_URL}/analyze/resume`,
        { text: candidate.resumeText },
        {
          headers: { 'x-service-secret': process.env.AI_SERVICE_SECRET },
          timeout: 30000,
        }
      )
      aiScores = pyRes.data
    } catch (err) {
      console.warn('[ResumeAnalyzer] Python service unavailable, using fallback scoring')
      aiScores = fallbackScoring(candidate.resumeText)
    }

    // Step 2: Work history verification via Claude
    const workHistoryScore = await verifyWorkHistory(candidate.resumeText, candidate.linkedinUrl)

    // Step 3: LinkedIn match score
    let linkedinMatch: number | undefined
    if (candidate.linkedinUrl) {
      linkedinMatch = await checkLinkedInProfile(candidate.linkedinUrl, candidate.name)
    }

    // Step 4: GitHub match score
    let githubMatch: number | undefined
    if (candidate.githubUrl) {
      githubMatch = await checkGitHubProfile(candidate.githubUrl)
    }

    // Step 5: Duplicate resume detection
    const resumeHash = crypto.createHash('sha256').update(candidate.resumeText.trim()).digest('hex')
    const duplicate = await prisma.fraudDatabase.findFirst({ where: { resumeHash } })

    const analysis = await prisma.resumeAnalysis.upsert({
      where: { candidateId },
      create: {
        candidateId,
        aiGeneratedScore: aiScores.aiGeneratedScore,
        perplexityScore: aiScores.perplexityScore,
        burstinessScore: aiScores.burstinessScore,
        stylometricScore: aiScores.stylometricScore,
        workHistoryScore,
        linkedinMatch,
        githubMatch,
        rawSignals: { aiScores, resumeHash, duplicateFound: !!duplicate },
      },
      update: {
        aiGeneratedScore: aiScores.aiGeneratedScore,
        perplexityScore: aiScores.perplexityScore,
        burstinessScore: aiScores.burstinessScore,
        stylometricScore: aiScores.stylometricScore,
        workHistoryScore,
        linkedinMatch,
        githubMatch,
        rawSignals: { aiScores, resumeHash, duplicateFound: !!duplicate },
      },
    })

    // Create fraud flags
    const flags = []

    if (aiScores.aiGeneratedScore > 70) {
      flags.push({
        candidateId,
        type: 'AI_GENERATED_RESUME' as const,
        severity: aiScores.aiGeneratedScore > 85 ? 'HIGH' as const : 'MEDIUM' as const,
        description: `Resume text shows AI-generation confidence of ${aiScores.aiGeneratedScore.toFixed(1)}%. Perplexity: ${aiScores.perplexityScore.toFixed(1)}, Burstiness: ${aiScores.burstinessScore.toFixed(1)}.`,
        evidence: { perplexityScore: aiScores.perplexityScore, burstinessScore: aiScores.burstinessScore },
      })
    }

    if (workHistoryScore < 40) {
      flags.push({
        candidateId,
        type: 'WORK_HISTORY_UNVERIFIABLE' as const,
        severity: 'MEDIUM' as const,
        description: `Work history verification score: ${workHistoryScore}/100. One or more claimed employers could not be independently verified.`,
        evidence: { workHistoryScore },
      })
    }

    if (duplicate) {
      flags.push({
        candidateId,
        type: 'DUPLICATE_IDENTITY' as const,
        severity: 'HIGH' as const,
        description: `Resume content hash matches ${duplicate.flagCount} previous submission(s) in the fraud network.`,
        evidence: { flagCount: duplicate.flagCount, firstSeen: duplicate.firstSeenAt },
      })
    }

    if (flags.length > 0) {
      await prisma.fraudFlag.createMany({ data: flags, skipDuplicates: true })
    }

    return analysis
  },
}

async function verifyWorkHistory(resumeText: string, linkedinUrl?: string | null): Promise<number> {
  try {
    const prompt = `
      You are a hiring fraud analyst. Analyze this resume excerpt and score the work history plausibility from 0-100 (100 = fully verifiable, 0 = entirely fabricated/suspicious).
      Consider: Are dates logical? Are role progressions realistic? Are company names real? Are claims consistent with each other?
      
      Resume text: "${resumeText.slice(0, 2000)}"
      LinkedIn provided: ${linkedinUrl ? 'Yes' : 'No'}
      
      Respond with ONLY a JSON object: {"score": <number 0-100>, "reason": "<one sentence>"}
    `.trim()

    const result = await gemini.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{.*\}/s)
    if (!jsonMatch) throw new Error('Invalid AI response format')
    
    const parsed = JSON.parse(jsonMatch[0])
    return Math.max(0, Math.min(100, Number(parsed.score) || 50))
  } catch (err) {
    console.error('[ResumeAnalyzer] Gemini analysis failed:', err)
    return 55 // Fallback score
  }
}

async function checkLinkedInProfile(url: string, name: string): Promise<number> {
  const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_%]{3,100})/i)
  if (!match) return 0

  let score = 30 // Valid public profile format

  const slug = decodeURIComponent(match[1]).toLowerCase()
  const nameParts = name.toLowerCase().split(/\s+/).filter((part) => part.length >= 2)

  // Verify candidate name tokens in the vanity URL slug
  const matchingParts = nameParts.filter((part) => slug.includes(part))
  if (matchingParts.length >= 2 || (nameParts.length === 1 && matchingParts.length === 1)) {
    score += 40 // High confidence: first and last name present in slug
  } else if (matchingParts.length === 1) {
    score += 20 // Moderate confidence: single name token matched
  }

  // HTTP route reachability probe
  try {
    const targetUrl = url.startsWith('http') ? url : `https://${url}`
    const res = await axios.head(targetUrl, {
      timeout: 4000,
      validateStatus: (status) => status < 500, // LinkedIn returns 200, 301, or 999 for existing routes
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })
    if (res.status === 404) {
      return 0 // Confirmed non-existent profile
    }
    score += 30
  } catch {
    score += 15 // Network timeout fallback: keep format + name points
  }

  return Math.min(100, score)
}

async function checkGitHubProfile(url: string): Promise<number> {
  try {
    const username = url.split('github.com/')[1]?.split('/')[0]
    if (!username) return 0
    const res = await axios.get(`https://api.github.com/users/${username}`, { timeout: 5000 })
    const user = res.data
    const score = Math.min(100,
      (user.public_repos > 0 ? 30 : 0) +
      (user.followers > 10 ? 20 : 0) +
      (new Date(user.created_at) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) ? 30 : 10) +
      (user.public_repos > 5 ? 20 : 0)
    )
    return score
  } catch {
    return 0
  }
}

function fallbackScoring(text: string) {
  const aiPhrases = [
    'highly scalable', 'cutting-edge', 'robust and performant', 'leverage',
    'passionate about', 'seasoned professional', 'exceptional user experiences',
    'synergize', 'deliverables', 'optimize developer productivity',
    'cloud-native', 'best practices', 'cross-functional teams',
  ]
  const lower = text.toLowerCase()
  const hits = aiPhrases.filter((p) => lower.includes(p)).length
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10)
  const avgLen = sentences.reduce((a, s) => a + s.split(' ').length, 0) / Math.max(1, sentences.length)
  const uniformity = sentences.length > 3
    ? 1 - (sentences.map((s) => s.split(' ').length).reduce((a, b, _, arr) => {
        const mean = arr.reduce((x, y) => x + y) / arr.length
        return a + Math.abs(b - mean)
      }, 0) / (sentences.length * avgLen))
    : 0.5

  const aiGeneratedScore = Math.min(95, Math.max(0, hits * 5 + uniformity * 40 + (avgLen > 22 ? 15 : 0)))

  return {
    aiGeneratedScore,
    perplexityScore: Math.max(5, 100 - aiGeneratedScore * 0.9),
    burstinessScore: Math.max(5, 100 - uniformity * 80),
    stylometricScore: Math.max(10, 100 - aiGeneratedScore * 0.6),
  }
}
