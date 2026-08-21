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
  /**
   * An existing HMO the owner currently has advertised to let.
   *
   * This is not inventory — the platform does not offer it to rent, and it must
   * never be presented as something to take a tenancy on. It is evidence: the
   * property is an operating HMO, the owner is active and reachable, and the
   * advertised rent is a real figure for what the rooms achieve. That makes it
   * a property of interest to a buyer, which a plain rental listing is not.
   */
  | "let_listed"
  /** A known HMO with no live advertisement — the cold outreach case. */
  | "off_market"
  /**
   * A commercial building for sale that could become an HMO.
   *
   * A category of its own because nothing else about it reads like the rest of
   * the stock: it has no bedrooms, no rent, no licence and no HMO history, and
   * what makes it an opportunity is a planning route rather than a property.
   * Shown as for-sale stock it would look like a bad deal on every metric the
   * platform computes; shown as its own kind of thing, it is judged on whether
   * the route survives — see lib/properties/conversion.ts.
   */
  | "commercial_conversion"

export type LicenceState =
  /** Licensed, with more than the ending window left to run. */
  | "licensed"
  /** Licensed, expiring within LICENCE_ENDING_WINDOW_MONTHS. */
  | "licence_ending"
  /** The register itself says expired. The council's own word for it. */
  | "licence_expired"
  /**
   * The licence term we hold has run out, and the register has not said so.
   *
   * 83 of the 98 properties this platform called "licence expired" carried
   * licence_status "active" from the register — we were contradicting our own
   * source field, on a date a median of 0.7 years old, with no record of when
   * the register was last read. A term that has run out in our copy is a reason
   * to check the register; it is not a finding that the property is unlicensed,
   * and it is certainly not an enforcement risk we can assert to an owner.
   */
  | "licence_term_ended"
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

/**
 * Article 4 has three states and only one of them is a verified negative.
 * Anything reading it as a boolean turns "unknown" into "clear".
 */
export interface Article4Position {
  /** @deprecated Mirrors `article_4_status === "in_force"`. Never read a negative. */
  article_4_area?: boolean | null
  article_4_status?: "in_force" | "none_found" | "unknown" | null
}

/** The fields categorisation reads. Kept narrow so tests need no fixtures. */
export interface CategorisableProperty {
  listing_type?: string | null
  property_type?: string | null
  purchase_price?: number | null
  price_pcm?: number | null
  source_name?: string | null
  licensed_hmo?: boolean | null
  hmo_licence_expiry?: string | null
  licence_status?: string | null
}

/**
 * Which licence columns may be read, and which must never be.
 *
 * The table holds two apparent licence terms and two apparent references, and
 * only one pair was ever published by anybody:
 *
 *   hmo_licence_expiry     313 rows, 255 distinct values   OBSERVED
 *   hmo_licence_reference  335 rows, 314 distinct values   OBSERVED
 *                          e.g. 24/02862/HMOMAN, 2023/01386/HMO/PS, HAC-117637-1
 *
 *   licence_end_date       252 rows,   6 distinct values   FABRICATED
 *   licence_start_date     252 rows,   6 distinct values   FABRICATED
 *   licence_id             252 rows, 100% XXX-HMO-<md5>    FABRICATED
 *   max_occupants          252 rows, 100% bedrooms + 1     FABRICATED
 *
 * The second group was written by scripts/DO_NOT_RUN_012_populate_licence_term_data.sql,
 * which stamps one hardcoded start/end pair per city onto every licensed row
 * in it — "licence terms are typically 5 years, with staggered start dates" —
 * synthesises the reference from MD5(address), and sets occupancy by formula.
 * Six distinct end dates across 252 properties is the tell: real licences do
 * not expire on six days.
 *
 * A card that reads the second group prints "Licence BRS-HMO-a43039 · expired
 * Jun 2025 · 6 occupants" — a reference, a date and an occupancy figure, none
 * of which any council published, rendered in the same line as ones that were.
 * See CLAUDE.md: absent is a legitimate answer, a plausible placeholder is not.
 *
 * So there is one licence date on this platform and these return it. The rows
 * still carry the seeded columns; nothing may read them.
 */
