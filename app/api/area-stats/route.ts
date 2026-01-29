import { NextRequest, NextResponse } from "next/server"
import { ZooplaAdapter, type AreaStatistics } from "@/lib/ingestion/adapters/zoopla"

const zoopla = new ZooplaAdapter()

// Cache for area statistics (1 hour TTL)
const cache = new Map<string, { data: AreaStatistics; timestamp: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const postcode = searchParams.get("postcode")
  const area = searchParams.get("area")

  if (!postcode && !area) {
    return NextResponse.json(
      { error: "Either postcode or area parameter is required" },
      { status: 400 }
    )
  }

  const cacheKey = postcode || area || ""

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[AreaStats] Returning cached data for ${cacheKey}`)
    return NextResponse.json(cached.data)
  }

  try {
    console.log(`[AreaStats] Fetching stats for ${postcode || area}`)

    const stats = await zoopla.fetchAreaStatistics({
      postcode: postcode || undefined,
      area: area || undefined,
    })

    if (!stats) {
      return NextResponse.json(
        { error: "No data available for this area" },
        { status: 404 }
      )
    }

    // Cache the result
    cache.set(cacheKey, { data: stats, timestamp: Date.now() })

    return NextResponse.json(stats)
  } catch (error) {
    console.error("[AreaStats] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch area statistics" },
      { status: 500 }
    )
  }
}
