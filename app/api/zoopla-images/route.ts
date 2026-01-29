import { NextRequest, NextResponse } from "next/server"
import { ZooplaAdapter } from "@/lib/ingestion/adapters/zoopla"

const zoopla = new ZooplaAdapter()

// Cache for Zoopla images (15 min TTL)
const cache = new Map<string, { images: string[]; timestamp: number; matchQuality: string }>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

/**
 * Extract street number and name from an address for matching
 */
function parseAddress(address: string): { streetNumber: string; streetName: string; normalized: string } {
  const normalized = address.toLowerCase().replace(/[,.']/g, " ").replace(/\s+/g, " ").trim()

  // Extract street number (including flat numbers like "Flat 3" or "21a")
  const numberMatch = normalized.match(/^(?:flat\s+)?(\d+[a-z]?)\s+/i) ||
                      normalized.match(/(\d+[a-z]?)\s+[\w]/i)
  const streetNumber = numberMatch ? numberMatch[1] : ""

  // Extract street name (first significant word after number)
  const streetMatch = normalized.match(/\d+[a-z]?\s+(\w+(?:\s+\w+)?)/i)
  const streetName = streetMatch ? streetMatch[1].replace(/\s+(road|street|avenue|lane|drive|close|way|place|court|gardens|terrace|crescent|grove|square|mews|hill|rise|row|walk|park)$/i, "") : ""

  return { streetNumber, streetName, normalized }
}

/**
 * Calculate match confidence between two addresses
 * Returns: "exact" | "high" | "medium" | "low" | "none"
 */
function calculateMatchConfidence(
  hmoAddress: string,
  hmoPostcode: string,
  hmoBedrooms: number | undefined,
  zooplaAddress: string,
  zooplaPostcode: string,
  zooplaBedrooms: number
): "exact" | "high" | "medium" | "low" | "nearby" | "none" {
  const hmo = parseAddress(hmoAddress)
  const zoopla = parseAddress(zooplaAddress)

  // Normalize postcodes for comparison
  const hmoPC = hmoPostcode.toLowerCase().replace(/\s+/g, "")
  const zooplaPC = zooplaPostcode.toLowerCase().replace(/\s+/g, "")

  // Extract outcode (first part of postcode, e.g., "E8" from "E8 1EJ")
  const hmoOutcode = hmoPC.replace(/\d[a-z]{2}$/, "")
  const zooplaOutcode = zooplaPC.replace(/\d[a-z]{2}$/, "")

  // Check if same outcode or nearby (same postcode district letter, e.g., E11 and E18 are both "E")
  const sameOutcode = hmoOutcode === zooplaOutcode
  const sameDistrict = hmoOutcode.charAt(0) === zooplaOutcode.charAt(0) // E, N, W, SE, etc.

  // For exact/high/medium matches, require same outcode
  // For nearby matches, allow same district

  // Check for exact postcode match
  const exactPostcode = hmoPC === zooplaPC

  // Check street number match
  const streetNumberMatch = hmo.streetNumber && zoopla.streetNumber &&
                            hmo.streetNumber.toLowerCase() === zoopla.streetNumber.toLowerCase()

  // Check street name match (fuzzy)
  const streetNameMatch = hmo.streetName && zoopla.streetName &&
                          (hmo.streetName.includes(zoopla.streetName) ||
                           zoopla.streetName.includes(hmo.streetName))

  // Check bedroom match
  const bedroomMatch = hmoBedrooms !== undefined && hmoBedrooms === zooplaBedrooms

  // For exact/high/medium confidence, require same outcode
  if (sameOutcode) {
    // Exact match: same street number + street name
    if (streetNumberMatch && streetNameMatch) {
      return "exact"
    }

    // High confidence: street number matches + bedrooms match
    if (streetNumberMatch && bedroomMatch) {
      return "high"
    }

    // Medium confidence: street name matches + bedrooms match (but different street number)
    if (streetNameMatch && bedroomMatch) {
      return "medium"
    }

    // Low confidence: street name matches only
    if (streetNameMatch) {
      return "low"
    }
  }

  // Nearby: same postcode district (e.g., both "E" postcodes) with similar bedrooms
  // This provides representative images of the area when exact match isn't available
  const bedroomSimilar = hmoBedrooms !== undefined &&
    Math.abs(hmoBedrooms - zooplaBedrooms) <= 2

  if (sameDistrict && bedroomSimilar) {
    return "nearby"
  }

  // Also allow nearby for same outcode even without street match
  if (sameOutcode && bedroomSimilar) {
    return "nearby"
  }

  return "none"
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const postcode = searchParams.get("postcode")
  const address = searchParams.get("address")
  const bedrooms = searchParams.get("bedrooms")
  const listingType = searchParams.get("listingType") as "rent" | "sale" | null

  if (!postcode) {
    return NextResponse.json(
      { error: "Postcode is required" },
      { status: 400 }
    )
  }

  const cacheKey = `${postcode}-${address || ""}-${bedrooms || ""}`

  // Check cache - but invalidate if we have 0 images with a valid match (stale cache issue)
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Don't return stale cache with 0 images if we had a match - refetch
    if (cached.images.length > 0 || cached.matchQuality === "none") {
      console.log(`[ZooplaImages] Returning cached images for ${cacheKey}`)
      return NextResponse.json({
        images: cached.images,
        matchQuality: cached.matchQuality,
        cached: true
      })
    }
    // Clear bad cache entry with 0 images but valid match
    console.log(`[ZooplaImages] Clearing stale cache for ${cacheKey}`)
    cache.delete(cacheKey)
  }

  try {
    console.log(`[ZooplaImages] Fetching images for ${postcode}, address: ${address || "N/A"}, bedrooms: ${bedrooms || "N/A"}`)

    // Fetch listings from Zoopla for this postcode
    const listings = await zoopla.fetch({
      postcode,
      listingType: listingType || "rent",
      minBedrooms: bedrooms ? Math.max(1, parseInt(bedrooms) - 2) : undefined, // Wider bedroom search
      maxBedrooms: bedrooms ? parseInt(bedrooms) + 2 : undefined,
      radius: 0.5, // Half mile radius for more coverage
      pageSize: 30,
    })

    let images: string[] = []
    let matchQuality: "exact" | "high" | "medium" | "low" | "nearby" | "none" = "none"
    let matchedListing = null

    // Score and rank all listings by match confidence
    if (address && listings.length > 0) {
      const bedroomCount = bedrooms ? parseInt(bedrooms) : undefined

      const scoredListings = listings.map(listing => ({
        listing,
        confidence: calculateMatchConfidence(
          address,
          postcode,
          bedroomCount,
          listing.address,
          listing.postcode,
          listing.bedrooms
        )
      }))

      // Sort by confidence level
      const confidenceOrder: Record<string, number> = { exact: 0, high: 1, medium: 2, low: 3, nearby: 4, none: 5 }
      scoredListings.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence])

      // Get best match
      const bestMatch = scoredListings[0]

      // Use images for all confidence levels except "none"
      // - exact/high/medium: same street match
      // - low: street name only match
      // - nearby: same area with matching bedrooms (representative of neighborhood)
      if (bestMatch && bestMatch.confidence !== "none") {
        matchedListing = bestMatch.listing
        matchQuality = bestMatch.confidence

        if (matchedListing.images && matchedListing.images.length > 0) {
          images = matchedListing.images.filter(img => img && !img.includes("placeholder"))
          console.log(`[ZooplaImages] Found ${matchQuality} match: ${matchedListing.address} with ${images.length} images`)
        }
      } else {
        console.log(`[ZooplaImages] No confident match found for ${address}. Best was: ${bestMatch?.confidence || "none"}`)
      }
    }

    // Deduplicate and limit
    images = [...new Set(images)].slice(0, 15)

    // Cache the result
    cache.set(cacheKey, { images, timestamp: Date.now(), matchQuality })

    return NextResponse.json({
      images,
      count: images.length,
      matchQuality,
      matched: matchQuality !== "none",
      cached: false,
    })
  } catch (error) {
    console.error("[ZooplaImages] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch images", images: [], matchQuality: "none" },
      { status: 500 }
    )
  }
}
