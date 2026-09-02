import { SourceAdapter, type PropertyListing } from "@/lib/types/ingestion"

/**
 * Rightmove for-sale stock, via Apify (memo23/rightmove-scraper).
 *
 * Separate from lib/ingestion/adapters/rightmove.ts, which implements
 * EnrichmentAdapter: it matches a property we already hold to a listing and has
 * no fetch(). This one is a SourceAdapter — it brings stock in.
 *
 * WHY THE STRUCTURED FIELDS AND NOT A SEARCH URL
 *
 * The enrichment adapter hand-builds
 * `property-to-rent/find.html?locationIdentifier=POSTCODE^…`, which is both
 * hardcoded to rent and a URL format Rightmove does not document. The actor
 * accepts searchMode / searchLocation / searchMaxPrice / searchMinBedrooms
 * directly, so nothing here constructs a URL and the POSTCODE^ question never
 * arises.
 *
 * PURCHASE ONLY
 *
 * searchMode is the literal "propertySale". It is not a parameter, not a
 * default, and there is no code path to "propertyRent" — the same reasoning
 * that keeps listingType out of rightmoveIngestSchema. The actor's own default
 * is already propertySale, which is exactly why it is stated explicitly: a
 * sourcing policy that depends on someone else's default is not a policy.
 */

/**
 * Rightmove's sort order, stated rather than inherited.
 *
 * The actor defaults searchSort to "2", which is HIGHEST PRICE FIRST. Measured
 * on 2026-09-02 against Derby, ceiling £500k, 5 results each:
 *
 *   sort=1  →  110,000  130,000  130,000  130,000  280,000   (cheapest first)
 *   sort=2  →  449,000  500,000  500,000  500,000  500,000   (dearest first)
 *   sort=6  →  290,000  350,000  375,000  380,000  449,950   (newest listed)
 *
 * Taking the default means a bounded run returns the hundred dearest properties
 * under the ceiling: Birmingham came back with a lower quartile of £640,000
 * against a £650,000 cap. That is the same shape as the failure PR #25 fixed —
 * the bound was applied and the sample still came off the top of the market.
 *
 * "6" is the default here because it is the only one of the three that does not
 * bias the sample by price at all. Cheapest-first would bias the other way, and
 * the cheapest 4-bed stock in a city skews to auction and unmortgageable lots;
 * newest gives an unbiased spread within the bounds and favours stock a sourcer
 * can still act on.
 */
export const RIGHTMOVE_SORT_NEWEST = "6"

/** Billed above the per-result rate. Never reachable from a caller. */
const COST_GUARDED_OFF = {
  marketAnalysis: false,   // $0.15 per area, up to 8 areas — $1.20 in one run
  enrichEmails: false,     // billed per lookup
  moreDetails: false,      // $0.001 per additional-data event
  includeSaleHistory: false,
  instantDatabase: false,
  monitoringMode: false,
} as const

/**
 * A price qualifier that means the figure is not this property's asking price.
 *
 * Rightmove returns `price.secondary` as "Guide price", "Offers in excess of",
 * "From", or nothing. The first two are ways of stating THIS property's asking
 * price and are stored as one. "From" is not: it appears on new-build
 * developments and means the cheapest unit currently available in the scheme,
 * so writing it into purchase_price would attribute a price to a building no
 * source has priced. purchase_price means "a vendor is asking this".
 */
const NOT_AN_ASKING_PRICE = /^from$/i

/**
 * Order matters. "Studio apartment" is a studio, and testing Flat first matches
 * it on the word "apartment" — which is how the first draft of this classed one
 * as a Flat. The most specific description wins, so Studio is tested first.
 */
/**
 * Rightmove's radius is an enum of decimal strings, not a number.
 *
 * `String(3.0)` is "3" in JavaScript, and the actor rejects it:
 * `searchRadius must be equal to one of the allowed values: "0.0", "0.25", …`.
 * The API refused the whole run on validation, which is the good outcome — but
 * a caller passing 2 or 7 would otherwise be silently unrepresentable too, so
 * this snaps to the nearest rung Rightmove actually offers and formats it the
 * way the enum is written.
 *
 * A tie snaps DOWN — 2 miles sits exactly between the 1.0 and 3.0 rungs and
 * resolves to 1.0. The smaller radius keeps a city-targeted run inside its own
 * market rather than reaching into the neighbouring one, which is the whole
 * point of running tier by tier.
 */