export interface LicenceEvidence {
  hmo_licence_expiry?: string | null
  hmo_licence_reference?: string | null
}

/** The published expiry date, or null. Never the seeded licence_end_date. */
export function licenceExpiry(property: LicenceEvidence): string | null {
  return property.hmo_licence_expiry ?? null
}

/** The category tabs on the map and list, and the rows an export must contain. */
export type Segment = "all" | "licensed" | "expired" | "conversion" | "restricted"

/**
 * Whether a property belongs under a segment tab.
 *
 * Shared rather than reimplemented because the export used to answer this
 * question — and every other filter question — with its own SQL, and so
 * returned a different set from the one on screen. An export that disagrees
 * with the page it was taken from is worse than no export.
 */
export function inSegment(
  property: CategorisableProperty & Article4Position,
  segment: Segment,
  now: Date = new Date()
): boolean {
  switch (segment) {
    case "all":
      return true
    case "licensed":
    case "expired": {
      if (!property.licensed_hmo && property.licence_status !== "expired") return false
      const licence = categorise(property, now).licence
      const expired =
        licence === "licence_expired" || licence === "licence_term_ended"
      return segment === "expired" ? expired : !expired
    }
    case "conversion":
      return sourcingCategory(property) === "change_of_use"
    case "restricted":
      // article_4_area is deprecated and its own doc says never to filter a
      // negative on it: the national feed covers a minority of councils, so a
      // false there has always meant "not found in a feed that does not look
      // here". Reading the status keeps "we have not established this" out of
      // the answer entirely, rather than counting it as "no restriction".
      return property.article_4_status === "in_force"
  }
}

/** The council's own reference, or null. Never the seeded licence_id. */
export function licenceReference(property: LicenceEvidence): string | null {
  return property.hmo_licence_reference ?? null
}

/**
 * Sources that publish live advertisements. A row from one of these with a
 * rental listing type really is on the market to let today.
 *
 * The register sources — PropertyData HMO, Searchland — also store rows as
 * "rent", but those are licence records rather than advertisements, and
 * describing them as "on the market to let" would assert something nobody
 * published. Anything unrecognised falls through to off_market for the same
 * reason: the weaker claim is the safe one.
 */
const LISTING_PORTALS = new Set(["zoopla", "rightmove", "onthemarket"])

/**
 * Commercial stock, which is judged on a planning route rather than on the
 * property. Kept as a type check rather than a guess from bedroom count,
 * because a house with no bedrooms recorded is a gap in the data, not a shop.
 */
const COMMERCIAL_TYPES = new Set(["commercial", "office", "retail", "class e"])

function isCommercial(property: CategorisableProperty): boolean {
  const type = property.property_type?.trim().toLowerCase()
  return type ? COMMERCIAL_TYPES.has(type) : false
}

function isLiveAdvertisement(property: CategorisableProperty): boolean {
  const source = property.source_name?.trim().toLowerCase()
  return source ? LISTING_PORTALS.has(source) : false
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
  const market: MarketStatus =
    property.listing_type === "purchase" && isCommercial(property)
      ? "commercial_conversion"
      : property.listing_type === "purchase"
      ? "for_sale"
      : isLiveAdvertisement(property)
        ? "let_listed"
        : "off_market"

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
    // Not "expired" — the register did not say that. Only the term we hold has
    // run out, which may mean it was renewed and we have not read it since.
    return { market, licence: "licence_term_ended", daysToExpiry }
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
  // Commercial stock for sale is served on the same footing as any other
  // purchase: it is something you can buy. What differs is how it is judged.
  if (property.listing_type === "purchase") return true
  return Boolean(property.licensed_hmo) || property.licence_status === "expired"
}

