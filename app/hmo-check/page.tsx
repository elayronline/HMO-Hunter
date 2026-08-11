"use client"

/**
 * HMO Checker — type an address, get what you would need to check before buying.
 *
 * The page is built to be printed as much as read. Export is the browser's own
 * print-to-PDF rather than a bundled renderer: it needs no dependency, it always
 * matches what the user is looking at, and it cannot drift from the report the
 * page rendered. The print stylesheet below is what makes it a document rather
 * than a screenshot of an app.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Search, Printer, AlertTriangle, HelpCircle, CheckCircle2, Info } from "lucide-react"
import type { HmoCheckReport, Confidence } from "@/lib/report/hmo-check"

interface Candidate {
  id: string
  address: string
  postcode: string
  city: string
}

/** Confidence is shown, always. A fact without its standing is half a fact. */
const CONFIDENCE_STYLE: Record<Confidence, { label: string; className: string; Icon: typeof Info }> = {
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
  recorded: { label: "Recorded", className: "bg-blue-100 text-blue-800", Icon: Info },
  inferred: { label: "Inferred", className: "bg-amber-100 text-amber-800", Icon: AlertTriangle },
  unknown: { label: "Not established", className: "bg-slate-200 text-slate-700", Icon: HelpCircle },
}

export default function HmoCheckPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [report, setReport] = useState<HmoCheckReport | null>(null)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function check(address: string, id?: string) {
    setLoading(true)
    setError(null)
    setHint(null)
    setCandidates(null)
    try {
      const params = new URLSearchParams({ address })
      if (id) params.set("id", id)
      const res = await fetch(`/api/hmo-check?${params}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Something went wrong")
        setHint(data.hint ?? null)
        setReport(null)
      } else if (data.candidates) {
        setCandidates(data.candidates)
        setReport(null)
      } else {
        setReport(data.report)
      }
    } catch {
      setError("Could not reach the checker")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Print rules: drop the app furniture, keep the document. */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .print-page { box-shadow: none !important; border: none !important; margin: 0 !important; }
          /* A fact and its explanation must never be split across a page. */
          .print-keep { break-inside: avoid; page-break-inside: avoid; }
          @page { margin: 18mm; }
        }
      `}</style>

      <header className="bg-white border-b border-slate-200 px-4 py-3 no-print">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push("/map")} className="p-2 hover:bg-slate-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">HMO Checker</h1>
            <p className="text-xs text-slate-500">What to check before you buy</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <Card className="p-4 mb-6 no-print">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (query.trim().length >= 3) check(query.trim())
            }}
            className="flex gap-2"
          >
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Address or postcode — e.g. 12 Wilmslow Road, or M14 5AA"
              className="flex-1"
              aria-label="Address or postcode"
            />
            <Button type="submit" disabled={loading || query.trim().length < 3} className="bg-teal-600 hover:bg-teal-700">
              <Search className="w-4 h-4 mr-2" />
              {loading ? "Checking…" : "Check"}
            </Button>
          </form>
        </Card>

        {error && (
          <Card className="p-4 mb-6 border-amber-200 bg-amber-50 no-print">
            <p className="font-medium text-amber-900">{error}</p>
            {hint && <p className="text-sm text-amber-800 mt-1">{hint}</p>}
          </Card>
        )}

        {/* Several plausible matches: the user picks. A wrong match would be
            accurate about the wrong building, which is worse than no answer. */}
        {candidates && (
          <Card className="p-4 mb-6 no-print">
            <h2 className="font-semibold text-slate-900 mb-1">More than one match</h2>
            <p className="text-sm text-slate-600 mb-3">Choose the property you meant.</p>
            <div className="space-y-2">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => check(query.trim(), c.id)}
                  className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-teal-500 hover:bg-teal-50 transition-colors"
                >
                  <span className="font-medium text-slate-900">{c.address}</span>
                  <span className="text-sm text-slate-500 block">{c.postcode} · {c.city}</span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {report && (
          <Card className="p-6 md:p-8 print-page">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{report.address}</h2>
                <p className="text-sm text-slate-500">
                  {[report.postcode, report.council].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Button variant="outline" onClick={() => window.print()} className="no-print shrink-0">
                <Printer className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>

            {/* The one line someone reads if they read nothing else. */}
            <div className="p-4 rounded-lg bg-slate-900 text-white mb-6 print-keep">
              <p className="font-medium">{report.headline}</p>
            </div>

            {report.sections.map((section) => (
              <section key={section.title} className="mb-6 print-keep">
                <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
                  {section.title}
                </h3>
                {section.facts.length === 0 ? (
                  <p className="text-sm text-slate-500 italic">{section.emptyMessage}</p>
                ) : (
                  <div className="space-y-3">
                    {section.facts.map((fact, i) => {
                      const style = CONFIDENCE_STYLE[fact.confidence]
                      return (
                        <div key={i} className="border-l-2 border-slate-200 pl-3 print-keep">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-sm text-slate-500">{fact.label}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${style.className}`}>
                              {style.label}
                            </span>
                          </div>
                          <p className="text-slate-900 font-medium">{fact.value}</p>
                          {fact.note && <p className="text-sm text-slate-600 mt-0.5">{fact.note}</p>}
                          {fact.source && (
                            <p className="text-xs text-slate-400 mt-0.5">Source: {fact.source}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            ))}

            {/* Not an appendix. What the data cannot settle is the part that
                decides whether someone needs to pick up the phone. */}
            <section className="mb-6 print-keep">
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
                What this report cannot tell you
              </h3>
              <ul className="space-y-2">
                {report.openQuestions.map((q, i) => (
                  <li key={i} className="flex gap-2 text-sm text-slate-700">
                    <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="text-xs text-slate-500 border-t border-slate-200 pt-4">
              {report.disclaimer}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              Generated {new Date(report.generatedAt).toLocaleString("en-GB")} · HMO Hunter
            </p>
          </Card>
        )}
      </main>
    </div>
  )
}
