/**
 * PlanIt client (planit.org.uk).
 *
 * Why not the government feed: planning.data.gov.uk publishes 100,627 planning
 * applications covering four councils — Camden, Worthing, Adur and Doncaster.
 * PlanIt aggregates council portals nationally; a single page of HMO results
 * spans 40+ authorities.
 *
 * LICENSING — unresolved, and it matters. PlanIt's API terms cover rate limits
 * but say nothing about commercial redistribution. That is fine for rendering
 * inside the product; it is NOT cleared for the phase-2 resold API. Records are
 * tagged `source: "planit"`, which the provenance layer treats as
 * non-redistributable until written permission exists. The fallback, if it never
 * does, is that planning decisions are public records published by councils, so
 * we can link and attribute rather than redistribute — which is why every record
 * keeps `councilUrl` pointing at the authority's own portal.
 */

export const PLANIT_SOURCE = "planit" as const

const BASE = "https://www.planit.org.uk/api/applics/json"
const USER_AGENT = "HMO-Hunter/1.0 (+https://hmohunter.co.uk)"

/** PlanIt caps a response at 5,000 records and ~1,000kB. */
const MAX_PAGE_SIZE = 250
const MAX_PAGES = 20
const MAX_RETRIES = 4

export type PlanitAppState = "Permitted" | "Rejected" | "Withdrawn" | "Undecided" | "Conditions"

export interface PlanitApplication {
  /** PlanIt's unique key, e.g. "Enfield/26/03113/CND". */
  name: string
  reference: string | null
  councilName: string | null
  description: string | null
  appState: string | null
  appType: string | null
  appSize: string | null
  receivedDate: string | null
  decidedDate: string | null
  address: string | null
  postcode: string | null
  longitude: number | null
  latitude: number | null
  /** The council's own portal page — the citable primary source. */
  councilUrl: string | null
  /** PlanIt's aggregated page. */
  planitUrl: string | null
}

export interface PlanitQuery {
  /** Free-text search, matched against the description. */
  search: string
  /** Filter by decision state. Omit for all. */
  appState?: PlanitAppState
  /** Applications received on or after this date (YYYY-MM-DD). */
  startDate?: string
  endDate?: string
  /** Hard cap on records returned. */
  limit?: number
}

