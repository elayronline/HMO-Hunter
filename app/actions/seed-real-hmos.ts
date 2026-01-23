"use server"

import { createServiceRoleClient } from "@/lib/supabase/server"

// HMO-dense postcodes for each major UK city
const CITY_POSTCODES: Record<string, { postcodes: string[]; city: string }> = {
  // England
  London: {
    city: "London",
    postcodes: ["N7 6PA", "E2 9PL", "SE5 8TR", "NW5 2HB", "E8 1EJ", "N1 9LQ", "SW9 8PS", "E1 5LJ", "SE15 5BA"],
  },
  Manchester: {
    city: "Manchester",
    postcodes: ["M14 5SX", "M13 9PL", "M20 2AF", "M16 8AE", "M15 5RL"],
  },
  Birmingham: {
    city: "Birmingham",
    postcodes: ["B29 6BD", "B15 2TT", "B5 7RN", "B30 2XS"],
  },
  Leeds: {
    city: "Leeds",
    postcodes: ["LS6 1AP", "LS2 9JT", "LS7 3QA", "LS4 2PR"],
  },
  Liverpool: {
    city: "Liverpool",
    postcodes: ["L15 0HU", "L17 8XZ", "L7 8XZ", "L8 0RP"],
  },
  Newcastle: {
    city: "Newcastle",
    postcodes: ["NE2 1XE", "NE6 5AR", "NE7 7DT", "NE1 8JE"],
  },
  Sheffield: {
    city: "Sheffield",
    postcodes: ["S10 2DN", "S11 8ZD", "S3 7RH", "S7 1NJ"],
  },
  Bristol: {
    city: "Bristol",
    postcodes: ["BS6 5PT", "BS7 8NL", "BS8 1PW", "BS5 6TR"],
  },
  Nottingham: {
    city: "Nottingham",
    postcodes: ["NG7 2RD", "NG9 2GL", "NG3 5BL", "NG5 2EF"],
  },
  Leicester: {
    city: "Leicester",
    postcodes: ["LE2 1DA", "LE3 0GR", "LE1 7RH", "LE5 4PW"],
  },
  Coventry: {
    city: "Coventry",
    postcodes: ["CV5 6PJ", "CV3 5NF", "CV6 3DS"],
  },
  Bradford: {
    city: "Bradford",
    postcodes: ["BD8 7HY", "BD5 0JD", "BD3 8QD"],
  },
  Southampton: {
    city: "Southampton",
    postcodes: ["SO17 1BJ", "SO14 0PH", "SO15 5LB"],
  },
  Portsmouth: {
    city: "Portsmouth",
    postcodes: ["PO5 1LR", "PO4 8LS", "PO2 7ED"],
  },
  Plymouth: {
    city: "Plymouth",
    postcodes: ["PL4 6AB", "PL1 5LR", "PL2 3DH"],
  },
  Reading: {
    city: "Reading",
    postcodes: ["RG1 3PG", "RG2 0HN", "RG4 5AN"],
  },
  Oxford: {
    city: "Oxford",
    postcodes: ["OX1 2EP", "OX2 6GG", "OX3 7LF"],
  },
  Cambridge: {
    city: "Cambridge",
    postcodes: ["CB1 2LA", "CB2 1TN", "CB5 8RL"],
  },
  Brighton: {
    city: "Brighton",
    postcodes: ["BN1 4GH", "BN2 9QA", "BN3 3WR"],
  },
  York: {
    city: "York",
    postcodes: ["YO10 5DD", "YO1 7PR", "YO23 1LH"],
  },
  Cardiff: {
    city: "Cardiff",
    postcodes: ["CF24 4NR", "CF10 3AT", "CF14 3UA", "CF11 9LL"],
  },
  Swansea: {
    city: "Swansea",
    postcodes: ["SA1 3QJ", "SA2 0AN"],
  },
  Newport: {
    city: "Newport",
    postcodes: ["NP19 7EF", "NP20 4ED"],
  },
}

