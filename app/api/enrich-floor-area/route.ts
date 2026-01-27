import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

interface PropertyDataFloorAreaResponse {
  status: string
  postcode?: string
  data?: {
    average_floor_area?: number
    median_floor_area?: number
    min_floor_area?: number
    max_floor_area?: number
    count?: number
  }
  error?: string
}

interface PropertyDataUPRNResponse {
  status: string
  data?: {
    uprn?: string
    address?: string
    postcode?: string
    total_floor_area?: number
    floor_area?: number
    number_habitable_rooms?: number
    property_type?: string
    built_form?: string
    construction_age_band?: string
    current_energy_rating?: string
    potential_energy_rating?: string
  }
  error?: string
}

/**
 * Fetch floor area data from PropertyData API
 */
async function getFloorAreaByPostcode(postcode: string, apiKey: string): Promise<PropertyDataFloorAreaResponse | null> {
  try {
    const response = await fetch(
      `https://api.propertydata.co.uk/floor-areas?key=${apiKey}&postcode=${encodeURIComponent(postcode)}`,
      {
        headers: {
          "Accept": "application/json",
        },
      }
    )

    if (!response.ok) {
      console.error(`[PropertyData] Floor areas API error: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("[PropertyData] Floor areas fetch error:", error)
    return null
  }
}

/**
 * Fetch property details by UPRN from PropertyData API
 */
async function getPropertyByUPRN(uprn: string, apiKey: string): Promise<PropertyDataUPRNResponse | null> {
  try {
    const response = await fetch(
      `https://api.propertydata.co.uk/uprn?key=${apiKey}&uprn=${encodeURIComponent(uprn)}`,
      {
        headers: {
          "Accept": "application/json",
        },
      }
    )

    if (!response.ok) {
      console.error(`[PropertyData] UPRN API error: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("[PropertyData] UPRN fetch error:", error)
    return null
  }
}

/**
 * POST /api/enrich-floor-area
 *
 * Enriches properties with floor area data from PropertyData API
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 20, 100)
    const city = body.city
    const propertyId = body.propertyId

    const apiKey = process.env.PROPERTYDATA_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: "PROPERTYDATA_API_KEY not configured",
        log,
      }, { status: 400 })
    }

    log.push("Starting floor area enrichment via PropertyData API...")

    // Fetch properties needing floor area data
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, uprn, gross_internal_area_sqm, bedrooms")
      .eq("is_stale", false)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else {
      if (city) {
        query = query.eq("city", city)
      }
      // Get properties without floor area data
      query = query.is("gross_internal_area_sqm", null)
      query = query.limit(limit)
    }

    const { data: properties, error: fetchError } = await query

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
        message: "No properties found needing floor area data",
        log,
        updated: [],
        failed: [],
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    // Group properties by postcode for efficiency
    const postcodeGroups = new Map<string, typeof properties>()
    for (const property of properties) {
      const pc = property.postcode?.toUpperCase().replace(/\s+/g, " ").trim()
      if (pc) {
        if (!postcodeGroups.has(pc)) {
          postcodeGroups.set(pc, [])
        }
        postcodeGroups.get(pc)!.push(property)
      }
    }

    log.push(`Grouped into ${postcodeGroups.size} postcodes`)

    // Process each postcode
    for (const [postcode, props] of postcodeGroups) {
      try {
        log.push(`Processing postcode: ${postcode} (${props.length} properties)`)

        // First try to get floor area data by postcode
        const floorAreaData = await getFloorAreaByPostcode(postcode, apiKey)

        if (floorAreaData?.status === "success" && floorAreaData.data) {
          const avgFloorArea = floorAreaData.data.average_floor_area || floorAreaData.data.median_floor_area

          if (avgFloorArea) {
            // Update all properties in this postcode with average floor area
            for (const property of props) {
              // If property has UPRN, try to get specific data
              let specificFloorArea = avgFloorArea
              let roomCount = property.bedrooms

              if (property.uprn) {
                const uprnData = await getPropertyByUPRN(property.uprn, apiKey)
                if (uprnData?.status === "success" && uprnData.data) {
                  specificFloorArea = uprnData.data.total_floor_area || uprnData.data.floor_area || avgFloorArea
                  roomCount = uprnData.data.number_habitable_rooms || roomCount
                }
                // Small delay between UPRN requests
                await new Promise(resolve => setTimeout(resolve, 200))
              }

              // Determine floor area band
              let floorAreaBand: "under_90" | "90_120" | "120_plus" | null = null
              if (specificFloorArea < 90) {
                floorAreaBand = "under_90"
              } else if (specificFloorArea <= 120) {
                floorAreaBand = "90_120"
              } else {
                floorAreaBand = "120_plus"
              }

              // Update property
              const { error: updateError } = await supabaseAdmin
                .from("properties")
                .update({
                  gross_internal_area_sqm: Math.round(specificFloorArea),
                  floor_area_band: floorAreaBand,
                  room_count: roomCount,
                })
                .eq("id", property.id)

              if (updateError) {
                log.push(`  Failed to update ${property.address}: ${updateError.message}`)
                failed.push(property.address)
              } else {
                log.push(`  Updated: ${property.address} (${Math.round(specificFloorArea)} sqm)`)
                updated.push(property.address)
              }
            }
          } else {
            log.push(`  No floor area data available for ${postcode}`)
            props.forEach(p => failed.push(p.address))
          }
        } else {
          log.push(`  API returned no data for ${postcode}`)
          props.forEach(p => failed.push(p.address))
        }

        // Delay between postcode requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error) {
        log.push(`  Error processing ${postcode}: ${error}`)
        props.forEach(p => failed.push(p.address))
      }
    }

    log.push("")
    log.push(`Completed: ${updated.length} enriched, ${failed.length} failed`)

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with floor area data`,
      log,
      updated,
      failed,
      summary: {
        processed: properties.length,
        enriched: updated.length,
        failed: failed.length,
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
 * GET /api/enrich-floor-area
 * Returns info and checks configuration
 */
export async function GET() {
  const apiKey = process.env.PROPERTYDATA_API_KEY
  const hasApiKey = !!apiKey

  // Check how many properties need floor area
  const { data: properties } = await supabaseAdmin
    .from("properties")
    .select("id, gross_internal_area_sqm")
    .eq("is_stale", false)
    .limit(500)

  const withFloorArea = properties?.filter(p => p.gross_internal_area_sqm && p.gross_internal_area_sqm > 0).length || 0
  const totalProperties = properties?.length || 0
  const needsFloorArea = totalProperties - withFloorArea

  return NextResponse.json({
    message: "POST to enrich properties with floor area data from PropertyData API",
    description: "Fetches floor area (sqm) using postcode and UPRN lookups",
    configuration: {
      propertyDataApiKey: hasApiKey ? "Configured" : "NOT CONFIGURED",
    },
    stats: {
      totalProperties,
      withFloorArea,
      needsFloorArea,
    },
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties to process (default 20, max 100)",
        city: "Filter by city name",
        propertyId: "Enrich a specific property by ID",
      },
    },
    dataSource: {
      name: "PropertyData API",
      endpoints: ["/floor-areas", "/uprn"],
      docs: "https://propertydata.co.uk/api/documentation",
      provides: ["gross_internal_area_sqm", "floor_area_band", "room_count"],
    },
    setupInstructions: !hasApiKey ? [
      "1. Sign up at https://propertydata.co.uk/",
      "2. Get your API key from dashboard",
      "3. Add to .env.local: PROPERTYDATA_API_KEY=your_key",
    ] : null,
  })
}
