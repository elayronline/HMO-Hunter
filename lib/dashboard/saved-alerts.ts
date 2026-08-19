/**
 * What the dashboard shows: change that has landed on something you saved, and
 * restrictions arriving in the next six months.
 *
 * Everything here is derived from a column that exists. There is no read/unread
 * state, because nothing records one — an alert is "pressing" by virtue of its
 * date, not by whether it has been seen. Inventing a seen-flag would mean
 * inventing the fact behind it.
 */

/** Six months. The window the dashboard reports on, in both sections. */
export const SAVED_HORIZON_DAYS = 183

export type SavedAlertKind =
  | "article4_commencing"
  | "licence_recorded_expired"
  | "licence_term_ended"
  | "licence_expiring"

export interface SavedAlert {
  propertyId: string
  address: string
  postcode: string | null
  council: string | null
  kind: SavedAlertKind
  headline: string
  detail: string
  /** The date that makes this pressing. */
  date: string
  /** Negative once the date has passed. */
  daysAway: number
}

/** The saved property, as the columns that actually hold these facts. */
export interface SavedRow {
  id: string
  address: string
  postcode?: string | null
  article_4_council?: string | null
  licence_status?: string | null
  hmo_licence_expiry?: string | null
}

/** A direction with a commencement date still ahead of it. */
export interface CommencingDirection {
  council: string
  date: string
  daysAway: number
  extent: string | null
}

function daysBetween(from: Date, iso: string): number {
  return Math.round((Date.parse(iso) - from.getTime()) / 86_400_000)
}

/**
 * Ordering: what has already happened first, freshest of those at the top, then
 * what is coming, soonest first.
 *
 * Sorting on the raw day count would put a licence that lapsed three years ago
 * above one that lapsed yesterday, which is the opposite of pressing.
 */
export function urgencyRank(alert: Pick<SavedAlert, "daysAway">): [number, number] {
  return alert.daysAway < 0 ? [0, -alert.daysAway] : [1, alert.daysAway]
}

function bySeverity(a: SavedAlert, b: SavedAlert): number {
  const [aTier, aWeight] = urgencyRank(a)
  const [bTier, bWeight] = urgencyRank(b)
  return aTier !== bTier ? aTier - bTier : aWeight - bWeight
}

/**
 * Alerts for the listings someone has saved.
 *
 * The two licence states are kept apart on purpose, and it is the same
 * distinction the property cards make: `licence_status = "expired"` is the
 * council's own word, while a date that has simply run out in our copy is our
 * arithmetic and the register may say nothing of the sort. Merging them would
 * tell an owner their licence had expired on the strength of a stale date.
 */
export function savedAlerts(
  rows: readonly SavedRow[],
  commencing: readonly CommencingDirection[],
  now: Date = new Date()
): SavedAlert[] {
  const today = now.toISOString().slice(0, 10)
  const byCouncil = new Map(commencing.map((d) => [d.council, d]))
  const out: SavedAlert[] = []

  for (const row of rows) {
    const base = {
      propertyId: row.id,
      address: row.address,
      postcode: row.postcode ?? null,
      council: row.article_4_council ?? null,
    }

    const direction = row.article_4_council ? byCouncil.get(row.article_4_council) : undefined
    if (direction) {
      out.push({
        ...base,
        kind: "article4_commencing",
        headline: "Article 4 direction commences",
        detail:
          direction.extent ??
          `${direction.council} has an HMO Article 4 direction taking effect on this date.`,
        date: direction.date,
        daysAway: direction.daysAway,
      })
    }

    const expiry = row.hmo_licence_expiry
    if (row.licence_status === "expired") {
      // The register's own word. Dated by the expiry where we hold one, so the
      // reader can see how old the finding is.
      out.push({
        ...base,
        kind: "licence_recorded_expired",
        headline: "Licence recorded as expired",
        detail: "The council register records this licence as expired.",
        date: expiry ?? today,
        daysAway: expiry ? daysBetween(now, expiry) : 0,
      })
    } else if (expiry) {
      const daysAway = daysBetween(now, expiry)
      if (daysAway < 0) {
        out.push({
          ...base,
          kind: "licence_term_ended",
          headline: "Licence term has ended",
          detail:
            "Our copy of the licence term has run out. The register has not said it expired, so this is our date rather than the council's finding.",
          date: expiry,
          daysAway,
        })
      } else if (daysAway <= SAVED_HORIZON_DAYS) {
        out.push({
          ...base,
          kind: "licence_expiring",
          headline: "Licence term ends",
          detail: "The recorded licence term runs out on this date.",
          date: expiry,
          daysAway,
        })
      }
    }
  }

  return out.sort(bySeverity)
}
