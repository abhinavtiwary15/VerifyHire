// apps/api/src/index.ts
import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { prisma } from './plugins/prisma'
import { redis } from './plugins/redis'
import { authRoutes } from './routes/auth'
import { candidateRoutes } from './routes/candidates'
import { jobRoutes } from './routes/jobs'
import { interviewRoutes } from './routes/interview'
import { webhookRoutes } from './routes/webhooks'
import { billingRoutes } from './routes/billing'
import { dashboardRoutes } from './routes/dashboard'
import { networkRoutes } from './routes/network'
import { interviewAnalyzeRoutes } from './routes/interview-analyze'
import { setupWebSocket } from './plugins/websocket'
import { startWorkers } from './jobs'

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    redact: ['req.headers.authorization', '*.password', '*.passwordHash'],
  },
})

async function bootstrap() {
  // ─── Security ──────────────────────────────────────────────
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })

  await app.register(cors, {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) => {
      return req.headers['x-api-key'] as string || req.ip
    },
  })

  // ─── Plugins ────────────────────────────────────────────────
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  })

  // ─── API Docs ───────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'VerifyHire API',
        description: 'AI-powered hiring fraud detection platform',
        version: '1.0.0',
      },
      servers: [{ url: process.env.NODE_ENV === 'production'
        ? 'https://api.verifyhire.io'
        : 'http://localhost:4000' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          apiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' },
        },
      },
    },
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list' },
  })

  // ─── Routes ─────────────────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(candidateRoutes, { prefix: '/api/v1/candidates' })
  await app.register(jobRoutes, { prefix: '/api/v1/jobs' })
  await app.register(interviewRoutes, { prefix: '/api/v1/interview' })
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' })
  await app.register(billingRoutes, { prefix: '/api/v1/billing' })
  await app.register(dashboardRoutes, { prefix: '/api/v1/dashboard' })
  await app.register(networkRoutes, { prefix: '/api/v1/network' })
  await app.register(interviewAnalyzeRoutes, { prefix: '/api/v1/interview' })

  // ─── Health check ────────────────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }))

  // ─── WebSocket ───────────────────────────────────────────────
  setupWebSocket(app)

  // ─── Global error handler ────────────────────────────────────
  app.setErrorHandler((error, req, reply) => {
    app.log.error({ err: error, url: req.url }, 'Unhandled error')
    const statusCode = error.statusCode || 500
    reply.status(statusCode).send({
      success: false,
      error: statusCode === 500 ? 'Internal server error' : error.message,
      requestId: req.id,
    })
  })

  // ─── Start ──────────────────────────────────────────────────
  const port = parseInt(process.env.PORT || '4000')
  await app.listen({ port, host: '0.0.0.0' })
  app.log.info(`VerifyHire API listening on port ${port}`)

  // ─── BullMQ Workers ─────────────────────────────────────────
  startWorkers()
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})

export { app }
