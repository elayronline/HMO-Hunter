import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/api-auth"

/**
 * POST /api/seed-real-data
 *
 * Seeds realistic HMO property data with accurate geocoding from postcodes.io
 * This is a fallback when API credits are exhausted
 *
 * WARNING: This clears all existing data!
 * Requires admin authentication
 */
export async function POST() {
  // Require admin access - this endpoint deletes all data
  const auth = await requireAdmin()
  if (!auth.authenticated) {
    return auth.response
  }

  const log: string[] = []

  try {
    log.push("[1/3] Clearing existing data...")

    // Clear existing properties
    await supabaseAdmin.from("properties").delete().neq("id", "00000000-0000-0000-0000-000000000000")

    log.push("[2/3] Geocoding postcodes and creating properties...")

    // Real UK postcodes across multiple cities - HMO dense areas
    const propertyData = [
      // London - Various boroughs
      { postcode: "N7 6PA", address: "15 Holloway Road", city: "London", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "N7 8JG", address: "42 Seven Sisters Road", city: "London", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "E2 9PL", address: "78 Bethnal Green Road", city: "London", bedrooms: 4, type: "Potential HMO" },
      { postcode: "E2 7RH", address: "23 Columbia Road", city: "London", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "SE5 8TR", address: "156 Camberwell Road", city: "London", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "SE15 4QL", address: "89 Peckham High Street", city: "London", bedrooms: 5, type: "Potential HMO" },
      { postcode: "NW5 2HB", address: "34 Kentish Town Road", city: "London", bedrooms: 4, type: "Licensed HMO" },
      { postcode: "NW1 8PR", address: "67 Camden High Street", city: "London", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "E8 1EJ", address: "12 Mare Street", city: "London", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "E8 3RD", address: "45 Dalston Lane", city: "London", bedrooms: 5, type: "Potential HMO" },
      { postcode: "SW9 8PS", address: "23 Brixton Road", city: "London", bedrooms: 4, type: "Licensed HMO" },
      { postcode: "SW2 1JF", address: "78 Brixton Hill", city: "London", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "N4 2HA", address: "56 Stroud Green Road", city: "London", bedrooms: 6, type: "Potential HMO" },
      { postcode: "N16 8AD", address: "89 Stoke Newington High St", city: "London", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "E17 4PP", address: "34 Walthamstow High Street", city: "London", bedrooms: 4, type: "Licensed HMO" },
      { postcode: "E11 1PB", address: "67 Leytonstone High Road", city: "London", bedrooms: 5, type: "Potential HMO" },
      { postcode: "W12 8QQ", address: "12 Shepherds Bush Road", city: "London", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "W3 8SG", address: "45 Acton High Street", city: "London", bedrooms: 5, type: "Licensed HMO" },

      // Manchester - Student areas
      { postcode: "M14 5SX", address: "23 Wilmslow Road, Fallowfield", city: "Manchester", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "M14 6WS", address: "78 Moseley Road", city: "Manchester", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "M13 9PL", address: "45 Oxford Road, Rusholme", city: "Manchester", bedrooms: 5, type: "Potential HMO" },
      { postcode: "M13 0JF", address: "12 Dickenson Road", city: "Manchester", bedrooms: 4, type: "Licensed HMO" },
      { postcode: "M20 2WS", address: "34 Palatine Road, Withington", city: "Manchester", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "M19 2QP", address: "67 Stockport Road, Levenshulme", city: "Manchester", bedrooms: 6, type: "Potential HMO" },
      { postcode: "M16 8AW", address: "89 Great Western Street", city: "Manchester", bedrooms: 5, type: "Licensed HMO" },

      // Birmingham - Selly Oak student area
      { postcode: "B29 6BD", address: "23 Bristol Road, Selly Oak", city: "Birmingham", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "B29 6NA", address: "45 Harborne Lane", city: "Birmingham", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "B16 8UU", address: "78 Hagley Road, Edgbaston", city: "Birmingham", bedrooms: 5, type: "Potential HMO" },
      { postcode: "B15 2TT", address: "12 Pershore Road", city: "Birmingham", bedrooms: 4, type: "Licensed HMO" },
      { postcode: "B30 2AA", address: "34 Bournville Lane", city: "Birmingham", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "B17 8LH", address: "56 Court Oak Road", city: "Birmingham", bedrooms: 6, type: "Potential HMO" },

      // Leeds - Headingley student area
      { postcode: "LS6 3HN", address: "23 Headingley Lane", city: "Leeds", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "LS6 2DL", address: "45 Otley Road", city: "Leeds", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "LS2 9JT", address: "78 Woodhouse Lane", city: "Leeds", bedrooms: 5, type: "Potential HMO" },
      { postcode: "LS4 2PR", address: "12 Burley Road", city: "Leeds", bedrooms: 4, type: "Licensed HMO" },
      { postcode: "LS6 1AP", address: "34 Hyde Park Road", city: "Leeds", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "LS7 3PQ", address: "67 Chapeltown Road", city: "Leeds", bedrooms: 6, type: "Potential HMO" },

      // Liverpool
      { postcode: "L15 0EE", address: "23 Wavertree Road", city: "Liverpool", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "L7 8XZ", address: "45 Smithdown Road", city: "Liverpool", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "L17 8XW", address: "78 Aigburth Road", city: "Liverpool", bedrooms: 5, type: "Potential HMO" },
      { postcode: "L8 0TD", address: "12 Princes Road", city: "Liverpool", bedrooms: 4, type: "Licensed HMO" },

      // Newcastle - Jesmond/Heaton
      { postcode: "NE2 1XE", address: "23 Osborne Road, Jesmond", city: "Newcastle", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "NE2 3AE", address: "45 Sandyford Road", city: "Newcastle", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "NE6 5LR", address: "78 Heaton Road", city: "Newcastle", bedrooms: 5, type: "Potential HMO" },
      { postcode: "NE6 5HN", address: "12 Chillingham Road", city: "Newcastle", bedrooms: 4, type: "Licensed HMO" },

      // Nottingham - Lenton student area
      { postcode: "NG7 1QN", address: "23 Derby Road, Lenton", city: "Nottingham", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "NG7 2RD", address: "45 Castle Boulevard", city: "Nottingham", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "NG9 2JJ", address: "78 Queens Road, Beeston", city: "Nottingham", bedrooms: 5, type: "Potential HMO" },
      { postcode: "NG7 1NR", address: "12 Lenton Boulevard", city: "Nottingham", bedrooms: 4, type: "Licensed HMO" },

      // Sheffield - Broomhill/Ecclesall
      { postcode: "S10 2TN", address: "23 Ecclesall Road, Broomhill", city: "Sheffield", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "S10 2GE", address: "45 Crookes Road", city: "Sheffield", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "S11 8TP", address: "78 Abbeydale Road", city: "Sheffield", bedrooms: 5, type: "Potential HMO" },
      { postcode: "S11 9ND", address: "12 Banner Cross", city: "Sheffield", bedrooms: 4, type: "Licensed HMO" },

      // Bristol - Redland/Clifton
      { postcode: "BS6 5BZ", address: "23 Whiteladies Road, Redland", city: "Bristol", bedrooms: 6, type: "Licensed HMO" },
      { postcode: "BS6 6QH", address: "45 Gloucester Road", city: "Bristol", bedrooms: 5, type: "Licensed HMO" },
      { postcode: "BS7 8NB", address: "78 Filton Avenue", city: "Bristol", bedrooms: 5, type: "Potential HMO" },
      { postcode: "BS8 1QU", address: "12 Park Street, Clifton", city: "Bristol", bedrooms: 4, type: "Licensed HMO" },
    ]

    // Geocode all postcodes using postcodes.io bulk API
    const postcodes = [...new Set(propertyData.map(p => p.postcode))]
    const geocodeResults = new Map<string, { lat: number; lng: number }>()

    // Bulk lookup (max 100 postcodes per request)
    const response = await fetch("https://api.postcodes.io/postcodes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcodes }),
    })

    if (response.ok) {
      const data = await response.json()
      for (const result of data.result || []) {
        if (result.result) {
          geocodeResults.set(result.query, {
            lat: result.result.latitude,
            lng: result.result.longitude,
          })
        }
      }
    }

    log.push("Geocoded " + geocodeResults.size + " of " + postcodes.length + " postcodes")

    // Create properties with geocoded coordinates
    const properties = propertyData.map((p, index) => {
      const coords = geocodeResults.get(p.postcode)
      const isLicensed = p.type === "Licensed HMO"
      const isPotential = p.type === "Potential HMO"

      return {
        title: p.bedrooms + " Bed " + p.type + " - " + p.address,
        address: p.address,
        postcode: p.postcode,
        city: p.city,
        country: "UK",
        latitude: coords?.lat || null,
        longitude: coords?.lng || null,
        listing_type: "rent" as const,
        price_pcm: 400 + (p.bedrooms * 150) + Math.floor(Math.random() * 200),
        purchase_price: isLicensed ? 250000 + (p.bedrooms * 50000) + Math.floor(Math.random() * 100000) : null,
        property_type: "HMO" as const,
        hmo_status: p.type,
        bedrooms: p.bedrooms,
        bathrooms: Math.ceil(p.bedrooms / 2.5),
        description: p.type + " property in " + p.city + ". " + p.bedrooms + " bedrooms, ideal for " + (isLicensed ? "professional sharers or students" : "HMO conversion") + ".",
        source_name: "SeedData",
        source_type: null,
        external_id: "SEED-" + p.city.toUpperCase().slice(0, 3) + "-" + (index + 1),
        licensed_hmo: isLicensed,
        is_student_friendly: true,
        is_pet_friendly: false,
        is_furnished: true,
        has_garden: Math.random() > 0.5,
        wifi_included: true,
        near_tube_station: p.city === "London",
        is_stale: false,
        last_seen_at: new Date().toISOString(),
        last_synced: new Date().toISOString(),
        // Potential HMO fields
        is_potential_hmo: isPotential,
        hmo_classification: isPotential ? (Math.random() > 0.5 ? "ready_to_go" : "value_add") : null,
        deal_score: isPotential ? Math.floor(60 + Math.random() * 35) : null,
        floor_area: 80 + (p.bedrooms * 15) + Math.floor(Math.random() * 30),
        yield_band: isPotential ? (Math.random() > 0.6 ? "high" : "medium") : null,
        article_4_area: false,
        conservation_area: false,
      }
    })

    // Filter to only include properties with valid coordinates
    const validProperties = properties.filter(p => p.latitude && p.longitude)
    log.push(validProperties.length + " properties have valid coordinates")

    // Insert properties
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("properties")
      .insert(validProperties)
      .select("id, city")

    if (insertError) {
      log.push("Insert error: " + insertError.message)
      return NextResponse.json({ success: false, error: insertError.message, log }, { status: 500 })
    }

    log.push("[3/3] Inserted " + (inserted?.length || 0) + " properties")

    // Get stats
    const stats = {
      total: inserted?.length || 0,
      byCity: {} as Record<string, number>,
    }
    inserted?.forEach(p => {
      stats.byCity[p.city] = (stats.byCity[p.city] || 0) + 1
    })

    return NextResponse.json({
      success: true,
      message: "Seeded realistic HMO data with accurate geocoding",
      log,
      stats,
    })

  } catch (error) {
    log.push("Error: " + error)
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to seed realistic HMO property data with accurate geocoding",
    description: "Uses postcodes.io for accurate UK postcode geocoding",
    cities: ["London", "Manchester", "Birmingham", "Leeds", "Liverpool", "Newcastle", "Nottingham", "Sheffield", "Bristol"],
  })
}
