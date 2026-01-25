"use client"

import { useState } from "react"
import {
  Shield,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp } from "lucide-react"
import { LicenceCard, LicenceList } from "./licence-card"
import { LicenceBadge } from "./licence-badge"
import type { PropertyLicence, LicenceStatus } from "@/lib/types/licences"
import type { Property } from "@/lib/types/database"

interface LicenceSectionProps {
  property: Property
  licences: PropertyLicence[]
  defaultOpen?: boolean
  onRefresh?: () => void
  onAddLicence?: () => void
  isLoading?: boolean
}

export function LicenceSection({
  property,
  licences,
  defaultOpen = false,
  onRefresh,
  onAddLicence,
  isLoading = false,
}: LicenceSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  // Calculate summary stats
  const activeLicences = licences.filter((l) => l.status === "active")
  const expiredLicences = licences.filter((l) => l.status === "expired")
  const pendingLicences = licences.filter((l) => l.status === "pending")
  const unknownLicences = licences.filter((l) => l.status === "unknown")

  // Check for expiring soon (within 90 days)
  const expiringSoon = licences.filter((l) => {
    if (!l.end_date || l.status !== "active") return false
    const daysLeft = Math.ceil(
      (new Date(l.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return daysLeft > 0 && daysLeft <= 90
  })

  // Determine overall status
  const overallStatus: LicenceStatus =
    activeLicences.length > 0
      ? "active"
      : expiredLicences.length > 0
      ? "expired"
      : pendingLicences.length > 0
      ? "pending"
      : "unknown"

  const StatusIcon =
    overallStatus === "active"
      ? CheckCircle2
      : overallStatus === "expired"
      ? XCircle
      : overallStatus === "pending"
      ? AlertCircle
      : HelpCircle

  const statusColors = {
    active: "text-green-600 bg-green-100",
    expired: "text-red-600 bg-red-100",
    pending: "text-amber-600 bg-amber-100",
    unknown: "text-gray-500 bg-gray-100",
  }

  return (
    <div className="rounded-xl overflow-hidden border-2 border-slate-200 bg-white">
      {/* Header */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="bg-gradient-to-r from-slate-100 to-slate-50 px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${statusColors[overallStatus]}`}>
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm uppercase tracking-wide text-slate-700">
                      HMO Licences
                    </span>
                    {licences.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {licences.length}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {activeLicences.length > 0
                      ? `${activeLicences.length} active licence${activeLicences.length > 1 ? "s" : ""}`
                      : licences.length > 0
                      ? "No active licences"
                      : "No licence data available"}
                    {expiringSoon.length > 0 && (
                      <span className="text-amber-600 ml-1">
                        · {expiringSoon.length} expiring soon
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Quick Status Badges */}
                <div className="hidden sm:flex items-center gap-1">
                  {activeLicences.length > 0 && (
                    <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                      {activeLicences.length} Active
                    </Badge>
                  )}
                  {expiredLicences.length > 0 && (
                    <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">
                      {expiredLicences.length} Expired
                    </Badge>
                  )}
                </div>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 space-y-4 border-t border-slate-100">
            {/* Summary Stats */}
            {licences.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                <StatCard
                  icon={CheckCircle2}
                  label="Active"
                  value={activeLicences.length}
                  color="green"
                />
                <StatCard
                  icon={AlertCircle}
                  label="Pending"
                  value={pendingLicences.length}
                  color="amber"
                />
                <StatCard
                  icon={XCircle}
                  label="Expired"
                  value={expiredLicences.length}
                  color="red"
                />
                <StatCard
                  icon={HelpCircle}
                  label="Unknown"
                  value={unknownLicences.length}
                  color="gray"
                />
              </div>
            )}

            {/* Expiring Soon Warning */}
            {expiringSoon.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {expiringSoon.length} licence{expiringSoon.length > 1 ? "s" : ""} expiring within 90 days
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {expiringSoon.map((licence) => (
                    <LicenceBadge
                      key={licence.id}
                      licenceTypeCode={licence.licence_type_code}
                      licenceTypeName={licence.licence_type_name || licence.licence_type_code}
                      status={licence.status}
                      endDate={licence.end_date}
                      expiryWarning="expiring_soon"
                      size="sm"
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Licence List */}
            {licences.length > 0 ? (
              <LicenceList licences={licences} maxVisible={5} />
            ) : (
              <div className="text-center py-6 bg-slate-50 rounded-lg">
                <Shield className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                <p className="text-sm text-slate-600 font-medium">
                  No licence information available
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Licence data will appear here when available from council registers
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              {onRefresh && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isLoading}
                  className="text-xs"
                >
                  <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
                  Refresh Data
                </Button>
              )}
              {onAddLicence && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddLicence}
                  className="text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Licence
                </Button>
              )}
              <p className="text-xs text-slate-400 ml-auto">
                {licences.length > 0 && licences[0].verified_at
                  ? `Last updated: ${new Date(licences[0].verified_at).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// Stat card component
function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: "green" | "amber" | "red" | "gray"
}) {
  const colors = {
    green: "bg-green-50 text-green-700 border-green-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    gray: "bg-gray-50 text-gray-600 border-gray-200",
  }

  return (
    <div className={`rounded-lg border p-2 text-center ${colors[color]}`}>
      <Icon className="h-4 w-4 mx-auto mb-1" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs">{label}</p>
    </div>
  )
}

// Compact inline licence badges for property cards
export function LicenceBadgesInline({
  licences,
  maxVisible = 2,
}: {
  licences: PropertyLicence[]
  maxVisible?: number
}) {
  if (licences.length === 0) return null

  const activeLicences = licences.filter((l) => l.status === "active")
  const visibleLicences = activeLicences.slice(0, maxVisible)
  const hiddenCount = activeLicences.length - maxVisible

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visibleLicences.map((licence) => (
        <LicenceBadge
          key={licence.id}
          licenceTypeCode={licence.licence_type_code}
          licenceTypeName={licence.licence_type_name || licence.licence_type_code}
          status={licence.status}
          endDate={licence.end_date}
          size="sm"
        />
      ))}
      {hiddenCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          +{hiddenCount}
        </Badge>
      )}
    </div>
  )
}
