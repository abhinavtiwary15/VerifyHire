// apps/api/src/routes/interview.ts
import { FastifyInstance } from 'fastify'
import { prisma } from '../plugins/prisma'
import { requireAuth } from '../middleware/auth'
import { broadcastAlert } from '../plugins/websocket'

export async function interviewRoutes(app: FastifyInstance) {

  // POST /api/v1/interview/sessions  - create a new interview session
  app.post('/sessions', { preHandler: requireAuth }, async (req, reply) => {
    const { candidateId, platform } = req.body as { candidateId: string; platform?: string }
    const orgId = (req as any).orgId

    const candidate = await prisma.candidate.findFirst({ where: { id: candidateId, organizationId: orgId } })
    if (!candidate) return reply.status(404).send({ success: false, error: 'Candidate not found', requestId: req.id })

    const session = await prisma.interviewSession.create({
      data: { candidateId, platform: platform || 'native', status: 'PENDING' },
    })

    const sessionUrl = `${process.env.FRONTEND_URL}/interview/${session.sessionToken}`

    return reply.status(201).send({
      success: true,
      data: { session, sessionUrl, wsUrl: `${process.env.NEXT_PUBLIC_WS_URL}/ws?sessionId=${session.id}` },
      requestId: req.id,
    })
  })

  // PATCH /api/v1/interview/sessions/:token/start
  app.patch('/sessions/:token/start', { preHandler: requireAuth }, async (req, reply) => {
    const { token } = req.params as { token: string }

    const session = await prisma.interviewSession.findUnique({ where: { sessionToken: token } })
    if (!session) return reply.status(404).send({ success: false, error: 'Session not found', requestId: req.id })

    const updated = await prisma.interviewSession.update({
      where: { sessionToken: token },
      data: { status: 'ACTIVE', startedAt: new Date() },
    })

    return reply.send({ success: true, data: updated, requestId: req.id })
  })

  // PATCH /api/v1/interview/sessions/:token/end
  app.patch('/sessions/:token/end', { preHandler: requireAuth }, async (req, reply) => {
    const { token } = req.params as { token: string }
    const scores = req.body as any

    const updated = await prisma.interviewSession.update({
      where: { sessionToken: token },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
        ...scores,
      },
    })

    return reply.send({ success: true, data: updated, requestId: req.id })
  })

  // POST /api/v1/interview/sessions/:token/alert  - receive alert from SDK
  app.post('/sessions/:token/alert', async (req, reply) => {
    const { token } = req.params as { token: string }
    const alert = req.body as any

    const session = await prisma.interviewSession.findUnique({ where: { sessionToken: token } })
    if (!session) return reply.status(404).send({ success: false, error: 'Session not found', requestId: req.id })

    const saved = await prisma.liveAlert.create({
      data: {
        sessionId: session.id,
        alertType: alert.alertType,
        confidence: alert.confidence,
        description: alert.description,
        frameSnapshot: alert.frameSnapshot,
      },
    })

    // Broadcast via WebSocket to recruiter
    broadcastAlert(session.id, {
      sessionId: session.id,
      alertType: alert.alertType,
      confidence: alert.confidence,
      timestamp: saved.timestamp.toISOString(),
      description: alert.description,
      frameSnapshot: alert.frameSnapshot,
      recommendation: getRecommendation(alert.alertType),
    })

    // Flag session if critical
    if (alert.confidence > 0.85 && ['DEEPFAKE_FACE', 'IDENTITY_SWITCH', 'VOICE_CLONE'].includes(alert.alertType)) {
      await prisma.interviewSession.update({ where: { id: session.id }, data: { status: 'FLAGGED' } })
    }

    return reply.send({ success: true, data: saved, requestId: req.id })
  })

  // GET /api/v1/interview/sessions/:token
  app.get('/sessions/:token', { preHandler: requireAuth }, async (req, reply) => {
    const { token } = req.params as { token: string }

    const session = await prisma.interviewSession.findUnique({
      where: { sessionToken: token },
      include: { liveAlerts: { orderBy: { timestamp: 'desc' } }, candidate: true },
    })

    if (!session) return reply.status(404).send({ success: false, error: 'Not found', requestId: req.id })

    return reply.send({ success: true, data: session, requestId: req.id })
  })
}

function getRecommendation(alertType: string): string {
  const recs: Record<string, string> = {
    DEEPFAKE_FACE: 'Ask candidate to remove any video filters and wave hand in front of face.',
    VOICE_CLONE: 'Ask candidate to say an unexpected phrase: "What is today\'s date and your coffee order?"',
    EARPIECE_DETECTED: 'Ask candidate to remove headphones/earbuds and show both ears to camera.',
    MULTIPLE_VOICES: 'Ask candidate to confirm they are alone and in a quiet space.',
    AI_SCRIPTED_ANSWER: 'Ask a highly specific follow-up about the exact project/company they described.',
    EYE_MOVEMENT_ANOMALY: 'Ask candidate to describe what they see directly behind their monitor.',
    IDENTITY_SWITCH: 'Compare current appearance to initial application photo. Request ID verification.',
    SCREEN_SHARE_CHEAT: 'Ask candidate to share their entire screen, not a specific window.',
  }
  return recs[alertType] || 'Continue monitoring. Issue a verification challenge if confidence increases.'
}