// Rent estimates by city (per room, monthly)
const CITY_RENTS: Record<string, number> = {
  London: 750, Manchester: 550, Birmingham: 500, Leeds: 480, Liverpool: 450,
  Newcastle: 470, Sheffield: 450, Bristol: 600, Nottingham: 470, Leicester: 460,
  Coventry: 480, Bradford: 400, Southampton: 550, Portsmouth: 520, Plymouth: 450,
  Reading: 650, Oxford: 700, Cambridge: 720, Brighton: 650, York: 520,
  Edinburgh: 580, Glasgow: 500, Cardiff: 500, Swansea: 420, Newport: 430,
}

// Geocode full address using OpenStreetMap Nominatim (free, address-level accuracy)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Rate limit: 1 request per second for Nominatim
    await new Promise(resolve => setTimeout(resolve, 1100))

    // Clean and encode the address
    const cleanAddress = address
      .replace(/flat\s+\d+/i, '')  // Remove flat numbers for better matching
      .replace(/\s+/g, ' ')
      .trim()

    const query = encodeURIComponent(`${cleanAddress}, UK`)
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=gb&addressdetails=1`

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'HMOHunter/1.0 (https://github.com/hmo-hunter)'
      }
    })

    if (!response.ok) return null

    const data = await response.json()
    if (data && data.length > 0 && data[0].lat && data[0].lon) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      }
    }

    return null
  } catch {
    return null
  }
}

// Fallback: Use postcodes.io for postcode-level geocoding
async function geocodePostcode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const cleanPostcode = postcode.replace(/\s+/g, '')
    const url = `https://api.postcodes.io/postcodes/${cleanPostcode}`

    const response = await fetch(url)
    if (!response.ok) return null

    const data = await response.json()
    if (data.status === 200 && data.result) {
      return {
        lat: data.result.latitude,
        lng: data.result.longitude
      }
    }
    return null
  } catch {
    return null
  }
}

