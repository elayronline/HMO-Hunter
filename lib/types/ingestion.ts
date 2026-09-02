import type { Director, PlanningConstraint } from "./database"

export interface PropertyListing {
  title: string
  address: string
  postcode: string
  /**
   * The local authority district, or null when the postcode did not resolve to
   * one. Nullable deliberately: an unplaced property is not a property in some
   * other authority, and the column's whole problem was values invented to
   * avoid an empty cell. See getDistrictFromPostcode.
   */
  city: string | null
  latitude: number
  longitude: number
  price_pcm?: number
  purchase_price?: number
  listing_type: "rent" | "purchase"
  /**
   * Commercial types are carried so a conversion opportunity can be ingested at
   * all. They are not homes and are never judged as such — categorise() reads
   * them as commercial_conversion, and the assessment in
   * lib/properties/conversion.ts judges the planning route rather than the
   * property.
   */
  property_type: "HMO" | "Flat" | "House" | "Studio" | "Commercial" | "Office" | "Retail"
  bedrooms: number
  bathrooms: number
  description?: string
  images?: string[]
  /**
   * The one image a card shows. Separate from images[] because the map passes
   * it straight to the gallery without falling back to images[0]
   * (app/map/page.tsx:1844), so a row with photos and no primary_image renders
   * blank. An adapter that has photos should set both.
   */
  primary_image?: string
  floor_plans?: string[]
  is_furnished?: boolean
  is_student_friendly?: boolean
  is_pet_friendly?: boolean
  has_garden?: boolean
  wifi_included?: boolean
  near_tube_station?: boolean
  available_from?: string
  external_id: string
  source_url: string
  // Phase 1 - HMO Licence Data
  licence_id?: string
  licence_start_date?: string
  licence_end_date?: string
  licence_status?: "active" | "expired" | "pending" | "none"
  max_occupants?: number
  // Phase 2 - Enrichment Data
  uprn?: string
  year_built?: number
  property_age?: string
  estimated_value?: number
  rental_yield?: number
  area_population?: number
  area_avg_rent?: number
  // Phase 3 - Owner/Contact Information
  owner_name?: string
  owner_address?: string
  owner_type?: "individual" | "company" | "trust" | "government" | "unknown"
  owner_contact_email?: string
  owner_contact_phone?: string
  // Phase 3 - Company Information (for corporate landlords)
  company_name?: string
  company_number?: string
  company_status?: string
  company_incorporation_date?: string
  directors?: Director[]
  // Phase 3 - EPC Data
  epc_rating?: "A" | "B" | "C" | "D" | "E" | "F" | "G"
  epc_rating_numeric?: number
  epc_certificate_url?: string
  epc_expiry_date?: string
  // Phase 3 - Planning Constraints
  article_4_area?: boolean
  planning_constraints?: PlanningConstraint[]
  conservation_area?: boolean
  listed_building_grade?: "I" | "II*" | "II"
  // Phase 3 - Enrichment Tracking
  title_number?: string
  title_last_enriched_at?: string
  owner_enrichment_source?: string
  // Phase 5 - Broadband/Connectivity Data
  broadband_basic_down?: number
  broadband_basic_up?: number
  broadband_superfast_down?: number
  broadband_superfast_up?: number
  broadband_ultrafast_down?: number
  broadband_ultrafast_up?: number
  broadband_max_down?: number
  broadband_max_up?: number
  has_fiber?: boolean
  has_superfast?: boolean
  broadband_last_checked?: string
  // Agent/Estate Agent Contact Info
  agent_name?: string
  agent_phone?: string
  agent_email?: string
  agent_address?: string
  agent_logo?: string
  agent_profile_url?: string
  // Floor area from listing
  floor_area_sqft?: number
}

export interface IngestionSource {
  name: string
  type: "hmo_register" | "enrichment_api" | "partner_api"
  phase: 1 | 2 // Phase 1 = core data, Phase 2 = enrichment
  enabled: boolean
  config: Record<string, any>
}

export interface IngestionResult {
  source: string
  total: number
  created: number
  updated: number
  skipped: number
  errors: string[]
  duration_ms: number
  timestamp: Date
}

/**
 * One postcodes.io lookup, cached. The coordinates and the district come from
 * the same response, so asking for one and then the other would be two calls
 * for a payload we already hold.
 */
type PostcodeLookup = {
  lat: number
  lng: number
  /** `admin_district`: the local authority. Null when the API did not supply one. */
  district: string | null
}

export abstract class SourceAdapter {
  abstract name: string
  abstract type: "hmo_register" | "enrichment_api" | "partner_api"
  abstract phase: 1 | 2

  abstract fetch(): Promise<PropertyListing[]>

  protected normalizePostcode(postcode: string): string {
    return postcode.toUpperCase().replace(/\s+/g, " ").trim()
  }

