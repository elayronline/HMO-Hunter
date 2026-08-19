"use client"

/**
 * The landing page after sign-in, and deliberately two things only.
 *
 * What has changed on the listings you saved, and which Article 4 directions
 * arrive in the next six months. Both are change with a date on it, which is
 * the one thing this page can tell you that the property list cannot.
 *
 * What used to be here and is not any more: licence lists across the whole
 * estate, and four coverage counts. Those describe the dataset rather than the
 * reader's own work, and they read the same every morning.
 *
 * The day count is the number that decides whether to act today, so it gets its
 * own column, tabular figures, and the largest type on the row. Everything else
 * is quieter than it on purpose.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppShell, ShellButton } from "@/components/app-shell"
import {
  CalendarClock,
  BellRing,
  AlertTriangle,
  FileText,
  MapIcon,
  Bookmark,
  ArrowRight,
  ChevronRight,
} from "lucide-react"
import type { SavedAlert } from "@/lib/dashboard/saved-alerts"

/** How many alerts sit on the page before the rest are behind a link. */
const SHOWN = 3

interface DashboardPayload {
  savedCount: number
  alerts: SavedAlert[]
  upcomingDirections: { council: string; date: string; daysAway: number; extent: string | null }[]
  horizonDays: number
}

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

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-[var(--elev-1)]">
      {children}
    </div>
  )
}

/**
 * The day column.
 *
 * Past and future are said in words rather than left to a minus sign, because
 * "-412" and "412" are one character apart and mean opposite things.
 */
function DayCount({ daysAway }: { daysAway: number }) {
  const past = daysAway < 0
  const magnitude = Math.abs(daysAway)
  return (
    <div className="w-16 shrink-0 text-right">
      <div
        className={`font-mono text-xl font-bold tabular-nums leading-none ${
          past ? "text-danger" : magnitude <= 30 ? "text-warn" : "text-ink"
        }`}
      >
        {magnitude}
      </div>
      <div className="mt-0.5 text-[0.6875rem] uppercase tracking-wide text-ink-faint">
        {magnitude === 1 ? (past ? "day ago" : "day") : past ? "days ago" : "days"}
      </div>
    </div>
  )
}

const KIND_TONE: Record<SavedAlert["kind"], string> = {
  article4_commencing: "text-danger",
  licence_recorded_expired: "text-danger",
  licence_term_ended: "text-warn",
  licence_expiring: "text-warn",
}

