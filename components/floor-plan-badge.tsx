"use client"

import { LayoutGrid, ImageOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FloorPlanBadgeProps {
  /** Whether the listing has floor plan images */
  hasFloorPlanImages?: boolean
  /** Number of floor plan images */
  floorPlanCount?: number
  className?: string
  showTooltip?: boolean
  variant?: "compact" | "full"
}

export function FloorPlanBadge({
  hasFloorPlanImages = false,
  floorPlanCount = 0,
  className = "",
  showTooltip = true,
  variant = "compact",
}: FloorPlanBadgeProps) {
  if (!hasFloorPlanImages) {
    if (variant === "full") {
      return (
        <div className={`flex items-center gap-1.5 text-slate-400 ${className}`}>
          <ImageOff className="w-3.5 h-3.5" />
          <span className="text-xs">No floor plan</span>
        </div>
      )
    }
    return null
  }

  const badge = (
    <Badge
      className={`bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200 ${className}`}
    >
      <LayoutGrid className="w-3 h-3 mr-1" />
      {variant === "compact"
        ? "Floor Plan"
        : `${floorPlanCount} Floor Plan${floorPlanCount > 1 ? "s" : ""}`
      }
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
          <div className="text-sm">
            <p className="font-medium text-emerald-700">Floor Plan Images</p>
            <p className="text-slate-600 text-xs mt-1">
              {floorPlanCount > 1
                ? `${floorPlanCount} floor plan images from the listing`
                : "Floor plan image from the listing"
              }
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
