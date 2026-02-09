/**
 * Local Housing Allowance (LHA) Rates
 *
 * Published by the Valuation Office Agency (VOA).
 * Rates are weekly amounts per Broad Rental Market Area (BRMA) and bedroom count.
 * Updated annually in April. These are the 2024-25 rates.
 *
 * Source: https://www.gov.uk/government/publications/local-housing-allowance-lha-rates-applicable-from-april-2024
 */

export const RATES_EFFECTIVE_DATE = "2024-04-01"

export type LHARate = {
  brma: string
  rates: {
    shared: number    // Weekly rate for shared accommodation (room only)
    one_bed: number   // Weekly rate for 1 bedroom
    two_bed: number   // Weekly rate for 2 bedrooms
    three_bed: number // Weekly rate for 3 bedrooms
    four_bed: number  // Weekly rate for 4+ bedrooms
  }
}

/**
 * Map cities to their primary Broad Rental Market Area (BRMA).
 * London is special — mapped by postcode prefix for accuracy.
 */
export const CITY_TO_BRMA: Record<string, string> = {
  // England
  "London": "Inner South East London", // Default for London; refined by postcode
  "Manchester": "Greater Manchester South",
  "Birmingham": "Birmingham",
  "Leeds": "Leeds",
  "Liverpool": "Liverpool",
  "Newcastle": "Tyneside",
  "Sheffield": "Sheffield",
  "Bristol": "Bristol",
  "Nottingham": "Nottingham",
  "Leicester": "Leicester",
  "Coventry": "Coventry",
  "Bradford": "Bradford",
  "Southampton": "Southampton",
  "Portsmouth": "Portsmouth",
  "Plymouth": "Plymouth",
  "Reading": "Reading",
  "Oxford": "Oxford",
  "Cambridge": "Cambridge",
  "Brighton": "Brighton and Hove",
  "York": "York",
  // Scotland (Scotland has its own LHA system but uses same BRMA structure)
  "Edinburgh": "Lothian",
  "Glasgow": "Glasgow",
  "Aberdeen": "Aberdeen and Shire",
  "Dundee": "Dundee and Angus",
  // Wales
  "Cardiff": "Cardiff",
  "Swansea": "Swansea",
  "Newport": "Newport (Gwent)",
  // Northern Ireland (uses LHA equivalent)
  "Belfast": "Belfast",
  "Derry": "North West (NI)",
  "Lisburn": "Belfast",
  "Newry": "South (NI)",
}

/**
 * London postcode prefix to BRMA mapping for more accurate rates.
 */
export const LONDON_POSTCODE_TO_BRMA: Record<string, string> = {
  "EC": "Central London",
  "WC": "Central London",
  "W": "Inner West London",
  "SW": "Inner South West London",
  "SE": "Inner South East London",
  "E": "Inner East London",
  "N": "Inner North London",
  "NW": "Inner North London",
  // Outer London
  "HA": "Outer North London",
  "UB": "Outer West London",
  "TW": "Outer South West London",
  "KT": "Outer South West London",
  "CR": "Outer South London",
  "BR": "Outer South East London",
  "DA": "Outer South East London",
  "RM": "Outer North East London",
  "IG": "Outer North East London",
  "EN": "Outer North London",
}

/**
 * LHA rates by BRMA. Weekly rates in GBP.
 * 2024-25 rates from VOA publication.
 */
