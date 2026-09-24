// apps/api/src/prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting seed...')
  
  // Find the first organization
  const org = await prisma.organization.findFirst()
  if (!org) {
    console.error('No organization found. Please register first!')
    return
  }

  const candidates = [
    { name: 'Marcus Chen', job: 'Senior Backend Engineer', cas: 28, risk: 'CRITICAL', status: 'FLAGGED' },
    { name: 'Sarah Nakamura', job: 'Data Scientist', cas: 19, risk: 'CRITICAL', status: 'FLAGGED' },
    { name: 'Liu Wei', job: 'Frontend Developer', cas: 43, risk: 'HIGH', status: 'FLAGGED' },
    { name: 'James Okafor', job: 'DevOps Engineer', cas: 62, risk: 'MEDIUM', status: 'COMPLETE' },
    { name: 'Elena Rodriguez', job: 'Product Manager', cas: 88, risk: 'LOW', status: 'CLEARED' },
    { name: 'Oliver Bennett', job: 'UX Designer', cas: 76, risk: 'LOW', status: 'CLEARED' },
    { name: 'Aarav Patel', job: 'Security Analyst', cas: 31, risk: 'HIGH', status: 'FLAGGED' },
  ]

  for (const c of candidates) {
    const candidate = await prisma.candidate.create({
      data: {
        name: c.name,
        email: `${c.name.toLowerCase().replace(' ', '.')}@example.com`,
        organizationId: org.id,
        authenticityScore: c.cas,
        riskLevel: c.risk as any,
        status: c.status as any,
        resumeText: 'Sample resume text for ' + c.name,
      }
    })

    // Add some flags for the critical ones
    if (c.risk === 'CRITICAL') {
      await prisma.fraudFlag.create({
        data: {
          candidateId: candidate.id,
          type: 'AI_GENERATED_RESUME',
          severity: 'HIGH',
          description: 'High confidence of AI-generated content detected in resume.',
        }
      })
      await prisma.fraudFlag.create({
        data: {
          candidateId: candidate.id,
          type: 'IDENTITY_MISMATCH',
          severity: 'CRITICAL',
          description: 'Candidate identity could not be verified against provided social profiles.',
        }
      })
    }
  }

  console.log('Seed completed successfully!')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
