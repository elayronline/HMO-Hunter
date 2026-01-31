"use client"

import { useState, useEffect, useCallback } from "react"
import {
  BedDouble,
  Bath,
  Wifi,
  Trees,
  TrainFront,
  Building2,
  MapPin,
  ExternalLink,
  Phone,
  Shield,
  Car,
  PawPrint,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Sofa,
  LayoutGrid,
  Copy,
  Check,
  Info,
  Share2,
  ChevronRight,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"
import { EPCBadge } from "@/components/epc-badge"
import { PremiumYieldCalculator } from "@/components/premium-yield-calculator"
import { AgentContactCard } from "@/components/agent-contact-card"
import { AreaStatisticsCard } from "@/components/area-statistics-card"
import { SoldPriceHistory } from "@/components/sold-price-history"
import { KammaComplianceCard } from "@/components/kamma-compliance-card"
import { LicenceDetailsCard } from "@/components/licence-details-card"
import { DataEnrichmentCard } from "@/components/data-enrichment-card"
import { EnrichedDataDisplay } from "@/components/enriched-data-display"
import { SavePropertyButton } from "@/components/save-property-button"
import { toast } from "sonner"

// ═══════════════════════════════════════════════════════════════════════════
// SPACING CONSTANTS (4px base)
// ═══════════════════════════════════════════════════════════════════════════
// 4px = gap-1, p-1
// 8px = gap-2, p-2
// 12px = gap-3, p-3
// 16px = gap-4, p-4

interface PropertyDetailCardProps {
  property: Property
  onViewFullDetails: () => void
  isPremium?: boolean
  isSaved?: boolean
  className?: string
}

type TabType = "analysis" | "details" | "compliance"

export function PropertyDetailCard({
  property,
  onViewFullDetails,
  isPremium = false,
  isSaved = false,
  className,
}: PropertyDetailCardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("analysis")
  const [copiedCompanyNumber, setCopiedCompanyNumber] = useState(false)
  const [isEnriching, setIsEnriching] = useState(false)
  const [enrichedProperty, setEnrichedProperty] = useState<Property>(property)

  // Auto-enrich property data when viewed
  useEffect(() => {
    const shouldEnrich = () => {
      // Check if any enrichment is missing or stale (> 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const needsStreetData = !property.streetdata_enriched_at || property.streetdata_enriched_at < sevenDaysAgo
      const needsPaTMa = !property.patma_enriched_at || property.patma_enriched_at < sevenDaysAgo
      const needsPropertyData = !property.propertydata_enriched_at || property.propertydata_enriched_at < sevenDaysAgo
      return needsStreetData || needsPaTMa || needsPropertyData
    }

    const enrichProperty = async () => {
      if (!shouldEnrich() || isEnriching) return

      setIsEnriching(true)
      try {
        const response = await fetch("/api/enrich-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyIds: [property.id] }),
        })

        if (response.ok) {
          // Fetch updated property data
          const updatedResponse = await fetch(`/api/property/${property.id}`)
          if (updatedResponse.ok) {
            const data = await updatedResponse.json()
            if (data.property) {
              setEnrichedProperty(data.property)
            }
          }
        }
      } catch (error) {
        console.error("Auto-enrichment failed:", error)
      } finally {
        setIsEnriching(false)
      }
    }

    enrichProperty()
  }, [property.id])

  // Use enriched property data for display
  const displayProperty = enrichedProperty

  // Share handler
  const handleShare = async () => {
    const url = property.source_url || window.location.href

    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied to clipboard!")
      // Also show alert as backup visual feedback
      console.log("[Share] Copied:", url)
    } catch (error) {
      console.error("[Share] Failed:", error)
      toast.error("Failed to copy link")
      // Show alert as fallback
      alert(`Copy this link:\n${url}`)
    }
  }

  // Calculations
  const monthlyRent = property.listing_type === "purchase"
    ? (property.estimated_rent_per_room ? property.estimated_rent_per_room * property.bedrooms : null)
    : property.price_pcm

  const grossYield = (() => {
    if (property.listing_type !== "purchase" || !property.purchase_price || !monthlyRent) return null
    return ((monthlyRent * 12 / property.purchase_price) * 100).toFixed(1)
  })()

  const netYield = grossYield ? (parseFloat(grossYield) * 0.7).toFixed(1) : null

  const monthlyCashflow = (() => {
    if (!property.purchase_price || !monthlyRent) return null
    const annualRent = monthlyRent * 12
    const costs = annualRent * 0.3
    const mortgage = property.purchase_price * 0.75 * 0.055
    return Math.round((annualRent - costs - mortgage) / 12)
  })()

  const licenceConfigs: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; label: string }> = {
    active: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Active" },
    pending: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", label: "Pending" },
    expired: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Expired" },
  }
  const licenceConfig = licenceConfigs[property.licence_status || ""] || { icon: AlertCircle, color: "text-slate-400", bg: "bg-slate-50", label: "Unknown" }

  const amenities = [
    { icon: Wifi, label: "WiFi", show: property.wifi_included },
    { icon: Trees, label: "Garden", show: property.has_garden },
    { icon: TrainFront, label: "Tube", show: property.near_tube_station },
    { icon: Car, label: "Parking", show: property.has_parking },
    { icon: PawPrint, label: "Pets", show: property.is_pet_friendly },
    { icon: GraduationCap, label: "Students", show: property.is_student_friendly },
    { icon: Sofa, label: "Furnished", show: property.is_furnished },
  ].filter(a => a.show)

  const copyCompanyNumber = () => {
    if (property.company_number) {
      navigator.clipboard.writeText(property.company_number)
      setCopiedCompanyNumber(true)
      setTimeout(() => setCopiedCompanyNumber(false), 2000)
    }
  }

  return (
    <div className={cn("flex flex-col h-full bg-white", className)}>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 p-4 border-b border-slate-200">

        {/* Row 1: Price + Deal Score */}
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {(() => {
                const price = property.listing_type === "purchase" ? property.purchase_price : property.price_pcm
                return price ? `£${price.toLocaleString()}` : "Price on application"
              })()}
            </span>
            <span className="text-sm text-slate-500">
              {property.listing_type === "purchase" ? "asking" : "/mo"}
            </span>
          </div>
          {property.deal_score && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-sm font-bold",
              property.deal_score >= 70 ? "bg-emerald-100 text-emerald-700" :
              property.deal_score >= 50 ? "bg-amber-100 text-amber-700" :
              "bg-red-100 text-red-700"
            )}>
              <Zap className="w-3.5 h-3.5" />
              {property.deal_score}
            </div>
          )}
        </div>

        {/* Row 2: Address */}
        <div className="flex items-center gap-2 mt-3">
          <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
          <p className="text-sm text-slate-700 truncate">{property.address}, {property.postcode}</p>
        </div>

        {/* Row 3: Specs */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <BedDouble className="w-4 h-4 text-slate-400" />
            <span>{property.bedrooms}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <Bath className="w-4 h-4 text-slate-400" />
            <span>{property.bathrooms}</span>
          </div>
          {property.gross_internal_area_sqm && (
            <span className="text-sm text-slate-600">{Math.round(property.gross_internal_area_sqm)}m²</span>
          )}
          {property.epc_rating && (
            <EPCBadge rating={property.epc_rating} numericRating={property.epc_rating_numeric} className="text-xs" />
          )}
        </div>

        {/* Row 4: Tags */}
        <div className="flex flex-wrap gap-2 mt-3" role="list" aria-label="Property status tags">
          {property.licensed_hmo && (
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs font-medium bg-emerald-50 text-emerald-700" role="listitem">
              <Shield className="w-3 h-3" aria-hidden="true" /> Licensed
            </span>
          )}
          {property.licence_status === "expired" && (
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs font-medium bg-amber-50 text-amber-700" role="listitem">
              <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Expired Licence
            </span>
          )}
          {property.article_4_area && (
            <span className="inline-flex items-center gap-1 h-6 px-2 rounded text-xs font-medium bg-purple-50 text-purple-700" role="listitem">
              <AlertCircle className="w-3 h-3" aria-hidden="true" /> Article 4 Area
            </span>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          METRICS BAR
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50">
        {[
          { label: "Net Yield", value: netYield ? `${netYield}%` : "—", positive: netYield && parseFloat(netYield) >= 6 },
          { label: "Gross Yield", value: grossYield ? `${grossYield}%` : "—", positive: null },
          { label: "Cashflow", value: monthlyCashflow !== null ? `${monthlyCashflow >= 0 ? '+' : ''}£${monthlyCashflow}` : "—", positive: monthlyCashflow !== null && monthlyCashflow >= 0 },
        ].map((metric, i) => (
          <div key={i} className="py-3 text-center">
            <p className="text-xs text-slate-500">{metric.label}</p>
            <p className={cn(
              "text-base font-bold mt-1",
              metric.positive === true ? "text-emerald-600" :
              metric.positive === false ? "text-red-600" :
              "text-slate-900"
            )}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TABS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 grid grid-cols-3 border-b border-slate-200" role="tablist">
        {[
          { id: "analysis" as TabType, label: "Analysis" },
          { id: "details" as TabType, label: "Details" },
          { id: "compliance" as TabType, label: "Compliance" },
        ].map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "py-3 text-sm font-medium text-center transition-colors relative",
              activeTab === tab.id ? "text-teal-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-teal-600 rounded-full" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CONTENT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">

          {/* ANALYSIS TAB */}
          {activeTab === "analysis" && (
            <>
              <PremiumYieldCalculator property={property} isPremium={isPremium} />
              <AreaStatisticsCard postcode={property.postcode} />
              <SoldPriceHistory postcode={property.postcode} currentPrice={property.purchase_price || property.price_pcm || undefined} />
            </>
          )}

          {/* DETAILS TAB */}
          {activeTab === "details" && (
            <>
              {/* Features */}
              {amenities.length > 0 && (
                <Section title="Features">
                  <div className="flex flex-wrap gap-2">
                    {amenities.map((a, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 h-8 px-3 bg-white rounded-lg text-sm text-slate-700 border border-slate-200">
                        <a.icon className="w-4 h-4 text-teal-600" />
                        {a.label}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {/* Floor Plans */}
              <Section title="Floor Plans">
                {property.floor_plans && property.floor_plans.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {property.floor_plans.map((plan, idx) => (
                      <a
                        key={idx}
                        href={plan}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="aspect-video bg-white rounded-lg border border-slate-200 flex items-center justify-center hover:border-teal-400 transition-colors"
                      >
                        <LayoutGrid className="w-6 h-6 text-slate-300" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-6">No floor plans available</p>
                )}
              </Section>

              {/* EPC */}
              {property.epc_rating && (
                <Section title="Energy Performance">
                  <Row label="Rating" value={<EPCBadge rating={property.epc_rating} numericRating={property.epc_rating_numeric} />} />
                  {property.gross_internal_area_sqm && (
                    <Row label="Floor Area" value={`${Math.round(property.gross_internal_area_sqm)}m²`} />
                  )}
                  {property.epc_certificate_url && property.epc_certificate_url !== "not_available" && (
                    <a
                      href={property.epc_certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-teal-600 font-medium mt-2 hover:text-teal-700"
                    >
                      View certificate <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </Section>
              )}

              {/* Ownership - Premium Feature */}
              {(property.owner_name || property.company_name) && (
                <Section title="Ownership">
                  {isPremium ? (
                    property.company_name ? (
                      <>
                        <Row
                          label="Company"
                          value={
                            <span className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-slate-400" />
                              {property.company_name}
                            </span>
                          }
                        />
                        {property.company_number && (
                          <div className="flex items-center gap-2 h-10 px-3 bg-white rounded-lg border border-slate-200 mt-2">
                            <code className="text-sm text-slate-600 flex-1">{property.company_number}</code>
                            <button
                              onClick={copyCompanyNumber}
                              className="text-slate-400 hover:text-slate-600"
                              aria-label={copiedCompanyNumber ? "Company number copied" : "Copy company number"}
                            >
                              {copiedCompanyNumber ? <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <Row label="Owner" value={property.owner_name} />
                    )
                  ) : (
                    <div className="text-center py-3">
                      <div className="flex items-center justify-center gap-2 text-amber-600 mb-2">
                        <Shield className="w-4 h-4" />
                        <span className="text-sm font-medium">Premium Feature</span>
                      </div>
                      <p className="text-xs text-slate-500">Upgrade to see owner details</p>
                    </div>
                  )}
                </Section>
              )}

              <AgentContactCard property={property} />

              {/* Enriched Data from APIs - auto-loads when property is viewed */}
              <EnrichedDataDisplay property={displayProperty} isLoading={isEnriching} />
            </>
          )}

          {/* COMPLIANCE TAB */}
          {activeTab === "compliance" && (
            <>
              {/* Licence Status */}
              {property.licensed_hmo && (
                <div className={cn("rounded-lg p-4", licenceConfig.bg)}>
                  <div className="flex items-center gap-3">
                    <licenceConfig.icon className={cn("w-5 h-5 shrink-0", licenceConfig.color)} />
                    <div className="min-w-0">
                      <p className={cn("text-sm font-semibold", licenceConfig.color)}>
                        Licence {licenceConfig.label}
                      </p>
                      {property.licence_end_date && (
                        <p className="text-xs text-slate-600 mt-1">
                          {property.licence_status === "expired" ? "Expired" : "Valid until"}{" "}
                          {new Date(property.licence_end_date).toLocaleDateString("en-GB")}
                        </p>
                      )}
                    </div>
                  </div>
                  {(property.licence_id || property.max_occupants) && (
                    <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-black/10">
                      {property.licence_id && (
                        <div>
                          <p className="text-xs text-slate-500">Licence #</p>
                          <p className="text-sm font-mono font-medium text-slate-800 mt-1">{property.licence_id}</p>
                        </div>
                      )}
                      {property.max_occupants && (
                        <div>
                          <p className="text-xs text-slate-500">Max Occupants</p>
                          <p className="text-sm font-bold text-slate-900 mt-1">{property.max_occupants}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Thresholds */}
              <Section title="HMO Licensing Thresholds">
                <div className="space-y-2">
                  {[
                    { color: "bg-red-500", label: "Mandatory", desc: "5+ people, 2+ households" },
                    { color: "bg-amber-500", label: "Additional", desc: "3+ people, 2+ households" },
                    { color: "bg-blue-500", label: "Selective", desc: "All rentals in area" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between h-10 px-3 bg-white rounded-lg border border-slate-200">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", item.color)} />
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      </div>
                      <span className="text-xs text-slate-500">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Article 4 */}
              {property.article_4_area && (
                <div className="rounded-lg p-4 bg-purple-50">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-purple-600 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-purple-800">Article 4 Direction</p>
                      <p className="text-xs text-purple-600 mt-1">Planning permission required for HMO use.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Complexity */}
              <div className={cn(
                "rounded-lg p-4",
                property.compliance_complexity === "high" ? "bg-red-50" :
                property.compliance_complexity === "medium" ? "bg-amber-50" : "bg-emerald-50"
              )}>
                <div className="flex items-center gap-3">
                  {property.compliance_complexity === "high" ? (
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  ) : property.compliance_complexity === "medium" ? (
                    <Info className="w-5 h-5 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  )}
                  <div>
                    <p className={cn(
                      "text-sm font-semibold",
                      property.compliance_complexity === "high" ? "text-red-800" :
                      property.compliance_complexity === "medium" ? "text-amber-800" : "text-emerald-800"
                    )}>
                      {property.compliance_complexity === "high" ? "High Complexity" :
                       property.compliance_complexity === "medium" ? "Medium Complexity" : "Low Complexity"}
                    </p>
                    <p className={cn(
                      "text-xs mt-1",
                      property.compliance_complexity === "high" ? "text-red-600" :
                      property.compliance_complexity === "medium" ? "text-amber-600" : "text-emerald-600"
                    )}>
                      {property.compliance_complexity === "high" ? "Multiple licensing schemes may apply" :
                       property.compliance_complexity === "medium" ? "Licensing may be required" :
                       "Standard regulations apply"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Kamma Compliance Check - Real-time API */}
              <KammaComplianceCard postcode={property.postcode} address={property.address} uprn={property.uprn || undefined} />

              {/* Licence Details from Council Register */}
              <LicenceDetailsCard propertyId={property.id} />

              {/* On-demand Data Enrichment */}
              <DataEnrichmentCard property={property} isPremium={isPremium} />
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 p-4 border-t border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2">
          {property.listing_type === "purchase" && (
            <Button
              className="flex-1 min-w-[120px] h-10 bg-teal-600 hover:bg-teal-700 text-white font-medium"
              aria-label="Book a viewing for this property"
              onClick={() => {
                // Priority: agent phone > source URL > alert
                if (property.agent_phone) {
                  window.location.href = `tel:${property.agent_phone}`
                } else if (property.source_url) {
                  window.open(property.source_url, '_blank', 'noopener,noreferrer')
                } else if (property.zoopla_listing_url) {
                  window.open(property.zoopla_listing_url, '_blank', 'noopener,noreferrer')
                } else {
                  alert('Viewing booking not available. Try viewing the original listing.')
                }
              }}
            >
              <Phone className="w-4 h-4 mr-2" aria-hidden="true" />
              Book Viewing
            </Button>
          )}
          <Button variant="outline" onClick={onViewFullDetails} className="flex-1 min-w-[120px] h-10 font-medium" aria-label="View full property details">
            Full Details
            <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleShare}
            aria-label="Share property"
          >
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
        {property.source_url && (
          <a
            href={property.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-teal-600 mt-3"
          >
            View listing <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between h-10">
      <span className="text-sm text-slate-600">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  )
}