/**
 * Whether the advertised rent may be shown, and what it means.
 *
 * On a let_listed HMO the rent is achieved income on an operating property —
 * worth showing a buyer, as evidence. It is never the property's price, and no
 * view should offer it as one; the price of one of these is whatever the owner
 * would accept, which is the point of making contact.
 */
export function rentIsEvidence(property: CategorisableProperty, now: Date = new Date()): boolean {
  return categorise(property, now).market === "let_listed" && property.price_pcm != null
}

/** Human-readable labels, so the UI and any export agree on wording. */
export const MARKET_LABELS: Record<MarketStatus, string> = {
  for_sale: "For sale",
  // Deliberately describes the owner's action, not an offer to the reader. "To
  // let" would read as an invitation to rent it; this is a buyer's signal that
  // the HMO is operating and the owner is active.
  let_listed: "Existing HMO · owner letting",
  off_market: "Off market",
  commercial_conversion: "Commercial · conversion opportunity",
}

export const LICENCE_LABELS: Record<LicenceState, string> = {
  licensed: "Licensed",
  licence_ending: "Licence ending",
  licence_expired: "Licence expired",
  licence_term_ended: "Licence term ended, not confirmed",
  licence_undated: "Licensed, no expiry date",
  unlicensed: "No licence",
}

/**
 * What kind of sourcing job a property represents.
 *
 * The two axes above describe a property accurately but they do not answer the
 * question a sourcer actually starts from, which is "what am I looking at and
 * what would I have to do about it". Three answers cover the whole served set,
 * and they need different work: an existing HMO nobody is selling means finding
 * the owner; one that is listed means moving on a live opportunity; anything
 * else means testing whether a planning route exists at all.
 *
 * This replaces the old "Opportunities" bucket on the map, which matched 1,189
 * of 1,193 properties and so told a user nothing.
 */
export type SourcingCategory =
  /** An existing HMO with licence evidence, not listed for sale. */
  | "existing_off_market"
  /** An existing HMO listed for purchase. */
  | "for_sale_hmo"
  /** No HMO use today — the opportunity is a change of use. */
  | "change_of_use"

export const SOURCING_LABELS: Record<SourcingCategory, string> = {
  existing_off_market: "Existing off-market HMOs",
  for_sale_hmo: "HMOs listed for sale",
  change_of_use: "Potential change of use",
}

export const SOURCING_DESCRIPTIONS: Record<SourcingCategory, string> = {
  existing_off_market:
    "Operating or recently licensed HMOs with no live sale listing. The approach is to the owner, so the work is tracing them.",
  for_sale_hmo:
    "Existing HMOs on the market to buy. Already in HMO use, so the planning question is whether that use is lawful and continuing.",
  change_of_use:
    "Houses and commercial buildings with no HMO use today. Whether these are opportunities at all turns on the planning route — see the conversion assessment.",
}

/**
 * Licence evidence is what makes something an existing HMO rather than a
 * candidate. An expired or undated licence still counts: the building was in
 * HMO use, which is the fact a change-of-use question turns on.
 */
function hasHmoUse(property: CategorisableProperty): boolean {
  return Boolean(property.licensed_hmo) || property.licence_status === "expired"
}

export function sourcingCategory(property: CategorisableProperty): SourcingCategory {
  if (!hasHmoUse(property)) return "change_of_use"
  return property.listing_type === "purchase" ? "for_sale_hmo" : "existing_off_market"
}

