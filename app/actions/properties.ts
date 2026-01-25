"use server"

import { createClient } from "@/lib/supabase/server"
import type { Property, PropertyFilters } from "@/lib/types/database"

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
  const filterKey = JSON.stringify(filters || {})
  const now = Date.now()

  // Always return cached data if available and not too old
  if (propertiesCache && propertiesCache.filters === filterKey && now - propertiesCache.timestamp < CACHE_DURATION) {
    return propertiesCache.data
  }

  try {
    const supabase = await createClient()

    let query = supabase.from("properties").select("*").order("created_at", { ascending: false })

    query = query.or("is_stale.eq.false,is_stale.is.null")

    if (filters?.listingType) {
      query = query.eq("listing_type", filters.listingType)
    }

    if (filters?.minPrice) {
      if (filters.listingType === "purchase") {
        query = query.gte("purchase_price", filters.minPrice)
      } else {
        query = query.gte("price_pcm", filters.minPrice)
      }
    }
    if (filters?.maxPrice) {
      if (filters.listingType === "purchase") {
        query = query.lte("purchase_price", filters.maxPrice)
      } else {
        query = query.lte("price_pcm", filters.maxPrice)
      }
    }

    // Apply filters
    if (filters?.propertyTypes && filters.propertyTypes.length > 0) {
      query = query.in("property_type", filters.propertyTypes)
    }
    if (filters?.city) {
      query = query.eq("city", filters.city)
    }
    if (filters?.studentFriendly) {
      query = query.eq("is_student_friendly", true)
    }
    if (filters?.petFriendly) {
      query = query.eq("is_pet_friendly", true)
    }
    if (filters?.furnished) {
      query = query.eq("is_furnished", true)
    }

    if (filters?.licensedHmoOnly) {
      query = query.eq("licensed_hmo", true)
    }

    if (filters?.availableNow) {
      const today = new Date().toISOString().split("T")[0]
      query = query.or(`available_from.is.null,available_from.lte.${today}`)
    }

    // Phase 3 - EPC Rating Filter
    if (filters?.minEpcRating) {
      const epcOrder = ["A", "B", "C", "D", "E", "F", "G"]
      const minIndex = epcOrder.indexOf(filters.minEpcRating)
      if (minIndex >= 0) {
        const validRatings = epcOrder.slice(0, minIndex + 1)
        query = query.in("epc_rating", validRatings)
      }
    }

    // Phase 3 - Article 4 Filter
    if (filters?.article4Filter === "exclude") {
      query = query.or("article_4_area.eq.false,article_4_area.is.null")
    } else if (filters?.article4Filter === "only") {
      query = query.eq("article_4_area", true)
    }
    // "include" means no filter - show all properties

    // Phase 4 - Potential HMO Filters
    if (filters?.showPotentialHMOs) {
      query = query.eq("is_potential_hmo", true)

      // HMO Classification filter
      if (filters?.hmoClassification) {
        query = query.eq("hmo_classification", filters.hmoClassification)
      } else {
        // When showing potential HMOs, exclude "not_suitable" by default
        query = query.in("hmo_classification", ["ready_to_go", "value_add"])
      }

      // Min Deal Score filter
      if (filters?.minDealScore && filters.minDealScore > 0) {
        query = query.gte("deal_score", filters.minDealScore)
      }

      // Floor Area Band filter
      if (filters?.floorAreaBand) {
        query = query.eq("floor_area_band", filters.floorAreaBand)
      }

      // Yield Band filter
      if (filters?.yieldBand) {
        query = query.eq("yield_band", filters.yieldBand)
      }

      // EPC Band filter (good = C/D, needs_upgrade = E/F/G)
      if (filters?.epcBand === "good") {
        query = query.in("epc_rating", ["A", "B", "C", "D"])
      } else if (filters?.epcBand === "needs_upgrade") {
        query = query.in("epc_rating", ["E", "F", "G"])
      }

      // Ex-Local Authority filter
      if (filters?.isExLocalAuthority) {
        query = query.eq("is_ex_local_authority", true)
      }
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

    propertiesCache = {
      data: (data || []) as Property[],
      timestamp: now,
      filters: filterKey,
    }

    // Debug: Log coordinate distribution
    const props = data || []
    if (props.length > 0) {
      const lats = props.map((p: any) => p.latitude).filter((v: any) => v != null)
      const lngs = props.map((p: any) => p.longitude).filter((v: any) => v != null)
      const nullCoords = props.filter((p: any) => p.latitude == null || p.longitude == null).length
      console.log("[PropertiesAction] Returned:", {
        total: props.length,
        withCoords: lats.length,
        nullCoords,
        lat: lats.length > 0 ? { min: Math.min(...lats), max: Math.max(...lats) } : "none",
        lng: lngs.length > 0 ? { min: Math.min(...lngs), max: Math.max(...lngs) } : "none",
      })
    }

    return (data || []) as Property[]
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

  return data as Property
}
