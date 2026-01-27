"use client"

import { FileText, ExternalLink, ImageOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface FloorPlanBadgeProps {
  hasFloorPlanImages?: boolean
  hasEpcFloorPlan?: boolean
  epcCertificateUrl?: string | null
  className?: string
  showTooltip?: boolean
  variant?: "compact" | "full"
}

export function FloorPlanBadge({
  hasFloorPlanImages = false,
  hasEpcFloorPlan = false,
  epcCertificateUrl,
  className = "",
  showTooltip = true,
  variant = "compact",
}: FloorPlanBadgeProps) {
  const hasAnyFloorPlan = hasFloorPlanImages || hasEpcFloorPlan

  if (!hasAnyFloorPlan) {
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
      className={`
        ${hasFloorPlanImages
          ? "bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-200"
          : "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200"
        }
        ${className}
      `}
    >
      <FileText className="w-3 h-3 mr-1" />
      {variant === "compact" ? "Floor Plan" : (
        hasFloorPlanImages ? "Floor Plan Images" : "EPC Floor Plan"
      )}
      {hasEpcFloorPlan && !hasFloorPlanImages && (
        <ExternalLink className="w-2.5 h-2.5 ml-1 opacity-60" />
      )}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {epcCertificateUrl && !hasFloorPlanImages ? (
            <a
              href={epcCertificateUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {badge}
            </a>
          ) : (
            badge
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="text-sm">
            {hasFloorPlanImages ? (
              <>
                <p className="font-medium text-emerald-700">Floor Plan Images Available</p>
                <p className="text-slate-600 text-xs mt-1">
                  High-quality floor plan images from the property listing
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-blue-700">EPC Floor Plan Available</p>
                <p className="text-slate-600 text-xs mt-1">
                  Basic floor plan diagram from the Energy Performance Certificate
                </p>
                {epcCertificateUrl && (
                  <p className="text-blue-600 text-xs mt-1">Click to view certificate</p>
                )}
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
