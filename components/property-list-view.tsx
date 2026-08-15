"use client"

import { useState, useMemo, memo } from "react"
import Link from "next/link"
import { BedDouble, Bath, MapPin, TrendingUp, ShieldCheck, HelpCircle, Clock, AlertTriangle, ExternalLink } from "lucide-react"
import {
  categorise,
  licenceExpiry,
  licenceReference,
  type CategorisableProperty,
} from "@/lib/properties/category"
import { PropertyImage } from "@/components/property-image"
import type { Property } from "@/lib/types/database"

type SortKey = "licence_expiry" | "price_asc" | "price_desc" | "bedrooms_desc" | "newest"

const PAGE_SIZE = 48

interface PropertyListViewProps {
  properties: Property[]
  selectedProperty?: Property | null
  onPropertySelect?: (property: Property) => void
  loading: boolean
  savedPropertyIds: Set<string>
}

/**
 * Whether this is an HMO already, said on the card rather than left to be
 * discovered. It is the first thing that decides what the property is worth
 * doing about, and the card previously showed price, address and bedrooms —
 * none of which distinguish an operating HMO from a house that might become one.
 *
 * The licence state comes from categorise(), which derives it from the expiry
 * date rather than reading the stored status. Trusting the flag put ~83
 * properties on screen badged "Existing HMO" beside the words "expired Apr
 * 2025" — the same failure as a stored Article 4 force state, and the reason
 * neither is stored.
 */
function getUseBadge(property: Property) {
  const { licence } = categorise(property as CategorisableProperty)
  switch (licence) {
    case "licensed":
      return { label: "Existing HMO", icon: ShieldCheck, bg: "bg-teal-100", text: "text-teal-800" }
    case "licence_ending":
      return { label: "HMO — licence ending", icon: Clock, bg: "bg-amber-100", text: "text-amber-800" }
    case "licence_expired":
      return { label: "HMO — licence expired", icon: AlertTriangle, bg: "bg-red-100", text: "text-red-700" }
    case "licence_undated":
      return { label: "Existing HMO", icon: ShieldCheck, bg: "bg-teal-100", text: "text-teal-800" }
    default:
      return { label: "Not a recorded HMO", icon: HelpCircle, bg: "bg-slate-100", text: "text-slate-600" }
  }
}

/**
 * The evidence behind the badge, in one line. A label on its own is an
 * assertion; a licence reference and a date can be checked against the
 * council's register — which is the whole point, and the reason this reads
 * only the published columns.
 *
 * It used to prefer licence_id, licence_end_date and max_occupants, all three
 * of which are seed fiction (see licenceExpiry in lib/properties/category.ts).
 * That put an invented reference and an invented occupancy under a badge the
 * reader was being invited to verify, and on 109 cards the date printed here
 * was a different date from the one the badge above it was computed from.
 */
function getUseEvidence(property: Property): string {
  const { licence } = categorise(property as CategorisableProperty)
  if (licence === "unlicensed") return "No HMO licence on the register we hold"
  const parts: string[] = []
  const ref = licenceReference(property)
  if (ref) parts.push(`Licence ${ref}`)
  const end = licenceExpiry(property)
  if (end) {
    const d = new Date(end)
    if (!Number.isNaN(d.getTime())) {
      parts.push(
        `${d < new Date() ? "expired" : "expires"} ${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
      )
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "Licensed, but the register published no reference or dates"
}

function getPrice(property: Property) {
  if (property.listing_type === "purchase") {
    return property.purchase_price ? `£${property.purchase_price.toLocaleString()}` : "Price not published"
  }
  // Not on the market. Any monthly figure here is our own city-average estimate,
  // and printing it in the price slot would read as an asking price.
  return "Off market"
}

function getSortValue(property: Property, key: SortKey): number {
  switch (key) {
    // The default. A licence running out is the one ordering this product knows
    // and a portal does not, and it is a published date rather than an estimate.
    // Properties with no licence sort last rather than first: they are not
    // urgent, and floating them to the top on a missing value would be the
    // ordering equivalent of reading silence as an answer.
    //
    // Same date the badge uses. Ordering on licence_end_date first put 247 rows
    // in an order the badge above them contradicted, and did it on six seeded
    // dates rather than published ones.
    case "licence_expiry": {
      const raw = licenceExpiry(property)
      if (!raw) return Infinity
      const t = Date.parse(raw)
      return Number.isNaN(t) ? Infinity : t
    }
    // Price means asking price. price_pcm on an off-market record is our own
    // city-average estimate, so ordering by it would rank real prices against
    // figures we made up.
    case "price_asc":
      return property.purchase_price ?? Infinity
    case "price_desc":
      return property.purchase_price == null ? Infinity : -property.purchase_price
    case "bedrooms_desc":
      return -(property.bedrooms ?? 0)
    case "newest":
      return property.created_at ? -new Date(property.created_at).getTime() : 0
    default:
      return 0
  }
}

/**
 * "Highest Yield" was the default and has been removed.
 *
 * It sorted on property.rental_yield — a column that does not exist — so every
 * property scored zero and the list was never ordered at all, only labelled as
 * though it were. Even working, it would have ranked the whole list by a figure
 * derived from a city-average room rent, making an estimate the organising
 * principle of the page.
 */
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "licence_expiry", label: "Licence expiry: soonest" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "bedrooms_desc", label: "Most Bedrooms" },
  { value: "newest", label: "Newest First" },
]

export const PropertyListView = memo(function PropertyListView({
  properties,
  selectedProperty,
  loading,
  savedPropertyIds,
}: PropertyListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("licence_expiry")
  const [page, setPage] = useState(1)

  // Reset to page 1 when properties change
  const prevPropertiesLength = useMemo(() => properties.length, [properties])
  useMemo(() => {
    setPage(1)
  }, [prevPropertiesLength])

  const sorted = useMemo(() => {
    return [...properties].sort((a, b) => getSortValue(a, sortKey) - getSortValue(b, sortKey))
  }, [properties, sortKey])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginatedProperties = useMemo(() => {
    return sorted.slice(0, page * PAGE_SIZE)
  }, [sorted, page])

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
        {paginatedProperties.map((property) => {
          const status = getUseBadge(property)
          const isSelected = selectedProperty?.id === property.id
          const isSaved = savedPropertyIds.has(property.id)

          return (
            <Link
              key={property.id}
              href={`/property/${property.id}`}
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
                  property.listing_type === "purchase" ? "bg-blue-600 text-white" : "bg-slate-700 text-white"
                }`}>
                  {property.listing_type === "purchase" ? "FOR SALE" : "OFF MARKET"}
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

                {/* What justifies the badge above. */}
                <p className="mt-1.5 ml-5 text-[11px] leading-snug text-slate-500">
                  {getUseEvidence(property)}
                </p>

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
            </Link>
          )
        })}
      </div>

      {/* Load More / Pagination */}
      {page < totalPages && (
        <div className="flex flex-col items-center gap-2 py-6 pb-8">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{paginatedProperties.length}</span> of{" "}
            <span className="font-semibold text-slate-700">{sorted.length}</span> properties
          </p>
          <button
            onClick={() => setPage(p => p + 1)}
            className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
          >
            Load More ({sorted.length - paginatedProperties.length} remaining)
          </button>
        </div>
      )}
    </div>
  )
})
