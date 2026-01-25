import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

interface GoogleSearchResult {
  link: string
  image?: {
    contextLink: string
    thumbnailLink: string
  }
}

interface GoogleSearchResponse {
  items?: GoogleSearchResult[]
  error?: { message: string }
}

/**
 * Search for property images using Google Custom Search API
 */
async function searchPropertyImages(
  address: string,
  postcode: string,
  city: string
): Promise<string[]> {
  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY
  const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID

  if (!apiKey || !searchEngineId) {
    return []
  }

  // Build search query - try different combinations for best results
  const searchQueries = [
    `${address} ${postcode} property`,
    `${address} ${city} house`,
    `${postcode} property for sale`,
  ]

  const images: string[] = []

  for (const query of searchQueries) {
    if (images.length >= 5) break // Got enough images

    try {
      const url = new URL("https://www.googleapis.com/customsearch/v1")
      url.searchParams.set("key", apiKey)
      url.searchParams.set("cx", searchEngineId)
      url.searchParams.set("q", query)
      url.searchParams.set("searchType", "image")
      url.searchParams.set("num", "5")
      url.searchParams.set("imgSize", "large")
      url.searchParams.set("safe", "active")

      const response = await fetch(url.toString())
      const data: GoogleSearchResponse = await response.json()

      if (data.error) {
        console.error("Google Search error:", data.error.message)
        continue
      }

      if (data.items) {
        for (const item of data.items) {
          if (item.link && !images.includes(item.link)) {
            // Filter out obvious non-property images
            const lowerUrl = item.link.toLowerCase()
            if (
              !lowerUrl.includes("logo") &&
              !lowerUrl.includes("icon") &&
              !lowerUrl.includes("avatar") &&
              !lowerUrl.includes("profile")
            ) {
              images.push(item.link)
            }
          }
        }
      }

      // Small delay between queries to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))

    } catch (error) {
      console.error("Search error for query:", query, error)
    }
  }

  return images.slice(0, 5) // Return up to 5 images
}

/**
 * Get Street View image URL as fallback
 * Uses address for better accuracy, with heading to face the property
 */
async function getStreetViewImage(
  address: string,
  postcode: string,
  latitude: number,
  longitude: number,
  apiKey: string
): Promise<string | null> {
  // Try with full address first (more accurate than coordinates)
  const fullAddress = `${address}, ${postcode}, UK`
  const encodedAddress = encodeURIComponent(fullAddress)

  // Check if Street View is available at this address
  const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodedAddress}&key=${apiKey}`

  try {
    const response = await fetch(metadataUrl)
    const metadata = await response.json()

    if (metadata.status === "OK") {
      // Use address-based Street View with parameters for better property view
      // fov=90 gives a wider field of view
      // pitch=10 tilts slightly up to capture more of the building
      return `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${encodedAddress}&fov=90&pitch=10&key=${apiKey}`
    }

    // Fallback to coordinates if address doesn't work
    const coordMetadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${latitude},${longitude}&key=${apiKey}`
    const coordResponse = await fetch(coordMetadataUrl)
    const coordMetadata = await coordResponse.json()

    if (coordMetadata.status === "OK") {
      return `https://maps.googleapis.com/maps/api/streetview?size=800x600&location=${latitude},${longitude}&fov=90&pitch=10&key=${apiKey}`
    }
  } catch (error) {
    console.error("Street View metadata error:", error)
  }

  return null
}

