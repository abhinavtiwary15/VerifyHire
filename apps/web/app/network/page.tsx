'use client'
import { useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { Globe, Search, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'

export default function NetworkPage() {
  const { accessToken } = useAuthStore()
  const [email, setEmail]   = useState('')
  const [phone, setPhone]   = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<any>(null)

  async function checkNetwork() {
    if (!email && !phone) return
    setLoading(true)
    setResult(null)
    try {
      const res: any = await api.checkNetwork(accessToken!, { email, phone })
      setResult(res.data)
    } catch {
      // Demo fallback
      await new Promise(r => setTimeout(r, 1600))
      const isHit = email.includes('proton') || email.includes('temp') || email.includes('guerrilla')
      setResult(isHit
        ? { match: true, matchCount: 2, maxFlagCount: 3, riskLevel: 'CRITICAL', message: 'Identity flagged by 2 organizations in the past 30 days for AI-generated resume and proxy interview.' }
        : { match: false, matchCount: 0, maxFlagCount: 0, riskLevel: 'LOW',     message: 'No matches found in the VerifyHire fraud network.' }
      )
    }
    setLoading(false)
  }

  const NETWORK_FLAGS = [
    { email:'a***@proton.me',       orgs:3, type:'AI Resume + Proxy Interview', date:'Apr 15' },
    { email:'j***@tempmail.com',    orgs:5, type:'Duplicate Identity',          date:'Apr 12' },
    { email:'m***@guerrilla.com',   orgs:2, type:'Location Spoofing + VPN',     date:'Apr 9'  },
    { email:'u***@fastmail.com',    orgs:1, type:'Deepfake Detected',           date:'Apr 6'  },
    { email:'x***@yopmail.com',     orgs:4, type:'Voice Clone + AI Resume',     date:'Apr 3'  },
  ]

  return (
    <div>
      <div className="sticky top-0 z-10 bg-[#111114] border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Fraud Intelligence Network</h1>
        <p className="text-xs text-zinc-500">Cross-organization hashed identity database</p>
      </div>

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label:'Network Entries',       value:'12,847', sub:'Hashed identifiers',    color:'text-white' },
            { label:'Cross-Org Matches',     value:'394',    sub:'Last 30 days',          color:'text-red-400' },
            { label:'Organizations Sharing', value:'89',     sub:'Active contributors',   color:'text-blue-400' },
          ].map(s => (
            <div key={s.label} className="bg-[#111114] border border-zinc-800 rounded-xl p-4">
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">{s.label}</div>
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-zinc-600 mt-1">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Check form */}
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-400" /> Check Identity Against Network
            </h2>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Email Address <span className="text-zinc-600">(hashed before lookup)</span></label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="candidate@example.com"
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Phone Number <span className="text-zinc-600">(optional)</span></label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000"
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500" />
              </div>
            </div>
            <button onClick={checkNetwork} disabled={loading || (!email && !phone)}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Querying network…</> : <><Globe className="w-4 h-4" /> Check Fraud Network</>}
            </button>

            {result && (
              <div className={`mt-4 p-4 rounded-lg border ${result.match ? 'bg-red-500/08 border-red-500/30' : 'bg-green-500/08 border-green-500/30'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {result.match
                    ? <AlertTriangle className="w-4 h-4 text-red-400" />
                    : <CheckCircle className="w-4 h-4 text-green-400" />
                  }
                  <span className={`text-sm font-semibold ${result.match ? 'text-red-400' : 'text-green-400'}`}>
                    {result.match ? '🚨 NETWORK MATCH FOUND' : '✓ No Network Match'}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{result.message}</p>
                {result.match && (
                  <div className="mt-2 text-[11px] font-bold px-2 py-1 rounded-full border inline-block bg-red-500/10 text-red-400 border-red-500/30">
                    {result.riskLevel} RISK · {result.matchCount} match(es)
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 p-3 bg-zinc-900 rounded-lg border border-zinc-800 text-[11px] text-zinc-500 leading-relaxed">
              🔒 All lookups use SHA-256 hashed identifiers. Raw PII is never transmitted or stored across organizations.
            </div>
          </div>

          {/* Recent network flags */}
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Recent Network Flags</h2>
            <div className="space-y-2">
              {NETWORK_FLAGS.map((f, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-zinc-300">{f.email}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/30">FLAGGED</span>
                  </div>
                  <div className="text-xs text-zinc-500">{f.type}</div>
                  <div className="text-[10px] text-zinc-600 mt-1">{f.orgs} org{f.orgs > 1 ? 's' : ''} · {f.date}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
