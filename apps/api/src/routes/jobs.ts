// apps/api/src/routes/jobs.ts
import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth } from '../middleware/auth'

export async function jobRoutes(app: FastifyInstance) {

  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId
    const jobs = await prisma.job.findMany({
      where: { organizationId: orgId, isActive: true },
      include: { _count: { select: { candidates: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ success: true, data: jobs, requestId: req.id })
  })

  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId
    const { title, description } = req.body as { title: string; description?: string }

    const job = await prisma.job.create({ data: { title, description, organizationId: orgId } })
    return reply.status(201).send({ success: true, data: job, requestId: req.id })
  })

  app.patch('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const orgId = (req as any).orgId
    const body = req.body as any

    const updated = await prisma.job.updateMany({ where: { id, organizationId: orgId }, data: body })
    if (updated.count === 0) return reply.status(404).send({ success: false, error: 'Not found', requestId: req.id })
    return reply.send({ success: true, data: { updated: true }, requestId: req.id })
  })

  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const orgId = (req as any).orgId

    await prisma.job.updateMany({ where: { id, organizationId: orgId }, data: { isActive: false } })
    return reply.send({ success: true, data: { deleted: true }, requestId: req.id })
  })
}
