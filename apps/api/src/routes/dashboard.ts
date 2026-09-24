// apps/api/src/routes/dashboard.ts
import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth } from '../middleware/auth'

export async function dashboardRoutes(app: FastifyInstance) {
  app.get('/stats', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId

    const [total, flagged, cleared, byRisk, byFlag] = await Promise.all([
      prisma.candidate.count({ where: { organizationId: orgId } }),
      prisma.candidate.count({ where: { organizationId: orgId, status: 'FLAGGED' } }),
      prisma.candidate.count({ where: { organizationId: orgId, status: 'CLEARED' } }),
      prisma.candidate.groupBy({ by: ['riskLevel'], where: { organizationId: orgId }, _count: true }),
      prisma.fraudFlag.groupBy({ by: ['type'], where: { candidate: { organizationId: orgId } }, _count: true }),
    ])

    const scores = await prisma.candidate.findMany({
      where: { organizationId: orgId, authenticityScore: { not: null } },
      select: { authenticityScore: true },
    })
    const avgScore = scores.length ? scores.reduce((a, c) => a + (c.authenticityScore || 0), 0) / scores.length : 0

    // 30-day trend
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const recent = await prisma.candidate.findMany({
      where: { organizationId: orgId, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({
      success: true,
      data: {
        totalCandidates: total,
        flaggedCount: flagged,
        clearedCount: cleared,
        analyzingCount: await prisma.candidate.count({ where: { organizationId: orgId, status: 'ANALYZING' } }),
        avgAuthenticityScore: Math.round(avgScore * 10) / 10,
        riskDistribution: Object.fromEntries(byRisk.map(r => [r.riskLevel, r._count])),
        fraudByType: Object.fromEntries(byFlag.map(f => [f.type, f._count])),
        recentCount: recent.length,
      },
      requestId: req.id,
    })
  })
}
