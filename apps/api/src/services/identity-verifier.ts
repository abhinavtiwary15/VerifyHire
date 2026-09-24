// apps/api/src/services/identity-verifier.ts
import axios from 'axios'
import { prisma } from '../plugins/prisma'

export const identityVerifierService = {
  async verify(candidateId: string) {
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate) throw new Error('Candidate not found')

    const ip = candidate.submissionIp
    let vpnDetected = false
    let ipReputation = 'unknown'
    let ipCountry: string | undefined
    let locationConsistent: boolean | undefined

    // IP reputation check
    if (ip && ip !== '127.0.0.1' && ip !== '::1') {
      try {
        const ipqsKey = process.env.IPQUALITYSCORE_API_KEY
        if (ipqsKey) {
          const res = await axios.get(
            `https://ipqualityscore.com/api/json/ip/${ipqsKey}/${ip}`,
            { timeout: 5000 }
          )
          vpnDetected = res.data.vpn || res.data.proxy || res.data.tor
          ipReputation = res.data.fraud_score > 75 ? 'high-risk' : res.data.fraud_score > 40 ? 'suspicious' : 'clean'
          ipCountry = res.data.country_code
        }
      } catch {
        console.warn('[IdentityVerifier] IP check failed')
      }
    }

    // Social presence check
    const socialScore = await checkSocialPresence(candidate.linkedinUrl, candidate.githubUrl, candidate.name)

    // Compute identity score
    const identityScore = Math.min(100, Math.max(0,
      (vpnDetected ? -30 : 0) +
      (ipReputation === 'high-risk' ? -20 : ipReputation === 'suspicious' ? -10 : 0) +
      socialScore
    ) + 50)

    const analysis = await prisma.identityAnalysis.upsert({
      where: { candidateId },
      create: {
        candidateId,
        identityVerified: identityScore > 70,
        locationConsistent,
        vpnDetected,
        submissionIp: ip,
        ipReputation,
        ipCountry,
        deviceFingerprint: candidate.deviceFingerprint,
      },
      update: {
        identityVerified: identityScore > 70,
        locationConsistent,
        vpnDetected,
        submissionIp: ip,
        ipReputation,
        ipCountry,
      },
    })

    // Create flags
    const flags = []

    if (vpnDetected) {
      flags.push({
        candidateId,
        type: 'LOCATION_SPOOFING' as const,
        severity: 'HIGH' as const,
        description: `VPN/proxy detected on submission IP. IP reputation: ${ipReputation}. Candidate may be concealing their true location.`,
        evidence: { ip, vpnDetected, ipReputation, ipCountry },
      })
    }

    if (!candidate.linkedinUrl && !candidate.githubUrl) {
      flags.push({
        candidateId,
        type: 'SOCIAL_PROFILE_MISSING' as const,
        severity: 'MEDIUM' as const,
        description: 'No verifiable social presence found. Neither LinkedIn nor GitHub URL was provided or could be verified.',
        evidence: { socialScore },
      })
    }

    if (flags.length > 0) {
      await prisma.fraudFlag.createMany({ data: flags, skipDuplicates: true })
    }

    return { ...analysis, identityScore }
  },
}

async function checkSocialPresence(
  linkedinUrl: string | null | undefined,
  githubUrl: string | null | undefined,
  name: string
): Promise<number> {
  let score = 0

  if (linkedinUrl) {
    const match = linkedinUrl.match(/linkedin\.com\/in\/([a-zA-Z0-9\-_%]{3,100})/i)
    if (match) {
      score += 15 // Valid profile URL structure
      const slug = decodeURIComponent(match[1]).toLowerCase()
      const nameParts = name.toLowerCase().split(/\s+/).filter((part) => part.length >= 2)
      const matchingParts = nameParts.filter((part) => slug.includes(part))
      if (matchingParts.length > 0) score += 10 // Name alignment with profile slug
    }
  }

  if (githubUrl) {
    try {
      const username = githubUrl.split('github.com/')[1]?.split('/')[0]
      if (username) {
        const res = await axios.get(`https://api.github.com/users/${username}`, { timeout: 5000 })
        if (res.data.public_repos > 0) score += 15
        if (res.data.followers > 5) score += 10
        const accountAge = Date.now() - new Date(res.data.created_at).getTime()
        if (accountAge > 365 * 24 * 60 * 60 * 1000) score += 10
      }
    } catch {
      // GitHub not reachable or user not found
    }
  }

  return score
}
