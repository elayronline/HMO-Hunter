import { SourceAdapter, type PropertyListing } from "@/lib/types/ingestion"

/**
 * LoopNet UK commercial listings, for the Class MA conversion route.
 *
 * WHY start URLs AND NOT THE SEARCH FIELDS
 *
 * The actor exposes `searchQuery` and a `State` enum, but the enum is US state
 * codes and free-text resolution runs through a token-gated geocoder. A probe on
 * 2026-09-02 for "Manchester, United Kingdom" failed with
 * `BLOCKED_NO_DATA — the lookup was SKIPPED and no search executed`, and the
 * actor's own log says a search URL in `startUrls` is "a fully token-free path".
 * So the UK route is a loopnet.co.uk search URL, and nothing here builds a query
 * from free text.
 *
 * WHY THE INPUT IS A LITERAL
 *
 * Three of this actor's billing events cost multiples of a result:
 * `property-detail` is $0.05 each — 100 of them is $5, an entire month of the
 * free tier in one run — and `agent-record` is $0.0035. They are off here as
 * hardcoded `false`, and no caller value is spread into the payload, so a
 * request cannot switch them on. A default would be a spending policy hidden in
 * code; the same argument that keeps `listingType` out of the Rightmove schema.
 */

/** Events that cost more than a result. Never enabled from a caller's input. */
const COST_GUARDED_OFF = {
  includeListingDetails: false,
  includePortfolioProperties: false,
  moreResults: false,
  instantDatabase: false,
  downloadImages: false,
  monitoringMode: false,
  enablePriceMonitoring: false,
  transactionTrackingMode: false,
} as const

/**
 * Types this ingest will carry, and what they become.
 *
 * Class MA runs from Use Class E only, so the filter is a planning test rather
 * than a preference. Industrial, warehousing, storage and land are B2/B8/sui
 * generis: there is no Class MA route from them at all, and carrying them into
 * a conversion segment would offer a permission that does not exist.
 *
 * The three values on the right are the only commercial members of
 * PropertyListing["property_type"], and they match COMMERCIAL_TYPES in
 * lib/properties/category.ts — which is what makes categorise() return
 * commercial_conversion and inSegment() put the row under the conversion tab.
 */
const CLASS_E_TYPES: ReadonlyArray<[RegExp, PropertyListing["property_type"]]> = [
  [/\boffice\b/i, "Office"],
  [/\b(retail|shop|store|showroom)\b/i, "Retail"],
  [/\b(restaurant|cafe|café|leisure|gym|medical|clinic|day nursery|creche|crèche)\b/i, "Commercial"],
]

/** Explicitly outside Class E. Listed so a rejection can say which word did it. */
const NOT_CLASS_E = /\b(industrial|warehouse|storage|distribution|land|garage|petrol|hotel|pub|marina|farm)\b/i

interface LoopNetItem {
  propertyId?: number | string
  listingUrl?: string
  listingName?: string
  description?: string
  listingType?: string
  photo?: string
  price?: number
  priceText?: number | string
  currency?: string
  brokerName?: string
  brokerCompany?: string
}

export class LoopNetAdapter extends SourceAdapter {
  name = "LoopNet"
  type = "partner_api" as const
  phase = 1 as const

  private apiToken: string
  private actorId = "memo23~loopnet-scraper-ppe"
  private baseUrl = "https://api.apify.com/v2"

  constructor(apiToken?: string) {
    super()
    this.apiToken = apiToken || process.env.APIFY_API_TOKEN || ""
  }

  /**
   * Ask before reporting a result. Every path here resolves empty when the token
   * is missing, which is indistinguishable from "no commercial stock matched" —
   * the same trap that had an unconfigured Zoopla ingest reporting "No listings
   * found" for Nottingham.
   */
  isConfigured(): boolean {
    return this.apiToken.length > 0
  }

  async fetch(options?: { searchUrl?: string; maxItems?: number }): Promise<PropertyListing[]> {
    if (!this.isConfigured()) {
      console.warn("[LoopNet] APIFY_API_TOKEN not configured")
      return []
    }

    const searchUrl =
      options?.searchUrl ?? "https://www.loopnet.co.uk/search/commercial-real-estate/united-kingdom/for-sale/"
    const maxItems = Math.min(options?.maxItems ?? 50, 100)

    const items = await this.runActor(searchUrl, maxItems)
    const listings: PropertyListing[] = []

    for (const item of items) {
      const mapped = await this.toListing(item)
      if (mapped) listings.push(mapped)
    }
    return listings
  }

