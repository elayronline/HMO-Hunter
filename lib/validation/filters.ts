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

  // Postcode prefix - validate format (alphanumeric, max 8 chars, UK postcode pattern)
  if (typeof filters.postcodePrefix === "string") {
    const cleaned = filters.postcodePrefix.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, "")
    // UK postcode outcode pattern: 1-2 letters, 1-2 digits, optional space and more
    const postcodePattern = /^[A-Z]{1,2}[0-9][0-9A-Z]?(\s?[0-9]?[A-Z]{0,2})?$/
    if (cleaned.length >= 2 && cleaned.length <= 8 && postcodePattern.test(cleaned)) {
      sanitized.postcodePrefix = cleaned
    }
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
  if (typeof filters.showPotentialHMOs === "boolean") {
    sanitized.showPotentialHMOs = filters.showPotentialHMOs
  }
  if (typeof filters.hasFiber === "boolean") {
    sanitized.hasFiber = filters.hasFiber
  }
  if (typeof filters.isExLocalAuthority === "boolean") {
    sanitized.isExLocalAuthority = filters.isExLocalAuthority
  }
  if (typeof filters.hasOwnerData === "boolean") {
    sanitized.hasOwnerData = filters.hasOwnerData
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

  // Licence expiry start month - must be 1-12
  if (typeof filters.licenceExpiryStartMonth === "number" &&
      filters.licenceExpiryStartMonth >= 1 &&
      filters.licenceExpiryStartMonth <= 12) {
    sanitized.licenceExpiryStartMonth = Math.floor(filters.licenceExpiryStartMonth)
  }

  // Licence expiry end month - must be 1-12
  if (typeof filters.licenceExpiryEndMonth === "number" &&
      filters.licenceExpiryEndMonth >= 1 &&
      filters.licenceExpiryEndMonth <= 12) {
    sanitized.licenceExpiryEndMonth = Math.floor(filters.licenceExpiryEndMonth)
  }

  // Licence expiry year - reasonable range
  if (typeof filters.licenceExpiryYear === "number" &&
      filters.licenceExpiryYear >= 2020 &&
      filters.licenceExpiryYear <= 2040) {
    sanitized.licenceExpiryYear = Math.floor(filters.licenceExpiryYear)
  }

  // Phase 6 - TA Sourcing filters
  // Min bedrooms - must be 1-20
  if (typeof filters.minBedrooms === "number" && filters.minBedrooms >= 1 && filters.minBedrooms <= 20) {
    sanitized.minBedrooms = Math.floor(filters.minBedrooms)
  }
  // Min bathrooms - must be 1-10
  if (typeof filters.minBathrooms === "number" && filters.minBathrooms >= 1 && filters.minBathrooms <= 10) {
    sanitized.minBathrooms = Math.floor(filters.minBathrooms)
  }
  // Furnished filter
  if (typeof filters.isFurnished === "boolean") {
    sanitized.isFurnished = filters.isFurnished
  }
  // Parking filter
  if (typeof filters.hasParking === "boolean") {
    sanitized.hasParking = filters.hasParking
  }
  // TA suitability filter
  if (filters.taSuitability === "suitable" || filters.taSuitability === "partial") {
    sanitized.taSuitability = filters.taSuitability
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