export const LHA_RATES: Record<string, LHARate> = {
  // London BRMAs
  "Central London": {
    brma: "Central London",
    rates: { shared: 176.34, one_bed: 332.25, two_bed: 412.33, three_bed: 492.44, four_bed: 632.56 },
  },
  "Inner West London": {
    brma: "Inner West London",
    rates: { shared: 156.00, one_bed: 295.89, two_bed: 369.86, three_bed: 449.97, four_bed: 575.34 },
  },
  "Inner South West London": {
    brma: "Inner South West London",
    rates: { shared: 136.93, one_bed: 265.78, two_bed: 330.00, three_bed: 400.00, four_bed: 517.81 },
  },
  "Inner South East London": {
    brma: "Inner South East London",
    rates: { shared: 117.19, one_bed: 230.14, two_bed: 290.96, three_bed: 350.00, four_bed: 449.59 },
  },
  "Inner East London": {
    brma: "Inner East London",
    rates: { shared: 117.19, one_bed: 241.64, two_bed: 310.96, three_bed: 370.00, four_bed: 460.27 },
  },
  "Inner North London": {
    brma: "Inner North London",
    rates: { shared: 131.23, one_bed: 260.27, two_bed: 330.00, three_bed: 400.00, four_bed: 517.81 },
  },
  "Outer North London": {
    brma: "Outer North London",
    rates: { shared: 103.56, one_bed: 195.62, two_bed: 253.15, three_bed: 310.96, four_bed: 391.23 },
  },
  "Outer West London": {
    brma: "Outer West London",
    rates: { shared: 103.56, one_bed: 207.12, two_bed: 265.78, three_bed: 330.00, four_bed: 412.33 },
  },
  "Outer South West London": {
    brma: "Outer South West London",
    rates: { shared: 109.32, one_bed: 218.63, two_bed: 275.34, three_bed: 340.00, four_bed: 424.66 },
  },
  "Outer South London": {
    brma: "Outer South London",
    rates: { shared: 103.56, one_bed: 195.62, two_bed: 253.15, three_bed: 310.96, four_bed: 391.23 },
  },
  "Outer South East London": {
    brma: "Outer South East London",
    rates: { shared: 97.81, one_bed: 184.11, two_bed: 241.64, three_bed: 295.89, four_bed: 369.86 },
  },
  "Outer North East London": {
    brma: "Outer North East London",
    rates: { shared: 97.81, one_bed: 184.11, two_bed: 241.64, three_bed: 295.89, four_bed: 369.86 },
  },

  // Major English cities
  "Greater Manchester South": {
    brma: "Greater Manchester South",
    rates: { shared: 80.55, one_bed: 103.56, two_bed: 138.08, three_bed: 155.34, four_bed: 195.62 },
  },
  "Birmingham": {
    brma: "Birmingham",
    rates: { shared: 74.79, one_bed: 103.56, two_bed: 132.33, three_bed: 149.59, four_bed: 195.62 },
  },
  "Leeds": {
    brma: "Leeds",
    rates: { shared: 74.79, one_bed: 97.81, two_bed: 126.58, three_bed: 149.59, four_bed: 184.11 },
  },
  "Liverpool": {
    brma: "Liverpool",
    rates: { shared: 69.04, one_bed: 86.30, two_bed: 109.32, three_bed: 126.58, four_bed: 161.10 },
  },
  "Tyneside": {
    brma: "Tyneside",
    rates: { shared: 69.04, one_bed: 92.05, two_bed: 115.07, three_bed: 132.33, four_bed: 172.60 },
  },
  "Sheffield": {
    brma: "Sheffield",
    rates: { shared: 69.04, one_bed: 92.05, two_bed: 115.07, three_bed: 132.33, four_bed: 166.85 },
  },
  "Bristol": {
    brma: "Bristol",
    rates: { shared: 92.05, one_bed: 143.84, two_bed: 184.11, three_bed: 218.63, four_bed: 276.16 },
  },
  "Nottingham": {
    brma: "Nottingham",
    rates: { shared: 69.04, one_bed: 92.05, two_bed: 120.82, three_bed: 138.08, four_bed: 172.60 },
  },
  "Leicester": {
    brma: "Leicester",
    rates: { shared: 69.04, one_bed: 92.05, two_bed: 120.82, three_bed: 138.08, four_bed: 172.60 },
  },
  "Coventry": {
    brma: "Coventry",
    rates: { shared: 69.04, one_bed: 97.81, two_bed: 126.58, three_bed: 143.84, four_bed: 178.36 },
  },
  "Bradford": {
    brma: "Bradford",
    rates: { shared: 63.29, one_bed: 80.55, two_bed: 103.56, three_bed: 120.82, four_bed: 149.59 },
  },
  "Southampton": {
    brma: "Southampton",
    rates: { shared: 86.30, one_bed: 126.58, two_bed: 161.10, three_bed: 195.62, four_bed: 253.15 },
  },
  "Portsmouth": {
    brma: "Portsmouth",
    rates: { shared: 80.55, one_bed: 120.82, two_bed: 155.34, three_bed: 184.11, four_bed: 241.64 },
  },
  "Plymouth": {
    brma: "Plymouth",
    rates: { shared: 69.04, one_bed: 97.81, two_bed: 126.58, three_bed: 149.59, four_bed: 184.11 },
  },
  "Reading": {
    brma: "Reading",
    rates: { shared: 103.56, one_bed: 161.10, two_bed: 207.12, three_bed: 253.15, four_bed: 310.96 },
  },
  "Oxford": {
    brma: "Oxford",
    rates: { shared: 103.56, one_bed: 155.34, two_bed: 195.62, three_bed: 241.64, four_bed: 299.18 },
  },
  "Cambridge": {
    brma: "Cambridge",
    rates: { shared: 97.81, one_bed: 149.59, two_bed: 184.11, three_bed: 218.63, four_bed: 276.16 },
  },
  "Brighton and Hove": {
    brma: "Brighton and Hove",
    rates: { shared: 103.56, one_bed: 172.60, two_bed: 218.63, three_bed: 265.78, four_bed: 330.00 },
  },
  "York": {
    brma: "York",
    rates: { shared: 74.79, one_bed: 103.56, two_bed: 132.33, three_bed: 155.34, four_bed: 195.62 },
  },

  // Scotland
  "Lothian": {
    brma: "Lothian",
    rates: { shared: 91.15, one_bed: 138.08, two_bed: 172.60, three_bed: 207.12, four_bed: 276.16 },
  },
  "Glasgow": {
    brma: "Glasgow",
    rates: { shared: 74.79, one_bed: 97.81, two_bed: 120.82, three_bed: 143.84, four_bed: 184.11 },
  },
  "Aberdeen and Shire": {
    brma: "Aberdeen and Shire",
    rates: { shared: 80.55, one_bed: 109.32, two_bed: 138.08, three_bed: 161.10, four_bed: 207.12 },
  },
  "Dundee and Angus": {
    brma: "Dundee and Angus",
    rates: { shared: 63.29, one_bed: 86.30, two_bed: 103.56, three_bed: 120.82, four_bed: 155.34 },
  },

  // Wales
  "Cardiff": {
    brma: "Cardiff",
    rates: { shared: 74.79, one_bed: 103.56, two_bed: 132.33, three_bed: 155.34, four_bed: 195.62 },
  },
  "Swansea": {
    brma: "Swansea",
    rates: { shared: 63.29, one_bed: 80.55, two_bed: 103.56, three_bed: 120.82, four_bed: 155.34 },
  },
  "Newport (Gwent)": {
    brma: "Newport (Gwent)",
    rates: { shared: 63.29, one_bed: 86.30, two_bed: 109.32, three_bed: 126.58, four_bed: 161.10 },
  },

  // Northern Ireland
  "Belfast": {
    brma: "Belfast",
    rates: { shared: 63.29, one_bed: 86.30, two_bed: 103.56, three_bed: 120.82, four_bed: 155.34 },
  },
  "North West (NI)": {
    brma: "North West (NI)",
    rates: { shared: 57.53, one_bed: 74.79, two_bed: 92.05, three_bed: 103.56, four_bed: 132.33 },
  },
  "South (NI)": {
    brma: "South (NI)",
    rates: { shared: 57.53, one_bed: 74.79, two_bed: 92.05, three_bed: 109.32, four_bed: 138.08 },
  },
}

