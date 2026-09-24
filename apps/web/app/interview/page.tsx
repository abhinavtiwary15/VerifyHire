'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Video, Square, Eye, Mic, Zap, RefreshCw, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/lib/auth-store'

const ALERT_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e', INFO: '#6366f1'
}

const FLAG_SEVERITY: Record<string, string> = {
  NO_FACE: 'HIGH',
  MULTIPLE_FACES: 'CRITICAL',
  LOOKING_AWAY: 'MEDIUM',
  POOR_LIGHTING: 'LOW',
  CAMERA_COVERED: 'CRITICAL',
}

interface LiveAlert {
  id: string
  type: string
  title: string
  desc: string
  confidence: number
  time: string
  color: string
  source: 'gemini' | 'system'
}

export default function InterviewPage() {
  const { accessToken } = useAuthStore()
  const videoRef          = useRef<HTMLVideoElement>(null)
  const canvasRef         = useRef<HTMLCanvasElement>(null)
  const streamRef         = useRef<MediaStream | null>(null)
  const sessionTimerRef   = useRef<NodeJS.Timeout | null>(null)
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [active, setActive]           = useState(false)
  const [alerts, setAlerts]           = useState<LiveAlert[]>([])
  const [duration, setDuration]       = useState(0)
  const [alertCount, setAlertCount]   = useState(0)
  const [behaviorScore, setBehaviorScore] = useState<number|null>(null)
  const [riskLevel, setRiskLevel]     = useState<string|null>(null)
  const [analyzing, setAnalyzing]     = useState(false)
  const [cameraOk, setCameraOk]       = useState(false)
  const [aiQuestions, setAiQuestions] = useState<string[]>([
    'Why did you leave your previous role?',
    'Describe your daily workflow at your last company.',
    'What was your team size?',
  ])
  const [generatingQ, setGeneratingQ] = useState(false)
  const [challenges, setChallenges]   = useState<string[]>([])
  const [lastAnalysis, setLastAnalysis] = useState<any>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)

  const addAlert = useCallback((a: Omit<LiveAlert, 'id'|'time'>) => {
    const newAlert: LiveAlert = { ...a, id: crypto.randomUUID(), time: new Date().toLocaleTimeString() }
    setAlerts(prev => [newAlert, ...prev].slice(0, 20)) // keep last 20
    setAlertCount(prev => prev + 1)
    if (a.type === 'HIGH' || a.type === 'CRITICAL') {
      setBehaviorScore(prev => Math.max(10, (prev ?? 80) - 12))
    }
  }, [])

  const captureAndAnalyzeFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !active) return
    const video = videoRef.current
    const canvas = canvasRef.current
    
    // Only capture if video is actually playing
    if (video.readyState < 2 || video.videoWidth === 0) return

    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, 640, 480)
    const frameData = canvas.toDataURL('image/jpeg', 0.6)

    setAnalyzing(true)
    setAnalysisError(null)

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
      const res = await fetch(`${apiUrl}/api/v1/interview/analyze-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ frameData }),
      })

      if (!res.ok) throw new Error(`Analysis API returned ${res.status}`)
      const result = await res.json()
      if (!result.success) throw new Error(result.error || 'Analysis failed')
      
      const analysis = result.data
      setLastAnalysis(analysis)

      // Generate alerts from real analysis flags
      if (analysis.flags && analysis.flags.length > 0) {
        for (const flag of analysis.flags) {
          const severity = FLAG_SEVERITY[flag] || 'MEDIUM'
          const titles: Record<string, string> = {
            NO_FACE: 'No Face Detected',
            MULTIPLE_FACES: 'Multiple People Detected',
            LOOKING_AWAY: 'Candidate Looking Away',
            POOR_LIGHTING: 'Poor Lighting Detected',
            CAMERA_COVERED: 'Camera Appears Covered',
          }
          addAlert({
            type: severity,
            title: titles[flag] || flag,
            desc: analysis.description || `Visual anomaly detected: ${flag}`,
            confidence: analysis.confidence,
            color: ALERT_COLOR[severity] || '#6366f1',
            source: 'gemini',
          })
        }
      }

    } catch (err: any) {
      console.warn('[InterviewMonitor] Frame analysis failed:', err.message)
      setAnalysisError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }, [active, accessToken, addAlert])

  async function startSession() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      streamRef.current = s
      if (videoRef.current) {
        videoRef.current.srcObject = s
        await videoRef.current.play()
      }
      setCameraOk(true)
    } catch {
      setCameraOk(false)
    }

    setActive(true)
    setAlerts([])
    setDuration(0)
    setAlertCount(0)
    setBehaviorScore(80)
    setRiskLevel('LOW')
    setLastAnalysis(null)
    setAnalysisError(null)

    // Session timer
    sessionTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000)

    // Initial analysis after 3 seconds (camera warm-up)
    setTimeout(() => {
      addAlert({
        type: 'INFO',
        title: 'VerifyHire Monitoring Active',
        desc: 'Gemini vision analysis initialized. Frame capture running every 8 seconds.',
        confidence: 100,
        color: ALERT_COLOR['INFO'],
        source: 'system',
      })
    }, 1000)

    // Analyze frame every 8 seconds
    setTimeout(() => {
      captureAndAnalyzeFrame()
      analysisIntervalRef.current = setInterval(captureAndAnalyzeFrame, 8000)
    }, 3000)
  }

  function stopSession() {
    setActive(false)
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current)
    if (analysisIntervalRef.current) clearInterval(analysisIntervalRef.current)
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current)  { videoRef.current.srcObject = null }
    setCameraOk(false)
    setAnalyzing(false)
  }

  useEffect(() => () => stopSession(), [])

  function fmt(s: number) { const m = Math.floor(s/60); return `${m}:${(s%60).toString().padStart(2,'0')}` }

  function issueChallenge(label: string, text: string) {
    setChallenges(prev => [...prev, text])
    addAlert({ type: 'LOW', title: `Challenge Issued: ${label}`, desc: text, confidence: 100, color: '#22c55e', source: 'system' })
  }

  async function generateQuestions() {
    setGeneratingQ(true)
    // Call Claude streaming API for contextual questions
    try {
      const res = await fetch('/api/analyze-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `Generate 5 highly specific behavioral interview questions designed to detect if someone is using AI assistance or a proxy interviewer. Each question should require specific personal knowledge the candidate cannot easily fake. Format: numbered list only, no intro text.` }),
      })
      if (!res.body) throw new Error('no stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6))
            if (json.text) fullText += json.text
          } catch { /* skip */ }
        }
      }
      const questions = fullText.split('\n').filter(l => l.match(/^\d+\./)).map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(Boolean).slice(0, 5)
      if (questions.length >= 3) setAiQuestions(questions)
    } catch {
      // Fallback
      setAiQuestions([
        'What was the name of your direct manager at your last company?',
        'Describe a specific bug you personally fixed in the last 3 months.',
        'What is the monthly cost of infrastructure you managed?',
        'What was your biggest technical mistake in the last 2 years?',
        'Name 3 colleagues from your current team (first names only).',
      ])
    }
    setGeneratingQ(false)
  }

  const riskBadgeStyle = (r: string|null) => {
    if (!r) return {}
    const c = ALERT_COLOR[r] || '#22c55e'
    return { background: `${c}15`, color: c, borderColor: `${c}40` }
  }

  const overallRisk = alerts.some(a => a.type === 'CRITICAL') ? 'CRITICAL' :
    alerts.some(a => a.type === 'HIGH') ? 'HIGH' :
    alerts.some(a => a.type === 'MEDIUM') ? 'MEDIUM' : riskLevel

  return (
    <div>
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#111114] border-b border-zinc-800 px-6 py-4 flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-white">Live Interview Monitor</h1>
          <p className="text-xs text-zinc-500">Gemini-powered visual anomaly detection · Not a deepfake classifier</p>
        </div>
        {active && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {analyzing && <span className="flex items-center gap-1 text-indigo-400"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" /> Analyzing…</span>}
            {analysisError && <span className="text-amber-400 text-[10px]">⚠ API offline</span>}
          </div>
        )}
        {active
          ? <span className="flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/30 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 pulse-dot" /> LIVE SESSION
            </span>
          : <span className="text-xs text-zinc-500 bg-zinc-800 px-2.5 py-1 rounded-full">No Session</span>
        }
        {!active
          ? <button onClick={startSession} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Video className="w-4 h-4" /> Start Session
            </button>
          : <button onClick={stopSession} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              <Square className="w-4 h-4" /> Stop Session
            </button>
        }
      </div>

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 gap-5">
          {/* Camera + analysis display */}
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
              Camera Feed · Gemini Vision Analysis
            </div>

            {/* Video */}
            <div className="bg-zinc-900 rounded-lg aspect-video flex items-center justify-center relative overflow-hidden mb-4">
              {cameraOk
                ? <video ref={videoRef} className="w-full h-full object-cover rounded-lg" muted />
                : <div className="text-center">
                    <div className="text-4xl mb-2">{active ? '📹' : '📹'}</div>
                    <div className="text-xs text-zinc-500">{active ? 'Awaiting camera permission…' : 'Start session to begin monitoring'}</div>
                  </div>
              }
              {active && (
                <>
                  <div className="absolute top-2 right-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-white pulse-dot" /> LIVE
                    </span>
                  </div>
                  {analyzing && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-900/70 px-2 py-0.5 rounded-full">
                      <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" /> Gemini analyzing…
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Last analysis summary */}
            {lastAnalysis && (
              <div className="bg-zinc-900 rounded-lg p-3 mb-3 text-xs">
                <div className="text-zinc-500 mb-1 flex items-center justify-between">
                  <span>Last Gemini Analysis</span>
                  <span className="text-zinc-600">{lastAnalysis.confidence}% confidence</span>
                </div>
                <div className="text-zinc-300">{lastAnalysis.description}</div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${lastAnalysis.face_present ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {lastAnalysis.face_present ? '✓ Face detected' : '✗ No face'}
                  </span>
                  {lastAnalysis.multiple_people && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400">⚠ Multiple faces</span>
                  )}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                    lastAnalysis.lighting_quality === 'good' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                  }`}>{lastAnalysis.lighting_quality} lighting</span>
                </div>
              </div>
            )}

            {/* Real-time Vision Monitoring Status */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-3 text-xs">
              <div className="flex items-center justify-between text-zinc-400 mb-1">
                <span className="font-medium text-zinc-300">Visual Integrity Pipeline</span>
                <span className="text-[10px] text-zinc-500 font-mono">{active ? 'Cadence: 8s' : 'Idle'}</span>
              </div>
              <div className="text-[11px] text-zinc-500 leading-relaxed">
                Captures keyframes at fixed intervals via HTML5 Canvas. Analyzed by Gemini 1.5 Flash Vision for observable visual anomalies (multi-person, presence, alignment).
              </div>
            </div>
          </div>

          {/* Alerts feed */}
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
              {active && <span className="w-1.5 h-1.5 rounded-full bg-red-500 pulse-dot" />}
              Live Alerts {alertCount > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{alertCount}</span>}
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {alerts.length === 0
                ? <div className="text-center py-12"><Eye className="w-8 h-8 text-zinc-700 mx-auto mb-2" /><div className="text-xs text-zinc-500">Monitoring inactive</div></div>
                : alerts.map(a => (
                    <div key={a.id} className="slide-in flex items-start gap-2.5 p-2.5 rounded-lg" style={{ background:`${a.color}08`, border:`1px solid ${a.color}25` }}>
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background:a.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold" style={{ color:a.color }}>{a.title}</div>
                        <div className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{a.desc}</div>
                        <div className="text-[10px] text-zinc-600 mt-1">{a.time} · {a.confidence}% confidence · {a.source === 'gemini' ? 'Gemini Vision' : 'System'}</div>
                      </div>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background:`${a.color}15`, color:a.color }}>{a.type}</span>
                    </div>
                  ))
              }
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Session stats */}
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Session Stats</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label:'Duration', value: active ? fmt(duration) : '—' },
                { label:'Alerts', value: alertCount || '—' },
                { label:'Behavior Score', value: behaviorScore ?? '—', color: behaviorScore ? (behaviorScore<40?'#ef4444':behaviorScore<60?'#f97316':'#22c55e') : undefined },
                { label:'Risk Level', value: overallRisk ?? '—', badge: overallRisk ?? undefined },
              ].map(s => (
                <div key={s.label} className="bg-zinc-900 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold mb-0.5">
                    {(s as any).badge
                      ? <span className="text-sm font-bold px-2 py-0.5 rounded-full border" style={riskBadgeStyle((s as any).badge)}>{s.value}</span>
                      : <span style={(s as any).color ? { color:(s as any).color } : {}}>{s.value}</span>
                    }
                  </div>
                  <div className="text-[10px] text-zinc-600 uppercase tracking-widest">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Verification challenges */}
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">Verification Challenges</div>
            <div className="space-y-2">
              {[
                { label:'3 Fingers', text:'Ask candidate to hold up exactly 3 fingers towards the camera', icon:'✋' },
                { label:'Wave Hand', text:'Ask candidate to slowly wave their hand directly in front of their face', icon:'👋' },
                { label:'Turn Sideways', text:'Ask candidate to show their left profile to the camera', icon:'↩️' },
                { label:'Say Phrase', text:'Ask: "What is today\'s weather and your favorite food?"', icon:'🗣️' },
              ].map(c => (
                <button key={c.label} onClick={() => issueChallenge(c.label, c.text)}
                  className="w-full flex items-center gap-2 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3 py-2 rounded-lg border border-zinc-800 transition-colors text-left">
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
            {challenges.length > 0 && (
              <div className="mt-2 text-[10px] text-green-400">✓ {challenges.length} challenge(s) issued</div>
            )}
          </div>

          {/* AI question generator */}
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">AI Question Generator</div>
            <div className="text-[11px] text-zinc-500 mb-3">Claude-generated verification questions to probe authenticity:</div>
            <div className="space-y-1.5 mb-3">
              {aiQuestions.map((q, i) => (
                <div key={i} className="text-xs bg-zinc-900 text-zinc-300 px-2.5 py-1.5 rounded-lg border border-zinc-800">{q}</div>
              ))}
            </div>
            <button onClick={generateQuestions} disabled={generatingQ}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 text-xs font-medium py-2 rounded-lg transition-colors">
              {generatingQ ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><Zap className="w-3.5 h-3.5" /> Generate Questions</>}
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 text-[11px] text-zinc-600">
          ⚖️ <strong className="text-zinc-500">Important:</strong> VerifyHire's interview monitor uses Gemini vision to flag observable anomalies (face absence, multiple people, lighting). It is <strong className="text-zinc-500">not</strong> a deepfake detection model and should not be used as the sole basis for any hiring decision. All flags are advisory only. Comply with applicable employment law before deploying AI-assisted interview tools.
        </div>
      </div>
    </div>
  )
}
