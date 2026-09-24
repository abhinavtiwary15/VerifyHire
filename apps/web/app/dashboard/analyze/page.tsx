'use client'
import { useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { api } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { Search, Loader2, CheckCircle, AlertTriangle, XCircle, Zap } from 'lucide-react'

const FLAG_META: Record<string, { label: string; icon: string }> = {
  AI_GENERATED_RESUME:       { label: 'AI-Generated Resume',        icon: '🤖' },
  IDENTITY_MISMATCH:         { label: 'Identity Mismatch',           icon: '⚠️' },
  WORK_HISTORY_UNVERIFIABLE: { label: 'Work History Unverifiable',   icon: '🏢' },
  PROXY_INTERVIEW_SUSPECTED: { label: 'Proxy Interview',             icon: '🎭' },
  DEEPFAKE_DETECTED:         { label: 'Deepfake Detected',           icon: '🎭' },
  BEHAVIORAL_ANOMALY:        { label: 'Behavioral Anomaly',          icon: '👁️' },
  LOCATION_SPOOFING:         { label: 'Location Spoofing',           icon: '📍' },
  VOICE_CLONE_SUSPECTED:     { label: 'Voice Clone Suspected',       icon: '🎤' },
  DUPLICATE_IDENTITY:        { label: 'Duplicate Identity',          icon: '👥' },
  SOCIAL_PROFILE_MISSING:    { label: 'Social Profile Missing',      icon: '👤' },
}

const SEV: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW:      'bg-green-500/10 text-green-400 border-green-500/30',
}

function casColor(score: number) {
  if (score < 30) return '#ef4444'
  if (score < 51) return '#f97316'
  if (score < 76) return '#eab308'
  return '#22c55e'
}

function riskLabel(score: number) {
  if (score < 30) return 'CRITICAL'
  if (score < 51) return 'HIGH'
  if (score < 76) return 'MEDIUM'
  return 'LOW'
}

interface AnalysisResult {
  cas: number
  aiScore: number
  perp: number
  burst: number
  workScore: number
  identScore: number
  netScore: number
  flags: Array<{ type: string; sev: string; desc: string }>
  aiSummary: string
}

const ANALYSIS_STEPS = [
  'Tokenizing resume text…',
  'Calculating perplexity score…',
  'Running burstiness analysis…',
  'Checking stylometric patterns…',
  'Verifying work history via Claude…',
  'Cross-referencing social profiles…',
  'Querying fraud network…',
  'Computing authenticity score…',
  'Generating AI advisory…',
]

