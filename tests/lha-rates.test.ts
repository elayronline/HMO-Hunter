import { describe, it, expect } from "vitest"
import {
  getLhaWeeklyRate,
  getLhaMonthlyRate,
  CITY_TO_BRMA,
  LHA_RATES,
  LONDON_POSTCODE_TO_BRMA,
  RATES_EFFECTIVE_DATE,
} from "@/lib/data/lha-rates"

describe("LHA Rates Data", () => {
  it("should have a valid effective date", () => {
    expect(RATES_EFFECTIVE_DATE).toBe("2024-04-01")
  })

  it("should have rates for every BRMA referenced by a city", () => {
    for (const [city, brma] of Object.entries(CITY_TO_BRMA)) {
      expect(LHA_RATES[brma], `Missing BRMA "${brma}" for city "${city}"`).toBeDefined()
    }
  })

  it("should have rates for every London postcode BRMA", () => {
    for (const [prefix, brma] of Object.entries(LONDON_POSTCODE_TO_BRMA)) {
      expect(LHA_RATES[brma], `Missing BRMA "${brma}" for postcode prefix "${prefix}"`).toBeDefined()
    }
  })

  it("should have all 5 rate tiers per BRMA", () => {
    for (const [brma, rate] of Object.entries(LHA_RATES)) {
      expect(rate.rates.shared, `${brma} missing shared`).toBeGreaterThan(0)
      expect(rate.rates.one_bed, `${brma} missing one_bed`).toBeGreaterThan(0)
      expect(rate.rates.two_bed, `${brma} missing two_bed`).toBeGreaterThan(0)
      expect(rate.rates.three_bed, `${brma} missing three_bed`).toBeGreaterThan(0)
      expect(rate.rates.four_bed, `${brma} missing four_bed`).toBeGreaterThan(0)
    }
  })

  it("should have rates that increase with bedroom count", () => {
    for (const [brma, rate] of Object.entries(LHA_RATES)) {
      expect(rate.rates.one_bed, `${brma}: one_bed <= shared`).toBeGreaterThan(rate.rates.shared)
      expect(rate.rates.two_bed, `${brma}: two_bed <= one_bed`).toBeGreaterThan(rate.rates.one_bed)
      expect(rate.rates.three_bed, `${brma}: three_bed <= two_bed`).toBeGreaterThan(rate.rates.two_bed)
      expect(rate.rates.four_bed, `${brma}: four_bed <= three_bed`).toBeGreaterThan(rate.rates.three_bed)
    }
  })
})

describe("getLhaWeeklyRate", () => {
  it("should return a rate for all 30 mapped cities with 2 bedrooms", () => {
    for (const city of Object.keys(CITY_TO_BRMA)) {
      const rate = getLhaWeeklyRate(city, 2)
      expect(rate, `No rate for ${city}`).not.toBeNull()
      expect(rate!).toBeGreaterThan(0)
    }
  })

  it("should return null for an unknown city", () => {
    expect(getLhaWeeklyRate("Atlantis", 2)).toBeNull()
  })

  it("should return shared rate for 0 bedrooms", () => {
    const shared = getLhaWeeklyRate("Manchester", 0)
    expect(shared).toBe(80.55)
  })

  it("should return one_bed rate for 1 bedroom", () => {
    const rate = getLhaWeeklyRate("Manchester", 1)
    expect(rate).toBe(103.56)
  })

  it("should return two_bed rate for 2 bedrooms", () => {
    const rate = getLhaWeeklyRate("Manchester", 2)
    expect(rate).toBe(138.08)
  })

  it("should return three_bed rate for 3 bedrooms", () => {
    const rate = getLhaWeeklyRate("Manchester", 3)
    expect(rate).toBe(155.34)
  })

  it("should return four_bed rate for 4+ bedrooms", () => {
    const rate4 = getLhaWeeklyRate("Manchester", 4)
    const rate6 = getLhaWeeklyRate("Manchester", 6)
    expect(rate4).toBe(195.62)
    expect(rate6).toBe(195.62) // 4+ all get the same rate
  })

  it("should use London postcode prefix for accurate BRMA", () => {
    const centralRate = getLhaWeeklyRate("London", 2, "EC1A 1BB")
    const outerRate = getLhaWeeklyRate("London", 2, "BR1 1AA")

    expect(centralRate).not.toBeNull()
    expect(outerRate).not.toBeNull()
    expect(centralRate!).toBeGreaterThan(outerRate!) // Central London > Outer South East
  })

  it("should fall back to default London BRMA without postcode", () => {
    const rate = getLhaWeeklyRate("London", 2)
    expect(rate).not.toBeNull()
    // Default London BRMA is Inner South East London
    expect(rate).toBe(290.96)
  })

  it("should handle London postcodes with various formats", () => {
    const rate1 = getLhaWeeklyRate("London", 2, "SW1A 1AA")
    const rate2 = getLhaWeeklyRate("London", 2, "sw1a 1aa")
    expect(rate1).toBe(rate2) // Case insensitive
  })

  it("should handle fuzzy city matching", () => {
    // "Greater Manchester" should match "Manchester" via fuzzy match
    const rate = getLhaWeeklyRate("Greater Manchester", 2)
    // The fuzzy match checks if the input city name contains any mapped key
    // "Greater Manchester" does not contain "Manchester" — "Manchester" is contained in "Greater Manchester"
    // The fuzzy logic is: city.toLowerCase().includes(cityKey.toLowerCase())
    // So "greater manchester".includes("manchester") is true
    expect(rate).not.toBeNull()
  })
})

describe("getLhaMonthlyRate", () => {
  it("should return correct monthly calculation", () => {
    const weekly = getLhaWeeklyRate("Manchester", 2)!
    const monthly = getLhaMonthlyRate("Manchester", 2)!

    expect(monthly).toBe(Math.round((weekly * 52) / 12))
  })

  it("should return null for unknown city", () => {
    expect(getLhaMonthlyRate("Atlantis", 2)).toBeNull()
  })

  it("should return a rate for all mapped cities", () => {
    for (const city of Object.keys(CITY_TO_BRMA)) {
      const rate = getLhaMonthlyRate(city, 2)
      expect(rate, `No monthly rate for ${city}`).not.toBeNull()
      expect(rate!).toBeGreaterThan(0)
    }
  })

  it("should return higher monthly rates for more bedrooms", () => {
    const monthly1 = getLhaMonthlyRate("Bristol", 1)!
    const monthly2 = getLhaMonthlyRate("Bristol", 2)!
    const monthly3 = getLhaMonthlyRate("Bristol", 3)!

    expect(monthly2).toBeGreaterThan(monthly1)
    expect(monthly3).toBeGreaterThan(monthly2)
  })
})
