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
  ChevronRight,
  Building2,
  FileText,
  Calculator,
  MapPin,
  ExternalLink,
  Phone,
  Mail,
  Calendar,
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import type { Property } from "@/lib/types/database"
import { EPCBadge } from "@/components/epc-badge"
import { BroadbandBadge } from "@/components/broadband-badge"
import { BookViewingButton } from "@/components/book-viewing-button"

interface PropertyDetailCardProps {
  property: Property
  onViewFullDetails: () => void
  isPremium?: boolean
  className?: string
}

// Collapsible Section Component
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
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-100/50 rounded-xl transition-all duration-200 group">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm group-hover:shadow transition-shadow">
              <Icon className="w-4 h-4 text-teal-600" />
            </div>
            <span className="font-medium text-slate-800">{title}</span>
            {badge && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", badgeColors[badgeVariant])}>
                {badge}
              </span>
            )}
          </div>
          <div className={cn(
            "p-1 rounded-full bg-white shadow-sm transition-transform duration-200",
            isOpen && "rotate-180"
          )}>
            <ChevronDown className="w-4 h-4 text-slate-400" />
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

// Metric Pill Component
function MetricPill({
  icon: Icon,
  value,
  label,
  highlight = false,
}: {
  icon: React.ElementType
  value: string | number
  label: string
  highlight?: boolean
}) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-xl transition-all",
      highlight
        ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25"
        : "bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300"
    )}>
      <Icon className={cn("w-4 h-4", highlight ? "text-white/90" : "text-slate-500")} />
      <div className="flex flex-col">
        <span className={cn("text-sm font-bold leading-tight", highlight ? "text-white" : "text-slate-900")}>
          {value}
        </span>
        <span className={cn("text-[10px] leading-tight", highlight ? "text-white/80" : "text-slate-500")}>
          {label}
        </span>
      </div>
    </div>
  )
}

// Amenity Icon Component
function AmenityIcon({
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
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg">
      <Icon className="w-4 h-4 text-teal-600" />
      <span className="text-sm text-slate-700">{label}</span>
    </div>
  )
}

