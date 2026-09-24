// apps/api/src/routes/billing.ts
import { FastifyInstance } from 'fastify'
import Stripe from 'stripe'
import { prisma } from '../plugins/prisma'
import { requireAuth } from '../middleware/auth'

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.includes('sk_test_...')) return null
  return new Stripe(key, { apiVersion: '2024-06-20' })
}

const PLAN_LIMITS: Record<string, number> = {
  SMB: 10,
  GROWTH: 50,
  ENTERPRISE: 999999,
}

const PLAN_AMOUNTS: Record<string, number> = {
  SMB: 9900,         // $99/mo
  GROWTH: 49900,     // $499/mo
  ENTERPRISE: 200000 // $2,000/mo
}

export async function billingRoutes(app: FastifyInstance) {

  // POST /api/v1/billing/checkout
  app.post('/checkout', { preHandler: requireAuth }, async (req, reply) => {
    const { plan } = req.body as { plan: string }
    const orgId = (req as any).orgId

    const stripe = getStripeClient()
    if (!stripe) {
      return reply.status(400).send({
        success: false,
        error: 'Stripe is not configured in this environment. Set a valid STRIPE_SECRET_KEY in your .env file to enable checkout.',
        requestId: req.id,
      })
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) return reply.status(404).send({ success: false, error: 'Organization not found', requestId: req.id })

    // Resolve line items: use configured Price ID if provided, otherwise construct ad-hoc subscription price
    const envPriceId = (process.env as any)[`STRIPE_${plan}_PRICE_ID`]
    const lineItem = envPriceId
      ? { price: envPriceId, quantity: 1 }
      : {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `VerifyHire ${plan} Subscription`,
              description: `${PLAN_LIMITS[plan] || 50} candidate fraud screenings per month`,
            },
            unit_amount: PLAN_AMOUNTS[plan] || 49900,
            recurring: { interval: 'month' as const },
          },
          quantity: 1,
        }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [lineItem],
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing?success=true`,
        cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing?canceled=true`,
        metadata: { orgId, plan },
        customer: org.stripeCustomerId || undefined,
      })

      return reply.send({ success: true, data: { checkoutUrl: session.url }, requestId: req.id })
    } catch (err: any) {
      app.log.error({ err }, '[Billing] Stripe checkout session creation failed')
      return reply.status(500).send({ success: false, error: err.message, requestId: req.id })
    }
  })

  // POST /api/v1/billing/portal
  app.post('/portal', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId
    const stripe = getStripeClient()

    if (!stripe) {
      return reply.status(400).send({
        success: false,
        error: 'Stripe is not configured. Set STRIPE_SECRET_KEY in .env.',
        requestId: req.id,
      })
    }

    const org = await prisma.organization.findUnique({ where: { id: orgId } })

    if (!org?.stripeCustomerId) {
      return reply.status(400).send({ success: false, error: 'No active Stripe customer account found for this organization.', requestId: req.id })
    }

    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/billing`,
      })

      return reply.send({ success: true, data: { portalUrl: session.url }, requestId: req.id })
    } catch (err: any) {
      return reply.status(500).send({ success: false, error: err.message, requestId: req.id })
    }
  })

  // GET /api/v1/billing/usage
  app.get('/usage', { preHandler: requireAuth }, async (req, reply) => {
    const orgId = (req as any).orgId
    const org = await prisma.organization.findUnique({ where: { id: orgId } })

    return reply.send({
      success: true,
      data: {
        plan: org?.plan || 'GROWTH',
        screeningsUsed: org?.screeningsUsed || 0,
        screeningLimit: org?.screeningLimit || 50,
        overageRate: 15,
      },
      requestId: req.id,
    })
  })

  // POST /api/v1/billing/webhook - Stripe webhook handler
  app.post('/webhook', async (req, reply) => {
    const stripe = getStripeClient()
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    if (!stripe || !webhookSecret) {
      return reply.status(400).send({ error: 'Stripe webhook receiver is unconfigured' })
    }

    const sig = req.headers['stripe-signature'] as string
    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(
        (req as any).rawBody || JSON.stringify(req.body),
        sig,
        webhookSecret
      )
    } catch (err: any) {
      return reply.status(400).send({ error: `Webhook signature verification failed: ${err.message}` })
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.orgId && session.metadata?.plan) {
          const { orgId, plan } = session.metadata
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              plan: plan as any,
              stripeCustomerId: (session.customer as string) || null,
              stripeSubId: (session.subscription as string) || null,
              screeningLimit: PLAN_LIMITS[plan] || 50,
              screeningsUsed: 0,
            },
          })
        }
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.customer) {
          const org = await prisma.organization.findFirst({ where: { stripeCustomerId: invoice.customer as string } })
          if (org) {
            await prisma.organization.update({ where: { id: org.id }, data: { screeningsUsed: 0 } })
          }
        }
        break
      }
      case 'invoice.payment_failed':
      case 'customer.subscription.deleted': {
        const obj = event.data.object as any
        const customerId = obj.customer
        if (customerId) {
          const org = await prisma.organization.findFirst({ where: { stripeCustomerId: customerId } })
          if (org) {
            await prisma.organization.update({ where: { id: org.id }, data: { plan: 'SMB', screeningLimit: 10 } })
          }
        }
        break
      }
    }

    return reply.send({ received: true })
  })
}
