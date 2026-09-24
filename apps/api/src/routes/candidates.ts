// apps/api/src/routes/candidates.ts
import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth } from '../middleware/auth'
import { analysisQueue } from '../jobs'
import { z } from 'zod'
import { hmacHash } from '../services/fraud-network'

const createCandidateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  resumeText: z.string().optional(),
  linkedinUrl: z.string().url().optional(),
  githubUrl: z.string().url().optional(),
  jobId: z.string().optional(),
})

export async function candidateRoutes(app: FastifyInstance) {

  // GET /api/v1/candidates
  app.get('/', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId
    const { page = '1', pageSize = '20', risk, status, search } = req.query as any

    const where: any = { organizationId: orgId }
    if (risk) where.riskLevel = risk
    if (status) where.status = status
    if (search) where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ]

    const [items, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        include: {
          fraudFlags: true,
          job: { select: { id: true, title: true } },
          resumeAnalysis: { select: { aiGeneratedScore: true, analyzedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(pageSize),
        take: parseInt(pageSize),
      }),
      prisma.candidate.count({ where }),
    ])

    return reply.send({
      success: true,
      data: { items, total, page: parseInt(page), pageSize: parseInt(pageSize), hasMore: total > parseInt(page) * parseInt(pageSize) },
      requestId: req.id,
    })
  })

  // POST /api/v1/candidates
  app.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId
    const body = createCandidateSchema.parse(req.body)

    // Check screening limit
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (org && org.plan !== 'ENTERPRISE' && org.screeningsUsed >= org.screeningLimit) {
      return reply.status(402).send({
        success: false,
        error: `Screening limit reached (${org.screeningsUsed}/${org.screeningLimit}). Please upgrade your plan.`,
        requestId: req.id,
      })
    }

    // Hash for fraud network check
    const emailHash = hmacHash(body.email.toLowerCase())
    const phoneHash = body.phone
      ? hmacHash(body.phone.replace(/\D/g, ''))
      : undefined

    const candidate = await prisma.candidate.create({
      data: {
        ...body,
        organizationId: orgId,
        status: 'PENDING',
        submissionIp: req.ip,
      },
    })

    // Increment usage
    await prisma.organization.update({
      where: { id: orgId },
      data: { screeningsUsed: { increment: 1 } },
    })

    // Queue full analysis
    const job = await analysisQueue.add('full-analysis', {
      candidateId: candidate.id,
      orgId,
      emailHash,
      phoneHash,
    }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })

    // Update status to analyzing
    await prisma.candidate.update({ where: { id: candidate.id }, data: { status: 'ANALYZING' } })

    await prisma.auditLog.create({
      data: { organizationId: orgId, userId: (req as any).userId, action: 'CANDIDATE_CREATED', entityType: 'Candidate', entityId: candidate.id, ip: req.ip },
    })

    return reply.status(202).send({
      success: true,
      data: { candidate, jobId: job.id },
      requestId: req.id,
    })
  })

  // GET /api/v1/candidates/:id
  app.get('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const orgId = (req as any).orgId

    const candidate = await prisma.candidate.findFirst({
      where: { id, organizationId: orgId },
      include: {
        fraudFlags: { orderBy: { createdAt: 'desc' } },
        resumeAnalysis: true,
        identityAnalysis: true,
        interviewSessions: {
          include: { liveAlerts: { orderBy: { timestamp: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        },
        job: true,
      },
    })

    if (!candidate) {
      return reply.status(404).send({ success: false, error: 'Candidate not found', requestId: req.id })
    }

    return reply.send({ success: true, data: candidate, requestId: req.id })
  })

  // POST /api/v1/candidates/:id/analyze-resume
  app.post('/:id/analyze-resume', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const orgId = (req as any).orgId

    const candidate = await prisma.candidate.findFirst({ where: { id, organizationId: orgId } })
    if (!candidate) return reply.status(404).send({ success: false, error: 'Not found', requestId: req.id })

    const job = await analysisQueue.add('resume-analysis', { candidateId: id, orgId }, { attempts: 3 })

    return reply.status(202).send({ success: true, data: { jobId: job.id }, requestId: req.id })
  })

  // POST /api/v1/candidates/:id/verify-identity
  app.post('/:id/verify-identity', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const orgId = (req as any).orgId

    const candidate = await prisma.candidate.findFirst({ where: { id, organizationId: orgId } })
    if (!candidate) return reply.status(404).send({ success: false, error: 'Not found', requestId: req.id })

    const job = await analysisQueue.add('identity-verification', { candidateId: id, orgId }, { attempts: 3 })

    return reply.status(202).send({ success: true, data: { jobId: job.id }, requestId: req.id })
  })

  // GET /api/v1/candidates/:id/report
  app.get('/:id/report', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const orgId = (req as any).orgId

    const candidate = await prisma.candidate.findFirst({
      where: { id, organizationId: orgId },
      include: { fraudFlags: true, resumeAnalysis: true, identityAnalysis: true, interviewSessions: { include: { liveAlerts: true } } },
    })

    if (!candidate) return reply.status(404).send({ success: false, error: 'Not found', requestId: req.id })

    // In production: generate PDF with Puppeteer, return S3 URL
    return reply.send({
      success: true,
      data: {
        reportUrl: `https://reports.verifyhire.io/candidates/${id}`,
        candidate,
        generatedAt: new Date().toISOString(),
        disclaimer: 'This report is advisory only. VerifyHire is not a consumer reporting agency. This output does not constitute a background check under the Fair Credit Reporting Act.',
      },
      requestId: req.id,
    })
  })

  // PATCH /api/v1/candidates/:id/status
  app.patch('/:id/status', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { status, note } = req.body as { status: string; note?: string }
    const orgId = (req as any).orgId

    const updated = await prisma.candidate.updateMany({
      where: { id, organizationId: orgId },
      data: { status: status as any },
    })

    if (updated.count === 0) return reply.status(404).send({ success: false, error: 'Not found', requestId: req.id })

    await prisma.auditLog.create({
      data: { organizationId: orgId, userId: (req as any).userId, action: `CANDIDATE_STATUS_${status}`, entityType: 'Candidate', entityId: id, metadata: { note }, ip: req.ip },
    })

    return reply.send({ success: true, data: { updated: true }, requestId: req.id })
  })

  // POST /api/v1/candidates/:id/flags/:flagId/dispute
  app.post('/:id/flags/:flagId/dispute', { preHandler: requireAuth }, async (req, reply) => {
    const { flagId } = req.params as { id: string; flagId: string }
    const { reason } = req.body as { reason: string }

    await prisma.fraudFlag.update({
      where: { id: flagId },
      data: { disputed: true, disputeNote: reason },
    })

    return reply.send({ success: true, data: { disputed: true }, requestId: req.id })
  })

  // DELETE /api/v1/candidates/:id  (GDPR/CCPA)
  app.delete('/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const orgId = (req as any).orgId

    const candidate = await prisma.candidate.findFirst({ where: { id, organizationId: orgId } })
    if (!candidate) return reply.status(404).send({ success: false, error: 'Not found', requestId: req.id })

    await prisma.candidate.delete({ where: { id } })

    await prisma.auditLog.create({
      data: { organizationId: orgId, userId: (req as any).userId, action: 'CANDIDATE_DELETED_GDPR', entityType: 'Candidate', entityId: id, ip: req.ip },
    })

    return reply.send({ success: true, data: { deleted: true, reason: 'GDPR/CCPA data deletion request' }, requestId: req.id })
  })
}
