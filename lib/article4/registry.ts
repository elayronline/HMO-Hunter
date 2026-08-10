/**
 * Council registry for Article 4.
 *
 * Three planning.data.gov.uk datasets describe the same thing from different
 * angles and share no foreign keys:
 *
 *   local-authority-district  344 LPAs with boundaries — the canonical list
 *   article-4-direction-area   7,326 areas, 72 HMO-related — the geometry
 *   article-4-direction        3,234 directions, 63 HMO-related — the paperwork,
 *                              including document-url, which is what a citation
 *                              can actually point at
 *
 * Areas carry no link to their direction, so the only join available is
 * `organisation-entity` → council, and council names differ between datasets
 * ("Bristol City Council" vs "Bristol, City of"). This module resolves that into
 * one record per council.
 *
 * Why persist it rather than compute per request: the enrichment job currently
 * resolves the covered-council set by firing one HTTP request per organisation
 * on every run. The registry turns that into a single table read, and gives the
 * council pages (step 8) something to render.
 *
 * Every record carries `source` and `retrievedAt` — the phase-2 API has to serve
 * provenance alongside values, and backfilling that later is far harder than
 * carrying it from the start.
 */

import { normaliseCouncilName, ARTICLE4_SOURCE_PLANNING_DATA } from "./coverage"

const ENTITY = "https://www.planning.data.gov.uk/entity.json"
const ORG = "https://www.planning.data.gov.uk/entity"

/** Matches HMO-relevant Article 4 records by name/notes/description. */
export const HMO_PATTERN =
  /hmo|houses? in multiple occupation|multiple occupation|class c4|c3 to c4|c3-c4|c3\/c4|small hmo|shared (house|dwelling)/i

/** Records that mention HMOs incidentally but restrict something else. */
export const HMO_EXCLUSIONS =
  /agricultural|mineral extraction|caravan|camping|motor racing|launderette/i

export interface Article4DirectionRecord {
  entity: number
  name: string
  reference: string
  commencedOn: string | null
  endedOn: string | null
  documentUrl: string | null
  description: string | null
}

/**
 * What this council lets us actually determine.
 *
 *   boundaries      testable geometry — a polygon miss here is a real negative
 *   directions_only a known HMO Article 4 exists but no boundary is published,
 *                   so nothing can be tested. Crawley (10 directions) and Tower
 *                   Hamlets sit here. Treating these as covered would assert a
 *                   confident negative in a council we know is restricted —
 *                   worse than the bug this all started with.
 *   none            nothing published; absence tells us nothing
 */
export type CoverageLevel = "boundaries" | "directions_only" | "none"

export interface CouncilRecord {
  /** URL segment, e.g. "newcastle-upon-tyne". Unique. */
  slug: string
  /** Canonical display name, taken from the LPA district dataset. */
  name: string
  /** ONS GSS code, e.g. E08000003. */
  gssCode: string
  /** Normalised join key shared across datasets. */
  matchKey: string
  organisationEntity: number | null
  /** True when this council publishes any HMO Article 4 record. Display only. */
  publishesHmoArticle4: boolean
  /** Only "boundaries" may gate `none_found`. */
  coverageLevel: CoverageLevel
  areaCount: number
  /** Areas we can actually point-in-polygon. This, not areaCount, gates negatives. */
  areaCountWithGeometry: number
  directionCount: number
  earliestCommencement: string | null
  latestCommencement: string | null
  /** Council-published source documents — the citation targets. */
  documentUrls: string[]
  directions: Article4DirectionRecord[]
  source: string
  retrievedAt: string
}

/** Council or LPA name to a stable URL segment. */
export function toSlug(name: string): string {
  const key = normaliseCouncilName(name)
  return key.replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

/** True when a planning entity concerns HMO use, not some other restriction. */
export function isHmoRelated(entity: {
  name?: string | null
  notes?: string | null
  description?: string | null
}): boolean {
  const text = [entity.name, entity.notes, entity.description].filter(Boolean).join(" ")
  if (!text) return false
  if (HMO_EXCLUSIONS.test(text)) return false
  return HMO_PATTERN.test(text)
}

/** Oldest/newest non-null date in a list, ISO order. */
export function dateRange(dates: (string | null | undefined)[]): {
  earliest: string | null
  latest: string | null
} {
  const valid = dates.filter((d): d is string => Boolean(d)).sort()
  return { earliest: valid[0] ?? null, latest: valid[valid.length - 1] ?? null }
}

async function getJson(url: string, timeoutMs = 60_000): Promise<any | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal })
    clearTimeout(timer)
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

/**
 * Walk every page of a dataset.
 *
 * `fields` uses the API's projection, which is much cheaper — but the API
 * returns `organisation-entity` as an EMPTY STRING whenever projection is on.
 * So any caller needing that field must omit `fields` and take full records.
 */
async function fetchDataset(dataset: string, fields?: string[]): Promise<any[]> {
  const projection = fields?.length ? fields.map((f) => `&field=${f}`).join("") : ""
  const rows: any[] = []

  for (let offset = 0; ; offset += 500) {
    const page = await getJson(`${ENTITY}?dataset=${dataset}&limit=500&offset=${offset}${projection}`)
    const batch = page?.entities ?? []
    rows.push(...batch)
    if (batch.length < 500) break
  }

  return rows
}

