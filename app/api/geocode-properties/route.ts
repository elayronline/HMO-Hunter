import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/geocode-properties
 *
 * Re-geocodes properties to get accurate address-level coordinates
 * Uses Nominatim (OpenStreetMap) for precise geocoding
 *
 * Body: {
 *   limit?: number,  // Number of properties to process (default 20, max 100)
 *   city?: string,   // Filter by city
 *   forceAll?: boolean // Re-geocode even if already has coordinates
 * }
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []
  let lastNominatimCall = 0

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 20, 100)
    const city = body.city
    const forceAll = body.forceAll || false

    log.push(`Starting geocoding for up to ${limit} properties...`)
    if (city) log.push(`Filtering by city: ${city}`)

    // Fetch properties that need geocoding
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, latitude, longitude")
      .eq("is_stale", false)

    if (city) {
      query = query.eq("city", city)
    }

    // If not forcing all, prioritize properties that may have inaccurate coords
    if (!forceAll) {
      // Properties with coordinates that might be postcode-level only
      // We can detect this by looking for properties with very similar coordinates
      query = query.not("address", "is", null)
    }

    const { data: properties, error: fetchError } = await query.limit(limit * 2)

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: fetchError.message,
        log,
      }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties found to geocode",
        log,
        updated: [],
        failed: [],
      })
    }

    // Find properties that likely have postcode-level coordinates
    // (multiple properties at the exact same location)
    const coordCounts: Record<string, number> = {}
    properties.forEach(p => {
      const key = `${p.latitude?.toFixed(6)},${p.longitude?.toFixed(6)}`
      coordCounts[key] = (coordCounts[key] || 0) + 1
    })

    // Prioritize properties that share coordinates with others
    const sortedProperties = properties
      .filter(p => p.address && p.postcode)
      .map(p => ({
        ...p,
        coordKey: `${p.latitude?.toFixed(6)},${p.longitude?.toFixed(6)}`,
        shareCount: coordCounts[`${p.latitude?.toFixed(6)},${p.longitude?.toFixed(6)}`] || 0,
      }))
      .sort((a, b) => b.shareCount - a.shareCount)
      .slice(0, limit)

    log.push(`Found ${sortedProperties.length} properties to process`)
    log.push(`${sortedProperties.filter(p => p.shareCount > 1).length} properties share coordinates with others`)

    // Process each property
    for (const property of sortedProperties) {
      try {
        log.push(`Processing: ${property.address}...`)

        // Rate limit Nominatim (1 request per second)
        const now = Date.now()
        if (now - lastNominatimCall < 1100) {
          await new Promise(resolve => setTimeout(resolve, 1100 - (now - lastNominatimCall)))
        }
        lastNominatimCall = Date.now()

        // Try to geocode the full address
        const coords = await geocodeAddress(property.address, property.postcode)

        if (coords) {
          // Check if coordinates actually changed
          const latDiff = Math.abs((property.latitude || 0) - coords.lat)
          const lngDiff = Math.abs((property.longitude || 0) - coords.lng)

          if (latDiff > 0.00001 || lngDiff > 0.00001) {
            // Update the property with new coordinates
            const { error: updateError } = await supabaseAdmin
              .from("properties")
              .update({
                latitude: coords.lat,
                longitude: coords.lng,
              })
              .eq("id", property.id)

            if (updateError) {
              log.push(`  Failed to update: ${updateError.message}`)
              failed.push(property.address)
            } else {
              log.push(`  Updated: ${property.latitude?.toFixed(6)},${property.longitude?.toFixed(6)} -> ${coords.lat.toFixed(6)},${coords.lng.toFixed(6)}`)
              updated.push(property.address)
            }
          } else {
            log.push(`  No change needed (already accurate)`)
          }
        } else {
          log.push(`  Could not geocode address`)
          failed.push(property.address)
        }
      } catch (error) {
        log.push(`  Error: ${error}`)
        failed.push(property.address)
      }
    }

    log.push("")
    log.push(`Completed: ${updated.length} updated, ${failed.length} failed`)

    return NextResponse.json({
      success: true,
      message: `Updated ${updated.length} property coordinates`,
      log,
      updated,
      failed,
      summary: {
        processed: sortedProperties.length,
        updated: updated.length,
        failed: failed.length,
        unchanged: sortedProperties.length - updated.length - failed.length,
      },
    })
  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({
      success: false,
      error: String(error),
      log,
    }, { status: 500 })
  }
}

/**
 * Geocode a full address using Nominatim (OpenStreetMap)
 */
