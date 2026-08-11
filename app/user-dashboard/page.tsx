"use client"

/**
 * The landing page after sign-in: what needs attention today.
 *
 * It deliberately does not repeat the map. Four counts that read the same every
 * morning teach a returning user nothing, and the map already shows what exists.
 * What this can show and nothing else can is change with a date on it, and stock
 * that is running out.
 *
 * Ordering is by urgency, not by category: a restriction commencing in five days
 * sits above a licence expiring in ninety, which sits above a coverage gap that
 * has been true for months.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarClock, KeyRound, AlertTriangle, Search, FileText, MapIcon, ArrowRight } from "lucide-react"
import type { AttentionBoard } from "@/lib/dashboard/attention"

export default function UserDashboardPage() {
  const router = useRouter()
  const [board, setBoard] = useState<AttentionBoard | null>(null)
  const [servedTotal, setServedTotal] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.board) {
          setBoard(d.board)
          setServedTotal(d.servedTotal ?? 0)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">What needs attention</h1>
            <p className="text-sm text-slate-500">
              {servedTotal > 0
                ? `${servedTotal.toLocaleString()} properties tracked`
                : "Your sourcing overview"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/hmo-check")}>
              <FileText className="w-4 h-4 mr-2" />
              Check an address
            </Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => router.push("/map")}>
              <MapIcon className="w-4 h-4 mr-2" />
              Map
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {loading && <p className="text-sm text-slate-500">Loading…</p>}

        {board && (
          <>
            {/* Dated changes first. These arrive whether or not anyone looks,
                and they are the thing a portal cannot tell you. */}
            {board.datedChanges.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 mb-3">
                  <CalendarClock className="w-4 h-4" />
                  Coming up
                </h2>
                <div className="space-y-3">
                  {board.datedChanges.map((change, i) => (
                    <Card
                      key={i}
                      className={`p-4 ${change.daysAway <= 14 ? "border-amber-300 bg-amber-50" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{change.headline}</p>
                          <p className="text-sm text-slate-600 mt-0.5">{change.detail}</p>
                          {change.sourceUrl && (
                            <a
                              href={change.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-teal-700 hover:underline mt-1 inline-block"
                            >
                              Council source
                            </a>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold text-slate-900">{change.daysAway}</p>
                          <p className="text-xs text-slate-500">{change.daysAway === 1 ? "day" : "days"}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{change.date}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Named addresses, not a count. Thirteen properties with days left
                is actionable; "13" is a number to look at. */}
            {board.expiringSoon.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 mb-1">
                  <KeyRound className="w-4 h-4" />
                  Licences running out
                </h2>
                <p className="text-sm text-slate-500 mb-3">
                  A renewal deadline is the owner&rsquo;s deadline too.
                </p>
                <Card className="divide-y divide-slate-100">
                  {board.expiringSoon.map((licence) => (
                    <button
                      key={licence.id}
                      onClick={() => router.push(`/hmo-check?address=${encodeURIComponent(licence.address)}`)}
                      className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900 truncate">{licence.address}</span>
                        <span className="block text-xs text-slate-500">
                          {[licence.postcode, licence.council].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={`block text-sm font-bold ${
                            licence.daysRemaining <= 90 ? "text-amber-700" : "text-slate-700"
                          }`}
                        >
                          {licence.daysRemaining} days
                        </span>
                        <span className="block text-xs text-slate-400">{licence.expiry}</span>
                      </span>
                    </button>
                  ))}
                </Card>
              </section>
            )}

            {board.expired.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Licences already expired
                </h2>
                <p className="text-sm text-slate-500 mb-3">
                  An operating HMO without a current licence is a problem the owner may not know they have.
                </p>
                <Card className="divide-y divide-slate-100">
                  {board.expired.slice(0, 10).map((licence) => (
                    <button
                      key={licence.id}
                      onClick={() => router.push(`/hmo-check?address=${encodeURIComponent(licence.address)}`)}
                      className="w-full text-left p-3 hover:bg-slate-50 flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="block font-medium text-slate-900 truncate">{licence.address}</span>
                        <span className="block text-xs text-slate-500">
                          {[licence.postcode, licence.council].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold text-red-600">
                          {Math.abs(licence.daysRemaining)} days ago
                        </span>
                        <span className="block text-xs text-slate-400">{licence.expiry}</span>
                      </span>
                    </button>
                  ))}
                </Card>
              </section>
            )}

            {/* Shown to users, not hidden. Someone deciding how much weight to
                put on a report deserves to know how much of the estate is
                unverified — concealing it would make the product look more
                certain than it is. */}
            {board.coverage.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-500 mb-1">
                  <Search className="w-4 h-4" />
                  What we have not verified
                </h2>
                <p className="text-sm text-slate-500 mb-3">
                  Gaps in our coverage, so you know how far to trust a report.
                </p>
                <Card className="p-4 space-y-3">
                  {board.coverage.map((gap, i) => {
                    const pct = gap.total > 0 ? Math.round((gap.count / gap.total) * 100) : 0
                    return (
                      <div key={i}>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm font-medium text-slate-800">{gap.label}</span>
                          <span className="text-sm text-slate-500 shrink-0">
                            {gap.count.toLocaleString()} of {gap.total.toLocaleString()} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-slate-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{gap.note}</p>
                      </div>
                    )
                  })}
                </Card>
              </section>
            )}

            {board.datedChanges.length === 0 &&
              board.expiringSoon.length === 0 &&
              board.expired.length === 0 && (
                <Card className="p-8 text-center">
                  <p className="font-medium text-slate-900">Nothing needs attention today</p>
                  <p className="text-sm text-slate-600 mt-1">
                    No restrictions commencing and no licences running out in the next eight months.
                  </p>
                  <Button className="mt-4 bg-teal-600 hover:bg-teal-700" onClick={() => router.push("/map")}>
                    Browse properties <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Card>
              )}
          </>
        )}
      </main>
    </div>
  )
}
