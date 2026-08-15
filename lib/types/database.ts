import type { Article4Status } from "@/lib/article4/coverage"

export type { Article4Status }

export type Property = {
  id: string
  title: string
  address: string
  postcode: string
  city: string
  country: string
  latitude: number
  longitude: number
  listing_type: "rent" | "purchase"
  price_pcm: number | null
  purchase_price: number | null
  estimated_rent_per_room: number | null
  property_type: "HMO" | "Flat" | "House" | "Studio" | "Commercial" | "Office" | "Retail"
  hmo_status: "Unlicensed HMO" | "Licensed HMO" | "Potential HMO"
  tenure: "freehold" | "leasehold" | "unknown" | null
  licensed_hmo: boolean
  source_type: "hmo_register" | "enrichment_api" | "partner_api" | null
  source_name: string | null
  source_url: string | null
  external_id: string | null
  last_synced: string | null
  last_ingested_at: string | null
  last_seen_at: string | null
  is_stale: boolean
  stale_marked_at: string | null
  bedrooms: number
  bathrooms: number
  is_furnished: boolean
  is_student_friendly: boolean
  is_pet_friendly: boolean
  has_garden: boolean
  has_parking: boolean
  wifi_included: boolean
  near_tube_station: boolean
  available_from: string | null
  description: string | null
  image_url: string | null
  images: string[] | null
  floor_plans: string[] | null
  primary_image: string | null
  media_source_url: string | null
  created_at: string
  updated_at: string
  last_updated: string | null
  // Phase 1 - HMO Licence Fields
  licence_id: string | null
  licence_start_date: string | null
  licence_end_date: string | null
  licence_status: "active" | "expired" | "pending" | "none" | null
  max_occupants: number | null
  // Licence Holder Contact (separate from Title Owner)
  licence_holder_name: string | null
  licence_holder_email: string | null
  licence_holder_phone: string | null
  licence_holder_address: string | null
  // Phase 2 - Enrichment Fields
  uprn: string | null
  year_built: number | null
  estimated_value: number | null
  rental_yield: number | null
  area_population: number | null
  area_avg_rent: number | null
  // Phase 3 - Owner/Contact Information
  owner_name: string | null
  owner_address: string | null
  owner_type: "individual" | "company" | "trust" | "government" | "unknown" | null
  owner_contact_email: string | null
  owner_contact_phone: string | null
  // Phase 3 - Company Information (for corporate landlords)
  company_name: string | null
  company_number: string | null
  company_status: string | null
  company_incorporation_date: string | null
  directors: Director[] | null
  // Phase 3 - EPC Data
  epc_rating: "A" | "B" | "C" | "D" | "E" | "F" | "G" | null
  epc_rating_numeric: number | null
  epc_certificate_url: string | null
  epc_expiry_date: string | null
  // Phase 3 - Planning Constraints
  /**
   * @deprecated Use `article_4_status`. A boolean cannot express "unknown", and
   * the national feed covers only 38 councils — so `false` here has historically
   * meant "not found in a feed that does not cover this council". Never filter a
   * negative on this field. Mirrors `article_4_status === "in_force"`.
   */
  article_4_area: boolean | null
  /** in_force | none_found | unknown. `none_found` is the only verified negative. */
  article_4_status: Article4Status
  /** When status was last determined. null means never checked. */
  article_4_checked_at: string | null
  /** Provenance for the status — governs redistribution in the phase-2 API. */
  article_4_source: string | null
  /** Name of the matched direction area, when status is in_force. */
  article_4_area_name: string | null
  /** Local planning authority resolved for this point. */
  article_4_council: string | null
  /** Whether that authority publishes HMO Article 4 data. Gates none_found. */
  article_4_council_covered: boolean | null
  planning_constraints: PlanningConstraint[] | null
  conservation_area: boolean
  listed_building_grade: "I" | "II*" | "II" | null
  // Phase 3 - Enrichment Tracking
  title_number: string | null
  title_last_enriched_at: string | null
  owner_enrichment_source: string | null
  // Phase 3 - GDPR Compliance
  contact_data_added_at: string | null
  contact_data_source: string | null
  contact_data_opted_out: boolean
  // Phase 4 - Potential HMO Analysis
  gross_internal_area_sqm: number | null
  floor_area_band: "under_90" | "90_120" | "120_plus" | null
  room_count: number | null
  lettable_rooms: number | null
  current_layout: Record<string, any> | null
  ceiling_height_compliant: boolean | null
  hmo_suitability_score: number | null
  hmo_classification: "ready_to_go" | "value_add" | "not_suitable" | null
  potential_occupants: number | null
  requires_mandatory_licensing: boolean | null
  compliance_complexity: "low" | "medium" | "high" | null
  meets_space_standards: boolean | null
  bathroom_ratio_compliant: boolean | null
  kitchen_size_compliant: boolean | null
  epc_upgrade_viable: boolean | null
  epc_upgrade_cost_estimate: number | null
  epc_improvement_potential: "high" | "medium" | "low" | "none" | null
  estimated_gross_monthly_rent: number | null
  estimated_annual_income: number | null
  yield_band: "low" | "medium" | "high" | null
  estimated_yield_percentage: number | null
  deal_score: number | null
  deal_score_breakdown: DealScoreBreakdown | null
  is_ex_local_authority: boolean
  has_value_add_potential: boolean
  requires_major_structural_work: boolean
  is_potential_hmo: boolean
  watchlist_count: number
  // Phase 5 - Broadband/Connectivity Data
  broadband_basic_down: number | null
  broadband_basic_up: number | null
  broadband_superfast_down: number | null
  broadband_superfast_up: number | null
  broadband_ultrafast_down: number | null
  broadband_ultrafast_up: number | null
  broadband_max_down: number | null
  broadband_max_up: number | null
  has_fiber: boolean | null
  has_superfast: boolean | null
  broadband_last_checked: string | null
  // Phase 6 - Agent/Listing Information (from Zoopla)
  agent_name: string | null
  agent_phone: string | null
  agent_email: string | null
  agent_address: string | null
  agent_logo: string | null
  agent_profile_url: string | null
  days_on_market: number | null
  first_listed_date: string | null
  price_change_summary: string | null
  // Phase 7 - Zoopla Enrichment
  zoopla_listing_id: string | null
  zoopla_listing_url: string | null
  zoopla_price_pcm: number | null
  zoopla_price_pw: number | null
  zoopla_agent_name: string | null
  zoopla_agent_phone: string | null
  zoopla_images: string[] | null
  zoopla_floor_plan_url: string | null
  zoopla_first_published: string | null
  zoopla_days_on_market: number | null
  zoopla_area_avg_price: number | null
  zoopla_zed_index: number | null
  zoopla_enriched_at: string | null
  // Phase 7 - StreetData Enrichment
  streetdata_property_id: string | null
  construction_age_band: string | null
  council_tax_band: string | null
  internal_area_sqm: number | null
  is_bungalow: boolean | null
  has_outdoor_space: boolean | null
  streetdata_enriched_at: string | null
  // Phase 7 - PaTMa Enrichment
  patma_asking_price_mean: number | null
  patma_asking_price_median: number | null
  patma_sold_price_mean: number | null
  patma_sold_price_median: number | null
  patma_price_data_points: number | null
  patma_search_radius_miles: number | null
  patma_enriched_at: string | null
  // Phase 7 - PropertyData HMO Enrichment
  hmo_licence_reference: string | null
  hmo_licence_type: string | null
  hmo_licence_expiry: string | null
  hmo_council: string | null
  hmo_max_occupancy: number | null
  hmo_sleeping_rooms: number | null
  hmo_shared_bathrooms: number | null
  propertydata_enriched_at: string | null
  // Phase 7 - Calculated Fields
  estimated_rental_yield: number | null
  price_per_sqm: number | null
  last_enriched_at: string | null
  enrichment_sources: Record<string, any> | null
  // Phase 8 - Land Registry Enrichment
  landregistry_last_checked: string | null
  last_sale_price: number | null
  last_sale_date: string | null
  property_type_lr: string | null
  tenure_lr: string | null
  new_build: boolean | null
  postcode_avg_price: number | null
  postcode_transactions: number | null
  registered_owner: string | null
}

