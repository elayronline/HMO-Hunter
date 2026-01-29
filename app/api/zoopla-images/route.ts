import { NextRequest, NextResponse } from "next/server"
import { ZooplaAdapter } from "@/lib/ingestion/adapters/zoopla"

const zoopla = new ZooplaAdapter()

// Cache for Zoopla images (15 min TTL)
const cache = new Map<string, { images: string[]; timestamp: number }>()
const CACHE_TTL = 15 * 60 * 1000 // 15 minutes

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
    return NextResponse.json({ images: cached.images, cached: true })
  }

  try {
    console.log(`[ZooplaImages] Fetching images for ${postcode}`)

    // Fetch listings from Zoopla for this postcode
    const listings = await zoopla.fetch({
      postcode,
      listingType: listingType || "rent",
      minBedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      maxBedrooms: bedrooms ? parseInt(bedrooms) : undefined,
      radius: 0.25, // Very close proximity
      pageSize: 10,
    })

    let images: string[] = []
    let matchedListing = null

    // Try to find a matching listing by address
    if (address && listings.length > 0) {
      const normalizedAddress = address.toLowerCase().replace(/[^a-z0-9]/g, "")

      matchedListing = listings.find(listing => {
        const listingAddress = listing.address.toLowerCase().replace(/[^a-z0-9]/g, "")
        return listingAddress.includes(normalizedAddress) || normalizedAddress.includes(listingAddress)
      })
    }

    if (matchedListing && matchedListing.images && matchedListing.images.length > 0) {
      // Found exact match
      images = matchedListing.images.filter(img => img && !img.includes("placeholder"))
      console.log(`[ZooplaImages] Found exact match with ${images.length} images`)
    } else if (listings.length > 0) {
      // Use images from similar properties in the area
      for (const listing of listings) {
        if (listing.images && listing.images.length > 0) {
          const validImages = listing.images.filter(img => img && !img.includes("placeholder"))
          images.push(...validImages)
          if (images.length >= 5) break
        }
      }
      console.log(`[ZooplaImages] Found ${images.length} images from ${listings.length} nearby listings`)
    }

    // Deduplicate and limit
    images = [...new Set(images)].slice(0, 10)

    // Cache the result
    cache.set(cacheKey, { images, timestamp: Date.now() })

    return NextResponse.json({
      images,
      count: images.length,
      matched: !!matchedListing,
      cached: false,
    })
  } catch (error) {
    console.error("[ZooplaImages] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch images", images: [] },
      { status: 500 }
    )
  }
}
