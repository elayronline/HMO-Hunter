import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Point in polygon check using ray casting algorithm
function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

// Check if point is in any polygon of a MultiPolygon
function pointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): boolean {
  for (const polygon of multiPolygon) {
    for (const ring of polygon) {
      if (pointInPolygon(point, ring)) {
        return true
      }
    }
  }
  return false
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { count: total } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })

    const { count: withArticle4True } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("article_4_area", true)

    const { count: withArticle4False } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("article_4_area", false)

    const { count: needsCheck } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .is("article_4_area", null)

    return NextResponse.json({
      message: "POST to enrich properties with Article 4 area data",
      stats: {
        total,
        inArticle4Area: withArticle4True,
        notInArticle4Area: withArticle4False,
        needsCheck,
      },
      usage: {
        method: "POST",
        body: { limit: "Number of properties to check (default 100, max 500)" }
      }
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = Math.min(body.limit || 100, 500)
    const forceRecheck = body.forceRecheck === true

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch Article 4 areas from our API
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const article4Response = await fetch(`${baseUrl}/api/article4-data`)
    const article4Data = await article4Response.json()

    if (!article4Data.features || article4Data.features.length === 0) {
      return NextResponse.json({ error: "No Article 4 data available" }, { status: 500 })
    }

    console.log(`[EnrichArticle4] Loaded ${article4Data.features.length} Article 4 areas`)

    // Get properties that need Article 4 check
    let query = supabase
      .from("properties")
      .select("id, latitude, longitude, address, city")
      .not("latitude", "is", null)
      .not("longitude", "is", null)

    // Only filter by null article_4_area if not forcing recheck
    if (!forceRecheck) {
      query = query.is("article_4_area", null)
    }

    const { data: properties } = await query.limit(limit)

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties need Article 4 check",
        enriched: 0
      })
    }

    let enriched = 0
    let inArticle4 = 0
    const results: { address: string; city: string; article4Area: string }[] = []

    for (const property of properties) {
      const point: [number, number] = [property.longitude, property.latitude]
      let isInArticle4 = false
      let areaName: string | null = null

      // Check each Article 4 area
      for (const feature of article4Data.features) {
        try {
          if (feature.geometry.type === "MultiPolygon") {
            if (pointInMultiPolygon(point, feature.geometry.coordinates)) {
              isInArticle4 = true
              areaName = feature.properties.name || feature.properties.description
              break
            }
          } else if (feature.geometry.type === "Polygon") {
            if (pointInPolygon(point, feature.geometry.coordinates[0])) {
              isInArticle4 = true
              areaName = feature.properties.name || feature.properties.description
              break
            }
          }
        } catch {
          // Skip malformed geometries
          continue
        }
      }

      // Update property
      const { error } = await supabase
        .from("properties")
        .update({
          article_4_area: isInArticle4,
        })
        .eq("id", property.id)

      if (!error) {
        enriched++
        if (isInArticle4) {
          inArticle4++
          results.push({
            address: property.address,
            city: property.city,
            article4Area: areaName || "Unknown area",
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${enriched} properties, ${inArticle4} in Article 4 areas`,
      enriched,
      inArticle4Areas: inArticle4,
      notInArticle4: enriched - inArticle4,
      samples: results.slice(0, 10),
    })
  } catch (error) {
    console.error("[EnrichArticle4] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