export type Director = {
  name: string
  role: string
  appointed_on?: string
  resigned_on?: string
}

export type PlanningConstraint = {
  type: string
  description: string
  reference?: string
}

/**
 * How good the deal is. Every component describes the property.
 *
 * contactDataScore used to sit here and carried 20 of the 100 points, which
 * meant a property scored higher because we happened to hold the owner's email
 * address. That measures our data coverage, not the deal, and it ranked
 * well-enriched properties above better ones. It is now reported separately as
 * contactability, which is a real and useful thing to know — just not a
 * statement about the building.
 */
export type DealScoreBreakdown = {
  floorAreaEfficiency: number      // 0-15 points
  epcRatingScore: number           // 0-15 points
  licensingUpside: number          // 0-10 points
  lettableRoomsScore: number       // 0-15 points
  complianceScore: number          // 0-10 points
  yieldScore: number               // 0-15 points
  /**
   * Whether the yield behind yieldScore rests on a measured rent or a city
   * average. The estimate is a regional figure applied to a specific building,
   * so a score built on it is a guide and must not be shown as a property fact.
   */
  yieldBasis: "measured" | "regional_estimate"
}

/** How reachable the owner is. Separate from whether the deal is any good. */
export type ContactabilityBreakdown = {
  titleOwner: number               // 0-10
  licenceHolder: number            // 0-5
  contactDetails: number           // 0-5
}

