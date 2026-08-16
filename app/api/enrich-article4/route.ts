import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  ARTICLE4_SOURCE_COUNCIL_BOUNDARY,
  classifyArticle4,
  fetchCoveredCouncilKeys,
  normaliseCouncilName,
  resolveLpaForPoint,
  toLegacyBoolean,
} from "@/lib/article4/coverage"
import { requireAdmin } from "@/lib/admin-auth"
import {
  ARTICLE4_SOURCE_COUNCIL_VERIFIED,
  curatedNegativeFor,
  wholeAuthorityDirectionInForce,
} from "@/lib/article4/curated"
import {
  hmoFeaturesFor,
  publishesCompleteBoundary,
} from "@/lib/article4/council-boundaries"

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
          afterId:
            "Cursor — pass the previous response's lastId to continue. Required to page through a forceRecheck, which is otherwise unfiltered and returns the same rows each call.",
        },
      },
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const denied = requireAdmin(request)
  if (denied) return denied

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
    // Ordered by id and cursored, so a caller can page through.
    //
    // The default pass narrows to rows that have never been checked, and each
    // batch shrinks the set it selects from — so repeated calls advance on
    // their own. A forced re-check has no such filter: without an order and a
    // cursor it returns the same rows every time, which made forceRecheck
    // incapable of covering more than `limit` properties however often it ran.
    let query = supabase
      .from("properties")
      .select("id, latitude, longitude, address, city")
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .order("id", { ascending: true })

    if (!forceRecheck) {
      query = query.is("article_4_checked_at", null)
    }

    if (typeof body.afterId === "string" && body.afterId) {
      query = query.gt("id", body.afterId)
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
    /** Rows the feed could not resolve that a whole-authority curated direction did. */
    let curatedOverlayApplied = 0
    /** Rows cleared by a council confirming it operates no HMO direction. */
    let curatedNegativeApplied = 0
    /** Rows decided by a boundary the council publishes itself. */
    let councilBoundaryApplied = 0
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

          // Boundaries the council publishes itself, tested exactly as the feed's
          // are. Leeds designates named wards plus part of one more, which no
          // list of ward names can express — but its own polygon can, and it
          // carries the direction's reference and commencement date with it.
          // The match is a boolean, and the label is derived from it afterwards.
          //
          // Reading the two off one value inverted a result: Sheffield's feature
          // carries neither NAME nor REFERENCE, so a successful point-in-polygon
          // test produced `undefined`, which then read as "no match" and fell
          // through to the negative branch. Every one of its 132 properties was
          // recorded as cleared by the very boundary that contained it. A
          // publisher omitting a label must never be able to flip a positive
          // into a negative, so nothing downstream depends on the name existing.
          let matchedCouncilBoundary = false
          let councilBoundaryName: string | null = null
          const councilPublishesBoundary = lpa?.name
            ? publishesCompleteBoundary(lpa.name)
            : false

          if (lpa?.name && !matchedAreaName && councilPublishesBoundary) {
            for (const feature of hmoFeaturesFor(lpa.name)) {
              try {
                const geom = feature.geometry
                const hit =
                  geom?.type === "MultiPolygon"
                    ? pointInMultiPolygon(point, geom.coordinates)
                    : geom?.type === "Polygon"
                      ? pointInPolygonWithHoles(point, geom.coordinates)
                      : false

                if (hit) {
                  matchedCouncilBoundary = true
                  const props = feature.properties ?? {}
                  councilBoundaryName =
                    props.NAME ||
                    props.REFERENCE ||
                    props.typearea ||
                    `HMO Article 4 area published by ${lpa.name}`
                  break
                }
              } catch {
                continue
              }
            }
          }

          // A council publishing a complete boundary is covered in the sense
          // classifyArticle4 means: a miss inside it has been tested against the
          // authority's own definition of the area, so it is a negative rather
          // than a silence.
          const inFeed = lpa ? coveredCouncilKeys.has(normaliseCouncilName(lpa.name)) : false
          const councilCovered = lpa ? inFeed || councilPublishesBoundary : null

          // Provenance follows whichever source actually decided it, and that
          // includes the negatives: a Leeds property outside A4D01 was cleared
          // by Leeds' own polygon, not by the national feed, and recording the
          // feed there would credit a source that holds nothing for Leeds.
          const decidedByCouncilBoundary =
            !matchedAreaName && councilPublishesBoundary && !inFeed

          let result = classifyArticle4({
            matchedAreaName: matchedAreaName ?? (matchedCouncilBoundary ? councilBoundaryName : null),
            council: lpa?.name ?? null,
            councilCovered,
            source: decidedByCouncilBoundary ? ARTICLE4_SOURCE_COUNCIL_BOUNDARY : undefined,
          })
          if (matchedCouncilBoundary && !matchedAreaName) councilBoundaryApplied++

          // The curated overlay, applied only where it can decide a point.
          //
          // A curated entry normally establishes that a council restricts
          // somewhere, which cannot resolve an individual property — there is no
          // polygon to test against, so the honest answer stays `unknown`. A
          // direction covering the WHOLE authority is the exception: every
          // property in the authority is inside it, so the property's authority
          // is all we need.
          //
          // It runs against `none_found` as well as `unknown`. Where a council
          // has confirmed in its own words that the whole authority is covered,
          // the feed publishing partial polygons means the feed is incomplete,
          // not that the property is clear — and "no Article 4 here" is the one
          // answer that would send someone into a purchase unwarned. It still
          // only ever adds a restriction: a feed positive is never touched.
          if (lpa?.name && result.status !== "in_force") {
            const whole = wholeAuthorityDirectionInForce(lpa.name)
            if (whole) {
              result = {
                ...result,
                status: "in_force",
                areaName: whole.name,
                source: ARTICLE4_SOURCE_COUNCIL_VERIFIED,
              }
              curatedOverlayApplied++
            }
          }

          // A council read and found to have no HMO direction. This is the one
          // place curated research is allowed to produce a negative, and it is
          // deliberately the weakest move available: it only ever turns
          // `unknown` into `none_found`, never touches a positive from either
          // source, and curatedNegativeFor refuses to answer at all where any
          // direction is in force. Without it a checked-and-clear council is
          // indistinguishable from one nobody has looked at.
          if (lpa?.name && result.status === "unknown") {
            const negative = curatedNegativeFor(lpa.name)
            if (negative) {
              result = {
                ...result,
                status: "none_found",
                source: ARTICLE4_SOURCE_COUNCIL_VERIFIED,
              }
              curatedNegativeApplied++
            }
          }

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
      curatedOverlayApplied,
      curatedNegativeApplied,
      councilBoundaryApplied,
      /** Pass back as `afterId` to continue from where this batch stopped. */
      lastId: properties.length ? properties[properties.length - 1].id : null,
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
