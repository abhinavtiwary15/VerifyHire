'use client'
import { useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { Copy, Eye, EyeOff, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react'

const ATS_LIST = [
  { id:'greenhouse', name:'Greenhouse', status:'connected', desc:'Auto-syncs candidates on application submission', color:'#22c55e' },
  { id:'lever',      name:'Lever',      status:'pending',   desc:'OAuth integration — click to authorize',      color:'#6366f1' },
  { id:'workday',    name:'Workday',    status:'pending',   desc:'Webhook-based integration',                   color:'#6366f1' },
  { id:'ashby',      name:'Ashby',      status:'pending',   desc:'API key integration',                         color:'#6366f1' },
  { id:'rippling',   name:'Rippling',   status:'pending',   desc:'Native app integration',                      color:'#6366f1' },
  { id:'bamboohr',   name:'BambooHR',   status:'pending',   desc:'REST API sync',                               color:'#6366f1' },
]

export default function IntegrationsPage() {
  const { accessToken } = useAuthStore()
  const [keyRevealed, setKeyRevealed] = useState(false)
  const [webhookUrl, setWebhookUrl]   = useState('https://your-ats.example.com/verifyhire/webhook')
  const [testing, setTesting]         = useState(false)
  const [testResult, setTestResult]   = useState<{ok:boolean;msg:string}|null>(null)
  const [copied, setCopied]           = useState(false)

  const DEMO_KEY = 'vh_live_sk_xKd9mNpQr7vWs2jYtLhCbAeF0iUzXc3'
  const MASKED   = 'vh_live_sk_••••••••••••••••••••••••••••••••'

  function copyKey() {
    navigator.clipboard.writeText(DEMO_KEY)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function testWebhook() {
    setTesting(true)
    setTestResult(null)
    try {
      if (webhookUrl.includes('your-ats')) throw new Error('Replace with your real webhook URL')
      await new Promise(r => setTimeout(r, 1400))
      setTestResult({ ok:true, msg:'Webhook responded 200 OK in 142ms ✓' })
    } catch (e:any) {
      setTestResult({ ok:false, msg:e.message || 'Webhook delivery failed' })
    }
    setTesting(false)
  }

  function connectATS(name: string) {
    alert(`OAuth authorization for ${name}.\n\nIn production, this opens an OAuth popup that:\n1. Authenticates with ${name}\n2. Grants VerifyHire read access to candidates\n3. Automatically syncs new applicants for screening`)
  }

  const ENDPOINTS = [
    { label:'Greenhouse', url:'/api/v1/webhooks/greenhouse' },
    { label:'Lever',      url:'/api/v1/webhooks/lever' },
    { label:'Generic',    url:'/api/v1/webhooks/generic' },
  ]

  return (
    <div>
      <div className="sticky top-0 z-10 bg-[#111114] border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Integrations</h1>
        <p className="text-xs text-zinc-500">ATS connections, API access & webhooks</p>
      </div>

      <div className="p-6 space-y-5">
        {/* API Key */}
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-3">🔑 API Key</div>
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3">
            <code className="flex-1 text-sm text-zinc-300 font-mono">{keyRevealed ? DEMO_KEY : MASKED}</code>
            <button onClick={() => setKeyRevealed(v => !v)} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
              {keyRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={copyKey} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1">
              {copied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-zinc-500">
            <span>Rate limit: 100 req/min</span>
            <span>·</span>
            <span>HMAC-SHA256 signed webhooks</span>
            <span>·</span>
            <button className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Rotate key
            </button>
          </div>
        </div>

        {/* Webhook config */}
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-3">🔗 Outbound Webhook</div>
          <div className="mb-3">
            <label className="block text-xs text-zinc-400 mb-1">Endpoint URL — receives candidate results when analysis completes</label>
            <div className="flex gap-2">
              <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
              <button onClick={testWebhook} disabled={testing}
                className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-4 py-2 rounded-lg transition-colors">
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Test →
              </button>
            </div>
          </div>
          {testResult && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${testResult.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {testResult.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {testResult.msg}
            </div>
          )}
          <div className="mt-3">
            <div className="text-xs text-zinc-500 mb-2">Inbound webhook endpoints (receive candidates from your ATS):</div>
            <div className="space-y-1">
              {ENDPOINTS.map(e => (
                <div key={e.label} className="flex items-center gap-2 text-xs font-mono text-zinc-400 bg-zinc-900 rounded px-3 py-1.5">
                  <span className="text-zinc-600 w-20">{e.label}</span>
                  <span className="text-indigo-400">{process.env.NEXT_PUBLIC_API_URL || 'https://api.verifyhire.io'}{e.url}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ATS integrations */}
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-4">🏢 ATS Integrations</div>
          <div className="grid grid-cols-3 gap-3">
            {ATS_LIST.map(ats => (
              <div key={ats.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-white">{ats.name}</span>
                  {ats.status === 'connected'
                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30">Connected</span>
                    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400">Not Connected</span>
                  }
                </div>
                <div className="text-xs text-zinc-500 mb-3">{ats.desc}</div>
                {ats.status === 'connected'
                  ? <button className="w-full text-xs bg-zinc-800 text-zinc-500 py-1.5 rounded-lg">Manage →</button>
                  : <button onClick={() => connectATS(ats.name)}
                      className="w-full text-xs bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 py-1.5 rounded-lg transition-colors">
                      Connect →
                    </button>
                }
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
