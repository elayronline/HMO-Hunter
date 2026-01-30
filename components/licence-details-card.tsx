"use client"

import { useState, useEffect } from "react"
import {
  Shield,
  Calendar,
  Users,
  FileText,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface LicenceData {
  id: string
  licence_number: string
  licence_type_code: string
  licence_type_name?: string
  licence_type_description?: string
  status: "active" | "pending" | "expired" | "revoked"
  start_date: string
  end_date: string
  max_occupants?: number
  max_households?: number
  conditions?: string[]
  holder_name?: string
  holder_address?: string
  issuing_authority?: string
}

interface LicenceDetailsCardProps {
  propertyId: string
  className?: string
}

export function LicenceDetailsCard({ propertyId, className }: LicenceDetailsCardProps) {
  const [licences, setLicences] = useState<LicenceData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLicences = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/licences?property_id=${propertyId}`)
      if (!response.ok) throw new Error("Failed to fetch licences")
      const data = await response.json()
      setLicences(data.licences || [])
    } catch (err) {
      setError("Unable to load licence details")
      console.error("[LicenceDetails] Error:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (propertyId) {
      fetchLicences()
    }
  }, [propertyId])

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "active":
        return {
          icon: CheckCircle2,
          color: "text-emerald-600",
          bg: "bg-emerald-50 border-emerald-200",
          label: "Active",
        }
      case "pending":
        return {
          icon: Clock,
          color: "text-amber-600",
          bg: "bg-amber-50 border-amber-200",
          label: "Pending",
        }
      case "expired":
        return {
          icon: AlertTriangle,
          color: "text-red-600",
          bg: "bg-red-50 border-red-200",
          label: "Expired",
        }
      case "revoked":
        return {
          icon: XCircle,
          color: "text-red-600",
          bg: "bg-red-50 border-red-200",
          label: "Revoked",
        }
      default:
        return {
          icon: FileText,
          color: "text-slate-600",
          bg: "bg-slate-50 border-slate-200",
          label: "Unknown",
        }
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    } catch {
      return dateStr
    }
  }

  const getDaysRemaining = (endDate: string) => {
    const end = new Date(endDate)
    const now = new Date()
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diff
  }

  if (loading) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="w-5 h-5 text-teal-500 animate-spin" />
          <span className="ml-2 text-slate-600">Loading licences...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="py-6 text-center">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-slate-600">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchLicences} className="mt-3">
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (licences.length === 0) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <div className="p-4 bg-gradient-to-r from-slate-600 to-slate-700 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Licence Details</h3>
              <p className="text-sm text-white/80">HMO & Property Licences</p>
            </div>
          </div>
        </div>
        <CardContent className="py-8 text-center">
          <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-600">No licences found for this property</p>
          <p className="text-xs text-slate-400 mt-1">
            Licence data is sourced from council HMO registers
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Licence Details</h3>
              <p className="text-sm text-white/80">
                {licences.length} licence{licences.length !== 1 ? "s" : ""} on record
              </p>
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {licences.map((licence, idx) => {
          const statusConfig = getStatusConfig(licence.status)
          const StatusIcon = statusConfig.icon
          const daysRemaining = getDaysRemaining(licence.end_date)
          const isExpiringSoon = licence.status === "active" && daysRemaining <= 90

          return (
            <div
              key={licence.id || idx}
              className={cn(
                "rounded-xl border overflow-hidden",
                statusConfig.bg
              )}
            >
              {/* Licence Header */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StatusIcon className={cn("w-5 h-5", statusConfig.color)} />
                  <div>
                    <span className={cn("font-semibold", statusConfig.color)}>
                      {statusConfig.label}
                    </span>
                    {licence.licence_type_name && (
                      <span className="text-sm text-slate-600 ml-2">
                        • {licence.licence_type_name}
                      </span>
                    )}
                  </div>
                </div>
                {isExpiringSoon && (
                  <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {daysRemaining} days left
                  </Badge>
                )}
              </div>

              {/* Licence Details */}
              <div className="px-3 pb-3 space-y-3">
                {/* Licence Number */}
                {licence.licence_number && (
                  <div className="flex items-center justify-between p-2 bg-white/50 rounded-lg">
                    <span className="text-xs text-slate-500">Licence Number</span>
                    <code className="text-sm font-mono font-medium text-slate-800">
                      {licence.licence_number}
                    </code>
                  </div>
                )}

                {/* Dates */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white/50 rounded-lg">
                    <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                      <Calendar className="w-3 h-3" />
                      Start Date
                    </div>
                    <div className="text-sm font-medium text-slate-800">
                      {formatDate(licence.start_date)}
                    </div>
                  </div>
                  <div className="p-2 bg-white/50 rounded-lg">
                    <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                      <Calendar className="w-3 h-3" />
                      End Date
                    </div>
                    <div className={cn(
                      "text-sm font-medium",
                      daysRemaining < 0 ? "text-red-600" : "text-slate-800"
                    )}>
                      {formatDate(licence.end_date)}
                    </div>
                  </div>
                </div>

                {/* Occupancy */}
                {(licence.max_occupants || licence.max_households) && (
                  <div className="grid grid-cols-2 gap-2">
                    {licence.max_occupants && (
                      <div className="p-2 bg-white/50 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                          <Users className="w-3 h-3" />
                          Max Occupants
                        </div>
                        <div className="text-sm font-bold text-slate-800">
                          {licence.max_occupants} persons
                        </div>
                      </div>
                    )}
                    {licence.max_households && (
                      <div className="p-2 bg-white/50 rounded-lg">
                        <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                          <Building2 className="w-3 h-3" />
                          Max Households
                        </div>
                        <div className="text-sm font-bold text-slate-800">
                          {licence.max_households}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Holder Info */}
                {licence.holder_name && (
                  <div className="p-2 bg-white/50 rounded-lg">
                    <div className="text-xs text-slate-500 mb-1">Licence Holder</div>
                    <div className="text-sm font-medium text-slate-800">
                      {licence.holder_name}
                    </div>
                    {licence.holder_address && (
                      <div className="text-xs text-slate-500 mt-1">
                        {licence.holder_address}
                      </div>
                    )}
                  </div>
                )}

                {/* Conditions */}
                {licence.conditions && licence.conditions.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                      <span className="group-open:rotate-90 transition-transform">▶</span>
                      {licence.conditions.length} conditions
                    </summary>
                    <ul className="mt-2 space-y-1 pl-4">
                      {licence.conditions.map((condition, i) => (
                        <li key={i} className="text-xs text-slate-600 list-disc">
                          {condition}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Issuing Authority */}
                {licence.issuing_authority && (
                  <div className="text-xs text-slate-400 pt-2 border-t border-black/5">
                    Issued by: {licence.issuing_authority}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Attribution */}
        <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
          Data from council HMO registers
        </div>
      </CardContent>
    </Card>
  )
}
