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

/** Where an indicative rent came from, so a reader can weigh it. */
export type RentBasis = "city" | "national"

export interface RoomRent {
  rate: number
  basis: RentBasis
  /** The city the rate was matched on, where one was. */
  city: string | null
}

/**
 * The indicative room rent for a city, and how specific it actually is.
 *
 * A recognised city gets its own average. Everything else gets a single national
 * figure — which is a legitimate starting point, but it is not "the average for
 * this city", and the difference matters to someone deciding how much weight to
 * put on it. Most of the estate falls into the second case, so quietly
 * presenting the two the same way would overstate the majority of reports.
 */
export function roomRent(city: string | null | undefined): RoomRent {
  const matched = city ? CITY_ROOM_RENTS[city] : undefined
  if (matched) return { rate: matched.avg, basis: "city", city: city as string }
  return { rate: CITY_ROOM_RENTS["_default"].avg, basis: "national", city: null }
}
