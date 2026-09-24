'use client'
import { useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { Copy, Eye, EyeOff, CheckCircle, XCircle, Loader2, RefreshCw, Send, Terminal, Check } from 'lucide-react'

interface InboundDoc {
  name: string
  badge: string
  endpoint: string
  headers: string
  description: string
  samplePayload: string
}

export default function IntegrationsPage() {
  const { accessToken } = useAuthStore()
  const [keyRevealed, setKeyRevealed] = useState(false)
  const [webhookUrl, setWebhookUrl]   = useState('https://your-ats.example.com/verifyhire/webhook')
  const [testing, setTesting]         = useState(false)
  const [testResult, setTestResult]   = useState<{ok:boolean;msg:string}|null>(null)
  const [copiedKey, setCopiedKey]     = useState(false)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab]     = useState<'greenhouse' | 'lever' | 'generic'>('greenhouse')

  const DEMO_KEY = 'vh_live_sk_xKd9mNpQr7vWs2jYtLhCbAeF0iUzXc3'
  const MASKED   = 'vh_live_sk_••••••••••••••••••••••••••••••••'
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  function copyText(text: string, onDone: () => void) {
    navigator.clipboard.writeText(text)
    onDone()
  }

  async function testWebhook() {
    setTesting(true)
    setTestResult(null)
    try {
      if (webhookUrl.includes('your-ats.example.com')) {
        throw new Error('Please enter your actual destination webhook endpoint URL')
      }
      // Send real test payload to customer's target URL
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VerifyHire-Event': 'candidate.analysis.completed',
          'X-VerifyHire-Signature': 'sha256=test_signature_verification_demo',
        },
        body: JSON.stringify({
          event: 'candidate.analysis.completed',
          timestamp: new Date().toISOString(),
          candidate: {
            id: 'cand_test_9921',
            name: 'Sarah Connor',
            email: 's.connor@example.com',
            casScore: 84,
            riskLevel: 'LOW',
            flagsCount: 0,
          },
        }),
      })
      if (!res.ok) throw new Error(`Target endpoint responded with HTTP ${res.status}`)
      setTestResult({ ok: true, msg: `Webhook delivered successfully (HTTP ${res.status}) ✓` })
    } catch (e: any) {
      setTestResult({ ok: false, msg: e.message || 'Webhook delivery failed' })
    } finally {
      setTesting(false)
    }
  }

  const INBOUND_CONFIGS: Record<'greenhouse' | 'lever' | 'generic', InboundDoc> = {
    greenhouse: {
      name: 'Greenhouse Harvest Webhook',
      badge: 'Inbound Ingestion',
      endpoint: `${baseUrl}/api/v1/webhooks/greenhouse`,
      headers: 'x-api-key: [Your API Key]',
      description: 'Automatically enqueues new candidate applications for automated fraud & authenticity analysis the instant an application is submitted.',
      samplePayload: `{
  "action": "candidate_application",
  "payload": {
    "application": {
      "candidate": {
        "first_name": "Marcus",
        "last_name": "Chen",
        "email_addresses": [{ "value": "marcus.chen@example.com" }],
        "phone_numbers": [{ "value": "+1-555-019-2834" }],
        "linkedin_url": "https://linkedin.com/in/marcus-chen-cloud"
      }
    }
  }
}`,
    },
    lever: {
      name: 'Lever Candidate Webhook',
      badge: 'Inbound Ingestion',
      endpoint: `${baseUrl}/api/v1/webhooks/lever`,
      headers: 'x-api-key: [Your API Key]',
      description: 'Ingests new candidate opportunities directly from Lever ATS and triggers the VerifyHire verification pipeline.',
      samplePayload: `{
  "event": "candidateCreated",
  "data": {
    "name": "Jordan Taylor",
    "emails": ["jordan.taylor@example.com"],
    "phones": [{ "value": "+1-555-012-3456" }],
    "links": ["https://linkedin.com/in/jordan-taylor-dev"]
  }
}`,
    },
    generic: {
      name: 'Generic ATS REST Webhook',
      badge: 'Workday · Ashby · Custom ATS',
      endpoint: `${baseUrl}/api/v1/webhooks/generic`,
      headers: 'x-api-key: [Your API Key]\nContent-Type: application/json',
      description: 'Universal JSON webhook ingestion for custom ATS platforms, Ashby, Workday, BambooHR, or internal recruiting scripts.',
      samplePayload: `{
  "name": "Alex Mercer",
  "email": "alex.mercer@company.io",
  "phone": "+1-555-014-9922",
  "resumeText": "Experienced Systems Engineer with 6 years in cloud infrastructure...",
  "linkedinUrl": "https://linkedin.com/in/alex-mercer-systems",
  "githubUrl": "https://github.com/alex-mercer"
}`,
    },
  }

  const activeDoc = INBOUND_CONFIGS[activeTab]

  return (
    <div>
      <div className="sticky top-0 z-10 bg-[#111114] border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Integrations & Webhooks</h1>
        <p className="text-xs text-zinc-500">Connect your ATS via inbound ingestion webhooks, API keys, and outbound delivery hooks</p>
      </div>

      <div className="p-6 space-y-6">
        {/* API Key */}
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <span>🔑</span> Organization API Key
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/30">
              Active
            </span>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Pass this key in the <code className="text-indigo-400 bg-zinc-900 px-1 py-0.5 rounded">x-api-key</code> header for all inbound ATS webhooks and API calls.
          </p>

          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3">
            <code className="flex-1 text-sm text-zinc-300 font-mono select-all">
              {keyRevealed ? DEMO_KEY : MASKED}
            </code>
            <button onClick={() => setKeyRevealed(v => !v)} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1" title={keyRevealed ? 'Hide' : 'Reveal'}>
              {keyRevealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button onClick={() => copyText(DEMO_KEY, () => { setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000) })} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1" title="Copy Key">
              {copiedKey ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-zinc-500">
            <span>Rate limit: 100 req/min</span>
            <span>·</span>
            <span>SHA-256 secure hash</span>
            <span>·</span>
            <button onClick={() => alert('API key rotation: Contact your organization owner to generate a new key.')} className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Rotate key
            </button>
          </div>
        </div>

        {/* Inbound ATS Webhook Ingestion */}
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-white">📥 Inbound ATS Ingestion</div>
              <p className="text-xs text-zinc-500">Automatically trigger screening when candidates apply in your ATS</p>
            </div>
            {/* Tabs */}
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-1 text-xs">
              {(['greenhouse', 'lever', 'generic'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-md font-medium transition-colors capitalize ${
                    activeTab === tab ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab === 'generic' ? 'Custom / Ashby' : tab}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">{activeDoc.name}</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                {activeDoc.badge}
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">{activeDoc.description}</p>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">Webhook URL</label>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-indigo-300">
                <span className="flex-1 truncate select-all">{activeDoc.endpoint}</span>
                <button
                  onClick={() => copyText(activeDoc.endpoint, () => { setCopiedIndex(1); setTimeout(() => setCopiedIndex(null), 2000) })}
                  className="text-zinc-500 hover:text-zinc-300 p-0.5"
                >
                  {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">Required Headers</label>
              <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-[11px] font-mono text-zinc-400 overflow-x-auto">
                {activeDoc.headers}
              </pre>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-1">Sample Inbound Payload</label>
              <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                {activeDoc.samplePayload}
              </pre>
            </div>
          </div>
        </div>

        {/* Outbound Webhook config */}
        <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-1">🔗 Outbound Results Webhook</div>
          <p className="text-xs text-zinc-500 mb-3">
            VerifyHire sends real-time candidate scores and fraud alerts back to your system upon completion.
          </p>

          <div className="mb-3">
            <label className="block text-xs text-zinc-400 mb-1">Destination Endpoint URL</label>
            <div className="flex gap-2">
              <input
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://api.yourcompany.com/webhooks/verifyhire"
                className="flex-1 bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
              <button
                onClick={testWebhook}
                disabled={testing}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send Test</span>
              </button>
            </div>
          </div>

          {testResult && (
            <div className={`flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg mb-3 ${
              testResult.ok ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {testResult.ok ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <XCircle className="w-4 h-4 flex-shrink-0" />}
              <span>{testResult.msg}</span>
            </div>
          )}

          <div className="text-[11px] text-zinc-500 bg-zinc-900/40 rounded-lg p-3 border border-zinc-800/60 space-y-1">
            <div className="text-zinc-400 font-medium">Security & Signature Verification:</div>
            <div>All outbound payloads include an <code className="text-indigo-400">X-VerifyHire-Signature</code> header computed as an HMAC-SHA256 digest using your organization secret.</div>
          </div>
        </div>
      </div>
    </div>
  )
}
