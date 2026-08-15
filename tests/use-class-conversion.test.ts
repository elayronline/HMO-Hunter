import { describe, it, expect } from "vitest"
import { assessUseClass, USE_CLASS_LABELS } from "@/lib/properties/use-class"
import { assessConversion } from "@/lib/properties/conversion"
import { categorise, MARKET_LABELS } from "@/lib/properties/category"

describe("use class", () => {
  // A licence records both the use and the occupancy a council granted it for,
  // which is the only case where the class is a fact rather than a reading.
  it("reads C4 from a licence with an occupancy", () => {
    const a = assessUseClass({ licensed_hmo: true, licensed_max_occupants: 5, bedrooms: 5 })
    expect(a.useClass).toBe("C4")
    expect(a.basis).toBe("recorded")
  })

  it("reads sui generis above the seven-occupant threshold", () => {
    const a = assessUseClass({ licensed_hmo: true, licensed_max_occupants: 9, bedrooms: 6 })
    expect(a.useClass).toBe("sui_generis")
    expect(a.basis).toBe("recorded")
  })

  // Occupants, not bedrooms: a seven-bed house let to six people is C4.
  it("does not call a large house sui generis on bedroom count alone", () => {
    const a = assessUseClass({ licensed_hmo: true, licensed_max_occupants: 6, bedrooms: 7 })
    expect(a.useClass).toBe("C4")
  })

  // Half the licensed stock has no occupancy recorded. C4 is the smaller claim.
  // C4 and sui generis are not degrees of the same thing: one can be reached
  // from C3 by permitted development and the other never can. Naming C4 on no
  // occupancy evidence told 347 properties they had a route that may not exist,
  // 131 of them while showing seven or more bedrooms beside "small HMO".
  it("does not pick a size class when the licence carries no occupancy", () => {
    const a = assessUseClass({ licensed_hmo: true, licensed_max_occupants: null, bedrooms: 8 })
    expect(a.useClass).toBe("hmo_unspecified")
    expect(a.useClass).not.toBe("C4")
    // The HMO use itself is recorded — only its size is open.
    expect(a.basis).toBe("recorded")
    expect(a.reason).toContain("not established")
  })

  it("mentions a bedroom count that points the other way, without claiming it", () => {
    const a = assessUseClass({ licensed_hmo: true, licensed_max_occupants: null, bedrooms: 8 })
    expect(a.reason).toContain("8 bedrooms")
    expect(a.reason).toContain("bedrooms are not occupants")
  })

  it("still reads a recorded occupancy as the class it defines", () => {
    expect(assessUseClass({ licensed_hmo: true, licensed_max_occupants: 5 }).useClass).toBe("C4")
    expect(assessUseClass({ licensed_hmo: true, licensed_max_occupants: 7 }).useClass).toBe("sui_generis")
  })

  it("treats a two-bed with no licence as C3", () => {
    const a = assessUseClass({ bedrooms: 2 })
    expect(a.useClass).toBe("C3")
    expect(a.basis).toBe("inferred")
  })

  // A big house is not an HMO until it is let as one. Inferring C4 from size
  // would assert a use nobody has recorded.
  // A five-bedroom house with no licence may be a family home or an unlicensed
  // HMO. The data does not distinguish them, so neither is asserted.
  it("does not name a class for an unlicensed house it cannot place", () => {
    const a = assessUseClass({ bedrooms: 6, licensed_hmo: false })
    expect(a.useClass).toBe("unknown")
    expect(a.basis).toBe("none")
    expect(a.reason).toContain("could be a single dwelling or an unlicensed HMO")
  })

  // Class E is where a Class MA conversion starts. property_type was an input
  // this function never read, so the commercial route could never fire at all.
  it("recognises commercial stock so the Class MA route is reachable", () => {
    const a = assessUseClass({ property_type: "commercial", licensed_hmo: false })
    expect(a.useClass).toBe("E")
    expect(a.basis).toBe("recorded")
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
    // Class MA carries conditions we hold no data on.
    expect(c.openQuestions.some((q) => q.includes("prior approval"))).toBe(true)
    expect(c.openQuestions.some((q) => q.includes("two years"))).toBe(true)
  })

  // SI 2024/141 removed the 1,500 sqm cap and the three-month vacancy rule on
  // 5 March 2024. Both were stated here as live conditions until this test.
  it("does not cite conditions repealed in 2024", () => {
    const all = assessConversion({ useClass: "E", ...open })
      .openQuestions.concat(assessConversion({ useClass: "E", ...open }).steps.map((s) => s.note))
      .join(" ")
      .toLowerCase()
    expect(all).not.toContain("vacant")
    expect(all).not.toContain("1,500")
    expect(all).not.toContain("floor area limit")
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

/**
 * The rule the whole codebase runs on, applied to use class: derive only where
 * the derivation is near-certain, and say "not established" everywhere else.
 * A class named on thin evidence is worse than no class, because the reader
 * cannot tell the two apart once it is on the page.
 */
describe("nothing is claimed that the evidence will not carry", () => {
  it("never returns C4 without a recorded occupancy", () => {
    const withoutOccupancy = [
      { licensed_hmo: true, licensed_max_occupants: null, bedrooms: 3 },
      { licensed_hmo: true, licensed_max_occupants: null, bedrooms: 7 },
      { licensed_hmo: true, licensed_max_occupants: null, bedrooms: 12 },
      { licence_status: "expired", licensed_max_occupants: null, bedrooms: 5 },
    ]
    for (const input of withoutOccupancy) {
      expect(assessUseClass(input).useClass).not.toBe("C4")
    }
  })

  // The seven-bedroom "small HMO" that started this: the label and the bedroom
  // count sat side by side on the same card and contradicted each other.
  it("does not call a seven-bedroom property a small HMO", () => {
    const a = assessUseClass({ licensed_hmo: true, licensed_max_occupants: null, bedrooms: 7 })
    expect(USE_CLASS_LABELS[a.useClass]).not.toContain("small HMO")
  })

  it("keeps HMO use recorded even where the size class is not", () => {
    const a = assessUseClass({ licensed_hmo: true, licensed_max_occupants: null, bedrooms: 7 })
    expect(a.useClass).toBe("hmo_unspecified")
    expect(a.basis).toBe("recorded")
  })

  // An existing HMO needs no change of use, whichever size class it is.
  it("asks for no conversion where the property is already an HMO", () => {
    const r = assessConversion({
      useClass: "hmo_unspecified",
      hmoArticle4InForce: true,
      classMaArticle4InForce: false,
      councilPositionKnown: true,
      hasFloorPlan: false,
    })
    expect(r.steps).toHaveLength(0)
    expect(r.wholeRoutePermitted).toBe(true)
    expect(r.openQuestions.join(" ")).toContain("C4 or sui generis is not established")
  })

  // Where the class is unknown the route is still useful, but only as a
  // conditional — it must never read as a statement about this property.
  it("states the conversion route as a condition when the class is unknown", () => {
    const r = assessConversion({
      useClass: "unknown",
      hmoArticle4InForce: false,
      classMaArticle4InForce: false,
      councilPositionKnown: true,
      hasFloorPlan: false,
    })
    expect(r.steps).toHaveLength(1)
    expect(r.steps[0].note).toContain("If this is currently a C3 dwellinghouse")
    expect(r.steps[0].note).toContain("which we have not established")
    expect(r.openQuestions.join(" ")).toContain("not established")
  })
})
