import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { apiConfig } from "@/lib/config/api-config"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

/**
 * POST /api/enrich-zoopla
 * Enrich properties with Zoopla listing data and area statistics
 */
export async function POST(request: NextRequest) {
  // Rate limit check - enrichment endpoints are expensive
  const rateLimitResponse = checkRateLimit(request, {
    ...RATE_LIMITS.enrichment,
    keyPrefix: "enrich-zoopla"
  })
  if (rateLimitResponse) return rateLimitResponse

  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 20, 100)
    const propertyId = body.propertyId

    if (!apiConfig.zoopla.enabled) {
      return NextResponse.json({
        success: false,
        error: "Zoopla API not configured. Add ZOOPLA_API_KEY to .env.local",
      }, { status: 400 })
    }

    log.push("Starting Zoopla enrichment...")

    // Fetch properties needing enrichment
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, bedrooms")
      .eq("is_stale", false)
      .not("postcode", "is", null)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else {
      query = query.is("zoopla_enriched_at", null).limit(limit)
    }

    const { data: properties, error: fetchError } = await query

    if (fetchError) {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!properties?.length) {
      return NextResponse.json({
        success: true,
        message: "No properties found needing Zoopla enrichment",
        log,
      })
    }

    log.push(`Found ${properties.length} properties to enrich`)

    // Group by postcode for efficiency
    const postcodeGroups = new Map<string, typeof properties>()
    for (const property of properties) {
      const pc = property.postcode?.toUpperCase().replace(/\s+/g, "")
      if (pc) {
        if (!postcodeGroups.has(pc)) {
          postcodeGroups.set(pc, [])
        }
        postcodeGroups.get(pc)!.push(property)
      }
    }

    for (const [postcode, props] of postcodeGroups) {
      try {
        log.push(`Fetching Zoopla data for postcode: ${postcode}`)

        // Fetch listings
        const listingsParams = new URLSearchParams({
          api_key: apiConfig.zoopla.apiKey || "",
          postcode: postcode,
          radius: "0.25",
          listing_status: "rent",
          page_size: "50",
        })

        const listingsResponse = await fetch(
          `${apiConfig.zoopla.baseUrl}/property_listings.json?${listingsParams}`
        )

        // Fetch area stats
        const areaParams = new URLSearchParams({
          api_key: apiConfig.zoopla.apiKey || "",
          postcode: postcode,
          output_type: "outcode",
        })

        const areaResponse = await fetch(
          `${apiConfig.zoopla.baseUrl}/average_area_sold_price.json?${areaParams}`
        )

        const zedResponse = await fetch(
          `${apiConfig.zoopla.baseUrl}/zed_index.json?${areaParams}`
        )

        let listings: any[] = []
        let areaStats: any = null
        let zedIndex: number | null = null

        if (listingsResponse.ok) {
          const data = await listingsResponse.json()
          listings = data.listing || []
          log.push(`  Found ${listings.length} listings`)
        }

        if (areaResponse.ok) {
          areaStats = await areaResponse.json()
        }

        if (zedResponse.ok) {
          const zedData = await zedResponse.json()
          zedIndex = zedData.zed_index ? parseInt(zedData.zed_index) : null
        }

        // Match and update each property
        for (const property of props) {
          const matched = findMatchingListing(property, listings)

          const updateData: any = {
            zoopla_enriched_at: new Date().toISOString(),
          }

          // Area stats (apply to all properties in postcode)
          if (areaStats?.average_sold_price_1year) {
            updateData.zoopla_area_avg_price = parseInt(areaStats.average_sold_price_1year)
          }
          if (zedIndex) {
            updateData.zoopla_zed_index = zedIndex
          }

          // Listing-specific data
          if (matched) {
            updateData.zoopla_listing_id = matched.listing_id
            updateData.zoopla_listing_url = matched.details_url
            updateData.zoopla_price_pcm = matched.rental_prices?.per_month
              ? parseInt(matched.rental_prices.per_month)
              : (matched.price ? parseInt(matched.price) : null)
            updateData.zoopla_agent_name = matched.agent_name
            updateData.zoopla_agent_phone = matched.agent_phone

            if (matched.image_url || matched.image_645_430_url) {
              const images = []
              if (matched.image_645_430_url) images.push(matched.image_645_430_url)
              if (matched.image_url && matched.image_url !== matched.image_645_430_url) {
                images.push(matched.image_url)
              }
              updateData.zoopla_images = images
            }

            if (matched.floor_plan) {
              updateData.zoopla_floor_plan_url = matched.floor_plan
            }

            if (matched.first_published_date) {
              updateData.zoopla_first_published = matched.first_published_date
              const published = new Date(matched.first_published_date)
              const now = new Date()
              updateData.zoopla_days_on_market = Math.floor(
                (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24)
              )
            }

            log.push(`  Matched: ${property.address} -> ${matched.displayable_address}`)
          } else {
            log.push(`  No listing match for: ${property.address}`)
          }

          const { error: updateError } = await supabaseAdmin
            .from("properties")
            .update(updateData)
            .eq("id", property.id)

          if (updateError) {
            log.push(`  Update failed: ${updateError.message}`)
            failed.push(property.address)
          } else {
            updated.push(property.address)
          }
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (error) {
        log.push(`  Error: ${error}`)
        props.forEach(p => failed.push(p.address))
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with Zoopla data`,
      summary: { processed: properties.length, enriched: updated.length, failed: failed.length },
      log,
      updated,
      failed,
    })

  } catch (error) {
    return NextResponse.json({ success: false, error: String(error), log }, { status: 500 })
  }
}

function findMatchingListing(property: any, listings: any[]): any {
  const propAddress = property.address?.toLowerCase().replace(/[,.']/g, "").replace(/\s+/g, " ").trim()

  for (const listing of listings) {
    const listingAddress = listing.displayable_address?.toLowerCase().replace(/[,.']/g, "").replace(/\s+/g, " ").trim()

    if (!listingAddress) continue

    // Exact match
    if (listingAddress === propAddress || propAddress.includes(listingAddress) || listingAddress.includes(propAddress)) {
      return listing
    }

    // Number + street match
    const propParts = propAddress.split(" ")
    const listingParts = listingAddress.split(" ")

    const propNumber = propParts.find((p: string) => /^\d+[a-z]?$/.test(p))
    const listingNumber = listingParts.find((p: string) => /^\d+[a-z]?$/.test(p))

    if (propNumber && listingNumber && propNumber === listingNumber) {
      const commonWords = propParts.filter((w: string) => w.length > 3 && listingParts.includes(w))
      if (commonWords.length >= 1) {
        return listing
      }
    }
  }

  return null
}

export async function GET() {
  const hasKey = apiConfig.zoopla.enabled

  return NextResponse.json({
    message: "POST to enrich properties with Zoopla listing data",
    configured: hasKey,
    dataProvided: [
      "zoopla_listing_id - Zoopla listing reference",
      "zoopla_listing_url - Direct link to listing",
      "zoopla_price_pcm - Monthly rent price",
      "zoopla_agent_name - Letting agent name",
      "zoopla_agent_phone - Agent contact number",
      "zoopla_images - Property images array",
      "zoopla_floor_plan_url - Floor plan image",
      "zoopla_first_published - Listing date",
      "zoopla_days_on_market - Days since listed",
      "zoopla_area_avg_price - Area average sold price",
      "zoopla_zed_index - Zoopla valuation index",
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
