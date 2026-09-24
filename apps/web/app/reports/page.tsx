'use client'
import { useState } from 'react'
import { FileText, Download, Loader2 } from 'lucide-react'

const PAST_REPORTS = [
  { name:'Marcus Chen — Senior Engineer',         type:'Full Report',  risk:'CRITICAL', date:'Apr 15, 2026' },
  { name:'Sarah Nakamura — Data Scientist',       type:'Full Report',  risk:'CRITICAL', date:'Apr 13, 2026' },
  { name:'James Okafor — DevOps Lead',            type:'Interview Report', risk:'MEDIUM', date:'Apr 14, 2026' },
  { name:'Liu Wei — Backend Engineer',            type:'Full Report',  risk:'HIGH',    date:'Apr 11, 2026' },
  { name:'Org Fraud Summary — April 2026',        type:'Org Summary',  risk:null,      date:'Apr 15, 2026' },
]

const RISK_BADGE: Record<string, string> = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
}

export default function ReportsPage() {
  const [candidate, setCandidate] = useState('')
  const [reportType, setReportType] = useState('Full Candidate Report')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated]   = useState(false)

  async function generateReport(fmt: string) {
    if (!candidate) return
    setGenerating(true)
    setGenerated(false)
    await new Promise(r => setTimeout(r, 1800))
    setGenerating(false)
    setGenerated(true)
  }

  return (
    <div>
      <div className="sticky top-0 z-10 bg-[#111114] border-b border-zinc-800 px-6 py-4">
        <h1 className="text-lg font-semibold text-white">Reports</h1>
        <p className="text-xs text-zinc-500">Generate and download candidate reports</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-5">
          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">📊 Generate Report</h2>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Select Candidate</label>
                <select value={candidate} onChange={e => setCandidate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                  <option value="">Choose a candidate…</option>
                  <option value="1">Marcus Chen — Senior Engineer</option>
                  <option value="2">Priya Sharma — Product Manager</option>
                  <option value="3">James Okafor — DevOps Lead</option>
                  <option value="4">Sarah Nakamura — Data Scientist</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Report Type</label>
                <select value={reportType} onChange={e => setReportType(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500">
                  <option>Full Candidate Report</option>
                  <option>Resume Analysis Only</option>
                  <option>Identity Verification Summary</option>
                  <option>Interview Session Report</option>
                  <option>Organization Fraud Summary</option>
                </select>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <button onClick={() => generateReport('pdf')} disabled={!candidate || generating}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors">
                {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</> : <><FileText className="w-4 h-4" /> Generate PDF Report</>}
              </button>
              <button onClick={() => generateReport('csv')} disabled={!candidate || generating}
                className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 font-medium py-2 rounded-lg text-sm transition-colors border border-zinc-700">
                <Download className="w-4 h-4" /> Export CSV Data
              </button>
            </div>

            {generated && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-xs p-3 rounded-lg mb-3">
                ✓ Report generated! In production, this downloads a branded PDF with CAS gauge, highlighted resume, and AI advisory.
              </div>
            )}

            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-[11px] text-zinc-500 leading-relaxed">
              ⚖️ <strong className="text-zinc-400">FCRA Disclaimer:</strong> This report is advisory only. VerifyHire is not a consumer reporting agency. This output does not constitute a background check under the Fair Credit Reporting Act. Final hiring decisions are always made by humans.
            </div>
          </div>

          <div className="bg-[#111114] border border-zinc-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-white mb-4">📁 Recent Reports</h2>
            <div className="space-y-1">
              {PAST_REPORTS.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors">
                  <FileText className="w-5 h-5 text-zinc-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">{r.name}</div>
                    <div className="text-xs text-zinc-500">{r.type} · {r.date}</div>
                  </div>
                  {r.risk && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${RISK_BADGE[r.risk]}`}>{r.risk}</span>}
                  <button className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
                    <Download className="w-3 h-3" /> PDF
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