  /**
   * The local authority district a postcode sits in, or null.
   *
   * This is what `city` holds now, and it holds nothing else. The column used
   * to be a mixture: Zoopla's `county` on some rows, a post town on others, and
   * a guess from the postcode on the rest, so "Berkshire" and "Reading" both
   * appeared in a column the map then matched on exactly. PR #28 stopped the
   * filter reading it; this stops the mixture being written.
   *
   * The district is the right unit for this product rather than merely a
   * consistent one: it is the body that issues HMO licences and makes Article 4
   * directions, so it is the unit every other question here is already asked in.
   *
   * Note for London: districts are boroughs, so a postcode in NW5 resolves to
   * "Camden" rather than "London". That is a real change in what the column
   * says, and the right one — "London" was never the licensing authority for
   * anything.
   *
   * WHAT THIS REPLACES, and why none of it survived. `getCityFromPostcode`
   * took the first two letters of the postcode, looked them up in a 21-entry
   * table, and **fell back to the first letter alone** when that missed. A UK
   * postcode area is the letters before the first digit — "SO16" is area SO,
   * not S — so the fallback did not degrade, it fabricated:
   *
   *     SO -> "Sheffield" (126 rows)   BN -> "Birmingham" (107)
   *     EX -> "London" (37)            SP -> "Sheffield" (9)
   *     BR -> "Birmingham" (8)         LL -> "Liverpool" (3)
   *
   * Five rows in the table still carried one of those on 2026-08-21 (2 SO rows
   * reading "Sheffield", 3 LL rows in North Wales reading "Liverpool"); the
   * rest were saved only by Zoopla having supplied a county. The PropertyData
   * adapter had no county to fall back on and called it directly.
   *
   * The table also mapped BT to Belfast, and BT is the postcode area for the
   * whole of Northern Ireland — Derry, Lisburn and Newry included.
   *
   * A table of areas could have been repaired, but a postcode area is not a
   * district either (M covers Salford and Stockport), so repairing it would
   * have left the column mixed in a subtler way. postcodes.io answers the
   * actual question, this class already calls it to geocode, and the district
   * arrives in the same response that the coordinates do — it was being
   * fetched and discarded.
   */
  protected async getDistrictFromPostcode(postcode: string): Promise<string | null> {
    const lookup = await this.lookupPostcode(postcode)
    return lookup?.district ?? null
  }

  // Cache for address lookups to avoid repeated API calls
  private static addressCache: Map<string, { lat: number; lng: number }> = new Map()
  private static postcodeCache: Map<string, PostcodeLookup> = new Map()

  // Rate limiter for Nominatim (max 1 request per second)
  private static lastNominatimCall = 0

  private static async rateLimitNominatim(): Promise<void> {
    const now = Date.now()
    const timeSinceLastCall = now - SourceAdapter.lastNominatimCall
    if (timeSinceLastCall < 1100) {
      await new Promise(resolve => setTimeout(resolve, 1100 - timeSinceLastCall))
    }
    SourceAdapter.lastNominatimCall = Date.now()
  }

  /**
   * Geocode a property address to exact coordinates
   * Uses multiple strategies:
   * 1. Full address geocoding via Nominatim (most accurate)
   * 2. Postcode centroid via postcodes.io (fallback)
   * 3. Adds small offset if multiple properties at same location
   */
  protected async geocode(address: string, postcode: string): Promise<{ lat: number; lng: number } | null> {
    if (!address && !postcode) return null

    // Create cache key from full address + postcode
    const cacheKey = `${address}|${postcode}`.toLowerCase().replace(/\s+/g, " ").trim()

    // Check address cache first
    if (SourceAdapter.addressCache.has(cacheKey)) {
      return SourceAdapter.addressCache.get(cacheKey)!
    }

    // Strategy 1: Try full address geocoding via Nominatim (OpenStreetMap)
    if (address && postcode) {
      const addressCoords = await this.geocodeAddress(address, postcode)
      if (addressCoords) {
        SourceAdapter.addressCache.set(cacheKey, addressCoords)
        return addressCoords
      }
    }

    // Strategy 2: Fall back to postcode centroid
    const postcodeCoords = await this.geocodePostcode(postcode)
    if (postcodeCoords) {
      // Add small random offset so properties don't stack exactly
      const offset = this.generateOffset(address)
      const coords = {
        lat: postcodeCoords.lat + offset.lat,
        lng: postcodeCoords.lng + offset.lng,
      }
      SourceAdapter.addressCache.set(cacheKey, coords)
      return coords
    }

    return null
  }

