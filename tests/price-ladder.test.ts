import { describe, it, expect } from "vitest"
import {
  PRICE_LADDER,
  LEGACY_SLIDER_MIN,
  LEGACY_SLIDER_MAX,
  migrateSavedPriceRange,
  formatPriceOption,
} from "@/lib/properties/category"

describe("PRICE_LADDER", () => {
  it("matches Rightmove's for-sale price options, read 2026-08-21", () => {
    // The point of the ladder is like-for-like with the control a UK buyer
    // already knows. Any edit here is a divergence from that, so it has to be
    // a deliberate one rather than a value drifting in unnoticed.
    expect(PRICE_LADDER).toEqual([
      50_000, 60_000, 70_000, 80_000, 90_000, 100_000, 110_000, 120_000,
      125_000, 130_000, 140_000, 150_000, 160_000, 170_000, 175_000, 180_000,
      190_000, 200_000, 210_000, 220_000, 230_000, 240_000, 250_000, 260_000,
      270_000, 280_000, 290_000, 300_000, 325_000, 350_000, 375_000, 400_000,
      425_000, 450_000, 475_000, 500_000, 550_000, 600_000, 650_000, 700_000,
      800_000, 900_000, 1_000_000, 1_250_000, 1_500_000, 1_750_000, 2_000_000,
      2_500_000, 3_000_000, 4_000_000, 5_000_000, 7_500_000, 10_000_000,
      15_000_000, 20_000_000,
    ])
  })

  it("copies Rightmove's missing £750,000 rung rather than repairing it", () => {
    expect(PRICE_LADDER).not.toContain(750_000)
    expect(PRICE_LADDER).toContain(700_000)
    expect(PRICE_LADDER).toContain(800_000)
  })

  it("ascends strictly, so cutting one list against the other end is sound", () => {
    for (let i = 1; i < PRICE_LADDER.length; i++) {
      expect(PRICE_LADDER[i]).toBeGreaterThan(PRICE_LADDER[i - 1])
    }
  })

  it("carries no ceiling at the old slider's maximum", () => {
    // £2,000,000 was never chosen as a limit — it arrived with the February
    // scaffold. Values above it must remain selectable.
    const above = PRICE_LADDER.filter((v) => v > LEGACY_SLIDER_MAX)
    expect(above.length).toBeGreaterThan(0)
    expect(PRICE_LADDER[PRICE_LADDER.length - 1]).toBe(20_000_000)
  })

  it("steps finely where HMO stock is bought and coarsely above it", () => {
    const gapAt = (v: number) => {
      const i = PRICE_LADDER.indexOf(v)
      return PRICE_LADDER[i + 1] - PRICE_LADDER[i]
    }
    expect(gapAt(200_000)).toBe(10_000)
    expect(gapAt(400_000)).toBe(25_000)
    expect(gapAt(500_000)).toBe(50_000)
    expect(gapAt(1_000_000)).toBe(250_000)
  })
})

describe("migrateSavedPriceRange", () => {
  it("reads the old slider's resting pair as no limit at either end", () => {
    // [50000, 2000000] was what the slider recorded when the user set no price
    // at all — it could not express an absent bound. Restored literally it
    // would apply a floor and a ceiling nobody asked for.
    expect(migrateSavedPriceRange([LEGACY_SLIDER_MIN, LEGACY_SLIDER_MAX])).toEqual([null, null])
  })

  it("keeps a maximum the user actually chose", () => {
    expect(migrateSavedPriceRange([LEGACY_SLIDER_MIN, 800_000])).toEqual([null, 800_000])
  })

  it("keeps a minimum the user actually chose", () => {
    expect(migrateSavedPriceRange([300_000, LEGACY_SLIDER_MAX])).toEqual([300_000, null])
  })

  it("keeps both when both were chosen", () => {
    expect(migrateSavedPriceRange([300_000, 800_000])).toEqual([300_000, 800_000])
  })

  it("passes through a pair already in the new shape", () => {
    expect(migrateSavedPriceRange([null, null])).toEqual([null, null])
    expect(migrateSavedPriceRange([null, 650_000])).toEqual([null, 650_000])
  })

  it("returns no limits for a search that recorded no price at all", () => {
    expect(migrateSavedPriceRange(undefined)).toEqual([null, null])
    expect(migrateSavedPriceRange([])).toEqual([null, null])
  })
})

describe("formatPriceOption", () => {
  it("labels in pounds with thousands separators", () => {
    expect(formatPriceOption(50_000)).toBe("£50,000")
    expect(formatPriceOption(1_250_000)).toBe("£1,250,000")
    expect(formatPriceOption(20_000_000)).toBe("£20,000,000")
  })
})