const RIGHTMOVE_RADII = [0.0, 0.25, 0.5, 1.0, 3.0, 5.0, 10.0, 15.0, 20.0, 40.0] as const

export function snapRadius(miles: number): string {
  const nearest = RIGHTMOVE_RADII.reduce((best, r) =>
    Math.abs(r - miles) < Math.abs(best - miles) ? r : best
  )
  return nearest === 0.25 ? "0.25" : nearest.toFixed(1)
}

const TYPE_MAP: ReadonlyArray<[RegExp, PropertyListing["property_type"]]> = [
  [/\bstudio\b/i, "Studio"],
  [/\b(flat|apartment|maisonette)\b/i, "Flat"],
  [/\b(house|bungalow|cottage|terrac|semi|detached|mews|townhouse)\b/i, "House"],
]

interface RmItem {
  identifier?: number
  transactionType?: string
  bedrooms?: number
  bathrooms?: number
  address?: string
  postcode?: string
  propertyUrl?: string
  propertyDisplayType?: string
  propertyPhrase?: string
  fullDescription?: string
  listingUpdateReason?: string
  telephoneNumber?: string
  price?: { primary?: string; secondary?: string | null }
  stampDutyCalculator?: { price?: number }
  location?: { latitude?: number; longitude?: number; pinType?: string }
  branch?: { name?: string; brandName?: string }
  salesInfo?: { tenureType?: string }
  size?: { primary?: string; secondary?: string }
  photos?: Array<{ url?: string }>
  floorplans?: Array<{ url?: string }>
}

export class RightmoveSourceAdapter extends SourceAdapter {
  name = "Rightmove"
  type = "partner_api" as const
  phase = 1 as const

  private apiToken: string
  private actorId = "memo23~rightmove-scraper"
  private baseUrl = "https://api.apify.com/v2"

  constructor(apiToken?: string) {
    super()
    this.apiToken = apiToken || process.env.APIFY_API_TOKEN || ""
  }

  /** Ask before reporting: empty and unreachable are not the same answer. */
  isConfigured(): boolean {
    return this.apiToken.length > 0
  }

  async fetch(options?: {
    location?: string
    postcode?: string
    maxPrice?: number
    minBedrooms?: number
    maxBedrooms?: number
    minPrice?: number
    radiusMiles?: number
    maxItems?: number
  }): Promise<PropertyListing[]> {
    if (!this.isConfigured()) {
      console.warn("[Rightmove] APIFY_API_TOKEN not configured")
      return []
    }
    if (options?.maxPrice == null || options?.minBedrooms == null) {
      // The bound that stops a sale run returning the top of the market. #25
      // made these required in the schema; repeating the check here means the
      // adapter cannot be misused by a caller that bypasses it.
      console.warn("[Rightmove] refusing an unbounded sale run: maxPrice and minBedrooms are required")
      return []
    }

    const items = await this.runActor({
      searchMode: "propertySale",
      searchLocation: options.postcode ?? options.location ?? "",
      searchMaxPrice: String(options.maxPrice),
      searchMinBedrooms: String(options.minBedrooms),
      ...(options.minPrice != null ? { searchMinPrice: String(options.minPrice) } : {}),
      ...(options.maxBedrooms != null ? { searchMaxBedrooms: String(options.maxBedrooms) } : {}),
      searchRadius: snapRadius(options.radiusMiles ?? 3.0),
      searchSort: RIGHTMOVE_SORT_NEWEST,
      maxItems: Math.min(options.maxItems ?? 100, 100),
      ...COST_GUARDED_OFF,
    })

    const out: PropertyListing[] = []
    for (const item of items) {
      const mapped = await this.toListing(item)
      if (mapped) out.push(mapped)
    }
    return out
  }