/** Resolve organisation entity ids to council names, in parallel. */
async function resolveOrganisations(ids: Iterable<number>): Promise<Map<number, string>> {
  const unique = Array.from(new Set(Array.from(ids).filter((id) => id != null)))
  const resolved = await Promise.all(
    unique.map(async (id) => [id, (await getJson(`${ORG}/${id}.json`, 20_000))?.name ?? null] as const)
  )

  const map = new Map<number, string>()
  for (const [id, name] of resolved) if (name) map.set(id, name)
  return map
}

/**
 * Build the registry from live planning data.
 *
 * Fails closed: if the LPA district list can't be fetched the result is empty
 * rather than partial, because a partial registry would silently shrink the
 * covered set and start producing unwarranted negatives.
 */
export async function buildCouncilRegistry(now: Date = new Date()): Promise<CouncilRecord[]> {
  const retrievedAt = now.toISOString()

  const [districts, areas, directions] = await Promise.all([
    fetchDataset("local-authority-district", ["name", "reference"]),
    fetchDataset("article-4-direction-area"), // full records — need organisation-entity
    fetchDataset("article-4-direction"),
  ])

  if (districts.length === 0) return []

  const hmoAreas = areas.filter(isHmoRelated)
  const hmoDirections = directions.filter(isHmoRelated)

  const orgIds = [...hmoAreas, ...hmoDirections]
    .map((e) => e["organisation-entity"])
    .filter((id): id is number => Boolean(id))
  const orgNames = await resolveOrganisations(orgIds)

  // Bucket the HMO records by council match key.
  const areasByKey = new Map<string, any[]>()
  const directionsByKey = new Map<string, any[]>()

  function bucket(target: Map<string, any[]>, rows: any[]) {
    for (const row of rows) {
      const orgName = orgNames.get(row["organisation-entity"])
      if (!orgName) continue
      const key = normaliseCouncilName(orgName)
      const list = target.get(key)
      if (list) list.push(row)
      else target.set(key, [row])
    }
  }

  bucket(areasByKey, hmoAreas)
  bucket(directionsByKey, hmoDirections)

  // One record per council, deduped by slug. Six LPA names appear twice in the
  // district dataset as duplicate entity records for the same place; the first
  // wins and the duplicate is dropped rather than creating a second council.
  const bySlug = new Map<string, CouncilRecord>()

  for (const district of districts) {
    const name: string = district.name ?? ""
    if (!name) continue

    const slug = toSlug(name)
    if (!slug || bySlug.has(slug)) continue

    const matchKey = normaliseCouncilName(name)
    const councilAreas = areasByKey.get(matchKey) ?? []
    const councilDirections = directionsByKey.get(matchKey) ?? []

    const mapped: Article4DirectionRecord[] = councilDirections.map((d) => ({
      entity: d.entity,
      name: d.name ?? "",
      reference: d.reference ?? "",
      commencedOn: d["start-date"] || null,
      endedOn: d["end-date"] || null,
      documentUrl: d["document-url"] || d["documentation-url"] || null,
      description: d.description || d.notes || null,
    }))

    const { earliest, latest } = dateRange([
      ...councilAreas.map((a) => a["start-date"]),
      ...mapped.map((d) => d.commencedOn),
    ])

    const areasWithGeometry = councilAreas.filter((a) => Boolean(a.geometry)).length
    const coverageLevel: CoverageLevel =
      areasWithGeometry > 0 ? "boundaries" : mapped.length > 0 ? "directions_only" : "none"

    bySlug.set(slug, {
      slug,
      name,
      gssCode: district.reference ?? "",
      matchKey,
      organisationEntity:
        councilAreas[0]?.["organisation-entity"] ?? councilDirections[0]?.["organisation-entity"] ?? null,
      publishesHmoArticle4: councilAreas.length > 0 || mapped.length > 0,
      coverageLevel,
      areaCount: councilAreas.length,
      areaCountWithGeometry: areasWithGeometry,
      directionCount: mapped.length,
      earliestCommencement: earliest,
      latestCommencement: latest,
      documentUrls: Array.from(new Set(mapped.map((d) => d.documentUrl).filter((u): u is string => Boolean(u)))),
      directions: mapped,
      source: ARTICLE4_SOURCE_PLANNING_DATA,
      retrievedAt,
    })
  }

  return Array.from(bySlug.values()).sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The only set permitted to produce `none_found`.
 *
 * Deliberately narrower than `publishesHmoArticle4`: councils with directions
 * but no geometry are excluded, because a polygon miss there means "we have no
 * boundary to test", not "the property is outside one".
 */
export function coveredKeysFromRegistry(registry: CouncilRecord[]): Set<string> {
  return new Set(
    registry.filter((c) => c.coverageLevel === "boundaries").map((c) => c.matchKey)
  )
}

/**
 * Councils known to operate an HMO Article 4 with no testable boundary. Callers
 * should treat these as restricted-until-confirmed rather than merely unknown.
 */
export function directionOnlyKeysFromRegistry(registry: CouncilRecord[]): Set<string> {
  return new Set(
    registry.filter((c) => c.coverageLevel === "directions_only").map((c) => c.matchKey)
  )
}
