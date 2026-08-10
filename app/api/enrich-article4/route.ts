import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  classifyArticle4,
  fetchCoveredCouncilKeys,
  normaliseCouncilName,
  resolveLpaForPoint,
  toLegacyBoolean,
} from "@/lib/article4/coverage"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// LPA lookups are one HTTP call per point. Memoise at 4dp (~11m) so repeated or
// near-identical coordinates collapse, without merging genuinely different
// addresses that could sit either side of a council boundary.
const LPA_MEMO_PRECISION = 4
const LPA_CONCURRENCY = 5

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

// Check if point is in a single polygon (outer ring minus holes)
function pointInPolygonWithHoles(point: [number, number], polygon: number[][][]): boolean {
  // First ring is the outer boundary
  const outerRing = polygon[0]
  if (!pointInPolygon(point, outerRing)) {
    return false // Not in outer ring
  }

  // Check if point is in any hole (subsequent rings)
  for (let i = 1; i < polygon.length; i++) {
    if (pointInPolygon(point, polygon[i])) {
      return false // Point is in a hole, so not inside the polygon
    }
  }

  return true // In outer ring and not in any hole
}

// Check if point is in any polygon of a MultiPolygon
function pointInMultiPolygon(point: [number, number], multiPolygon: number[][][][]): boolean {
  for (const polygon of multiPolygon) {
    if (pointInPolygonWithHoles(point, polygon)) {
      return true
    }
  }
  return false
}

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const countByStatus = async (status: string) => {
      const { count } = await supabase
        .from("properties")
        .select("*", { count: "exact", head: true })
        .eq("article_4_status", status)
      return count
    }

    const { count: total } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })

    const [inForce, noneFound, unknown] = await Promise.all([
      countByStatus("in_force"),
      countByStatus("none_found"),
      countByStatus("unknown"),
    ])

    const { count: neverChecked } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .is("article_4_checked_at", null)

    return NextResponse.json({
      message: "POST to enrich properties with Article 4 status",
      stats: {
        total,
        inForce,
        noneFound,
        unknown,
        neverChecked,
      },
      note:
        "unknown means the planning authority is not covered by the national feed, " +
        "not that the property is free of an Article 4 direction. Never present it as a negative.",
      usage: {
        method: "POST",
        body: {
          limit: "Number of properties to check (default 100, max 500)",
          forceRecheck: "Re-check rows that already have a status",
        },
      },
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

    // Which councils actually publish testable HMO Article 4 boundaries. Only
    // points inside these are eligible for a negative; everywhere else the
    // honest answer is `unknown`.
    //
    // Prefer the registry: one table read instead of one HTTP request per
    // council, and it excludes councils that publish directions with no
    // geometry (Crawley, Tower Hamlets) which cannot be point-in-polygon tested.
    // Falls back to resolving live if the registry hasn't been synced yet.
    let coveredCouncilKeys = new Set<string>()
    let coverageSource = "registry"

    const { data: registryRows } = await supabase
      .from("article4_councils")
      .select("match_key")
      .eq("coverage_level", "boundaries")

    if (registryRows?.length) {
      coveredCouncilKeys = new Set(registryRows.map((r: any) => r.match_key))
    } else {
      coverageSource = "live"
      const organisationEntities = article4Data.features
        .map((f: any) => f?.properties?.organisation)
        .filter(Boolean)
      coveredCouncilKeys = await fetchCoveredCouncilKeys(organisationEntities)
    }

    console.log(
      `[EnrichArticle4] ${coveredCouncilKeys.size} councils covered (${coverageSource}) across ${article4Data.features.length} areas`
    )

    if (coveredCouncilKeys.size === 0) {
      // Without the coverage set every result would collapse to `unknown`.
      // Writing that wholesale would wipe good statuses, so refuse instead.
      return NextResponse.json(
        { error: "Could not resolve council coverage; refusing to write statuses" },
        { status: 503 }
      )
    }

    // Get properties that need an Article 4 check
    let query = supabase
      .from("properties")
      .select("id, latitude, longitude, address, city")
      .not("latitude", "is", null)
      .not("longitude", "is", null)

    if (!forceRecheck) {
      query = query.is("article_4_checked_at", null)
    }

    const { data: properties } = await query.limit(limit)

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties need Article 4 check",
        enriched: 0,
      })
    }

    // Resolve the planning authority for each point, memoised and rate-limited.
    const lpaMemo = new Map<string, Awaited<ReturnType<typeof resolveLpaForPoint>>>()
    async function lpaFor(lng: number, lat: number) {
      const key = `${lng.toFixed(LPA_MEMO_PRECISION)},${lat.toFixed(LPA_MEMO_PRECISION)}`
      if (lpaMemo.has(key)) return lpaMemo.get(key)!
      const lpa = await resolveLpaForPoint(lng, lat)
      lpaMemo.set(key, lpa)
      return lpa
    }

    const counts = { in_force: 0, none_found: 0, unknown: 0 }
    let enriched = 0
    let failed = 0
    const results: { address: string; city: string; status: string; area: string | null }[] = []

    for (let i = 0; i < properties.length; i += LPA_CONCURRENCY) {
      const batch = properties.slice(i, i + LPA_CONCURRENCY)

      await Promise.all(
        batch.map(async (property) => {
          const point: [number, number] = [property.longitude, property.latitude]
          let matchedAreaName: string | null = null

          for (const feature of article4Data.features) {
            try {
              if (feature.geometry.type === "MultiPolygon") {
                if (pointInMultiPolygon(point, feature.geometry.coordinates)) {
                  matchedAreaName = feature.properties.name || feature.properties.description
                  break
                }
              } else if (feature.geometry.type === "Polygon") {
                if (pointInPolygon(point, feature.geometry.coordinates[0])) {
                  matchedAreaName = feature.properties.name || feature.properties.description
                  break
                }
              }
            } catch {
              continue // skip malformed geometry
            }
          }

          const lpa = await lpaFor(property.longitude, property.latitude)
          const councilCovered = lpa ? coveredCouncilKeys.has(normaliseCouncilName(lpa.name)) : null

          const result = classifyArticle4({
            matchedAreaName,
            council: lpa?.name ?? null,
            councilCovered,
          })

          const { error } = await supabase
            .from("properties")
            .update({
              article_4_status: result.status,
              article_4_checked_at: result.checkedAt,
              article_4_source: result.source,
              article_4_area_name: result.areaName,
              article_4_council: result.council,
              article_4_council_covered: result.councilCovered,
              // Deprecated mirror, kept in sync for existing read sites.
              article_4_area: toLegacyBoolean(result.status),
            })
            .eq("id", property.id)

          if (error) {
            failed++
            return
          }

          enriched++
          counts[result.status]++
          if (result.status !== "none_found") {
            results.push({
              address: property.address,
              city: property.city,
              status: result.status,
              area: result.areaName,
            })
          }
        })
      )
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${enriched} properties — ${counts.in_force} in force, ${counts.none_found} none found, ${counts.unknown} unknown`,
      enriched,
      failed,
      counts,
      councilsCovered: coveredCouncilKeys.size,
      coverageSource,
      note:
        "unknown means the property's planning authority publishes no HMO Article 4 data " +
        "to the national feed. It is not a negative and must not be presented as one.",
      samples: results.slice(0, 10),
    })
  } catch (error) {
    console.error("[EnrichArticle4] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
