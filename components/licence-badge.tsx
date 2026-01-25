"use client"

import { Shield, ShieldCheck, ShieldAlert, ShieldX, FileCheck, AlertTriangle, HelpCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { LicenceStatus, ExpiryWarning } from "@/lib/types/licences"
import { getLicenceStatusColor, formatLicenceStatus, getDaysUntilExpiry } from "@/lib/types/licences"

interface LicenceBadgeProps {
  licenceTypeCode: string
  licenceTypeName: string
  status: LicenceStatus
  endDate?: string | null
  expiryWarning?: ExpiryWarning
  showTooltip?: boolean
  size?: "sm" | "md" | "lg"
}

const iconMap: Record<string, React.ElementType> = {
  mandatory_hmo: Shield,
  additional_hmo: ShieldCheck,
  selective_licence: FileCheck,
  article_4: AlertTriangle,
  scottish_hmo: Shield,
  ni_hmo: Shield,
}

const statusIconMap: Record<LicenceStatus, React.ElementType> = {
  active: ShieldCheck,
  expired: ShieldX,
  pending: ShieldAlert,
  unknown: HelpCircle,
}

export function LicenceBadge({
  licenceTypeCode,
  licenceTypeName,
  status,
  endDate,
  expiryWarning,
  showTooltip = true,
  size = "md",
}: LicenceBadgeProps) {
  const Icon = iconMap[licenceTypeCode] || Shield
  const StatusIcon = statusIconMap[status]
  const statusColor = getLicenceStatusColor(status)
  const daysUntilExpiry = getDaysUntilExpiry(endDate || null)

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1",
    lg: "text-base px-3 py-1.5",
  }

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  }

  const badge = (
    <Badge
      variant="outline"
      className={`${statusColor} ${sizeClasses[size]} inline-flex items-center gap-1 font-medium`}
    >
      <Icon className={iconSizes[size]} />
      <span className="truncate max-w-[120px]">{licenceTypeName}</span>
      {expiryWarning === "expiring_soon" && (
        <span className="text-amber-600 text-xs font-bold">!</span>
      )}
    </Badge>
  )

  if (!showTooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{licenceTypeName}</p>
            <p className="text-sm">
              Status: <span className="font-medium">{formatLicenceStatus(status)}</span>
            </p>
            {endDate && (
              <p className="text-sm">
                {status === "expired" ? (
                  <span className="text-red-600">
                    Expired {Math.abs(daysUntilExpiry || 0)} days ago
                  </span>
                ) : daysUntilExpiry !== null && daysUntilExpiry <= 90 ? (
                  <span className="text-amber-600">
                    Expires in {daysUntilExpiry} days
                  </span>
                ) : (
                  <span>
                    Expires: {new Date(endDate).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                )}
              </p>
            )}
            {!endDate && status === "unknown" && (
              <p className="text-xs text-gray-500">Expiry date not available</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Simple status indicator for compact views
export function LicenceStatusDot({ status }: { status: LicenceStatus }) {
  const colors: Record<LicenceStatus, string> = {
    active: "bg-green-500",
    expired: "bg-red-500",
    pending: "bg-amber-500",
    unknown: "bg-gray-400",
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{formatLicenceStatus(status)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
