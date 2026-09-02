import { describe, it, expect } from "vitest"
import { LoopNetAdapter } from "@/lib/ingestion/adapters/loopnet"

/**
 * The Class E filter is a planning test, not a preference.
 *
 * Class MA (Schedule 2, Part 3) runs from Use Class E only. Industrial,
 * warehousing, storage and land are B2/B8 or sui generis and have no Class MA
 * route at all, so carrying them into a conversion segment would offer a buyer a
 * permitted development right that does not exist for that building.
 *
 * Measured against the live probe of 2026-09-02: of three UK listings returned,
 * two were offices (Class E) and one was a 98,544 sq ft industrial unit in
 * Barking, which this correctly refuses.
 */
describe("LoopNetAdapter.classifyUse — only Class E has a Class MA route", () => {
  it("admits offices", () => {
    expect(LoopNetAdapter.classifyUse("31,250 sq ft Office Property Offered at £4,300,000 in Warrington")).toBe("Office")
  })

  it("admits retail", () => {
    expect(LoopNetAdapter.classifyUse("2,000 sq ft Retail Property in Leeds")).toBe("Retail")
    expect(LoopNetAdapter.classifyUse("A shop unit on the high street")).toBe("Retail")
  })

  it("admits other Class E uses", () => {
    expect(LoopNetAdapter.classifyUse("Restaurant premises, 1,200 sq ft")).toBe("Commercial")
    expect(LoopNetAdapter.classifyUse("Medical clinic with parking")).toBe("Commercial")
  })

  it("refuses industrial — the Barking case from the live probe", () => {
    expect(
      LoopNetAdapter.classifyUse("98,544 sq ft Industrial Property Offered in Barking IG11 7HP")
    ).toBeNull()
  })

  it("refuses warehousing, storage and land", () => {
    expect(LoopNetAdapter.classifyUse("Warehouse unit, 40,000 sq ft")).toBeNull()
    expect(LoopNetAdapter.classifyUse("Self storage facility")).toBeNull()
    expect(LoopNetAdapter.classifyUse("Development land, 2 acres")).toBeNull()
  })

  // "Office/industrial hybrid" must not pass on the word office alone.
  it("refuses a mixed description that names a non-Class-E use", () => {
    expect(LoopNetAdapter.classifyUse("Office and industrial hybrid unit")).toBeNull()
  })

  it("returns null rather than guessing when the description says nothing", () => {
    expect(LoopNetAdapter.classifyUse("")).toBeNull()
    expect(LoopNetAdapter.classifyUse(undefined)).toBeNull()
    expect(LoopNetAdapter.classifyUse("A property")).toBeNull()
  })
})

describe("LoopNetAdapter.extractPostcode", () => {
  it("finds the postcode in a LoopNet listing name", () => {
    expect(LoopNetAdapter.extractPostcode("13 Gascoigne Rd, Barking IG11 7HP")).toBe("IG11 7HP")
    expect(LoopNetAdapter.extractPostcode("1200 Daresbury Park, Warrington WA4 4HS")).toBe("WA4 4HS")
    expect(LoopNetAdapter.extractPostcode("14A Shouldham St, London W1H 5FJ")).toBe("W1H 5FJ")
  })

  it("normalises a missing space", () => {
    expect(LoopNetAdapter.extractPostcode("Somewhere W1H5FJ")).toBe("W1H 5FJ")
  })

  it("returns null when there is no postcode to find", () => {
    expect(LoopNetAdapter.extractPostcode("Unit 4, Business Park")).toBeNull()
    expect(LoopNetAdapter.extractPostcode(null)).toBeNull()
  })
})

/**
 * Floor area is recorded, never used as a planning gate.
 *
 * SI 2024/141 removed Class MA's 1,500 sqm ceiling on 5 March 2024 — see
 * tests/use-class-conversion.test.ts, which exists to stop the repealed
 * condition being reasserted. Size still matters commercially, so it is carried
 * as information.
 */
describe("LoopNetAdapter.extractAreaSqm", () => {
  it("converts square feet to square metres", () => {
    expect(LoopNetAdapter.extractAreaSqm("31,250 sq ft Office Property")).toBe(2903)
    expect(LoopNetAdapter.extractAreaSqm("5,609 sq ft Office Property")).toBe(521)
  })

  // A multi-unit range is not a floor area. The first draft reported the Swindon
  // listing "4,571 - 6,692 sq ft" as 622 sqm — the upper bound, published as a
  // measurement of a building that is not that size.
  it("returns null for a range rather than picking an end of it", () => {
    expect(LoopNetAdapter.extractAreaSqm("4,571 - 6,692 sq ft Industrial Property")).toBeNull()
    expect(LoopNetAdapter.extractAreaSqm("1,000 to 2,500 sq ft")).toBeNull()
  })

  it("returns null when no area is published", () => {
    expect(LoopNetAdapter.extractAreaSqm("Office Property in London")).toBeNull()
    expect(LoopNetAdapter.extractAreaSqm(null)).toBeNull()
  })
})

describe("LoopNetAdapter configuration", () => {
  it("reports unconfigured without a token, so a caller can tell empty from unreachable", () => {
    expect(new LoopNetAdapter("").isConfigured()).toBe(false)
    expect(new LoopNetAdapter("apify_api_x").isConfigured()).toBe(true)
  })

  it("resolves empty rather than throwing when unconfigured", async () => {
    await expect(new LoopNetAdapter("").fetch()).resolves.toEqual([])
  })
})
