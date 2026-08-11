/**
 * Composes the public Article 4 assessment — the payload the phase-2 API serves
 * and the council pages render.
 *
 * The split that keeps this accurate: the statutory framework (use classes,
 * occupancy thresholds, which permitted development right an Article 4 removes)
 * is national, stable and identical everywhere, so it is hardcoded here as
 * verified content. Only the council-specific layer — does a direction exist,
 * where, since when — is uncertain and carries per-field provenance.
 *
 * Putting the invariant part through an extraction pipeline would add error for
 * no benefit.
 */

import type { CouncilRecord, CoverageLevel, ForceState } from "./registry"
import { sourced, type Sourced } from "./provenance"

/** Which statutory regime applies, from the ONS GSS code prefix. */
export type Jurisdiction = "england" | "wales" | "scotland" | "northern-ireland" | "unknown"

export function jurisdictionFromGss(gssCode: string | null | undefined): Jurisdiction {
  switch ((gssCode ?? "").charAt(0).toUpperCase()) {
    case "E":
      return "england"
    case "W":
      return "wales"
    case "S":
      return "scotland"
    case "N":
      return "northern-ireland"
    default:
      return "unknown"
  }
}

export interface UseClassThreshold {
  useClass: string
  occupants: string
  planningPermission: string
  detail: string
}

/**
 * England only. Wales diverges (its own HMO planning rules since 2016) and
 * Scotland's regime is entirely separate, so neither may be described with this.
 */
export const ENGLAND_HMO_USE_CLASSES: UseClassThreshold[] = [
  {
    useClass: "C3",
    occupants: "1-2 unrelated occupants, or a single household",
    planningPermission: "Not required",
    detail: "A dwellinghouse occupied by a single household, or by no more than two unrelated people.",
  },
  {
    useClass: "C4",
    occupants: "3-6 unrelated occupants",
    planningPermission: "Not required unless an Article 4 direction applies",
    detail:
      "A small HMO. Change of use between C3 and C4 is permitted development under the GPDO 2015, Schedule 2, Part 3, Class L. An Article 4 direction removes the C3-to-C4 right, making a full planning application necessary.",
  },
  {
    useClass: "Sui generis",
    occupants: "7 or more unrelated occupants",
    planningPermission: "Always required",
    detail:
      "A large HMO falls outside the use classes order entirely. Planning permission is required regardless of whether an Article 4 direction is in force.",
  },
]

export const PLANNING_VS_LICENSING_NOTE =
  "Planning and licensing are separate regimes. An HMO may need a licence (mandatory licensing applies to HMOs with five or more occupants forming two or more households, and councils may operate additional or selective schemes) whether or not planning permission is required. Satisfying one does not satisfy the other."

export const DISCLAIMER =
  "Indicative only. Article 4 boundaries and planning requirements must be confirmed with the local planning authority before you commit to a purchase or a change of use."

export interface DirectionSummary {
  name: string
  reference: string | null
  commencedOn: string | null
  /** Carried through so a consumer cannot mistake a future direction for a live one. */
  forceState: ForceState
  documentUrl: string | null
}

export interface CouncilAssessment {
  slug: string
  name: string
  gssCode: string | null
  jurisdiction: Jurisdiction
  /** True only when a direction is in force today — see `forceStateOn`. */
  hmoArticle4: Sourced<boolean>
  /** Earliest date a made-but-not-yet-commenced direction starts binding. */
  nextCommencement: Sourced<string>
  coverageLevel: Sourced<CoverageLevel>
  earliestCommencement: Sourced<string>
  latestCommencement: Sourced<string>
  directionCount: Sourced<number>
  boundaryCount: Sourced<number>
  directions: DirectionSummary[]
  useClasses: UseClassThreshold[] | null
  caveats: string[]
  licensingNote: string
  disclaimer: string
  checkedAt: string | null
}

/**
 * Plain-language warnings a consumer must not miss. These exist because the
 * dominant failure mode of this dataset is silence being read as "all clear".
 */
