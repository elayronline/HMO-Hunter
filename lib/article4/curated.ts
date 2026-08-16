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
 *  1. **It never removes a restriction.** A curated entry can turn `unknown`
 *     into a known Article 4, and it can never turn a feed positive into a
 *     negative.
 *
 *     It *can* now record a negative, which the earlier rule forbade. Cambridge
 *     is why: its own committee record asks officers only "to prepare a report
 *     on the case for and feasibility of one or more Article 4 directions", so
 *     115 properties there sat at `unknown` — indistinguishable from a council
 *     nobody had looked at — while the answer was known and could not be
 *     written down. A negative carries the same evidence as a positive (the
 *     council's own words, a verbatim quote, a source URL) and is refused
 *     wherever a direction is in force. Silence in this file still means nobody
 *     has checked; a `noHmoArticle4` block is what "checked and clear" looks
 *     like.
 *
 *  2. **It is not in the eval's prediction path.** The harness scores
 *     `buildCouncilRegistry()`, which reads the feed alone. Serving predictions
 *     from the same research the gold set is built on would measure agreement
 *     with itself and report a recall near 100% that means nothing. If you ever
 *     wire this into `predict()`, the number stops being a measurement — see
 *     tests/article4-curated.test.ts, which asserts the separation.
 *
 * Commencement dates are stored; force is derived on read, so a direction
 * commencing on a future date starts binding on that date with no job to run
 * and nothing to remember. Durham's countywide direction is the worked example:
 * recorded now, live from 17 August 2026.
 *
 * Where no date is stored, `forceState` has to say so explicitly. `forceStateOn`
 * treats a missing commencement date as in force, which is right for a boundary
 * record that only exists because a direction does, and dangerous here: it made
 * "the council publishes no commencement date" and "nobody has established
 * this" the same value, and it meant recording a *proposed* direction — which
 * by definition has no commencement date — would have asserted a live
 * restriction. Nottingham states no date anywhere on its HMO page and Hillingdon
 * says only "December 2025", so the dateless case is not rare enough to leave
 * implicit.
 */

import curatedJson from "./curated-councils.json"
import { forceStateOn, type CouncilRecord, type ForceState } from "./registry"

export const ARTICLE4_SOURCE_COUNCIL_VERIFIED = "council-verified"

/**
 * Registry's `ForceState` is derived from dates alone, so it has exactly the
 * three states dates can produce. Curated records come from prose and need two
 * more: `proposed`, which no date can express because an unmade direction has
 * no commencement, and `unknown`, for a record that states neither a date nor a
 * force and therefore establishes nothing.
 */
export type CuratedForceState = ForceState | "proposed" | "unknown"

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
  /**
   * True only where the direction covers the ENTIRE planning authority.
   *
   * Set by hand, never derived from `extent`. The prose above is written for
   * humans and reading it with a regex gets the answer backwards — "not
   * city-wide" and "Almost city-wide" both contain "city-wide", and Sheffield's
   * extent is literally "Designated Article 4 area only — not city-wide".
   * Guessing here would assert a live restriction over a whole city on the
   * strength of a substring.
   *
   * What it licenses: a curated entry has no polygon, so normally we can say the
   * council restricts but not whether THIS property sits inside the boundary.
   * Where the direction covers the whole authority that question disappears —
   * every property in the authority is inside it — so knowing a property's
   * planning authority is enough to conclude the restriction applies.
   *
   * Carve-outs that are themselves separate planning authorities do not
   * disqualify: Brighton excludes the South Downs National Park and Great
   * Yarmouth the Broads Authority executive area, but property there belongs to
   * those authorities, not these. Carve-outs WITHIN the authority do disqualify
   * — Brent excludes its Growth Areas and Salford three named wards, so neither
   * is flagged.
   */
  coversWholeAuthority?: boolean
  /**
   * Required when `commencedOn` is null; ignored when a date is present, since
   * the date is the better evidence.
   *
   * `in_force` here is a positive assertion that the council describes the
   * direction as operating while publishing no commencement date. `proposed`
   * covers a direction announced, consulted on or agreed in principle, which
   * binds nobody. A dateless direction with no `forceState` resolves to
   * `unknown` and is treated as establishing nothing — the state a half-entered
   * record should have.
   */
  forceState?: CuratedForceState
  /** The page or document the quote came from. Always the council's own. */
  sourceUrl: string
  /** Verbatim wording, so a dispute is settled against the council's words. */
  quote: string
}

/**
 * Checked, and the council has no HMO Article 4 direction.
 *
 * Held to the same standard as a positive: the council's own page, quoted. A
 * negative asserted loosely is worse than no record, because it tells someone
 * there is nothing to find.
 */
