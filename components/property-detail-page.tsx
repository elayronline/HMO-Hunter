"use client"

import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useState, useMemo, Component, type ReactNode } from "react"
import {
  ArrowLeft,
  BedDouble,
  Bath,
  MapPin,
  ExternalLink,
  TrendingUp,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Share2,
  Check,
  Maximize2,
  Ruler,
  Phone,
  ChevronLeft,
  ChevronRight,
  X,
  Home,
  Zap,
  Shield,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { HeroMetricsBar } from "@/components/hero-metrics-bar"
import { SavePropertyButton } from "@/components/save-property-button"
import { PropertyDetailCard } from "@/components/property-detail-card"
import { EPCBadge } from "@/components/epc-badge"
import type { Property } from "@/lib/types/database"

const PropertyLocationMap = dynamic(
  () => import("@/components/property-location-map").then((m) => ({ default: m.PropertyLocationMap })),
  { ssr: false, loading: () => <div className="w-full h-[350px] bg-slate-200 animate-pulse" /> }
)

class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return <div className="w-full h-[350px] flex items-center justify-center bg-slate-100 text-sm text-slate-500">Map unavailable</div>
    }
    return this.props.children
  }
}

interface PropertyDetailPageClientProps {
  property: Property
}

function getPrice(property: Property) {
  if (property.listing_type === "purchase") {
    return property.purchase_price ? `£${property.purchase_price.toLocaleString()}` : "POA"
  }
  return property.price_pcm ? `£${property.price_pcm.toLocaleString()}/mo` : "POA"
}

function getPriceLabel(property: Property) {
  return property.listing_type === "purchase" ? "Asking price" : "Per month"
}

function getDealScoreConfig(score: number) {
  if (score >= 70) return { label: "Excellent", bg: "bg-emerald-500", ring: "ring-emerald-500/20", text: "text-white" }
  if (score >= 50) return { label: "Good", bg: "bg-amber-500", ring: "ring-amber-500/20", text: "text-white" }
  return { label: "Fair", bg: "bg-red-500", ring: "ring-red-500/20", text: "text-white" }
}

