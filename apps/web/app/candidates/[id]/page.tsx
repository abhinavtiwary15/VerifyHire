'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Video, Flag, CheckCircle, FileText, ExternalLink } from 'lucide-react'

const DETAIL_DATA: Record<string, any> = {
  '1': { id:'1', name:'Marcus Chen', email:'m.chen.dev@protonmail.com', job:'Senior Software Engineer', phone:'+1 (408) 555-7291', cas:28, risk:'CRITICAL', status:'FLAGGED', date:'Apr 15, 2026',
    linkedin:'https://linkedin.com/in/marcuschen-dev', github:'', vpn:true, ipLocation:'Kyiv, Ukraine', claimedLocation:'San Francisco, CA',
    flags:[
      { id:'f1', type:'AI_GENERATED_RESUME', sev:'HIGH', icon:'🤖', label:'AI-Generated Resume', desc:'Resume shows AI-generation confidence of 87%. Perplexity 12.1, burstiness 3.2 — patterns consistent with GPT-4 output.', evidence:'Hash-verified, 2026-04-15T08:23:11Z' },
      { id:'f2', type:'SOCIAL_PROFILE_MISSING', sev:'MEDIUM', icon:'👤', label:'Social Profile Missing', desc:'LinkedIn profile created 3 months ago, only 8 connections. No GitHub presence found.', evidence:'Checked 2026-04-15T08:23:14Z' },
      { id:'f3', type:'WORK_HISTORY_UNVERIFIABLE', sev:'MEDIUM', icon:'🏢', label:'Work History Unverifiable', desc:'2 of 4 claimed employers (Stripe, Fintech Startup) could not be cross-referenced with public records.', evidence:'Verification score: 22/100' },
    ],
    scores:{ resumeAuth: 13, workHistory: 22, identity: 45, network: 50, interview: 70 },
    resumeText:`Marcus Chen is a seasoned software engineer with 8+ years of experience architecting highly scalable distributed systems. Proficient in building robust, performant solutions using cutting-edge technologies including Kubernetes, React, Node.js, and cloud-native architectures. At Stripe (2019-2022), served as a principal architect overseeing the payments infrastructure handling millions of transactions per second.`,
  },
  '4': { id:'4', name:'Sarah Nakamura', email:'snakamura@proton.me', job:'Data Scientist', cas:19, risk:'CRITICAL', status:'FLAGGED', date:'Apr 13, 2026',
    linkedin:'', github:'', vpn:true, ipLocation:'Bucharest, Romania', claimedLocation:'Seattle, WA',
    flags:[
      { id:'f1', type:'DEEPFAKE_DETECTED', sev:'CRITICAL', icon:'🎭', label:'Deepfake Detected', desc:'Jawline facial artifacts detected at 91% confidence during interview. Unnatural blink rate (0.3 bpm vs 15-20 avg).', evidence:'Frame 00:04:22, confidence 91%' },
      { id:'f2', type:'PROXY_INTERVIEW_SUSPECTED', sev:'CRITICAL', icon:'🎭', label:'Proxy Interview Suspected', desc:'Voice pattern analysis detected 2 distinct speakers. Response latency 4.8s average (baseline 1.1s).', evidence:'AssemblyAI voice analysis, 2026-04-13' },
      { id:'f3', type:'IDENTITY_MISMATCH', sev:'CRITICAL', icon:'⚠️', label:'Identity Mismatch', desc:'Face in video does not match LinkedIn profile photo (similarity 23%, threshold 85%).', evidence:'AWS Rekognition FaceMatch API' },
    ],
    scores:{ resumeAuth: 28, workHistory: 35, identity: 10, network: 20, interview: 8 },
    resumeText:`Sarah Nakamura is a data scientist with 5 years of experience in machine learning and statistical analysis...`,
  },
}

const RISK_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e'
}
const SEV_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW:      'bg-green-500/10 text-green-400 border-green-500/30',
}

function casColor(s: number) {
  return s < 30 ? '#ef4444' : s < 51 ? '#f97316' : s < 76 ? '#eab308' : '#22c55e'
}

