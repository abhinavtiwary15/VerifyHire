'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { Search, Plus, Filter } from 'lucide-react'

const MOCK_CANDIDATES = [
  { id:'1', name:'Marcus Chen', email:'m.chen.dev@protonmail.com', job:'Senior Software Engineer', cas:28, risk:'CRITICAL', status:'FLAGGED', date:'Apr 15', flags:['AI_GENERATED_RESUME','SOCIAL_PROFILE_MISSING'] },
  { id:'2', name:'Priya Sharma', email:'priya.sharma@gmail.com', job:'Product Manager', cas:81, risk:'LOW', status:'CLEARED', date:'Apr 14', flags:[] },
  { id:'3', name:'James Okafor', email:'j.okafor.tech@outlook.com', job:'DevOps Lead', cas:52, risk:'MEDIUM', status:'ANALYZING', date:'Apr 14', flags:['LOCATION_SPOOFING'] },
  { id:'4', name:'Sarah Nakamura', email:'snakamura@proton.me', job:'Data Scientist', cas:19, risk:'CRITICAL', status:'FLAGGED', date:'Apr 13', flags:['DEEPFAKE_DETECTED','PROXY_INTERVIEW_SUSPECTED','IDENTITY_MISMATCH'] },
  { id:'5', name:'Oliver Bennett', email:'oliver.bennett@company.co.uk', job:'Engineering Manager', cas:76, risk:'LOW', status:'CLEARED', date:'Apr 12', flags:[] },
  { id:'6', name:'Liu Wei', email:'lwei.dev@fastmail.com', job:'Backend Engineer', cas:43, risk:'HIGH', status:'FLAGGED', date:'Apr 11', flags:['AI_GENERATED_RESUME','DUPLICATE_IDENTITY'] },
]

const RISK_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW:      'bg-green-500/10 text-green-400 border-green-500/30',
}
const STATUS_BADGE: Record<string, string> = {
  FLAGGED:   'bg-red-500/10 text-red-400 border-red-500/30',
  ANALYZING: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  CLEARED:   'bg-green-500/10 text-green-400 border-green-500/30',
  PENDING:   'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
  COMPLETE:  'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
}

function casColor(s: number) {
  return s < 30 ? '#ef4444' : s < 51 ? '#f97316' : s < 76 ? '#eab308' : '#22c55e'
}

const FLAG_LABELS: Record<string, string> = {
  AI_GENERATED_RESUME: 'AI Resume', IDENTITY_MISMATCH: 'ID Mismatch',
  WORK_HISTORY_UNVERIFIABLE: 'Work History', PROXY_INTERVIEW_SUSPECTED: 'Proxy Interview',
  DEEPFAKE_DETECTED: 'Deepfake', BEHAVIORAL_ANOMALY: 'Behavioral',
  LOCATION_SPOOFING: 'Location', VOICE_CLONE_SUSPECTED: 'Voice Clone',
  DUPLICATE_IDENTITY: 'Duplicate', SOCIAL_PROFILE_MISSING: 'No Social',
}

export default function CandidatesPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const [search, setSearch] = useState('')
  const [riskFilter, setRiskFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['candidates', search, riskFilter],
    queryFn: () => api.getCandidates(accessToken!, { search, risk: riskFilter }),
    enabled: !!accessToken,
  })

  const candidates = ((data as any)?.data?.items || MOCK_CANDIDATES).filter((c: any) => {
    const q = search.toLowerCase()
    return (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.job?.toLowerCase().includes(q))
      && (!riskFilter || c.risk === riskFilter)
  })

  return (
    <div>
      <div className="sticky top-0 z-10 bg-[#111114] border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white">Candidates</h1>
          <p className="text-xs text-zinc-500">{candidates.length} total · {MOCK_CANDIDATES.filter(c => c.risk === 'CRITICAL' || c.risk === 'HIGH').length} high-risk</p>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search candidates…"
            className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-indigo-500 w-52" />
        </div>
        <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
          <option value="">All Risk Levels</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        <button onClick={() => router.push('/dashboard/analyze')}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Add Candidate
        </button>
      </div>

      <div className="p-6">
        <div className="bg-[#111114] border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-zinc-900/50">
                {['Candidate','Job Applied','Auth Score','Risk Level','Flags','Status','Submitted','Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-widest border-b border-zinc-800">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {candidates.map((c: any) => (
                <tr key={c.id} onClick={() => router.push(`/candidates/${c.id}`)}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/20 cursor-pointer transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                        {c.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{c.name}</div>
                        <div className="text-xs text-zinc-500">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{c.job}</td>
                  <td className="px-4 py-3">
                    <span className="text-xl font-bold" style={{ color: casColor(c.cas) }}>{c.cas}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${RISK_BADGE[c.risk]}`}>{c.risk}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.flags.length > 0
                      ? <div className="flex flex-wrap gap-1">
                          {c.flags.slice(0,2).map((f: string) => (
                            <span key={f} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                              {FLAG_LABELS[f] || f}
                            </span>
                          ))}
                          {c.flags.length > 2 && <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">+{c.flags.length-2}</span>}
                        </div>
                      : <span className="text-xs text-zinc-600">None</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{c.date}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      <button onClick={() => router.push(`/candidates/${c.id}`)}
                        className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-lg transition-colors">View</button>
                      <button className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg transition-colors">🚩</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
