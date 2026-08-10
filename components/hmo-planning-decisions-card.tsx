"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Gavel,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Users,
  Info,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import {
  describeApprovalRate,
  type ApprovalStats,
  type ApprovalBand,
} from "@/lib/planning/decision-stats"

interface DecisionRecord {
  id: string
  reference: string | null
  council_name: string | null
  description: string | null
  app_state: string | null
  decided_date: string | null
  address: string | null
  postcode: string | null
  kind: string
  adds_supply: boolean
  occupants: number | null
  council_url: string | null
  distanceKm?: number
}

interface DecisionsResponse {
  stats: ApprovalStats
  decisions?: DecisionRecord[]
  recentDecisions?: DecisionRecord[]
  caveats: string[]
  disclaimer: string
}

interface Props {
  latitude?: number | null
  longitude?: number | null
  councilSlug?: string | null
  radiusKm?: number
  className?: string
  defaultExpanded?: boolean
}

/** Colour by band. Never green for an unknown — absence is not approval. */
const BAND_STYLES: Record<ApprovalBand, { chip: string; header: string }> = {
  routinely_granted: { chip: "bg-emerald-100 text-emerald-800", header: "from-emerald-600 to-teal-600" },
  usually_granted: { chip: "bg-emerald-100 text-emerald-800", header: "from-emerald-600 to-teal-600" },
  mixed: { chip: "bg-amber-100 text-amber-800", header: "from-amber-600 to-orange-600" },
  often_refused: { chip: "bg-orange-100 text-orange-800", header: "from-orange-600 to-red-600" },
  rarely_granted: { chip: "bg-red-100 text-red-800", header: "from-red-600 to-rose-700" },
  unknown: { chip: "bg-slate-100 text-slate-700", header: "from-slate-600 to-slate-700" },
}

const KIND_LABELS: Record<string, string> = {
  new_small_hmo: "New small HMO (C4)",
  new_large_hmo: "New large HMO (sui generis)",
  hmo_intensification: "HMO expansion",
  reversion: "HMO converted back",
  existing_use_certificate: "Existing use certified",
  ancillary: "Conditions / amendment",
  not_hmo: "Not an HMO",
  unclear: "Unclassified",
}

