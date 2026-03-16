"use client"

import { useState, useMemo } from "react"
import { BedDouble, Bath, MapPin, TrendingUp, ShieldCheck, Clock, AlertTriangle, ChevronUp, ChevronDown, ExternalLink } from "lucide-react"
import { PropertyImage } from "@/components/property-image"
import { SavePropertyButton } from "@/components/save-property-button"
import type { Property } from "@/lib/types/database"

type SortKey = "price_asc" | "price_desc" | "yield_desc" | "bedrooms_desc" | "deal_score_desc" | "newest"

interface PropertyListViewProps {
  properties: Property[]
  selectedProperty: Property | null
  onPropertySelect: (property: Property) => void
  loading: boolean
  savedPropertyIds: Set<string>
  onSaveToggle?: (propertyId: string) => void
  userRole?: string | null
}

function getStatusBadge(property: Property) {
  if (property.licence_status === "active") {
    return { label: "Licensed", icon: ShieldCheck, bg: "bg-teal-100", text: "text-teal-700" }
  }
  if (property.licence_status === "expired") {
    return { label: "Expired", icon: Clock, bg: "bg-amber-100", text: "text-amber-700" }
  }
  if (property.article4_zone) {
    return { label: "Article 4", icon: AlertTriangle, bg: "bg-red-100", text: "text-red-600" }
  }
  return null
}

function getPrice(property: Property) {
  if (property.listing_type === "purchase") {
    return property.purchase_price ? `£${property.purchase_price.toLocaleString()}` : "POA"
  }
  return property.price_pcm ? `£${property.price_pcm.toLocaleString()}/mo` : "POA"
}

function getSortValue(property: Property, key: SortKey): number {
  switch (key) {
    case "price_asc":
      return property.listing_type === "purchase"
        ? (property.purchase_price ?? Infinity)
        : (property.price_pcm ?? Infinity)
    case "price_desc":
      return -(property.listing_type === "purchase"
        ? (property.purchase_price ?? 0)
        : (property.price_pcm ?? 0))
    case "yield_desc":
      return -(property.rental_yield ?? 0)
    case "bedrooms_desc":
      return -(property.bedrooms ?? 0)
    case "deal_score_desc":
      return -(property.deal_score ?? 0)
    case "newest":
      return property.created_at ? -new Date(property.created_at).getTime() : 0
    default:
      return 0
  }
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "deal_score_desc", label: "Best Deal Score" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "yield_desc", label: "Highest Yield" },
  { value: "bedrooms_desc", label: "Most Bedrooms" },
  { value: "newest", label: "Newest First" },
]

export function PropertyListView({
  properties,
  selectedProperty,
  onPropertySelect,
  loading,
  savedPropertyIds,
}: PropertyListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("deal_score_desc")

  const sorted = useMemo(() => {
    return [...properties].sort((a, b) => getSortValue(a, sortKey) - getSortValue(b, sortKey))
  }, [properties, sortKey])

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">No properties match your filters.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-0">
      {/* Sort bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-2.5">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{properties.length}</span> properties
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="sort-select" className="text-xs text-slate-500">Sort by</label>
          <select
            id="sort-select"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Property grid */}
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sorted.map((property) => {
          const status = getStatusBadge(property)
          const isSelected = selectedProperty?.id === property.id
          const isSaved = savedPropertyIds.has(property.id)

          return (
            <button
              key={property.id}
              onClick={() => onPropertySelect(property)}
              className={`group relative text-left rounded-xl border bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-1 ${
                isSelected ? "border-teal-500 ring-1 ring-teal-500" : "border-slate-200"
              }`}
            >
              {/* Image */}
              <div className="relative h-36 overflow-hidden rounded-t-xl bg-slate-100">
                <PropertyImage
                  address={property.address}
                  postcode={property.postcode}
                  latitude={property.latitude}
                  longitude={property.longitude}
                  bedrooms={property.bedrooms}
                  listingType={property.listing_type}
                  existingImages={property.images}
                  width={400}
                  height={200}
                  className="h-full w-full object-cover"
                />
                {/* Price badge */}
                <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                  {getPrice(property)}
                </div>
                {/* Listing type badge */}
                <div className={`absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                  property.listing_type === "rent" ? "bg-purple-600 text-white" : "bg-blue-600 text-white"
                }`}>
                  {property.listing_type === "rent" ? "R2HMO" : "BUY"}
                </div>
                {/* Status badge */}
                {status && (
                  <div className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}>
                    <status.icon className="w-3 h-3" />
                    {status.label}
                  </div>
                )}
                {/* Save indicator */}
                {isSaved && (
                  <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1">
                    <svg className="w-3.5 h-3.5 text-red-500 fill-current" viewBox="0 0 24 24">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="p-3">
                {/* Address */}
                <div className="flex items-start gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium text-slate-800 line-clamp-1">{property.address}</p>
                </div>
                <p className="mt-0.5 ml-5 text-xs text-slate-500">{property.postcode}</p>

                {/* Specs row */}
                <div className="mt-2.5 flex items-center gap-3 text-xs text-slate-600">
                  {property.bedrooms != null && (
                    <span className="flex items-center gap-1">
                      <BedDouble className="w-3.5 h-3.5" /> {property.bedrooms}
                    </span>
                  )}
                  {property.bathrooms != null && (
                    <span className="flex items-center gap-1">
                      <Bath className="w-3.5 h-3.5" /> {property.bathrooms}
                    </span>
                  )}
                  {property.gross_internal_area_sqm != null && (
                    <span>{property.gross_internal_area_sqm} m²</span>
                  )}
                </div>

                {/* Metrics row */}
                <div className="mt-2.5 flex items-center gap-3">
                  {property.deal_score != null && (
                    <span className={`flex items-center gap-1 text-xs font-semibold ${
                      property.deal_score >= 70 ? "text-green-600" :
                      property.deal_score >= 40 ? "text-amber-600" : "text-red-500"
                    }`}>
                      <TrendingUp className="w-3.5 h-3.5" />
                      {property.deal_score}/100
                    </span>
                  )}
                  {property.rental_yield != null && (
                    <span className="text-xs text-teal-700 font-medium">
                      {property.rental_yield.toFixed(1)}% yield
                    </span>
                  )}
                </div>

                {/* External link */}
                {property.url && (
                  <a
                    href={property.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-[10px] text-teal-600 hover:text-teal-800 transition-colors"
                  >
                    View listing <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
