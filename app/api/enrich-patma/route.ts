import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"

const PATMA_BASE_URL = "https://app.patma.co.uk/api"

/**
 * POST /api/enrich-patma
 * Enrich properties with PaTMa price analytics (asking prices, sold prices)
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 20, 100)
    const propertyId = body.propertyId

    if (!apiConfig.patma.enabled) {
      return NextResponse.json({
        success: false,
        error: "PaTMa API not configured. Add PATMA_API_KEY to .env.local",
      }, { status: 400 })
    }

    log.push("Starting PaTMa price enrichment...")

    // Fetch properties needing enrichment
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, bedrooms, property_type, purchase_price")
      .eq("is_stale", false)
      .not("postcode", "is", null)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else {
      query = query.is("patma_enriched_at", null).limit(limit)
    }

    const { data: properties, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!properties?.length) {
      return NextResponse.json({
        success: true,
        message: "No properties found needing PaTMa enrichment",
        log,
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    for (const property of properties) {
      try {
        const bedrooms = property.bedrooms || 3
        const propertyType = mapPropertyType(property.property_type)

        log.push(`Processing: ${property.address}`)

        const params = new URLSearchParams({
          postcode: property.postcode,
          bedrooms: bedrooms.toString(),
          property_type: propertyType,
        })

        // Fetch asking prices
        const askingResponse = await fetch(
          `${PATMA_BASE_URL}/prospector/v1/asking-prices/?${params}`,
          {
            headers: {
              "Authorization": `Token ${apiConfig.patma.apiKey}`,
              "Content-Type": "application/json",
            },
          }
        )

        // Fetch sold prices
        const soldResponse = await fetch(
          `${PATMA_BASE_URL}/prospector/v1/sold-prices/?${params}`,
          {
            headers: {
              "Authorization": `Token ${apiConfig.patma.apiKey}`,
              "Content-Type": "application/json",
            },
          }
        )

        const updateData: any = {
          patma_enriched_at: new Date().toISOString(),
        }

        if (askingResponse.ok) {
          const askingData = await askingResponse.json()
          if (askingData.data) {
            updateData.patma_asking_price_mean = Math.round(askingData.data.mean || 0)
            updateData.patma_asking_price_median = Math.round(askingData.data.median || 0)
            updateData.patma_search_radius_miles = askingData.data.radius
          }
        }

        if (soldResponse.ok) {
          const soldData = await soldResponse.json()
          if (soldData.data) {
            updateData.patma_sold_price_mean = Math.round(soldData.data.mean || 0)
            updateData.patma_sold_price_median = Math.round(soldData.data.median || 0)
            updateData.patma_price_data_points = soldData.data.data_points
          }
        }

        // Calculate estimated yield if we have purchase price and sold price data
        if (property.purchase_price && updateData.patma_sold_price_median) {
          // This is a rough estimate - would need rental data for accurate yield
          const estimatedMonthlyRent = updateData.patma_sold_price_median * 0.004 // ~0.4% monthly
          const annualRent = estimatedMonthlyRent * 12
          updateData.estimated_rental_yield = ((annualRent / property.purchase_price) * 100).toFixed(2)
        }

        const { error: updateError } = await supabaseAdmin
          .from("properties")
          .update(updateData)
          .eq("id", property.id)

        if (updateError) {
          log.push(`  Failed: ${updateError.message}`)
          failed.push(property.address)
        } else {
          const priceInfo = updateData.patma_sold_price_median
            ? `median sold £${updateData.patma_sold_price_median.toLocaleString()}`
            : "no price data"
          log.push(`  Updated: ${property.address} (${priceInfo})`)
          updated.push(property.address)
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (error) {
        log.push(`  Error: ${error}`)
        failed.push(property.address)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with PaTMa price data`,
      summary: { processed: properties.length, enriched: updated.length, failed: failed.length },
      log,
      updated,
      failed,
    })

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

function mapPropertyType(type: string | null): string {
  if (!type) return "house"

  const lower = type.toLowerCase()
  if (lower.includes("flat") || lower.includes("apartment") || lower.includes("maisonette")) {
    return "flat"
  }
  if (lower.includes("terrace")) return "terraced"
  if (lower.includes("semi")) return "semi-detached"
  if (lower.includes("detach")) return "detached"

  return "house"
}

export async function GET() {
  const hasKey = apiConfig.patma.enabled

  return NextResponse.json({
    message: "POST to enrich properties with PaTMa price analytics",
    configured: hasKey,
    dataProvided: [
      "patma_asking_price_mean - Average asking price in area",
      "patma_asking_price_median - Median asking price",
      "patma_sold_price_mean - Average sold price in area",
      "patma_sold_price_median - Median sold price",
      "patma_price_data_points - Number of comparable sales",
      "patma_search_radius_miles - Search radius used",
      "estimated_rental_yield - Calculated yield estimate",
    ],
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties (default 20, max 100)",
        propertyId: "Specific property ID to enrich",
      },
    },
  })
}
