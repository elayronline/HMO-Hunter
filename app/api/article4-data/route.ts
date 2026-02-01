import { NextResponse } from "next/server"

// Official UK Government Planning Data API
const PLANNING_DATA_API = "https://www.planning.data.gov.uk/entity.json"

// Cache the processed data for 24 hours
let cachedData: GeoJSON.FeatureCollection | null = null
let cacheTimestamp = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

// Keywords to identify HMO-related Article 4 directions
// These restrict C3 (dwelling) to C4 (small HMO) conversions
const HMO_KEYWORDS = [
  "hmo",
  "house in multiple occupation",
  "houses in multiple occupation",
  "multiple occupation",
  "c3 to c4",
  "c3-c4",
  "c3/c4",
  "use class c4",
  "class c4",
  "small hmo",
  "shared house",
  "shared dwelling",
]

// Keywords that indicate it's NOT HMO-related (to exclude false positives)
const EXCLUDE_KEYWORDS = [
  "agricultural",
  "mineral",
  "caravan",
  "camping",
  "motor racing",
  "industrial",
  "office to residential", // Different type of conversion
  "shop to residential",
  "class e to c3", // Commercial to residential, not HMO
  "launderette",
]

interface Article4Entity {
  entity: number
  name: string
  description?: string
  notes?: string
  reference: string
  "start-date"?: string
  "end-date"?: string
  geometry?: string
  point?: string
  "organisation-entity"?: string
  dataset: string
}

function isHmoRelated(entity: Article4Entity): boolean {
  const searchText = [
    entity.name || "",
    entity.description || "",
    entity.notes || "",
  ]
    .join(" ")
    .toLowerCase()

  // Check for exclusion keywords first
  const isExcluded = EXCLUDE_KEYWORDS.some((keyword) => searchText.includes(keyword))
  if (isExcluded) {
    return false
  }

  // Then check for HMO-related keywords
  return HMO_KEYWORDS.some((keyword) => searchText.includes(keyword))
}

function parseCoordinateRing(ringStr: string): number[][] {
  return ringStr
    .replace(/[()]/g, "")
    .split(",")
    .map((pair) => {
      const parts = pair.trim().split(/\s+/)
      const lng = parseFloat(parts[0])
      const lat = parseFloat(parts[1])
      return [lng, lat]
    })
    .filter((c) => !isNaN(c[0]) && !isNaN(c[1]))
}

function parseWKTGeometry(wkt: string): GeoJSON.Geometry | null {
  if (!wkt) return null

  try {
    // Handle MULTIPOLYGON (((x y, x y), (x y, x y)), ((x y, x y)))
    if (wkt.startsWith("MULTIPOLYGON")) {
      const coordsStr = wkt.replace(/^MULTIPOLYGON\s*\(\(\(/i, "").replace(/\)\)\)$/, "")
      const polygons: number[][][][] = []

      // Split by ")),((" to get individual polygons
      const polygonStrings = coordsStr.split(/\)\)\s*,\s*\(\(/)

      for (const polyStr of polygonStrings) {
        const rings: number[][][] = []
        // Split by "),(" to get individual rings within a polygon
        const ringStrings = polyStr.split(/\)\s*,\s*\(/)

        for (const ringStr of ringStrings) {
          const coords = parseCoordinateRing(ringStr)
          if (coords.length >= 4) {
            rings.push(coords)
          }
        }

        if (rings.length > 0) {
          polygons.push(rings)
        }
      }

      if (polygons.length > 0) {
        return {
          type: "MultiPolygon",
          coordinates: polygons,
        }
      }
    }

    // Handle POLYGON ((x y, x y), (x y, x y))
    if (wkt.startsWith("POLYGON")) {
      const coordsStr = wkt.replace(/^POLYGON\s*\(\(/i, "").replace(/\)\)$/, "")
      const rings: number[][][] = []

      // Split by "),(" to get individual rings
      const ringStrings = coordsStr.split(/\)\s*,\s*\(/)

      for (const ringStr of ringStrings) {
        const coords = parseCoordinateRing(ringStr)
        if (coords.length >= 4) {
          rings.push(coords)
        }
      }

      if (rings.length > 0) {
        return {
          type: "Polygon",
          coordinates: rings,
        }
      }
    }
  } catch (e) {
    console.error("Failed to parse WKT geometry:", e)
  }

  return null
}

