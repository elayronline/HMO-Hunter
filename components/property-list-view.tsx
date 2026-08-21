"use client"

import { useState, useMemo, memo } from "react"
import Link from "next/link"
import { useEffect, useRef } from "react"
import { BedDouble, Bath, MapPin, TrendingUp, ShieldCheck, HelpCircle, Clock, AlertTriangle, ExternalLink, Map as MapIcon, Maximize2 } from "lucide-react"
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
  /** Opens the detail panel beside the list, without leaving the workspace. */
  onPropertySelect?: (property: Property) => void
  /** Switches to the map, flies to this property and selects it. */
  onShowOnMap?: (property: Property) => void
  loading: boolean
  /**
   * Clears every filter. The map's empty state has always offered this; the
   * list's said only "No properties match your filters." and left the reader
   * to find the reset themselves. #21 made the list the default view, which
   * promoted the weaker of the two empty states to the one most people meet.
   */
  onResetFilters?: () => void
  savedPropertyIds: Set<string>
  /**
   * How many other properties share this one's exact coordinate. 452 of 2,958
   * sit on a point with at least one neighbour and the worst holds 20, so
   * "show on map" can land on a pile the reader cannot tell apart. The card
   * says so before they go rather than leaving them to work it out.
   */
  coincidentCounts?: Map<string, number>
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
/**
 * "HMO — licence expired" made two claims and only one of them was earned.
 *
 * That it was an HMO is sound: 77 of the 80 off-market properties carrying the
 * badge hold a council licence reference, and a council only licenses a
 * property being run as one. That the licence has expired was not: none of
 * those 80 came from the register saying so — 83 of the 98 badged properties
 * carry licence_status "active" — and the dates are a median of 0.7 years old
 * with nothing recording when the register was last read.
 *
 * So the label states what is recorded rather than what is true today, and the
 * register's own word gets its own, stronger label.
 */
