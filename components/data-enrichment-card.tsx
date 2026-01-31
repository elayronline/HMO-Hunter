"use client"

import { useState } from "react"
import {
  Wifi,
  Zap,
  FileText,
  User,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"

interface DataEnrichmentCardProps {
  property: Property
  onEnrichmentComplete?: () => void
  className?: string
  isPremium?: boolean
}

type EnrichmentType = "broadband" | "epc" | "owner"

interface EnrichmentStatus {
  type: EnrichmentType
  status: "idle" | "loading" | "success" | "error"
  message?: string
}

export function DataEnrichmentCard({
  property,
  onEnrichmentComplete,
  className,
  isPremium = false,
}: DataEnrichmentCardProps) {
  const [statuses, setStatuses] = useState<Record<EnrichmentType, EnrichmentStatus>>({
    broadband: { type: "broadband", status: "idle" },
    epc: { type: "epc", status: "idle" },
    owner: { type: "owner", status: "idle" },
  })

  const enrichments = [
    {
      type: "broadband" as EnrichmentType,
      icon: Wifi,
      label: "Broadband",
      description: "Fetch fiber & speed data",
      endpoint: "/api/enrich-broadband",
      hasData: property.has_fiber !== null || property.broadband_max_down !== null,
      currentValue: property.broadband_max_down
        ? `${property.broadband_max_down} Mbps`
        : null,
    },
    {
      type: "epc" as EnrichmentType,
      icon: Zap,
      label: "EPC Certificate",
      description: "Energy rating & floor area",
      endpoint: "/api/enrich-epc",
      hasData: property.epc_rating !== null,
      currentValue: property.epc_rating ? `Rating ${property.epc_rating}` : null,
    },
    {
      type: "owner" as EnrichmentType,
      icon: User,
      label: "Owner Info",
      description: "Land Registry & Companies House",
      endpoint: "/api/enrich-owner",
      hasData: property.owner_name !== null || property.company_name !== null,
      currentValue: isPremium
        ? (property.company_name || property.owner_name || null)
        : (property.owner_name || property.company_name ? "Premium feature" : null),
    },
  ]

  const runEnrichment = async (type: EnrichmentType, endpoint: string) => {
    setStatuses((prev) => ({
      ...prev,
      [type]: { type, status: "loading" },
    }))

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          postcode: property.postcode,
          address: property.address,
          uprn: property.uprn,
        }),
      })

      const result = await response.json()

      if (result.success || result.enriched) {
        setStatuses((prev) => ({
          ...prev,
          [type]: { type, status: "success", message: "Data updated" },
        }))
        onEnrichmentComplete?.()
      } else {
        setStatuses((prev) => ({
          ...prev,
          [type]: {
            type,
            status: "error",
            message: result.error || "No data found",
          },
        }))
      }
    } catch (err) {
      setStatuses((prev) => ({
        ...prev,
        [type]: { type, status: "error", message: "Request failed" },
      }))
    }
  }

  const runAllEnrichments = async () => {
    for (const enrichment of enrichments) {
      if (!enrichment.hasData) {
        await runEnrichment(enrichment.type, enrichment.endpoint)
      }
    }
  }

  const missingCount = enrichments.filter((e) => !e.hasData).length
  const hasAllData = missingCount === 0

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Data Enrichment</h3>
              <p className="text-sm text-white/80">Fetch missing property data</p>
            </div>
          </div>
          {hasAllData ? (
            <Badge className="bg-emerald-500/20 text-white border-emerald-300">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Complete
            </Badge>
          ) : (
            <Badge className="bg-amber-500/20 text-white border-amber-300">
              {missingCount} missing
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {enrichments.map((enrichment) => {
          const Icon = enrichment.icon
          const status = statuses[enrichment.type]
          const isLoading = status.status === "loading"
          const isSuccess = status.status === "success"
          const isError = status.status === "error"

          return (
            <div
              key={enrichment.type}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border transition-colors",
                enrichment.hasData
                  ? "bg-emerald-50 border-emerald-200"
                  : isSuccess
                  ? "bg-emerald-50 border-emerald-200"
                  : isError
                  ? "bg-red-50 border-red-200"
                  : "bg-slate-50 border-slate-200"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg",
                    enrichment.hasData || isSuccess
                      ? "bg-emerald-100 text-emerald-600"
                      : isError
                      ? "bg-red-100 text-red-600"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {enrichment.label}
                  </div>
                  {enrichment.hasData || isSuccess ? (
                    <div className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {enrichment.currentValue || status.message || "Data available"}
                    </div>
                  ) : isError ? (
                    <div className="text-xs text-red-600 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      {status.message}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      {enrichment.description}
                    </div>
                  )}
                </div>
              </div>

              {!enrichment.hasData && !isSuccess && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runEnrichment(enrichment.type, enrichment.endpoint)}
                  disabled={isLoading}
                  className="h-8"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Fetch"
                  )}
                </Button>
              )}

              {(enrichment.hasData || isSuccess) && (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
            </div>
          )
        })}

        {/* Fetch All Button */}
        {missingCount > 0 && (
          <Button
            onClick={runAllEnrichments}
            className="w-full bg-violet-600 hover:bg-violet-700"
            disabled={Object.values(statuses).some((s) => s.status === "loading")}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Fetch All Missing Data
          </Button>
        )}

        {/* Info Text */}
        <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
          Data from gov.uk, Land Registry, Ofcom
        </div>
      </CardContent>
    </Card>
  )
}
