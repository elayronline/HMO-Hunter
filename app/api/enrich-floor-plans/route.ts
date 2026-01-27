import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { RightmoveAdapter } from "@/lib/ingestion/adapters/rightmove"
import type { PropertyListing } from "@/lib/types/ingestion"

/**
 * POST /api/enrich-floor-plans
 *
 * Enriches properties with floor plan images from Rightmove/Zoopla listings.
 * Uses the Apify Rightmove scraper to fetch floor plan images.
 *
 * Body: {
 *   limit?: number,      // Number of properties to process (default 20)
 *   city?: string,       // Filter by city
 *   propertyId?: string, // Enrich specific property
 *   forceRefresh?: boolean, // Re-fetch even if floor plans exist
 * }
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
    const forceRefresh = body.forceRefresh || false

    log.push(`Starting floor plan enrichment...`)

    // Check API configuration
    const apifyToken = process.env.APIFY_API_TOKEN

    if (!apifyToken) {
      return NextResponse.json({
        success: false,
        error: "APIFY_API_TOKEN not configured",
        recommendation: "Add Apify API token to fetch floor plans from Rightmove",
        instructions: [
          "1. Sign up at https://apify.com/",
          "2. Get your API token from Settings > Integrations",
          "3. Add to .env.local: APIFY_API_TOKEN=your_token",
          "4. The Rightmove scraper costs ~$0.95 per 1000 results",
        ],
        log,
      }, { status: 400 })
    }

    log.push(`Apify API configured`)

    // Fetch properties that need floor plans
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, bedrooms, floor_plans, listing_type")
      .eq("is_stale", false)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else {
      if (city) {
        query = query.eq("city", city)
      }
      // Only get properties without floor plans (unless forceRefresh)
      if (!forceRefresh) {
        query = query.or("floor_plans.is.null,floor_plans.eq.{}")
      }
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
        message: "No properties found needing floor plans",
        log,
        updated: [],
        failed: [],
      })
    }

    log.push(`Found ${properties.length} properties to process`)

    // Initialize Rightmove adapter
    const rightmoveAdapter = new RightmoveAdapter()

    // Process each property
    for (const property of properties) {
      try {
        log.push(`Processing: ${property.address}`)

        // Create a PropertyListing for the adapter
        const listing: PropertyListing = {
          title: "",
          address: property.address,
          postcode: property.postcode,
          city: property.city,
          latitude: 0,
          longitude: 0,
          listing_type: property.listing_type || "rent",
          property_type: "HMO",
          bedrooms: property.bedrooms || 0,
          bathrooms: 0,
          external_id: property.id,
          source_url: "",
        }

        // Enrich with Rightmove data
        const enriched = await rightmoveAdapter.enrich(listing)

        if (enriched.floor_plans && enriched.floor_plans.length > 0) {
          // Update the property with floor plans
          const { error: updateError } = await supabaseAdmin
            .from("properties")
            .update({
              floor_plans: enriched.floor_plans,
              // Also update images if we got better ones
              ...(enriched.images && enriched.images.length > 0 && {
                images: enriched.images,
                image_url: enriched.images[0],
                primary_image: enriched.images[0],
              }),
              // Update source URL if we found a listing
              ...(enriched.source_url && {
                source_url: enriched.source_url,
                media_source_url: "rightmove",
              }),
            })
            .eq("id", property.id)

          if (updateError) {
            log.push(`  Failed to update: ${updateError.message}`)
            failed.push(property.address)
          } else {
            log.push(`  Found ${enriched.floor_plans.length} floor plan(s)`)
            updated.push(property.address)
          }
        } else {
          log.push(`  No floor plans found`)
          failed.push(property.address)
        }

        // Delay between properties to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))

      } catch (error) {
        log.push(`  Error: ${error}`)
        failed.push(property.address)
      }
    }

    log.push("")
    log.push(`Completed: ${updated.length} enriched, ${failed.length} no floor plans found`)

    return NextResponse.json({
      success: true,
      message: `Enriched ${updated.length} properties with floor plans`,
      log,
      updated,
      failed,
      summary: {
        processed: properties.length,
        enriched: updated.length,
        noFloorPlans: failed.length,
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
 * GET /api/enrich-floor-plans
 * Returns info and checks configuration
 */
export async function GET() {
  const apifyToken = process.env.APIFY_API_TOKEN
  const hasApify = !!apifyToken

  // Check how many properties have floor plans
  const { data: allProperties } = await supabaseAdmin
    .from("properties")
    .select("id, floor_plans")
    .eq("is_stale", false)
    .limit(500)

  const withFloorPlans = allProperties?.filter(p =>
    p.floor_plans && Array.isArray(p.floor_plans) && p.floor_plans.length > 0
  ).length || 0

  const totalProperties = allProperties?.length || 0
  const needsFloorPlans = totalProperties - withFloorPlans

  return NextResponse.json({
    message: "POST to enrich properties with floor plan images from Rightmove",
    description: "Fetches floor plan images from property listings using Apify Rightmove scraper",
    configuration: {
      apifyApiToken: hasApify ? "Configured" : "NOT CONFIGURED",
    },
    stats: {
      totalProperties,
      withFloorPlans,
      needsFloorPlans,
    },
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties to process (default 20, max 100)",
        city: "Filter by city name",
        propertyId: "Enrich a specific property by ID",
        forceRefresh: "Re-fetch even if floor plans exist (default false)",
      },
    },
    dataSources: {
      rightmove: {
        name: "Rightmove (via Apify)",
        fields: ["floorplanImages", "floorplans"],
        cost: "$0.95 per 1000 results",
        docs: "https://apify.com/memo23/rightmove-scraper",
      },
    },
    setupInstructions: !hasApify ? [
      "1. Sign up at https://apify.com/",
      "2. Get your API token from Settings > Integrations",
      "3. Add to .env.local: APIFY_API_TOKEN=your_token",
      "4. The Rightmove scraper (memo23/rightmove-scraper) provides floor plans",
    ] : null,
  })
}
