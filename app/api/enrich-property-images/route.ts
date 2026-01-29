import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const ZOOPLA_API_KEY = process.env.ZOOPLA_API_KEY || "eec9ejtet7bzzgduvjlkj1b8"
const ZOOPLA_BASE_URL = "https://api.zoopla.co.uk/api/v1"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * API endpoint to enrich a property with Zoopla images and store them in the database
 *
 * This solves the "images not persisting" problem by:
 * 1. Fetching images from Zoopla (direct by listing_id or by address matching)
 * 2. Storing them permanently in the property's images array
 * 3. Future requests will use stored images without API calls
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { propertyId } = body

    if (!propertyId) {
      return NextResponse.json({ error: "propertyId is required" }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the property
    const { data: property, error: fetchError } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .single()

    if (fetchError || !property) {
      return NextResponse.json({ error: "Property not found" }, { status: 404 })
    }

    // Check if property already has real images (not stock/streetview)
    const existingRealImages = (property.images || []).filter((img: string) =>
      img &&
      !img.includes("placeholder") &&
      !img.includes("stock") &&
      !img.includes("unsplash") &&
      !img.includes("maps.googleapis.com")
    )

    if (existingRealImages.length >= 3) {
      console.log(`[EnrichImages] Property ${propertyId} already has ${existingRealImages.length} real images`)
      return NextResponse.json({
        success: true,
        message: "Property already has images",
        images: existingRealImages,
        source: "existing"
      })
    }

    console.log(`[EnrichImages] Enriching property ${propertyId}: ${property.address}`)

    let images: string[] = []
    let source = "none"

    // Option 1: Try direct Zoopla lookup by external_id
    if (property.external_id && property.external_id.startsWith("zoopla-")) {
      const listingId = property.external_id.replace("zoopla-", "")
      console.log(`[EnrichImages] Trying direct Zoopla lookup: listing_id=${listingId}`)

      const directImages = await fetchZooplaImagesByListingId(listingId)
      if (directImages.length > 0) {
        images = directImages
        source = "zoopla_direct"
        console.log(`[EnrichImages] ✓ Found ${images.length} images via direct lookup`)
      }
    }

    // Option 2: Try address-based matching
    if (images.length === 0 && property.postcode) {
      console.log(`[EnrichImages] Trying address-based matching for ${property.address}`)

      const matchedImages = await fetchZooplaImagesByAddress(
        property.postcode,
        property.address,
        property.bedrooms,
        property.latitude,
        property.longitude
      )

      if (matchedImages.images.length > 0) {
        images = matchedImages.images
        source = `zoopla_${matchedImages.matchType}`
        console.log(`[EnrichImages] ✓ Found ${images.length} images via ${matchedImages.matchType} match`)
      }
    }

    // If no images found, return without updating
    if (images.length === 0) {
      console.log(`[EnrichImages] ✗ No Zoopla images found for property ${propertyId}`)
      return NextResponse.json({
        success: false,
        message: "No matching Zoopla images found",
        images: [],
        source: "none"
      })
    }

    // Store images in database
    const { error: updateError } = await supabase
      .from("properties")
      .update({
        images: images.slice(0, 20),
        primary_image: images[0],
        media_source_url: `zoopla:${source}`,
        last_synced: new Date().toISOString()
      })
      .eq("id", propertyId)

    if (updateError) {
      console.error(`[EnrichImages] Failed to update property:`, updateError)
      return NextResponse.json({ error: "Failed to save images" }, { status: 500 })
    }

    console.log(`[EnrichImages] ✓ Saved ${images.length} images to property ${propertyId}`)

    return NextResponse.json({
      success: true,
      message: `Saved ${images.length} Zoopla images`,
      images: images.slice(0, 20),
      source
    })

  } catch (error) {
    console.error("[EnrichImages] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * Fetch images directly by Zoopla listing ID
 */
async function fetchZooplaImagesByListingId(listingId: string): Promise<string[]> {
  try {
    const url = `${ZOOPLA_BASE_URL}/property_listings.json?api_key=${ZOOPLA_API_KEY}&listing_id=${listingId}`
    const response = await fetch(url)

    if (!response.ok) return []

    const data = await response.json()
    if (!data.listing || data.listing.length === 0) return []

    const listing = data.listing[0]
    return extractImagesFromListing(listing)
  } catch (error) {
    console.error("[EnrichImages] Error fetching by listing ID:", error)
    return []
  }
}

/**
 * Fetch images by address matching
 */
async function fetchZooplaImagesByAddress(
  postcode: string,
  address: string,
  bedrooms?: number,
  latitude?: number,
  longitude?: number
): Promise<{ images: string[]; matchType: string }> {
  try {
    const params = new URLSearchParams({
      api_key: ZOOPLA_API_KEY,
      postcode: postcode,
      listing_status: "rent",
      page_size: "50",
      radius: "0.25"
    })

    const url = `${ZOOPLA_BASE_URL}/property_listings.json?${params.toString()}`
    const response = await fetch(url)

    if (!response.ok) return { images: [], matchType: "none" }

    const data = await response.json()
    if (!data.listing || data.listing.length === 0) return { images: [], matchType: "none" }

    // Score each listing for match quality
    const normalizedAddress = normalizeAddress(address)
    let bestMatch: { listing: any; score: number; type: string } | null = null

    for (const listing of data.listing) {
      let score = 0
      let type = "none"

      // Check coordinates (most reliable)
      if (latitude && longitude && listing.latitude && listing.longitude) {
        const distance = calculateDistance(
          latitude, longitude,
          parseFloat(listing.latitude), parseFloat(listing.longitude)
        )
        if (distance <= 15) {
          score += 50
          type = "exact"
        } else if (distance <= 30) {
          score += 40
          type = "high"
        }
      }

      // Check street number
      const listingNumber = (listing.property_number || "").match(/^(\d+[a-z]?)/i)?.[1] || ""
      const hmoNumber = normalizedAddress.streetNumber
      if (hmoNumber && listingNumber && hmoNumber.toLowerCase() === listingNumber.toLowerCase()) {
        score += 20
        if (type === "none") type = "high"
      }

      // Check bedrooms
      if (bedrooms && parseInt(listing.num_bedrooms) === bedrooms) {
        score += 10
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { listing, score, type }
      }
    }

    if (bestMatch && bestMatch.score >= 50) {
      return {
        images: extractImagesFromListing(bestMatch.listing),
        matchType: bestMatch.type
      }
    }

    return { images: [], matchType: "none" }
  } catch (error) {
    console.error("[EnrichImages] Error fetching by address:", error)
    return { images: [], matchType: "none" }
  }
}

/**
 * Extract all images from a Zoopla listing
 */
function extractImagesFromListing(listing: any): string[] {
  const images: string[] = []

  // Get from other_image array (medium res)
  if (listing.other_image && Array.isArray(listing.other_image)) {
    for (const img of listing.other_image) {
      if (img.url) {
        // Convert to higher resolution
        const highResUrl = img.url.replace("/354/255/", "/645/430/")
        images.push(highResUrl)
      }
    }
  }

  // Fallback to original_image array
  if (images.length === 0 && listing.original_image && Array.isArray(listing.original_image)) {
    images.push(...listing.original_image)
  }

  // Final fallback
  if (images.length === 0 && listing.image_645_430_url) {
    images.push(listing.image_645_430_url)
  }

  return images
}

/**
 * Normalize address for comparison
 */
function normalizeAddress(address: string): { streetNumber: string; streetName: string } {
  const lower = address.toLowerCase().replace(/[,.']/g, " ").replace(/\s+/g, " ").trim()
  const numberMatch = lower.match(/^(\d+[a-z]?)\s+/) || lower.match(/(\d+[a-z]?)\s+[\w]/i)
  return {
    streetNumber: numberMatch ? numberMatch[1] : "",
    streetName: ""
  }
}

/**
 * Calculate distance between two coordinates in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * GET endpoint to check enrichment status or trigger for a property
 */
export async function GET(request: NextRequest) {
  const propertyId = request.nextUrl.searchParams.get("propertyId")

  if (!propertyId) {
    return NextResponse.json({ error: "propertyId is required" }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: property, error } = await supabase
    .from("properties")
    .select("id, address, images, primary_image, external_id, media_source_url")
    .eq("id", propertyId)
    .single()

  if (error || !property) {
    return NextResponse.json({ error: "Property not found" }, { status: 404 })
  }

  const hasImages = (property.images || []).filter((img: string) =>
    img && !img.includes("placeholder") && !img.includes("stock")
  ).length > 0

  return NextResponse.json({
    propertyId: property.id,
    address: property.address,
    hasImages,
    imageCount: (property.images || []).length,
    source: property.media_source_url || "unknown",
    canEnrich: !hasImages && (property.external_id?.startsWith("zoopla-") || true)
  })
}
