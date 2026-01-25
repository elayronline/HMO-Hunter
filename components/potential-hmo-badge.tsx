"use client"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TrendingUp, Wrench, XCircle } from "lucide-react"

interface PotentialHMOBadgeProps {
  classification: "ready_to_go" | "value_add" | "not_suitable" | null
  dealScore?: number
  className?: string
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
}: PotentialHMOBadgeProps) {
  if (!classification || classification === "not_suitable") {
    return null
  }

  const config = classificationConfig[classification]
  const Icon = config.icon

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