async function fetchAllArticle4Data(): Promise<Article4Entity[]> {
  const allEntities: Article4Entity[] = []
  let offset = 0
  const limit = 500

  console.log("[Article4] Fetching data from planning.data.gov.uk...")

  while (true) {
    const url = `${PLANNING_DATA_API}?dataset=article-4-direction-area&limit=${limit}&offset=${offset}`
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      console.error(`[Article4] API error: ${response.status}`)
      break
    }

    const data = await response.json()
    const entities = data.entities || data || []

    if (!Array.isArray(entities) || entities.length === 0) {
      break
    }

    allEntities.push(...entities)
    console.log(`[Article4] Fetched ${allEntities.length} entities so far...`)

    if (entities.length < limit) {
      break
    }

    offset += limit
  }

  console.log(`[Article4] Total entities fetched: ${allEntities.length}`)
  return allEntities
}

// Static file removed - it only contained rectangular bounding boxes, not actual boundaries
// We now rely solely on the UK Government planning.data.gov.uk API which has accurate polygon shapes

async function buildGeoJSON(): Promise<GeoJSON.FeatureCollection> {
  // Fetch data from UK Government planning.data.gov.uk API only
  // This provides accurate polygon boundaries (not rectangular boxes)
  const entities = await fetchAllArticle4Data()

  // Filter for HMO-related Article 4 directions
  const hmoEntities = entities.filter(isHmoRelated)
  console.log(`[Article4] HMO-related entities from API: ${hmoEntities.length}`)

  const features: GeoJSON.Feature[] = []
  const seenNames = new Set<string>()

  for (const entity of hmoEntities) {
    if (!entity.geometry) continue

    const geometry = parseWKTGeometry(entity.geometry)
    if (!geometry) continue

    // Deduplicate by name
    const name = (entity.name || "").toLowerCase()
    if (seenNames.has(name)) continue
    seenNames.add(name)

    features.push({
      type: "Feature",
      properties: {
        name: entity.name || "Article 4 Direction",
        reference: entity.reference,
        effective_date: entity["start-date"] || "Unknown",
        end_date: entity["end-date"] || null,
        description: entity.description || entity.notes || "",
        organisation: entity["organisation-entity"],
        source: "planning.data.gov.uk",
        verified: true,
      },
      geometry,
    })
  }

  console.log(`[Article4] Features with valid geometry: ${features.length}`)

  return {
    type: "FeatureCollection",
    features,
  }
}

export async function GET() {
  try {
    const now = Date.now()

    // Return cached data if still valid
    if (cachedData && now - cacheTimestamp < CACHE_DURATION) {
      console.log("[Article4] Returning cached data")
      return NextResponse.json(cachedData, {
        headers: {
          "Cache-Control": "public, max-age=3600",
          "X-Data-Source": "planning.data.gov.uk",
          "X-Cache": "HIT",
        },
      })
    }

    // Fetch and process fresh data
    const geojson = await buildGeoJSON()

    // Update cache
    cachedData = geojson
    cacheTimestamp = now

    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "X-Data-Source": "planning.data.gov.uk",
        "X-Cache": "MISS",
        "X-Feature-Count": String(geojson.features.length),
      },
    })
  } catch (error) {
    console.error("[Article4] Error fetching data:", error)

    // Return cached data on error if available
    if (cachedData) {
      return NextResponse.json(cachedData, {
        headers: {
          "Cache-Control": "public, max-age=300",
          "X-Data-Source": "planning.data.gov.uk",
          "X-Cache": "STALE",
          "X-Error": "true",
        },
      })
    }

    return NextResponse.json(
      { error: "Failed to fetch Article 4 data" },
      { status: 500 }
    )
  }
}
