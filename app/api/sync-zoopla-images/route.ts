import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { ZooplaAdapter } from "@/lib/ingestion/adapters/zoopla"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const zoopla = new ZooplaAdapter()

/**
 * Sync Zoopla images to matching HMO register properties
 * Finds HMO properties that exist on Zoopla and updates their images
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const limit = body.limit || 50

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Get non-Zoopla properties (HMO register properties)
  // Include all that don't already have zoopla-matched images
  const { data: hmoProperties, error } = await supabase
    .from("properties")
    .select("id, address, postcode, bedrooms, latitude, longitude, price_pcm, external_id, images, media_source_url")
    .not("external_id", "like", "zoopla-%")
    .not("media_source_url", "like", "zoopla_matched%")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !hmoProperties) {
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
  }

  console.log(`[SyncZoopla] Checking ${hmoProperties.length} HMO properties for Zoopla matches...`)

  const results = {
    total: hmoProperties.length,
    synced: 0,
    notFound: 0,
    details: [] as any[],
  }

  for (const property of hmoProperties) {
    if (!property.postcode) {
      results.notFound++
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

      // Find best match
      let bestMatch: any = null
      let bestScore = 0

      for (const listing of listings) {
        let score = 0

        // Coordinate matching
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

      // Only sync if we have a good match (score >= 50)
      if (bestScore >= 50 && bestMatch && bestMatch.images?.length > 0) {
        // Update property with Zoopla images
        const { error: updateError } = await supabase
          .from("properties")
          .update({
            images: bestMatch.images.slice(0, 20),
            primary_image: bestMatch.images[0],
            media_source_url: `zoopla_matched:${bestMatch.external_id}`,
            last_synced: new Date().toISOString(),
          })
          .eq("id", property.id)

        if (!updateError) {
          results.synced++
          results.details.push({
            id: property.id,
            address: property.address,
            matchedTo: bestMatch.address,
            zooplaId: bestMatch.external_id,
            images: bestMatch.images.length,
            score: bestScore,
          })
          console.log(`[SyncZoopla] ✓ Synced ${property.address} -> ${bestMatch.images.length} images`)
        }
      } else {
        results.notFound++
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 300))

    } catch (err) {
      results.notFound++
    }
  }

  console.log(`[SyncZoopla] Complete: ${results.synced} synced, ${results.notFound} not found`)

  return NextResponse.json({
    success: true,
    synced: results.synced,
    notFound: results.notFound,
    total: results.total,
    details: results.details,
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
