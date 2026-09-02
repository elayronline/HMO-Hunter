import { describe, it, expect } from "vitest"
import { RightmoveSourceAdapter, snapRadius, RIGHTMOVE_SORT_NEWEST } from "@/lib/ingestion/adapters/rightmove-source"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * purchase_price means "a vendor is asking this for this building".
 *
 * Rightmove qualifies its price: "Guide price" and "Offers in excess of" are
 * ways of stating this property's asking price. "From" is not — it appears on
 * new-build developments and means the cheapest unit currently available in the
 * scheme. The live probe of 2026-09-02 returned four listings all showing
 * "£500,000" with the numeric 500000, of which one was "From": storing that
 * would attribute a price to a specific plot that no source has priced.
 */
describe("RightmoveSourceAdapter.askingPrice", () => {
  const at = (secondary: string | null, price = 500000) =>
    RightmoveSourceAdapter.askingPrice({ price: { primary: "£500,000", secondary }, stampDutyCalculator: { price } })

  it("stores an unqualified price", () => {
    expect(at(null)).toBe(500000)
  })

  it("stores a guide price and an offers-in-excess-of price", () => {
    expect(at("Guide price")).toBe(500000)
    expect(at("Offers in excess of")).toBe(500000)
  })

  // The one that matters.
  it("refuses a 'From' price — that is the development's cheapest unit, not this building", () => {
    expect(at("From")).toBeUndefined()
    expect(at("from")).toBeUndefined()
  })

  it("returns undefined rather than zero when no numeric price exists", () => {
    expect(RightmoveSourceAdapter.askingPrice({ price: { secondary: null } })).toBeUndefined()
    expect(at(null, 0)).toBeUndefined()
  })
})

describe("RightmoveSourceAdapter.mapType", () => {
  it("maps the display types seen in the live probe", () => {
    expect(RightmoveSourceAdapter.mapType({ propertyDisplayType: "Detached", propertyPhrase: "4 bedroom detached house" })).toBe("House")
    expect(RightmoveSourceAdapter.mapType({ propertyDisplayType: "Detached Bungalow", propertyPhrase: "4 bedroom detached bungalow" })).toBe("House")
    expect(RightmoveSourceAdapter.mapType({ propertyDisplayType: "Flat", propertyPhrase: "2 bedroom flat" })).toBe("Flat")
    expect(RightmoveSourceAdapter.mapType({ propertyDisplayType: "", propertyPhrase: "studio apartment" })).toBe("Studio")
  })
})

describe("RightmoveSourceAdapter.areaSqm", () => {
  it("reads the metric figure Rightmove supplies", () => {
    expect(RightmoveSourceAdapter.areaSqm({ secondary: "123 sq m" })).toBe(123)
    expect(RightmoveSourceAdapter.areaSqm({ secondary: "1,323 sq m" })).toBe(1323)
  })
  it("returns null when the size is 'Ask agent'", () => {
    expect(RightmoveSourceAdapter.areaSqm({ secondary: "Ask agent" })).toBeNull()
    expect(RightmoveSourceAdapter.areaSqm(undefined)).toBeNull()
  })
})

/**
 * An unbounded sale run is what put 1,053 rows at a £1.5m median into the table
 * in a single run. The schema makes it unrepresentable; the adapter refuses it
 * too, so a caller that bypasses validation still cannot do it.
 */
describe("RightmoveSourceAdapter refuses an unbounded sale run", () => {
  it("returns empty without a price ceiling", async () => {
    await expect(new RightmoveSourceAdapter("t").fetch({ location: "Nottingham", minBedrooms: 4 })).resolves.toEqual([])
  })
  it("returns empty without a bedroom floor", async () => {
    await expect(new RightmoveSourceAdapter("t").fetch({ location: "Nottingham", maxPrice: 500000 })).resolves.toEqual([])
  })
  it("reports unconfigured without a token", () => {
    expect(new RightmoveSourceAdapter("").isConfigured()).toBe(false)
  })
})

/**
 * The radius is an enum of decimal strings. String(3.0) is "3", which the actor
 * rejects outright — the first live run of this adapter failed on exactly that.
 */
describe("snapRadius", () => {
  it("formats the rungs the way Rightmove's enum writes them", () => {
    expect(snapRadius(3.0)).toBe("3.0")
    expect(snapRadius(1)).toBe("1.0")
    expect(snapRadius(0.25)).toBe("0.25")
    expect(snapRadius(0)).toBe("0.0")
  })
  it("snaps a value Rightmove does not offer to the nearest one it does", () => {
    expect(snapRadius(0.3)).toBe("0.25")
    expect(snapRadius(7)).toBe("5.0")
    expect(snapRadius(12)).toBe("10.0")
  })

  // 2 miles is equidistant from the 1.0 and 3.0 rungs. Snapping down keeps a
  // city-targeted run inside its own market instead of reaching into the next.
  it("breaks a tie towards the smaller radius", () => {
    expect(snapRadius(2)).toBe("1.0")
  })
})

/**
 * The sort order is stated, not inherited.
 *
 * Measured 2026-09-02: the actor's default searchSort "2" is highest-price-first,
 * so a bounded run returned the hundred dearest properties under the ceiling —
 * Birmingham's lower quartile came back at £640,000 against a £650,000 cap. A
 * bound that is applied while the sample still comes off the top of the market
 * is the failure PR #25 was meant to end.
 */
describe("the sort order does not bias the sample by price", () => {
  it("pins searchSort rather than accepting the actor's price-descending default", () => {
    const src = readFileSync(join("lib", "ingestion", "adapters", "rightmove-source.ts"), "utf8")
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")
    expect(code).toMatch(/searchSort:\s*RIGHTMOVE_SORT_NEWEST/)
    expect(RIGHTMOVE_SORT_NEWEST).toBe("6")
  })
})
