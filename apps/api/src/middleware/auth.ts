// apps/api/src/middleware/auth.ts
import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../plugins/prisma'
import crypto from 'crypto'

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  // Check API key first (B2B)
  const apiKey = req.headers['x-api-key'] as string
  if (apiKey) {
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex')
    const org = await prisma.organization.findFirst({
      where: { apiKeyHash: hash },
    })
    if (!org) {
      return reply.status(401).send({ success: false, error: 'Invalid API key', requestId: req.id })
    }
    ;(req as any).organization = org
    ;(req as any).orgId = org.id
    return
  }

  // JWT auth (dashboard users)
  try {
    await req.jwtVerify()
    const payload = req.user as any
    ;(req as any).userId = payload.userId
    ;(req as any).orgId = payload.orgId
    ;(req as any).role = payload.role
  } catch {
    return reply.status(401).send({ success: false, error: 'Unauthorized', requestId: req.id })
  }
}

export async function requireRole(roles: string[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const role = (req as any).role
    if (!role || !roles.includes(role)) {
      return reply.status(403).send({ success: false, error: 'Insufficient permissions', requestId: req.id })
    }
  }
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split('@')
  return `${user[0]}***@${domain}`
}

export function maskPhone(phone: string): string {
  return phone.replace(/\d(?=\d{4})/g, '*')
}
