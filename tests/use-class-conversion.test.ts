import { describe, it, expect } from "vitest"
import { assessUseClass } from "@/lib/properties/use-class"
import { assessConversion } from "@/lib/properties/conversion"
import { categorise, MARKET_LABELS } from "@/lib/properties/category"

describe("use class", () => {
  // A licence records both the use and the occupancy a council granted it for,
  // which is the only case where the class is a fact rather than a reading.
  it("reads C4 from a licence with an occupancy", () => {
    const a = assessUseClass({ licensed_hmo: true, max_occupants: 5, bedrooms: 5 })
    expect(a.useClass).toBe("C4")
    expect(a.basis).toBe("recorded")
  })

  it("reads sui generis above the seven-occupant threshold", () => {
    const a = assessUseClass({ licensed_hmo: true, max_occupants: 9, bedrooms: 6 })
    expect(a.useClass).toBe("sui_generis")
    expect(a.basis).toBe("recorded")
  })

  // Occupants, not bedrooms: a seven-bed house let to six people is C4.
  it("does not call a large house sui generis on bedroom count alone", () => {
    const a = assessUseClass({ licensed_hmo: true, max_occupants: 6, bedrooms: 7 })
    expect(a.useClass).toBe("C4")
  })

  // Half the licensed stock has no occupancy recorded. C4 is the smaller claim.
  it("falls to the smaller claim when a licence carries no occupancy", () => {
    const a = assessUseClass({ licensed_hmo: true, max_occupants: null, bedrooms: 8 })
    expect(a.useClass).toBe("C4")
    expect(a.basis).toBe("inferred")
    expect(a.reason).toContain("smaller claim")
  })

  it("treats a two-bed with no licence as C3", () => {
    const a = assessUseClass({ bedrooms: 2 })
    expect(a.useClass).toBe("C3")
    expect(a.basis).toBe("inferred")
  })

  // A big house is not an HMO until it is let as one. Inferring C4 from size
  // would assert a use nobody has recorded.
  it("does not infer HMO use from size alone", () => {
    const a = assessUseClass({ bedrooms: 6, licensed_hmo: false })
    expect(a.useClass).toBe("C3")
  })

  it("says so when there is nothing to reason from", () => {
    const a = assessUseClass({})
    expect(a.useClass).toBe("unknown")
    expect(a.basis).toBe("none")
  })
})

describe("conversion routes", () => {
  const open = { hmoArticle4InForce: false, classMaArticle4InForce: false, councilPositionKnown: true, hasFloorPlan: true }

  it("a C3 house in a council with no Article 4 is permitted development", () => {
    const c = assessConversion({ useClass: "C3", ...open })
    expect(c.wholeRoutePermitted).toBe(true)
    expect(c.blockers).toHaveLength(0)
  })

  it("an HMO Article 4 makes the C3 to C4 step a full application", () => {
    const c = assessConversion({ useClass: "C3", ...open, hmoArticle4InForce: true })
    expect(c.wholeRoutePermitted).toBe(false)
    expect(c.blockers[0]).toContain("HMO Article 4")
  })

  // The point of the whole module: a commercial route is two permissions, and
  // it is only as good as the weaker one.
  it("a commercial route needs both steps, and fails on either", () => {
    const both = assessConversion({ useClass: "E", ...open })
    expect(both.steps).toHaveLength(2)
    expect(both.wholeRoutePermitted).toBe(true)

    // Luton's shape: Class MA withdrawn, C3 to C4 untouched.
    const maGone = assessConversion({ useClass: "E", ...open, classMaArticle4InForce: true })
    expect(maGone.wholeRoutePermitted).toBe(false)
    expect(maGone.blockers.some((b) => b.includes("Class MA"))).toBe(true)

    // The commoner shape: commercial conversion open, HMO use closed.
    const hmoGone = assessConversion({ useClass: "E", ...open, hmoArticle4InForce: true })
    expect(hmoGone.wholeRoutePermitted).toBe(false)
    expect(hmoGone.blockers.some((b) => b.includes("HMO Article 4"))).toBe(true)
  })

  it("C2 has no permitted route at all, whatever the council allows", () => {
    const c = assessConversion({ useClass: "C2", ...open })
    expect(c.wholeRoutePermitted).toBe(false)
    expect(c.steps[0].status).toBe("no_permitted_route")
    expect(c.steps[0].gpdoClass).toBeNull()
  })

  // An unestablished council position must never read as an open route.
  it("never reports permitted development for a council we have not checked", () => {
    const c = assessConversion({ useClass: "E", ...open, councilPositionKnown: false })
    expect(c.wholeRoutePermitted).toBe(false)
    expect(c.steps.every((s) => s.status === "unknown")).toBe(true)
  })

  it("says a permitted route is still not a yes", () => {
    const c = assessConversion({ useClass: "E", ...open })
    // Class MA carries prior-approval conditions we hold no data on.
    expect(c.openQuestions.some((q) => q.includes("prior approval"))).toBe(true)
  })

  it("flags a missing floor plan as a limit on any room count", () => {
    const c = assessConversion({ useClass: "C3", ...open, hasFloorPlan: false })
    expect(c.openQuestions.some((q) => q.includes("cannot be judged"))).toBe(true)
  })

  it("says nothing needs doing to a property already in HMO use", () => {
    const c = assessConversion({ useClass: "C4", ...open })
    expect(c.steps).toHaveLength(0)
    expect(c.openQuestions[0]).toContain("Already in HMO use")
  })
})

describe("commercial conversion as a category", () => {
  const commercial = { listing_type: "purchase", property_type: "commercial", purchase_price: 300_000 }

  it("is its own market status, not ordinary for-sale stock", () => {
    expect(categorise(commercial).market).toBe("commercial_conversion")
    expect(categorise({ listing_type: "purchase", property_type: "House" }).market).toBe("for_sale")
  })

  it("is labelled as an opportunity rather than as a home", () => {
    expect(MARKET_LABELS.commercial_conversion).toContain("Commercial")
    expect(MARKET_LABELS.commercial_conversion).toContain("conversion")
  })

  // A shop has no bedrooms. That must not be mistaken for a house whose
  // bedroom count we simply failed to record.
  it("does not classify a house with no bedroom count as commercial", () => {
    expect(categorise({ listing_type: "purchase", property_type: "House", bedrooms: null } as never).market).toBe("for_sale")
  })
})