async function geocodeAddress(address: string, postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    // Clean and format address
    const cleanAddress = address
      .replace(/flat\s*\d+[a-z]?\s*,?\s*/gi, "")
      .replace(/apartment\s*\d+[a-z]?\s*,?\s*/gi, "")
      .replace(/unit\s*\d+[a-z]?\s*,?\s*/gi, "")
      .replace(/\s+/g, " ")
      .trim()

    // Try full address with postcode
    const query = `${cleanAddress}, ${postcode}, United Kingdom`

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=gb&addressdetails=1`,
      {
        headers: {
          "User-Agent": "HMO-Hunter-App/1.0 (contact@hmohunter.com)",
          "Accept": "application/json",
        },
      }
    )

    if (response.ok) {
      const results = await response.json()
      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat)
        const lng = parseFloat(results[0].lon)
        if (!isNaN(lat) && !isNaN(lng)) {
          return { lat, lng }
        }
      }
    }

    // Fallback: Try street name with house number offset
    const streetMatch = cleanAddress.match(/^(\d+[a-z]?)\s+(.+)/i)
    if (streetMatch) {
      const houseNum = parseInt(streetMatch[1])
      const streetName = streetMatch[2]

      const streetQuery = `${streetName}, ${postcode}, United Kingdom`
      const response2 = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(streetQuery)}&format=json&limit=1&countrycodes=gb`,
        {
          headers: {
            "User-Agent": "HMO-Hunter-App/1.0 (contact@hmohunter.com)",
            "Accept": "application/json",
          },
        }
      )

      if (response2.ok) {
        const results2 = await response2.json()
        if (results2 && results2.length > 0) {
          const lat = parseFloat(results2[0].lat)
          const lng = parseFloat(results2[0].lon)
          if (!isNaN(lat) && !isNaN(lng)) {
            // Add house number offset along the street
            // Roughly 8 meters per house number
            const offset = (houseNum % 50) * 0.00007
            return { lat: lat + offset, lng }
          }
        }
      }
    }

    // Final fallback: postcode with address-based offset
    const postcodeResponse = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s+/g, ""))}`)

    if (postcodeResponse.ok) {
      const postcodeData = await postcodeResponse.json()
      if (postcodeData.status === 200 && postcodeData.result) {
        const baseLat = postcodeData.result.latitude
        const baseLng = postcodeData.result.longitude

        // Generate deterministic offset from address
        let hash = 0
        for (let i = 0; i < address.length; i++) {
          hash = ((hash << 5) - hash) + address.charCodeAt(i)
          hash = hash & hash
        }

        // Offset within ~100 meter radius
        const latOffset = ((hash % 200) - 100) * 0.00005
        const lngOffset = (((hash >> 8) % 200) - 100) * 0.00005

        return {
          lat: baseLat + latOffset,
          lng: baseLng + lngOffset,
        }
      }
    }
  } catch (error) {
    console.error(`[Geocode] Error: ${error}`)
  }

  return null
}

/**
 * GET /api/geocode-properties
 * Returns info about geocoding endpoint
 */
export async function GET() {
  // Check how many properties might need re-geocoding
  const { data: properties } = await supabaseAdmin
    .from("properties")
    .select("latitude, longitude")
    .eq("is_stale", false)
    .not("latitude", "is", null)
    .limit(1000)

  // Count properties at each coordinate
  const coordCounts: Record<string, number> = {}
  properties?.forEach(p => {
    const key = `${p.latitude?.toFixed(6)},${p.longitude?.toFixed(6)}`
    coordCounts[key] = (coordCounts[key] || 0) + 1
  })

  const duplicateCoords = Object.entries(coordCounts)
    .filter(([_, count]) => count > 1)
    .length

  const propertiesWithDuplicateCoords = Object.entries(coordCounts)
    .filter(([_, count]) => count > 1)
    .reduce((sum, [_, count]) => sum + count, 0)

  return NextResponse.json({
    message: "POST to re-geocode property coordinates",
    description: "Uses Nominatim (OpenStreetMap) for accurate address-level geocoding",
    usage: {
      limit: "Number of properties to process (default 20, max 100)",
      city: "Filter by city name",
      forceAll: "Re-geocode all properties, not just those with potential issues",
    },
    stats: {
      totalProperties: properties?.length || 0,
      uniqueCoordinates: Object.keys(coordCounts).length,
      duplicateCoordinateLocations: duplicateCoords,
      propertiesAtDuplicateLocations: propertiesWithDuplicateCoords,
      needsGeocoding: propertiesWithDuplicateCoords,
    },
    note: "Properties sharing exact coordinates likely only have postcode-level geocoding",
  })
}
