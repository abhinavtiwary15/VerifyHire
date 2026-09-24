// apps/api/src/services/scoring-engine.ts
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '../plugins/prisma'
import { RiskLevel } from '@verifyhire/types'

export const scoringEngine = {
  async compute(
    candidateId: string,
    inputs: { resumeData: any; identityData: any; networkData: any }
  ) {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: { fraudFlags: true },
    })
    if (!candidate) throw new Error('Candidate not found')

    const { resumeData, identityData, networkData } = inputs

    // Weighted CAS formula:
    // Resume authenticity (25%) + Work history (20%) + Identity verification (20%)
    // + Interview behavioral (25%) + Fraud network reputation (10%)
    const resumeAuthenticityScore = resumeData
      ? Math.max(0, 100 - (resumeData.aiGeneratedScore || 0))
      : 50
    const workHistoryScore = resumeData?.workHistoryScore ?? 50
    const identityVerificationScore = identityData?.identityScore ?? 50
    const interviewBehavioralScore = 70 // Default baseline prior to live interview session
    const networkReputationScore = networkData?.match ? 0 : 90

    const overall = Math.round(
      resumeAuthenticityScore * 0.25 +
      workHistoryScore * 0.20 +
      identityVerificationScore * 0.20 +
      interviewBehavioralScore * 0.25 +
      networkReputationScore * 0.10
    )

    const riskLevel: RiskLevel =
      overall <= 30 ? 'CRITICAL' :
      overall <= 50 ? 'HIGH' :
      overall <= 75 ? 'MEDIUM' : 'LOW'

    // Generate AI executive summary (Claude 3.5 Sonnet or Gemini 1.5 Flash)
    const aiSummary = await generateAISummary(candidate, {
      overall,
      resumeAuthenticityScore,
      workHistoryScore,
      identityVerificationScore,
      networkReputationScore,
      riskLevel,
      flags: candidate.fraudFlags,
    })

    return {
      overall,
      resumeAuthenticityScore,
      workHistoryScore,
      identityVerificationScore,
      interviewBehavioralScore,
      networkReputationScore,
      riskLevel,
      aiSummary,
    }
  },
}

async function generateAISummary(candidate: any, scores: any): Promise<string> {
  const flagSummary = scores.flags?.length
    ? scores.flags.map((f: any) => `- ${f.type}: ${f.description}`).join('\n')
    : 'None'

  const prompt = `You are VerifyHire, an AI hiring fraud detection system. Write a professional 3-paragraph advisory report summary for a recruiter.

Candidate: ${candidate.name}
Job: ${candidate.job?.title || 'Not specified'}
Candidate Authenticity Score (CAS): ${scores.overall}/100
Risk Level: ${scores.riskLevel}

Sub-scores:
- Resume Authenticity: ${scores.resumeAuthenticityScore}/100
- Work History Verified: ${scores.workHistoryScore}/100
- Identity Verification: ${scores.identityVerificationScore}/100
- Network Reputation: ${scores.networkReputationScore}/100

Fraud Flags Detected:
${flagSummary}

Write exactly 3 paragraphs:
1. Overall risk assessment and CAS explanation
2. Key signals and what they mean
3. Specific recommended recruiter actions

Be direct, professional, and cite the specific scores. Do not use bullet points.

End with this exact line on a new line:
"⚖️ DISCLAIMER: This report is advisory only. VerifyHire is not a consumer reporting agency. This output does not constitute a background check under the Fair Credit Reporting Act."`

  // Primary path: Anthropic Claude 3.5 Sonnet if key is provided
  if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.startsWith('sk-ant-')) {
    try {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = message.content[0]?.type === 'text' ? message.content[0].text : null
      if (text) return text
    } catch (err: any) {
      console.warn('[ScoringEngine] Claude summary request failed:', err.message)
    }
  }

  // Secondary path: Google Gemini 1.5 Flash if Gemini key is provided
  if (process.env.GEMINI_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      if (text) return text
    } catch (err: any) {
      console.warn('[ScoringEngine] Gemini summary request failed:', err.message)
    }
  }

  // Deterministic rule-based summary when external API is unreachable or unconfigured
  return getDeterministicSummary(scores)
}

function getDeterministicSummary(scores: any): string {
  const { overall, riskLevel, resumeAuthenticityScore, workHistoryScore, flags } = scores
  const flagList = flags && flags.length > 0
    ? `${flags.length} fraud flag(s) were raised, including: ${flags.slice(0, 2).map((f: any) => f.type.replace(/_/g, ' ')).join(', ')}.`
    : 'No significant fraud flags were detected in this analysis.'

  const urgencyText = overall < 50
    ? 'This score warrants immediate recruiter review before any further steps in the hiring process.'
    : 'This score is within acceptable range, with verified indicators across core dimensions.'

  const actionText = overall < 30
    ? 'Do not proceed. Conduct immediate identity verification and consult your hiring compliance lead before any further engagement.'
    : overall < 60
    ? 'Proceed with enhanced due diligence. Verify at least two employment references directly and conduct a structured verification interview.'
    : 'Standard hiring process may continue. Routine reference checks are recommended.'

  return `VerifyHire analysis complete. The Candidate Authenticity Score (CAS) is ${overall}/100, placing this candidate in the ${riskLevel} risk tier. ${urgencyText}

Key signals detected: Resume authenticity scored ${resumeAuthenticityScore}/100 and work history verification scored ${workHistoryScore}/100. ${flagList}

Recommended action: ${actionText}

⚖️ DISCLAIMER: This report is advisory only. VerifyHire is not a consumer reporting agency. This output does not constitute a background check under the Fair Credit Reporting Act.`
}
