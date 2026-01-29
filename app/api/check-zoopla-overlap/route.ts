import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ZooplaAdapter } from "@/lib/ingestion/adapters/zoopla"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const zoopla = new ZooplaAdapter()

/**
 * Check if HMO register properties have matching Zoopla listings
 * This helps identify properties where we can get real images
 */
export async function GET(request: NextRequest) {
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20")

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get non-Zoopla properties (original HMO register properties)
  const { data: hmoProperties, error } = await supabase
    .from("properties")
    .select("id, address, postcode, bedrooms, latitude, longitude, price_pcm, external_id, images, source_name")
    .not("external_id", "like", "zoopla-%")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !hmoProperties) {
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
  }

  console.log(`[CheckOverlap] Checking ${hmoProperties.length} HMO register properties against Zoopla...`)

  const results = {
    total: hmoProperties.length,
    matchedOnZoopla: 0,
    notOnZoopla: 0,
    matches: [] as any[],
    noMatches: [] as any[],
  }

  for (const property of hmoProperties) {
    if (!property.postcode) {
      results.notOnZoopla++
      results.noMatches.push({
        address: property.address,
        reason: "No postcode",
      })
      continue
    }

    try {
      // Search Zoopla for this property
      const listings = await zoopla.fetch({
        postcode: property.postcode,
        listingType: "rent",
        radius: 0.25,
        pageSize: 50,
      })

      // Try to find an exact match
      let bestMatch: any = null
      let bestScore = 0

      for (const listing of listings) {
        let score = 0

        // Coordinate matching (most accurate)
        if (property.latitude && property.longitude && listing.latitude && listing.longitude) {
          const distance = calculateDistance(
            property.latitude,
            property.longitude,
            listing.latitude,
            listing.longitude
          )
          if (distance <= 15) score += 50
          else if (distance <= 30) score += 40
        }

        // Bedroom matching
        if (property.bedrooms && listing.bedrooms === property.bedrooms) {
          score += 15
        }

        // Street number matching
        const hmoNumber = extractStreetNumber(property.address)
        const zooplaNumber = extractStreetNumber(listing.address)
        if (hmoNumber && zooplaNumber && hmoNumber === zooplaNumber) {
          score += 20
        }

        if (score > bestScore) {
          bestScore = score
          bestMatch = listing
        }
      }

      if (bestScore >= 50) {
        results.matchedOnZoopla++
        results.matches.push({
          hmoAddress: property.address,
          hmoPostcode: property.postcode,
          zooplaAddress: bestMatch.address,
          zooplaId: bestMatch.external_id,
          score: bestScore,
          zooplaImages: bestMatch.images?.length || 0,
          currentImages: property.images?.length || 0,
        })
      } else {
        results.notOnZoopla++
        results.noMatches.push({
          address: property.address,
          postcode: property.postcode,
          reason: listings.length === 0 ? "No Zoopla listings in area" : `Best score: ${bestScore}`,
          nearbyListings: listings.length,
        })
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 200))

    } catch (err) {
      results.notOnZoopla++
      results.noMatches.push({
        address: property.address,
        reason: "API error",
      })
    }
  }

  console.log(`[CheckOverlap] Results: ${results.matchedOnZoopla} matches, ${results.notOnZoopla} not found`)

  return NextResponse.json({
    summary: {
      totalChecked: results.total,
      foundOnZoopla: results.matchedOnZoopla,
      notOnZoopla: results.notOnZoopla,
      matchRate: `${((results.matchedOnZoopla / results.total) * 100).toFixed(1)}%`,
    },
    matches: results.matches,
    noMatches: results.noMatches.slice(0, 10), // Show first 10
  })
}

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

function extractStreetNumber(address: string): string {
  const match = address.match(/^(\d+[a-z]?)\s/i) || address.match(/(\d+[a-z]?)\s+[\w]/i)
  return match ? match[1].toLowerCase() : ""
}
