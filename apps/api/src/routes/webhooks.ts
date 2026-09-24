// apps/api/src/routes/webhooks.ts
import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth } from '../middleware/auth'
import { analysisQueue } from '../jobs'
import crypto from 'crypto'

export async function webhookRoutes(app: FastifyInstance) {

  // POST /api/v1/webhooks/greenhouse  - receive candidate from Greenhouse ATS
  app.post('/greenhouse', async (req, reply) => {
    const apiKey = req.headers['x-api-key'] as string
    if (!apiKey) return reply.status(401).send({ error: 'Missing API key' })

    const hash = crypto.createHash('sha256').update(apiKey).digest('hex')
    const org = await prisma.organization.findFirst({ where: { apiKeyHash: hash } })
    if (!org) return reply.status(401).send({ error: 'Invalid API key' })

    const payload = req.body as any
    // Greenhouse webhook payload shape
    const candidate = payload.payload?.application?.candidate || payload.candidate

    if (!candidate) return reply.status(400).send({ error: 'Invalid payload' })

    const created = await prisma.candidate.create({
      data: {
        name: `${candidate.first_name} ${candidate.last_name}`,
        email: candidate.email_addresses?.[0]?.value || candidate.email,
        phone: candidate.phone_numbers?.[0]?.value,
        linkedinUrl: candidate.linkedin_url,
        organizationId: org.id,
        status: 'PENDING',
        submissionIp: req.ip,
      },
    })

    await analysisQueue.add('full-analysis', { candidateId: created.id, orgId: org.id }, { attempts: 3 })
    await prisma.candidate.update({ where: { id: created.id }, data: { status: 'ANALYZING' } })

    return reply.status(202).send({ success: true, candidateId: created.id })
  })

  // POST /api/v1/webhooks/lever  - receive candidate from Lever ATS
  app.post('/lever', async (req, reply) => {
    const apiKey = req.headers['x-api-key'] as string
    const hash = crypto.createHash('sha256').update(apiKey || '').digest('hex')
    const org = await prisma.organization.findFirst({ where: { apiKeyHash: hash } })
    if (!org) return reply.status(401).send({ error: 'Unauthorized' })

    const payload = req.body as any
    const opp = payload.data

    const created = await prisma.candidate.create({
      data: {
        name: opp.name,
        email: opp.emails?.[0],
        phone: opp.phones?.[0]?.value,
        linkedinUrl: opp.links?.find((l: any) => l.includes('linkedin'))?.url,
        organizationId: org.id,
        status: 'PENDING',
      },
    })

    await analysisQueue.add('full-analysis', { candidateId: created.id, orgId: org.id }, { attempts: 3 })

    return reply.status(202).send({ success: true, candidateId: created.id })
  })

  // POST /api/v1/webhooks/generic  - generic ATS webhook
  app.post('/generic', async (req, reply) => {
    const apiKey = req.headers['x-api-key'] as string
    const hash = crypto.createHash('sha256').update(apiKey || '').digest('hex')
    const org = await prisma.organization.findFirst({ where: { apiKeyHash: hash } })
    if (!org) return reply.status(401).send({ error: 'Unauthorized' })

    const { name, email, phone, resumeText, linkedinUrl, githubUrl, jobTitle } = req.body as any

    if (!name || !email) return reply.status(400).send({ error: 'name and email are required' })

    const created = await prisma.candidate.create({
      data: { name, email, phone, resumeText, linkedinUrl, githubUrl, organizationId: org.id, status: 'PENDING' },
    })

    await analysisQueue.add('full-analysis', { candidateId: created.id, orgId: org.id }, { attempts: 3 })

    return reply.status(202).send({ success: true, candidateId: created.id })
  })

  // GET /api/v1/webhooks/config  - get webhook config
  app.get('/config', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId
    const org = await prisma.organization.findUnique({ where: { id: orgId } })

    return reply.send({
      success: true,
      data: {
        webhookUrl: org?.webhookUrl,
        endpoints: {
          greenhouse: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/webhooks/greenhouse`,
          lever: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/webhooks/lever`,
          generic: `${process.env.NEXT_PUBLIC_API_URL}/api/v1/webhooks/generic`,
        },
      },
      requestId: req.id,
    })
  })

  // PATCH /api/v1/webhooks/config  - update outbound webhook
  app.patch('/config', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId
    const { webhookUrl } = req.body as { webhookUrl: string }
    const secret = crypto.randomBytes(32).toString('hex')

    await prisma.organization.update({ where: { id: orgId }, data: { webhookUrl, webhookSecret: secret } })

    return reply.send({ success: true, data: { webhookUrl, webhookSecret: secret }, requestId: req.id })
  })
}
