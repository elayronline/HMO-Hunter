"use client"

/**
 * HMO Checker — type an address, get what you would need to check before buying.
 *
 * The page is built to be printed as much as read. Export is the browser's own
 * print-to-PDF rather than a bundled renderer: it needs no dependency, it always
 * matches what the user is looking at, and it cannot drift from the report the
 * page rendered. The print stylesheet below is what makes it a document rather
 * than a screenshot of an app.
 *
 * The report is laid out as a two-column document on wide screens: facts on the
 * left, their standing on the right. Confidence is not a decoration here — it is
 * the column a reader scans to decide which lines they can act on and which they
 * have to go and confirm — so it is given a fixed position rather than a chip
 * floating in the text.
 */

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { AppShell, ShellButton } from "@/components/app-shell"
import {
  Search,
  Printer,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  Info,
  FileSearch,
  ShieldCheck,
  Building2,
} from "lucide-react"
import type { HmoCheckReport, Confidence } from "@/lib/report/hmo-check"

interface Candidate {
  id: string
  address: string
  postcode: string
  city: string
}

/** Confidence is shown, always. A fact without its standing is half a fact. */
const CONFIDENCE_STYLE: Record<
  Confidence,
  { label: string; className: string; Icon: typeof Info }
> = {
  verified: {
    label: "Verified",
    className: "bg-brand-soft text-brand border-brand-line",
    Icon: CheckCircle2,
  },
  recorded: {
    label: "Recorded",
    className: "bg-surface-sunken text-ink-muted border-line-strong",
    Icon: Info,
  },
  inferred: {
    label: "Inferred",
    className: "bg-warn-soft text-warn border-warn-line",
    Icon: AlertTriangle,
  },
  unknown: {
    label: "Not established",
    className: "bg-danger-soft text-danger border-danger-line",
    Icon: HelpCircle,
  },
}

/** What the checker answers, shown before anything has been searched. */
const EMPTY_STATE = [
  {
    icon: ShieldCheck,
    title: "Whether a planning restriction applies",
    body: "Article 4 directions, with the council's own words where we hold them — and an explicit \"not established\" where we do not, because silence is not an all clear.",
  },
  {
    icon: Building2,
    title: "What it is now, and what it could become",
    body: "Use class, licence status and expiry, and the permitted development route to an HMO where one exists.",
  },
  {
    icon: FileSearch,
    title: "What the data cannot settle",
    body: "Every report ends with the questions that need a phone call. Exported as a PDF you can send on.",
  },
]

export default function HmoCheckPage() {
  // useSearchParams needs a Suspense boundary to avoid opting the whole route
  // into client-side rendering.
  return (
    <Suspense fallback={null}>
      <HmoCheck />
    </Suspense>
  )
}

