"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import {
  Phone,
  Heart,
  Share2,
  ExternalLink,
  ChevronRight,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Wifi,
  Trees,
  Car,
  PawPrint,
  GraduationCap,
  Sofa,
  LayoutGrid,
  Copy,
  Check,
  MapPin,
  Info,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Property } from "@/lib/types/database"
import { DealVerdictHeader } from "@/components/deal-verdict-header"
import { HeroMetricsBar } from "@/components/hero-metrics-bar"
import { KeyFlagsRow } from "@/components/key-flags-row"
import { PropertyGallery } from "@/components/property-gallery"
import { PremiumYieldCalculator } from "@/components/premium-yield-calculator"
import { AreaStatisticsCard } from "@/components/area-statistics-card"
import { SoldPriceHistory } from "@/components/sold-price-history"
import { AgentContactCard } from "@/components/agent-contact-card"
import { EPCBadge } from "@/components/epc-badge"
import { BroadbandBadge } from "@/components/broadband-badge"

interface PropertySidebarProps {
  property: Property
  onClose: () => void
  onViewFullDetails: () => void
  onSave?: () => void
  onShare?: () => void
  isPremium?: boolean
  isSaved?: boolean
  className?: string
}

type TabType = "overview" | "compliance" | "area" | "property"

export function PropertySidebar({
  property,
  onClose,
  onViewFullDetails,
  onSave,
  onShare,
  isPremium = false,
  isSaved = false,
  className,
}: PropertySidebarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview")
  const [copiedCompanyNumber, setCopiedCompanyNumber] = useState(false)
  const [showShareToast, setShowShareToast] = useState(false)

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/property/${property.id}`
    const shareText = `${property.address}, ${property.postcode} - ${property.bedrooms} bed ${property.property_type}`

    // Try native share first (mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title: property.address, text: shareText, url: shareUrl })
        return
      } catch (err) {
        // User cancelled or share failed, fall through to clipboard
      }
    }

    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShowShareToast(true)
      setTimeout(() => setShowShareToast(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }

    onShare?.()
  }

  const copyCompanyNumber = () => {
    if (property.company_number) {
      navigator.clipboard.writeText(property.company_number)
      setCopiedCompanyNumber(true)
      setTimeout(() => setCopiedCompanyNumber(false), 2000)
    }
  }

  const amenities = [
    { icon: Wifi, label: "WiFi", show: property.wifi_included },
    { icon: Trees, label: "Garden", show: property.has_garden },
    { icon: Car, label: "Parking", show: property.has_parking },
    { icon: PawPrint, label: "Pets OK", show: property.is_pet_friendly },
    { icon: GraduationCap, label: "Students", show: property.is_student_friendly },
    { icon: Sofa, label: "Furnished", show: property.is_furnished },
  ].filter(a => a.show)

  const licenceConfig = {
    active: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", label: "Active" },
    pending: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", label: "Pending" },
    expired: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", label: "Expired" },
  }[property.licence_status || ""] || { icon: Info, color: "text-slate-400", bg: "bg-slate-50", label: "Unknown" }

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "compliance", label: "Compliance" },
    { id: "area", label: "Area" },
    { id: "property", label: "Property" },
  ]

  return (
    <div className={cn("flex flex-col h-full bg-white", className)}>
      {/* ════════════════════════════════════════════════════════════════════
          VERDICT HEADER (80px)
      ════════════════════════════════════════════════════════════════════ */}
      <DealVerdictHeader property={property} onClose={onClose} />

      {/* ════════════════════════════════════════════════════════════════════
          HERO METRICS BAR (72px)
      ════════════════════════════════════════════════════════════════════ */}
      <HeroMetricsBar property={property} className="shrink-0 border-b border-slate-200" />

      {/* ════════════════════════════════════════════════════════════════════
          GALLERY STRIP (120px)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 h-[120px] border-b border-slate-200">
        <PropertyGallery
          images={property.images}
          floorPlans={property.floor_plans}
          primaryImage={property.primary_image}
          fallbackImage={property.image_url || "/modern-house-exterior.png"}
          propertyTitle={property.title}
          latitude={property.latitude}
          longitude={property.longitude}
          postcode={property.postcode}
          address={property.address}
          bedrooms={property.bedrooms}
          listingType={property.listing_type}
          externalId={property.external_id}
          price={property.listing_type === "rent" ? property.price_pcm : property.purchase_price}
        />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          KEY FLAGS ROW (40px)
      ════════════════════════════════════════════════════════════════════ */}
      <KeyFlagsRow property={property} className="shrink-0 border-b border-slate-200" />

      {/* ════════════════════════════════════════════════════════════════════
          TAB NAVIGATION (48px)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 grid grid-cols-4 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "h-12 text-[13px] font-semibold text-center transition-colors relative",
              activeTab === tab.id ? "text-teal-600" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-teal-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB CONTENT (scrollable)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-6">

          {/* OVERVIEW TAB */}
          {activeTab === "overview" && (
            <>
              <PremiumYieldCalculator property={property} isPremium={isPremium} />
            </>
          )}

          {/* COMPLIANCE TAB */}
          {activeTab === "compliance" && (
            <>
              {/* Licence Status Card */}
              {property.licensed_hmo || property.licence_status ? (
                <div className={cn("rounded-lg p-4", licenceConfig.bg)}>
                  <div className="flex items-start gap-3">
                    <licenceConfig.icon className={cn("w-5 h-5 shrink-0 mt-0.5", licenceConfig.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("text-sm font-semibold", licenceConfig.color)}>
                          {property.licensed_hmo ? "Mandatory HMO Licence" : "HMO Licence"}
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                          licenceConfig.color,
                          licenceConfig.bg
                        )}>
                          {licenceConfig.label}
                        </span>
                      </div>
                      {property.licence_end_date && (
                        <p className="text-xs text-slate-600 mt-1">
                          {property.licence_status === "expired" ? "Expired:" : "Expires:"}{" "}
                          {new Date(property.licence_end_date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      )}
                      {(property.licence_id || property.max_occupants) && (
                        <div className="flex gap-4 mt-3 pt-3 border-t border-black/10">
                          {property.licence_id && (
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase">Licence #</p>
                              <p className="text-xs font-mono font-medium text-slate-800">{property.licence_id}</p>
                            </div>
                          )}
                          {property.max_occupants && (
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase">Max Occupants</p>
                              <p className="text-xs font-bold text-slate-900">{property.max_occupants}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg p-4 bg-slate-50">
                  <div className="flex items-center gap-3">
                    <Info className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">No Licence on Record</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        This property may require licensing depending on use
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Article 4 Warning */}
              {property.article_4_area && (
                <div className="rounded-lg p-4 bg-purple-50">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-purple-800">Article 4 Direction</p>
                      <p className="text-xs text-purple-600 mt-1">
                        Planning permission required for HMO use in this area
                      </p>
                      <button className="text-xs text-purple-700 font-medium mt-2 hover:underline">
                        View Council Planning Portal →
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Licensing Requirements (collapsible) */}
              <CollapsibleSection title="Licensing Requirements">
                <div className="space-y-2">
                  {[
                    { color: "bg-red-500", label: "Mandatory", desc: "5+ people, 2+ households" },
                    { color: "bg-amber-500", label: "Additional", desc: "3+ people, 2+ households" },
                    { color: "bg-blue-500", label: "Selective", desc: "All rentals in designated area" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between h-9 px-3 bg-white rounded border border-slate-200">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", item.color)} />
                        <span className="text-sm font-medium text-slate-700">{item.label}</span>
                      </div>
                      <span className="text-xs text-slate-500">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            </>
          )}

          {/* AREA TAB */}
          {activeTab === "area" && (
            <>
              <AreaStatisticsCard postcode={property.postcode} />
              <SoldPriceHistory postcode={property.postcode} currentPrice={property.purchase_price || property.price_pcm || undefined} />
            </>
          )}

          {/* PROPERTY TAB */}
          {activeTab === "property" && (
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

              {/* EPC Certificate */}
              {property.epc_rating && (
                <Section title="Energy Performance">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Rating</span>
                      <EPCBadge rating={property.epc_rating} numericRating={property.epc_rating_numeric} />
                    </div>
                    {property.gross_internal_area_sqm && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Floor Area</span>
                        <span className="text-sm font-medium text-slate-900">
                          {Math.round(property.gross_internal_area_sqm)}m²
                        </span>
                      </div>
                    )}
                    {property.epc_certificate_url && property.epc_certificate_url !== "not_available" && (
                      <a
                        href={property.epc_certificate_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-teal-600 font-medium hover:text-teal-700"
                      >
                        View certificate <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </Section>
              )}

              {/* Broadband */}
              {(property.has_fiber !== null || property.has_superfast !== null) && (
                <Section title="Broadband">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Connection</span>
                    <BroadbandBadge
                      hasFiber={property.has_fiber}
                      hasSuperfast={property.has_superfast}
                      maxDownload={property.broadband_max_down}
                      showSpeed={true}
                    />
                  </div>
                </Section>
              )}

              {/* Ownership - Premium Feature */}
              {(property.owner_name || property.company_name) && (
                <Section title="Ownership">
                  {isPremium ? (
                    property.company_name ? (
                      <>
                        <div className="flex items-center gap-2 text-sm text-slate-700">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{property.company_name}</span>
                        </div>
                        {property.company_number && (
                          <div className="flex items-center gap-2 h-9 px-3 bg-white rounded border border-slate-200 mt-2">
                            <code className="text-xs text-slate-600 flex-1">{property.company_number}</code>
                            <button onClick={copyCompanyNumber} className="text-slate-400 hover:text-slate-600">
                              {copiedCompanyNumber ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-700">{property.owner_name}</p>
                    )
                  ) : (
                    <div className="text-center py-2">
                      <div className="flex items-center justify-center gap-2 text-amber-600 mb-1">
                        <Shield className="w-4 h-4" />
                        <span className="text-xs font-medium">Premium Feature</span>
                      </div>
                      <p className="text-xs text-slate-500">Upgrade to see owner details</p>
                    </div>
                  )}
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
                        className="aspect-video bg-white rounded border border-slate-200 flex items-center justify-center hover:border-teal-400 transition-colors"
                      >
                        <LayoutGrid className="w-6 h-6 text-slate-300" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">No floor plans available</p>
                )}
              </Section>

              {/* Agent Contact */}
              <AgentContactCard property={property} compact />
            </>
          )}

        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          STICKY ACTION BAR (72px)
      ════════════════════════════════════════════════════════════════════ */}
      <div className="shrink-0 p-4 border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="flex gap-2">
          {(property.agent_phone || property.owner_contact_phone) && (
            <Button
              className="flex-1 h-11 bg-teal-600 hover:bg-teal-700 text-white font-semibold"
              asChild
            >
              <a href={`tel:${property.agent_phone || property.owner_contact_phone}`}>
                <Phone className="w-4 h-4 mr-2" />
                Contact Agent
              </a>
            </Button>
          )}
          {!property.agent_phone && !property.owner_contact_phone && (
            <Button
              variant="outline"
              onClick={onViewFullDetails}
              className="flex-1 h-11 font-semibold"
            >
              View Full Details
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={onSave}
            aria-label={isSaved ? "Remove from saved properties" : "Save property"}
          >
            <Heart className={cn("w-4 h-4", isSaved && "fill-red-500 text-red-500")} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 relative"
            onClick={handleShare}
            aria-label="Share property"
          >
            <Share2 className="w-4 h-4" />
            {showShareToast && (
              <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                Link copied!
              </span>
            )}
          </Button>
        </div>
        {property.source_url && (
          <a
            href={property.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-teal-600 mt-3"
          >
            View original listing <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// HELPER COMPONENTS
// ════════════════════════════════════════════════════════════════════════════

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <h3 className="text-[13px] font-semibold text-slate-800 mb-3">{title}</h3>
      {children}
    </div>
  )
}

function CollapsibleSection({ title, children, defaultOpen = false }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="rounded-lg bg-slate-50 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-100 transition-colors"
      >
        <span className="text-[13px] font-semibold text-slate-800">{title}</span>
        <ChevronRight className={cn(
          "w-4 h-4 text-slate-400 transition-transform",
          isOpen && "rotate-90"
        )} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}