export function PropertyDetailCard({
  property,
  onViewFullDetails,
  isPremium = false,
  className,
}: PropertyDetailCardProps) {
  const monthlyRent = property.listing_type === "purchase"
    ? property.estimated_rent_per_room
      ? property.estimated_rent_per_room * property.bedrooms
      : null
    : property.price_pcm

  const calculateYield = () => {
    if (property.listing_type !== "purchase" || !property.purchase_price || !monthlyRent) return null
    const annualRent = monthlyRent * 12
    return ((annualRent / property.purchase_price) * 100).toFixed(1)
  }

  const grossYield = calculateYield()

  const getLicenceStatusConfig = () => {
    switch (property.licence_status) {
      case "active":
        return { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Active" }
      case "pending":
        return { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", label: "Pending" }
      case "expired":
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Expired" }
      default:
        return { icon: AlertCircle, color: "text-slate-400", bg: "bg-slate-50", label: "None" }
    }
  }

  const licenceStatus = getLicenceStatusConfig()

  const getDealScoreColor = (score: number | null) => {
    if (!score) return "from-slate-400 to-slate-500"
    if (score >= 80) return "from-emerald-500 to-green-500"
    if (score >= 60) return "from-teal-500 to-cyan-500"
    if (score >= 40) return "from-amber-500 to-yellow-500"
    return "from-red-500 to-orange-500"
  }

  const amenities = [
    { icon: Wifi, label: "WiFi", available: property.wifi_included },
    { icon: Trees, label: "Garden", available: property.has_garden },
    { icon: TrainFront, label: "Near Tube", available: property.near_tube_station },
    { icon: Car, label: "Parking", available: property.has_parking },
    { icon: PawPrint, label: "Pet Friendly", available: property.is_pet_friendly },
    { icon: GraduationCap, label: "Student Friendly", available: property.is_student_friendly },
    { icon: Sofa, label: "Furnished", available: property.is_furnished },
  ]

  const availableAmenities = amenities.filter(a => a.available)

  return (
    <div className={cn("space-y-4", className)}>
      {/* ═══════════════════════════════════════════════════════════════════
          TOP SUMMARY CARD - Always Visible
      ═══════════════════════════════════════════════════════════════════ */}
      <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-white to-slate-50">
        {/* Header with Price & Address */}
        <div className="p-5 pb-4 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{property.postcode}</span>
              </div>
              <h3 className="font-semibold text-slate-900 text-lg leading-tight line-clamp-2">
                {property.address}
              </h3>
            </div>
            {property.deal_score && (
              <div className={cn(
                "flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br shadow-lg",
                getDealScoreColor(property.deal_score)
              )}>
                <span className="text-xl font-bold text-white">{property.deal_score}</span>
                <span className="text-[9px] text-white/80 font-medium">SCORE</span>
              </div>
            )}
          </div>

          {/* Price Display */}
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">
              £{property.listing_type === "purchase"
                ? property.purchase_price?.toLocaleString()
                : property.price_pcm?.toLocaleString()}
            </span>
            <span className="text-slate-500 text-sm">
              {property.listing_type === "purchase" ? "asking price" : "per month"}
            </span>
          </div>
        </div>

        {/* Key Metrics Strip */}
        <div className="p-4 bg-slate-50/50">
          <div className="flex flex-wrap gap-2">
            <MetricPill icon={BedDouble} value={property.bedrooms} label="Beds" />
            <MetricPill icon={Bath} value={property.bathrooms} label="Baths" />
            {property.max_occupants && (
              <MetricPill icon={Users} value={property.max_occupants} label="Max Occ." />
            )}
            {grossYield && (
              <MetricPill icon={TrendingUp} value={`${grossYield}%`} label="Yield" highlight />
            )}
            {property.lettable_rooms && (
              <MetricPill icon={LayoutGrid} value={property.lettable_rooms} label="Rooms" />
            )}
          </div>
        </div>

        {/* Quick Badges Row */}
        <div className="px-4 pb-4 flex flex-wrap gap-2">
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
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              <Shield className="w-3 h-3 mr-1" />
              Licensed HMO
            </Badge>
          )}
          {property.article_4_area && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <AlertCircle className="w-3 h-3 mr-1" />
              Article 4
            </Badge>
          )}
        </div>

        {/* Primary Actions */}
        <div className="p-4 pt-0 flex gap-2">
          {property.listing_type === "purchase" ? (
            <Button className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-lg shadow-teal-500/25 h-11">
              <Phone className="w-4 h-4 mr-2" />
              Contact Seller
            </Button>
          ) : (
            <BookViewingButton
              address={property.address}
              postcode={property.postcode}
              bedrooms={property.bedrooms}
              className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-lg shadow-teal-500/25 h-11"
            />
          )}
          <Button
            variant="outline"
            onClick={onViewFullDetails}
            className="flex-1 border-slate-300 hover:bg-slate-50 h-11"
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
          >
            <div className="grid grid-cols-2 gap-2 p-3 bg-white rounded-xl border border-slate-100">
              {availableAmenities.map((amenity, idx) => (
                <AmenityIcon key={idx} {...amenity} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Ownership / Company Info */}
        {(property.owner_name || property.company_name) && (
          <CollapsibleSection
            title="Ownership Information"
            icon={Building2}
            badge={property.company_name ? "Company" : "Individual"}
            badgeVariant={property.company_name ? "default" : "success"}
          >
            <div className="p-4 bg-white rounded-xl border border-slate-100 space-y-4">
              {property.company_name ? (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Company Name</p>
                      <p className="font-semibold text-slate-900">{property.company_name}</p>
                    </div>
                    {property.company_status && (
                      <Badge
                        variant="outline"
                        className={cn(
                          property.company_status === "active"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-600"
                        )}
                      >
                        {property.company_status}
                      </Badge>
                    )}
                  </div>
                  {property.company_number && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Company Number</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono bg-slate-100 px-2 py-1 rounded">
                          {property.company_number}
                        </code>
                        <a
                          href={`https://find-and-update.company-information.service.gov.uk/company/${property.company_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:text-teal-700 text-sm flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Companies House
                        </a>
                      </div>
                    </div>
                  )}
                  {property.directors && property.directors.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Directors</p>
                      <div className="space-y-2">
                        {property.directors.slice(0, 3).map((director, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <span className="text-sm font-medium text-slate-800">{director.name}</span>
                            <span className="text-xs text-slate-500">{director.role}</span>
                          </div>
                        ))}
                        {property.directors.length > 3 && (
                          <p className="text-xs text-slate-500 text-center">
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
                    <p className="font-semibold text-slate-900">{property.owner_name}</p>
                  </div>
                  {property.owner_address && (
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Registered Address</p>
                      <p className="text-sm text-slate-700">{property.owner_address}</p>
                    </div>
                  )}
                </>
              )}

              {/* Contact Info */}
              {(property.owner_contact_phone || property.owner_contact_email) && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Contact Details</p>
                  <div className="flex flex-wrap gap-2">
                    {property.owner_contact_phone && (
                      <a
                        href={`tel:${property.owner_contact_phone}`}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
                      >
                        <Phone className="w-4 h-4" />
                        {property.owner_contact_phone}
                      </a>
                    )}
                    {property.owner_contact_email && (
                      <a
                        href={`mailto:${property.owner_contact_email}`}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
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
            <div className="p-4 bg-white rounded-xl border border-slate-100 space-y-4">
              {/* Status Banner */}
              <div className={cn("flex items-center gap-3 p-3 rounded-lg", licenceStatus.bg)}>
                <licenceStatus.icon className={cn("w-5 h-5", licenceStatus.color)} />
                <div>
                  <p className={cn("font-semibold", licenceStatus.color)}>
                    Licence {licenceStatus.label}
                  </p>
                  {property.licence_end_date && (
                    <p className="text-xs text-slate-600">
                      {property.licence_status === "expired" ? "Expired" : "Expires"}{" "}
                      {new Date(property.licence_end_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>

              {/* Licence Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                {property.licence_id && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Licence Number</p>
                    <code className="text-sm font-mono bg-slate-100 px-2 py-1 rounded block truncate">
                      {property.licence_id}
                    </code>
                  </div>
                )}
                {property.max_occupants && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Max Occupants</p>
                    <p className="text-lg font-bold text-slate-900">{property.max_occupants}</p>
                  </div>
                )}
                {property.licence_start_date && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Start Date</p>
                    <p className="text-sm text-slate-700">
                      {new Date(property.licence_start_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
                {property.licence_end_date && (
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">End Date</p>
                    <p className={cn(
                      "text-sm",
                      new Date(property.licence_end_date) < new Date() ? "text-red-600 font-medium" : "text-slate-700"
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
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Licence Holder</p>
                  <p className="font-medium text-slate-900">{property.licence_holder_name}</p>
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
          <div className="p-4 bg-white rounded-xl border border-slate-100">
            {property.floor_plans && property.floor_plans.length > 0 ? (
              <div className="space-y-3">
                {property.floor_plans.slice(0, 2).map((plan, idx) => (
                  <a
                    key={idx}
                    href={plan}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden group cursor-pointer"
                  >
                    <img
                      src={plan}
                      alt={`Floor plan ${idx + 1}`}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur px-3 py-1.5 rounded-full text-sm font-medium text-slate-700">
                        Click to enlarge
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="aspect-[4/3] bg-slate-50 rounded-lg flex flex-col items-center justify-center text-slate-400">
                <LayoutGrid className="w-12 h-12 mb-2 opacity-50" />
                <p className="text-sm font-medium">No floor plan available</p>
                <p className="text-xs">Check the full listing for more details</p>
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Yield Calculator Section - PRO Feature */}
        <CollapsibleSection
          title="Yield Calculator"
          icon={Calculator}
          badge="PRO"
          badgeVariant="success"
        >
          <div className="p-4 bg-white rounded-xl border border-slate-100">
            {isPremium ? (
              <div className="space-y-4">
                {/* Quick Yield Summary */}
                {property.listing_type === "purchase" && property.purchase_price && monthlyRent && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Purchase</p>
                      <p className="font-bold text-slate-900">£{(property.purchase_price / 1000).toFixed(0)}k</p>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 mb-1">Monthly Rent</p>
                      <p className="font-bold text-slate-900">£{monthlyRent.toLocaleString()}</p>
                    </div>
                    <div className="text-center p-3 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-lg">
                      <p className="text-xs text-white/80 mb-1">Gross Yield</p>
                      <p className="font-bold text-white text-lg">{grossYield}%</p>
                    </div>
                  </div>
                )}

                {property.listing_type === "rent" && (
                  <div className="text-center p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-600">
                      Yield calculator is available for purchase listings only.
                    </p>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onViewFullDetails}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  Open Full Calculator
                </Button>
              </div>
            ) : (
              <div className="text-center p-6 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <p className="font-semibold text-slate-900 mb-1">Upgrade to PRO</p>
                <p className="text-sm text-slate-600 mb-4">
                  Unlock the yield calculator and advanced analytics
                </p>
                <Button className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
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
        <div className="flex justify-center pt-2">
          <a
            href={property.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-teal-600 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View original listing
          </a>
        </div>
      )}
    </div>
  )
}
