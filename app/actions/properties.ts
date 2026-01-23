"use server"

import { createClient } from "@/lib/supabase/server"
import type { Property, PropertyFilters } from "@/lib/types/database"

const CACHE_DURATION = 300000 // 5 minutes cache
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