/**
 * POST /api/enrich-images
 *
 * Enriches properties with real images from property listing sites
 * Uses Google Custom Search API to find property photos
 * Falls back to Street View for exterior images
 *
 * Body: {
 *   limit?: number,  // Number of properties to process (default 50)
 *   city?: string,   // Filter by city
 *   propertyId?: string, // Enrich specific property
 *   forceRefresh?: boolean, // Re-fetch even if images exist
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
    const propertyId = body.propertyId
    const forceRefresh = body.forceRefresh || false

    log.push(`Starting image enrichment...`)

    // Check API configuration
    const customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY
    const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID
    const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    const hasCustomSearch = !!customSearchKey && !!searchEngineId
    const hasStreetView = !!mapsApiKey

    if (!hasCustomSearch && !hasStreetView) {
      return NextResponse.json({
        success: false,
        error: "No image API configured",
        recommendation: "Add Google Custom Search or Street View API keys",
        instructions: {
          customSearch: [
            "1. Go to https://console.cloud.google.com/",
            "2. Enable 'Custom Search API'",
            "3. Create API key",
            "4. Go to https://programmablesearchengine.google.com/",
            "5. Create search engine with property sites",
            "6. Add to .env.local:",
            "   GOOGLE_CUSTOM_SEARCH_API_KEY=your_key",
            "   GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_cx",
          ],
          streetView: [
            "1. Go to https://console.cloud.google.com/",
            "2. Enable 'Street View Static API'",
            "3. Add to .env.local: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key",
          ],
        },
        log,
      }, { status: 400 })
    }

    log.push(`APIs configured: Custom Search=${hasCustomSearch}, Street View=${hasStreetView}`)

    // Fetch properties
    let query = supabaseAdmin
      .from("properties")
      .select("id, address, postcode, city, latitude, longitude, image_url, images")
      .eq("is_stale", false)

    if (propertyId) {
      query = query.eq("id", propertyId)
    } else {
      if (city) {
        query = query.eq("city", city)
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
        message: "No properties found to enrich",
        log,
        updated: [],
        failed: [],
      })
    }

    // Filter to properties that need images (unless forceRefresh)
    const needsImages = forceRefresh ? properties : properties.filter(p => {
      const hasValidImages = p.images && p.images.length > 0 &&
        !p.images.some((img: string) =>
          img.includes("unsplash.com") ||
          img.includes("placeholder") ||
          img.includes("stock")
        )
      return !hasValidImages
    })

    log.push(`Found ${needsImages.length} properties needing images`)

    // Process each property
    for (const property of needsImages) {
      try {
        let images: string[] = []
        let source = ""

        // Try Custom Search first (better quality listing photos)
        if (hasCustomSearch) {
          log.push(`  Searching for: ${property.address}`)
          images = await searchPropertyImages(
            property.address,
            property.postcode,
            property.city
          )

          if (images.length > 0) {
            source = "google_custom_search"
            log.push(`    Found ${images.length} images from listings`)
          }
        }

        // Fall back to Street View if no listing images
        if (images.length === 0 && hasStreetView && property.latitude && property.longitude) {
          const streetViewUrl = await getStreetViewImage(
            property.address,
            property.postcode,
            property.latitude,
            property.longitude,
            mapsApiKey!
          )

          if (streetViewUrl) {
            images = [streetViewUrl]
            source = "google_streetview"
            log.push(`    Using Street View for: ${property.address}`)
          }
        }

        if (images.length === 0) {
          log.push(`    No images found for: ${property.address}`)
          failed.push(property.address)
          continue
        }

        // Update the property
        const { error: updateError } = await supabaseAdmin
          .from("properties")
          .update({
            image_url: images[0],
            images: images,
            primary_image: images[0],
            media_source_url: source,
          })
          .eq("id", property.id)

        if (updateError) {
          log.push(`    Failed to update ${property.address}: ${updateError.message}`)
          failed.push(property.address)
        } else {
          log.push(`    Updated: ${property.address} (${images.length} images)`)
          updated.push(property.address)
        }

        // Delay to avoid rate limiting (Custom Search has 100/day free limit)
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (error) {
        log.push(`    Error processing ${property.address}: ${error}`)
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
  const customSearchKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY
  const searchEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

  const hasCustomSearch = !!customSearchKey && !!searchEngineId
  const hasStreetView = !!mapsApiKey

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
    return allImages.some((img: string) =>
      img?.includes("unsplash.com") ||
      img?.includes("placeholder") ||
      img?.includes("stock")
    )
  }).length || 0

  const withRealImages = properties?.filter(p => {
    const allImages = [...(p.images || []), p.image_url].filter(Boolean)
    return allImages.length > 0 && !allImages.some((img: string) =>
      img?.includes("unsplash.com") ||
      img?.includes("placeholder") ||
      img?.includes("stock")
    )
  }).length || 0

  return NextResponse.json({
    message: "POST to enrich properties with real property images",
    description: "Searches property listing sites for actual photos, falls back to Street View",
    configuration: {
      googleCustomSearch: hasCustomSearch ? "Configured" : "NOT CONFIGURED",
      googleStreetView: hasStreetView ? "Configured" : "NOT CONFIGURED",
    },
    stats: {
      totalProperties: properties?.length || 0,
      withRealImages: withRealImages,
      withStockImages: withStockImages,
      noImages: (properties?.length || 0) - withImages,
      needsEnrichment: (properties?.length || 0) - withRealImages,
    },
    usage: {
      method: "POST",
      body: {
        limit: "Number of properties to process (default 50, max 200)",
        city: "Filter by city name",
        propertyId: "Enrich a specific property by ID",
        forceRefresh: "Re-fetch images even if property has some (default false)",
      },
    },
    rateLimits: {
      customSearch: "100 free queries/day, then $5/1000",
      streetView: "$7/1000 requests",
    },
    setupInstructions: !hasCustomSearch ? {
      customSearch: [
        "1. Go to https://console.cloud.google.com/",
        "2. Enable 'Custom Search API'",
        "3. Create API key",
        "4. Go to https://programmablesearchengine.google.com/",
        "5. Create search engine with sites: rightmove.co.uk, zoopla.co.uk, etc.",
        "6. Enable 'Image search' in search features",
        "7. Add to .env.local:",
        "   GOOGLE_CUSTOM_SEARCH_API_KEY=your_key",
        "   GOOGLE_CUSTOM_SEARCH_ENGINE_ID=your_cx",
      ],
    } : null,
  })
}