export function PropertyDetailPageClient({ property }: PropertyDetailPageClientProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [showFullscreen, setShowFullscreen] = useState(false)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try { await navigator.share({ title: property.address || "Property", url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Collect all images
  const allImages = useMemo(() => {
    const imgs: string[] = []
    if (property.primary_image) imgs.push(property.primary_image)
    if (property.images) {
      for (const img of property.images) {
        if (!imgs.includes(img)) imgs.push(img)
      }
    }
    return imgs.length > 0 ? imgs : []
  }, [property.images, property.primary_image])

  const handleImageError = (url: string) => {
    setFailedImages(prev => new Set(prev).add(url))
  }

  const validImages = allImages.filter(img => !failedImages.has(img))

  const goNext = () => setSelectedImageIndex(i => (i + 1) % Math.max(1, validImages.length))
  const goPrev = () => setSelectedImageIndex(i => (i - 1 + validImages.length) % Math.max(1, validImages.length))

  const dealScoreConfig = property.deal_score != null ? getDealScoreConfig(property.deal_score) : null

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ─── Sticky Header ─── */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden md:inline">Back to results</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              aria-label={copied ? "Link copied" : "Share property"}
              className="h-9"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden sm:inline ml-1.5">{copied ? "Copied!" : "Share"}</span>
            </Button>
            <SavePropertyButton propertyId={property.id} size="sm" />
            {(property.source_url || property.zoopla_listing_url) && (
              <a
                href={property.source_url || property.zoopla_listing_url || ""}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" className="h-9 bg-teal-600 hover:bg-teal-700 text-white">
                  <ExternalLink className="w-4 h-4 md:mr-1.5" />
                  <span className="hidden md:inline">View Listing</span>
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero Gallery ─── */}
      <div className="relative bg-slate-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-0.5 md:gap-1">
            {/* Main image */}
            <div
              className="md:col-span-3 relative h-[280px] sm:h-[360px] md:h-[480px] cursor-pointer group overflow-hidden"
              onClick={() => validImages.length > 0 && setShowFullscreen(true)}
            >
              {validImages.length > 0 ? (
                <>
                  <img
                    src={validImages[selectedImageIndex] || validImages[0]}
                    alt={property.address || "Property"}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    onError={() => handleImageError(validImages[selectedImageIndex])}
                  />
                  {/* Gradient overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                  {/* Nav arrows */}
                  {validImages.length > 1 && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); goPrev() }}
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white rounded-full p-2 transition-all opacity-0 group-hover:opacity-100"
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); goNext() }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 backdrop-blur-sm text-white rounded-full p-2 transition-all opacity-0 group-hover:opacity-100"
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Image counter */}
                  {validImages.length > 1 && (
                    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      <Maximize2 className="w-3 h-3" />
                      {selectedImageIndex + 1} / {validImages.length}
                    </div>
                  )}

                  {/* Price overlay - bottom left */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        {/* Listing type pill */}
                        <div className={`inline-block text-xs font-bold px-3 py-1 rounded-full mb-3 ${
                          property.listing_type === "rent"
                            ? "bg-purple-500 text-white"
                            : "bg-blue-500 text-white"
                        }`}>
                          {property.listing_type === "rent" ? "RENT TO HMO" : "PURCHASE"}
                        </div>
                        <h1 className="text-white text-2xl md:text-4xl font-bold tracking-tight">
                          {getPrice(property)}
                        </h1>
                        <p className="text-white/70 text-sm mt-1">{getPriceLabel(property)}</p>
                      </div>

                      {/* Deal score - prominent */}
                      {property.deal_score != null && dealScoreConfig && (
                        <div className={`flex flex-col items-center ${dealScoreConfig.bg} ${dealScoreConfig.text} rounded-2xl px-4 py-3 ring-4 ${dealScoreConfig.ring} shadow-lg`}>
                          <Zap className="w-4 h-4 mb-0.5" />
                          <span className="text-2xl font-black leading-none">{property.deal_score}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider mt-0.5 opacity-90">{dealScoreConfig.label}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="w-full h-full bg-slate-200 flex items-center justify-center">
                  <div className="text-center text-slate-400">
                    <Home className="w-12 h-12 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No images available</p>
                  </div>
                </div>
              )}
            </div>

            {/* Side thumbnails (desktop) */}
            <div className="hidden md:flex flex-col gap-1">
              {validImages.slice(1, 4).map((img, i) => (
                <div
                  key={i}
                  className={`relative flex-1 cursor-pointer overflow-hidden group/thumb ${
                    selectedImageIndex === i + 1 ? "ring-2 ring-teal-400" : ""
                  }`}
                  onClick={() => setSelectedImageIndex(i + 1)}
                >
                  <img
                    src={img}
                    alt={`Photo ${i + 2}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-105"
                    onError={() => handleImageError(img)}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors" />
                </div>
              ))}
              {validImages.length > 4 && (
                <button
                  onClick={() => setShowFullscreen(true)}
                  className="relative flex-1 cursor-pointer overflow-hidden"
                >
                  <img
                    src={validImages[4]}
                    alt="More photos"
                    className="w-full h-full object-cover"
                    onError={() => handleImageError(validImages[4])}
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">+{validImages.length - 4}</span>
                  </div>
                </button>
              )}
              {validImages.length <= 1 && (
                <div className="flex-1 bg-slate-200 flex items-center justify-center">
                  <Home className="w-8 h-8 text-slate-300" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile thumbnail strip */}
        {validImages.length > 1 && (
          <div className="md:hidden flex gap-1.5 overflow-x-auto px-4 py-2 bg-slate-900">
            {validImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImageIndex(i)}
                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all ${
                  selectedImageIndex === i
                    ? "ring-2 ring-teal-400 scale-105"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <img src={img} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" onError={() => handleImageError(img)} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ─── Property Info Bar ─── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 md:py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Address & specs */}
            <div>
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <MapPin className="w-4 h-4 text-teal-600" />
                <h2 className="text-base md:text-lg font-semibold text-slate-900">{property.address}</h2>
              </div>
              <p className="text-sm text-slate-500 ml-6">{property.postcode}{property.city ? `, ${property.city}` : ""}</p>
            </div>

            {/* Spec pills */}
            <div className="flex items-center gap-2 flex-wrap ml-6 md:ml-0">
              {property.bedrooms != null && (
                <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-slate-100 text-sm font-medium text-slate-700">
                  <BedDouble className="w-4 h-4 text-slate-500" /> {property.bedrooms} bed
                </span>
              )}
              {property.bathrooms != null && (
                <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-slate-100 text-sm font-medium text-slate-700">
                  <Bath className="w-4 h-4 text-slate-500" /> {property.bathrooms} bath
                </span>
              )}
              {property.gross_internal_area_sqm != null && (
                <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-slate-100 text-sm font-medium text-slate-700">
                  <Ruler className="w-4 h-4 text-slate-500" /> {Math.round(property.gross_internal_area_sqm)} m²
                </span>
              )}
              {property.epc_rating && (
                <EPCBadge rating={property.epc_rating} numericRating={property.epc_rating_numeric} className="text-sm" />
              )}
              {/* Status badges */}
              {property.licence_status === "active" && (
                <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-teal-50 text-sm font-semibold text-teal-700 ring-1 ring-teal-200">
                  <ShieldCheck className="w-4 h-4" /> Licensed HMO
                </span>
              )}
              {property.licence_status === "expired" && (
                <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-amber-50 text-sm font-semibold text-amber-700 ring-1 ring-amber-200">
                  <Clock className="w-4 h-4" /> Expired Licence
                </span>
              )}
              {property.article_4_area && (
                <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-red-50 text-sm font-semibold text-red-600 ring-1 ring-red-200">
                  <AlertTriangle className="w-4 h-4" /> Article 4
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Hero Metrics ─── */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <HeroMetricsBar property={property} />
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">

          {/* Left column: Details (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            {property.description && (
              <section className="bg-white rounded-2xl p-5 md:p-6 shadow-sm border border-slate-200/80">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">About this property</h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {property.description}
                </p>
              </section>
            )}

            {/* Analysis & Details Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
              <PropertyDetailCard
                property={property}
                onViewFullDetails={() => {}}
                className="w-full border-0 shadow-none rounded-none"
              />
            </div>
          </div>

          {/* Right column: Map + CTA (1/3 width) */}
          <div className="space-y-6">
            {/* CTA Card */}
            {(property.agent_phone || property.source_url || property.zoopla_listing_url) && (
              <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-5 text-white shadow-lg">
                <h3 className="font-semibold text-lg mb-1">Interested?</h3>
                <p className="text-teal-100 text-sm mb-4">
                  {property.listing_type === "purchase" ? "Book a viewing or contact the agent" : "Enquire about this property"}
                </p>
                <div className="space-y-2">
                  {property.agent_phone && (
                    <a href={`tel:${property.agent_phone}`} className="block">
                      <Button className="w-full h-11 bg-white text-teal-700 hover:bg-teal-50 font-semibold">
                        <Phone className="w-4 h-4 mr-2" />
                        {property.agent_name ? `Call ${property.agent_name}` : "Call Agent"}
                      </Button>
                    </a>
                  )}
                  {(property.source_url || property.zoopla_listing_url) && (
                    <a
                      href={property.source_url || property.zoopla_listing_url || ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button variant="outline" className="w-full h-11 bg-transparent border-white/30 text-white hover:bg-white/10 font-semibold">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Original Listing
                      </Button>
                    </a>
                  )}
                </div>
                {property.agent_name && (
                  <p className="text-teal-200 text-xs mt-3 text-center">
                    Listed by {property.agent_name}
                  </p>
                )}
              </div>
            )}

            {/* Location Map */}
            {property.latitude && property.longitude && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200/80">
                <div className="px-5 py-3.5 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    Location
                  </h3>
                </div>
                <MapErrorBoundary>
                  <PropertyLocationMap
                    latitude={property.latitude}
                    longitude={property.longitude}
                    address={property.address || undefined}
                    className="w-full h-[350px]"
                  />
                </MapErrorBoundary>
              </div>
            )}

            {/* Quick Facts */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80">
              <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Facts</h3>
              <div className="space-y-2.5">
                {property.property_type && (
                  <QuickFact label="Property Type" value={property.property_type} />
                )}
                {property.tenure && property.tenure !== "unknown" && (
                  <QuickFact label="Tenure" value={property.tenure === "freehold" ? "Freehold" : "Leasehold"} />
                )}
                {property.year_built && (
                  <QuickFact label="Year Built" value={String(property.year_built)} />
                )}
                {property.council_tax_band && (
                  <QuickFact label="Council Tax" value={`Band ${property.council_tax_band}`} />
                )}
                {property.max_occupants && (
                  <QuickFact label="Max Occupants" value={String(property.max_occupants)} />
                )}
                {property.days_on_market != null && (
                  <QuickFact label="Days on Market" value={String(property.days_on_market)} />
                )}
                {property.has_fiber && (
                  <QuickFact label="Broadband" value="Fibre available" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Fullscreen Gallery Modal ─── */}
      {showFullscreen && validImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center"
          onClick={() => setShowFullscreen(false)}
        >
          <button
            onClick={() => setShowFullscreen(false)}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
            aria-label="Close gallery"
          >
            <X className="w-8 h-8" />
          </button>

          <div className="relative w-full h-full flex items-center justify-center p-4 md:p-12" onClick={(e) => e.stopPropagation()}>
            <img
              src={validImages[selectedImageIndex]}
              alt={`${property.address} - Photo ${selectedImageIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
              onError={() => handleImageError(validImages[selectedImageIndex])}
            />

            {validImages.length > 1 && (
              <>
                <button
                  onClick={goPrev}
                  className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 text-white rounded-full p-3 transition-colors backdrop-blur-sm"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={goNext}
                  className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/25 text-white rounded-full p-3 transition-colors backdrop-blur-sm"
                  aria-label="Next"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Bottom thumbnail strip */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-md overflow-x-auto px-4">
              {validImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImageIndex(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all ${
                    selectedImageIndex === i
                      ? "ring-2 ring-white scale-110"
                      : "opacity-50 hover:opacity-80"
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" onError={() => handleImageError(img)} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function QuickFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  )
}