export type PropertyFilters = {
  listingType: "rent" | "purchase"
  minPrice: number
  maxPrice: number
  propertyTypes: string[]
  /**
   * Which kinds of sourcing job to show. Empty or absent means all three.
   * Replaces the old "Opportunities" bucket, which matched almost everything.
   */
  sourcingCategories?: ("existing_off_market" | "for_sale_hmo" | "change_of_use")[]
  city: string
  postcodePrefix?: string // e.g., "M14", "E1" - filters by postcode area
  licenceStatus?: "active" | "expired" | "all"
  // Phase 3 - New filters
  minEpcRating?: "A" | "B" | "C" | "D" | "E" | null
  /**
   * include         - no filter
   * exclude         - drop only properties known to be in an Article 4 area.
   *                   Keeps `unknown`, which the cards badge as unverified.
   * confirmed_clear - strict: only properties verified as outside one.
   * only            - only properties inside an Article 4 area.
   */
  article4Filter?: "include" | "exclude" | "confirmed_clear" | "only"
  // Licence Type Filter. The four states the properties table can answer for;
  // there is no per-property licence type recorded to filter on.
  licenceTypeFilter?: string // "all" | "any_licensed" | "expired_licence" | "unlicensed"
  // Matched against the measured gross_internal_area_sqm, not the stored band.
  floorAreaBand?: "under_90" | "90_120" | "120_plus" | null
  epcBand?: "good" | "needs_upgrade" | null
  isExLocalAuthority?: boolean
  // Phase 5 - Broadband filters
  hasFiber?: boolean
  minBroadbandSpeed?: number
  // Owner data filter
  hasOwnerData?: boolean
  // Licence expiry date filter (premium feature) - month range within a year
  licenceExpiryStartMonth?: number // 1-12
  licenceExpiryEndMonth?: number // 1-12
  licenceExpiryYear?: number // e.g., 2025
  // Phase 6 - TA Sourcing filters
  minBedrooms?: number
  minBathrooms?: number
  isFurnished?: boolean
  hasParking?: boolean
}

export type SavedProperty = {
  id: string
  notes: string | null
  created_at: string
  property: Property
}