export interface PlanitResult {
  applications: PlanitApplication[]
  /** PlanIt's reported total for the query, which may exceed what was fetched. */
  total: number | null
  pagesFetched: number
  /** True when the cap was hit before exhausting results. */
  truncated: boolean
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "string" ? parseFloat(value) : (value as number)
  return typeof n === "number" && Number.isFinite(n) ? n : null
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null
  const match = value.match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

export function normaliseApplication(raw: any): PlanitApplication | null {
  if (!raw?.name) return null

  const coords = Array.isArray(raw?.location?.coordinates) ? raw.location.coordinates : null

  return {
    name: String(raw.name),
    reference: raw.uid ?? raw.reference ?? null,
    councilName: raw.area_name ?? raw.scraper_name ?? null,
    description: raw.description ?? null,
    appState: raw.app_state ?? null,
    appType: raw.app_type ?? null,
    appSize: raw.app_size ?? null,
    receivedDate: toIsoDate(raw.start_date),
    decidedDate: toIsoDate(raw.decided_date),
    address: raw.address ?? null,
    postcode: raw.postcode ?? null,
    longitude: toNumber(raw.location_x) ?? toNumber(coords?.[0]),
    latitude: toNumber(raw.location_y) ?? toNumber(coords?.[1]),
    councilUrl: raw.url ?? null,
    planitUrl: raw.link ?? null,
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Fetch one page, backing off on 429. PlanIt rate limits without publishing the
 * threshold, so this retries with exponential delay rather than hammering.
 */
async function fetchPage(params: URLSearchParams): Promise<any | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${BASE}?${params}`, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(60_000),
      })

      if (response.status === 429) {
        if (attempt === MAX_RETRIES) return null
        await sleep(2000 * Math.pow(2, attempt))
        continue
      }

      if (!response.ok) return null
      return await response.json()
    } catch {
      if (attempt === MAX_RETRIES) return null
      await sleep(1000 * Math.pow(2, attempt))
    }
  }

  return null
}

/**
 * Search PlanIt, paging until the limit or the end of results.
 *
 * Fails soft: a page that errors after retries ends the walk and returns what
 * was gathered, with `truncated` set. The caller must not treat a short result
 * as "nothing more exists" — same reasoning as everywhere else in this feature.
 */
export async function searchApplications(query: PlanitQuery): Promise<PlanitResult> {
  const limit = query.limit ?? 1000
  const applications: PlanitApplication[] = []
  const seen = new Set<string>()

  let total: number | null = null
  let pagesFetched = 0
  let truncated = false

  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      search: query.search,
      pg_sz: String(Math.min(MAX_PAGE_SIZE, limit - applications.length)),
      page: String(page),
    })
    if (query.appState) params.set("app_state", query.appState)
    if (query.startDate) params.set("start_date", query.startDate)
    if (query.endDate) params.set("end_date", query.endDate)

    const data = await fetchPage(params)
    if (!data) {
      truncated = true
      break
    }

    pagesFetched++
    if (total === null && typeof data.total === "number") total = data.total

    const records: any[] = data.records ?? []
    if (records.length === 0) break

    for (const raw of records) {
      const app = normaliseApplication(raw)
      // PlanIt pages can overlap; `name` is its unique key.
      if (app && !seen.has(app.name)) {
        seen.add(app.name)
        applications.push(app)
      }
    }

    if (applications.length >= limit) {
      truncated = total !== null && total > applications.length
      break
    }
    if (records.length < MAX_PAGE_SIZE) break
  }

  return { applications, total, pagesFetched, truncated }
}

/** Search terms covering how councils phrase HMO applications. */
export const HMO_SEARCH_TERMS = [
  "house in multiple occupation",
  "houses in multiple occupation",
  "HMO",
] as const

/**
 * Outcomes fetched explicitly during ingest.
 *
 * A single date-windowed query is dominated by applications still awaiting a
 * decision — a 90-day window over recent submissions returned 804 applications
 * of which only 25 had been decided. Approval rates computed from that are
 * meaningless. Councils decide months after submission, so decided applications
 * have to be requested by outcome rather than hoped for inside a date window.
 */
export const DECIDED_STATES: PlanitAppState[] = ["Permitted", "Rejected", "Withdrawn"]

/**
 * Fetch HMO applications across all phrasings and de-duplicate.
 *
 * Councils word these inconsistently, so a single search term misses a
 * meaningful share of the real applications.
 */
export async function searchHmoApplications(options: {
  appState?: PlanitAppState
  startDate?: string
  endDate?: string
  limitPerTerm?: number
}): Promise<PlanitResult> {
  const results = await Promise.all(
    HMO_SEARCH_TERMS.map((search) =>
      searchApplications({
        search,
        appState: options.appState,
        startDate: options.startDate,
        endDate: options.endDate,
        limit: options.limitPerTerm ?? 500,
      })
    )
  )

  const merged = new Map<string, PlanitApplication>()
  for (const result of results) {
    for (const app of result.applications) merged.set(app.name, app)
  }

  return {
    applications: [...merged.values()],
    total: results.reduce<number | null>(
      (max, r) => (r.total === null ? max : Math.max(max ?? 0, r.total)),
      null
    ),
    pagesFetched: results.reduce((sum, r) => sum + r.pagesFetched, 0),
    truncated: results.some((r) => r.truncated),
  }
}

/**
 * Ingest set: every decided outcome plus whatever is pending in the window.
 *
 * Decided applications are requested by outcome so the sample can support an
 * approval rate; pending ones come from the date window so the map stays current.
 */
export async function fetchHmoIngestSet(options: {
  startDate?: string
  limitPerTerm?: number
}): Promise<PlanitResult> {
  const passes = await Promise.all([
    ...DECIDED_STATES.map((appState) =>
      searchHmoApplications({ appState, startDate: options.startDate, limitPerTerm: options.limitPerTerm })
    ),
    searchHmoApplications({ startDate: options.startDate, limitPerTerm: options.limitPerTerm }),
  ])

  const merged = new Map<string, PlanitApplication>()
  for (const pass of passes) {
    for (const app of pass.applications) merged.set(app.name, app)
  }

  return {
    applications: [...merged.values()],
    total: passes.reduce<number | null>(
      (sum, p) => (p.total === null ? sum : (sum ?? 0) + p.total),
      null
    ),
    pagesFetched: passes.reduce((sum, p) => sum + p.pagesFetched, 0),
    truncated: passes.some((p) => p.truncated),
  }
}