  private async runActor(input: Record<string, unknown>): Promise<RmItem[]> {
    try {
      const res = await fetch(
        `${this.baseUrl}/acts/${this.actorId}/run-sync-get-dataset-items?token=${this.apiToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(280_000),
        }
      )
      if (!res.ok) {
        console.error(`[Rightmove] actor run failed: ${res.status} ${await res.text()}`)
        return []
      }
      const data = await res.json()
      if (!Array.isArray(data)) {
        console.error("[Rightmove] actor returned an error:", JSON.stringify(data).slice(0, 200))
        return []
      }
      return data as RmItem[]
    } catch (e) {
      console.error("[Rightmove] fetch error:", e)
      return []
    }
  }

  static mapType(item: { propertyDisplayType?: string; propertyPhrase?: string }): PropertyListing["property_type"] {
    const text = `${item.propertyDisplayType ?? ""} ${item.propertyPhrase ?? ""}`
    for (const [re, type] of TYPE_MAP) if (re.test(text)) return type
    return "House"
  }

  /** "123 sq m" -> 123. Rightmove gives metric in `size.secondary`. */
  static areaSqm(size: { secondary?: string } | undefined): number | null {
    const m = size?.secondary?.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*sq\s*m/i)
    return m ? Math.round(Number(m[1])) : null
  }

  /**
   * The asking price, or null where the qualifier says the figure is not one.
   * See NOT_AN_ASKING_PRICE.
   */
  static askingPrice(item: RmItem): number | undefined {
    const numeric = item.stampDutyCalculator?.price
    if (typeof numeric !== "number" || numeric <= 0) return undefined
    const qualifier = item.price?.secondary ?? ""
    if (NOT_AN_ASKING_PRICE.test(qualifier.trim())) return undefined
    return numeric
  }

  private async toListing(item: RmItem): Promise<PropertyListing | null> {
    if (item.identifier == null) return null
    if (item.transactionType && item.transactionType.toUpperCase() !== "BUY") return null
    if (!item.postcode || !item.propertyUrl) return null

    const lat = item.location?.latitude
    const lng = item.location?.longitude
    if (typeof lat !== "number" || typeof lng !== "number") return null

    // Rightmove publishes the local authority nowhere, so the district comes
    // from the postcode — the same lookup that already supplies it for every
    // other source since PR #29.
    const lookup = await this.lookupPostcode(item.postcode)

    const qualifier = item.price?.secondary?.trim() || null
    const approximate = item.location?.pinType === "APPROXIMATE_POINT"

    /*
     * Provenance the schema has no column for, recorded where a reader will see
     * it rather than dropped. `price_qualifier` and `pin_accuracy` are the right
     * home for these and do not exist yet; until they do, silently discarding
     * them would leave "Guide price" and a fixed asking price indistinguishable,
     * and an approximate pin looking as exact as a surveyed one.
     */
    const provenance = [
      qualifier ? `Price qualifier: ${qualifier}.` : null,
      approximate ? "Rightmove reports this location as approximate, not exact." : null,
    ].filter(Boolean).join(" ")

    const description = [item.fullDescription?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), provenance]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 4000)

    return {
      title: item.propertyPhrase || item.address || `Property ${item.identifier}`,
      address: item.address || item.postcode,
      postcode: this.normalizePostcode(item.postcode),
      city: lookup?.district ?? null,
      latitude: lat,
      longitude: lng,
      listing_type: "purchase",
      property_type: RightmoveSourceAdapter.mapType(item),
      bedrooms: item.bedrooms ?? 0,
      bathrooms: item.bathrooms ?? 0,
      purchase_price: RightmoveSourceAdapter.askingPrice(item),
      description: description || undefined,
      images: item.photos?.map((p) => p.url).filter((u): u is string => !!u),
      // The map passes primary_image straight to the gallery with no fallback
      // to images[0] (app/map/page.tsx:1844), so a row with photos but no
      // primary_image renders as a blank card. Set it at ingest rather than
      // leaving every consumer to remember the fallback.
      primary_image: item.photos?.[0]?.url,
      floor_plans: item.floorplans?.map((p) => p.url).filter((u): u is string => !!u),
      external_id: `RM-${item.identifier}`,
      source_url: item.propertyUrl,
    }
  }
}
