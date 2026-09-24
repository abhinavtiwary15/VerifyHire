// apps/api/src/routes/billing.ts
import { FastifyInstance } from 'fastify'
import Stripe from 'stripe'
import { prisma } from '../plugins/prisma'
import { requireAuth } from '../middleware/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' })

const PLAN_PRICE_IDS: Record<string, string> = {
  SMB: process.env.STRIPE_SMB_PRICE_ID!,
  GROWTH: process.env.STRIPE_GROWTH_PRICE_ID!,
  ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRICE_ID!,
}

const PLAN_LIMITS: Record<string, number> = {
  SMB: 10,
  GROWTH: 50,
  ENTERPRISE: 999999,
}

export async function billingRoutes(app: FastifyInstance) {

  // POST /api/v1/billing/checkout
  app.post('/checkout', { preHandler: requireAuth }, async (req, reply) => {
    const { plan } = req.body as { plan: string }
    const orgId = (req as any).orgId

    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) return reply.status(404).send({ success: false, error: 'Organization not found', requestId: req.id })

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PLAN_PRICE_IDS[plan], quantity: 1 }],
      success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
      metadata: { orgId, plan },
      customer: org.stripeCustomerId || undefined,
    })

    return reply.send({ success: true, data: { checkoutUrl: session.url }, requestId: req.id })
  })

  // POST /api/v1/billing/portal
  app.post('/portal', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId
    const org = await prisma.organization.findUnique({ where: { id: orgId } })

    if (!org?.stripeCustomerId) {
      return reply.status(400).send({ success: false, error: 'No billing account found', requestId: req.id })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    })

    return reply.send({ success: true, data: { portalUrl: session.url }, requestId: req.id })
  })

  // GET /api/v1/billing/usage
  app.get('/usage', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId
    const org = await prisma.organization.findUnique({ where: { id: orgId } })

    return reply.send({
      success: true,
      data: {
        plan: org?.plan,
        screeningsUsed: org?.screeningsUsed,
        screeningLimit: org?.screeningLimit,
        overageRate: 15,
      },
      requestId: req.id,
    })
  })

  // POST /api/v1/billing/webhook  - Stripe webhook handler
  app.post('/webhook', async (req, reply) => {
    const sig = req.headers['stripe-signature'] as string
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody || JSON.stringify(req.body),
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      )
    } catch {
      return reply.status(400).send({ error: 'Webhook signature verification failed' })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const { orgId, plan } = session.metadata!
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            plan: plan as any,
            stripeCustomerId: session.customer as string,
            stripeSubId: session.subscription as string,
            screeningLimit: PLAN_LIMITS[plan],
            screeningsUsed: 0,
          },
        })
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const org = await prisma.organization.findFirst({ where: { stripeCustomerId: invoice.customer as string } })
        if (org) {
          await prisma.organization.update({ where: { id: org.id }, data: { screeningsUsed: 0 } })
        }
        break
      }
      case 'invoice.payment_failed':
      case 'customer.subscription.deleted': {
        const obj = event.data.object as any
        const customerId = obj.customer
        const org = await prisma.organization.findFirst({ where: { stripeCustomerId: customerId } })
        if (org) {
          await prisma.organization.update({ where: { id: org.id }, data: { plan: 'SMB', screeningLimit: 0 } })
        }
        break
      }
    }

    return reply.send({ received: true })
  })
}
