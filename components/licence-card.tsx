"use client"

import { useState } from "react"
import {
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Calendar,
  Users,
  Home,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { PropertyLicence, LicenceStatus, ExpiryWarning } from "@/lib/types/licences"
import {
  getLicenceStatusColor,
  formatLicenceStatus,
  getDaysUntilExpiry,
  getExpiryWarningLevel,
} from "@/lib/types/licences"

interface LicenceCardProps {
  licence: PropertyLicence
  defaultExpanded?: boolean
  onRequestUpdate?: () => void
}

export function LicenceCard({
  licence,
  defaultExpanded = false,
  onRequestUpdate,
}: LicenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  const daysUntilExpiry = getDaysUntilExpiry(licence.end_date)
  const expiryWarning = getExpiryWarningLevel(licence.end_date)
  const statusColor = getLicenceStatusColor(licence.status)

  const StatusIcon =
    licence.status === "active"
      ? ShieldCheck
      : licence.status === "expired"
      ? ShieldX
      : licence.status === "pending"
      ? ShieldAlert
      : Shield

  return (
    <div className={`rounded-lg border-2 overflow-hidden ${
      licence.status === "active" ? "border-green-200 bg-green-50/50" :
      licence.status === "expired" ? "border-red-200 bg-red-50/50" :
      licence.status === "pending" ? "border-amber-200 bg-amber-50/50" :
      "border-gray-200 bg-gray-50/50"
    }`}>
      {/* Header */}
      <div className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            licence.status === "active" ? "bg-green-100" :
            licence.status === "expired" ? "bg-red-100" :
            licence.status === "pending" ? "bg-amber-100" :
            "bg-gray-100"
          }`}>
            <StatusIcon className={`h-5 w-5 ${
              licence.status === "active" ? "text-green-600" :
              licence.status === "expired" ? "text-red-600" :
              licence.status === "pending" ? "text-amber-600" :
              "text-gray-500"
            }`} />
          </div>
          <div>
            <p className="font-semibold text-sm">
              {licence.licence_type_name || licence.licence_type_code}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="outline" className={`${statusColor} text-xs`}>
                {formatLicenceStatus(licence.status)}
              </Badge>
              {expiryWarning === "expiring_soon" && (
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {daysUntilExpiry}d left
                </Badge>
              )}
              {expiryWarning === "expired" && daysUntilExpiry !== null && (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {Math.abs(daysUntilExpiry)}d ago
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      </div>

      {/* Expandable Content */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-1 border-t border-gray-200/50 space-y-3">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="text-sm font-medium">
                    {licence.start_date
                      ? new Date(licence.start_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Unknown"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">End Date</p>
                  <p className={`text-sm font-medium ${
                    expiryWarning === "expired" ? "text-red-600" :
                    expiryWarning === "expiring_soon" ? "text-amber-600" :
                    ""
                  }`}>
                    {licence.end_date
                      ? new Date(licence.end_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Unknown"}
                  </p>
                </div>
              </div>
            </div>

            {/* Occupancy Limits */}
            {(licence.max_occupants || licence.max_households) && (
              <div className="grid grid-cols-2 gap-3">
                {licence.max_occupants && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Max Occupants</p>
                      <p className="text-sm font-medium">{licence.max_occupants}</p>
                    </div>
                  </div>
                )}
                {licence.max_households && (
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Max Households</p>
                      <p className="text-sm font-medium">{licence.max_households}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Licence Number */}
            {licence.licence_number && (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">Licence Number</p>
                  <p className="text-sm font-medium font-mono">{licence.licence_number}</p>
                </div>
              </div>
            )}

            {/* Conditions */}
            {licence.conditions && licence.conditions.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Conditions</p>
                <ul className="text-xs text-gray-700 space-y-0.5">
                  {licence.conditions.slice(0, 3).map((condition, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <span className="text-gray-400">•</span>
                      <span>{condition}</span>
                    </li>
                  ))}
                  {licence.conditions.length > 3 && (
                    <li className="text-gray-500">
                      +{licence.conditions.length - 3} more conditions
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Source & Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
              <p className="text-xs text-gray-400">
                Source: {licence.source === "council_api" ? "Council API" :
                        licence.source === "manual" ? "Manual Entry" :
                        licence.source === "searchland" ? "Searchland" :
                        licence.source === "scraped" ? "Web Scrape" :
                        "Unknown"}
                {licence.verified_at && (
                  <span> · Verified {new Date(licence.verified_at).toLocaleDateString()}</span>
                )}
              </p>
              {licence.source_url && (
                <a
                  href={licence.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                >
                  View Source
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// Compact view for multiple licences
export function LicenceList({
  licences,
  maxVisible = 3,
}: {
  licences: PropertyLicence[]
  maxVisible?: number
}) {
  const [showAll, setShowAll] = useState(false)
  const visibleLicences = showAll ? licences : licences.slice(0, maxVisible)
  const hiddenCount = licences.length - maxVisible

  if (licences.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        <Shield className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p className="text-sm">No licence information available</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {visibleLicences.map((licence) => (
        <LicenceCard key={licence.id} licence={licence} />
      ))}
      {!showAll && hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-gray-500"
          onClick={() => setShowAll(true)}
        >
          Show {hiddenCount} more licence{hiddenCount > 1 ? "s" : ""}
        </Button>
      )}
      {showAll && hiddenCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-gray-500"
          onClick={() => setShowAll(false)}
        >
          Show less
        </Button>
      )}
    </div>
  )
}
