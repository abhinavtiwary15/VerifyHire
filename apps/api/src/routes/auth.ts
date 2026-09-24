// apps/api/src/routes/auth.ts
import { FastifyInstance } from 'fastify'
import argon2 from 'argon2'
import crypto from 'crypto'
import { prisma } from '../plugins/prisma'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  organizationName: z.string().min(2),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function authRoutes(app: FastifyInstance) {

  // POST /api/v1/auth/register
  app.post('/register', async (req, reply) => {
    const body = registerSchema.parse(req.body)

    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) {
      return reply.status(409).send({ success: false, error: 'Email already registered', requestId: req.id })
    }

    const passwordHash = await argon2.hash(body.password, { type: argon2.argon2id })
    const apiKeyPlain = `gs_live_${crypto.randomBytes(24).toString('hex')}`
    const apiKeyHash = crypto.createHash('sha256').update(apiKeyPlain).digest('hex')

    const org = await prisma.organization.create({
      data: {
        name: body.organizationName,
        apiKeyHash,
        users: {
          create: {
            email: body.email,
            passwordHash,
            role: 'OWNER',
          },
        },
      },
      include: { users: true },
    })

    const user = org.users[0]
    const accessToken = app.jwt.sign(
      { userId: user.id, orgId: org.id, role: user.role },
      { expiresIn: '15m' }
    )
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    return reply.status(201).send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: 900,
        apiKey: apiKeyPlain, // Only shown once
        user: { id: user.id, email: user.email, role: user.role },
        organization: { id: org.id, name: org.name, plan: org.plan },
      },
      requestId: req.id,
    })
  })

  // POST /api/v1/auth/login
  app.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body)

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { organization: true },
    })

    if (!user || !(await argon2.verify(user.passwordHash, body.password))) {
      return reply.status(401).send({ success: false, error: 'Invalid credentials', requestId: req.id })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const accessToken = app.jwt.sign(
      { userId: user.id, orgId: user.organizationId, role: user.role },
      { expiresIn: '15m' }
    )
    const refreshToken = app.jwt.sign(
      { userId: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    )

    await prisma.auditLog.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        action: 'USER_LOGIN',
        ip: req.ip,
      },
    })

    return reply.send({
      success: true,
      data: {
        accessToken,
        refreshToken,
        expiresIn: 900,
        user: { id: user.id, email: user.email, role: user.role },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          plan: user.organization.plan,
          screeningsUsed: user.organization.screeningsUsed,
          screeningLimit: user.organization.screeningLimit,
        },
      },
      requestId: req.id,
    })
  })

  // POST /api/v1/auth/refresh
  app.post('/refresh', async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken: string }
    try {
      const payload = app.jwt.verify(refreshToken) as any
      if (payload.type !== 'refresh') throw new Error('Invalid token type')

      const user = await prisma.user.findUnique({ where: { id: payload.userId } })
      if (!user) throw new Error('User not found')

      const accessToken = app.jwt.sign(
        { userId: user.id, orgId: user.organizationId, role: user.role },
        { expiresIn: '15m' }
      )

      return reply.send({ success: true, data: { accessToken, expiresIn: 900 }, requestId: req.id })
    } catch {
      return reply.status(401).send({ success: false, error: 'Invalid refresh token', requestId: req.id })
    }
  })

  // POST /api/v1/auth/rotate-api-key
  app.post('/rotate-api-key', async (req, reply) => {
    try { await req.jwtVerify() } catch {
      return reply.status(401).send({ success: false, error: 'Unauthorized', requestId: req.id })
    }
    const { orgId } = req.user as any
    const apiKeyPlain = `gs_live_${crypto.randomBytes(24).toString('hex')}`
    const apiKeyHash = crypto.createHash('sha256').update(apiKeyPlain).digest('hex')

    await prisma.organization.update({ where: { id: orgId }, data: { apiKeyHash } })

    return reply.send({ success: true, data: { apiKey: apiKeyPlain }, requestId: req.id })
  })
}
