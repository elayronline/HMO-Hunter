/**
 * Councils verified by hand against their own website.
 *
 * planning.data.gov.uk is voluntary and most authorities ignore it. Measuring
 * that gap put a number on it: of 32 councils checked, the feed knows about 8.
 * Manchester, Leeds, Sheffield, Nottingham, Durham and Middlesbrough all operate
 * HMO Article 4 directions and publish nothing to the national dataset — not
 * zero HMO records, zero records of any kind. No fetching strategy fixes that,
 * because the data is not there to fetch. Someone has to read the council's own
 * page, and this file is where that reading is kept.
 *
 * Two rules keep it safe:
 *
 *  1. **It only ever adds a restriction.** A curated entry can turn `unknown`
 *     into a known Article 4. It can never turn a feed positive into a negative,
 *     and it never produces `none_found` — absence from this file means nobody
 *     has checked yet, exactly as absence from the feed does.
 *
 *  2. **It is not in the eval's prediction path.** The harness scores
 *     `buildCouncilRegistry()`, which reads the feed alone. Serving predictions
 *     from the same research the gold set is built on would measure agreement
 *     with itself and report a recall near 100% that means nothing. If you ever
 *     wire this into `predict()`, the number stops being a measurement — see
 *     tests/article4-curated.test.ts, which asserts the separation.
 *
 * Commencement dates are stored; force is derived on read via `forceStateOn`,
 * so a direction commencing on a future date starts binding on that date with
 * no job to run and nothing to remember. Durham's countywide direction is the
 * worked example: recorded now, live from 17 August 2026.
 */

import curatedJson from "./curated-councils.json"
import { forceStateOn, type CouncilRecord, type ForceState } from "./registry"

export const ARTICLE4_SOURCE_COUNCIL_VERIFIED = "council-verified"

export interface CuratedDirection {
  name: string
  /** Free text: councils describe extent in wards, towns or "city-wide". */
  extent: string | null
  commencedOn: string | null
  endedOn: string | null
  /**
   * Immediate directions only. They bind from the day they are made, but cease
   * to have effect unless the council confirms them within six months. So this
   * is a restriction that is real today and provisional at the same time —
   * neither `in_force` nor `made_not_in_force` says that. Bury's window closes
   * on 2027-01-16.
   */
  confirmBy?: string | null
  /** Set once confirmed, which settles it. Rossendale confirmed on 2026-03-18. */
  confirmedOn?: string | null
  /** The page or document the quote came from. Always the council's own. */
  sourceUrl: string
  /** Verbatim wording, so a dispute is settled against the council's words. */
  quote: string
}

export interface CuratedCouncil {
  slug: string
  name: string
  gssCode: string | null
  directions: CuratedDirection[]
  verifiedBy: string | null
  verifiedAt: string | null
}

interface CuratedFile {
  version: number
  source: string
  councils: CuratedCouncil[]
}

const curated = curatedJson as unknown as CuratedFile

export function curatedCouncils(): CuratedCouncil[] {
  return curated.councils
}

export function curatedBySlug(slug: string): CuratedCouncil | null {
  return curated.councils.find((c) => c.slug === slug) ?? null
}

export interface CuratedAssessment {
  /** True when at least one curated direction is in force on `now`. */
  inForce: boolean
  /** Directions made but not yet commenced. */
  pending: CuratedDirection[]
  /** Earliest future commencement among those. */
  nextCommencementDate: string | null
  /** Extent text for whatever is in force, for display. */
  extents: string[]
  /**
   * Unconfirmed immediate directions whose deadline has now passed. Either the
   * council confirmed it and this record is stale, or it lapsed and the
   * restriction is gone. Both are possible and we cannot tell from here, so the
   * entry needs re-checking rather than trusting.
   */
  needsReconfirmation: CuratedDirection[]
  states: { direction: CuratedDirection; state: ForceState }[]
}

/** What the curated record says about a council on a given date. */
export function assessCurated(council: CuratedCouncil, now: Date = new Date()): CuratedAssessment {
  const states = council.directions.map((direction) => ({
    direction,
    state: forceStateOn(direction.commencedOn, direction.endedOn, now),
  }))

  const pending = states.filter((s) => s.state === "made_not_in_force").map((s) => s.direction)

  const today = now.toISOString().slice(0, 10)
  const needsReconfirmation = council.directions.filter(
    (d) => d.confirmBy && !d.confirmedOn && d.confirmBy < today
  )

  return {
    inForce: states.some((s) => s.state === "in_force"),
    pending,
    needsReconfirmation,
    nextCommencementDate:
      pending
        .map((d) => d.commencedOn)
        .filter((d): d is string => Boolean(d))
        .sort()[0] ?? null,
    extents: states
      .filter((s) => s.state === "in_force")
      .map((s) => s.direction.extent)
      .filter((e): e is string => Boolean(e)),
    states,
  }
}

/**
 * Fold curated knowledge into a registry record.
 *
 * Additive only. Where the feed already reports a direction in force the record
 * is left alone apart from gaining the curated citation; where the feed knows
 * nothing, the curated finding fills the gap. `coverageLevel` is promoted to
 * `directions_only` and never to `boundaries`, because a curated entry has no
 * polygon — which is the honest position: we know the council restricts, we
 * cannot test whether this particular property sits inside the boundary. That
 * is the same footing as Crawley and Tower Hamlets, and it means a curated
 * council can never produce `none_found`.
 */
export function applyCuratedOverlay(
  record: CouncilRecord,
  now: Date = new Date()
): CouncilRecord {
  const entry = curatedBySlug(record.slug)
  if (!entry) return record

  const c = assessCurated(entry, now)
  if (!c.inForce && c.pending.length === 0) return record

  const pendingCount = Math.max(record.directionsNotYetInForce, c.pending.length)
  const nextDates = [record.nextCommencementDate, c.nextCommencementDate]
    .filter((d): d is string => Boolean(d))
    .sort()

  return {
    ...record,
    publishesHmoArticle4: record.publishesHmoArticle4 || c.inForce,
    hasHmoArticle4InForce: record.hasHmoArticle4InForce || c.inForce,
    directionsNotYetInForce: pendingCount,
    provisionalPastDeadline: c.needsReconfirmation[0]?.confirmBy ?? null,
    nextCommencementDate: nextDates[0] ?? null,
    coverageLevel:
      record.coverageLevel === "boundaries"
        ? "boundaries"
        : c.inForce
          ? "directions_only"
          : record.coverageLevel,
    // Cite both when both have something to say; the council's own page is the
    // stronger source and goes first.
    documentUrls: Array.from(
      new Set([...entry.directions.map((d) => d.sourceUrl), ...record.documentUrls])
    ),
    source:
      record.source && record.hasHmoArticle4InForce
        ? `${record.source} + ${ARTICLE4_SOURCE_COUNCIL_VERIFIED}`
        : ARTICLE4_SOURCE_COUNCIL_VERIFIED,
  }
}