function HmoCheck() {
  const searchParams = useSearchParams()
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

  // The dashboard links here with the address already chosen, so arriving with
  // one should produce the report rather than a search box the user has to
  // retype into. Guarded with a ref because the effect must run once per
  // address, not on every render.
  const ranFor = useRef<string | null>(null)
  useEffect(() => {
    const incoming = searchParams.get("address")?.trim()
    if (!incoming || incoming.length < 3 || ranFor.current === incoming) return
    ranFor.current = incoming
    setQuery(incoming)
    check(incoming)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <AppShell
      title="Address check"
      subtitle="What to check before you buy"
      actions={
        report ? (
          <ShellButton onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Export PDF
          </ShellButton>
        ) : undefined
      }
    >
      {/* Print rules: drop the app furniture, keep the document. */}
      <style jsx global>{`
        @media print {
          .no-print,
          aside,
          header {
            display: none !important;
          }
          body {
            background: white;
          }
          main {
            padding: 0 !important;
          }
          .lg\\:pl-\\[var\\(--shell-width\\)\\] {
            padding-left: 0 !important;
          }
          .print-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
          }
          /* A fact and its explanation must never be split across a page. */
          .print-keep {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          @page {
            margin: 18mm;
          }
        }
      `}</style>

      <div className="mx-auto max-w-4xl space-y-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (query.trim().length >= 3) check(query.trim())
          }}
          className="no-print flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Address or postcode — e.g. 12 Wilmslow Road, or M14 5AA"
              aria-label="Address or postcode"
              className="w-full rounded-md border border-line-strong bg-surface py-2.5 pl-9 pr-3 text-[0.875rem] text-ink shadow-[var(--elev-1)] placeholder:text-ink-faint"
            />
          </div>
          <button
            type="submit"
            disabled={loading || query.trim().length < 3}
            className="shrink-0 rounded-md bg-brand px-5 py-2.5 text-[0.875rem] font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Checking…" : "Check"}
          </button>
        </form>

        {error && (
          <div className="no-print rounded-lg border border-warn-line bg-warn-soft px-4 py-3">
            <p className="text-[0.875rem] font-semibold text-warn">{error}</p>
            {hint && <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">{hint}</p>}
          </div>
        )}

        {/* Several plausible matches: the user picks. A wrong match would be
            accurate about the wrong building, which is worse than no answer. */}
        {candidates && (
          <div className="no-print rounded-lg border border-line bg-surface p-4 shadow-[var(--elev-1)]">
            <h2 className="text-[0.9375rem] font-bold text-ink">More than one match</h2>
            <p className="mb-3 mt-0.5 text-[0.8125rem] text-ink-subtle">
              Choose the property you meant. A report about the wrong building is worse than no
              report.
            </p>
            <div className="space-y-1.5">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => check(query.trim(), c.id)}
                  className="w-full rounded-md border border-line px-3 py-2.5 text-left transition-colors hover:border-brand-line hover:bg-brand-soft"
                >
                  <span className="block text-[0.875rem] font-medium text-ink">{c.address}</span>
                  <span className="block text-[0.75rem] text-ink-faint">
                    {c.postcode} · {c.city}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* An empty canvas tells a new user nothing about what the tool is for. */}
        {!report && !candidates && !error && (
          <div className="no-print grid gap-3 sm:grid-cols-3">
            {EMPTY_STATE.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-lg border border-line bg-surface p-4">
                <Icon className="mb-2 h-5 w-5 text-brand" />
                <p className="text-[0.875rem] font-semibold leading-snug text-ink">{title}</p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-ink-subtle">{body}</p>
              </div>
            ))}
          </div>
        )}

        {report && (
          <article className="print-page rounded-lg border border-line bg-surface shadow-[var(--elev-2)]">
            <header className="border-b border-line px-6 py-5 md:px-8">
              <p className="eyebrow mb-1">HMO check</p>
              <h2 className="text-[1.375rem] font-bold leading-tight tracking-tight text-ink">
                {report.address}
              </h2>
              <p className="mt-0.5 text-[0.8125rem] text-ink-subtle">
                {[report.postcode, report.council].filter(Boolean).join(" · ")}
              </p>
            </header>

            {/* The one line someone reads if they read nothing else. */}
            <div className="print-keep border-b border-line bg-ink px-6 py-4 md:px-8">
              <p className="text-[0.9375rem] font-medium leading-relaxed text-white">
                {report.headline}
              </p>
            </div>

            <div className="px-6 py-5 md:px-8">
              {report.sections.map((section) => (
                <section key={section.title} className="print-keep mb-7 last:mb-0">
                  <h3 className="eyebrow mb-2.5 border-b border-line pb-1.5">{section.title}</h3>
                  {section.facts.length === 0 ? (
                    <p className="text-[0.8125rem] italic text-ink-faint">{section.emptyMessage}</p>
                  ) : (
                    <dl className="divide-y divide-line">
                      {section.facts.map((fact, i) => {
                        const style = CONFIDENCE_STYLE[fact.confidence]
                        return (
                          <div
                            key={i}
                            className="print-keep grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[1fr_auto]"
                          >
                            <div className="min-w-0">
                              <dt className="text-[0.75rem] font-medium uppercase tracking-wide text-ink-faint">
                                {fact.label}
                              </dt>
                              <dd className="mt-0.5 text-[0.9375rem] font-semibold leading-snug text-ink">
                                {fact.value}
                              </dd>
                              {fact.note && (
                                <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
                                  {fact.note}
                                </p>
                              )}
                              {fact.source && (
                                <p className="mt-1 text-[0.75rem] text-ink-faint">
                                  Source: {fact.source}
                                </p>
                              )}
                            </div>
                            {/* Standing gets its own column so a reader can scan
                                down it and see at a glance which lines they can
                                act on and which they must confirm. */}
                            <div className="sm:pt-4">
                              <span
                                className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[0.6875rem] font-semibold ${style.className}`}
                              >
                                <style.Icon className="h-3 w-3" />
                                {style.label}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </dl>
                  )}
                </section>
              ))}

              {/* Not an appendix. What the data cannot settle is the part that
                  decides whether someone needs to pick up the phone. */}
              <section className="print-keep mt-7 rounded-lg border border-line bg-surface-inset p-4">
                <h3 className="eyebrow mb-2.5">What this report cannot tell you</h3>
                <ul className="space-y-2">
                  {report.openQuestions.map((q, i) => (
                    <li key={i} className="flex gap-2 text-[0.8125rem] leading-relaxed text-ink-muted">
                      <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <footer className="mt-6 border-t border-line pt-4">
                <p className="text-[0.75rem] leading-relaxed text-ink-subtle">{report.disclaimer}</p>
                <p className="mt-2 text-[0.75rem] text-ink-faint">
                  Generated {new Date(report.generatedAt).toLocaleString("en-GB")} · HMO Hunter
                </p>
              </footer>
            </div>
          </article>
        )}
      </div>
    </AppShell>
  )
}
