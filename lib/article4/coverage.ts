/**
 * Article 4 coverage and classification.
 *
 * The national feed (planning.data.gov.uk) holds only 72 HMO-related Article 4
 * areas across 38 councils. Absence from it is not evidence of absence on the
 * ground — Manchester, Leeds, Nottingham and Sheffield all operate city-wide
 * HMO Article 4 directions and publish none of them here.
 *
 * So a polygon miss alone can never produce a negative. A negative requires two
 * facts: the point was checked, AND its planning authority is one that actually
 * publishes to a source we hold. Everything else is `unknown`.
 *
 * The rule is fail-closed throughout: any lookup that errors, times out or comes
 * back ambiguous yields `unknown`, never `none_found`.
 */

export type Article4Status = "in_force" | "none_found" | "unknown"

export const ARTICLE4_SOURCE_PLANNING_DATA = "planning.data.gov.uk"

const PLANNING_DATA_ENTITY = "https://www.planning.data.gov.uk/entity.json"
const PLANNING_DATA_ORG = "https://www.planning.data.gov.uk/entity"

/**
 * Councils whose published name differs from their LPA district name.
 *
 * The short forms come from PlanIt, which labels planning authorities the way
 * their planning service brands itself rather than by statutory name. Left
 * unmapped these silently drop out of per-council statistics — BCP alone
 * accounted for 22 decisions.
 *
 * Deliberately NOT mapped, because they cover more than one authority and a
 * guess would misattribute decisions: "Mid Kent" (Maidstone, Swale and
 * Tunbridge Wells share a service), "Adur and Worthing", "Bromsgrove Redditch",
 * and "Old Oak Park Royal" (a development corporation, not an LPA district).
 */
const COUNCIL_ALIASES: Record<string, string> = {
  newcastle: "newcastle upon tyne",
  bcp: "bournemouth christchurch and poole",
  bath: "bath and north east somerset",
  brighton: "brighton and hove",
  hull: "kingston upon hull",
  telford: "telford and wrekin",
  "kings lynn": "king s lynn and west norfolk",
  "north lincs": "north lincolnshire",
  reigate: "reigate and banstead",
  southend: "southend on sea",
  blackburn: "blackburn with darwen",
}

export interface Article4Classification {
  status: Article4Status
  council: string | null
  councilCovered: boolean | null
  areaName: string | null
  source: string | null
  checkedAt: string
}

export interface Lpa {
  name: string
  reference: string
}

/**
 * Reduce a council or LPA district name to a comparable key.
 *
 * The two datasets name the same body differently — "Bristol City Council" in
 * the organisation dataset is "Bristol, City of" in the district dataset. This
 * is validated against live data by tests/article4-coverage.test.ts, which
 * asserts every covered council resolves to a real LPA. If that test fails, the
 * upstream naming has drifted and none_found would start being written against
 * unmatched councils — so it fails loudly rather than degrading silently.
 */
export function normaliseCouncilName(name: string): string {
  let s = (name || "").toLowerCase().trim()

  // "Bristol, City of" / "Herefordshire, County of"
  const inverted = s.match(/^(.*),\s*(city|county|borough)\s+of$/)
  if (inverted) s = inverted[1]

  s = s.replace(/^(the\s+)?(royal\s+)?(london\s+)?borough\s+of\s+/, "")
  s = s.replace(/^city\s+of\s+/, "")
  s = s.replace(/\b(city|district|county|metropolitan|borough|royal|london)\b/g, "")
  s = s.replace(/\bcouncil\b/g, "")
  // Hyphens become spaces so "Newcastle-under-Lyme" and "Newcastle under Lyme"
  // resolve to one key. Slugs are rebuilt from this, so both still yield
  // "newcastle-under-lyme".
  s = s.replace(/[^a-z\- ]/g, " ").replace(/-/g, " ")
  s = s.split(/\s+/).filter(Boolean).join(" ")

  // Stripping the keywords can strand the conjunction that joined them: "St
  // Albans City and District Council" becomes "st albans and", which matches no
  // district and silently drops the council. It cost St Albans all 9 of its
  // Class MA directions.
  //
  // Only a leading or trailing "and" is removed. The word is load-bearing in the
  // middle of real names — Bath and North East Somerset, Brighton and Hove,
  // Kensington and Chelsea, Barking and Dagenham — and no council name begins or
  // ends with it.
  s = s.replace(/^and\s+/, "").replace(/\s+and$/, "")

  return COUNCIL_ALIASES[s] ?? s
}

/**
 * Decide a status from already-gathered facts. Pure — no I/O — so the decision
 * rule itself is unit-testable independently of the network.
 */
export function classifyArticle4(input: {
  matchedAreaName: string | null
  council: string | null
  councilCovered: boolean | null
  source?: string | null
  now?: Date
}): Article4Classification {
  const checkedAt = (input.now ?? new Date()).toISOString()
  const council = input.council ?? null
  const councilCovered = input.councilCovered ?? null

  // A boundary match is a positive regardless of coverage bookkeeping.
  if (input.matchedAreaName) {
    return {
      status: "in_force",
      council,
      councilCovered,
      areaName: input.matchedAreaName,
      source: input.source ?? ARTICLE4_SOURCE_PLANNING_DATA,
      checkedAt,
    }
  }

  // No match. Only a council we know publishes HMO directions can turn that
  // into a negative. Unresolved council, or a council absent from the feed,
  // stays unknown — this is the false negative the boolean column produced.
  if (councilCovered === true && council) {
    return {
      status: "none_found",
      council,
      councilCovered: true,
      areaName: null,
      source: input.source ?? ARTICLE4_SOURCE_PLANNING_DATA,
      checkedAt,
    }
  }

  return {
    status: "unknown",
    council,
    councilCovered,
    areaName: null,
    source: null,
    checkedAt,
  }
}

/** Mirror value for the deprecated `article_4_area` boolean column. */
export function toLegacyBoolean(status: Article4Status): boolean | null {
  if (status === "in_force") return true
  if (status === "none_found") return false
  return null
}

async function getJson(url: string, timeoutMs = 30_000): Promise<any | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null // fail closed — caller degrades to `unknown`
  }
}

/**
 * Resolve the local planning authority containing a point, via the planning
 * API's spatial query. Returns null on any failure so callers stay at `unknown`.
 */
export async function resolveLpaForPoint(
  longitude: number,
  latitude: number
): Promise<Lpa | null> {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null

  const url = `${PLANNING_DATA_ENTITY}?dataset=local-authority-district&longitude=${longitude}&latitude=${latitude}`
  const data = await getJson(url)
  const entity = data?.entities?.[0]
  if (!entity?.name) return null

  return { name: entity.name, reference: entity.reference ?? "" }
}

/**
 * Build the set of council keys that publish HMO Article 4 areas to the national
 * feed. Only points inside these councils are eligible for `none_found`.
 *
 * Returns an empty set on failure, which collapses every result to `unknown` —
 * deliberately the safe direction.
 */
export async function fetchCoveredCouncilKeys(
  organisationEntities: Iterable<number | string>
): Promise<Set<string>> {
  const keys = new Set<string>()
  const ids = Array.from(new Set(Array.from(organisationEntities).filter(Boolean)))

  const resolved = await Promise.all(
    ids.map((id) => getJson(`${PLANNING_DATA_ORG}/${id}.json`, 15_000))
  )

  for (const org of resolved) {
    if (org?.name) keys.add(normaliseCouncilName(org.name))
  }

  return keys
}
