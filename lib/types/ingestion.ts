import type { Director, PlanningConstraint } from "./database"

export interface PropertyListing {
  title: string
  address: string
  postcode: string
  city: string
  latitude: number
  longitude: number
  price_pcm?: number
  purchase_price?: number
  listing_type: "rent" | "purchase"
  property_type: "HMO" | "Flat" | "House" | "Studio"
  bedrooms: number
  bathrooms: number
  description?: string
  images?: string[]
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

export abstract class SourceAdapter {
  abstract name: string
  abstract type: "hmo_register" | "enrichment_api" | "partner_api"
  abstract phase: 1 | 2

  abstract fetch(): Promise<PropertyListing[]>

  protected normalizePostcode(postcode: string): string {
    return postcode.toUpperCase().replace(/\s+/g, " ").trim()
  }

  // Map postcode prefix to city
  protected getCityFromPostcode(postcode: string): string {
    const prefix = postcode.toUpperCase().replace(/\s+/g, "").slice(0, 2)
    const singlePrefix = prefix.slice(0, 1)

    // UK postcode area to city mapping
    const postcodeToCity: Record<string, string> = {
      // London areas
      "E": "London", "EC": "London", "N": "London", "NW": "London",
      "SE": "London", "SW": "London", "W": "London", "WC": "London",
      // Manchester
      "M": "Manchester",
      // Birmingham
      "B": "Birmingham",
      // Leeds
      "LS": "Leeds",
      // Liverpool
      "L": "Liverpool",
      // Newcastle
      "NE": "Newcastle",
      // Nottingham
      "NG": "Nottingham",
      // Sheffield
      "S": "Sheffield",
      // Bristol
      "BS": "Bristol",
      // Leicester
      "LE": "Leicester",
      // Cardiff
      "CF": "Cardiff",
      // Edinburgh
      "EH": "Edinburgh",
      // Glasgow
      "G": "Glasgow",
      // Belfast
      "BT": "Belfast",
    }

    // Try two-letter prefix first, then single letter
    return postcodeToCity[prefix] || postcodeToCity[singlePrefix] || "Unknown"
  }

  // Cache for postcode lookups to avoid repeated API calls
  private static postcodeCache: Map<string, { lat: number; lng: number }> = new Map()

  protected async geocode(address: string, postcode: string): Promise<{ lat: number; lng: number } | null> {
    if (!postcode) return null

    const normalizedPostcode = postcode.toUpperCase().replace(/\s+/g, "").trim()

    // Check cache first
    if (SourceAdapter.postcodeCache.has(normalizedPostcode)) {
      return SourceAdapter.postcodeCache.get(normalizedPostcode)!
    }

    try {
      // Use postcodes.io - free UK postcode geocoding API
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(normalizedPostcode)}`)

      if (response.ok) {
        const data = await response.json()
        if (data.status === 200 && data.result) {
          const coords = {
            lat: data.result.latitude,
            lng: data.result.longitude,
          }
          // Cache the result
          SourceAdapter.postcodeCache.set(normalizedPostcode, coords)
          return coords
        }
      }

      // Try with space in postcode (e.g., "N7 6PA")
      const spacedPostcode = normalizedPostcode.length > 4
        ? `${normalizedPostcode.slice(0, -3)} ${normalizedPostcode.slice(-3)}`
        : normalizedPostcode

      const response2 = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(spacedPostcode)}`)
      if (response2.ok) {
        const data2 = await response2.json()
        if (data2.status === 200 && data2.result) {
          const coords = {
            lat: data2.result.latitude,
            lng: data2.result.longitude,
          }
          SourceAdapter.postcodeCache.set(normalizedPostcode, coords)
          return coords
        }
      }
    } catch (error) {
      console.error(`[Geocode] Error geocoding postcode ${postcode}:`, error)
    }

    return null
  }
}

export abstract class EnrichmentAdapter {
  abstract name: string
  abstract type: "enrichment_api" | "partner_api"

  // Enrich existing property records with additional data
  abstract enrich(property: PropertyListing): Promise<Partial<PropertyListing>>
}
