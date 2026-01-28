import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * UK HMO Room Rental Data (2024/2025 Market Rates)
 * Source: SpareRoom, Rightmove, Zoopla market data
 *
 * These are per-room monthly rents for HMO properties
 */
const CITY_ROOM_RENTS: Record<string, { min: number; max: number; avg: number }> = {
  // London - highest rents, varies significantly by zone
  "London": { min: 650, max: 1100, avg: 825 },

  // South England
  "Bristol": { min: 550, max: 800, avg: 675 },
  "Brighton": { min: 600, max: 900, avg: 750 },
  "Oxford": { min: 650, max: 950, avg: 800 },
  "Cambridge": { min: 650, max: 950, avg: 800 },
  "Southampton": { min: 500, max: 700, avg: 600 },
  "Portsmouth": { min: 475, max: 675, avg: 575 },
  "Reading": { min: 575, max: 825, avg: 700 },

  // Midlands
  "Birmingham": { min: 475, max: 700, avg: 575 },
  "Coventry": { min: 450, max: 650, avg: 550 },
  "Leicester": { min: 425, max: 625, avg: 525 },
  "Nottingham": { min: 450, max: 650, avg: 550 },
  "Derby": { min: 400, max: 575, avg: 475 },

  // North England
  "Manchester": { min: 525, max: 775, avg: 650 },
  "Liverpool": { min: 425, max: 600, avg: 500 },
  "Leeds": { min: 475, max: 675, avg: 575 },
  "Sheffield": { min: 425, max: 600, avg: 500 },
  "Newcastle": { min: 400, max: 575, avg: 475 },
  "York": { min: 525, max: 750, avg: 625 },
  "Bradford": { min: 375, max: 525, avg: 450 },
  "Hull": { min: 350, max: 500, avg: 425 },

  // Scotland
  "Edinburgh": { min: 575, max: 850, avg: 700 },
  "Glasgow": { min: 475, max: 675, avg: 575 },
  "Aberdeen": { min: 450, max: 650, avg: 550 },
  "Dundee": { min: 400, max: 575, avg: 475 },

  // Wales
  "Cardiff": { min: 475, max: 675, avg: 575 },
  "Swansea": { min: 400, max: 575, avg: 475 },

  // Default for unlisted cities
  "_default": { min: 425, max: 625, avg: 525 },
}

/**
 * Generate a realistic room rent with some variance
 */
function generateRoomRent(city: string): number {
  const rates = CITY_ROOM_RENTS[city] || CITY_ROOM_RENTS["_default"]

  // Add some variance around the average (±15%)
  const variance = 0.15
  const baseRent = rates.avg
  const minRent = Math.max(rates.min, baseRent * (1 - variance))
  const maxRent = Math.min(rates.max, baseRent * (1 + variance))

  // Random value between min and max, rounded to nearest £25
  const rent = minRent + Math.random() * (maxRent - minRent)
  return Math.round(rent / 25) * 25
}

