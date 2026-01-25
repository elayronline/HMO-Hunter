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

  protected async geocode(address: string, postcode: string): Promise<{ lat: number; lng: number } | null> {
    // In production, use Google Maps Geocoding API or similar
    // For now, return mock coordinates in London
    return {
      lat: 51.5074 + (Math.random() - 0.5) * 0.1,
      lng: -0.1278 + (Math.random() - 0.5) * 0.1,
    }
  }
}

export abstract class EnrichmentAdapter {
  abstract name: string
  abstract type: "enrichment_api" | "partner_api"

  // Enrich existing property records with additional data
  abstract enrich(property: PropertyListing): Promise<Partial<PropertyListing>>
}
