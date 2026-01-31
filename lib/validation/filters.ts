import { UK_CITIES, ALL_CITIES_OPTION } from "@/lib/data/uk-cities"
import type { PropertyFilters } from "@/lib/types/database"

// Valid cities for filtering
const VALID_CITIES = new Set([
  ALL_CITIES_OPTION.name,
  ...UK_CITIES.map(c => c.name)
])

// Valid property types
const VALID_PROPERTY_TYPES = new Set([
  "HMO", "Flat", "House", "Bungalow", "Studio", "Other"
])

// Valid EPC ratings
const VALID_EPC_RATINGS = new Set(["A", "B", "C", "D", "E", "F", "G"])

// Valid article 4 filter values
const VALID_ARTICLE4_FILTERS = new Set(["include", "exclude", "only"])

// Valid licence statuses
const VALID_LICENCE_STATUSES = new Set(["active", "expired", "all"])

/**
 * Validate and sanitize property filters
 * Returns sanitized filters with invalid values removed or set to defaults
 */
export function validateFilters(filters: Partial<PropertyFilters>): Partial<PropertyFilters> {
  const sanitized: Partial<PropertyFilters> = {}

  // Listing type - only allow valid values
  if (filters.listingType === "rent" || filters.listingType === "purchase") {
    sanitized.listingType = filters.listingType
  }

  // Price range - must be positive numbers
  if (typeof filters.minPrice === "number" && filters.minPrice >= 0 && filters.minPrice <= 100000000) {
    sanitized.minPrice = Math.floor(filters.minPrice)
  }
  if (typeof filters.maxPrice === "number" && filters.maxPrice >= 0 && filters.maxPrice <= 100000000) {
    sanitized.maxPrice = Math.floor(filters.maxPrice)
  }

  // City - must be in whitelist
  if (typeof filters.city === "string" && VALID_CITIES.has(filters.city)) {
    sanitized.city = filters.city
  }

  // Property types - filter to valid values only
  if (Array.isArray(filters.propertyTypes)) {
    const validTypes = filters.propertyTypes.filter(t =>
      typeof t === "string" && VALID_PROPERTY_TYPES.has(t)
    )
    if (validTypes.length > 0) {
      sanitized.propertyTypes = validTypes
    }
  }

  // Boolean filters - ensure they're actually booleans
  if (typeof filters.availableNow === "boolean") {
    sanitized.availableNow = filters.availableNow
  }
  if (typeof filters.studentFriendly === "boolean") {
    sanitized.studentFriendly = filters.studentFriendly
  }
  if (typeof filters.petFriendly === "boolean") {
    sanitized.petFriendly = filters.petFriendly
  }
  if (typeof filters.furnished === "boolean") {
    sanitized.furnished = filters.furnished
  }
  if (typeof filters.licensedHmoOnly === "boolean") {
    sanitized.licensedHmoOnly = filters.licensedHmoOnly
  }
  if (typeof filters.showPotentialHMOs === "boolean") {
    sanitized.showPotentialHMOs = filters.showPotentialHMOs
  }
  if (typeof filters.hasFiber === "boolean") {
    sanitized.hasFiber = filters.hasFiber
  }
  if (typeof filters.isExLocalAuthority === "boolean") {
    sanitized.isExLocalAuthority = filters.isExLocalAuthority
  }

  // EPC rating - must be valid
  if (filters.minEpcRating && VALID_EPC_RATINGS.has(filters.minEpcRating)) {
    sanitized.minEpcRating = filters.minEpcRating as "A" | "B" | "C" | "D" | "E"
  }

  // Article 4 filter
  if (filters.article4Filter && VALID_ARTICLE4_FILTERS.has(filters.article4Filter)) {
    sanitized.article4Filter = filters.article4Filter as "include" | "exclude" | "only"
  }

  // Licence status
  if (filters.licenceStatus && VALID_LICENCE_STATUSES.has(filters.licenceStatus)) {
    sanitized.licenceStatus = filters.licenceStatus as "active" | "expired" | "all"
  }

  // Licence type filter - alphanumeric and underscore only
  if (typeof filters.licenceTypeFilter === "string") {
    const cleaned = filters.licenceTypeFilter.replace(/[^a-zA-Z0-9_-]/g, "")
    if (cleaned.length > 0 && cleaned.length <= 50) {
      sanitized.licenceTypeFilter = cleaned
    }
  }

  // Min deal score - must be 0-100
  if (typeof filters.minDealScore === "number" && filters.minDealScore >= 0 && filters.minDealScore <= 100) {
    sanitized.minDealScore = Math.floor(filters.minDealScore)
  }

  // Min broadband speed - reasonable range
  if (typeof filters.minBroadbandSpeed === "number" && filters.minBroadbandSpeed >= 0 && filters.minBroadbandSpeed <= 10000) {
    sanitized.minBroadbandSpeed = Math.floor(filters.minBroadbandSpeed)
  }

  // HMO classification
  if (filters.hmoClassification === "ready_to_go" || filters.hmoClassification === "value_add") {
    sanitized.hmoClassification = filters.hmoClassification
  }

  // Floor area band
  if (filters.floorAreaBand === "under_90" || filters.floorAreaBand === "90_120" || filters.floorAreaBand === "120_plus") {
    sanitized.floorAreaBand = filters.floorAreaBand
  }

  // Yield band
  if (filters.yieldBand === "low" || filters.yieldBand === "medium" || filters.yieldBand === "high") {
    sanitized.yieldBand = filters.yieldBand
  }

  // EPC band
  if (filters.epcBand === "good" || filters.epcBand === "needs_upgrade") {
    sanitized.epcBand = filters.epcBand
  }

  return sanitized
}

/**
 * Validate a date string in ISO format (YYYY-MM-DD)
 */
export function isValidISODate(dateStr: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateStr)) return false

  const date = new Date(dateStr)
  return !isNaN(date.getTime())
}