function lookupRate(brma: string, bedrooms: number): number | null {
  const rates = LHA_RATES[brma]
  if (!rates) return null
  if (bedrooms <= 0) return rates.rates.shared
  if (bedrooms === 1) return rates.rates.one_bed
  if (bedrooms === 2) return rates.rates.two_bed
  if (bedrooms === 3) return rates.rates.three_bed
  return rates.rates.four_bed // 4+ bedrooms
}

/**
 * Get the LHA weekly rate for a city and bedroom count.
 * For London, optionally pass a postcode for more accurate BRMA mapping.
 */
export function getLhaWeeklyRate(city: string, bedrooms: number, postcode?: string): number | null {
  // London: try postcode prefix mapping first
  if (city === "London" && postcode) {
    const prefix = postcode.trim().toUpperCase().replace(/\s.*$/, "").replace(/[0-9]+$/, "")
    const londonBrma = LONDON_POSTCODE_TO_BRMA[prefix]
    if (londonBrma) {
      return lookupRate(londonBrma, bedrooms)
    }
  }

  // Standard city lookup
  const brma = CITY_TO_BRMA[city]
  if (brma) {
    return lookupRate(brma, bedrooms)
  }

  // Fuzzy match: check if city name is contained in any key
  for (const [cityKey, brmaVal] of Object.entries(CITY_TO_BRMA)) {
    if (city.toLowerCase().includes(cityKey.toLowerCase())) {
      return lookupRate(brmaVal, bedrooms)
    }
  }

  return null
}

/**
 * Get the LHA monthly rate (weekly * 52 / 12, rounded).
 */
export function getLhaMonthlyRate(city: string, bedrooms: number, postcode?: string): number | null {
  const weekly = getLhaWeeklyRate(city, bedrooms, postcode)
  return weekly ? Math.round((weekly * 52) / 12) : null
}
