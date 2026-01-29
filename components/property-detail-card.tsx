"use client"

import { useState, useEffect } from "react"
import {
  BedDouble,
  Bath,
  Wifi,
  Trees,
  TrainFront,
  Users,
  TrendingUp,
  Building2,
  FileText,
  MapPin,
  ExternalLink,
  Phone,
  Mail,
  Shield,
  Home,
  Car,
  PawPrint,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Sofa,
  LayoutGrid,
  Sparkles,
  Copy,
  Check,
  Scale,
  Info,
  Heart,
  Share2,
  Download,
  Calculator,
  ClipboardList,
  FolderOpen,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"
import { EPCBadge } from "@/components/epc-badge"
import { BroadbandBadge } from "@/components/broadband-badge"
import { PremiumYieldCalculator } from "@/components/premium-yield-calculator"
import { AgentContactCard } from "@/components/agent-contact-card"
import { AreaStatisticsCard } from "@/components/area-statistics-card"
import { SoldPriceHistory } from "@/components/sold-price-history"
import { PriceAlertButton } from "@/components/price-alert-button"
import { EpcFloorAreaBadge } from "@/components/epc-floor-area-badge"

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

interface PropertyDetailCardProps {
  property: Property
  onViewFullDetails: () => void
  isPremium?: boolean
  className?: string
}

type TabType = "analysis" | "property" | "compliance" | "documents"

// ═══════════════════════════════════════════════════════════════════════════
// DEAL SCORE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function DealScoreBlock({ score }: { score: number | null }) {
  const getScoreConfig = (s: number | null) => {
    if (!s) return { gradient: "from-slate-400 to-slate-500", label: "N/A" }
    if (s >= 80) return { gradient: "from-emerald-500 to-green-600", label: "Excellent" }
    if (s >= 70) return { gradient: "from-teal-500 to-cyan-600", label: "Great" }
    if (s >= 60) return { gradient: "from-teal-400 to-emerald-500", label: "Good" }
    if (s >= 50) return { gradient: "from-amber-500 to-yellow-600", label: "Fair" }
    if (s >= 40) return { gradient: "from-orange-500 to-amber-600", label: "Below Avg" }
    return { gradient: "from-red-500 to-orange-600", label: "Poor" }
  }

  const config = getScoreConfig(score)

  return (
    <div className="flex flex-col items-center">
      <div className={cn(
        "relative w-[72px] h-[88px] rounded-2xl bg-gradient-to-br flex flex-col items-center justify-center shadow-lg",
        config.gradient
      )}>
        <Sparkles className="absolute -top-1.5 -right-1.5 w-4 h-4 text-white/80" />
        <span className="text-[28px] font-black text-white leading-none">
          {score ?? "—"}
        </span>
        <span className="text-[10px] text-white/80 font-semibold uppercase tracking-wider mt-0.5">
          /100
        </span>
      </div>
      <span className="text-[11px] font-semibold text-slate-600 mt-2">
        {config.label}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// KEY METRIC CARD
// ═══════════════════════════════════════════════════════════════════════════

function KeyMetricCard({
  label,
  value,
  subLabel,
  variant = "neutral",
}: {
  label: string
  value: string
  subLabel?: string
  variant?: "positive" | "negative" | "neutral"
}) {
  const textColor = {
    positive: "text-emerald-600",
    negative: "text-red-600",
    neutral: "text-slate-900",
  }

  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
      <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <p className={cn("text-[18px] font-bold leading-tight", textColor[variant])}>
        {value}
      </p>
      {subLabel && (
        <p className="text-[10px] text-slate-400 mt-0.5">{subLabel}</p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// AMENITY ICON
// ═══════════════════════════════════════════════════════════════════════════

function AmenityIcon({
  icon: Icon,
  label,
}: {
  icon: React.ElementType
  label: string
}) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 hover:bg-teal-50 transition-colors group">
      <Icon className="w-5 h-5 text-slate-500 group-hover:text-teal-600 mb-1.5" />
      <span className="text-[10px] text-slate-600 text-center leading-tight">{label}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function PropertyDetailCard({
  property,
  onViewFullDetails,
  isPremium = false,
  className,
}: PropertyDetailCardProps) {
  const [activeTab, setActiveTab] = useState<TabType>("analysis")
  const [copiedCompanyNumber, setCopiedCompanyNumber] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const [showFullDescription, setShowFullDescription] = useState(false)

  // Scroll detection for sticky bar shadow
  useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement
      setIsScrolled(target.scrollTop > 50)
    }
    const container = document.querySelector('[data-property-detail-scroll]')
    container?.addEventListener('scroll', handleScroll)
    return () => container?.removeEventListener('scroll', handleScroll)
  }, [])

  // Calculate metrics
  const monthlyRent = property.listing_type === "purchase"
    ? property.estimated_rent_per_room
      ? property.estimated_rent_per_room * property.bedrooms
      : null
    : property.price_pcm

  const grossYield = (() => {
    if (property.listing_type !== "purchase" || !property.purchase_price || !monthlyRent) return null
    const annualRent = monthlyRent * 12
    return ((annualRent / property.purchase_price) * 100).toFixed(1)
  })()

  // Estimate net yield (gross - ~30% for costs)
  const netYield = grossYield ? (parseFloat(grossYield) * 0.7).toFixed(1) : null

  // Estimate cash-on-cash (assuming 75% LTV)
  const cashOnCash = (() => {
    if (!property.purchase_price || !monthlyRent) return null
    const deposit = property.purchase_price * 0.25
    const annualRent = monthlyRent * 12
    const annualCosts = annualRent * 0.3
    const mortgageAmount = property.purchase_price * 0.75
    const annualMortgage = mortgageAmount * 0.055 // 5.5% rate
    const cashflow = annualRent - annualCosts - annualMortgage
    return ((cashflow / deposit) * 100).toFixed(1)
  })()

  // Monthly cashflow estimate
  const monthlyCashflow = (() => {
    if (!property.purchase_price || !monthlyRent) return null
    const annualRent = monthlyRent * 12
    const annualCosts = annualRent * 0.3
    const mortgageAmount = property.purchase_price * 0.75
    const annualMortgage = mortgageAmount * 0.055
    const cashflow = annualRent - annualCosts - annualMortgage
    return Math.round(cashflow / 12)
  })()

  // Licence status
  const getLicenceStatusConfig = () => {
    switch (property.licence_status) {
      case "active":
        return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "Active" }
      case "pending":
        return { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Pending" }
      case "expired":
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Expired" }
      default:
        return { icon: AlertCircle, color: "text-slate-400", bg: "bg-slate-50", border: "border-slate-200", label: "Unknown" }
    }
  }

  const licenceStatus = getLicenceStatusConfig()

  // Amenities
  const amenities = [
    { icon: Wifi, label: "WiFi", available: property.wifi_included },
    { icon: Trees, label: "Garden", available: property.has_garden },
    { icon: TrainFront, label: "Near Tube", available: property.near_tube_station },
    { icon: Car, label: "Parking", available: property.has_parking },
    { icon: PawPrint, label: "Pets OK", available: property.is_pet_friendly },
    { icon: GraduationCap, label: "Students", available: property.is_student_friendly },
    { icon: Sofa, label: "Furnished", available: property.is_furnished },
  ].filter(a => a.available)

  const copyCompanyNumber = () => {
    if (property.company_number) {
      navigator.clipboard.writeText(property.company_number)
      setCopiedCompanyNumber(true)
      setTimeout(() => setCopiedCompanyNumber(false), 2000)
    }
  }

  // Tabs configuration
  const tabs: { id: TabType; label: string; icon: React.ElementType }[] = [
    { id: "analysis", label: "Analysis", icon: Calculator },
    { id: "property", label: "Property", icon: Home },
    { id: "compliance", label: "Compliance", icon: ClipboardList },
    { id: "documents", label: "Documents", icon: FolderOpen },
  ]

  return (
    <div className={cn("flex flex-col h-full bg-white", className)} data-property-detail-scroll>
      {/* ═══════════════════════════════════════════════════════════════════
          STICKY ACTION BAR
      ═══════════════════════════════════════════════════════════════════ */}
      <div className={cn(
        "sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b transition-shadow duration-200",
        isScrolled ? "shadow-md border-slate-200" : "border-slate-100"
      )}>
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <PriceAlertButton property={property} variant="icon" />
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <Share2 className="w-4 h-4 text-slate-500" />
            </Button>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
              <Download className="w-4 h-4 text-slate-500" />
            </Button>
          </div>
          {property.listing_type === "purchase" && (
            <Button
              size="sm"
              className="h-10 px-5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-semibold shadow-lg shadow-teal-500/25"
            >
              <Phone className="w-4 h-4 mr-2" />
              Contact Seller
            </Button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="px-5 py-6 border-b border-slate-100">
        <div className="flex gap-5">
          {/* Deal Score */}
          <DealScoreBlock score={property.deal_score} />

          {/* Key Metrics Grid */}
          <div className="flex-1 grid grid-cols-3 gap-2">
            <KeyMetricCard
              label="Net Yield"
              value={netYield ? `${netYield}%` : "—"}
              subLabel="After costs"
              variant={netYield && parseFloat(netYield) >= 6 ? "positive" : netYield && parseFloat(netYield) < 4 ? "negative" : "neutral"}
            />
            <KeyMetricCard
              label="Cash-on-Cash"
              value={cashOnCash ? `${cashOnCash}%` : "—"}
              subLabel="ROI on deposit"
              variant={cashOnCash && parseFloat(cashOnCash) >= 10 ? "positive" : cashOnCash && parseFloat(cashOnCash) < 0 ? "negative" : "neutral"}
            />
            <KeyMetricCard
              label="Cashflow"
              value={monthlyCashflow !== null ? `${monthlyCashflow >= 0 ? '+' : ''}£${monthlyCashflow.toLocaleString()}` : "—"}
              subLabel="Per month"
              variant={monthlyCashflow !== null && monthlyCashflow >= 0 ? "positive" : "negative"}
            />
          </div>
        </div>

        {/* Price & Specs */}
        <div className="mt-5">
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] font-black text-slate-900">
              £{property.listing_type === "purchase"
                ? property.purchase_price?.toLocaleString()
                : property.price_pcm?.toLocaleString()}
            </span>
            <span className="text-[13px] text-slate-500">
              {property.listing_type === "purchase" ? "asking price" : "per month"}
            </span>
          </div>

          {/* Spec Line */}
          <div className="flex items-center gap-1.5 mt-2 text-[13px] text-slate-600">
            <span className="flex items-center gap-1">
              <BedDouble className="w-3.5 h-3.5" /> {property.bedrooms}
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" /> {property.bathrooms}
            </span>
            {property.gross_internal_area_sqm && (
              <>
                <span className="text-slate-300">·</span>
                <span>{Math.round(property.gross_internal_area_sqm)}m²</span>
              </>
            )}
            {property.epc_rating && (
              <>
                <span className="text-slate-300">·</span>
                <EPCBadge rating={property.epc_rating} numericRating={property.epc_rating_numeric} className="text-[11px]" />
              </>
            )}
          </div>

          {/* Status Badges */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {property.licensed_hmo && (
              <Badge className="h-6 px-2 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Shield className="w-3 h-3 mr-1" />
                Licensed HMO
              </Badge>
            )}
            {property.licence_status === "expired" && (
              <Badge className="h-6 px-2 text-[11px] bg-amber-50 text-amber-700 border border-amber-200">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Expired Licence
              </Badge>
            )}
            {property.article_4_area && (
              <Badge className="h-6 px-2 text-[11px] bg-purple-50 text-purple-700 border border-purple-200">
                <AlertCircle className="w-3 h-3 mr-1" />
                Article 4
              </Badge>
            )}
            {(property.has_fiber || property.has_superfast) && (
              <BroadbandBadge
                hasFiber={property.has_fiber}
                hasSuperfast={property.has_superfast}
                maxDownload={property.broadband_max_down}
                size="sm"
              />
            )}
          </div>

          {/* Address */}
          <div className="flex items-start gap-2 mt-4">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[14px] font-medium text-slate-800">{property.address}</p>
              <p className="text-[13px] text-slate-500">{property.postcode}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB BAR
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="px-3 py-2 bg-slate-50 border-b border-slate-200">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all",
                activeTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:bg-slate-100"
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB CONTENT
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto p-5 pb-20 space-y-4">

        {/* ANALYSIS TAB */}
        {activeTab === "analysis" && (
          <>
            {/* Yield Calculator */}
            <PremiumYieldCalculator property={property} isPremium={isPremium} />

            {/* Area Statistics */}
            <AreaStatisticsCard postcode={property.postcode} />

            {/* Sold Price History */}
            <SoldPriceHistory
              postcode={property.postcode}
              currentPrice={property.purchase_price || property.price_pcm || undefined}
            />
          </>
        )}

        {/* PROPERTY TAB */}
        {activeTab === "property" && (
          <>
            {/* Amenities Grid */}
            {amenities.length > 0 && (
              <div className="p-4 bg-white rounded-xl border border-slate-100">
                <h3 className="text-[13px] font-semibold text-slate-800 mb-3">Amenities & Features</h3>
                <div className="grid grid-cols-4 gap-2">
                  {amenities.slice(0, 8).map((amenity, idx) => (
                    <AmenityIcon key={idx} icon={amenity.icon} label={amenity.label} />
                  ))}
                </div>
              </div>
            )}

            {/* Floor Plans */}
            <div className="p-4 bg-white rounded-xl border border-slate-100">
              <h3 className="text-[13px] font-semibold text-slate-800 mb-3">Floor Plans</h3>
              {property.floor_plans && property.floor_plans.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {property.floor_plans.map((plan, idx) => (
                    <a
                      key={idx}
                      href={plan}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-teal-500 hover:ring-offset-2 transition-all bg-slate-100 flex items-center justify-center"
                    >
                      <LayoutGrid className="w-8 h-8 text-slate-400" />
                    </a>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-400">
                  <LayoutGrid className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-[13px]">No floor plans available</p>
                </div>
              )}
            </div>

            {/* Description */}
            {property.description && (
              <div className="p-4 bg-white rounded-xl border border-slate-100">
                <h3 className="text-[13px] font-semibold text-slate-800 mb-3">Description</h3>
                <p className="text-[13px] leading-relaxed text-slate-700">
                  {showFullDescription || property.description.length <= 200
                    ? property.description
                    : `${property.description.slice(0, 200)}...`}
                </p>
                {property.description.length > 200 && (
                  <button
                    onClick={() => setShowFullDescription(!showFullDescription)}
                    className="text-[12px] text-teal-600 font-medium mt-2 hover:text-teal-700"
                  >
                    {showFullDescription ? "Show less" : "Read more"}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* COMPLIANCE TAB */}
        {activeTab === "compliance" && (
          <>
            {/* Licence Status Banner */}
            {property.licensed_hmo && (
              <div className={cn(
                "p-4 rounded-xl border",
                licenceStatus.bg,
                licenceStatus.border
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg bg-white border", licenceStatus.border)}>
                      <licenceStatus.icon className={cn("w-5 h-5", licenceStatus.color)} />
                    </div>
                    <div>
                      <p className={cn("text-[15px] font-bold", licenceStatus.color)}>
                        Licence {licenceStatus.label}
                      </p>
                      {property.licence_end_date && (
                        <p className="text-[12px] text-slate-600">
                          {property.licence_status === "expired" ? "Expired" : "Valid until"}{" "}
                          {new Date(property.licence_end_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Licence Details */}
                {(property.licence_id || property.max_occupants) && (
                  <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-200/50">
                    {property.licence_id && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Licence #</p>
                        <code className="text-[12px] font-mono font-medium text-slate-800">{property.licence_id}</code>
                      </div>
                    )}
                    {property.max_occupants && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-slate-500">Max Occupants</p>
                        <p className="text-[15px] font-bold text-slate-900">{property.max_occupants}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Licensing Requirements */}
            <div className="p-4 bg-white rounded-xl border border-slate-100">
              <h3 className="text-[13px] font-semibold text-slate-800 mb-3">Licensing Requirements</h3>

              {/* Compliance Alert */}
              <div className={cn(
                "flex items-start gap-3 p-3 rounded-lg mb-4",
                property.compliance_complexity === "high" ? "bg-red-50 border border-red-200" :
                property.compliance_complexity === "medium" ? "bg-amber-50 border border-amber-200" :
                "bg-emerald-50 border border-emerald-200"
              )}>
                {property.compliance_complexity === "high" ? (
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                ) : property.compliance_complexity === "medium" ? (
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                )}
                <p className={cn(
                  "text-[12px] font-medium",
                  property.compliance_complexity === "high" ? "text-red-700" :
                  property.compliance_complexity === "medium" ? "text-amber-700" :
                  "text-emerald-700"
                )}>
                  {property.compliance_complexity === "high" ? "Multiple licensing schemes may apply" :
                   property.compliance_complexity === "medium" ? "Licensing may be required" :
                   "Standard regulations apply"}
                </p>
              </div>

              {/* Thresholds */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-[12px] font-medium text-slate-700">Mandatory</span>
                  </div>
                  <span className="text-[11px] text-slate-500">5+ people, 2+ households</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    <span className="text-[12px] font-medium text-slate-700">Additional</span>
                  </div>
                  <span className="text-[11px] text-slate-500">3+ people, 2+ households</span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-[12px] font-medium text-slate-700">Selective</span>
                  </div>
                  <span className="text-[11px] text-slate-500">All private rentals in area</span>
                </div>
              </div>
            </div>

            {/* Article 4 Alert */}
            {property.article_4_area && (
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-purple-600 flex-shrink-0" />
                  <div>
                    <p className="text-[13px] font-semibold text-purple-800">Article 4 Direction Applies</p>
                    <p className="text-[12px] text-purple-600 mt-1">
                      Planning permission required to change property use to HMO in this area.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === "documents" && (
          <>
            {/* EPC Certificate */}
            <div className="p-4 bg-white rounded-xl border border-slate-100">
              <h3 className="text-[13px] font-semibold text-slate-800 mb-3">EPC Certificate</h3>
              {property.epc_rating ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-[12px] font-medium text-slate-600">Energy Rating</span>
                    <EPCBadge rating={property.epc_rating} numericRating={property.epc_rating_numeric} />
                  </div>
                  {property.gross_internal_area_sqm && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-[12px] font-medium text-slate-600">Floor Area</span>
                      <span className="text-[14px] font-bold text-slate-900">
                        {Math.round(property.gross_internal_area_sqm)}m²
                      </span>
                    </div>
                  )}
                  {property.epc_expiry_date && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-[12px] font-medium text-slate-600">Expiry</span>
                      <span className={cn(
                        "text-[12px] font-medium",
                        new Date(property.epc_expiry_date) < new Date() ? "text-red-600" : "text-slate-900"
                      )}>
                        {new Date(property.epc_expiry_date).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                  )}
                  {property.epc_certificate_url && property.epc_certificate_url !== "not_available" && (
                    <a
                      href={property.epc_certificate_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[12px] text-blue-600 font-medium hover:text-blue-700"
                    >
                      <FileText className="w-4 h-4" />
                      View full certificate
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="py-6 text-center text-slate-400">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-[13px]">No EPC data available</p>
                </div>
              )}
            </div>

            {/* Ownership Info */}
            {(property.owner_name || property.company_name) && (
              <div className="p-4 bg-white rounded-xl border border-slate-100">
                <h3 className="text-[13px] font-semibold text-slate-800 mb-3">Ownership Information</h3>
                {property.company_name ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg">
                          <Building2 className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Company</p>
                          <p className="text-[13px] font-semibold text-slate-900">{property.company_name}</p>
                        </div>
                      </div>
                      {property.company_status && (
                        <Badge className={cn(
                          "h-5 text-[10px]",
                          property.company_status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        )}>
                          {property.company_status}
                        </Badge>
                      )}
                    </div>
                    {property.company_number && (
                      <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                        <code className="flex-1 text-[12px] font-mono">{property.company_number}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={copyCompanyNumber}
                        >
                          {copiedCompanyNumber ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <a
                          href={`https://find-and-update.company-information.service.gov.uk/company/${property.company_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </a>
                      </div>
                    )}
                    {/* Directors */}
                    {property.directors && property.directors.length > 0 && (
                      <div className="pt-3 border-t border-slate-100">
                        <p className="text-[10px] uppercase tracking-wide text-slate-500 mb-2">Directors</p>
                        <div className="space-y-2">
                          {property.directors.slice(0, 3).map((director, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">
                                  {director?.name?.charAt(0) || "?"}
                                </div>
                                <span className="text-[12px] font-medium text-slate-700">{director?.name}</span>
                              </div>
                              <span className="text-[10px] text-slate-500">{director?.role || "Director"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Owner Name</p>
                    <p className="text-[14px] font-semibold text-slate-900">{property.owner_name}</p>
                  </div>
                )}
              </div>
            )}

            {/* Agent Contact */}
            <AgentContactCard property={property} />
          </>
        )}

        {/* View Full Details Button */}
        <div className="pt-4">
          <Button
            variant="outline"
            onClick={onViewFullDetails}
            className="w-full h-11 border-2 border-slate-200 hover:border-teal-300 hover:bg-teal-50 font-semibold"
          >
            View Full Details
            <ChevronDown className="w-4 h-4 ml-2 -rotate-90" />
          </Button>
        </div>

        {/* Source Link */}
        {property.source_url && (
          <div className="flex justify-center pt-2">
            <a
              href={property.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-slate-500 hover:text-teal-600 transition-colors font-medium"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View original listing
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
