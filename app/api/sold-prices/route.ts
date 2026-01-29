import { NextRequest, NextResponse } from "next/server"
import { ZooplaAdapter, type SoldPrice } from "@/lib/ingestion/adapters/zoopla"

const zoopla = new ZooplaAdapter()

// Cache for sold prices (30 min TTL)
const cache = new Map<string, { data: SoldPrice[]; timestamp: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const postcode = searchParams.get("postcode")
  const area = searchParams.get("area")
  const radius = parseFloat(searchParams.get("radius") || "0.5")
  const limit = parseInt(searchParams.get("limit") || "20")

  if (!postcode && !area) {
    return NextResponse.json(
      { error: "Either postcode or area parameter is required" },
      { status: 400 }
    )
  }

  const cacheKey = `${postcode || area}-${radius}-${limit}`

  // Check cache
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[SoldPrices] Returning cached data for ${cacheKey}`)
    return NextResponse.json({
      prices: cached.data,
      count: cached.data.length,
      cached: true,
    })
  }

  try {
    console.log(`[SoldPrices] Fetching sold prices for ${postcode || area}`)

    const prices = await zoopla.fetchSoldPrices({
      postcode: postcode || undefined,
      area: area || undefined,
      radius,
      pageSize: limit,
    })

    // Cache the result
    cache.set(cacheKey, { data: prices, timestamp: Date.now() })

    // Calculate statistics
    const stats = calculateStats(prices)

    return NextResponse.json({
      prices,
      count: prices.length,
      stats,
      cached: false,
    })
  } catch (error) {
    console.error("[SoldPrices] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch sold prices" },
      { status: 500 }
    )
  }
}

function calculateStats(prices: SoldPrice[]) {
  if (prices.length === 0) {
    return {
      averagePrice: 0,
      medianPrice: 0,
      minPrice: 0,
      maxPrice: 0,
      totalSales: 0,
    }
  }

  const sortedPrices = [...prices].sort((a, b) => a.price - b.price)
  const total = prices.reduce((sum, p) => sum + p.price, 0)

  return {
    averagePrice: Math.round(total / prices.length),
    medianPrice: sortedPrices[Math.floor(sortedPrices.length / 2)].price,
    minPrice: sortedPrices[0].price,
    maxPrice: sortedPrices[sortedPrices.length - 1].price,
    totalSales: prices.length,
  }
}
