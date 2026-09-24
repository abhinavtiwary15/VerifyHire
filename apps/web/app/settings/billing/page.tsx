'use client'
import { useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Check, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'

const PLANS = [
  { id:'SMB', name:'SMB', price:99, limit:10, users:1, color:'text-zinc-400', border:'border-zinc-800',
    features:['10 screenings/month','Resume AI analysis','Identity verification','API access','Email support'] },
  { id:'GROWTH', name:'Growth', price:499, limit:50, users:5, color:'text-indigo-400', border:'border-indigo-500', current:true,
    features:['50 screenings/month','Everything in SMB','ATS integrations (Greenhouse, Lever)','Live interview monitoring','Priority support'] },
  { id:'ENTERPRISE', name:'Enterprise', price:2000, limit:999999, users:999999, color:'text-purple-400', border:'border-purple-500',
    features:['Unlimited screenings','Everything in Growth','Fraud network access','Custom SLA & dedicated CSM','SSO / SAML','Custom contracts'] },
]

export default function BillingPage() {
  const { accessToken, organization } = useAuthStore()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ type: 'info' | 'error'; message: string } | null>(null)

  const { data: usage } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => api.getUsage(accessToken!),
    enabled: !!accessToken,
  })
  const u = (usage as any)?.data || { screeningsUsed: organization?.screeningsUsed ?? 18, screeningLimit: organization?.screeningLimit ?? 50, plan: organization?.plan ?? 'GROWTH' }

  async function handleUpgrade(planId: string) {
    setLoadingPlan(planId)
    setNotice(null)
    try {
      const res: any = await api.createCheckout(accessToken!, planId)
      if (res.data?.checkoutUrl) {
        window.location.href = res.data.checkoutUrl
      } else {
        setNotice({
          type: 'info',
          message: 'Stripe test mode is ready. Configure STRIPE_SECRET_KEY in your .env file to enable live checkout redirects.',
        })
      }
    } catch (err: any) {
      setNotice({
        type: 'info',
        message: err.message || 'Stripe checkout requires a valid STRIPE_SECRET_KEY in .env (Stripe test mode keys sk_test_... are supported).',
      })
    } finally {
      setLoadingPlan(null)
    }
  }

  async function handlePortal() {
    setNotice(null)
    try {
      const res: any = await api.createPortal(accessToken!)
      if (res.data?.portalUrl) {
        window.location.href = res.data.portalUrl
      } else {
        setNotice({
          type: 'info',
          message: 'Customer portal requires an active Stripe customer account associated with this organization.',
        })
      }
    } catch (err: any) {
      setNotice({
        type: 'info',
        message: err.message || 'Customer portal requires an active Stripe customer ID for this organization.',
      })
    }
  }

  const used = u.screeningsUsed || 18
  const limit = u.screeningLimit || 50
  const pct = Math.round((used / limit) * 100)

  return (
    <div>
      <div className="sticky top-0 z-10 bg-[#111114] border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Billing & Usage</h1>
        <p className="text-xs text-zinc-500">Manage your subscription, screening allocations, and Stripe payments</p>
      </div>

      <div className="p-6 space-y-6">
        {notice && (
          <div className="bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-xs rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 leading-relaxed">{notice.message}</div>
            <button onClick={() => setNotice(null)} className="text-zinc-500 hover:text-zinc-300 text-xs">Dismiss</button>
          </div>
        )}

        {/* Current usage */}
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Current Plan</div>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-4xl font-black text-indigo-400">Growth</div>
              <div>
                <div className="text-2xl font-bold text-white">$499<span className="text-sm text-zinc-400">/mo</span></div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30">Active</span>
              </div>
            </div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-zinc-400">Screenings Used</span>
              <span className="text-white font-semibold">{used} / {limit}</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-1">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width:`${pct}%` }} />
            </div>
            <div className="text-[10px] text-zinc-600">Resets on billing cycle date · $15/screening overage</div>
            <div className="flex gap-2 mt-4">
              <button onClick={handlePortal} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                <span>Manage via Stripe Portal</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </button>
            </div>
          </div>

          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">This Month&apos;s Usage</div>
            <div className="space-y-3">
              {[
                { label:'Resume Analyses',        value:18, max:50 },
                { label:'Identity Verifications', value:14, max:50 },
                { label:'Interview Sessions',     value:6,  max:50 },
                { label:'Network Fraud Checks',   value:31, max:500 },
              ].map(r => (
                <div key={r.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">{r.label}</span>
                    <span className="text-zinc-300 font-medium">{r.value}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500/60" style={{ width:`${Math.round((r.value/r.max)*100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-3 gap-4">
          {PLANS.map(plan => (
            <div key={plan.id} className={`bg-[#111114] border-2 ${plan.border} rounded-xl p-5 relative`}>
              {plan.current && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                  CURRENT PLAN
                </div>
              )}
              <div className={`text-sm font-bold mb-1 ${plan.color}`}>{plan.name}</div>
              <div className="text-3xl font-black text-white mb-0.5">
                ${plan.price.toLocaleString()}<span className="text-sm text-zinc-400 font-normal">/mo</span>
              </div>
              <div className="text-xs text-zinc-500 mb-4">
                {plan.limit === 999999 ? 'Unlimited' : plan.limit} screenings ·{' '}
                {plan.users === 999999 ? 'Unlimited' : plan.users} user{plan.users !== 1 ? 's' : ''}
              </div>
              <div className="space-y-2 mb-5">
                {plan.features.map(f => (
                  <div key={f} className="flex items-start gap-2 text-xs text-zinc-400">
                    <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              {plan.current
                ? <button className="w-full bg-zinc-800 text-zinc-500 text-sm py-2 rounded-lg cursor-default">Current Plan</button>
                : <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={loadingPlan === plan.id}
                    className={`w-full text-sm font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      plan.id === 'ENTERPRISE'
                        ? 'bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {loadingPlan === plan.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{plan.price > 499 ? 'Upgrade with Stripe →' : 'Switch Plan →'}</span>
                  </button>
              }
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
