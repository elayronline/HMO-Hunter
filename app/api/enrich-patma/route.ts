import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"
import { requireAdmin } from "@/lib/admin-auth"

const PATMA_BASE_URL = "https://app.patma.co.uk/api"

/**
 * POST /api/enrich-patma
 * Enrich properties with PaTMa price analytics (asking prices, sold prices)
 */
export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied

  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []
  // Separate from `failed`: nothing went wrong with the request, PaTMa simply
  // published nothing for this postcode or rejected the account. Counting those
  // as enriched is what made 78% of the "enriched" rows hold no PaTMa data.
  const skipped: string[] = []

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

        /*
         * A price PaTMa did not publish is absent, not zero.
         *
         * This read `Math.round(data.mean || 0)`, so a null mean was stored as
         * £0 — a figure no source stated, in a column that otherwise holds real
         * comparables and with nothing to tell the two apart.
         */
        const price = (v: unknown): number | undefined => {
          const n = typeof v === "number" ? v : Number(v)
          return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
        }

        const updateData: any = {}
        let retrieved = false

        if (askingResponse.ok) {
          const askingData = await askingResponse.json()
          if (askingData.data) {
            const mean = price(askingData.data.mean)
            const median = price(askingData.data.median)
            if (mean !== undefined) updateData.patma_asking_price_mean = mean
            if (median !== undefined) updateData.patma_asking_price_median = median
            if (askingData.data.radius != null) updateData.patma_search_radius_miles = askingData.data.radius
            if (mean !== undefined || median !== undefined) retrieved = true
          }
        }

        if (soldResponse.ok) {
          const soldData = await soldResponse.json()
          if (soldData.data) {
            const mean = price(soldData.data.mean)
            const median = price(soldData.data.median)
            if (mean !== undefined) updateData.patma_sold_price_mean = mean
            if (median !== undefined) updateData.patma_sold_price_median = median
            if (soldData.data.data_points != null) updateData.patma_price_data_points = soldData.data.data_points
            if (mean !== undefined || median !== undefined) retrieved = true
          }
        }

        /*
         * estimated_rental_yield is no longer derived here.
         *
         * What stood here took PaTMa's median SOLD price, multiplied it by
         * 0.004 — an undisclosed constant, annotated "~0.4% monthly" — called
         * the result a monthly rent, annualised it, divided by the asking price
         * and stored the answer as a yield. Every input after the sold price
         * was invented, and the comment beside it admitted the method: "This is
         * a rough estimate - would need rental data for accurate yield."
         *
         * It is the same shape as the failure recorded in CLAUDE.md, where a
         * route divided a rent it had itself made up by a random yield and
         * stored the result as a purchase price. A disclosed yield already
         * exists: /api/enrich-rents writes estimated_gross_monthly_rent from a
         * named city room rate, and the property card prints that basis on its
         * face. Two yields computed different ways, one of them silent, is how
         * a reader stops being able to trust either.
         *
         * The column is empty across the estate (0 rows) and rendered nowhere,
         * so nothing is lost by not writing it.
         */

        /*
         * The timestamp records that PaTMa answered, not that it was asked.
         *
         * patma_enriched_at was stamped unconditionally, before either response
         * was examined, so a property whose lookups both 403'd was written and
         * counted as "Updated". Measured on 2026-09-02: 664 rows carried the
         * timestamp and 144 carried a median — 78% of the "enriched" rows held
         * no PaTMa data at all, and coverage read as though the integration was
         * mostly working while its account was rejected upstream.
         */
        if (!retrieved) {
          const reason = !askingResponse.ok || !soldResponse.ok
            ? `PaTMa returned ${askingResponse.status}/${soldResponse.status}`
            : "PaTMa published no comparables for this postcode"
          log.push(`  Skipped: ${property.address} (${reason})`)
          skipped.push(property.address)
          await new Promise(resolve => setTimeout(resolve, 300))
          continue
        }

        updateData.patma_enriched_at = new Date().toISOString()

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
            : "asking prices only"
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
      summary: {
        processed: properties.length,
        enriched: updated.length,
        skipped: skipped.length,
        failed: failed.length,
      },
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
      // estimated_rental_yield is deliberately absent: this route no longer
      // derives one. The disclosed yield comes from /api/enrich-rents.
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
