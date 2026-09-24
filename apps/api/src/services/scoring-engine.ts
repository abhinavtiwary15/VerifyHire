// apps/api/src/services/scoring-engine.ts
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '../plugins/prisma'
import { RiskLevel } from '@verifyhire/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

    // Weighted CAS formula
    const resumeAuthenticityScore = resumeData
      ? Math.max(0, 100 - (resumeData.aiGeneratedScore || 0))
      : 50
    const workHistoryScore = resumeData?.workHistoryScore ?? 50
    const identityVerificationScore = identityData?.identityScore ?? 50
    const interviewBehavioralScore = 70 // Default until interview runs
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

    // Generate Claude AI summary
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
  try {
    const flagSummary = scores.flags.map((f: any) => `- ${f.type}: ${f.description}`).join('\n')

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: `You are VerifyHire, an AI hiring fraud detection system. Write a professional 3-paragraph advisory report summary for a recruiter.

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
${flagSummary || 'None'}

Write exactly 3 paragraphs:
1. Overall risk assessment and CAS explanation
2. Key signals and what they mean
3. Specific recommended recruiter actions

Be direct, professional, and cite the specific scores. Do not use bullet points.

End with this exact line on a new line:
"⚖️ DISCLAIMER: This report is advisory only. VerifyHire is not a consumer reporting agency. This output does not constitute a background check under the Fair Credit Reporting Act."`,
        },
      ],
    })

    return message.content[0].type === 'text' ? message.content[0].text : getStaticSummary(scores)
  } catch (err) {
    console.warn('[ScoringEngine] Claude summary failed, using fallback')
    return getStaticSummary(scores)
  }
}

function getStaticSummary(scores: any): string {
  const { overall, riskLevel, resumeAuthenticityScore, workHistoryScore, flags } = scores
  return `VerifyHire analysis complete. The Candidate Authenticity Score (CAS) is ${overall}/100, placing this candidate in the ${riskLevel} risk tier. ${overall < 50 ? 'This score warrants immediate recruiter review before any further steps in the hiring process.' : 'This score is within acceptable range but some areas deserve attention.'}

Key signals detected: Resume authenticity scored ${resumeAuthenticityScore}/100 and work history verification scored ${workHistoryScore}/100. ${flags.length > 0 ? `${flags.length} fraud flag(s) were raised, including: ${flags.slice(0, 2).map((f: any) => f.type.replace(/_/g, ' ')).join(', ')}.` : 'No significant fraud flags were detected in this analysis.'}

Recommended action: ${overall < 30 ? 'Do not proceed. Conduct immediate identity verification and consult your legal team before any further engagement.' : overall < 60 ? 'Proceed with enhanced due diligence. Verify at least 2 employment references directly and conduct a structured verification interview.' : 'Standard hiring process may continue. Routine reference checks are recommended.'}

⚖️ DISCLAIMER: This report is advisory only. VerifyHire is not a consumer reporting agency. This output does not constitute a background check under the Fair Credit Reporting Act.`
}
