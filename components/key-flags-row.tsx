"use client"

import { cn } from "@/lib/utils"
import { Shield, AlertTriangle, Zap, CheckCircle2 } from "lucide-react"
import type { Property } from "@/lib/types/database"

interface KeyFlagsRowProps {
  property: Property
  className?: string
}

type FlagType = {
  id: string
  label: string
  icon: React.ElementType
  bgColor: string
  textColor: string
  priority: number
}

export function KeyFlagsRow({ property, className }: KeyFlagsRowProps) {
  const flags: FlagType[] = []

  // Licence status (highest priority)
  if (property.licensed_hmo && property.licence_status === "active") {
    flags.push({
      id: "licensed",
      label: "Licensed",
      icon: Shield,
      bgColor: "bg-emerald-100",
      textColor: "text-emerald-700",
      priority: 1,
    })
  } else if (property.licence_status === "expired") {
    flags.push({
      id: "expired",
      label: "Expired Licence",
      icon: AlertTriangle,
      bgColor: "bg-amber-100",
      textColor: "text-amber-700",
      priority: 1,
    })
  }

  // Article 4 (high priority warning)
  if (property.article_4_area) {
    flags.push({
      id: "article4",
      label: "Article 4",
      icon: AlertTriangle,
      bgColor: "bg-purple-100",
      textColor: "text-purple-700",
      priority: 2,
    })
  }

  // EPC Rating
  if (property.epc_rating) {
    const isGoodEPC = ["A", "B", "C"].includes(property.epc_rating)
    flags.push({
      id: "epc",
      label: `EPC ${property.epc_rating}`,
      icon: isGoodEPC ? CheckCircle2 : Zap,
      bgColor: isGoodEPC ? "bg-green-100" : "bg-orange-100",
      textColor: isGoodEPC ? "text-green-700" : "text-orange-700",
      priority: 3,
    })
  }

  // HMO Classification
  if (property.is_potential_hmo && property.hmo_classification) {
    const classConfig = {
      ready_to_go: { label: "Ready to Go", bg: "bg-teal-100", text: "text-teal-700" },
      value_add: { label: "Value-Add", bg: "bg-blue-100", text: "text-blue-700" },
    }[property.hmo_classification] || null

    if (classConfig) {
      flags.push({
        id: "hmo_class",
        label: classConfig.label,
        icon: Zap,
        bgColor: classConfig.bg,
        textColor: classConfig.text,
        priority: 4,
      })
    }
  }

  // Sort by priority and limit to 4
  const displayFlags = flags
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4)

  if (displayFlags.length === 0) return null

  return (
    <div className={cn("flex flex-wrap gap-2 px-4 py-2", className)}>
      {displayFlags.map((flag) => {
        const Icon = flag.icon
        return (
          <span
            key={flag.id}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-semibold",
              flag.bgColor,
              flag.textColor
            )}
          >
            <Icon className="w-3 h-3" />
            {flag.label}
          </span>
        )
      })}
    </div>
  )
}
