'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { AlertTriangle, Users, TrendingUp, Bot, Plus, ArrowUpRight } from 'lucide-react'

const RECENT_CANDIDATES = [
  { id: '1', name: 'Marcus Chen', job: 'Senior Engineer', cas: 28, risk: 'CRITICAL', date: 'Apr 15' },
  { id: '4', name: 'Sarah Nakamura', job: 'Data Scientist', cas: 19, risk: 'CRITICAL', date: 'Apr 13' },
  { id: '6', name: 'Liu Wei', job: 'Backend Engineer', cas: 43, risk: 'HIGH', date: 'Apr 11' },
]

const FRAUD_TREND = [
  { date: 'Apr 1', ai: 3, identity: 1, behavioral: 2 },
  { date: 'Apr 5', ai: 5, identity: 2, behavioral: 1 },
  { date: 'Apr 9', ai: 2, identity: 3, behavioral: 4 },
  { date: 'Apr 13', ai: 7, identity: 2, behavioral: 3 },
  { date: 'Apr 17', ai: 4, identity: 5, behavioral: 2 },
]

const RISK_DIST = [
  { name: 'Low', value: 45, color: '#22c55e' },
  { name: 'Medium', value: 28, color: '#eab308' },
  { name: 'High', value: 18, color: '#f97316' },
  { name: 'Critical', value: 9, color: '#ef4444' },
]

const riskColors: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW: 'bg-green-500/10 text-green-400 border-green-500/30',
}

export default function DashboardPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.getDashboardStats(accessToken!),
    enabled: !!accessToken,
  })

  const statsData = (stats as any)?.data

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#111114] border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-white">Dashboard</h1>
          <p className="text-xs text-zinc-500">Fraud detection overview · Acme Corp</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/analyze')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" /> Screen Candidate
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Screened', value: statsData?.totalCandidates ?? 247, icon: Users, change: '+12%', up: true, color: 'text-white' },
            { label: 'Flagged High-Risk', value: statsData?.flaggedCount ?? 31, icon: AlertTriangle, change: '+8 this week', up: false, color: 'text-red-400' },
            { label: 'Avg Auth. Score', value: statsData?.avgAuthenticityScore ?? '72.4', icon: TrendingUp, change: '-1.2 vs prev', up: false, color: 'text-green-400' },
            { label: 'AI Resume Detected', value: 18, icon: Bot, change: '7.3% rate', up: false, color: 'text-orange-400' },
          ].map((s) => (
            <div key={s.label} className="bg-[#111114] border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">{s.label}</span>
                <s.icon className="w-4 h-4 text-zinc-600" />
              </div>
              <div className={`text-3xl font-bold tracking-tight ${s.color}`}>{s.value}</div>
              <div className={`text-[11px] mt-1.5 ${s.up ? 'text-green-400' : 'text-zinc-500'}`}>{s.change}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Fraud Signals — Last 30 Days</div>
            <div className="flex gap-4 mb-3">
              {[{ label: 'AI Resume', color: '#f97316' }, { label: 'Identity', color: '#ef4444' }, { label: 'Behavioral', color: '#eab308' }].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: l.color }} />
                  {l.label}
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={FRAUD_TREND} barSize={8} barGap={2}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#52525b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#52525b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="ai" fill="#f97316" radius={[3,3,0,0]} />
                <Bar dataKey="identity" fill="#ef4444" radius={[3,3,0,0]} />
                <Bar dataKey="behavioral" fill="#eab308" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Risk Level Distribution</div>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={RISK_DIST} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {RISK_DIST.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2.5 flex-1">
                {RISK_DIST.map(r => (
                  <div key={r.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                      <span className="text-xs text-zinc-400">{r.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-white">{r.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Recent High-Risk Candidates</div>
            <div className="space-y-1">
              {RECENT_CANDIDATES.map((c) => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/candidates/${c.id}`)}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0">
                    {c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{c.name}</div>
                    <div className="text-xs text-zinc-500">{c.job}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold" style={{ color: c.cas < 30 ? '#ef4444' : '#f97316' }}>{c.cas}</div>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${riskColors[c.risk]}`}>{c.risk}</span>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-zinc-600" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Live Alerts Feed</div>
            <div className="space-y-2">
              {[
                { type: 'CRITICAL', title: 'Deepfake Detected', desc: 'Sarah Nakamura — interview session', time: '2 min ago', color: '#ef4444' },
                { type: 'HIGH', title: 'AI Resume Detected', desc: 'Liu Wei — perplexity 22.1', time: '14 min ago', color: '#f97316' },
                { type: 'MEDIUM', title: 'Location Mismatch', desc: 'James Okafor — VPN detected', time: '1hr ago', color: '#eab308' },
                { type: 'LOW', title: 'Candidate Cleared', desc: 'Oliver Bennett — CAS: 76', time: '3hr ago', color: '#22c55e' },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: `${a.color}08` }}>
                  <div className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0" style={{ background: a.color }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold" style={{ color: a.color }}>{a.title}</div>
                    <div className="text-xs text-zinc-400">{a.desc}</div>
                  </div>
                  <div className="text-[10px] text-zinc-600 flex-shrink-0">{a.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
