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
  property_type: "HMO" | "Flat" | "House" | "Studio"
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
  article_4_area: boolean
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

export type DealScoreBreakdown = {
  floorAreaEfficiency: number      // 0-15 points
  epcRatingScore: number           // 0-15 points
  licensingUpside: number          // 0-10 points
  lettableRoomsScore: number       // 0-15 points
  complianceScore: number          // 0-10 points
  yieldScore: number               // 0-15 points
  contactDataScore: number         // 0-20 points (title owner + licence + contact)
}

export type PropertyFilters = {
  listingType: "rent" | "purchase"
  minPrice: number
  maxPrice: number
  propertyTypes: string[]
  city: string
  availableNow: boolean
  studentFriendly: boolean
  petFriendly: boolean
  furnished: boolean
  licensedHmoOnly: boolean
  licenceStatus?: "active" | "expired" | "all"
  // Phase 3 - New filters
  minEpcRating?: "A" | "B" | "C" | "D" | "E" | null
  article4Filter?: "include" | "exclude" | "only"
  // Licence Type Filter
  licenceTypeFilter?: string // "all" | "any_licensed" | "unlicensed" | specific licence type code
  // Phase 4 - Potential HMO filters
  showPotentialHMOs?: boolean
  hmoClassification?: "ready_to_go" | "value_add" | null
  minDealScore?: number
  floorAreaBand?: "under_90" | "90_120" | "120_plus" | null
  yieldBand?: "low" | "medium" | "high" | null
  epcBand?: "good" | "needs_upgrade" | null
  isExLocalAuthority?: boolean
}
