"use server"

import { createClient } from "@/lib/supabase/server"
import type { Property, PropertyFilters } from "@/lib/types/database"
import { validateFilters, isValidISODate } from "@/lib/validation/filters"

const CACHE_DURATION = 60000 // 1 minute cache (reduced for debugging)
let propertiesCache: { data: Property[]; timestamp: number; filters: string } | null = null

// Helper to safely execute Supabase query with rate limit handling
async function safeSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: any }> {
  try {
    return await queryFn()
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err)
    // Convert JSON parse errors from rate limiting into a proper error object
    if (errMessage.includes("Unexpected token") || errMessage.includes("Too Many")) {
      return { data: null, error: { message: "Rate limit exceeded", code: "429" } }
    }
    return { data: null, error: { message: errMessage, code: "UNKNOWN" } }
  }
}

export async function getProperties(filters?: Partial<PropertyFilters>): Promise<Property[]> {
  // Validate and sanitize all filter inputs
  const validatedFilters = filters ? validateFilters(filters) : {}
  const filterKey = JSON.stringify(validatedFilters)
  const now = Date.now()

  // Check if licence expiry filter is active (all 3 fields must be set)
  const licenceExpiryFilterActive = !!(
    validatedFilters.licenceExpiryStartMonth &&
    validatedFilters.licenceExpiryEndMonth &&
    validatedFilters.licenceExpiryYear
  )

  // Debug: log licence expiry filter
  if (licenceExpiryFilterActive) {
    console.log("[PropertiesAction] Licence Expiry Filter ACTIVE:", {
      startMonth: validatedFilters.licenceExpiryStartMonth,
      endMonth: validatedFilters.licenceExpiryEndMonth,
      year: validatedFilters.licenceExpiryYear,
    })
  }

  // Always return cached data if available and not too old
  if (propertiesCache && propertiesCache.filters === filterKey && now - propertiesCache.timestamp < CACHE_DURATION) {
    return propertiesCache.data
  }

  try {
    const supabase = await createClient()

    let query = supabase.from("properties").select("*").order("created_at", { ascending: false })

    query = query.or("is_stale.eq.false,is_stale.is.null")

    // HMO Hunter: Only show Licensed HMOs, Potential HMOs, or Expired Licence HMOs - filter out standard listings
    query = query.or("licensed_hmo.eq.true,is_potential_hmo.eq.true,licence_status.eq.expired")

    // Only apply listing type filter if licence expiry filter is NOT active
    // When filtering by expiry dates, we want all matching properties regardless of listing type
    if (validatedFilters.listingType && !licenceExpiryFilterActive) {
      // Show properties matching listing type
      // For expired licences, only include if they have the appropriate price field
      if (validatedFilters.listingType === "purchase") {
        // Include purchase listings OR expired licences that have a purchase price
        query = query.or("listing_type.eq.purchase,and(licence_status.eq.expired,purchase_price.not.is.null)")
      } else {
        // Include rent listings OR expired licences that have rent price
        query = query.or("listing_type.eq.rent,and(licence_status.eq.expired,price_pcm.not.is.null)")
      }
    }

    // Only apply price filters if licence expiry filter is NOT active
    // When filtering by expiry dates, price is not the primary criteria
    if (validatedFilters.minPrice && !licenceExpiryFilterActive) {
      if (validatedFilters.listingType === "purchase") {
        query = query.gte("purchase_price", validatedFilters.minPrice)
      } else {
        query = query.gte("price_pcm", validatedFilters.minPrice)
      }
    }
    if (validatedFilters.maxPrice && !licenceExpiryFilterActive) {
      if (validatedFilters.listingType === "purchase") {
        query = query.lte("purchase_price", validatedFilters.maxPrice)
      } else {
        query = query.lte("price_pcm", validatedFilters.maxPrice)
      }
    }

    // Apply filters
    if (validatedFilters.propertyTypes && validatedFilters.propertyTypes.length > 0) {
      query = query.in("property_type", validatedFilters.propertyTypes)
    }
    // Only filter by city if it's not "All Cities" and no postcode is specified
    if (validatedFilters.city && validatedFilters.city !== "All Cities" && !validatedFilters.postcodePrefix) {
      query = query.eq("city", validatedFilters.city)
    }
    // Filter by postcode prefix (e.g., "M14", "E1 6")
    if (validatedFilters.postcodePrefix) {
      // Use ilike for case-insensitive prefix matching
      query = query.ilike("postcode", `${validatedFilters.postcodePrefix}%`)
    }

    // Phase 3 - EPC Rating Filter
    if (validatedFilters.minEpcRating) {
      const epcOrder = ["A", "B", "C", "D", "E", "F", "G"]
      const minIndex = epcOrder.indexOf(validatedFilters.minEpcRating)
      if (minIndex >= 0) {
        const validRatings = epcOrder.slice(0, minIndex + 1)
        query = query.in("epc_rating", validRatings)
      }
    }

    // Phase 3 - Article 4 Filter
    if (validatedFilters.article4Filter === "exclude") {
      query = query.or("article_4_area.eq.false,article_4_area.is.null")
    } else if (validatedFilters.article4Filter === "only") {
      query = query.eq("article_4_area", true)
    }
    // "include" means no filter - show all properties

    // Phase 5 - Broadband Filter
    if (validatedFilters.hasFiber === true) {
      query = query.eq("has_fiber", true)
    }
    if (validatedFilters.minBroadbandSpeed && validatedFilters.minBroadbandSpeed > 0) {
      query = query.gte("broadband_max_down", validatedFilters.minBroadbandSpeed)
    }

    // Phase 6 - Bedroom/Bathroom filters
    if (validatedFilters.minBedrooms && validatedFilters.minBedrooms > 0) {
      query = query.gte("bedrooms", validatedFilters.minBedrooms)
    }
    if (validatedFilters.minBathrooms && validatedFilters.minBathrooms > 0) {
      query = query.gte("bathrooms", validatedFilters.minBathrooms)
    }
    // Phase 6 - Furnished/Parking filters
    if (validatedFilters.isFurnished === true) {
      query = query.eq("is_furnished", true)
    }
    if (validatedFilters.hasParking === true) {
      query = query.eq("has_parking", true)
    }

    // Licence Type Filter
    if (validatedFilters.licenceTypeFilter && validatedFilters.licenceTypeFilter !== "all") {
      if (validatedFilters.licenceTypeFilter === "any_licensed") {
        // Show only properties with any active licence
        query = query.eq("licensed_hmo", true)
      } else if (validatedFilters.licenceTypeFilter === "expired_licence") {
        // Show only properties with expired licences
        query = query.eq("licence_status", "expired")
      } else if (validatedFilters.licenceTypeFilter === "unlicensed") {
        // Show only properties without licences
        query = query.or("licensed_hmo.eq.false,licensed_hmo.is.null")
      } else {
        // Specific licence type code - need to filter by property_licences table
        // First get property IDs that have this licence type
        const { data: licencedPropertyIds } = await supabase
          .from("property_licences")
          .select("property_id")
          .eq("licence_type_code", validatedFilters.licenceTypeFilter)
          .eq("status", "active")

        if (licencedPropertyIds && licencedPropertyIds.length > 0) {
          const propertyIds = licencedPropertyIds.map(l => l.property_id)
          query = query.in("id", propertyIds)
        } else {
          // No properties have this licence type - return empty
          return []
        }
      }
    }

    // Phase 4 - Potential HMO Filters
    if (validatedFilters.showPotentialHMOs) {
      // When toggle is ON: show both Licensed HMOs AND Potential HMOs
      // Additional filters below narrow down the potential HMO results

      // HMO Classification filter - only filter if specifically selected
      if (validatedFilters.hmoClassification) {
        query = query.eq("hmo_classification", validatedFilters.hmoClassification)
      }

      // Min Deal Score filter - only applies to potential HMOs but doesn't exclude licensed
      if (validatedFilters.minDealScore && validatedFilters.minDealScore > 0) {
        // Show properties that either meet the deal score OR are licensed HMOs
        query = query.or(`deal_score.gte.${validatedFilters.minDealScore},licensed_hmo.eq.true`)
      }

      // Floor Area Band filter
      if (validatedFilters.floorAreaBand) {
        query = query.eq("floor_area_band", validatedFilters.floorAreaBand)
      }

      // Yield Band filter
      if (validatedFilters.yieldBand) {
        query = query.eq("yield_band", validatedFilters.yieldBand)
      }

      // EPC Band filter (good = C/D, needs_upgrade = E/F/G)
      if (validatedFilters.epcBand === "good") {
        query = query.in("epc_rating", ["A", "B", "C", "D"])
      } else if (validatedFilters.epcBand === "needs_upgrade") {
        query = query.in("epc_rating", ["E", "F", "G"])
      }

      // Ex-Local Authority filter
      if (validatedFilters.isExLocalAuthority) {
        query = query.eq("is_ex_local_authority", true)
      }
    } else {
      // When toggle is OFF: show only Licensed HMOs AND Expired Licence HMOs (exclude potential HMOs)
      query = query.or("licensed_hmo.eq.true,licence_status.eq.expired")
    }

    // Owner Data Filter - show only properties with title owner information
    if (validatedFilters.hasOwnerData) {
      // Show properties that have either owner_name OR company_name populated
      query = query.or("owner_name.not.is.null,company_name.not.is.null")
    }

    // Licence Expiry Date Filter (Premium Feature) - Month Range
    // Filter properties by licence end date within a month range for a specific year
    if (validatedFilters.licenceExpiryStartMonth && validatedFilters.licenceExpiryEndMonth && validatedFilters.licenceExpiryYear) {
      const year = validatedFilters.licenceExpiryYear
      const startMonth = validatedFilters.licenceExpiryStartMonth
      const endMonth = validatedFilters.licenceExpiryEndMonth

      // Start of range: first day of start month
      const startDate = `${year}-${startMonth.toString().padStart(2, '0')}-01`

      // End of range: last day of end month
      const lastDay = new Date(year, endMonth, 0).getDate()
      const endDate = `${year}-${endMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`

      // Filter: licence_end_date BETWEEN start and end dates
      query = query.gte("licence_end_date", startDate)
      query = query.lte("licence_end_date", endDate)
      // Also ensure licence_end_date is not null
      query = query.not("licence_end_date", "is", null)
    }

    const { data, error } = await safeSupabaseQuery(async () => await query)

    if (error) {
      const errorMessage = error.message || String(error)

      // Handle rate limiting - return cached data if available
      if (
        errorMessage.includes("429") ||
        errorMessage.includes("Too Many") ||
        errorMessage.includes("rate limit") ||
        errorMessage.includes("Rate limit") ||
        errorMessage.includes("Unexpected token")
      ) {
        if (propertiesCache) {
          return propertiesCache.data
        }
        return []
      }
      
      // For other errors, also try cache first
      if (propertiesCache) {
        return propertiesCache.data
      }
      return []
    }

    // GDPR: Filter out contact data for opted-out owners
    const processedData = (data || []).map((property: any) => {
      if (property.contact_data_opted_out) {
        return {
          ...property,
          owner_contact_email: null,
          owner_contact_phone: null,
        }
      }
      return property
    }) as Property[]

    propertiesCache = {
      data: processedData,
      timestamp: now,
      filters: filterKey,
    }

    // Debug: Log coordinate distribution
    if (processedData.length > 0) {
      const lats = processedData.map((p: any) => p.latitude).filter((v: any) => v != null)
      const lngs = processedData.map((p: any) => p.longitude).filter((v: any) => v != null)
      const nullCoords = processedData.filter((p: any) => p.latitude == null || p.longitude == null).length
      console.log("[PropertiesAction] Returned:", {
        total: processedData.length,
        withCoords: lats.length,
        nullCoords,
        lat: lats.length > 0 ? { min: Math.min(...lats), max: Math.max(...lats) } : "none",
        lng: lngs.length > 0 ? { min: Math.min(...lngs), max: Math.max(...lngs) } : "none",
      })
    }

    return processedData
  } catch {
    // On any error, return cached data or empty array
    if (propertiesCache) {
      return propertiesCache.data
    }
    return []
  }
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.from("properties").select("*").eq("id", id).single()

  if (error) {
    console.error("[v0] Error fetching property:", error)
    return null
  }

  // GDPR: Filter out contact data for opted-out owners
  if (data?.contact_data_opted_out) {
    return {
      ...data,
      owner_contact_email: null,
      owner_contact_phone: null,
    } as Property
  }

  return data as Property
}