function getUseBadge(property: Property) {
  const { licence } = categorise(property as CategorisableProperty)
  switch (licence) {
    case "licensed":
      return { label: "Existing HMO", icon: ShieldCheck, bg: "bg-teal-100", text: "text-teal-800" }
    case "licence_ending":
      return { label: "HMO — licence ending", icon: Clock, bg: "bg-amber-100", text: "text-amber-800" }
    case "licence_expired":
      // The register's own word, on 15 properties.
      return { label: "HMO — recorded as expired", icon: AlertTriangle, bg: "bg-red-100", text: "text-red-700" }
    case "licence_term_ended":
      // "Licensed HMO until Apr 2025" was the label here, and the tense was
      // wrong by construction: this state is reachable only when
      // daysToExpiry < 0 (categorise, category.ts), so the date printed is
      // ALWAYS in the past — a median of 0.7 years and up to 1.4 across the 82
      // properties holding it on 2026-08-21. It read as a present-tense claim
      // of licensing, with the only word doing the negating — "until" — the
      // quietest one in the label, and a badge is read at a glance.
      //
      // The refusal to say "expired" is deliberate and kept: the register did
      // not say that (83 of these carry licence_status "active") and the term
      // may have been renewed since we last read it. The past tense now sits in
      // the verb rather than a preposition, which is how getUseEvidence below
      // has always phrased it — "term ran out Apr 2025 · register has not said
      // it expired". The badge was the surface that lost the nuance.
      // The date is deliberately not repeated here. getUseEvidence prints
      // "Licence <ref> · term ran out Apr 2025 · register has not said it
      // expired" two lines below, and that line wraps in full while this pill
      // truncates inside the image overlay — so the truncating half is the
      // wrong place to carry the fact a reader needs to check against the
      // council register. Status here, evidence there, each said once.
      return {
        label: "HMO — licence term ended",
        icon: Clock,
        bg: "bg-amber-100",
        text: "text-amber-800",
      }
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
  // Three properties carry a date with no reference. Printing the date alone
  // offers something to act on with nothing to check it against.
  parts.push(ref ? `Licence ${ref}` : "No licence reference published")
  const end = licenceExpiry(property)
  if (end) {
    const d = new Date(end)
    if (!Number.isNaN(d.getTime())) {
      // "expired" here was our arithmetic, not the register's finding.
      parts.push(
        `${d < new Date() ? "term ran out" : "expires"} ${d.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
      )
    }
  }
  if (licence === "licence_term_ended") {
    // Once migration 017 is applied and a register read has happened, this can
    // say how old the reading is. Until then it says only that the register did
    // not make the claim — which is still more than the badge used to admit.
    const checked = property.licence_checked_at
    parts.push(
      checked && !Number.isNaN(new Date(checked).getTime())
        ? `register read ${new Date(checked).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}, not marked expired`
        : "register has not said it expired"
    )
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
  onPropertySelect,
  onShowOnMap,
  loading,
  savedPropertyIds,
  coincidentCounts,
  onResetFilters,
}: PropertyListViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("licence_expiry")
  const [page, setPage] = useState(1)

  // Reset to page 1 when the result set changes size — React's documented
  // "adjusting state when a prop changes" pattern. This was a setPage() inside
  // a useMemo, which is a set-state-during-render that can re-enter.
  const [prevPropertiesLength, setPrevPropertiesLength] = useState(properties.length)
  if (prevPropertiesLength !== properties.length) {
    setPrevPropertiesLength(properties.length)
    setPage(1)
  }

  const sorted = useMemo(() => {
    return [...properties].sort((a, b) => getSortValue(a, sortKey) - getSortValue(b, sortKey))
  }, [properties, sortKey])

  // A selection can arrive from outside the list — a marker click, or a
  // /map?property=<id> deep link — and the row may sit on a page that has not
  // been loaded yet. Reveal it.
  //
  // Adjusted during render rather than in an effect, matching the reset above:
  // an effect that sets state here paints the old page first and then jumps,
  // and the lint rule that forbids it is right about the cascading render.
  const rowRefs = useRef(new Map<string, HTMLDivElement | null>())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  if (selectedProperty && selectedProperty.id !== lastSelectedId) {
    setLastSelectedId(selectedProperty.id)
    const index = sorted.findIndex(p => p.id === selectedProperty.id)
    if (index >= 0) {
      const neededPage = Math.floor(index / PAGE_SIZE) + 1
      if (page < neededPage) setPage(neededPage)
    }
  }

  // Scrolling only — no state, so an effect is the right place for it. Waits a
  // frame so a newly revealed page has painted before the row is scrolled to.
  useEffect(() => {
    if (!selectedProperty) return
    const raf = requestAnimationFrame(() => {
      rowRefs.current.get(selectedProperty.id)?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [selectedProperty])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginatedProperties = useMemo(() => {
    return sorted.slice(0, page * PAGE_SIZE)
  }, [sorted, page])

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
        <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-[420px] animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
      </div>
    )
  }

  if (properties.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">
          No properties match your filters.
          {onResetFilters && (
            <button onClick={onResetFilters} className="ml-1 underline text-teal-700 hover:text-teal-800">
              Reset filters
            </button>
          )}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 min-h-0">
      {/* Sort bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 backdrop-blur-sm border-b border-slate-200 px-4 py-2.5">
        <p className="text-xs text-slate-500">
          <span className="font-semibold text-slate-700">{properties.length.toLocaleString()}</span> properties
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
      {/*
        Columns follow the CONTAINER, not the viewport.
        `xl:grid-cols-4` asked whether the window was >=1280px, but this list
        sits ~490px inside it (nav 215 + filters 232). At a 1280 viewport the
        container is 745px and still took four columns — 169px cards, on which
        every one of 24 sampled cards clipped its address. Opening the detail
        panel made it 171px without changing the count. auto-fill solves both
        cases at once and never goes below 220px.
      */}
      <div className="grid gap-3 p-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
        {paginatedProperties.map((property) => {
          const status = getUseBadge(property)
          const isSelected = selectedProperty?.id === property.id
          const isSaved = savedPropertyIds.has(property.id)
          const stacked = coincidentCounts?.get(property.id) ?? 0

          return (
            // The whole card is a link, but so is "View listing" — and an <a>
            // inside an <a> is invalid HTML that React reports as a hydration
            // error. The card link is an overlay sibling instead, so the two
            // are never nested.
            <div
              key={property.id}
              ref={(el) => { rowRefs.current.set(property.id, el) }}
              className={`group relative text-left rounded-xl border bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 focus-within:ring-2 focus-within:ring-teal-500 focus-within:ring-offset-1 ${
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
                  existingImages={property.images ?? undefined}
                  width={400}
                  height={200}
                  className="h-full w-full object-cover"
                />
                {/* Price badge */}
                <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-sm text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                  {getPrice(property)}
                </div>
                {/*
                  Listing type, and only where it adds something.

                  "OFF MARKET" here said the same words as the price slot below,
                  which falls back to "Off market" when there is no asking price
                  — and it lost the collision: measured at a 209px card, the
                  status pill (top-2 right-2, 171px wide) covered 72px of this
                  badge's 92px, 78% of it, at identical y. Two labels saying one
                  thing, and the redundant one was the one being obscured.

                  "FOR SALE" stays: there the price slot shows an actual price,
                  so the badge is the only thing naming the listing type.
                */}
                {property.listing_type === "purchase" && (
                  <div className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    FOR SALE
                  </div>
                )}
                {/* Status badge */}
                {status && (
                  <div className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full max-w-[calc(100%-1rem)] ${status.bg} ${status.text}`}>
                    <status.icon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{status.label}</span>
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
                  <p className="text-sm font-medium text-slate-800 line-clamp-2">{property.address}</p>
                </div>
                <p className="mt-0.5 ml-5 text-xs text-slate-500">{property.postcode}</p>

                {/* Article 4.
                    The list said nothing about it at all: 1,480 properties
                    inside a direction appeared here indistinguishable from the
                    rest, and the filter panel's own copy promised the
                    unestablished ones would be "shown, badged as unverified"
                    when no badge existed. On the map they are at least red.
                    Three states, and only none_found is a checked negative, so
                    only that one is allowed to say nothing. */}
                {property.article_4_status === "in_force" && (
                  <p className="mt-1.5 ml-5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                    <AlertTriangle className="w-3 h-3" />
                    Article 4 — planning permission required
                  </p>
                )}
                {property.article_4_status !== "in_force" &&
                  property.article_4_status !== "none_found" && (
                    <p className="mt-1.5 ml-5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      <HelpCircle className="w-3 h-3" />
                      Article 4 unverified
                    </p>
                  )}

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

                {/* External link. Sits above the card overlay below. */}
                {property.source_url && (
                  <a
                    href={property.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="relative z-10 mt-2 inline-flex items-center gap-1 text-[10px] text-teal-600 hover:text-teal-800 transition-colors"
                  >
                    View listing <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {/* Explicit journeys out of the list. Above the select overlay. */}
                <div className="relative z-10 mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
                  {onShowOnMap && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onShowOnMap(property) }}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                      title={stacked > 0
                        ? `Show on map — ${stacked} other ${stacked === 1 ? "property shares" : "properties share"} this exact location`
                        : "Show this property on the map"}
                    >
                      <MapIcon className="h-3.5 w-3.5" />
                      Show on map
                      {stacked > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
                          +{stacked} here
                        </span>
                      )}
                    </button>
                  )}
                  <Link
                    href={`/property/${property.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Full page
                  </Link>
                </div>
              </div>

              {/* Last in the DOM so it paints over the static content it covers.
                  A button, not a link: selecting opens the panel beside the
                  list and keeps the filters, the scroll position and the
                  loaded pages that a navigation would throw away. */}
              <button
                type="button"
                onClick={() => onPropertySelect?.(property)}
                aria-label={`Select ${property.address}`}
                aria-pressed={isSelected}
                className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              />
            </div>
          )
        })}
      </div>

      {/* Load More / Pagination */}
      {page < totalPages && (
        <div className="flex flex-col items-center gap-2 py-6 pb-8">
          <p className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-700">{paginatedProperties.length.toLocaleString()}</span> of{" "}
            <span className="font-semibold text-slate-700">{sorted.length.toLocaleString()}</span> properties
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
