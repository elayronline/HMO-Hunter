"use client"

import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { useState, Component, type ReactNode } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PropertyGallery } from "@/components/property-gallery"
import { PropertyDetailCard } from "@/components/property-detail-card"
import { HeroMetricsBar } from "@/components/hero-metrics-bar"
import { SavePropertyButton } from "@/components/save-property-button"
import type { Property } from "@/lib/types/database"

const PropertyLocationMap = dynamic(
  () => import("@/components/property-location-map").then((m) => ({ default: m.PropertyLocationMap })),
  { ssr: false, loading: () => <div className="w-full h-[300px] rounded-xl bg-slate-200 animate-pulse" /> }
)

class MapErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return <div className="w-full h-[250px] flex items-center justify-center bg-slate-100 rounded-xl text-sm text-slate-500">Map unavailable</div>
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

function getStatusBadge(property: Property) {
  if (property.licence_status === "active") {
    return { label: "Licensed HMO", icon: ShieldCheck, bg: "bg-teal-100", text: "text-teal-700" }
  }
  if (property.licence_status === "expired") {
    return { label: "Expired Licence", icon: Clock, bg: "bg-amber-100", text: "text-amber-700" }
  }
  if (property.article4_zone) {
    return { label: "Article 4 Zone", icon: AlertTriangle, bg: "bg-red-100", text: "text-red-600" }
  }
  return null
}

export function PropertyDetailPageClient({ property }: PropertyDetailPageClientProps) {
  const router = useRouter()
  const status = getStatusBadge(property)
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: property.address || "Property", url })
      } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="text-slate-600 hover:text-slate-900 px-2"
            >
              <ArrowLeft className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Back</span>
            </Button>
            <div className="h-5 w-px bg-slate-200 hidden md:block" />
            <div className="min-w-0">
              <h1 className="text-sm md:text-lg font-semibold text-slate-900 truncate">
                {property.address}
              </h1>
              <p className="text-xs text-slate-500">{property.postcode}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} aria-label={copied ? "Link copied" : "Share property"}>
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Share2 className="w-4 h-4" />}
              <span className="hidden md:inline ml-1">{copied ? "Copied" : "Share"}</span>
            </Button>
            <SavePropertyButton propertyId={property.id} size="sm" />
            {property.url && (
              <a
                href={property.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">View Listing</span>
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6">
        {/* Top section: Gallery + Map side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
          {/* Gallery - takes more space */}
          <div className="md:col-span-1 lg:col-span-3">
            <Card className="overflow-hidden">
              <PropertyGallery
                images={property.images}
                floorPlans={property.floor_plan_url ? [property.floor_plan_url] : null}
                primaryImage={property.primary_image}
                propertyTitle={property.address || "Property"}
                latitude={property.latitude}
                longitude={property.longitude}
                postcode={property.postcode}
                address={property.address}
                bedrooms={property.bedrooms}
                listingType={property.listing_type}
              />
            </Card>
          </div>

          {/* Map + Quick Info */}
          <div className="md:col-span-1 lg:col-span-2 space-y-4">
            {/* Price & Key Info Card */}
            <Card className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-2 ${
                    property.listing_type === "rent" ? "bg-purple-600 text-white" : "bg-blue-600 text-white"
                  }`}>
                    {property.listing_type === "rent" ? "R2HMO" : "BUY"}
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{getPrice(property)}</p>
                </div>
                {property.deal_score != null && (
                  <div className={`flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-lg ${
                    property.deal_score >= 70 ? "bg-green-100 text-green-700" :
                    property.deal_score >= 40 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"
                  }`}>
                    <TrendingUp className="w-4 h-4" />
                    {property.deal_score}/100
                  </div>
                )}
              </div>

              {/* Specs */}
              <div className="flex items-center gap-4 text-sm text-slate-600 mb-3">
                {property.bedrooms != null && (
                  <span className="flex items-center gap-1">
                    <BedDouble className="w-4 h-4" /> {property.bedrooms} bed
                  </span>
                )}
                {property.bathrooms != null && (
                  <span className="flex items-center gap-1">
                    <Bath className="w-4 h-4" /> {property.bathrooms} bath
                  </span>
                )}
                {property.gross_internal_area_sqm != null && (
                  <span>{property.gross_internal_area_sqm} m²</span>
                )}
              </div>

              {/* Status badge */}
              {status && (
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
                  <status.icon className="w-3.5 h-3.5" />
                  {status.label}
                </div>
              )}

              {/* Address */}
              <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-slate-100">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-slate-700">{property.address}</p>
                  <p className="text-xs text-slate-500">{property.postcode}</p>
                </div>
              </div>
            </Card>

            {/* Hero Metrics */}
            <Card className="overflow-hidden">
              <HeroMetricsBar property={property} />
            </Card>

            {/* Location Map */}
            {property.latitude && property.longitude && (
              <Card className="overflow-hidden">
                <div className="p-3 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-teal-600" />
                    Location
                  </h3>
                </div>
                <MapErrorBoundary>
                  <PropertyLocationMap
                    latitude={property.latitude}
                    longitude={property.longitude}
                    address={property.address || undefined}
                    className="w-full h-[250px]"
                  />
                </MapErrorBoundary>
              </Card>
            )}
          </div>
        </div>

        {/* Full Details Section */}
        <div className="mt-6">
          <PropertyDetailCard
            property={property}
            onViewFullDetails={() => {}}
            className="w-full"
          />
        </div>
      </div>
    </div>
  )
}