export function buildCaveats(council: CouncilRecord, jurisdiction: Jurisdiction): string[] {
  const caveats: string[] = []

  // Stated first: a restriction that starts on a known date changes what a
  // buyer should do now, and it is the fact most easily mistaken for "no
  // restriction here" — or, before this was separated out, for a live one.
  if (council.directionsNotYetInForce > 0) {
    caveats.push(
      council.nextCommencementDate
        ? `${council.name} has ${council.directionsNotYetInForce} HMO Article 4 direction${
            council.directionsNotYetInForce === 1 ? "" : "s"
          } made but not yet in force. No permission is required on that basis today; the earliest commences ${
            council.nextCommencementDate
          }. A purchase completing after that date is subject to it.`
        : `${council.name} has ${council.directionsNotYetInForce} HMO Article 4 direction${
            council.directionsNotYetInForce === 1 ? "" : "s"
          } made but not yet in force, with no commencement date published. Confirm timing with the council.`
    )
  }

  // An immediate direction binds at once but dies unless confirmed within six
  // months. Past that date our record is simply out of date — the direction was
  // either confirmed or it lapsed, and this file cannot tell which. Say so
  // rather than presenting a stale answer as current.
  if (council.provisionalPastDeadline) {
    caveats.push(
      `${council.name}'s HMO Article 4 direction was an immediate direction, which had to be confirmed by ${council.provisionalPastDeadline} or cease to have effect. Our record does not show a confirmation, so it is treated as still in force but needs checking with the council before you rely on it.`
    )
  }

  if (council.directionsExpired > 0 && !council.hasHmoArticle4InForce) {
    caveats.push(
      `The HMO Article 4 direction${council.directionsExpired === 1 ? "" : "s"} published for ${
        council.name
      } ${council.directionsExpired === 1 ? "has" : "have"} lapsed. Councils often replace one direction with another, so confirm nothing newer applies before relying on this.`
    )
  }

  if (council.coverageLevel === "directions_only") {
    // A curated council contributes no rows to the feed's direction count, so
    // counting them would announce "publishes 0 directions" about a council we
    // have just confirmed operates one.
    caveats.push(
      council.directionCount === 0
        ? `${council.name} operates an HMO Article 4 direction confirmed from the council's own published information, but publishes no boundary data. Properties here cannot be checked against a map — treat the area as restricted until you confirm the extent with the council.`
        : `${council.name} publishes ${council.directionCount} HMO Article 4 direction${
            council.directionCount === 1 ? "" : "s"
          } but no boundary data. Properties here cannot be checked against a map — treat the area as restricted until you confirm the extent with the council.`
    )
  }

  if (council.coverageLevel === "none") {
    caveats.push(
      `No HMO Article 4 direction for ${council.name} appears in the national planning dataset. Many authorities that operate one do not publish to it, so this is not evidence that none exists.`
    )
  }

  if (council.coverageLevel === "boundaries" && council.directionCount === 0) {
    caveats.push(
      `Boundaries are published for ${council.name} but the underlying directions are not, so commencement dates and source documents may be incomplete.`
    )
  }

  if (jurisdiction === "wales") {
    caveats.push(
      "Wales operates its own HMO planning rules. The England use class thresholds do not apply here."
    )
  } else if (jurisdiction === "scotland" || jurisdiction === "northern-ireland") {
    caveats.push(
      "This authority is outside England and Wales. Article 4 directions and the C3/C4 use classes do not apply; a separate regime governs HMOs."
    )
  }

  return caveats
}

export function buildCouncilAssessment(council: CouncilRecord): CouncilAssessment {
  const jurisdiction = jurisdictionFromGss(council.gssCode)
  const base = { source: "planning.data.gov.uk" as const, retrievedAt: council.retrievedAt }

  // Absence of a record is not a negative, so `false` is only asserted where the
  // council actually publishes testable boundaries. Everywhere else this is null
  // with confidence `unknown`.
  //
  // `true` requires a direction in force, not merely published. A direction that
  // commences next year restricts nothing today; reporting it as live would tell
  // a buyer they need permission they do not yet need. Those councils fall to
  // null — not a negative either — and are surfaced through `nextCommencement`
  // and a dated caveat instead.
  const hmoValue =
    council.coverageLevel === "none" ? null : council.hasHmoArticle4InForce ? true : null

  return {
    slug: council.slug,
    name: council.name,
    gssCode: council.gssCode || null,
    jurisdiction,
    hmoArticle4: sourced<boolean>({ ...base, value: hmoValue }),
    nextCommencement: sourced<string>({ ...base, value: council.nextCommencementDate }),
    coverageLevel: sourced<CoverageLevel>({ ...base, value: council.coverageLevel }),
    earliestCommencement: sourced<string>({ ...base, value: council.earliestCommencement }),
    latestCommencement: sourced<string>({ ...base, value: council.latestCommencement }),
    directionCount: sourced<number>({ ...base, value: council.directionCount }),
    boundaryCount: sourced<number>({ ...base, value: council.areaCountWithGeometry }),
    directions: council.directions.map((d) => ({
      name: d.name,
      reference: d.reference || null,
      commencedOn: d.commencedOn,
      forceState: d.forceState,
      documentUrl: d.documentUrl,
    })),
    // Only assert England's thresholds for English authorities.
    useClasses: jurisdiction === "england" ? ENGLAND_HMO_USE_CLASSES : null,
    caveats: buildCaveats(council, jurisdiction),
    licensingNote: PLANNING_VS_LICENSING_NOTE,
    disclaimer: DISCLAIMER,
    checkedAt: council.retrievedAt,
  }
}
