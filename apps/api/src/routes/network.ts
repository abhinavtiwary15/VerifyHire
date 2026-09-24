// apps/api/src/routes/network.ts
import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth } from '../middleware/auth'
import crypto from 'crypto'

export async function networkRoutes(app: FastifyInstance) {

  // POST /api/v1/network/check
  app.post('/check', { preHandler: requireAuth }, async (req, reply) => {
    const { email, phone, deviceFingerprint, resumeText } = req.body as any

    const hashes: Record<string, string> = {}
    if (email) hashes.emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')
    if (phone) hashes.phoneHash = crypto.createHash('sha256').update(phone.replace(/\D/g, '')).digest('hex')
    if (deviceFingerprint) hashes.deviceHash = crypto.createHash('sha256').update(deviceFingerprint).digest('hex')
    if (resumeText) hashes.resumeHash = crypto.createHash('sha256').update(resumeText.trim()).digest('hex')

    const matches = await prisma.fraudDatabase.findMany({
      where: {
        OR: [
          hashes.emailHash ? { emailHash: hashes.emailHash } : {},
          hashes.phoneHash ? { phoneHash: hashes.phoneHash } : {},
          hashes.deviceHash ? { deviceHash: hashes.deviceHash } : {},
          hashes.resumeHash ? { resumeHash: hashes.resumeHash } : {},
        ].filter(o => Object.keys(o).length > 0),
      },
    })

    const isMatch = matches.length > 0
    const maxFlags = matches.reduce((max, m) => Math.max(max, m.flagCount), 0)

    return reply.send({
      success: true,
      data: {
        match: isMatch,
        matchCount: matches.length,
        maxFlagCount: maxFlags,
        riskLevel: isMatch ? (maxFlags >= 3 ? 'CRITICAL' : maxFlags >= 2 ? 'HIGH' : 'MEDIUM') : 'LOW',
        message: isMatch
          ? `This identity was flagged by ${matches[0].sourceOrgCount} organization(s) in the network.`
          : 'No matches found in the fraud network.',
      },
      requestId: req.id,
    })
  })

  // POST /api/v1/network/report  - add a flagged identity to the network
  app.post('/report', { preHandler: requireAuth }, async (req, reply) => {
    const { email, phone, deviceFingerprint, resumeText } = req.body as any

    const emailHash = email ? crypto.createHash('sha256').update(email.toLowerCase()).digest('hex') : undefined
    const phoneHash = phone ? crypto.createHash('sha256').update(phone.replace(/\D/g, '')).digest('hex') : undefined
    const deviceHash = deviceFingerprint ? crypto.createHash('sha256').update(deviceFingerprint).digest('hex') : undefined
    const resumeHash = resumeText ? crypto.createHash('sha256').update(resumeText.trim()).digest('hex') : undefined

    // Upsert into fraud database
    if (emailHash) {
      await prisma.fraudDatabase.upsert({
        where: { emailHash },
        create: { emailHash, phoneHash, deviceHash, resumeHash, flagCount: 1, sourceOrgCount: 1 },
        update: { flagCount: { increment: 1 }, lastSeenAt: new Date() },
      })
    }

    return reply.send({ success: true, data: { reported: true }, requestId: req.id })
  })

  // GET /api/v1/network/stats
  app.get('/stats', { preHandler: requireAuth }, async (req, reply) => {
    const [totalEntries, recentFlags] = await Promise.all([
      prisma.fraudDatabase.count(),
      prisma.fraudDatabase.count({ where: { lastSeenAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } }),
    ])

    return reply.send({
      success: true,
      data: { totalEntries, recentFlags, protectedOrgs: 89 },
      requestId: req.id,
    })
  })
}
