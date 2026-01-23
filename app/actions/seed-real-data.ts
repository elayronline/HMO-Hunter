"use server"

import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Clear all existing properties and pull fresh data from PropertyData API
 */
export async function clearAndSeedRealData(): Promise<{
  success: boolean
  message: string
  propertiesAdded: number
  errors: string[]
}> {
  const errors: string[] = []
  let propertiesAdded = 0

  try {
    // Use service role client to bypass RLS for admin operations
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        success: false,
        message: "SUPABASE_SERVICE_ROLE_KEY not configured. Get it from Supabase Dashboard > Settings > API > Service Role Key",
        propertiesAdded: 0,
        errors: ["SUPABASE_SERVICE_ROLE_KEY not set - required for seeding data"],
      }
    }
    const supabase = createServiceRoleClient()

    // Step 1: Clear existing properties
    console.log("[SeedRealData] Clearing existing properties...")
    const { error: deleteError } = await supabase
      .from("properties")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000") // Delete all (workaround for delete all)

    if (deleteError) {
      console.error("[SeedRealData] Error clearing properties:", deleteError)
      errors.push(`Clear error: ${deleteError.message}`)
    }

    // Step 2: Fetch real HMO data from PropertyData API
    console.log("[SeedRealData] Fetching real HMO data from PropertyData...")
    const apiKey = process.env.PROPERTYDATA_API_KEY

    if (!apiKey) {
      return {
        success: false,
        message: "PropertyData API key not configured",
        propertiesAdded: 0,
        errors: ["PROPERTYDATA_API_KEY not set"],
      }
    }

    // Use verified HMO-dense London postcodes
    const postcodes = [
      "N7 6PA",   // Holloway
      "E2 9PL",   // Bethnal Green
      "SE5 8TR",  // Camberwell
      "NW5 2HB",  // Kentish Town
      "E8 1EJ",   // Hackney
      "N1 9LQ",   // Islington
      "SW9 8PS",  // Brixton
      "E1 5LJ",   // Whitechapel
    ]

    const now = new Date().toISOString()

    for (const postcode of postcodes) {
      try {
        const cleanPostcode = postcode.replace(/\s+/g, "%20")
        const url = `https://api.propertydata.co.uk/national-hmo-register?key=${apiKey}&postcode=${cleanPostcode}`

        console.log(`[SeedRealData] Fetching HMOs for ${postcode}...`)

        const response = await fetch(url, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error(`[SeedRealData] API error for ${postcode}: ${response.status}`)
          errors.push(`${postcode}: API error ${response.status}`)
          continue
        }

        const data = await response.json()

        if (data.status === "error") {
          console.error(`[SeedRealData] API returned error for ${postcode}: ${data.message}`)
          errors.push(`${postcode}: ${data.message}`)
          continue
        }

        // Extract HMO records from response
        // PropertyData returns: { data: { hmos: [...] } }
        let records: any[] = []
        if (data.data?.hmos && Array.isArray(data.data.hmos)) {
          records = data.data.hmos
        } else if (Array.isArray(data.data)) {
          records = data.data
        } else if (Array.isArray(data.hmo_licences)) {
          records = data.hmo_licences
        } else if (Array.isArray(data.results)) {
          records = data.results
        }

        console.log(`[SeedRealData] Found ${records.length} HMOs for ${postcode}`)

        // Insert each HMO into database
        for (const record of records) {
          const bedrooms = record.number_of_rooms_providing_sleeping_accommodation ||
                          record.bedrooms ||
                          record.number_of_bedrooms || 5

          const bathrooms = record.number_of_shared_bathrooms ||
                           Math.ceil(bedrooms / 2.5)

          // Parse coordinates if available, otherwise use approximate London coords
          const lat = record.latitude || (51.5074 + (Math.random() - 0.5) * 0.1)
          const lng = record.longitude || (-0.1278 + (Math.random() - 0.5) * 0.1)

          // Estimate rent based on bedrooms (London HMO market rates)
          const estimatedRentPerRoom = 650 + Math.floor(Math.random() * 200) // £650-850 per room
          const estimatedPcm = estimatedRentPerRoom * bedrooms

          // Use minimal columns that exist in database
          const propertyData = {
            title: `Licensed HMO - ${record.address || postcode}`,
            address: record.address || `HMO near ${postcode}`,
            postcode: record.postcode || postcode,
            city: "London", // All these postcodes are in London
            country: "UK",
            latitude: lat,
            longitude: lng,
            listing_type: "rent",
            price_pcm: estimatedPcm,
            property_type: "HMO",
            hmo_status: "Licensed HMO",
            licensed_hmo: true,
            bedrooms,
            bathrooms,
            is_furnished: true,
            is_student_friendly: true,
            is_pet_friendly: false,
            has_garden: false,
            has_parking: false,
            wifi_included: true,
            near_tube_station: true,
            is_stale: false,
            description: `Licensed HMO property. Council: ${record.council || "Local Authority"}. License expires: ${record.licence_expiry || "N/A"}. Max occupants: ${record.number_of_rooms_providing_sleeping_accommodation || bedrooms}.`,
          }

          const { error: insertError } = await supabase
            .from("properties")
            .insert(propertyData)

          if (insertError) {
            console.error(`[SeedRealData] Insert error:`, insertError.message)
            errors.push(`Insert error: ${insertError.message}`)
          } else {
            propertiesAdded++
          }
        }
      } catch (error) {
        console.error(`[SeedRealData] Error processing ${postcode}:`, error)
        errors.push(`${postcode}: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }

    console.log(`[SeedRealData] Complete. Added ${propertiesAdded} real HMO properties.`)

    return {
      success: propertiesAdded > 0,
      message: `Added ${propertiesAdded} real HMO properties from PropertyData API`,
      propertiesAdded,
      errors,
    }
  } catch (error) {
    console.error("[SeedRealData] Fatal error:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      propertiesAdded: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    }
  }
}

/**
 * Get count of properties in database
 */
export async function getPropertyCount(): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })

  return count || 0
}
