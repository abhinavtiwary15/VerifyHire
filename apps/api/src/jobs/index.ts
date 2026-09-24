// apps/api/src/jobs/index.ts
import { Queue, Worker, QueueEvents } from 'bullmq'
import { redis } from '../plugins/redis'
import { prisma } from '../plugins/prisma'
import { resumeAnalyzerService } from '../services/resume-analyzer'
import { identityVerifierService } from '../services/identity-verifier'
import { scoringEngine } from '../services/scoring-engine'
import { fraudNetworkService } from '../services/fraud-network'

export const analysisQueue = new Queue('analysis', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
})

export const queueEvents = new QueueEvents('analysis', { connection: redis })

export function startWorkers() {
  const worker = new Worker(
    'analysis',
    async (job) => {
      const { candidateId, orgId, emailHash, phoneHash } = job.data

      console.info(`[Worker] Processing job ${job.name} for candidate ${candidateId}`)

      switch (job.name) {
        case 'full-analysis':
          return runFullAnalysis(candidateId, orgId, emailHash, phoneHash)
        case 'resume-analysis':
          return resumeAnalyzerService.analyze(candidateId)
        case 'identity-verification':
          return identityVerifierService.verify(candidateId)
        default:
          throw new Error(`Unknown job type: ${job.name}`)
      }
    },
    {
      connection: redis,
      concurrency: 5,
    }
  )

  worker.on('completed', (job) => {
    console.info(`[Worker] Job ${job.id} completed`)
  })

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message)
    if (job?.data?.candidateId) {
      prisma.candidate
        .update({ where: { id: job.data.candidateId }, data: { status: 'PENDING' } })
        .catch(console.error)
    }
  })

  console.info('[BullMQ] Workers started')
  return worker
}

async function runFullAnalysis(
  candidateId: string,
  orgId: string,
  emailHash?: string,
  phoneHash?: string
) {
  // Step 1: Resume analysis
  await prisma.candidate.update({ where: { id: candidateId }, data: { status: 'ANALYZING' } })

  const [resumeResult, identityResult, networkResult] = await Promise.allSettled([
    resumeAnalyzerService.analyze(candidateId),
    identityVerifierService.verify(candidateId),
    fraudNetworkService.check(candidateId, emailHash, phoneHash),
  ])

  // Step 2: Compute CAS
  const resumeData = resumeResult.status === 'fulfilled' ? resumeResult.value : null
  const identityData = identityResult.status === 'fulfilled' ? identityResult.value : null
  const networkData = networkResult.status === 'fulfilled' ? networkResult.value : null

  const casResult = await scoringEngine.compute(candidateId, { resumeData, identityData, networkData })

  // Step 3: Update candidate with final scores
  await prisma.candidate.update({
    where: { id: candidateId },
    data: {
      authenticityScore: casResult.overall,
      riskLevel: casResult.riskLevel,
      status: casResult.riskLevel === 'CRITICAL' || casResult.riskLevel === 'HIGH' ? 'FLAGGED' : 'COMPLETE',
    },
  })

  // Step 4: Send outbound webhook if configured
  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (org?.webhookUrl) {
    await sendOutboundWebhook(org.webhookUrl, org.webhookSecret!, candidateId, casResult)
  }

  return casResult
}

async function sendOutboundWebhook(url: string, secret: string, candidateId: string, result: any) {
  const payload = JSON.stringify({ candidateId, result, timestamp: new Date().toISOString() })
  const sig = require('crypto').createHmac('sha256', secret).update(payload).digest('hex')

  const maxAttempts = 3
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-verifyhire-signature': sig,
          'x-verifyhire-timestamp': Date.now().toString(),
        },
        body: payload,
      })
      if (res.ok) return
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000))
    } catch (e) {
      console.error(`[Webhook] Delivery attempt ${i + 1} failed:`, e)
      if (i === maxAttempts - 1) throw e
      await new Promise((r) => setTimeout(r, Math.pow(2, i) * 1000))
    }
  }
}
