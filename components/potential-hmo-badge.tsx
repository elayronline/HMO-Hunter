"use client"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TrendingUp, Wrench, XCircle, Lock, Crown } from "lucide-react"

interface PotentialHMOBadgeProps {
  classification: "ready_to_go" | "value_add" | "not_suitable" | null
  dealScore?: number
  className?: string
  isPremium?: boolean
}

const classificationConfig = {
  ready_to_go: {
    label: "Ready to Go",
    icon: TrendingUp,
    className: "bg-green-500 text-white border-green-600",
    description: "Compliant or near-compliant with minimal works required",
  },
  value_add: {
    label: "Value-Add",
    icon: Wrench,
    className: "bg-amber-500 text-white border-amber-600",
    description: "Reconfiguration, EPC upgrades, or amenity improvements required",
  },
  not_suitable: {
    label: "Not Suitable",
    icon: XCircle,
    className: "bg-slate-400 text-white border-slate-500",
    description: "Does not meet HMO conversion criteria",
  },
}

export function PotentialHMOBadge({
  classification,
  dealScore,
  className = "",
  isPremium = false,
}: PotentialHMOBadgeProps) {
  if (!classification || classification === "not_suitable") {
    return null
  }

  const config = classificationConfig[classification]
  const Icon = config.icon

  // Non-premium users see a locked badge
  if (!isPremium) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`bg-amber-100 text-amber-700 border-amber-300 ${className} flex items-center gap-1 cursor-pointer`}>
              <Lock className="w-3 h-3" />
              <span className="blur-[2px]">HMO</span>
              <Crown className="w-3 h-3 text-amber-500" />
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <p className="font-medium flex items-center gap-1 justify-center">
                <Crown className="w-4 h-4 text-amber-500" />
                Pro Feature
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Upgrade to Pro to see HMO investment analysis
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Deal scores, yield projections & compliance data
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={`${config.className} ${className} flex items-center gap-1`}>
            <Icon className="w-3 h-3" />
            {config.label}
            {dealScore !== undefined && (
              <span className="ml-1 opacity-80">({dealScore})</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{config.label} HMO</p>
          <p className="text-sm text-muted-foreground">{config.description}</p>
          {dealScore !== undefined && (
            <p className="text-sm mt-1">Deal Score: {dealScore}/100</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
