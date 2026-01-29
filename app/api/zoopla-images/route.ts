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
): "exact" | "high" | "medium" | "low" | "none" {
  const hmo = parseAddress(hmoAddress)
  const zoopla = parseAddress(zooplaAddress)

  // Normalize postcodes for comparison
  const hmoPC = hmoPostcode.toLowerCase().replace(/\s+/g, "")
  const zooplaPC = zooplaPostcode.toLowerCase().replace(/\s+/g, "")

  // Extract outcode (first part of postcode, e.g., "E8" from "E8 1EJ")
  const hmoOutcode = hmoPC.replace(/\d[a-z]{2}$/, "")
  const zooplaOutcode = zooplaPC.replace(/\d[a-z]{2}$/, "")

  // Must be same outcode (postcode area) at minimum
  if (hmoOutcode !== zooplaOutcode) {
    return "none"
  }

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

  // Exact match: same street number + street name (regardless of exact postcode)
  if (streetNumberMatch && streetNameMatch) {
    return "exact"
  }

  // High confidence: street number matches + bedrooms match
  if (streetNumberMatch && bedroomMatch) {
    return "high"
  }

  // Medium confidence: street name matches + bedrooms match (but different street number)
  // This could be a neighboring property on the same street
  if (streetNameMatch && bedroomMatch) {
    return "medium"
  }

  // Low confidence: street name matches only (different bedrooms, different number)
  if (streetNameMatch) {
    return "low"
  }

  // None: different street, only bedroom count might match
  // We don't want to show images from completely different streets

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

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[ZooplaImages] Returning cached images for ${cacheKey}`)
    return NextResponse.json({
      images: cached.images,
      matchQuality: cached.matchQuality,
      cached: true
    })
  }

  try {
    console.log(`[ZooplaImages] Fetching images for ${postcode}, address: ${address || "N/A"}, bedrooms: ${bedrooms || "N/A"}`)

    // Fetch listings from Zoopla for this postcode
    const listings = await zoopla.fetch({
      postcode,
      listingType: listingType || "rent",
      minBedrooms: bedrooms ? parseInt(bedrooms) - 1 : undefined, // Slightly wider search
      maxBedrooms: bedrooms ? parseInt(bedrooms) + 1 : undefined,
      radius: 0.25, // Very close proximity
      pageSize: 20,
    })

    let images: string[] = []
    let matchQuality: "exact" | "high" | "medium" | "low" | "none" = "none"
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
      const confidenceOrder = { exact: 0, high: 1, medium: 2, low: 3, none: 4 }
      scoredListings.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence])

      // Get best match
      const bestMatch = scoredListings[0]

      // Only use images if we have at least medium confidence (street name match required)
      // "low" confidence means only bedroom count matched - not specific enough
      if (bestMatch && (bestMatch.confidence === "exact" || bestMatch.confidence === "high" || bestMatch.confidence === "medium")) {
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