  /**
   * Geocode full address using Nominatim (OpenStreetMap)
   * More accurate than postcode-only geocoding
   */
  private async geocodeAddress(address: string, postcode: string): Promise<{ lat: number; lng: number } | null> {
    try {
      await SourceAdapter.rateLimitNominatim()

      // Clean and format address for geocoding
      const cleanAddress = address
        .replace(/flat\s*\d+[a-z]?\s*,?\s*/gi, "") // Remove flat numbers
        .replace(/apartment\s*\d+[a-z]?\s*,?\s*/gi, "")
        .replace(/unit\s*\d+[a-z]?\s*,?\s*/gi, "")
        .replace(/\s+/g, " ")
        .trim()

      // Format query: address, postcode, United Kingdom
      const query = `${cleanAddress}, ${postcode}, United Kingdom`

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=gb&addressdetails=1`,
        {
          headers: {
            "User-Agent": "HMO-Hunter-App/1.0 (contact@hmohunter.com)",
            "Accept": "application/json",
          },
        }
      )

      if (response.ok) {
        const results = await response.json()
        if (results && results.length > 0) {
          const result = results[0]
          const lat = parseFloat(result.lat)
          const lng = parseFloat(result.lon)

          if (!isNaN(lat) && !isNaN(lng)) {
            console.log(`[Geocode] Address match: "${cleanAddress}" -> ${lat}, ${lng}`)
            return { lat, lng }
          }
        }
      }

      // Try with just street name and postcode
      const streetMatch = cleanAddress.match(/\d+[a-z]?\s+(.+)/i)
      if (streetMatch) {
        await SourceAdapter.rateLimitNominatim()

        const streetQuery = `${streetMatch[1]}, ${postcode}, United Kingdom`
        const response2 = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(streetQuery)}&format=json&limit=1&countrycodes=gb`,
          {
            headers: {
              "User-Agent": "HMO-Hunter-App/1.0 (contact@hmohunter.com)",
              "Accept": "application/json",
            },
          }
        )

        if (response2.ok) {
          const results2 = await response2.json()
          if (results2 && results2.length > 0) {
            const lat = parseFloat(results2[0].lat)
            const lng = parseFloat(results2[0].lon)
            if (!isNaN(lat) && !isNaN(lng)) {
              // Add small offset based on house number
              const houseNum = parseInt(cleanAddress.match(/^(\d+)/)?.[1] || "0")
              const houseOffset = (houseNum % 100) * 0.00001
              console.log(`[Geocode] Street match with house offset: "${streetMatch[1]}" -> ${lat + houseOffset}, ${lng}`)
              return { lat: lat + houseOffset, lng }
            }
          }
        }
      }
    } catch (error) {
      console.error(`[Geocode] Nominatim error for "${address}":`, error)
    }

    return null
  }

  /**
   * Geocode postcode centroid using postcodes.io (UK only)
   */
  private async geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
    const lookup = await this.lookupPostcode(postcode)
    return lookup ? { lat: lookup.lat, lng: lookup.lng } : null
  }

  /**
   * One postcodes.io call, cached, returning everything this class reads from
   * it. Split out from geocodePostcode because the district and the coordinates
   * arrive together and the district used to be dropped on the floor.
   *
   * A missing district is null rather than a guess. postcodes.io resolved 199
   * of 200 sampled live postcodes on 2026-08-21, so this is not a common path,
   * but an unresolvable postcode has to leave the column empty: a property
   * whose authority nobody established is not a property in some other
   * authority.
   */
  protected async lookupPostcode(postcode: string): Promise<PostcodeLookup | null> {
    if (!postcode) return null

    const normalizedPostcode = postcode.toUpperCase().replace(/\s+/g, "").trim()

    if (SourceAdapter.postcodeCache.has(normalizedPostcode)) {
      return SourceAdapter.postcodeCache.get(normalizedPostcode)!
    }

    // postcodes.io wants the space for some inputs and tolerates it for the
    // rest, so the spaced form is the retry rather than the first attempt.
    const spacedPostcode = normalizedPostcode.length > 4
      ? `${normalizedPostcode.slice(0, -3)} ${normalizedPostcode.slice(-3)}`
      : normalizedPostcode

    for (const candidate of [normalizedPostcode, spacedPostcode]) {
      try {
        const response = await fetch(
          `https://api.postcodes.io/postcodes/${encodeURIComponent(candidate)}`
        )
        if (!response.ok) continue
        const data = await response.json()
        if (data.status === 200 && data.result) {
          const lookup: PostcodeLookup = {
            lat: data.result.latitude,
            lng: data.result.longitude,
            district: data.result.admin_district ?? null,
          }
          SourceAdapter.postcodeCache.set(normalizedPostcode, lookup)
          return lookup
        }
      } catch (error) {
        console.error(`[Geocode] postcodes.io error for ${candidate}:`, error)
      }
      if (candidate === spacedPostcode) break
    }

    return null
  }

  /**
   * Generate a small, deterministic offset based on address
   * This prevents properties at the same postcode from stacking exactly on top of each other
   */
  private generateOffset(address: string): { lat: number; lng: number } {
    if (!address) return { lat: 0, lng: 0 }

    // Generate a hash from the address for consistent offset
    let hash = 0
    for (let i = 0; i < address.length; i++) {
      const char = address.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }

    // Create small offset (roughly ±50 meters)
    const latOffset = ((hash % 100) - 50) * 0.00005
    const lngOffset = (((hash >> 8) % 100) - 50) * 0.00005

    return { lat: latOffset, lng: lngOffset }
  }
}

export abstract class EnrichmentAdapter {
  abstract name: string
  abstract type: "enrichment_api" | "partner_api"

  // Enrich existing property records with additional data
  abstract enrich(property: PropertyListing): Promise<Partial<PropertyListing>>
}
