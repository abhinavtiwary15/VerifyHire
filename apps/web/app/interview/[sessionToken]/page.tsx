'use client'
import { useParams, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Video, ArrowLeft, ExternalLink } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/lib/auth-store'

export default function InterviewSessionPage() {
  const { sessionToken } = useParams()
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!accessToken || !sessionToken) return
    api.getSession(accessToken, sessionToken as string)
      .then((res: any) => setSession(res.data))
      .catch((err: any) => setError(err.message || 'Session not found'))
      .finally(() => setLoading(false))
  }, [accessToken, sessionToken])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="text-zinc-400 text-sm">Loading session…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-sm">{error}</div>
        <button onClick={() => router.back()} className="text-zinc-400 text-sm hover:text-white">
          ← Go back
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#09090b] p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-white">Interview Session</h1>
            <p className="text-xs text-zinc-500 font-mono">{sessionToken}</p>
          </div>
        </div>

        {session && (
          <div className="space-y-4">
            {/* Session info */}
            <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Session Details</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Status', session.status],
                  ['Candidate', session.candidate?.name || '—'],
                  ['Platform', session.platform || 'native'],
                  ['Started', session.startedAt ? new Date(session.startedAt).toLocaleString() : '—'],
                  ['Ended', session.endedAt ? new Date(session.endedAt).toLocaleString() : '—'],
                  ['Alerts', session.liveAlerts?.length ?? 0],
                ].map(([k, v]) => (
                  <div key={k as string} className="bg-zinc-900 rounded-lg p-3">
                    <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">{k}</div>
                    <div className="text-sm font-medium text-white">{v as string}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live alerts */}
            {session.liveAlerts?.length > 0 && (
              <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">Live Alerts Recorded</div>
                <div className="space-y-2">
                  {session.liveAlerts.map((alert: any) => (
                    <div key={alert.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">{alert.alertType}</span>
                        <span className="text-xs text-zinc-500">{alert.confidence.toFixed(0)}% confidence</span>
                      </div>
                      <div className="text-xs text-zinc-400">{alert.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action: launch live monitor */}
            <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-indigo-300">Open Live Monitor</div>
                <div className="text-xs text-indigo-400/70 mt-0.5">View real-time analysis for this session</div>
              </div>
              <button
                onClick={() => router.push(`/interview?sessionId=${session.id}`)}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Video className="w-4 h-4" /> Start Monitor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