  private async runActor(searchUrl: string, maxItems: number): Promise<LoopNetItem[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/acts/${this.actorId}/run-sync-get-dataset-items?token=${this.apiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Literal. Nothing from the caller reaches this object except the two
          // values above, both of which are bounded before they get here.
          body: JSON.stringify({
            startUrls: [{ url: searchUrl }],
            maxItems,
            ...COST_GUARDED_OFF,
          }),
          signal: AbortSignal.timeout(280_000),
        }
      )
      if (!response.ok) {
        console.error(`[LoopNet] actor run failed: ${response.status} ${await response.text()}`)
        return []
      }
      const data = await response.json()
      if (!Array.isArray(data)) {
        console.error("[LoopNet] actor returned an error object rather than items:", JSON.stringify(data).slice(0, 200))
        return []
      }
      return data as LoopNetItem[]
    } catch (error) {
      console.error("[LoopNet] fetch error:", error)
      return []
    }
  }

  /** "IG11 7HP" out of "13 Gascoigne Rd, Barking IG11 7HP". */
  static extractPostcode(text: string | undefined | null): string | null {
    if (!text) return null
    const m = text.toUpperCase().match(/\b([A-Z]{1,2}\d[\dA-Z]?)\s*(\d[A-Z]{2})\b/)
    return m ? `${m[1]} ${m[2]}` : null
  }

  /**
   * "31,250 sq ft" -> 2903 sqm. Recorded as information, never as a planning
   * gate: SI 2024/141 removed Class MA's 1,500 sqm ceiling on 5 March 2024.
   *
   * A RANGE RETURNS NULL. LoopNet writes multi-unit listings as
   * "4,571 - 6,692 sq ft", meaning units are available between those sizes —
   * there is no single floor area, and the building is not 6,692 sq ft. Taking
   * either end would publish a measurement no source made: the first draft of
   * this matched the number nearest "sq ft" and reported the Swindon listing as
   * 622 sqm on exactly that mistake. Absent is the honest answer.
   */
  static extractAreaSqm(description: string | undefined | null): number | null {
    if (!description) return null
    const flat = description.replace(/,/g, "")
    if (/\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?\s*sq\s*ft/i.test(flat)) return null
    const m = flat.match(/(\d+(?:\.\d+)?)\s*sq\s*ft/i)
    if (!m) return null
    const sqft = Number(m[1])
    return Number.isFinite(sqft) && sqft > 0 ? Math.round(sqft * 0.092903) : null
  }

  /** The Class E test. Returns null for anything with no Class MA route. */
  static classifyUse(description: string | undefined | null): PropertyListing["property_type"] | null {
    if (!description) return null
    if (NOT_CLASS_E.test(description)) return null
    for (const [pattern, type] of CLASS_E_TYPES) {
      if (pattern.test(description)) return type
    }
    return null
  }

  private async toListing(item: LoopNetItem): Promise<PropertyListing | null> {
    const id = item.propertyId != null ? String(item.propertyId) : null
    if (!id) return null

    // source_url is the reader's route back to the listing. A commercial
    // conversion is a six-figure decision taken partly on what this row says,
    // and a claim nobody can check against its source is not evidence.
    if (!item.listingUrl) {
      console.warn(`[LoopNet] skipping ${id}: no listingUrl to cite`)
      return null
    }

    // A US listing priced in dollars must never reach a column every downstream
    // calculation reads as sterling. The actor states the currency, so this is a
    // check rather than an inference — and absent is not GBP.
    if (item.price != null && item.currency !== "GBP") {
      console.warn(`[LoopNet] skipping ${id}: priced in ${item.currency ?? "an unstated currency"}, not GBP`)
      return null
    }

    const propertyType = LoopNetAdapter.classifyUse(item.description)
    if (!propertyType) return null

    const postcode = LoopNetAdapter.extractPostcode(item.listingName) ?? LoopNetAdapter.extractPostcode(item.description)
    if (!postcode) {
      console.warn(`[LoopNet] skipping ${id}: no postcode in "${item.listingName ?? ""}"`)
      return null
    }

    // LoopNet publishes no coordinates, so position comes from the postcode.
    // Unresolvable means no row: a property whose location nobody established
    // is not a property at the centre of a guess.
    const lookup = await this.lookupPostcode(postcode)
    if (!lookup) {
      console.warn(`[LoopNet] skipping ${id}: postcode ${postcode} did not resolve`)
      return null
    }

    return {
      title: item.listingName || `Commercial premises, ${postcode}`,
      address: item.listingName || postcode,
      postcode: this.normalizePostcode(postcode),
      // The local authority district, per PR #29 — the unit every other
      // question in this product is asked in, and the one that issues the
      // Article 4 direction Class MA turns on.
      city: lookup.district,
      latitude: lookup.lat,
      longitude: lookup.lng,
      listing_type: "purchase",
      property_type: propertyType,
      // Commercial premises have no bedrooms. Zero is the count, not a gap:
      // any room figure for this building is a proposal about a conversion that
      // has not happened, and conversion.ts already says so.
      bedrooms: 0,
      bathrooms: 0,
      // Price on application is routine in commercial. Null says no source
      // published one; a zero would read as free.
      purchase_price: typeof item.price === "number" && item.price > 0 ? item.price : undefined,
      description: item.description || undefined,
      images: item.photo ? [item.photo] : undefined,
      // See the note in rightmove-source.ts: the map reads primary_image
      // directly and does not fall back to images[0].
      primary_image: item.photo,
      external_id: `LN-${id}`,
      source_url: item.listingUrl,
    }
  }
}