function AlertRow({ alert, onOpen }: { alert: SavedAlert; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-4 border-b border-line px-4 py-3.5 text-left transition-colors last:border-b-0 hover:bg-surface-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
    >
      <DayCount daysAway={alert.daysAway} />
      <div className="min-w-0 flex-1">
        <div className={`text-[0.8125rem] font-semibold ${KIND_TONE[alert.kind]}`}>
          {alert.headline}
        </div>
        <div className="mt-0.5 truncate text-sm font-medium text-ink">
          {alert.address}
          {alert.postcode ? <span className="text-ink-subtle"> · {alert.postcode}</span> : null}
        </div>
        <p className="mt-1 line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-subtle">
          {alert.detail}
        </p>
      </div>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint" />
    </button>
  )
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof CalendarClock
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="px-4 py-10 text-center">
      <Icon className="mx-auto h-5 w-5 text-ink-faint" />
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-[46ch] text-[0.8125rem] leading-relaxed text-ink-subtle">
        {body}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export default function UserDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.alerts)) setData(d as DashboardPayload)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const alerts = data?.alerts ?? []
  const shown = alerts.slice(0, SHOWN)
  const remaining = alerts.length - shown.length
  const months = Math.round((data?.horizonDays ?? 183) / 30)

  return (
    <AppShell
      title="Dashboard"
      subtitle={
        data
          ? data.savedCount === 0
            ? "Nothing saved yet"
            : `${data.savedCount} saved ${data.savedCount === 1 ? "listing" : "listings"}`
          : undefined
      }
      actions={
        <>
          <ShellButton href="/hmo-check">
            <FileText className="h-4 w-4" />
            Check an address
          </ShellButton>
          <ShellButton href="/map" variant="primary">
            <MapIcon className="h-4 w-4" />
            Properties
          </ShellButton>
        </>
      }
    >
      <div className="mx-auto max-w-4xl space-y-8">
        {loading && (
          <div className="space-y-2" aria-busy>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[4.5rem] animate-pulse rounded-lg border border-line bg-surface"
              />
            ))}
          </div>
        )}

        {!loading && data && (
          <>
            {/* Your listings first: this is the only part of the page that is
                about the reader's own work rather than the country's. */}
            <section>
              <SectionHead
                icon={BellRing}
                title="Your saved listings"
                note={
                  alerts.length > 0
                    ? `${alerts.length} ${alerts.length === 1 ? "alert" : "alerts"} — most pressing first.`
                    : undefined
                }
              />
              <Panel>
                {shown.length > 0 ? (
                  <>
                    {shown.map((alert) => (
                      <AlertRow
                        key={`${alert.propertyId}-${alert.kind}`}
                        alert={alert}
                        onOpen={() => router.push(`/property/${alert.propertyId}`)}
                      />
                    ))}
                    {remaining > 0 && (
                      <button
                        type="button"
                        onClick={() => router.push("/saved")}
                        className="flex w-full items-center justify-center gap-1.5 bg-surface-alt px-4 py-3 text-[0.8125rem] font-semibold text-brand transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                      >
                        See {remaining} more {remaining === 1 ? "alert" : "alerts"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                ) : data.savedCount === 0 ? (
                  <EmptyState
                    icon={Bookmark}
                    title="Nothing saved yet"
                    body="Save a listing and anything that lands on it — a licence running out, an Article 4 direction arriving — shows up here."
                    action={
                      <ShellButton href="/map" variant="primary">
                        <MapIcon className="h-4 w-4" />
                        Find properties
                      </ShellButton>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={BellRing}
                    title="Nothing needs attention"
                    body={`None of your ${data.savedCount} saved ${
                      data.savedCount === 1 ? "listing has" : "listings have"
                    } a licence running out or a restriction arriving in the next ${months} months.`}
                  />
                )}
              </Panel>
            </section>

            {/* Restrictions arriving, whether or not they touch anything saved.
                These land on their date regardless of who is watching. */}
            <section>
              <SectionHead
                icon={CalendarClock}
                title={`Article 4 directions arriving in the next ${months} months`}
                note="A direction starts binding on its date. Where a council has published one, it is recorded here from the council's own notice."
              />
              <Panel>
                {data.upcomingDirections.length > 0 ? (
                  data.upcomingDirections.map((direction) => (
                    <div
                      key={`${direction.council}-${direction.date}`}
                      className="flex items-start gap-4 border-b border-line px-4 py-3.5 last:border-b-0"
                    >
                      <DayCount daysAway={direction.daysAway} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink">{direction.council}</div>
                        <p className="mt-1 text-[0.8125rem] leading-relaxed text-ink-subtle">
                          {direction.extent ??
                            "A new HMO Article 4 direction takes effect on this date."}
                        </p>
                        <div className="mt-1 font-mono text-[0.6875rem] uppercase tracking-wide text-ink-faint">
                          {direction.date}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon={AlertTriangle}
                    title="None recorded"
                    body={`No council we hold a direction for has one commencing in the next ${months} months. That is what we hold, not a guarantee that none exists.`}
                  />
                )}
              </Panel>
            </section>
          </>
        )}

        {!loading && !data && (
          <Panel>
            <EmptyState
              icon={AlertTriangle}
              title="Could not load your dashboard"
              body="Sign in and reload, or try again in a moment."
            />
          </Panel>
        )}
      </div>
    </AppShell>
  )
}