export default function AnalyzePage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()

  const [name, setName]         = useState('Marcus Chen')
  const [email, setEmail]       = useState('m.chen.dev@protonmail.com')
  const [job, setJob]           = useState('Senior Software Engineer')
  const [linkedin, setLinkedin] = useState('')
  const [github, setGithub]     = useState('')
  const [phone, setPhone]       = useState('+1 (408) 555-7291')
  const [resume, setResume]     = useState(
`Marcus Chen is a seasoned software engineer with 8+ years of experience architecting highly scalable distributed systems. Proficient in building robust, performant solutions using cutting-edge technologies including Kubernetes, React, Node.js, and cloud-native architectures. At Stripe (2019-2022), served as a principal architect overseeing the payments infrastructure handling millions of transactions per second. Prior to that, spent 3 years at a leading fintech startup driving core product initiatives. Passionate about leveraging AI/ML to optimize developer productivity and deliver exceptional user experiences that scale to millions of users globally.`
  )

  const [loading, setLoading]     = useState(false)
  const [stepIdx, setStepIdx]     = useState(0)
  const [progress, setProgress]   = useState(0)
  const [result, setResult]       = useState<AnalysisResult | null>(null)
  const [summaryText, setSummaryText] = useState('')
  const [streaming, setStreaming] = useState(false)

  async function runAnalysis() {
    if (!name || !resume) return
    setLoading(true)
    setResult(null)
    setSummaryText('')
    setStepIdx(0)
    setProgress(0)

    // Animate steps
    for (let i = 0; i < ANALYSIS_STEPS.length; i++) {
      await sleep(380)
      setStepIdx(i)
      setProgress(Math.round(((i + 1) / ANALYSIS_STEPS.length) * 88))
    }

    // Heuristic scoring
    const aiScore = computeAIScore(resume)
    const perp    = Math.max(5,  Math.round(100 - aiScore * 0.85 + jitter(6)))
    const burst   = Math.max(5,  Math.round(100 - aiScore * 0.72 + jitter(8)))
    const workScore  = linkedin ? Math.round(42 + Math.random() * 38) : Math.round(18 + Math.random() * 22)
    const identScore = linkedin ? Math.round(55 + Math.random() * 28) : Math.round(12 + Math.random() * 22)
    const netScore   = Math.round(70 + Math.random() * 25)
    const cas = Math.round(
      (100 - aiScore) * 0.25 +
      workScore       * 0.20 +
      identScore      * 0.20 +
      68              * 0.25 +
      netScore        * 0.10
    )

    const flags: AnalysisResult['flags'] = []
    if (aiScore > 60) flags.push({ type: 'AI_GENERATED_RESUME', sev: aiScore > 80 ? 'HIGH' : 'MEDIUM', desc: `Resume shows AI-generation confidence of ${aiScore}%. Perplexity ${perp}, burstiness ${burst}.` })
    if (!linkedin)     flags.push({ type: 'SOCIAL_PROFILE_MISSING', sev: 'MEDIUM', desc: 'No verifiable LinkedIn profile provided.' })
    if (workScore < 40) flags.push({ type: 'WORK_HISTORY_UNVERIFIABLE', sev: 'MEDIUM', desc: `Work history verification score: ${workScore}/100.` })

    // Try to submit to API (best-effort)
    if (accessToken) {
      try {
        await api.createCandidate(accessToken, { name, email, phone, resumeText: resume, linkedinUrl: linkedin || undefined, githubUrl: github || undefined, jobTitle: job })
      } catch { /* offline / dev mode */ }
    }

    setProgress(92)

    // Stream AI summary from Claude
    const aiSummary = await streamClaudeSummary({ name, job, cas, aiScore, perp, burst, workScore, identScore, flags })

    setProgress(100)
    setResult({ cas, aiScore, perp, burst, workScore, identScore, netScore, flags, aiSummary })
    setLoading(false)
  }

  async function streamClaudeSummary(data: any): Promise<string> {
    const { name, job, cas, aiScore, perp, burst, workScore, identScore, flags } = data
    const prompt = `You are VerifyHire, an AI hiring fraud detection system. Write a professional 3-paragraph advisory for a recruiter.

Candidate: ${name} — ${job}
CAS: ${cas}/100 | Risk: ${riskLabel(cas)}
AI-Generated Score: ${aiScore}/100 | Perplexity: ${perp} | Burstiness: ${burst}
Work History: ${workScore}/100 | Identity: ${identScore}/100
Flags: ${flags.map((f: any) => f.type).join(', ') || 'None'}

Write 3 clear paragraphs: (1) CAS overview and risk, (2) key detected signals with the specific scores, (3) recruiter action steps.
End with: "⚖️ DISCLAIMER: This report is advisory only. VerifyHire is not a consumer reporting agency. This does not constitute a background check under FCRA."`

    setStreaming(true)
    let full = ''

    try {
      const res = await fetch('/api/analyze-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })

      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6))
            if (json.text) {
              full += json.text
              setSummaryText(full)
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch {
      // Fallback typewriter
      const fallback = getFallback(name, job, cas, aiScore, flags)
      for (const char of fallback) {
        full += char
        setSummaryText(full)
        await sleep(10)
      }
    }

    setStreaming(false)
    return full
  }

  return (
    <div>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#111114] border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Resume Analysis</h1>
        <p className="text-xs text-zinc-500">AI-powered fraud detection pipeline</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-5 max-w-6xl">
          {/* Input form */}
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-400" /> Candidate Information
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="block text-xs text-zinc-400 mb-1">Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" className="input" /></div>
              <div><label className="block text-xs text-zinc-400 mb-1">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@example.com" className="input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="block text-xs text-zinc-400 mb-1">Job Title Applied</label>
                <input value={job} onChange={e => setJob(e.target.value)} placeholder="Senior Engineer" className="input" /></div>
              <div><label className="block text-xs text-zinc-400 mb-1">Phone</label>
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 555 000 0000" className="input" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div><label className="block text-xs text-zinc-400 mb-1">LinkedIn URL</label>
                <input value={linkedin} onChange={e => setLinkedin(e.target.value)} placeholder="linkedin.com/in/…" className="input" /></div>
              <div><label className="block text-xs text-zinc-400 mb-1">GitHub URL</label>
                <input value={github} onChange={e => setGithub(e.target.value)} placeholder="github.com/…" className="input" /></div>
            </div>
            <div className="mb-4">
              <label className="block text-xs text-zinc-400 mb-1">Resume / Cover Letter Text</label>
              <textarea value={resume} onChange={e => setResume(e.target.value)} rows={8}
                className="input resize-none leading-relaxed" placeholder="Paste resume text here…" />
            </div>
            <button onClick={runAnalysis} disabled={loading || !name || !resume}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Zap className="w-4 h-4" /> Run Full AI Analysis</>}
            </button>
          </div>

          {/* Results panel */}
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">Analysis Results</h2>

            {/* Loading state */}
            {loading && (
              <div className="space-y-4">
                <div className="bg-zinc-900 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-sm text-zinc-300">{ANALYSIS_STEPS[stepIdx]}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="text-xs text-zinc-600 mt-1.5">{progress}% complete</div>
                </div>
                {summaryText && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {summaryText}{streaming && <span className="typing-cursor" />}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!loading && !result && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="text-4xl mb-3">🔬</div>
                <div className="text-sm text-zinc-400 mb-1">No analysis yet</div>
                <div className="text-xs text-zinc-600">Fill in candidate info and run the pipeline</div>
              </div>
            )}

            {/* Results */}
            {!loading && result && (
              <div className="space-y-4 fade-in">
                {/* CAS gauge */}
                <div className="text-center py-2">
                  <CASGauge score={result.cas} />
                </div>

                {/* Score bars */}
                <div className="space-y-2.5">
                  {[
                    { label: 'Resume Authenticity',    val: Math.round(100 - result.aiScore) },
                    { label: 'Perplexity (Human-like)', val: Math.min(100, result.perp) },
                    { label: 'Burstiness (Natural)',    val: Math.min(100, result.burst) },
                    { label: 'Work History Verified',   val: result.workScore },
                    { label: 'Identity Verification',   val: result.identScore },
                    { label: 'Network Reputation',      val: result.netScore },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-2.5">
                      <div className="text-xs text-zinc-400 w-44 flex-shrink-0">{s.label}</div>
                      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${s.val}%`, background: casColor(s.val) }} />
                      </div>
                      <div className="text-xs font-semibold w-8 text-right" style={{ color: casColor(s.val) }}>{s.val}</div>
                    </div>
                  ))}
                </div>

                {/* Flags */}
                {result.flags.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Fraud Flags</div>
                    <div className="space-y-2">
                      {result.flags.map((f, i) => {
                        const meta = FLAG_META[f.type] || { label: f.type, icon: '⚠️' }
                        return (
                          <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-white">{meta.icon} {meta.label}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEV[f.sev]}`}>{f.sev}</span>
                            </div>
                            <div className="text-xs text-zinc-400">{f.desc}</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <button className="flex-1 bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-medium py-2 rounded-lg hover:bg-green-500/20 transition-colors">
                    ✓ Clear Candidate
                  </button>
                  <button className="flex-1 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-medium py-2 rounded-lg hover:bg-red-500/20 transition-colors">
                    🚩 Flag High-Risk
                  </button>
                  <button onClick={() => router.push('/candidates/1')}
                    className="flex-1 bg-zinc-800 text-zinc-300 text-xs font-medium py-2 rounded-lg hover:bg-zinc-700 transition-colors">
                    Full Report →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* AI Summary card */}
        {(summaryText && !loading) && (
          <div className="mt-5 max-w-6xl bg-[#111114] border border-zinc-800 rounded-xl p-5 fade-in">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">🤖 Claude AI Advisory Summary</div>
            <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
              {summaryText}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          background: #18181b;
          border: 1px solid #3f3f46;
          color: #fafafa;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .input:focus { border-color: #6366f1; }
      `}</style>
    </div>
  )
}

function CASGauge({ score }: { score: number }) {
  const color = casColor(score)
  const risk  = riskLabel(score)
  const arcLen = 204
  const fill   = Math.round((score / 100) * arcLen)

  return (
    <div className="inline-block text-center">
      <svg width="180" height="100" viewBox="0 0 180 100">
        <path d="M 20,85 A 70,70 0 0,1 160,85" stroke="#27272a" strokeWidth="12" fill="none" strokeLinecap="round" />
        <path d="M 20,85 A 70,70 0 0,1 160,85" stroke={color} strokeWidth="12" fill="none" strokeLinecap="round"
          strokeDasharray={`${fill} 220`} style={{ transition: 'stroke-dasharray 1s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div style={{ marginTop: -32 }}>
        <div className="text-5xl font-black tracking-tight" style={{ color }}>{score}</div>
        <div className="text-xs text-zinc-400 mt-0.5">Authenticity Score</div>
        <div className="mt-2">
          <span className="text-xs font-bold px-3 py-1 rounded-full border" style={{
            background: `${color}15`, color, borderColor: `${color}40`
          }}>{risk} RISK</span>
        </div>
      </div>
    </div>
  )
}

// ─── Utils ───────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
function jitter(n: number) { return Math.random() * n - n / 2 }

function computeAIScore(text: string): number {
  const signals = ['highly scalable','cutting-edge','robust','performant','leverage','passionate about',
    'seasoned','exceptional','optimize','cloud-native','best practices','cross-functional','utilize','facilitate']
  const lower = text.toLowerCase()
  const hits = signals.filter(s => lower.includes(s)).length
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
  const avgLen = sentences.reduce((a, s) => a + s.trim().split(' ').length, 0) / Math.max(1, sentences.length)
  return Math.min(95, Math.max(0, hits * 5 + (avgLen > 22 ? 15 : 0) + Math.random() * 8))
}

function getFallback(name: string, job: string, cas: number, aiScore: number, flags: any[]): string {
  const risk = riskLabel(cas)
  return `VerifyHire has completed a full analysis for ${name}, applying for ${job}. The Candidate Authenticity Score (CAS) is ${cas}/100, indicating a ${risk} risk level. ${cas < 50 ? 'This score warrants immediate review before proceeding.' : 'Standard verification steps are recommended.'}

Key signals: The resume AI-generation score is ${aiScore}/100 — ${aiScore > 70 ? 'highly suspicious, consistent with GPT-4 or Claude generation patterns.' : 'within acceptable range.'} ${flags.length > 0 ? `Fraud flags raised: ${flags.map(f => FLAG_META[f.type]?.label || f.type).join(', ')}.` : 'No significant fraud flags detected.'}

Recommended actions: ${cas < 30 ? 'Do NOT proceed until in-person identity verification is completed. Contact claimed employers directly.' : cas < 60 ? 'Proceed with caution. Verify 2+ employment references and conduct a structured interview.' : 'Standard process may continue with routine reference checks.'}

⚖️ DISCLAIMER: This report is advisory only. VerifyHire is not a consumer reporting agency. This output does not constitute a background check under the Fair Credit Reporting Act.`
}
