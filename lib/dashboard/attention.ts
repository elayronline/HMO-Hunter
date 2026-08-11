/**
 * What needs attention today.
 *
 * A dashboard that repeats what the map already shows is a worse map. The
 * question a landing page is well placed to answer is "what changed, and what is
 * running out" — and this product knows two things about that which a portal
 * cannot:
 *
 *  1. Restrictions that arrive on a known date. Durham's countywide Article 4
 *     commences on 17 August 2026 and changes the answer for every unrestricted
 *     property in the county. Nobody logging in would otherwise know.
 *
 *  2. Licences that run out. An expiring licence is a seller with a deadline; an
 *     expired one is an owner with an enforcement problem. Both are openings,
 *     and both decay whether or not anyone looks.
 *
 * Counts are deliberately not the unit here. "13 licences ending" is not
 * actionable; thirteen addresses with days remaining are. Where a count is
 * shown it is a subheading on a real list, never the headline.
 */

import { curatedCouncils, assessCurated, type CuratedDirection } from "@/lib/article4/curated"

/** How far ahead a dated change is worth showing. */
export const HORIZON_DAYS = 240

export interface DatedChange {
  /** ISO date the change takes effect. */
  date: string
  daysAway: number
  council: string
  headline: string
  detail: string
  kind: "commences" | "confirmation_deadline"
  sourceUrl: string | null
}

export interface ExpiringLicence {
  id: string
  address: string
  postcode: string | null
  council: string | null
  expiry: string
  daysRemaining: number
  /** Negative days are past. Kept separate because the conversation differs. */
  expired: boolean
}

export interface CoverageGap {
  label: string
  count: number
  total: number
  note: string
}

export interface AttentionBoard {
  datedChanges: DatedChange[]
  expiringSoon: ExpiringLicence[]
  expired: ExpiringLicence[]
  coverage: CoverageGap[]
  generatedAt: string
}

function daysBetween(from: Date, iso: string): number {
  return Math.round((Date.parse(iso) - from.getTime()) / 86_400_000)
}

/**
 * Restrictions with a date on them, from the curated overlay.
 *
 * Both kinds matter and they are not the same event. A direction that commences
 * starts binding on its date. An immediate direction that is not confirmed by
 * its deadline stops binding — the opposite change, and easy to miss because
 * nothing happens on the day it lapses.
 */
export function datedChanges(now: Date = new Date()): DatedChange[] {
  const today = now.toISOString().slice(0, 10)
  const out: DatedChange[] = []

  for (const council of curatedCouncils()) {
    const assessed = assessCurated(council, now)

    for (const direction of assessed.pending) {
      if (!direction.commencedOn || direction.commencedOn <= today) continue
      const daysAway = daysBetween(now, direction.commencedOn)
      if (daysAway > HORIZON_DAYS) continue
      out.push({
        date: direction.commencedOn,
        daysAway,
        council: council.name,
        headline: `Article 4 direction commences in ${council.name}`,
        detail:
          direction.extent ??
          "A new HMO Article 4 direction takes effect on this date.",
        kind: "commences",
        sourceUrl: direction.sourceUrl,
      })
    }

    for (const direction of council.directions as CuratedDirection[]) {
      if (!direction.confirmBy || direction.confirmedOn) continue
      const daysAway = daysBetween(now, direction.confirmBy)
      if (daysAway < 0 || daysAway > HORIZON_DAYS) continue
      out.push({
        date: direction.confirmBy,
        daysAway,
        council: council.name,
        headline: `${council.name}'s immediate direction must be confirmed`,
        detail:
          "An immediate Article 4 direction ceases to have effect unless the council confirms it by this date. If it lapses, the restriction disappears without an announcement.",
        kind: "confirmation_deadline",
        sourceUrl: direction.sourceUrl,
      })
    }
  }

  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Licences by how close they are to running out.
 *
 * Split rather than ranked, because the two lists are different conversations.
 * A licence with weeks left is a renewal the owner is already thinking about; an
 * expired one is a problem they may not know they have.
 */
export function splitByExpiry(
  rows: { id: string; address: string; postcode?: string | null; article_4_council?: string | null; hmo_licence_expiry: string }[],
  now: Date = new Date()
): { expiringSoon: ExpiringLicence[]; expired: ExpiringLicence[] } {
  const expiringSoon: ExpiringLicence[] = []
  const expired: ExpiringLicence[] = []

  for (const row of rows) {
    const daysRemaining = daysBetween(now, row.hmo_licence_expiry)
    const entry: ExpiringLicence = {
      id: row.id,
      address: row.address,
      postcode: row.postcode ?? null,
      council: row.article_4_council ?? null,
      expiry: row.hmo_licence_expiry,
      daysRemaining,
      expired: daysRemaining < 0,
    }
    if (daysRemaining < 0) expired.push(entry)
    else expiringSoon.push(entry)
  }

  // Soonest first in both, which for the expired list means most recent.
  expiringSoon.sort((a, b) => a.daysRemaining - b.daysRemaining)
  expired.sort((a, b) => b.daysRemaining - a.daysRemaining)
  return { expiringSoon, expired }
}

/**
 * Where the data is thin, phrased as caution rather than as a metric.
 *
 * This is shown to users rather than kept internal, because a sourcer deciding
 * how much weight to put on a report deserves to know that 90% of the estate has
 * an unestablished planning position. Hiding it would make the product look more
 * certain than it is, which is the failure everything else here is built to
 * avoid.
 */
export function coverageGaps(counts: {
  total: number
  article4Unknown: number
  noEpc: number
  noFloorPlan: number
  noOwner: number
}): CoverageGap[] {
  return [
    {
      label: "Article 4 position unestablished",
      count: counts.article4Unknown,
      total: counts.total,
      note: "These councils do not publish to the national dataset and we have not verified them by hand. Treat their planning position as unchecked, not clear.",
    },
    {
      label: "No EPC rating",
      count: counts.noEpc,
      total: counts.total,
      note: "Without one, the cost of bringing a property up to a lettable standard cannot be estimated.",
    },
    {
      label: "No floor plan",
      count: counts.noFloorPlan,
      total: counts.total,
      note: "Any room count for these is an assumption rather than a measurement.",
    },
    {
      label: "No owner identified",
      count: counts.noOwner,
      total: counts.total,
      note: "Off-market approaches need a name. These are not yet contactable.",
    },
  ].filter((gap) => gap.count > 0)
}