function formatDate(value: string | null): string {
  if (!value) return "Date not recorded"
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

export function HmoPlanningDecisionsCard({
  latitude,
  longitude,
  councilSlug,
  radiusKm = 2,
  className,
  defaultExpanded = false,
}: Props) {
  const [data, setData] = useState<DecisionsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showAll, setShowAll] = useState(false)

  const hasPoint = typeof latitude === "number" && typeof longitude === "number"

  const fetchDecisions = useCallback(async () => {
    if (!hasPoint && !councilSlug) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (hasPoint) {
        params.set("lat", String(latitude))
        params.set("lng", String(longitude))
        params.set("radiusKm", String(radiusKm))
      } else if (councilSlug) {
        params.set("council", councilSlug)
      }

      const response = await fetch(`/api/planning/hmo-decisions?${params}`)
      if (!response.ok) throw new Error("Could not load planning decisions")
      setData(await response.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load planning decisions")
    } finally {
      setLoading(false)
    }
  }, [hasPoint, latitude, longitude, councilSlug, radiusKm])

  useEffect(() => {
    if (isExpanded && !data && !loading) fetchDecisions()
  }, [isExpanded, data, loading, fetchDecisions])

  if (!hasPoint && !councilSlug) return null

  const description = data ? describeApprovalRate(data.stats) : null
  const style = BAND_STYLES[description?.band ?? "unknown"]

  const records = data?.decisions ?? data?.recentDecisions ?? []
  const approvals = records.filter((r) => /^permitted$/i.test(r.app_state ?? "") && r.adds_supply)
  const visible = showAll ? approvals : approvals.slice(0, 5)

  return (
    <Card className={cn("overflow-hidden", className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger className="w-full">
          <div className={cn("flex items-center justify-between p-4 bg-gradient-to-r text-white", style.header)}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Gavel className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="font-bold">HMO Planning Decisions</h3>
                <p className="text-sm text-white/80">
                  {hasPoint ? `Within ${radiusKm}km` : "This council"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {description && (
                <div className="text-right mr-2">
                  <div className="text-lg font-bold">
                    {data!.stats.approvalRate === null
                      ? "—"
                      : `${Math.round(data!.stats.approvalRate * 100)}%`}
                  </div>
                  <div className="text-xs text-white/80">
                    {data!.stats.approvalRate === null ? "no decisions" : "approved"}
                  </div>
                </div>
              )}
              <div
                className={cn(
                  "p-1.5 rounded-full transition-transform",
                  isExpanded ? "bg-white/20 rotate-180" : "bg-white/10"
                )}
              >
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-4">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
                <span className="ml-2 text-slate-600">Loading decisions…</span>
              </div>
            )}

            {error && !loading && (
              <div className="text-center py-6 text-slate-500">
                <p>{error}</p>
                <Button variant="outline" size="sm" onClick={fetchDecisions} className="mt-2">
                  <RefreshCw className="w-4 h-4 mr-2" /> Retry
                </Button>
              </div>
            )}

            {data && !loading && description && (
              <>
                {/* Headline: what the record shows, counts first. */}
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", style.chip)}>
                      {description.label}
                    </span>
                    {data.stats.lowConfidence && data.stats.decided > 0 && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        Small sample
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700">{description.summary}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    Covers applications seeking to create or expand an HMO. Certificates of
                    existing use, conversions back to housing and condition discharges are
                    excluded.
                  </p>
                </div>

                {/* Counts */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center gap-1.5 text-emerald-700 mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-xs font-medium">Approved</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">{data.stats.permitted}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                    <div className="flex items-center gap-1.5 text-red-700 mb-1">
                      <XCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">Refused</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">{data.stats.rejected}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-slate-600 mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-xs font-medium">Typical size</span>
                    </div>
                    <div className="text-xl font-bold text-slate-900">
                      {data.stats.medianOccupants ?? "—"}
                      {data.stats.medianOccupants ? (
                        <span className="text-xs font-normal text-slate-500 ml-1">beds</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Recent approvals — the precedent an investor is looking for. */}
                {approvals.length > 0 ? (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">
                      Recently approved ({approvals.length})
                    </h4>
                    <ul className="space-y-2">
                      {visible.map((record) => (
                        <li
                          key={record.id}
                          className="rounded-lg border border-slate-200 p-3 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">
                                {record.address ?? record.postcode ?? "Address not recorded"}
                              </p>
                              <p className="text-xs text-slate-600 mt-0.5 line-clamp-2">
                                {record.description ?? "No description"}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
                                <span>{KIND_LABELS[record.kind] ?? record.kind}</span>
                                {record.occupants ? <span>{record.occupants} beds</span> : null}
                                <span>{formatDate(record.decided_date)}</span>
                                {typeof record.distanceKm === "number" && (
                                  <span>{record.distanceKm.toFixed(1)} km away</span>
                                )}
                              </div>
                            </div>
                            {record.council_url && (
                              <a
                                href={record.council_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 text-slate-400 hover:text-slate-700"
                                aria-label="View on the council's planning portal"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {approvals.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => setShowAll((v) => !v)}
                      >
                        {showAll ? "Show fewer" : `Show all ${approvals.length}`}
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">
                    No approved HMO applications on record{hasPoint ? ` within ${radiusKm}km` : ""}.
                    That may mean none were made, or that this council&rsquo;s decisions are not yet
                    captured — it is not evidence that permission would be refused.
                  </p>
                )}

                {/* Caveats returned by the API, then the standing disclaimer. */}
                {data.caveats.length > 0 && (
                  <ul className="space-y-1.5">
                    {data.caveats.map((caveat) => (
                      <li key={caveat} className="flex items-start gap-2 text-xs text-slate-600">
                        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
                        <span>{caveat}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-[11px] leading-snug text-slate-500 border-t border-slate-100 pt-3">
                  {data.disclaimer}
                </p>
              </>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
