"use client"

import { useState } from "react"
import {
  BedDouble,
  Bath,
  Wifi,
  Trees,
  TrainFront,
  PoundSterling,
  Users,
  TrendingUp,
  ChevronDown,
  Building2,
  FileText,
  Calculator,
  MapPin,
  ExternalLink,
  Phone,
  Mail,
  Shield,
  Star,
  Zap,
  Home,
  Car,
  PawPrint,
  GraduationCap,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Sofa,
  LayoutGrid,
  Sparkles,
  Crown,
  Copy,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"
import { EPCBadge } from "@/components/epc-badge"
import { BroadbandBadge } from "@/components/broadband-badge"

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════

interface PropertyDetailCardProps {
  property: Property
  onViewFullDetails: () => void
  isPremium?: boolean
  className?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// COLLAPSIBLE SECTION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  badge,
  badgeVariant = "default",
  children,
}: {
  title: string
  icon: React.ElementType
  defaultOpen?: boolean
  badge?: string
  badgeVariant?: "default" | "success" | "warning" | "danger"
  children: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const badgeColors = {
    default: "bg-slate-100 text-slate-600 border-slate-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center justify-between p-4 rounded-2xl transition-all duration-300 group",
          isOpen
            ? "bg-gradient-to-r from-slate-50 to-slate-100/50 shadow-sm"
            : "bg-white hover:bg-slate-50 border border-transparent hover:border-slate-200"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl transition-all duration-300 shadow-sm",
              isOpen
                ? "bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-500/25"
                : "bg-white border border-slate-200 group-hover:border-teal-200 group-hover:bg-teal-50"
            )}>
              <Icon className={cn(
                "w-4 h-4 transition-colors",
                isOpen ? "text-white" : "text-slate-500 group-hover:text-teal-600"
              )} />
            </div>
            <span className={cn(
              "font-semibold transition-colors",
              isOpen ? "text-slate-900" : "text-slate-700"
            )}>
              {title}
            </span>
            {badge && (
              <span className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium border",
                badgeColors[badgeVariant]
              )}>
                {badge}
              </span>
            )}
          </div>
          <div className={cn(
            "p-1.5 rounded-full transition-all duration-300",
            isOpen
              ? "bg-teal-100 rotate-180"
              : "bg-slate-100 group-hover:bg-teal-50"
          )}>
            <ChevronDown className={cn(
              "w-4 h-4 transition-colors",
              isOpen ? "text-teal-600" : "text-slate-400"
            )} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp">
        <div className="pt-3 pb-1 px-1">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO METRIC PILL COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function HeroMetricPill({
  icon: Icon,
  value,
  label,
  variant = "default",
}: {
  icon: React.ElementType
  value: string | number
  label: string
  variant?: "default" | "highlight" | "premium"
}) {
  const variants = {
    default: "bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300",
    highlight: "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25",
    premium: "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/25",
  }

  return (
    <div className={cn(
      "flex items-center gap-2.5 px-4 py-2.5 rounded-xl transition-all duration-200",
      variants[variant]
    )}>
      <Icon className={cn(
        "w-4 h-4",
        variant === "default" ? "text-slate-500" : "text-white/90"
      )} />
      <div className="flex flex-col">
        <span className={cn(
          "text-sm font-bold leading-tight",
          variant === "default" ? "text-slate-900" : "text-white"
        )}>
          {value}
        </span>
        <span className={cn(
          "text-[10px] leading-tight",
          variant === "default" ? "text-slate-500" : "text-white/80"
        )}>
          {label}
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// AMENITY BADGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function AmenityBadge({
  icon: Icon,
  label,
  available,
}: {
  icon: React.ElementType
  label: string
  available: boolean
}) {
  if (!available) return null

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-100 hover:border-teal-200 hover:from-teal-50 hover:to-emerald-50 transition-all duration-200 group">
      <div className="p-1.5 bg-white rounded-lg shadow-sm group-hover:shadow transition-shadow">
        <Icon className="w-3.5 h-3.5 text-teal-600" />
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// QUICK INFO ICON ROW
// ═══════════════════════════════════════════════════════════════════════════

function QuickInfoRow({
  items,
}: {
  items: { icon: React.ElementType; label: string; available: boolean }[]
}) {
  const availableItems = items.filter(i => i.available)
  if (availableItems.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2">
      {availableItems.slice(0, 3).map((item, idx) => (
        <TooltipProvider key={idx} delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="p-2 bg-slate-50 rounded-lg hover:bg-teal-50 transition-colors cursor-help">
                <item.icon className="w-4 h-4 text-slate-500 hover:text-teal-600" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {item.label}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
      {availableItems.length > 3 && (
        <div className="px-2 py-1 bg-slate-100 rounded-lg text-xs font-medium text-slate-600">
          +{availableItems.length - 3} more
        </div>
      )}
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
  const [copiedCompanyNumber, setCopiedCompanyNumber] = useState(false)

  // Calculate monthly rent based on listing type
  const monthlyRent = property.listing_type === "purchase"
    ? property.estimated_rent_per_room
      ? property.estimated_rent_per_room * property.bedrooms
      : null
    : property.price_pcm

  // Calculate gross yield for purchase properties
  const calculateYield = () => {
    if (property.listing_type !== "purchase" || !property.purchase_price || !monthlyRent) return null
    const annualRent = monthlyRent * 12
    return ((annualRent / property.purchase_price) * 100).toFixed(1)
  }

  const grossYield = calculateYield()

  // Licence status configuration
  const getLicenceStatusConfig = () => {
    switch (property.licence_status) {
      case "active":
        return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", label: "Active" }
      case "pending":
        return { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", label: "Pending" }
      case "expired":
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", label: "Expired" }
      default:
        return { icon: AlertCircle, color: "text-slate-400", bg: "bg-slate-50", border: "border-slate-200", label: "Unknown" }
    }
  }

  const licenceStatus = getLicenceStatusConfig()

  // Deal score color gradient
  const getDealScoreGradient = (score: number | null) => {
    if (!score) return "from-slate-400 to-slate-500"
    if (score >= 80) return "from-emerald-400 to-green-500"
    if (score >= 60) return "from-teal-400 to-cyan-500"
    if (score >= 40) return "from-amber-400 to-yellow-500"
    return "from-red-400 to-orange-500"
  }

  // Amenities configuration
  const amenities = [
    { icon: Wifi, label: "WiFi Included", available: property.wifi_included },
    { icon: Trees, label: "Garden", available: property.has_garden },
    { icon: TrainFront, label: "Near Tube Station", available: property.near_tube_station },
    { icon: Car, label: "Parking Available", available: property.has_parking },
    { icon: PawPrint, label: "Pet Friendly", available: property.is_pet_friendly },
    { icon: GraduationCap, label: "Student Friendly", available: property.is_student_friendly },
    { icon: Sofa, label: "Furnished", available: property.is_furnished },
  ]

  const availableAmenities = amenities.filter(a => a.available)

  // Copy company number to clipboard
  const copyCompanyNumber = () => {
    if (property.company_number) {
      navigator.clipboard.writeText(property.company_number)
      setCopiedCompanyNumber(true)
      setTimeout(() => setCopiedCompanyNumber(false), 2000)
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* ═══════════════════════════════════════════════════════════════════
          HERO SUMMARY CARD
      ═══════════════════════════════════════════════════════════════════ */}
      <Card className="relative overflow-hidden border-0 shadow-xl bg-gradient-to-br from-white via-white to-slate-50/50">
        {/* Decorative background elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-teal-100/40 to-emerald-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-gradient-to-br from-blue-100/30 to-cyan-100/30 rounded-full blur-2xl" />

        {/* Header Section */}
        <div className="relative p-5 pb-4">
          <div className="flex items-start justify-between gap-4 mb-4">
            {/* Address & Location */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1.5">
                <div className="p-1 bg-slate-100 rounded">
                  <MapPin className="w-3 h-3" />
                </div>
                <span className="font-medium">{property.postcode}</span>
              </div>
              <h2 className="font-bold text-slate-900 text-xl leading-tight line-clamp-2">
                {property.address}
              </h2>
            </div>

            {/* Deal Score Badge */}
            {property.deal_score && (
              <div className={cn(
                "relative flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br shadow-xl",
                getDealScoreGradient(property.deal_score)
              )}>
                <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-white/80" />
                <span className="text-2xl font-black text-white">{property.deal_score}</span>
                <span className="text-[9px] text-white/90 font-semibold uppercase tracking-wider">Score</span>
              </div>
            )}
          </div>

          {/* Price Display */}
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-4xl font-black bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 bg-clip-text text-transparent">
              £{property.listing_type === "purchase"
                ? property.purchase_price?.toLocaleString()
                : property.price_pcm?.toLocaleString()}
            </span>
            <span className="text-slate-500 font-medium">
              {property.listing_type === "purchase" ? "asking price" : "per month"}
            </span>
          </div>

          {/* Quick Amenity Icons */}
          <QuickInfoRow items={amenities} />
        </div>

        {/* Metrics Strip */}
        <div className="relative px-5 py-4 bg-gradient-to-r from-slate-50/80 to-slate-100/50 border-t border-slate-100">
          <div className="flex flex-wrap gap-2">
            <HeroMetricPill icon={BedDouble} value={property.bedrooms} label="Bedrooms" />
            <HeroMetricPill icon={Bath} value={property.bathrooms} label="Bathrooms" />
            {property.lettable_rooms && (
              <HeroMetricPill icon={LayoutGrid} value={property.lettable_rooms} label="Lettable" />
            )}
            {property.max_occupants && (
              <HeroMetricPill icon={Users} value={property.max_occupants} label="Max Occ." />
            )}
            {grossYield && (
              <HeroMetricPill icon={TrendingUp} value={`${grossYield}%`} label="Yield" variant="highlight" />
            )}
          </div>
        </div>

        {/* Status Badges */}
        <div className="relative px-5 py-3 flex flex-wrap gap-2 border-t border-slate-100/50">
          {property.epc_rating && (
            <EPCBadge
              rating={property.epc_rating}
              numericRating={property.epc_rating_numeric}
              className="text-xs"
            />
          )}
          {(property.has_fiber !== null || property.has_superfast !== null) && (
            <BroadbandBadge
              hasFiber={property.has_fiber}
              hasSuperfast={property.has_superfast}
              maxDownload={property.broadband_max_down}
              size="sm"
            />
          )}
          {property.licensed_hmo && (
            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100">
              <Shield className="w-3 h-3 mr-1.5" />
              Licensed HMO
            </Badge>
          )}
          {property.article_4_area && (
            <Badge className="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100">
              <AlertCircle className="w-3 h-3 mr-1.5" />
              Article 4 Zone
            </Badge>
          )}
        </div>

        {/* Primary CTA Buttons */}
        <div className="relative p-5 pt-3 flex gap-3">
          {property.listing_type === "purchase" && (
            <Button className="flex-1 h-12 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 hover:from-teal-600 hover:via-emerald-600 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-teal-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/40 hover:scale-[1.02]">
              <Phone className="w-4 h-4 mr-2" />
              Contact Seller
            </Button>
          )}
          <Button
            variant="outline"
            onClick={onViewFullDetails}
            className="flex-1 h-12 border-2 border-slate-200 hover:border-teal-300 hover:bg-teal-50 font-semibold transition-all duration-200"
          >
            View Full Details
          </Button>
        </div>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════════
          COLLAPSIBLE SECTIONS
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="space-y-2">
        {/* Amenities Section */}
        {availableAmenities.length > 0 && (
          <CollapsibleSection
            title="Amenities & Features"
            icon={Home}
            defaultOpen={availableAmenities.length <= 4}
            badge={`${availableAmenities.length} features`}
            badgeVariant="success"
          >
            <div className="grid grid-cols-2 gap-2 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
              {availableAmenities.map((amenity, idx) => (
                <AmenityBadge key={idx} {...amenity} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Ownership / Company Info */}
        {(property.owner_name || property.company_name) && (
          <CollapsibleSection
            title="Ownership Information"
            icon={Building2}
            badge={property.company_name ? "Corporate" : "Individual"}
            badgeVariant={property.company_name ? "default" : "success"}
          >
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-4">
              {property.company_name ? (
                <>
                  {/* Company Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl">
                        <Building2 className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Company Name</p>
                        <p className="font-bold text-slate-900">{property.company_name}</p>
                      </div>
                    </div>
                    {property.company_status && (
                      <Badge className={cn(
                        "border",
                        property.company_status === "active"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>
                        {property.company_status}
                      </Badge>
                    )}
                  </div>

                  {/* Company Number with Copy */}
                  {property.company_number && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Company Number</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono bg-white px-3 py-2 rounded-lg border border-slate-200">
                          {property.company_number}
                        </code>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyCompanyNumber}
                          className="shrink-0"
                        >
                          {copiedCompanyNumber ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                        <a
                          href={`https://find-and-update.company-information.service.gov.uk/company/${property.company_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                        >
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Companies House
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Directors */}
                  {property.directors && property.directors.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Directors</p>
                      <div className="space-y-2">
                        {property.directors.slice(0, 3).map((director, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl hover:from-teal-50 hover:to-emerald-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                {director.name.charAt(0)}
                              </div>
                              <span className="font-medium text-slate-800">{director.name}</span>
                            </div>
                            <span className="text-xs text-slate-500 bg-white px-2 py-1 rounded-lg">{director.role}</span>
                          </div>
                        ))}
                        {property.directors.length > 3 && (
                          <p className="text-xs text-slate-500 text-center pt-2">
                            +{property.directors.length - 3} more directors
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Owner Name</p>
                    <p className="font-bold text-slate-900 text-lg">{property.owner_name}</p>
                  </div>
                  {property.owner_address && (
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Registered Address</p>
                      <p className="text-sm text-slate-700">{property.owner_address}</p>
                    </div>
                  )}
                </>
              )}

              {/* Contact Details */}
              {(property.owner_contact_phone || property.owner_contact_email) && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-3">Contact Details</p>
                  <div className="flex flex-wrap gap-2">
                    {property.owner_contact_phone && (
                      <a
                        href={`tel:${property.owner_contact_phone}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 rounded-xl text-sm font-semibold hover:from-emerald-100 hover:to-teal-100 transition-all duration-200 border border-emerald-200"
                      >
                        <Phone className="w-4 h-4" />
                        {property.owner_contact_phone}
                      </a>
                    )}
                    {property.owner_contact_email && (
                      <a
                        href={`mailto:${property.owner_contact_email}`}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-xl text-sm font-semibold hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 border border-blue-200"
                      >
                        <Mail className="w-4 h-4" />
                        {property.owner_contact_email}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Licence Information */}
        {property.licensed_hmo && (
          <CollapsibleSection
            title="Licence Information"
            icon={FileText}
            badge={licenceStatus.label}
            badgeVariant={
              property.licence_status === "active" ? "success" :
              property.licence_status === "pending" ? "warning" :
              property.licence_status === "expired" ? "danger" : "default"
            }
          >
            <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm space-y-5">
              {/* Status Banner */}
              <div className={cn(
                "flex items-center gap-4 p-4 rounded-xl border",
                licenceStatus.bg,
                licenceStatus.border
              )}>
                <div className={cn("p-2.5 rounded-xl bg-white shadow-sm", licenceStatus.border)}>
                  <licenceStatus.icon className={cn("w-6 h-6", licenceStatus.color)} />
                </div>
                <div>
                  <p className={cn("font-bold text-lg", licenceStatus.color)}>
                    Licence {licenceStatus.label}
                  </p>
                  {property.licence_end_date && (
                    <p className="text-sm text-slate-600">
                      {property.licence_status === "expired" ? "Expired on" : "Valid until"}{" "}
                      <span className="font-semibold">
                        {new Date(property.licence_end_date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Licence Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                {property.licence_id && (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Licence Number</p>
                    <code className="text-sm font-mono font-semibold text-slate-800">
                      {property.licence_id}
                    </code>
                  </div>
                )}
                {property.max_occupants && (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Max Occupants</p>
                    <p className="text-2xl font-bold text-slate-900">{property.max_occupants}</p>
                  </div>
                )}
                {property.licence_start_date && (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Start Date</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {new Date(property.licence_start_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
                {property.licence_end_date && (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">End Date</p>
                    <p className={cn(
                      "text-sm font-semibold",
                      new Date(property.licence_end_date) < new Date() ? "text-red-600" : "text-slate-800"
                    )}>
                      {new Date(property.licence_end_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Licence Holder */}
              {property.licence_holder_name && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Licence Holder</p>
                  <p className="font-semibold text-slate-900">{property.licence_holder_name}</p>
                  {property.licence_holder_address && (
                    <p className="text-sm text-slate-600 mt-1">{property.licence_holder_address}</p>
                  )}
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        {/* Floor Plan Section */}
        <CollapsibleSection
          title="Floor Plan"
          icon={LayoutGrid}
          badge={property.floor_plans?.length ? `${property.floor_plans.length} available` : "Not available"}
          badgeVariant={property.floor_plans?.length ? "success" : "default"}
        >
          <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
            {property.floor_plans && property.floor_plans.length > 0 ? (
              <div className="space-y-3">
                {property.floor_plans.slice(0, 2).map((plan, idx) => (
                  <a
                    key={idx}
                    href={plan}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl overflow-hidden group cursor-pointer border border-slate-200"
                  >
                    <img
                      src={plan}
                      alt={`Floor plan ${idx + 1}`}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end justify-center pb-4">
                      <span className="bg-white/95 backdrop-blur px-4 py-2 rounded-full text-sm font-semibold text-slate-700 shadow-lg">
                        Click to enlarge
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="aspect-[4/3] bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200">
                <LayoutGrid className="w-14 h-14 mb-3 opacity-40" />
                <p className="font-semibold text-slate-500">No floor plan available</p>
                <p className="text-sm">Check the full listing for more details</p>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Yield Calculator Section */}
        <CollapsibleSection
          title="Yield Calculator"
          icon={Calculator}
          badge="PRO"
          badgeVariant="success"
        >
          <div className="p-5 bg-white rounded-2xl border border-slate-100 shadow-sm">
            {isPremium ? (
              <div className="space-y-4">
                {/* Quick Yield Summary */}
                {property.listing_type === "purchase" && property.purchase_price && monthlyRent && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium mb-1">Purchase Price</p>
                      <p className="font-bold text-slate-900 text-lg">£{(property.purchase_price / 1000).toFixed(0)}k</p>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                      <p className="text-xs text-slate-500 font-medium mb-1">Monthly Rent</p>
                      <p className="font-bold text-slate-900 text-lg">£{monthlyRent.toLocaleString()}</p>
                    </div>
                    <div className="text-center p-4 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-lg shadow-teal-500/25">
                      <p className="text-xs text-white/80 font-medium mb-1">Gross Yield</p>
                      <p className="font-black text-white text-2xl">{grossYield}%</p>
                    </div>
                  </div>
                )}

                {property.listing_type === "rent" && (
                  <div className="text-center p-6 bg-slate-50 rounded-xl">
                    <p className="text-sm text-slate-600">
                      Yield calculator is available for purchase listings only.
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full h-11 border-2 font-semibold"
                  onClick={onViewFullDetails}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Open Full Calculator
                </Button>
              </div>
            ) : (
              <div className="text-center p-8 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-xl border border-amber-200">
                <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <p className="font-bold text-slate-900 text-lg mb-2">Upgrade to PRO</p>
                <p className="text-sm text-slate-600 mb-5">
                  Unlock the yield calculator and advanced investment analytics
                </p>
                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold shadow-lg shadow-amber-500/30 h-11 px-6">
                  <Zap className="w-4 h-4 mr-2" />
                  Upgrade Now
                </Button>
              </div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECONDARY ACTIONS
      ═══════════════════════════════════════════════════════════════════ */}
      {property.source_url && (
        <div className="flex justify-center pt-3">
          <a
            href={property.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 transition-colors font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            View original listing
          </a>
        </div>
      )}
    </div>
  )
}
