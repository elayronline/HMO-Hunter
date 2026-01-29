import { NextRequest, NextResponse } from "next/server"
import { ZooplaAdapter } from "@/lib/ingestion/adapters/zoopla"

const zoopla = new ZooplaAdapter()

// Cache for Zoopla images (15 min TTL)
const cache = new Map<string, { images: string[]; timestamp: number; matchType: string; confidence: number }>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

/**
 * Calculate distance between two coordinates in meters using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Normalize address for comparison
 * Extracts: street number, street name, flat/unit number
 */
function normalizeAddress(address: string): {
  streetNumber: string
  flatNumber: string
  streetName: string
  normalized: string
} {
  const lower = address.toLowerCase()
    .replace(/[,.']/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  // Extract flat/apartment number
  const flatMatch = lower.match(/(?:flat|apartment|unit|apt)\s*(\d+[a-z]?)/i)
  const flatNumber = flatMatch ? flatMatch[1] : ""

  // Extract street number
  const numberMatch = lower.match(/^(\d+[a-z]?)\s+/) ||
    lower.match(/(?:flat\s+\d+[a-z]?\s+)?(\d+[a-z]?)\s+[\w]/i)
  const streetNumber = numberMatch ? numberMatch[1] : ""

  // Extract street name (remove common suffixes for comparison)
  const streetMatch = lower.match(/\d+[a-z]?\s+(.+?)(?:\s+(?:road|street|avenue|lane|drive|close|way|place|court|gardens|terrace|crescent|grove|square|mews|hill|rise|row|walk|park|london|[a-z]{1,2}\d+)|\s*$)/i)
  const streetName = streetMatch ? streetMatch[1].trim() : ""

  return {
    streetNumber,
    flatNumber,
    streetName,
    normalized: lower
  }
}

/**
 * Calculate exact match score between HMO Hunter property and Zoopla listing
 * Returns score 0-100 and match details
 */
function calculateExactMatchScore(
  hmoAddress: string,
  hmoPostcode: string,
  hmoBedrooms: number | undefined,
  hmoPrice: number | undefined,
  hmoLat: number | undefined,
  hmoLng: number | undefined,
  zooplaListing: any
): { score: number; matchType: string; details: string[] } {
  const details: string[] = []
  let score = 0

  const hmo = normalizeAddress(hmoAddress)
  const zoopla = normalizeAddress(zooplaListing.address || "")

  // Get raw data if available
  const raw = zooplaListing._raw || {}

  // 1. COORDINATE MATCHING (most reliable) - up to 50 points
  if (hmoLat && hmoLng && zooplaListing.latitude && zooplaListing.longitude) {
    const distance = calculateDistance(
      hmoLat, hmoLng,
      zooplaListing.latitude,
      zooplaListing.longitude
    )

    if (distance <= 15) {
      // Within 15 meters - almost certainly same property
      score += 50
      details.push(`coords: ${distance.toFixed(0)}m ✓`)
    } else if (distance <= 30) {
      // Within 30 meters - likely same building
      score += 40
      details.push(`coords: ${distance.toFixed(0)}m`)
    } else if (distance <= 50) {
      // Within 50 meters - same immediate area
      score += 25
      details.push(`coords: ${distance.toFixed(0)}m ~`)
    } else {
      details.push(`coords: ${distance.toFixed(0)}m ✗`)
    }
  }

  // 2. POSTCODE MATCHING - up to 20 points
  const hmoPC = hmoPostcode.toLowerCase().replace(/\s+/g, "")
  const zooplaPC = zooplaListing.postcode?.toLowerCase().replace(/\s+/g, "") || ""
  const hmoOutcode = hmoPC.replace(/\d[a-z]{2}$/, "")
  const zooplaOutcode = zooplaPC.replace(/\d[a-z]{2}$/, "")

  if (hmoPC === zooplaPC) {
    score += 20
    details.push("postcode ✓")
  } else if (hmoOutcode === zooplaOutcode) {
    // Same outcode (e.g., E8) but different incode - still very close
    score += 15
    details.push("outcode ✓")
  }

  // 3. STREET NUMBER MATCHING - up to 20 points (crucial for exact match)
  const rawPropertyNumber = raw.property_number || ""
  const zooplaStreetNumber = rawPropertyNumber.match(/^(\d+[a-z]?)/i)?.[1] ||
                             zoopla.streetNumber || ""

  if (hmo.streetNumber && zooplaStreetNumber) {
    if (hmo.streetNumber.toLowerCase() === zooplaStreetNumber.toLowerCase()) {
      score += 20
      details.push(`#${hmo.streetNumber} ✓`)
    }
  }

  // 4. STREET NAME MATCHING - up to 15 points
  const rawStreetName = (raw.street_name || "").toLowerCase().replace(/[,.']/g, " ").trim()
  const zooplaStreetName = rawStreetName || zoopla.streetName

  if (hmo.streetName && zooplaStreetName) {
    const hmoStreet = hmo.streetName.split(" ")[0]
    const zooplaStreet = zooplaStreetName.split(" ")[0]
    if (zooplaStreet.includes(hmoStreet) || hmoStreet.includes(zooplaStreet)) {
      score += 15
      details.push("street ✓")
    }
  }

  // 5. BEDROOM MATCHING - up to 10 points
  if (hmoBedrooms !== undefined && zooplaListing.bedrooms !== undefined) {
    if (hmoBedrooms === zooplaListing.bedrooms) {
      score += 10
      details.push(`${hmoBedrooms}bed ✓`)
    }
  }

  // 6. PRICE MATCHING (for validation) - up to 5 points
  if (hmoPrice && zooplaListing.price_pcm) {
    const priceDiff = Math.abs(hmoPrice - zooplaListing.price_pcm) / hmoPrice
    if (priceDiff <= 0.20) {
      score += 5
      details.push("price ✓")
    }
  }

  // Determine match type based on score
  // Max possible: 50 (coords) + 20 (postcode) + 20 (street#) + 15 (street) + 10 (beds) + 5 (price) = 120
  // Without coords: max 70 points
  let matchType = "none"
  if (score >= 70) {
    matchType = "exact"
  } else if (score >= 55) {
    matchType = "high"
  } else if (score >= 40) {
    matchType = "medium"
  }

  return { score, matchType, details }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const postcode = searchParams.get("postcode")
  const address = searchParams.get("address")
  const bedrooms = searchParams.get("bedrooms")
  const price = searchParams.get("price")
  const latitude = searchParams.get("latitude")
  const longitude = searchParams.get("longitude")
  const listingType = searchParams.get("listingType") as "rent" | "sale" | null

  if (!postcode) {
    return NextResponse.json({ error: "Postcode is required" }, { status: 400 })
  }

  const cacheKey = `${postcode}-${address || ""}-${bedrooms || ""}-${latitude || ""}-${longitude || ""}`

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL && cached.images.length > 0) {
    console.log(`[ZooplaImages] Returning cached: ${cached.matchType} (${cached.confidence}%)`)
    return NextResponse.json({
      images: cached.images,
      matchType: cached.matchType,
      confidence: cached.confidence,
      cached: true
    })
  }

  try {
    const hmoLat = latitude ? parseFloat(latitude) : undefined
    const hmoLng = longitude ? parseFloat(longitude) : undefined
    const hmoBedrooms = bedrooms ? parseInt(bedrooms) : undefined
    const hmoPrice = price ? parseInt(price) : undefined

    console.log(`[ZooplaImages] Searching for exact match: ${address}, ${postcode}`)
    if (hmoLat && hmoLng) {
      console.log(`[ZooplaImages] Using coordinates: ${hmoLat}, ${hmoLng}`)
    }

    // Fetch listings from Zoopla - use tight radius for accuracy
    const listings = await zoopla.fetch({
      postcode,
      listingType: listingType || "rent",
      radius: 0.25, // 0.25 mile radius for precision
      pageSize: 50, // Get more results to find exact match
    })

    if (listings.length === 0) {
      console.log(`[ZooplaImages] No listings found for ${postcode}`)
      cache.set(cacheKey, { images: [], timestamp: Date.now(), matchType: "none", confidence: 0 })
      return NextResponse.json({ images: [], matchType: "none", confidence: 0, cached: false })
    }

    // Score all listings and find best match
    const scoredListings = listings.map(listing => {
      const result = calculateExactMatchScore(
        address || "",
        postcode,
        hmoBedrooms,
        hmoPrice,
        hmoLat,
        hmoLng,
        listing
      )
      return { listing, ...result }
    })

    // Sort by score descending
    scoredListings.sort((a, b) => b.score - a.score)

    // Log top 3 matches for debugging
    console.log(`[ZooplaImages] Top matches for "${address}":`)
    scoredListings.slice(0, 3).forEach((s, i) => {
      console.log(`  ${i + 1}. Score ${s.score}: ${s.listing.address} [${s.details.join(", ")}]`)
    })

    // Get best match
    const bestMatch = scoredListings[0]

    // STRICT MATCHING: Only return images for exact or high confidence matches
    // exact >= 70, high >= 55
    if (bestMatch.score >= 55 && (bestMatch.matchType === "exact" || bestMatch.matchType === "high")) {
      const images = bestMatch.listing.images?.filter((img: string) => img && !img.includes("placeholder")) || []

      if (images.length > 0) {
        console.log(`[ZooplaImages] ✓ EXACT MATCH: ${bestMatch.listing.address} (score: ${bestMatch.score})`)

        cache.set(cacheKey, {
          images: images.slice(0, 15),
          timestamp: Date.now(),
          matchType: bestMatch.matchType,
          confidence: bestMatch.score
        })

        return NextResponse.json({
          images: images.slice(0, 15),
          matchType: bestMatch.matchType,
          confidence: bestMatch.score,
          matchedAddress: bestMatch.listing.address,
          matchDetails: bestMatch.details,
          cached: false
        })
      }
    }

    // No exact match found - property not listed on Zoopla
    console.log(`[ZooplaImages] ✗ No exact match for "${address}". Best score: ${bestMatch.score}`)
    console.log(`[ZooplaImages]   Best candidate: ${bestMatch.listing.address} [${bestMatch.details.join(", ")}]`)
    console.log(`[ZooplaImages]   Property may not be listed on Zoopla - will use Street View`)

    cache.set(cacheKey, { images: [], timestamp: Date.now(), matchType: "none", confidence: bestMatch.score })

    return NextResponse.json({
      images: [],
      matchType: "none",
      confidence: bestMatch.score,
      reason: "Property not found on Zoopla - no exact match available",
      bestMatchAddress: bestMatch.listing.address,
      bestMatchDetails: bestMatch.details,
      cached: false
    })

  } catch (error) {
    console.error("[ZooplaImages] Error:", error)
    return NextResponse.json({ error: "Failed to fetch images", images: [], matchType: "none" }, { status: 500 })
  }
}
