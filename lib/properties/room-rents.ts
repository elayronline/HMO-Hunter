/**
 * Indicative per-room HMO rents by city.
 *
 * This is a reference table of market averages, not a measurement of any
 * particular property, and everything that reads it is required to say so. It
 * lives here rather than inside the enrichment route because the report has to
 * describe the number in the same terms the enrichment produced it — when those
 * two drifted apart, the report described a national fallback as "the average
 * for this city".
 */

/**
 * UK HMO Room Rental Data (2024/2025 Market Rates)
 * Source: SpareRoom, Rightmove, Zoopla market data
 *
 * These are per-room monthly rents for HMO properties
 */
export const CITY_ROOM_RENTS: Record<string, { min: number; max: number; avg: number }> = {
  // London - highest rents, varies significantly by zone
  "London": { min: 650, max: 1100, avg: 825 },

  // South England
  "Bristol": { min: 550, max: 800, avg: 675 },
  "Brighton": { min: 600, max: 900, avg: 750 },
  "Oxford": { min: 650, max: 950, avg: 800 },
  "Cambridge": { min: 650, max: 950, avg: 800 },
  "Southampton": { min: 500, max: 700, avg: 600 },
  "Portsmouth": { min: 475, max: 675, avg: 575 },
  "Reading": { min: 575, max: 825, avg: 700 },

  // Midlands
  "Birmingham": { min: 475, max: 700, avg: 575 },
  "Coventry": { min: 450, max: 650, avg: 550 },
  "Leicester": { min: 425, max: 625, avg: 525 },
  "Nottingham": { min: 450, max: 650, avg: 550 },
  "Derby": { min: 400, max: 575, avg: 475 },

  // North England
  "Manchester": { min: 525, max: 775, avg: 650 },
  "Liverpool": { min: 425, max: 600, avg: 500 },
  "Leeds": { min: 475, max: 675, avg: 575 },
  "Sheffield": { min: 425, max: 600, avg: 500 },
  "Newcastle": { min: 400, max: 575, avg: 475 },
  "York": { min: 525, max: 750, avg: 625 },
  "Bradford": { min: 375, max: 525, avg: 450 },
  "Hull": { min: 350, max: 500, avg: 425 },

  // Scotland
  "Edinburgh": { min: 575, max: 850, avg: 700 },
  "Glasgow": { min: 475, max: 675, avg: 575 },
  "Aberdeen": { min: 450, max: 650, avg: 550 },
  "Dundee": { min: 400, max: 575, avg: 475 },

  // Wales
  "Cardiff": { min: 475, max: 675, avg: 575 },
  "Swansea": { min: 400, max: 575, avg: 475 },

  // Default for unlisted cities
  "_default": { min: 425, max: 625, avg: 525 },
}

/**
 * Councils whose name is not the city name this table is keyed on.
 *
 * The planning authority is the more reliable of the two identifiers we hold —
 * it was resolved from the property's own coordinates — but it carries
 * statutory decoration the table does not.
 */
const COUNCIL_TO_CITY: Record<string, string> = {
  "Bristol, City of": "Bristol",
  "Brighton and Hove": "Brighton",
  "Newcastle upon Tyne": "Newcastle",
  "Kingston upon Hull, City of": "Hull",
  "City of Edinburgh": "Edinburgh",
}

/** Where an indicative rent came from, so a reader can weigh it. */
export type RentBasis = "city" | "national"

export interface RoomRent {
  rate: number
  /**
   * The bottom and top of the published band for this city, carried alongside
   * the average so a caller can place an *observed* rent within it rather than
   * against a threshold invented at the call site. Same source as `rate`.
   */
  min: number
  max: number
  basis: RentBasis
  /** The city the rate was matched on, where one was. */
  city: string | null
  /**
   * Which identifier produced the match. The rate is a city average either way
   * — this says how the city was established, not how good the number is.
   */
  matchedOn?: "city" | "council"
}

/**
 * The indicative room rent for a property, and how specific it actually is.
 *
 * A recognised city gets its own average. Everything else gets a single national
 * figure — which is a legitimate starting point, but it is not "the average for
 * this city", and the difference matters to someone deciding how much weight to
 * put on it.
 *
 * WHY THE COUNCIL IS CONSULTED
 *
 * `city` on a property is whatever the listing supplied, and for most of the
 * estate that is a county: "West Yorkshire" for Leeds, "Oxfordshire" for Oxford,
 * "Berkshire" for Reading, "South Yorkshire" for Sheffield. None of those is a
 * key in this table, so 1,306 properties took the national figure while the
 * table already held an average for the city they are actually in. That was not
 * a gap in coverage, it was a lookup asking the wrong question — and it made the
 * weakest number in the product look like the commonest answer.
 *
 * The planning authority is the better identifier, because it was resolved from
 * the property's own coordinates rather than typed into a listing. It is
 * consulted second so that a city name that does match is never overridden, and
 * because Scottish and Welsh properties have no planning authority resolved but
 * do carry a usable city.
 *
 * Nothing here changes a rate. The averages are the same figures they always
 * were; they are simply found now.
 */
export function roomRent(
  city: string | null | undefined,
  council?: string | null
): RoomRent {
  const byCity = city ? CITY_ROOM_RENTS[city] : undefined
  if (byCity) {
    return { rate: byCity.avg, min: byCity.min, max: byCity.max, basis: "city", city: city as string, matchedOn: "city" }
  }

  const cityFromCouncil = council
    ? CITY_ROOM_RENTS[council]
      ? council
      : COUNCIL_TO_CITY[council]
    : undefined

  if (cityFromCouncil && CITY_ROOM_RENTS[cityFromCouncil]) {
    return {
      rate: CITY_ROOM_RENTS[cityFromCouncil].avg,
      min: CITY_ROOM_RENTS[cityFromCouncil].min,
      max: CITY_ROOM_RENTS[cityFromCouncil].max,
      basis: "city",
      city: cityFromCouncil,
      matchedOn: "council",
    }
  }

  return {
    rate: CITY_ROOM_RENTS["_default"].avg,
    min: CITY_ROOM_RENTS["_default"].min,
    max: CITY_ROOM_RENTS["_default"].max,
    basis: "national",
    city: null,
  }
}
