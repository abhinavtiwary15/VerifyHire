// apps/api/src/services/fraud-network.ts
import { prisma } from '../plugins/prisma'
import crypto from 'crypto'

function hmacHash(value: string): string {
  const salt = process.env.FRAUD_HASH_SALT
  if (!salt || salt.length < 16) {
    throw new Error('FRAUD_HASH_SALT must be set to at least 16 characters. Generate with: openssl rand -hex 32')
  }
  return crypto.createHmac('sha256', salt).update(value).digest('hex')
}

export { hmacHash }

export const fraudNetworkService = {
  async check(candidateId: string, emailHash?: string, phoneHash?: string) {
    if (!emailHash && !phoneHash) return { match: false }

    const conditions: any[] = []
    if (emailHash) conditions.push({ emailHash })
    if (phoneHash) conditions.push({ phoneHash })

    const matches = await prisma.fraudDatabase.findMany({
      where: { OR: conditions },
    })

    const isMatch = matches.length > 0

    if (isMatch) {
      const maxFlags = Math.max(...matches.map((m) => m.flagCount))
      await prisma.fraudFlag.create({
        data: {
          candidateId,
          type: 'DUPLICATE_IDENTITY',
          severity: maxFlags >= 3 ? 'CRITICAL' : 'HIGH',
          description: `Identity matches ${matches.length} record(s) in the cross-organization fraud network. Flagged by ${matches[0].sourceOrgCount} organization(s).`,
          evidence: { matchCount: matches.length, maxFlagCount: maxFlags },
        },
      })
    }

    return { match: isMatch, matchCount: matches.length }
  },

  async report(candidateId: string) {
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate) return

    const emailHash = candidate.email ? hmacHash(candidate.email.toLowerCase()) : undefined
    const phoneHash = candidate.phone ? hmacHash(candidate.phone.replace(/\D/g, '')) : undefined
    const deviceHash = candidate.deviceFingerprint ? hmacHash(candidate.deviceFingerprint) : undefined

    if (emailHash) {
      await prisma.fraudDatabase.upsert({
        where: { emailHash },
        create: { emailHash, phoneHash, deviceHash, flagCount: 1, sourceOrgCount: 1 },
        update: { flagCount: { increment: 1 }, lastSeenAt: new Date() },
      })
    }
  },
}
