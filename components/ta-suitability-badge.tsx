"use client"

import { Badge } from "@/components/ui/badge"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Home, AlertTriangle, Lock, Crown } from "lucide-react"
import { assessTASuitability, CRITERIA_LABELS, type TASuitability } from "@/lib/services/ta-suitability"
import type { Property } from "@/lib/types/database"

interface TASuitabilityBadgeProps {
  property: Property
  className?: string
  isPremium?: boolean
}

const suitabilityConfig: Record<Exclude<TASuitability, "not_suitable">, {
  label: string
  icon: typeof Home
  className: string
  description: string
}> = {
  suitable: {
    label: "TA Suitable",
    icon: Home,
    className: "bg-teal-500 text-white border-teal-600",
    description: "Meets all TA placement criteria",
  },
  partial: {
    label: "TA Partial",
    icon: AlertTriangle,
    className: "bg-amber-500 text-white border-amber-600",
    description: "Meets some TA criteria — review required",
  },
}

export function TASuitabilityBadge({
  property,
  className = "",
  isPremium = false,
}: TASuitabilityBadgeProps) {
  const result = assessTASuitability(property)

  if (result.suitability === "not_suitable") {
    return null
  }

  const config = suitabilityConfig[result.suitability]
  const Icon = config.icon

  // Non-premium users see a locked badge
  if (!isPremium) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Badge className={`bg-teal-100 text-teal-700 border-teal-300 ${className} flex items-center gap-1 cursor-pointer`}>
            <Lock className="w-3 h-3" />
            <span className="blur-[2px]">TA</span>
            <Crown className="w-3 h-3 text-amber-500" />
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[200px] p-3">
          <div className="text-center">
            <p className="font-medium flex items-center gap-1 justify-center text-sm">
              <Crown className="w-4 h-4 text-amber-500" />
              Pro Feature
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Upgrade to Pro for TA suitability analysis
            </p>
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge className={`${config.className} ${className} flex items-center gap-1 cursor-pointer`}>
          <Icon className="w-3 h-3" />
          {config.label}
          <span className="ml-1 opacity-80">({result.score}/5)</span>
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-[260px] p-3">
        <p className="font-medium text-sm">{config.label}</p>
        <p className="text-xs text-muted-foreground">{config.description}</p>
        <div className="text-xs mt-2 space-y-0.5">
          {Object.entries(result.criteria).map(([key, met]) => (
            <p key={key} className={met ? "text-emerald-600" : "text-red-400"}>
              {met ? "\u2713" : "\u2717"} {CRITERIA_LABELS[key] || key}
            </p>
          ))}
        </div>
        {result.lhaMonthly && (
          <p className="text-xs mt-2 text-slate-500">LHA: £{result.lhaMonthly}/mo</p>
        )}
      </PopoverContent>
    </Popover>
  )
}
