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
 *
 * Visually the page is built around the dates. A day count is the one number on
 * screen that decides whether to act today, so it gets its own column, tabular
 * figures and the largest type here — and everything else is deliberately
 * quieter than it.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppShell, ShellButton } from "@/components/app-shell"
import {
  CalendarClock,
  KeyRound,
  AlertTriangle,
  Search,
  FileText,
  MapIcon,
  ArrowRight,
  ChevronRight,
} from "lucide-react"
import type { AttentionBoard } from "@/lib/dashboard/attention"

/** A section heading with its note, so the page scans in one pass. */
function SectionHead({
  icon: Icon,
  title,
  note,
}: {
  icon: typeof CalendarClock
  title: string
  note?: string
}) {
  return (
    <div className="mb-3">
      <h2 className="flex items-center gap-2 text-[0.9375rem] font-bold tracking-tight text-ink">
        <Icon className="h-4 w-4 text-ink-faint" />
        {title}
      </h2>
      {note && <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-ink-subtle">{note}</p>}
    </div>
  )
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-line bg-surface shadow-[var(--elev-1)] ${className}`}>
      {children}
    </div>
  )
}

function LicenceRow({
  licence,
  tone,
  onOpen,
}: {
  licence: AttentionBoard["expiringSoon"][number]
  tone: "soon" | "expired"
  onOpen: () => void
}) {
  const days = Math.abs(licence.daysRemaining)
  const urgent = licence.daysRemaining <= 90
  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-inset"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.875rem] font-medium text-ink">{licence.address}</span>
        <span className="block truncate text-[0.75rem] text-ink-faint">
          {[licence.postcode, licence.council].filter(Boolean).join(" · ") || "No council recorded"}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span
          className={`tnum block text-[0.875rem] font-semibold ${
            tone === "expired" ? "text-danger" : urgent ? "text-warn" : "text-ink-muted"
          }`}
        >
          {tone === "expired" ? `${days} days ago` : `${days} days`}
        </span>
        <span className="tnum block text-[0.75rem] text-ink-faint">{licence.expiry}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

export default function UserDashboardPage() {
  const router = useRouter()
  const [board, setBoard] = useState<AttentionBoard | null>(null)
  const [servedTotal, setServedTotal] = useState<number>(0)
  const [totals, setTotals] = useState<{ expiring: number; expired: number }>({ expiring: 0, expired: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (d.board) {
          setBoard(d.board)
          setServedTotal(d.servedTotal ?? 0)
          setTotals({ expiring: d.expiringTotal ?? 0, expired: d.expiredTotal ?? 0 })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const check = (address: string) => router.push(`/hmo-check?address=${encodeURIComponent(address)}`)

  return (
    <AppShell
      title="What needs attention"
      subtitle={servedTotal > 0 ? `${servedTotal.toLocaleString()} properties tracked` : undefined}
      counts={{ expired: totals.expired }}
      actions={
        <>
          <ShellButton href="/hmo-check">
            <FileText className="h-4 w-4" />
            Check an address
          </ShellButton>
          <ShellButton href="/map" variant="primary">
            <MapIcon className="h-4 w-4" />
            Map
          </ShellButton>
        </>
      }
    >
      <div className="mx-auto max-w-6xl space-y-8">
        {loading && (
          <div className="space-y-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[4.5rem] animate-pulse rounded-lg border border-line bg-surface" />
            ))}
          </div>
        )}

        {board && (
          <>
            {/* Dated changes first. These arrive whether or not anyone looks,
                and they are the thing a portal cannot tell you. */}
            {board.datedChanges.length > 0 && (
              <section>
                <SectionHead
                  icon={CalendarClock}
                  title="Coming up"
                  note="Restrictions with a date on them. Each changes the answer for every property in its area on the day it lands."
                />
                <div className="space-y-2">
                  {board.datedChanges.map((change, i) => {
                    const imminent = change.daysAway <= 14
                    return (
                      <Panel key={i} className={imminent ? "border-warn-line bg-warn-soft" : ""}>
                        <div className="flex items-stretch">
                          {/* The count is the decision, so it gets a column of
                              its own and the largest type on the page. */}
                          <div
                            className={`flex w-[5.5rem] shrink-0 flex-col items-center justify-center border-r px-2 py-4 ${
                              imminent ? "border-warn-line" : "border-line"
                            }`}
                          >
                            <span
                              className={`tnum text-[1.75rem] font-bold leading-none tracking-tight ${
                                imminent ? "text-warn" : "text-brand"
                              }`}
                            >
                              {change.daysAway}
                            </span>
                            <span className="mt-1 text-[0.6875rem] font-medium uppercase tracking-wide text-ink-faint">
                              {change.daysAway === 1 ? "day" : "days"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 px-4 py-3">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="text-[0.9375rem] font-semibold leading-snug text-ink">
                                {change.headline}
                              </p>
                              <span className="tnum shrink-0 text-[0.75rem] text-ink-faint">
                                {change.date}
                              </span>
                            </div>
                            <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-muted">
                              {change.detail}
                            </p>
                            {change.sourceUrl && (
                              <a
                                href={change.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="mt-1.5 inline-flex items-center gap-1 text-[0.75rem] font-medium text-brand hover:underline"
                              >
                                Council source
                                <ArrowRight className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </Panel>
                    )
                  })}
                </div>
              </section>
            )}

            <div className="grid gap-8 lg:grid-cols-2">
              {/* Named addresses, not a count. Thirteen properties with days
                  left is actionable; "13" is a number to look at. */}
              {board.expiringSoon.length > 0 && (
                <section>
                  <SectionHead
                    icon={KeyRound}
                    title="Licences running out"
                    note={`A renewal deadline is the owner's deadline too.${
                      totals.expiring > board.expiringSoon.length
                        ? ` Showing the ${board.expiringSoon.length} soonest of ${totals.expiring}.`
                        : ""
                    }`}
                  />
                  <Panel className="divide-y divide-line overflow-hidden">
                    {board.expiringSoon.map((licence) => (
                      <LicenceRow
                        key={licence.id}
                        licence={licence}
                        tone="soon"
                        onOpen={() => check(licence.address)}
                      />
                    ))}
                  </Panel>
                </section>
              )}

              {board.expired.length > 0 && (
                <section>
                  <SectionHead
                    icon={AlertTriangle}
                    title="Licence terms that have run out"
                    note={`The term we hold has ended. The register has not said these licences expired — 83 of the 98 the platform used to call expired were still marked active at source — so confirm with the council before acting on it.${
                      totals.expired > Math.min(board.expired.length, 10)
                        ? ` Showing the ${Math.min(board.expired.length, 10)} most recent of ${totals.expired}.`
                        : ""
                    }`}
                  />
                  <Panel className="divide-y divide-line overflow-hidden">
                    {board.expired.slice(0, 10).map((licence) => (
                      <LicenceRow
                        key={licence.id}
                        licence={licence}
                        tone="expired"
                        onOpen={() => check(licence.address)}
                      />
                    ))}
                  </Panel>
                </section>
              )}
            </div>

            {/* Shown to users, not hidden. Someone deciding how much weight to
                put on a report deserves to know how much of the estate is
                unverified — concealing it would make the product look more
                certain than it is. */}
            {board.coverage.length > 0 && (
              <section>
                <SectionHead
                  icon={Search}
                  title="What we have not verified"
                  note="Gaps in our coverage, so you know how far to trust a report."
                />
                <Panel className="divide-y divide-line">
                  {board.coverage.map((gap, i) => {
                    const pct = gap.total > 0 ? Math.round((gap.count / gap.total) * 100) : 0
                    return (
                      <div key={i} className="px-4 py-3.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-[0.875rem] font-medium text-ink">{gap.label}</span>
                          <span className="tnum shrink-0 text-[0.8125rem] text-ink-subtle">
                            {gap.count.toLocaleString()}
                            <span className="text-ink-faint"> of {gap.total.toLocaleString()}</span>
                            <span className="ml-2 font-semibold text-ink-muted">{pct}%</span>
                          </span>
                        </div>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-sunken">
                          <div
                            className="h-full rounded-full bg-ink-faint transition-[width] duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[0.75rem] leading-relaxed text-ink-subtle">{gap.note}</p>
                      </div>
                    )
                  })}
                </Panel>
              </section>
            )}

            {board.datedChanges.length === 0 &&
              board.expiringSoon.length === 0 &&
              board.expired.length === 0 && (
                <Panel className="px-6 py-12 text-center">
                  <p className="text-[0.9375rem] font-semibold text-ink">Nothing needs attention today</p>
                  <p className="mx-auto mt-1 max-w-md text-[0.8125rem] leading-relaxed text-ink-subtle">
                    No restrictions commencing and no licences running out in the next eight months.
                  </p>
                  <div className="mt-5 flex justify-center">
                    <ShellButton href="/map" variant="primary">
                      Browse properties
                      <ArrowRight className="h-4 w-4" />
                    </ShellButton>
                  </div>
                </Panel>
              )}
          </>
        )}
      </div>
    </AppShell>
  )
}
