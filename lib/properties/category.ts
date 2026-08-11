/**
 * What kind of opportunity a property is.
 *
 * `listing_type` was carrying two unrelated ideas at once — whether a property
 * is on the market, and whether it is an HMO asset — and it could express
 * neither properly. It labelled 227 PropertyData register records "rent" when
 * they were never rentals, and it put a licensed HMO advertised to let in the
 * same bucket as a two-bed flat.
 *
 * They are two independent axes, which is why one column could not hold them:
 * of the licensed HMOs in the data, 20 are also for sale today. A property is
 * therefore described by both a market status and a licence state, never one
 * label chosen from a list.
 *
 * Both are derived on read rather than stored. `licence_ending` is a statement
 * about today — a licence expiring on 1 March is "ending" in February and
 * "expired" in April with nothing having changed in the row. Storing that would
 * rot silently, the same way a stored Article 4 force state would; see
 * `forceStateOn` in lib/article4/registry.ts, which this deliberately mirrors.
 */

/** How long before expiry a licence counts as coming to an end. */
export const LICENCE_ENDING_WINDOW_MONTHS = 6

export type MarketStatus =
  /** Listed for purchase, with a price. */
  | "for_sale"
  /** A known HMO that is not currently for sale — the outreach case. */
  | "off_market"

export type LicenceState =
  /** Licensed, with more than the ending window left to run. */
  | "licensed"
  /** Licensed, expiring within LICENCE_ENDING_WINDOW_MONTHS. */
  | "licence_ending"
  /** Licence date has passed, or the record says expired. */
  | "licence_expired"
  /**
   * Licensed, but the register gave no expiry date. Nearly half the licensed
   * stock is in this state, and it is neither active nor ending — pretending
   * otherwise would invent a date the council never published.
   */
  | "licence_undated"
  /** No licence recorded. An HMO here is an unlicensed one. */
  | "unlicensed"

export interface PropertyCategory {
  market: MarketStatus
  licence: LicenceState
  /** Days until expiry; negative once past. Null when there is no date. */
  daysToExpiry: number | null
}

/** The fields categorisation reads. Kept narrow so tests need no fixtures. */
export interface CategorisableProperty {
  listing_type?: string | null
  purchase_price?: number | null
  licensed_hmo?: boolean | null
  hmo_licence_expiry?: string | null
  licence_status?: string | null
}

function daysBetween(from: Date, isoDate: string): number | null {
  const target = Date.parse(isoDate)
  if (Number.isNaN(target)) return null
  return Math.floor((target - from.getTime()) / 86_400_000)
}

export function categorise(
  property: CategorisableProperty,
  now: Date = new Date()
): PropertyCategory {
  const market: MarketStatus = property.listing_type === "purchase" ? "for_sale" : "off_market"

  const expiry = property.hmo_licence_expiry ?? null
  const daysToExpiry = expiry ? daysBetween(now, expiry) : null

  // An explicit "expired" beats the date, because a licence can be revoked
  // before its expiry and the status is the council's own word for it.
  if (property.licence_status === "expired") {
    return { market, licence: "licence_expired", daysToExpiry }
  }

  if (!property.licensed_hmo) {
    return { market, licence: "unlicensed", daysToExpiry }
  }

  if (daysToExpiry === null) {
    return { market, licence: "licence_undated", daysToExpiry }
  }

  if (daysToExpiry < 0) {
    return { market, licence: "licence_expired", daysToExpiry }
  }

  // ~30.44 days a month, so "6 months" lands within a day of the calendar date
  // rather than drifting by a week over the window.
  const windowDays = Math.round(LICENCE_ENDING_WINDOW_MONTHS * 30.44)
  return {
    market,
    licence: daysToExpiry <= windowDays ? "licence_ending" : "licensed",
    daysToExpiry,
  }
}

/**
 * Whether the platform serves this property at all.
 *
 * The platform sources properties to buy. That covers anything for sale, and
 * any HMO worth approaching an owner about — but not a rental listing with
 * nothing tying it to an HMO asset. Those are rental properties in the plain
 * sense, and 1,407 of them were being served as though they were opportunities.
 *
 * Licence evidence is what separates the two: a licensed HMO advertised to let
 * is still an existing HMO with an owner and a licence, which is exactly the
 * off-market case. A two-bed flat to let is not.
 */
export function isServed(property: CategorisableProperty): boolean {
  if (property.listing_type === "purchase") return true
  return Boolean(property.licensed_hmo) || property.licence_status === "expired"
}

/** Human-readable labels, so the UI and any export agree on wording. */
export const MARKET_LABELS: Record<MarketStatus, string> = {
  for_sale: "For sale",
  off_market: "Off market",
}

export const LICENCE_LABELS: Record<LicenceState, string> = {
  licensed: "Licensed",
  licence_ending: "Licence ending",
  licence_expired: "Licence expired",
  licence_undated: "Licensed, no expiry date",
  unlicensed: "No licence",
}
