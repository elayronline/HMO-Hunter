"use client"

import { Wifi, WifiOff, Zap, Signal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface BroadbandBadgeProps {
  hasFiber: boolean | null | undefined
  hasSuperfast: boolean | null | undefined
  maxDownload: number | null | undefined
  maxUpload?: number | null | undefined
  ultrafastDown?: number | null | undefined
  superfastDown?: number | null | undefined
  lastChecked?: string | null | undefined
  showSpeed?: boolean
  size?: "sm" | "md" | "lg"
}

export function BroadbandBadge({
  hasFiber,
  hasSuperfast,
  maxDownload,
  maxUpload,
  ultrafastDown,
  superfastDown,
  lastChecked,
  showSpeed = true,
  size = "md",
}: BroadbandBadgeProps) {
  // Determine broadband tier
  const getTier = () => {
    if (hasFiber === null && hasSuperfast === null && maxDownload === null) {
      return "unknown"
    }
    if (hasFiber) return "ultrafast"
    if (hasSuperfast) return "superfast"
    if (maxDownload && maxDownload > 0) return "basic"
    return "none"
  }

  const tier = getTier()

  const config = {
    ultrafast: {
      label: "Full Fiber",
      shortLabel: "Fiber",
      icon: Zap,
      color: "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400",
      description: "Full Fiber (FTTP) available - ultrafast speeds",
    },
    superfast: {
      label: "Superfast",
      shortLabel: "Fast",
      icon: Wifi,
      color: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400",
      description: "Superfast broadband available (30Mbps+)",
    },
    basic: {
      label: "Basic",
      shortLabel: "Basic",
      icon: Signal,
      color: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400",
      description: "Basic broadband only",
    },
    none: {
      label: "No Broadband",
      shortLabel: "None",
      icon: WifiOff,
      color: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
      description: "No broadband service available",
    },
    unknown: {
      label: "Unknown",
      shortLabel: "?",
      icon: Wifi,
      color: "bg-gray-500/10 text-gray-500 border-gray-500/20",
      description: "Broadband availability not checked",
    },
  }

  const { label, shortLabel, icon: Icon, color, description } = config[tier]

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  }

  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 16,
  }

  const formatSpeed = (speed: number | null | undefined) => {
    if (!speed || speed <= 0) return null
    if (speed >= 1000) return `${(speed / 1000).toFixed(1)}Gbps`
    return `${Math.round(speed)}Mbps`
  }

  const speedText = showSpeed && maxDownload ? formatSpeed(maxDownload) : null

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${color} ${sizeClasses[size]} font-medium inline-flex items-center gap-1 cursor-help`}
          >
            <Icon size={iconSizes[size]} />
            <span>{size === "sm" ? shortLabel : label}</span>
            {speedText && <span className="opacity-75">({speedText})</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{description}</p>
            {(maxDownload || ultrafastDown || superfastDown) && (
              <div className="text-xs space-y-1">
                {ultrafastDown && ultrafastDown > 0 && (
                  <p>Ultrafast: up to {formatSpeed(ultrafastDown)}</p>
                )}
                {superfastDown && superfastDown > 0 && (
                  <p>Superfast: up to {formatSpeed(superfastDown)}</p>
                )}
                {maxDownload && maxDownload > 0 && (
                  <p>
                    Max speed: {formatSpeed(maxDownload)} down
                    {maxUpload && maxUpload > 0 && ` / ${formatSpeed(maxUpload)} up`}
                  </p>
                )}
              </div>
            )}
            {lastChecked && (
              <p className="text-xs text-muted-foreground">
                Last checked: {new Date(lastChecked).toLocaleDateString()}
              </p>
            )}
            <p className="text-xs text-muted-foreground">Source: Ofcom</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/**
 * Compact version for list views
 */
export function BroadbandIcon({
  hasFiber,
  hasSuperfast,
  maxDownload,
}: {
  hasFiber: boolean | null | undefined
  hasSuperfast: boolean | null | undefined
  maxDownload: number | null | undefined
}) {
  const getTier = () => {
    if (hasFiber === null && hasSuperfast === null && maxDownload === null) {
      return "unknown"
    }
    if (hasFiber) return "ultrafast"
    if (hasSuperfast) return "superfast"
    if (maxDownload && maxDownload > 0) return "basic"
    return "none"
  }

  const tier = getTier()

  const config = {
    ultrafast: { icon: Zap, color: "text-green-500", title: "Full Fiber available" },
    superfast: { icon: Wifi, color: "text-blue-500", title: "Superfast broadband" },
    basic: { icon: Signal, color: "text-yellow-500", title: "Basic broadband" },
    none: { icon: WifiOff, color: "text-red-500", title: "No broadband" },
    unknown: { icon: Wifi, color: "text-gray-400", title: "Unknown" },
  }

  const { icon: Icon, color, title } = config[tier]

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon size={16} className={`${color} cursor-help`} />
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{title}</p>
          {maxDownload && maxDownload > 0 && (
            <p className="text-xs text-muted-foreground">Up to {maxDownload}Mbps</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
