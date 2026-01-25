import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/enrich-images
 *
 * Enriches properties with Google Street View images
 * Street View URLs are generated dynamically - no storage needed
 *
 * Body: {
 *   limit?: number,  // Number of properties to process (default 50)
 *   city?: string,   // Filter by city
 * }
 */
export async function POST(request: Request) {
  const log: string[] = []
  const updated: string[] = []
  const failed: string[] = []

  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 50, 200)
    const city = body.city

    log.push(`Starting image enrichment for up to ${limit} properties...`)

    // Check for Google Maps API key
    const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!googleApiKey) {
      return NextResponse.json({
        success: false,
        error: "Google Maps API key not configured",
        recommendation: "Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local",
        instructions: [
          "1. Go to https://console.cloud.google.com/",
          "2. Create or select a project",
          "3. Enable 'Street View Static API'",
          "4. Create an API key",
          "5. Add to .env.local: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key",
          "6. Restart the dev server",
        ],
        log,
      }, { status: 400 })
    }

    log.push("Google Maps API key found")

    // Fetch properties without images
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, latitude, longitude, image_url, images")
      .eq("is_stale", false)
      .not("latitude", "is", null)
      .not("longitude", "is", null)

    if (city) {
      query = query.eq("city", city)
    }

    // Get properties that don't have images or only have placeholders
    const { data: properties, error: fetchError } = await query.limit(limit)

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
        message: "No properties found to enrich",
        log,
        updated: [],
        failed: [],
      })
    }

    // Filter to properties that need images
    const needsImages = properties.filter(p => {
      const hasValidImages = p.images && p.images.length > 0 &&
        !p.images.some((img: string) => img.includes("unsplash.com") || img.includes("placeholder"))
      return !hasValidImages
    })

    log.push(`Found ${needsImages.length} properties needing images`)

    // Generate Street View URLs and update
    for (const property of needsImages) {
      try {
        // Generate Street View URL
        const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${property.latitude},${property.longitude}&key=${googleApiKey}`

        // Check if Street View is available at this location
        const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${property.latitude},${property.longitude}&key=${googleApiKey}`
        const metadataResponse = await fetch(metadataUrl)
        const metadata = await metadataResponse.json()

        if (metadata.status !== "OK") {
          log.push(`  No Street View available for ${property.address}`)
          failed.push(property.address)
          continue
        }

        // Update the property with Street View image
        const { error: updateError } = await supabaseAdmin
          .from("properties")
          .update({
            image_url: streetViewUrl,
            images: [streetViewUrl],
            primary_image: streetViewUrl,
            media_source_url: "google_streetview",
          })
          .eq("id", property.id)

        if (updateError) {
          log.push(`  Failed to update ${property.address}: ${updateError.message}`)
          failed.push(property.address)
        } else {
          log.push(`  Updated: ${property.address}`)
          updated.push(property.address)
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        log.push(`  Error processing ${property.address}: ${error}`)
        failed.push(property.address)
      }
    }

    log.push("")
    log.push(`Completed: ${updated.length} updated, ${failed.length} failed`)

    return NextResponse.json({
      success: true,
      message: `Updated ${updated.length} property images`,
      log,
      updated,
      failed,
      summary: {
        processed: needsImages.length,
        updated: updated.length,
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
 * GET /api/enrich-images
 * Returns info and checks API configuration
 */
export async function GET() {
  const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  const hasGoogleKey = !!googleApiKey

  // Check how many properties need images
  const { data: properties } = await supabaseAdmin
    .from("properties")
    .select("id, images, image_url")
    .eq("is_stale", false)
    .limit(500)

  const withImages = properties?.filter(p =>
    (p.images && p.images.length > 0) || p.image_url
  ).length || 0

  const withStockImages = properties?.filter(p => {
    const allImages = [...(p.images || []), p.image_url].filter(Boolean)
    return allImages.some((img: string) => img?.includes("unsplash.com") || img?.includes("placeholder"))
  }).length || 0

  return NextResponse.json({
    message: "POST to enrich properties with Google Street View images",
    description: "Generates Street View images for properties based on coordinates",
    configuration: {
      googleMapsApiKey: hasGoogleKey ? "Configured" : "NOT CONFIGURED",
    },
    stats: {
      totalProperties: properties?.length || 0,
      withImages: withImages,
      withStockImages: withStockImages,
      needsRealImages: (properties?.length || 0) - withImages + withStockImages,
    },
    usage: {
      limit: "Number of properties to process (default 50, max 200)",
      city: "Filter by city name",
    },
    setupInstructions: !hasGoogleKey ? [
      "1. Go to https://console.cloud.google.com/",
      "2. Create or select a project",
      "3. Enable 'Street View Static API'",
      "4. Create an API key with Street View API access",
      "5. Add to .env.local: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here",
      "6. Restart the dev server",
    ] : null,
  })
}
