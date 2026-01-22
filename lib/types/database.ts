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
  hmo_status: "Standard HMO" | "Licensed HMO" | "Potential HMO"
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
  // Phase 2 - Enrichment Fields
  uprn: string | null
  year_built: number | null
  estimated_value: number | null
  rental_yield: number | null
  area_population: number | null
  area_avg_rent: number | null
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
}
