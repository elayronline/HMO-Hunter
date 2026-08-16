import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { CITY_ROOM_RENTS, roomRent } from "@/lib/properties/room-rents"
import { requireAdmin } from "@/lib/admin-auth"



/**
 * POST /api/enrich-rents
 *
 * Sets each property's indicative room rent to a published market average.
 *
 * "Indicative" is meant literally: this is a reference average for a city, or a
 * single national figure where the city is not one we hold a rate for. It is
 * never a measurement of the property, and nothing downstream may present it as
 * one. See CLAUDE.md — no user-facing value is ever generated.
 */
export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied

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
      .select("id, address, city, article_4_council, bedrooms, listing_type, price_pcm, estimated_rent_per_room, purchase_price")
      .eq("is_stale", false)

    if (city) {
      query = query.eq("city", city)
    }

    if (!forceUpdate) {
      // Only get properties without proper rent data
      query = query.or("estimated_rent_per_room.is.null,estimated_rent_per_room.eq.0")
    }

    // Ordered and cursored, for the same reason /api/enrich-article4 is: the
    // default pass shrinks its own candidate set each batch and advances on its
    // own, but a forceUpdate has no such filter and would return the same rows
    // on every call, making it incapable of covering more than `limit`
    // properties however often it ran.
    query = query.order("id", { ascending: true })
    if (typeof body.afterId === "string" && body.afterId) {
      query = query.gt("id", body.afterId)
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
        const rent = roomRent(property.city, property.article_4_council)
        const bedrooms = property.bedrooms || 4
        const totalRent = rent.rate * bedrooms

        // No price is invented here any more. What stood here divided a rent
        // this route had itself made up by a random yield between 6.5% and 8.5%,
        // and wrote the result into the same column that holds real asking
        // prices, with nothing to tell them apart. It is why two copies of one
        // licence register record carried prices 38% apart. A property whose
        // price no source publishes has no price, and the report says so.
        const purchasePrice = property.purchase_price

        // Calculate yield
        const annualRent = totalRent * 12
        const grossYield = purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : null

        const updateData: Record<string, any> = {
          estimated_rent_per_room: rent.rate,
          // Never over an advertised figure. price_pcm is reported as what the
          // property achieves today rather than as an estimate, so overwriting a
          // real let price with a computed one would make that sentence false.
          price_pcm:
            property.listing_type === "rent" && !property.price_pcm ? totalRent : property.price_pcm,
          estimated_gross_monthly_rent: totalRent,
          estimated_annual_income: annualRent,
        }

        // Update purchase price and yield for purchase listings
        if (property.listing_type === "purchase" && purchasePrice) {
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
          log.push(
            `  ${property.city}: ${property.address} - £${rent.rate}/room (${rent.basis} average) × ${bedrooms} = £${totalRent}/mo`
          )
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
      /** Pass back as `afterId` to continue from where this batch stopped. */
      lastId: properties.length ? properties[properties.length - 1].id : null,
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
    description:
      "Sets room rents from published city market averages, falling back to a single national average where the city is not held. Indicative only — never a measurement of the property.",
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