/**
 * The price options, taken value-for-value from Rightmove's for-sale price
 * dropdowns (read from the live filter on 2026-08-21).
 *
 * What this replaces: a two-handle slider running 50,000 to 2,000,000 in flat
 * 10,000 steps. Neither bound was ever chosen. `useState([50000, 2000000])`
 * arrived in ee53e17 on 12 February with the original page scaffold and
 * survived three reworks untouched; the only deliberate act taken on it was
 * 1f10de2 making the top stop mean "no upper limit", because read literally it
 * "excluded 330 properties on a ceiling the user never chose".
 *
 * That left the number disarmed as a filter but still governing the scale, and
 * as a ruler it was wrong in both directions. Measured against the served set
 * on 2026-08-21: 1,160 properties, cheapest 399,995, median 1,200,000, dearest
 * 1,995,000, none below 50,000 and none above 2,000,000. So the bottom 17.9% of
 * the track selected nothing at all, while 64% of priced stock was crammed into
 * the top half.
 *
 * A ladder fixes what a linear track cannot. The steps are 10,000 up to
 * 300,000, 25,000 to 500,000, 50,000 to 1m and 250,000 above it — fine where
 * HMO stock is bought, coarse where it is not — and it carries no ceiling: the
 * top entry is 20,000,000 and "no maximum" is a first-class choice rather than
 * a stop that silently means something else.
 *
 * Rightmove's ladder skips 750,000 (700,000 then 800,000). That is copied
 * rather than corrected: like-for-like with the control every UK buyer already
 * knows is the point, and inventing a rung would break the correspondence.
 */
export const PRICE_LADDER: readonly number[] = [
  50_000, 60_000, 70_000, 80_000, 90_000,
  100_000, 110_000, 120_000, 125_000, 130_000, 140_000, 150_000, 160_000,
  170_000, 175_000, 180_000, 190_000,
  200_000, 210_000, 220_000, 230_000, 240_000, 250_000, 260_000, 270_000,
  280_000, 290_000,
  300_000, 325_000, 350_000, 375_000, 400_000, 425_000, 450_000, 475_000,
  500_000, 550_000, 600_000, 650_000, 700_000, 800_000, 900_000,
  1_000_000, 1_250_000, 1_500_000, 1_750_000, 2_000_000, 2_500_000, 3_000_000,
  4_000_000, 5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000,
]

/**
 * A price bound that is not set. `null` means "no minimum" / "no maximum" and
 * is what both ends rest at, so an untouched control sends no price condition
 * at all. The old slider had no way to say this: its max meant no-limit by a
 * special case in the query, and its min never got the matching case, so every
 * query carried `purchase_price >= 50000` whether or not the user had asked
 * for it.
 */
export const PRICE_ANY = null

/**
 * The old slider's rest position, kept for one purpose: a saved search recorded
 * before 2026-08-21 stores `priceRange: [50000, 2000000]` for "I set no price",
 * and loading that pair literally would apply a floor and a ceiling the user
 * never chose. Read on load, never written. Delete once no stored search holds
 * the pair (one did on 2026-08-21, "newcastle").
 */
export const LEGACY_SLIDER_MIN = 50_000
export const LEGACY_SLIDER_MAX = 2_000_000

/**
 * Reads a saved search's stored `priceRange` into the [min, max] pair the panel
 * now holds, where `null` means no limit.
 *
 * A search saved under the slider recorded two numbers always, because the
 * slider could not express an absent bound — so `[50000, 2000000]` is not a
 * £50k–£2m band, it is the untouched control. Restoring it literally would
 * apply a floor and a ceiling the person saving it never asked for, and the
 * ceiling would hide anything above £2m the moment such a row exists.
 *
 * Only the exact resting pair is treated this way. `[50000, 800000]` records a
 * real maximum and keeps it; `[300000, 2000000]` records a real minimum and
 * loses only the ceiling.
 */
export function migrateSavedPriceRange(
  stored: readonly (number | null)[] | undefined
): [number | null, number | null] {
  if (!stored || stored.length < 2) return [null, null]
  const [min, max] = stored
  return [
    min === LEGACY_SLIDER_MIN || min === null || min === undefined ? null : min,
    max === LEGACY_SLIDER_MAX || max === null || max === undefined ? null : max,
  ]
}

/** "£1,250,000" — the ladder's own labelling, shared by the panel and its tests. */
export function formatPriceOption(value: number): string {
  return `£${value.toLocaleString("en-GB")}`
}