export async function seedRealHMOs(): Promise<{
  success: boolean
  message: string
  propertiesAdded: number
  citiesProcessed: string[]
  addressGeocoded: number
  postcodeGeocoded: number
  errors: string[]
}> {
  const errors: string[] = []
  let propertiesAdded = 0
  let addressGeocoded = 0
  let postcodeGeocoded = 0
  const citiesProcessed: string[] = []

  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return {
        success: false,
        message: "SUPABASE_SERVICE_ROLE_KEY not configured",
        propertiesAdded: 0,
        citiesProcessed: [],
        addressGeocoded: 0,
        postcodeGeocoded: 0,
        errors: ["SUPABASE_SERVICE_ROLE_KEY not set"],
      }
    }

    const apiKey = process.env.PROPERTYDATA_API_KEY
    if (!apiKey) {
      return {
        success: false,
        message: "PROPERTYDATA_API_KEY not configured",
        propertiesAdded: 0,
        citiesProcessed: [],
        addressGeocoded: 0,
        postcodeGeocoded: 0,
        errors: ["PROPERTYDATA_API_KEY not set"],
      }
    }

    const supabase = createServiceRoleClient()

    // Clear existing properties
    console.log("[SeedRealHMOs] Clearing existing properties...")
    await supabase.from("properties").delete().neq("id", "00000000-0000-0000-0000-000000000000")

    // Cache for geocoded addresses to avoid duplicates
    const geocodeCache: Record<string, { lat: number; lng: number }> = {}

    console.log(`[SeedRealHMOs] Fetching real HMO data for ${Object.keys(CITY_POSTCODES).length} cities...`)
    console.log("[SeedRealHMOs] Using ADDRESS-LEVEL geocoding (this will take time due to rate limits)...")

    for (const [cityKey, cityData] of Object.entries(CITY_POSTCODES)) {
      const { city, postcodes } = cityData
      let cityPropertiesAdded = 0

      console.log(`[SeedRealHMOs] Processing ${city} (${postcodes.length} postcodes)...`)

      for (const postcode of postcodes) {
        try {
          // Add delay to avoid PropertyData rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))

          const cleanPostcode = postcode.replace(/\s+/g, "%20")
          const url = `https://api.propertydata.co.uk/national-hmo-register?key=${apiKey}&postcode=${cleanPostcode}`

          const response = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
          })

          if (!response.ok) {
            if (response.status !== 429) {
              errors.push(`${city}/${postcode}: HTTP ${response.status}`)
            }
            continue
          }

          const data = await response.json()

          if (data.status === "error") {
            errors.push(`${city}/${postcode}: ${data.message}`)
            continue
          }

          const records = data.data?.hmos || []
          console.log(`[SeedRealHMOs] Found ${records.length} HMOs for ${postcode}`)

          const baseRent = CITY_RENTS[city] || 500

          for (const record of records) {
            const address = record.address || `HMO near ${postcode}`

            // Extract postcode from address
            const addressPostcode = address.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}/i)?.[0] || postcode

            // Create cache key from normalized address
            const cacheKey = address.toLowerCase().replace(/\s+/g, ' ').trim()

            let coords: { lat: number; lng: number } | null = null

            // Check cache first
            if (geocodeCache[cacheKey]) {
              coords = geocodeCache[cacheKey]
            } else {
              // Try address-level geocoding first
              coords = await geocodeAddress(address)

              if (coords) {
                addressGeocoded++
                geocodeCache[cacheKey] = coords
              } else {
                // Fallback to postcode geocoding with small random offset
                const postcodeCoords = await geocodePostcode(addressPostcode)
                if (postcodeCoords) {
                  // Add small random offset (roughly 50-100m) to spread out same-postcode properties
                  coords = {
                    lat: postcodeCoords.lat + (Math.random() - 0.5) * 0.001,
                    lng: postcodeCoords.lng + (Math.random() - 0.5) * 0.001
                  }
                  postcodeGeocoded++
                  geocodeCache[cacheKey] = coords
                }
              }
            }

            // Skip if no coordinates found
            if (!coords) {
              continue
            }

            const bedrooms = record.number_of_rooms_providing_sleeping_accommodation ||
                            record.max_occupants ||
                            record.bedrooms || 4

            const bathrooms = record.number_of_shared_bathrooms || Math.ceil(bedrooms / 2.5)

            const rentPerRoom = baseRent + Math.floor(Math.random() * 100) - 50
            const pricePcm = rentPerRoom * bedrooms

            const licenseExpiry = record.licence_expiry || record.expiry_date

            const propertyData = {
              title: `Licensed HMO - ${address.split(',')[0]}`,
              address: address,
              postcode: addressPostcode,
              city: city,
              country: "UK",
              latitude: coords.lat,
              longitude: coords.lng,
              listing_type: "rent",
              price_pcm: pricePcm,
              estimated_rent_per_room: rentPerRoom,
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
              near_tube_station: city === "London",
              is_stale: false,
              last_seen_at: new Date().toISOString(),
              description: `Licensed HMO in ${city}. Council: ${record.council || "Local Authority"}. ${licenseExpiry ? `License expires: ${licenseExpiry}. ` : ""}${bedrooms} bedrooms, ${bathrooms} bathrooms. Reference: ${record.reference || "N/A"}.`,
              source_type: "council_register",
            }

            const { error: insertError } = await supabase.from("properties").insert(propertyData)

            if (insertError) {
              if (!insertError.message.includes("duplicate")) {
                errors.push(`Insert: ${insertError.message}`)
              }
            } else {
              propertiesAdded++
              cityPropertiesAdded++
            }
          }
        } catch (error) {
          errors.push(`${city}/${postcode}: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      }

      if (cityPropertiesAdded > 0) {
        citiesProcessed.push(`${city} (${cityPropertiesAdded})`)
      }
      console.log(`[SeedRealHMOs] ${city}: Added ${cityPropertiesAdded} properties`)
    }

    console.log(`[SeedRealHMOs] Complete. Added ${propertiesAdded} properties.`)
    console.log(`[SeedRealHMOs] Geocoding: ${addressGeocoded} address-level, ${postcodeGeocoded} postcode-level`)

    return {
      success: propertiesAdded > 0,
      message: `Added ${propertiesAdded} real HMO properties (${addressGeocoded} address-level, ${postcodeGeocoded} postcode-level geocoding)`,
      propertiesAdded,
      citiesProcessed,
      addressGeocoded,
      postcodeGeocoded,
      errors: errors.slice(0, 20),
    }
  } catch (error) {
    console.error("[SeedRealHMOs] Fatal error:", error)
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      propertiesAdded: 0,
      citiesProcessed: [],
      addressGeocoded: 0,
      postcodeGeocoded: 0,
      errors: [error instanceof Error ? error.message : "Unknown error"],
    }
  }
}
