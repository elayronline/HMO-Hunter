"use client"

import { useState } from "react"
import {
  Home,
  PoundSterling,
  Shield,
  TrendingUp,
  Calendar,
  Building2,
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  Clock,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"

interface EnrichedDataDisplayProps {
  property: Property
  onRefresh?: () => void
  className?: string
}

export function EnrichedDataDisplay({
  property,
  onRefresh,
  className,
}: EnrichedDataDisplayProps) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    streetdata: true,
    patma: true,
    propertydata: true,
    zoopla: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await fetch("/api/enrich-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: property.id }),
      })
      onRefresh?.()
    } finally {
      setIsRefreshing(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return null
    return `£${value.toLocaleString()}`
  }

  // Check which data sources have data
  const hasStreetData = property.streetdata_enriched_at !== null
  const hasPaTMa = property.patma_enriched_at !== null
  const hasPropertyData = property.propertydata_enriched_at !== null
  const hasZoopla = property.zoopla_enriched_at !== null

  const enrichedCount = [hasStreetData, hasPaTMa, hasPropertyData, hasZoopla].filter(Boolean).length

  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold">Enriched Property Data</h3>
              <p className="text-sm text-white/80">Data from 4 premium sources</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={cn(
              "border",
              enrichedCount === 4
                ? "bg-emerald-500/20 text-white border-emerald-300"
                : enrichedCount > 0
                ? "bg-amber-500/20 text-white border-amber-300"
                : "bg-red-500/20 text-white border-red-300"
            )}>
              {enrichedCount}/4 sources
            </Badge>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 bg-white/20 hover:bg-white/30 text-white border-0"
            >
              <RefreshCw className={cn("w-4 h-4 mr-1", isRefreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* StreetData Section */}
        <DataSection
          title="Property Details"
          source="StreetData"
          icon={Home}
          isEnriched={hasStreetData}
          enrichedAt={property.streetdata_enriched_at}
          isExpanded={expandedSections.streetdata}
          onToggle={() => toggleSection("streetdata")}
        >
          {hasStreetData ? (
            <div className="grid grid-cols-2 gap-3">
              {property.construction_age_band && (
                <DataItem icon={Calendar} label="Built" value={property.construction_age_band} />
              )}
              {property.tenure && (
                <DataItem icon={Building2} label="Tenure" value={property.tenure} />
              )}
              {property.council_tax_band && (
                <DataItem icon={PoundSterling} label="Council Tax" value={`Band ${property.council_tax_band}`} />
              )}
              {property.internal_area_sqm && (
                <DataItem icon={Maximize} label="Floor Area" value={`${Math.round(property.internal_area_sqm)}m²`} />
              )}
              {property.is_bungalow !== null && (
                <DataItem icon={Home} label="Bungalow" value={property.is_bungalow ? "Yes" : "No"} />
              )}
              {property.has_outdoor_space !== null && (
                <DataItem icon={MapPin} label="Garden" value={property.has_outdoor_space ? "Yes" : "No"} />
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No StreetData enrichment yet</p>
          )}
        </DataSection>

        {/* PaTMa Section */}
        <DataSection
          title="Price Analytics"
          source="PaTMa"
          icon={TrendingUp}
          isEnriched={hasPaTMa}
          enrichedAt={property.patma_enriched_at}
          isExpanded={expandedSections.patma}
          onToggle={() => toggleSection("patma")}
        >
          {hasPaTMa ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {property.patma_asking_price_median && (
                  <DataItem
                    icon={PoundSterling}
                    label="Asking Price (Median)"
                    value={formatCurrency(property.patma_asking_price_median)}
                    highlight
                  />
                )}
                {property.patma_sold_price_median && (
                  <DataItem
                    icon={PoundSterling}
                    label="Sold Price (Median)"
                    value={formatCurrency(property.patma_sold_price_median)}
                    highlight
                  />
                )}
                {property.patma_asking_price_mean && (
                  <DataItem
                    icon={TrendingUp}
                    label="Asking Price (Mean)"
                    value={formatCurrency(property.patma_asking_price_mean)}
                  />
                )}
                {property.patma_sold_price_mean && (
                  <DataItem
                    icon={TrendingUp}
                    label="Sold Price (Mean)"
                    value={formatCurrency(property.patma_sold_price_mean)}
                  />
                )}
              </div>
              {property.patma_price_data_points && (
                <div className="text-xs text-slate-500 text-center pt-2 border-t border-slate-100">
                  Based on {property.patma_price_data_points} comparable sales
                  {property.patma_search_radius_miles && ` within ${property.patma_search_radius_miles} miles`}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No PaTMa price data yet</p>
          )}
        </DataSection>

        {/* PropertyData HMO Section */}
        <DataSection
          title="HMO Licence Register"
          source="PropertyData"
          icon={Shield}
          isEnriched={hasPropertyData}
          enrichedAt={property.propertydata_enriched_at}
          isExpanded={expandedSections.propertydata}
          onToggle={() => toggleSection("propertydata")}
        >
          {hasPropertyData ? (
            property.hmo_licence_reference ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">Licensed HMO Found</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <DataItem icon={Shield} label="Reference" value={property.hmo_licence_reference} />
                  {property.hmo_licence_type && (
                    <DataItem icon={Building2} label="Type" value={property.hmo_licence_type} />
                  )}
                  {property.hmo_council && (
                    <DataItem icon={MapPin} label="Council" value={property.hmo_council} />
                  )}
                  {property.hmo_licence_expiry && (
                    <DataItem icon={Calendar} label="Expiry" value={formatDate(property.hmo_licence_expiry)} />
                  )}
                  {property.hmo_max_occupancy && (
                    <DataItem icon={BedDouble} label="Max Occupancy" value={property.hmo_max_occupancy.toString()} />
                  )}
                  {property.hmo_sleeping_rooms && (
                    <DataItem icon={BedDouble} label="Sleeping Rooms" value={property.hmo_sleeping_rooms.toString()} />
                  )}
                  {property.hmo_shared_bathrooms && (
                    <DataItem icon={Bath} label="Shared Bathrooms" value={property.hmo_shared_bathrooms.toString()} />
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 text-slate-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">No HMO licence found in national register</span>
                </div>
              </div>
            )
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No HMO register data yet</p>
          )}
        </DataSection>

        {/* Zoopla Section */}
        <DataSection
          title="Market Data"
          source="Zoopla"
          icon={TrendingUp}
          isEnriched={hasZoopla}
          enrichedAt={property.zoopla_enriched_at}
          isExpanded={expandedSections.zoopla}
          onToggle={() => toggleSection("zoopla")}
        >
          {hasZoopla ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {property.zoopla_price_pcm && (
                  <DataItem
                    icon={PoundSterling}
                    label="Rent PCM"
                    value={`${formatCurrency(property.zoopla_price_pcm)}/mo`}
                    highlight
                  />
                )}
                {property.zoopla_area_avg_price && (
                  <DataItem
                    icon={TrendingUp}
                    label="Area Avg Price"
                    value={formatCurrency(property.zoopla_area_avg_price)}
                  />
                )}
                {property.zoopla_zed_index && (
                  <DataItem
                    icon={TrendingUp}
                    label="Zed Index"
                    value={formatCurrency(property.zoopla_zed_index)}
                  />
                )}
                {property.zoopla_days_on_market !== null && (
                  <DataItem
                    icon={Clock}
                    label="Days on Market"
                    value={`${property.zoopla_days_on_market} days`}
                  />
                )}
                {property.zoopla_agent_name && (
                  <DataItem icon={Building2} label="Agent" value={property.zoopla_agent_name} />
                )}
                {property.zoopla_agent_phone && (
                  <DataItem icon={Building2} label="Agent Phone" value={property.zoopla_agent_phone} />
                )}
              </div>
              {property.zoopla_listing_url && (
                <a
                  href={property.zoopla_listing_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-700 pt-2 border-t border-slate-100"
                >
                  View on Zoopla <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No Zoopla data yet</p>
          )}
        </DataSection>

        {/* Info Footer */}
        <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
          Data from StreetData, PaTMa, PropertyData, Zoopla APIs
        </div>
      </CardContent>
    </Card>
  )
}

// Helper Components
function DataSection({
  title,
  source,
  icon: Icon,
  isEnriched,
  enrichedAt,
  isExpanded,
  onToggle,
  children,
}: {
  title: string
  source: string
  icon: any
  isEnriched: boolean
  enrichedAt: string | null
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={cn(
      "rounded-lg border transition-colors",
      isEnriched ? "border-slate-200 bg-white" : "border-dashed border-slate-300 bg-slate-50"
    )}>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isEnriched ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
          )}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-800">{title}</div>
            <div className="text-xs text-slate-500">
              {source}
              {enrichedAt && ` • Updated ${new Date(enrichedAt).toLocaleDateString()}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEnriched ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-slate-400" />
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  )
}

function DataItem({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: any
  label: string
  value: string | null | undefined
  highlight?: boolean
}) {
  if (!value) return null

  return (
    <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
      <Icon className="w-4 h-4 text-slate-400 shrink-0" />
      <div className="min-w-0">
        <div className="text-xs text-slate-500 truncate">{label}</div>
        <div className={cn(
          "text-sm font-medium truncate",
          highlight ? "text-blue-600" : "text-slate-800"
        )}>
          {value}
        </div>
      </div>
    </div>
  )
}