export default function CandidateDetailPage() {
  const { id } = useParams()
  const router  = useRouter()
  const [tab, setTab] = useState('overview')
  const [disputing, setDisputing] = useState<string | null>(null)

  const c = DETAIL_DATA[id as string] || DETAIL_DATA['1']

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#111114] border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-zinc-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white">
            {c.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">{c.name}</h1>
            <p className="text-xs text-zinc-500">{c.job}</p>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border ml-1"
          style={{ background: `${RISK_COLOR[c.risk]}15`, color: RISK_COLOR[c.risk], borderColor: `${RISK_COLOR[c.risk]}40` }}>
          {c.risk} RISK
        </span>
        <div className="flex-1" />
        <button onClick={() => router.push('/interview')}
          className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-3 py-1.5 rounded-lg transition-colors">
          <Video className="w-3.5 h-3.5" /> Start Interview
        </button>
        <button className="flex items-center gap-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 text-sm px-3 py-1.5 rounded-lg transition-colors">
          <CheckCircle className="w-3.5 h-3.5" /> Clear
        </button>
        <button className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm px-3 py-1.5 rounded-lg transition-colors">
          <Flag className="w-3.5 h-3.5" /> Escalate
        </button>
        <button className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-3 py-1.5 rounded-lg transition-colors">
          <FileText className="w-3.5 h-3.5" /> Report
        </button>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg w-fit border border-zinc-800 mb-5">
          {['overview','flags','resume','timeline'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-all ${
                tab === t ? 'bg-[#111114] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-2 gap-5">
            {/* CAS card */}
            <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Authenticity Score</div>
              <div className="text-center mb-4">
                <div className="text-6xl font-black tracking-tighter" style={{ color: casColor(c.cas) }}>{c.cas}</div>
                <div className="text-xs text-zinc-400 mt-1">/ 100 · {c.risk} RISK</div>
              </div>
              <div className="space-y-2.5">
                {[
                  { label:'Resume Authenticity', val:c.scores.resumeAuth },
                  { label:'Work History Verified', val:c.scores.workHistory },
                  { label:'Identity Verification', val:c.scores.identity },
                  { label:'Network Reputation', val:c.scores.network },
                  { label:'Interview Behavioral', val:c.scores.interview },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2.5">
                    <div className="text-xs text-zinc-400 w-40 flex-shrink-0">{s.label}</div>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width:`${s.val}%`, background: casColor(s.val) }} />
                    </div>
                    <div className="text-xs font-semibold w-8 text-right" style={{ color: casColor(s.val) }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Identity card */}
            <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Identity Details</div>
              <table className="w-full text-sm">
                {[
                  ['Email', c.email],
                  ['Phone', c.phone || '—'],
                  ['Status', null],
                  ['Claimed Location', c.claimedLocation],
                  ['Detected IP Location', c.ipLocation],
                  ['VPN Detected', c.vpn ? '⚠️ YES — NordVPN exit node' : '✓ No'],
                  ['LinkedIn Age', '3 months (suspicious)'],
                  ['GitHub Repos', '0 public repos'],
                  ['Submitted', c.date],
                ].map(([k, v]) => (
                  <tr key={k as string} className="border-b border-zinc-800/50">
                    <td className="py-2 pr-4 text-zinc-500 text-xs w-40">{k}</td>
                    <td className="py-2 text-xs">
                      {k === 'Status'
                        ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-red-500/10 text-red-400 border-red-500/30">{c.status}</span>
                        : k === 'VPN Detected'
                          ? <span style={{ color: c.vpn ? '#ef4444' : '#22c55e' }}>{v}</span>
                          : <span className={k === 'Detected IP Location' && c.vpn ? 'text-orange-400' : 'text-zinc-300'}>{v}</span>
                      }
                    </td>
                  </tr>
                ))}
              </table>
            </div>
          </div>
        )}

        {tab === 'flags' && (
          <div className="space-y-3 max-w-2xl">
            {c.flags.map((f: any) => (
              <div key={f.id} className="bg-[#111114] border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{f.icon}</span>
                    <span className="text-sm font-semibold text-white">{f.label}</span>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEV_BADGE[f.sev]}`}>{f.sev}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed mb-2">{f.desc}</p>
                <div className="text-[10px] text-zinc-600 border-t border-zinc-800 pt-2 flex items-center justify-between">
                  <span>Evidence: {f.evidence}</span>
                  {disputing === f.id
                    ? <span className="text-green-400">Dispute submitted ✓</span>
                    : <button onClick={() => setDisputing(f.id)} className="text-blue-400 hover:text-blue-300 transition-colors">
                        Dispute this flag →
                      </button>
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'resume' && (
          <div className="max-w-2xl bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Resume Text Analysis</div>
            <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 whitespace-pre-wrap">
              <span className="bg-red-500/15 border-b border-red-500/50 cursor-help" title="AI-generation marker: 'seasoned software engineer' — low perplexity">
                Marcus Chen is a seasoned software engineer with 8+ years of experience
              </span>
              {' '}
              <span className="bg-red-500/15 border-b border-red-500/50 cursor-help" title="AI-generation marker: 'architecting highly scalable distributed systems' — uniform sentence structure">
                architecting highly scalable distributed systems.
              </span>
              {' '}
              <span className="bg-red-500/15 border-b border-red-500/50 cursor-help" title="AI-generation marker: 'cutting-edge technologies' — common GPT phrase">
                Proficient in building robust, performant solutions using cutting-edge technologies
              </span>
              {' including Kubernetes, React, Node.js, and cloud-native architectures.'}
            </div>
            <div className="text-[10px] text-zinc-600 mt-2">🟥 Highlighted = AI-generation markers | Hover for details</div>
          </div>
        )}

        {tab === 'timeline' && (
          <div className="max-w-lg">
            {[
              { time:'Apr 15 08:20', event:'Candidate submitted application', color:'#6366f1' },
              { time:'Apr 15 08:21', event:'Analysis pipeline triggered (BullMQ)', color:'#6366f1' },
              { time:'Apr 15 08:22', event:'Resume tokenized — AI score: 87%', color:'#f97316' },
              { time:'Apr 15 08:23', event:'Flag raised: AI_GENERATED_RESUME (HIGH)', color:'#ef4444' },
              { time:'Apr 15 08:23', event:'Work history verification — score: 22/100', color:'#f97316' },
              { time:'Apr 15 08:24', event:'Flag raised: WORK_HISTORY_UNVERIFIABLE (MEDIUM)', color:'#eab308' },
              { time:'Apr 15 08:24', event:'Identity check — VPN detected (NordVPN)', color:'#ef4444' },
              { time:'Apr 15 08:24', event:'CAS computed: 28 · CRITICAL', color:'#ef4444' },
              { time:'Apr 15 08:24', event:'Status set to FLAGGED, recruiter notified', color:'#ef4444' },
            ].map((e, i) => (
              <div key={i} className="flex gap-3 mb-4">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ background: e.color }} />
                  {i < 8 && <div className="w-px flex-1 mt-1" style={{ background: '#27272a' }} />}
                </div>
                <div className="pb-2">
                  <div className="text-xs text-zinc-300">{e.event}</div>
                  <div className="text-[10px] text-zinc-600 mt-0.5">{e.time}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
