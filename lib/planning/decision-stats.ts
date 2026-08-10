/**
 * Approval-rate statistics over HMO planning decisions.
 *
 * The number investors actually need: of the applications that sought to create
 * or expand an HMO, what share were granted — and specifically, what share were
 * granted inside an Article 4 area. An Article 4 direction removes permitted
 * development; it does not prohibit HMOs. A council granting 80% of applications
 * has an administrative hurdle, one granting 15% has a de facto ban, and the
 * boundary map alone cannot tell those apart.
 *
 * Two exclusions keep the figure honest:
 *   - Only supply-adding kinds count. Reversions, certificates of existing use
 *     and condition discharges are decisions about something else.
 *   - Only Permitted and Rejected count. Withdrawn is not a decision, and
 *     Undecided has not happened yet. Including either would understate the
 *     approval rate.
 */

export interface DecisionRow {
  kind: string
  adds_supply: boolean
  app_state: string | null
  decided_date: string | null
  council_slug: string | null
  occupants: number | null
}

export interface ApprovalStats {
  /** Applications that sought to create or expand an HMO and were decided. */
  decided: number
  permitted: number
  rejected: number
  /** permitted / (permitted + rejected). Null when nothing has been decided. */
  approvalRate: number | null
  withdrawn: number
  undecided: number
  /** Supply-adding applications whose outcome is not yet known. */
  pending: number
  /** Excluded from the rate: reversions, certificates, ancillary, unclear. */
  excluded: number
  /** Median stated occupants among permitted applications. */
  medianOccupants: number | null
  /** Set when the sample is too small for the rate to mean anything. */
  lowConfidence: boolean
}

/** Below this, an approval rate is noise rather than a signal. */
export const MIN_DECISIONS_FOR_RATE = 8

const PERMITTED = /^permitted$/i
const REJECTED = /^(rejected|refused)$/i
const WITHDRAWN = /^withdrawn$/i

export function computeApprovalStats(rows: DecisionRow[]): ApprovalStats {
  const supplyRows = rows.filter((r) => r.adds_supply)
  const excluded = rows.length - supplyRows.length

  let permitted = 0
  let rejected = 0
  let withdrawn = 0
  let undecided = 0
  const permittedOccupants: number[] = []

  for (const row of supplyRows) {
    const state = row.app_state ?? ""
    if (PERMITTED.test(state)) {
      permitted++
      if (row.occupants != null) permittedOccupants.push(row.occupants)
    } else if (REJECTED.test(state)) {
      rejected++
    } else if (WITHDRAWN.test(state)) {
      withdrawn++
    } else {
      undecided++
    }
  }

  const decided = permitted + rejected

  return {
    decided,
    permitted,
    rejected,
    approvalRate: decided > 0 ? permitted / decided : null,
    withdrawn,
    undecided,
    pending: undecided,
    excluded,
    medianOccupants: median(permittedOccupants),
    lowConfidence: decided < MIN_DECISIONS_FOR_RATE,
  }
}

export type ApprovalBand = "routinely_granted" | "usually_granted" | "mixed" | "often_refused" | "rarely_granted" | "unknown"

export interface ApprovalDescription {
  band: ApprovalBand
  /** Neutral label describing what the record shows. */
  label: string
  /** Factual sentence — counts first, never a recommendation. */
  summary: string
}

/**
 * Describe an approval rate in plain language.
 *
 * Deliberately descriptive rather than advisory: it reports what the record
 * shows and leaves the investment decision to the user. Counts always lead, so
 * a rate is never read without its sample size, and a null rate is described as
 * an absence of decisions rather than as a 0% approval rate.
 */
export function describeApprovalRate(stats: ApprovalStats): ApprovalDescription {
  if (stats.approvalRate === null) {
    return {
      band: "unknown",
      label: "No decisions on record",
      summary:
        "No applications to create or expand an HMO have been decided here in the data held. This is not evidence that permission would be refused.",
    }
  }

  const pct = Math.round(stats.approvalRate * 100)
  const counts = `${stats.permitted} of ${stats.decided} decided application${stats.decided === 1 ? "" : "s"} approved (${pct}%)`
  const caveat = stats.lowConfidence ? " Based on a small sample." : ""

  const band: ApprovalBand =
    stats.approvalRate >= 0.75
      ? "routinely_granted"
      : stats.approvalRate >= 0.6
        ? "usually_granted"
        : stats.approvalRate >= 0.4
          ? "mixed"
          : stats.approvalRate >= 0.15
            ? "often_refused"
            : "rarely_granted"

  const label: Record<Exclude<ApprovalBand, "unknown">, string> = {
    routinely_granted: "Routinely granted",
    usually_granted: "Usually granted",
    mixed: "Mixed outcomes",
    often_refused: "Often refused",
    rarely_granted: "Rarely granted",
  }

  return { band, label: label[band], summary: `${counts}.${caveat}` }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export interface CouncilApprovalStats extends ApprovalStats {
  councilSlug: string
}

export function groupByCouncil(rows: DecisionRow[]): CouncilApprovalStats[] {
  const buckets = new Map<string, DecisionRow[]>()

  for (const row of rows) {
    if (!row.council_slug) continue // never guess an attribution
    const list = buckets.get(row.council_slug)
    if (list) list.push(row)
    else buckets.set(row.council_slug, [row])
  }

  return [...buckets.entries()]
    .map(([councilSlug, councilRows]) => ({
      councilSlug,
      ...computeApprovalStats(councilRows),
    }))
    .sort((a, b) => b.decided - a.decided)
}

/**
 * Great-circle distance in kilometres. Used to find decisions near a property
 * without requiring PostGIS.
 */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Bounding box for a radius search, so the database can use the (lat, lng)
 * index before exact distances are computed in memory.
 */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 111
  const cos = Math.cos((lat * Math.PI) / 180)
  // Near the poles longitude degrees collapse; fall back to the whole range.
  const lngDelta = Math.abs(cos) < 0.01 ? 180 : radiusKm / (111 * Math.abs(cos))

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: Math.max(-180, lng - lngDelta),
    maxLng: Math.min(180, lng + lngDelta),
  }
}