/**
 * POST /api/enrich-rents
 *
 * Updates properties with realistic HMO rental data based on UK market rates
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 50, 500)
    const city = body.city
    const forceUpdate = body.forceUpdate === true // Update even if rent data exists

    log.push("Starting rent data enrichment with UK market rates...")

    // Fetch properties needing rent data
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, city, bedrooms, listing_type, price_pcm, estimated_rent_per_room, purchase_price")
      .eq("is_stale", false)

    if (city) {
      query = query.eq("city", city)
    }

    if (!forceUpdate) {
      // Only get properties without proper rent data
      query = query.or("estimated_rent_per_room.is.null,estimated_rent_per_room.eq.0")
    }

    query = query.limit(limit)

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
        message: "No properties found needing rent data",
        log,
        updated: [],
        failed: [],
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    // Group by city for logging
    const cityCounts: Record<string, number> = {}
    properties.forEach(p => {
      cityCounts[p.city] = (cityCounts[p.city] || 0) + 1
    })
    log.push(`Cities: ${Object.entries(cityCounts).map(([c, n]) => `${c}(${n})`).join(", ")}`)

    // Process each property
    for (const property of properties) {
      try {
        const roomRent = generateRoomRent(property.city)
        const bedrooms = property.bedrooms || 4
        const totalRent = roomRent * bedrooms

        // Calculate purchase price if not set (based on ~7% yield)
        let purchasePrice = property.purchase_price
        if (!purchasePrice || purchasePrice === 0) {
          const annualRent = totalRent * 12
          const yieldRate = 0.065 + Math.random() * 0.02 // 6.5-8.5% yield
          purchasePrice = Math.round(annualRent / yieldRate / 5000) * 5000
        }

        // Calculate yield
        const annualRent = totalRent * 12
        const grossYield = purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : null

        const updateData: Record<string, any> = {
          estimated_rent_per_room: roomRent,
          price_pcm: property.listing_type === "rent" ? totalRent : property.price_pcm,
          estimated_gross_monthly_rent: totalRent,
          estimated_annual_income: annualRent,
        }

        // Update purchase price and yield for purchase listings
        if (property.listing_type === "purchase" || !property.purchase_price) {
          updateData.purchase_price = purchasePrice
          if (grossYield) {
            updateData.estimated_yield_percentage = Math.round(grossYield * 10) / 10
            // Set yield band
            if (grossYield >= 8) {
              updateData.yield_band = "high"
            } else if (grossYield >= 6) {
              updateData.yield_band = "medium"
            } else {
              updateData.yield_band = "low"
            }
          }
        }

        const { error: updateError } = await supabaseAdmin
          .from("properties")
          .update(updateData)
          .eq("id", property.id)

        if (updateError) {
          log.push(`  Failed: ${property.address} - ${updateError.message}`)
          failed.push(property.address)
        } else {
          log.push(`  ${property.city}: ${property.address} - £${roomRent}/room × ${bedrooms} = £${totalRent}/mo`)
          updated.push(property.address)
        }
      } catch (error) {
        log.push(`  Error: ${property.address} - ${error}`)
        failed.push(property.address)
      }
    }

    log.push("")
    log.push(`Completed: ${updated.length} enriched, ${failed.length} failed`)

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with rent data`,
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
 * GET /api/enrich-rents
 *
 * Returns API info and current rent data statistics
 */
export async function GET() {
  // Get current rent data stats
  const { data: properties } = await supabaseAdmin
    .from("properties")
    .select("city, estimated_rent_per_room, price_pcm, listing_type")
    .eq("is_stale", false)

  const stats = {
    total: properties?.length || 0,
    withRentPerRoom: properties?.filter(p => p.estimated_rent_per_room && p.estimated_rent_per_room > 0).length || 0,
    withPricePcm: properties?.filter(p => p.price_pcm && p.price_pcm > 0).length || 0,
  }

  // City breakdown
  const cityStats: Record<string, { count: number; avgRent: number }> = {}
  properties?.forEach(p => {
    if (!cityStats[p.city]) {
      cityStats[p.city] = { count: 0, avgRent: 0 }
    }
    cityStats[p.city].count++
    if (p.estimated_rent_per_room) {
      cityStats[p.city].avgRent =
        (cityStats[p.city].avgRent * (cityStats[p.city].count - 1) + p.estimated_rent_per_room) /
        cityStats[p.city].count
    }
  })

  return NextResponse.json({
    message: "POST to enrich properties with realistic UK HMO rental data",
    description: "Uses 2024/2025 market rates by city to set room rents and total property rents",
    stats,
    cityStats: Object.fromEntries(
      Object.entries(cityStats).map(([city, s]) => [
        city,
        { count: s.count, avgRoomRent: Math.round(s.avgRent) }
      ])
    ),
    marketRates: Object.fromEntries(
      Object.entries(CITY_ROOM_RENTS)
        .filter(([k]) => k !== "_default")
        .map(([city, rates]) => [city, `£${rates.min}-${rates.max}/room (avg £${rates.avg})`])
    ),
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties to process (default 50, max 500)",
        city: "Filter by city name",
        forceUpdate: "Set to true to update all properties, even those with existing rent data",
      },
    },
    dataProvided: {
      estimated_rent_per_room: "Per-room monthly rent based on city market rates",
      price_pcm: "Total monthly rent (rooms × per-room rent) for rental listings",
      estimated_gross_monthly_rent: "Total monthly rental income",
      estimated_annual_income: "Annual rental income",
      purchase_price: "Estimated purchase price (if not set) based on ~7% yield",
      estimated_yield_percentage: "Gross rental yield percentage",
    },
  })
}