export interface CuratedNegative {
  /** When the council's page was read. */
  checkedOn: string
  sourceUrl: string
  /** Verbatim wording establishing that no direction restricts HMOs today. */
  quote: string
  /**
   * Anything coming that does not bind yet. A council with no direction today
   * and one out to consultation is a different prospect from one with no
   * interest, and a buyer wants to know which they are looking at.
   */
  note?: string
}

export interface CuratedCouncil {
  slug: string
  name: string
  gssCode: string | null
  directions: CuratedDirection[]
  /**
   * Present only where `directions` holds nothing in force. Both at once is a
   * contradiction rather than a nuance, so the reader below refuses it and
   * tests/article4-negatives.test.ts fails the file.
   */
  noHmoArticle4?: CuratedNegative
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
  states: { direction: CuratedDirection; state: CuratedForceState }[]
}

/**
 * What a single curated direction amounts to on a given date.
 *
 * Precedence, and the reasoning for it:
 *
 *  1. `proposed` wins outright. A direction announced or agreed in principle
 *     binds nobody, and a date attached to one is a target rather than a
 *     commencement — reading it as a date would turn an intention into a
 *     restriction.
 *  2. A stored `commencedOn` decides everything else, so a direction goes live
 *     on its own date with nothing to run.
 *  3. With no date, `forceState` must say so explicitly.
 *  4. Otherwise `unknown` — establishing nothing, which is what a record
 *     nobody finished should do.
 */
export function directionForceState(
  direction: CuratedDirection,
  now: Date = new Date()
): CuratedForceState {
  if (direction.forceState === "proposed") return "proposed"
  if (direction.commencedOn) {
    return forceStateOn(direction.commencedOn, direction.endedOn, now)
  }
  if (direction.endedOn && direction.endedOn < now.toISOString().slice(0, 10)) {
    return "expired"
  }
  return direction.forceState ?? "unknown"
}

/**
 * The council's confirmed "no HMO Article 4 here", or null.
 *
 * Refused where any direction is in force. A file holding both is contradicting
 * itself, and the restriction is the answer that keeps someone safe.
 */
export function curatedNegativeFor(
  slugOrName: string,
  now: Date = new Date()
): CuratedNegative | null {
  const council = curatedBySlug(slugOrName) ?? curatedByCouncilName(slugOrName)
  if (!council?.noHmoArticle4) return null

  const anyInForce = council.directions.some(
    (d) => directionForceState(d, now) === "in_force"
  )
  if (anyInForce) return null

  return council.noHmoArticle4
}

/**
 * Match a planning authority name to a curated slug.
 *
 * The LPA name arrives from the boundary lookup in whatever form that service
 * uses — "Bristol, City of", "Kingston upon Hull, City of", "Newcastle upon
 * Tyne" — while the slugs here are the plain kebab-case name. Comparing the two
 * directly silently drops exactly the councils most likely to have a direction,
 * so the statutory decorations come off both sides first.
 */
function normaliseForSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/,?\s*(city|borough|district|county)\s+of\b/g, "")
    .replace(/\b(city|borough|district|county|metropolitan|royal)\s+council\b/g, "")
    .replace(/\bcouncil\b/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function curatedByCouncilName(name: string): CuratedCouncil | null {
  const target = normaliseForSlug(name)
  if (!target) return null
  return (
    curated.councils.find(
      (c) => c.slug === target || normaliseForSlug(c.name) === target
    ) ?? null
  )
}

/**
 * The whole-authority direction in force for a council on a given date, or null.
 *
 * This is the only curated finding strong enough to conclude something about an
 * individual property. Everything else in this file establishes that a council
 * restricts somewhere; without a polygon that cannot decide a point, and the
 * honest answer stays `unknown`.
 *
 * Date-aware on purpose, and Durham is why: its countywide direction was
 * recorded well before it commenced on 17 August 2026, so asking this question
 * on 16 August returns null and on 17 August returns the direction, with nothing
 * to run and nothing to remember.
 */
export function wholeAuthorityDirectionInForce(
  slugOrName: string,
  now: Date = new Date()
): CuratedDirection | null {
  const council = curatedBySlug(slugOrName) ?? curatedByCouncilName(slugOrName)
  if (!council) return null

  for (const direction of council.directions) {
    if (!direction.coversWholeAuthority) continue
    if (directionForceState(direction, now) === "in_force") {
      return direction
    }
  }
  return null
}

/** What the curated record says about a council on a given date. */
export function assessCurated(council: CuratedCouncil, now: Date = new Date()): CuratedAssessment {
  const states = council.directions.map((direction) => ({
    direction,
    state: directionForceState(direction, now),
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
