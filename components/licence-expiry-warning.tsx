"use client"

import { AlertTriangle, Clock, ShieldAlert, ShieldX } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Property } from "@/lib/types/database"

interface LicenceExpiryWarningProps {
  property: Property
  showTooltip?: boolean
}

export function LicenceExpiryWarning({ property, showTooltip = true }: LicenceExpiryWarningProps) {
  if (!property.licence_end_date) return null

  const endDate = new Date(property.licence_end_date)
  const now = new Date()
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  // Already expired
  if (daysUntilExpiry < 0) {
    const daysExpired = Math.abs(daysUntilExpiry)
    const badge = (
      <Badge className="bg-red-100 text-red-700 border-red-300 text-xs font-semibold animate-pulse">
        <ShieldX className="w-3 h-3 mr-1" />
        Expired {daysExpired}d ago
      </Badge>
    )

    if (!showTooltip) return badge

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <p className="font-bold text-red-600">HMO Licence Expired</p>
              <p className="text-sm">
                This licence expired on {endDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-slate-500">
                The property may still be operating as an HMO but requires licence renewal.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Expiring within 30 days - urgent
  if (daysUntilExpiry <= 30) {
    const badge = (
      <Badge className="bg-red-50 text-red-600 border-red-200 text-xs font-semibold">
        <AlertTriangle className="w-3 h-3 mr-1" />
        Expires in {daysUntilExpiry}d
      </Badge>
    )

    if (!showTooltip) return badge

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <p className="font-bold text-red-600">Licence Expiring Soon!</p>
              <p className="text-sm">
                Expires on {endDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-slate-500">
                Contact the licence holder about renewal status before purchasing.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Expiring within 90 days - warning
  if (daysUntilExpiry <= 90) {
    const badge = (
      <Badge className="bg-amber-50 text-amber-600 border-amber-200 text-xs">
        <Clock className="w-3 h-3 mr-1" />
        Expires in {daysUntilExpiry}d
      </Badge>
    )

    if (!showTooltip) return badge

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <p className="font-bold text-amber-600">Licence Expiring</p>
              <p className="text-sm">
                Expires on {endDate.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
              <p className="text-xs text-slate-500">
                Check renewal status when making an offer.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Not expiring soon - no warning needed
  return null
}

/**
 * Get the expiry status for a property
 */
export function getLicenceExpiryStatus(property: Property): "expired" | "urgent" | "warning" | "ok" | null {
  if (!property.licence_end_date) return null

  const endDate = new Date(property.licence_end_date)
  const now = new Date()
  const daysUntilExpiry = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntilExpiry < 0) return "expired"
  if (daysUntilExpiry <= 30) return "urgent"
  if (daysUntilExpiry <= 90) return "warning"
  return "ok"
}
