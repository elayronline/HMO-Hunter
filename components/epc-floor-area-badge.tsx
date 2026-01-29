"use client"

import { Square, Ruler, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface EpcFloorAreaBadgeProps {
  floorAreaSqm: number | null | undefined
  floorAreaBand?: "under_90" | "90_120" | "120_plus" | null
  bedrooms?: number
  className?: string
  showTooltip?: boolean
  variant?: "badge" | "compact" | "full"
}

// Average floor area per bedroom for HMO suitability
const HMO_IDEAL_SQM_PER_BEDROOM = 25 // ~25 sqm per bedroom is a good baseline

export function EpcFloorAreaBadge({
  floorAreaSqm,
  floorAreaBand,
  bedrooms,
  className = "",
  showTooltip = true,
  variant = "badge",
}: EpcFloorAreaBadgeProps) {
  if (!floorAreaSqm && !floorAreaBand) {
    if (variant === "full") {
      return (
        <div className={cn("flex items-center gap-1.5 text-slate-400", className)}>
          <Square className="w-3.5 h-3.5" />
          <span className="text-xs">Floor area unknown</span>
        </div>
      )
    }
    return null
  }

  // Determine if floor area is good for HMO
  const getHmoSuitability = () => {
    if (!floorAreaSqm || !bedrooms) return null
    const idealArea = bedrooms * HMO_IDEAL_SQM_PER_BEDROOM
    const ratio = floorAreaSqm / idealArea

    if (ratio >= 1.2) return { status: "excellent", label: "Spacious for HMO", icon: TrendingUp, color: "emerald" }
    if (ratio >= 0.9) return { status: "good", label: "Good size for HMO", icon: Minus, color: "teal" }
    if (ratio >= 0.7) return { status: "tight", label: "Tight for HMO", icon: TrendingDown, color: "amber" }
    return { status: "small", label: "Small for HMO", icon: TrendingDown, color: "red" }
  }

  const suitability = getHmoSuitability()

  // Format floor area
  const formatArea = (sqm: number) => {
    const sqft = Math.round(sqm * 10.764)
    return { sqm: Math.round(sqm), sqft }
  }

  const formattedArea = floorAreaSqm ? formatArea(floorAreaSqm) : null

  // Get band label
  const getBandLabel = () => {
    switch (floorAreaBand) {
      case "under_90": return "Under 90m²"
      case "90_120": return "90-120m²"
      case "120_plus": return "120m²+"
      default: return null
    }
  }

  const bandLabel = getBandLabel()

  // Badge color based on floor area band
  const getBadgeColors = () => {
    if (suitability) {
      switch (suitability.color) {
        case "emerald": return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
        case "teal": return "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
        case "amber": return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
        case "red": return "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
      }
    }
    switch (floorAreaBand) {
      case "120_plus": return "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
      case "90_120": return "bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100"
      case "under_90": return "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
      default: return "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
    }
  }

  // Compact variant - just the number
  if (variant === "compact") {
    return (
      <span className={cn("text-sm font-medium text-slate-700", className)}>
        {formattedArea ? `${formattedArea.sqm}m²` : bandLabel}
      </span>
    )
  }

  // Full variant - detailed display
  if (variant === "full") {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-slate-100 rounded-lg">
              <Ruler className="w-4 h-4 text-slate-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">EPC Floor Area</span>
          </div>
          {formattedArea && (
            <div className="text-right">
              <span className="text-lg font-bold text-slate-900">{formattedArea.sqm}m²</span>
              <span className="text-xs text-slate-500 ml-1.5">({formattedArea.sqft} sq ft)</span>
            </div>
          )}
        </div>

        {suitability && (
          <div className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border",
            suitability.color === "emerald" ? "bg-emerald-50 border-emerald-200" :
            suitability.color === "teal" ? "bg-teal-50 border-teal-200" :
            suitability.color === "amber" ? "bg-amber-50 border-amber-200" :
            "bg-red-50 border-red-200"
          )}>
            <suitability.icon className={cn(
              "w-4 h-4",
              suitability.color === "emerald" ? "text-emerald-600" :
              suitability.color === "teal" ? "text-teal-600" :
              suitability.color === "amber" ? "text-amber-600" :
              "text-red-600"
            )} />
            <span className={cn(
              "text-sm font-medium",
              suitability.color === "emerald" ? "text-emerald-700" :
              suitability.color === "teal" ? "text-teal-700" :
              suitability.color === "amber" ? "text-amber-700" :
              "text-red-700"
            )}>
              {suitability.label}
            </span>
            {bedrooms && (
              <span className="text-xs text-slate-500 ml-auto">
                ~{Math.round((floorAreaSqm || 0) / bedrooms)}m² per room
              </span>
            )}
          </div>
        )}

        {!formattedArea && bandLabel && (
          <div className="text-sm text-slate-600">
            Estimated: {bandLabel}
          </div>
        )}
      </div>
    )
  }

  // Default badge variant
  const badge = (
    <Badge className={cn("border", getBadgeColors(), className)}>
      <Square className="w-3 h-3 mr-1" />
      {formattedArea ? `${formattedArea.sqm}m²` : bandLabel}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm space-y-1">
            <p className="font-medium">EPC Floor Area</p>
            {formattedArea && (
              <p className="text-slate-600">
                {formattedArea.sqm}m² ({formattedArea.sqft} sq ft)
              </p>
            )}
            {suitability && (
              <p className={cn(
                "text-xs",
                suitability.color === "emerald" ? "text-emerald-600" :
                suitability.color === "teal" ? "text-teal-600" :
                suitability.color === "amber" ? "text-amber-600" :
                "text-red-600"
              )}>
                {suitability.label}
              </p>
            )}
            <p className="text-xs text-slate-500">
              Total internal floor area from Energy Performance Certificate
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
