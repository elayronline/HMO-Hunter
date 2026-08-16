/**
 * Article 4 boundaries published by councils themselves.
 *
 * planning.data.gov.uk is voluntary, and the councils with the largest HMO
 * markets are the ones most likely to skip it. Curated records fill part of that
 * gap, but only where a direction covers a whole authority — anything narrower
 * establishes that the council restricts somewhere without deciding a single
 * property, so the honest answer stays `unknown`.
 *
 * A boundary changes that. Leeds designates named wards plus part of Gipton and
 * Harehills, which no list of ward names can express and no prose can decide,
 * and publishes the polygon under the Open Government Licence through its own
 * ArcGIS service. That is the same kind of evidence the national feed carries,
 * from a better source: the authority that made the direction.
 *
 * WHAT THIS LICENSES
 *
 * Everything a feed boundary does, including a negative. A property inside a
 * council that publishes a complete boundary, which falls outside it, is not
 * unknown — it has been tested against the authority's own definition of the
 * area and is outside it. That is the rule `classifyArticle4` already applies to
 * councils in the feed, and the reason it is safe is the same in both cases: the
 * boundary is complete for that council.
 *
 * So a partial or indicative boundary must never be added here. The test is not
 * "did the council publish something" but "does this describe the whole extent
 * of the direction". Where that is in doubt, the record belongs in
 * curated-councils.json without a polygon, where it can only ever add.
 *
 * ADDING ONE
 *
 * Store the GeoJSON beside this file and register it below with the source URL,
 * the licence, and the date it was fetched. Keep the council's own attribute
 * fields — Leeds ships the direction's reference, its commencement date and the
 * permitted development right it removes, which is the provenance a disputed
 * result gets settled against.
 */

import leedsJson from "./leeds.json"
import sheffieldJson from "./sheffield.json"

/** Part 3 Class L is the C3 dwellinghouse to C4 HMO right. */
const HMO_PD_RIGHT = "3L"

export interface CouncilBoundarySource {
  /** Council name as the boundary lookup reports it, for matching. */
  council: string
  slug: string
  /** Where the file came from, so it can be refreshed. */
  sourceUrl: string
  licence: string
  fetchedOn: string
  /** The council's own page describing the direction. */
  documentationUrl: string
  /**
   * When the direction commenced, where the features do not carry it
   * themselves. Leeds stamps START_DATE on the geometry; Sheffield publishes
   * the area with no dates at all, so it is recorded here rather than left to
   * be assumed. Informational — a registered boundary is a current one.
   */
  commencedOn?: string
  features: any[]
}

export const COUNCIL_BOUNDARY_SOURCES: CouncilBoundarySource[] = [
  {
    council: "Leeds",
    slug: "leeds",
    sourceUrl:
      "https://mapservices.leeds.gov.uk/arcgis/rest/services/Public/Strategic_Planning/MapServer/57/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
    licence: "Open Government Licence v3.0",
    fetchedOn: "2026-08-16",
    documentationUrl:
      "https://www.leeds.gov.uk/planning/planning-policy/supplementary-planning-documents-and-guidance/houses-in-multiple-occupation-article-4-direction",
    features: (leedsJson as any).features ?? [],
  },
  {
    council: "Sheffield",
    slug: "sheffield",
    sourceUrl:
      "https://sheffieldcitycouncil.cloud.esriuk.com/server/rest/services/AGOL/OpenData1/FeatureServer/22/query?outFields=*&where=1%3D1&outSR=4326&f=geojson",
    licence: "Open Government Licence v3.0",
    fetchedOn: "2026-08-16",
    documentationUrl: "https://www.sheffield.gov.uk/conservation",
    // The direction was made on 9 December 2010. The published feature carries
    // no dates, so it is recorded here; every feature in this layer is the HMO
    // area, which the council labels typearea "HMO" and describes as "Change of
    // use from C3 (Dwellinghouse) to C4 (HMO) restricted".
    commencedOn: "2010-12-09",
    features: (sheffieldJson as any).features ?? [],
  },
]

/**
 * A boundary counts only while its direction is in force.
 *
 * Leeds stamps START_DATE and END_DATE on the feature in epoch milliseconds, so
 * force is derived on read here exactly as it is for curated records — a polygon
 * for a direction that has not commenced, or one that has lapsed, decides
 * nothing.
 */
export function featureInForceOn(feature: any, now: Date = new Date()): boolean {
  const props = feature?.properties ?? {}
  const start = props.START_DATE
  const end = props.END_DATE
  const t = now.getTime()

  if (typeof start === "number" && start > t) return false
  if (typeof end === "number" && end <= t) return false
  return true
}

/** Only the features that restrict HMO conversion, in force today. */
export function hmoFeaturesFor(
  council: string,
  now: Date = new Date()
): any[] {
  const source = sourceForCouncil(council)
  if (!source) return []

  return source.features.filter((f) => {
    const props = f?.properties ?? {}

    // Where the publisher names the right, insist it is the HMO one — these
    // layers can carry Article 4 areas for other permitted development rights,
    // and a conservation-area polygon read as an HMO restriction would invent
    // one. Leeds names it in PERMITTED_DEVELOPMENT_RIGHTS, Sheffield labels the
    // area type instead. Where a layer says neither, the registry entry above
    // vouches for it.
    const rights = props.PERMITTED_DEVELOPMENT_RIGHTS
    if (typeof rights === "string" && !rights.includes(HMO_PD_RIGHT)) return false

    const areaType = props.typearea ?? props.TYPEAREA
    if (typeof areaType === "string" && !/hmo/i.test(areaType)) return false

    return featureInForceOn(f, now)
  })
}

function normalise(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export function sourceForCouncil(council: string): CouncilBoundarySource | null {
  const target = normalise(council)
  if (!target) return null
  return (
    COUNCIL_BOUNDARY_SOURCES.find(
      (s) => s.slug === target || normalise(s.council) === target
    ) ?? null
  )
}

/**
 * True where this council publishes a complete boundary, which is what makes a
 * miss inside it a negative rather than a silence.
 */
export function publishesCompleteBoundary(council: string, now: Date = new Date()): boolean {
  return hmoFeaturesFor(council, now).length > 0
}
