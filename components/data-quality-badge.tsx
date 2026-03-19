"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  calculateDataQuality,
  getQualityLabel,
  FRESHNESS_RULES,
  type DataQualityScore,
  type FreshnessStatus,
} from "@/lib/data-quality"
import { ShieldCheck, AlertTriangle, Info } from "lucide-react"
import type { Property } from "@/lib/types/database"

interface DataQualityBadgeProps {
  property: Property
  showDetail?: boolean
  className?: string
}

const STATUS_DOT: Record<FreshnessStatus, string> = {
  live: "bg-emerald-500",
  fresh: "bg-green-400",
  aging: "bg-amber-400",
  stale: "bg-orange-500",
  expired: "bg-red-500",
}

export function DataQualityBadge({ property, showDetail = false, className = "" }: DataQualityBadgeProps) {
  const quality = useMemo(
    () => calculateDataQuality(property as unknown as Record<string, unknown>),
    [property]
  )

  const label = getQualityLabel(quality.overall)

  if (!showDetail) {
    // Compact badge
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`${label.bgColor} ${label.color} ${label.borderColor} gap-1 cursor-help ${className}`}
            >
              {quality.overall >= 75 ? (
                <ShieldCheck className="h-3 w-3" />
              ) : quality.overall >= 50 ? (
                <Info className="h-3 w-3" />
              ) : (
                <AlertTriangle className="h-3 w-3" />
              )}
              {label.label} {quality.grade}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px]">
            <div className="space-y-2">
              <p className="font-medium text-sm">Data Quality: {quality.overall}/100</p>
              <p className="text-xs text-slate-500">{label.description}</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-slate-400">Freshness</p>
                  <p className="font-medium">{quality.freshness.score}%</p>
                </div>
                <div>
                  <p className="text-slate-400">Complete</p>
                  <p className="font-medium">{quality.completeness.score}%</p>
                </div>
                <div>
                  <p className="text-slate-400">Confidence</p>
                  <p className="font-medium">{quality.confidence.score}%</p>
                </div>
              </div>
              {quality.actionRequired.length > 0 && (
                <div className="pt-1 border-t">
                  <p className="text-[10px] text-amber-600">
                    {quality.actionRequired.length} action{quality.actionRequired.length > 1 ? "s" : ""} needed
                  </p>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Detailed view
  return (
    <div className={`rounded-lg border p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${label.bgColor} flex items-center justify-center`}>
            {quality.overall >= 75 ? (
              <ShieldCheck className={`h-4 w-4 ${label.color}`} />
            ) : (
              <AlertTriangle className={`h-4 w-4 ${label.color}`} />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{label.label}</p>
            <p className="text-xs text-slate-500">{label.description}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{quality.overall}</p>
          <p className="text-[10px] text-slate-400">/ 100</p>
        </div>
      </div>

      {/* Score bars */}
      <div className="space-y-2">
        <ScoreBar label="Freshness" score={quality.freshness.score} detail={`${quality.freshness.liveCount} live sources`} />
        <ScoreBar label="Completeness" score={quality.completeness.score} detail={`${quality.completeness.filledFields}/${quality.completeness.totalFields} fields`} />
        <ScoreBar label="Confidence" score={quality.confidence.score} detail={`${quality.confidence.crossValidated} cross-validated`} />
      </div>

      {/* Source freshness dots */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Source Freshness</p>
        <div className="flex flex-wrap gap-1.5">
          {quality.freshness.sources.map(s => (
            <TooltipProvider key={s.source}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-50 border text-[10px]">
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status]}`} />
                    {FRESHNESS_RULES[s.source].label}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {s.status === "expired" && !s.enrichedAt ? "Never enriched" :
                     s.daysSince === 0 ? "Updated today" :
                     `${s.daysSince} days ago`}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>
      </div>

      {/* Actions */}
      {quality.actionRequired.length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs font-medium text-amber-600 mb-1">Actions needed</p>
          <ul className="space-y-0.5">
            {quality.actionRequired.slice(0, 3).map((action, i) => (
              <li key={i} className="text-[11px] text-slate-600 flex items-start gap-1">
                <span className="text-amber-500 mt-0.5">&#x2022;</span>
                {action}
              </li>
            ))}
            {quality.actionRequired.length > 3 && (
              <li className="text-[10px] text-slate-400">
                +{quality.actionRequired.length - 3} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Confidence flags */}
      {quality.confidence.flags.length > 0 && (
        <div className="pt-2 border-t">
          <p className="text-xs font-medium text-red-600 mb-1">Data warnings</p>
          {quality.confidence.flags.map((flag, i) => (
            <p key={i} className="text-[11px] text-slate-600">{flag}</p>
          ))}
        </div>
      )}
    </div>
  )
}

function ScoreBar({ label, score, detail }: { label: string; score: number; detail: string }) {
  const barColor = score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-red-500"

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-400">{detail}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
    </div>
  )
}
