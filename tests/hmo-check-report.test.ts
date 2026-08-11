import { describe, it, expect } from "vitest"
import { buildHmoCheckReport, type HmoCheckInput } from "@/lib/report/hmo-check"

const NOW = new Date("2026-08-11T00:00:00.000Z")

function input(over: Partial<HmoCheckInput> = {}): HmoCheckInput {
  return {
    address: "1 Test Street", postcode: "M14 5AA",
    listing_type: "purchase", purchase_price: 300_000,
    bedrooms: 5, licensed_hmo: false,
    article_4_status: "unknown",
    ...over,
  }
}

describe("the headline states the position", () => {
  it("leads with the restriction where one applies", () => {
    const r = buildHmoCheckReport(input({ article_4_status: "in_force" }), NOW)
    expect(r.headline).toContain("Article 4")
    expect(r.headline).toContain("planning permission")
  })

  // The costliest possible error: silence read as an all clear.
  it("says unchecked rather than clear when the council was never established", () => {
    const r = buildHmoCheckReport(input({ article_4_status: "unknown" }), NOW)
    expect(r.headline).toContain("not been established")
    expect(r.headline.toLowerCase()).not.toContain("no article 4 direction found")
  })

  it("distinguishes a verified negative from an unchecked one", () => {
    const found = buildHmoCheckReport(input({ article_4_status: "none_found" }), NOW)
    expect(found.headline).toContain("No Article 4 direction found")
  })

  it("never reports a score", () => {
    const r = buildHmoCheckReport(input(), NOW)
    const text = JSON.stringify(r).toLowerCase()
    expect(text).not.toContain("/100")
    expect(text).not.toContain("deal score")
  })
})

describe("what the report will not do", () => {
  // Absence of a recorded direction is not absence of a direction. Most
  // councils that operate one publish nothing.
  it("marks an unestablished planning position as unknown, not as a negative", () => {
    const r = buildHmoCheckReport(input({ article_4_status: "unknown" }), NOW)
    const a4 = r.sections.find((s) => s.title === "Planning restrictions")!
    const fact = a4.facts[0]
    expect(fact.confidence).toBe("unknown")
    expect(fact.note).toContain("not as clear")
  })

  it("always leaves the reader with the questions data cannot settle", () => {
    const r = buildHmoCheckReport(input(), NOW)
    expect(r.openQuestions.length).toBeGreaterThan(0)
    expect(r.disclaimer).toContain("not a planning or legal opinion")
  })

  it("labels an indicative rent as inferred and says what it is built from", () => {
    const r = buildHmoCheckReport(input({ estimated_rent_per_room: 600, bedrooms: 5 }), NOW)
    const money = r.sections.find((s) => s.title === "Money")!
    const rent = money.facts.find((f) => f.label === "Indicative gross rent")!
    expect(rent.confidence).toBe("inferred")
    expect(rent.note).toContain("not a valuation")
  })

  it("says a missing floor plan makes any room count an assumption", () => {
    const r = buildHmoCheckReport(input({ floor_plans: [] }), NOW)
    const building = r.sections.find((s) => s.title === "The building")!
    const plan = building.facts.find((f) => f.label === "Floor plan")!
    expect(plan.value).toBe("Not available")
    expect(plan.note).toContain("assumption")
  })
})

describe("the facts a buyer would act on", () => {
  it("quotes the council where we hold its own words", () => {
    const r = buildHmoCheckReport(
      input({
        article_4_status: "in_force",
        councilVerifiedQuote: "planning permission is required for all new HMOs",
        councilVerifiedUrl: "https://example.gov.uk/article-4",
      }),
      NOW
    )
    const a4 = r.sections.find((s) => s.title === "Planning restrictions")!
    const quote = a4.facts.find((f) => f.label === "The council's own words")!
    expect(quote.confidence).toBe("verified")
    expect(quote.source).toContain("example.gov.uk")
  })

  // A licence with months to run is a deadline the seller is facing too.
  it("flags a licence coming up for renewal as a negotiating point", () => {
    const r = buildHmoCheckReport(
      input({ licensed_hmo: true, hmo_licence_expiry: "2026-10-01" }),
      NOW
    )
    const lic = r.sections.find((s) => s.title === "Licensing")!
    const expiry = lic.facts.find((f) => f.label === "Licence expiry")!
    expect(expiry.value).toContain("51 days remaining")
    expect(expiry.note).toContain("deadline")
  })

  it("treats an expired licence as an enforcement risk, and says whose", () => {
    const r = buildHmoCheckReport(
      input({ licensed_hmo: true, hmo_licence_expiry: "2026-01-01" }),
      NOW
    )
    const lic = r.sections.find((s) => s.title === "Licensing")!
    const expiry = lic.facts.find((f) => f.label === "Licence expiry")!
    expect(expiry.note).toContain("enforcement risk")
  })

  it("does not invent an expiry the council never published", () => {
    const r = buildHmoCheckReport(input({ licensed_hmo: true, hmo_licence_expiry: null }), NOW)
    const lic = r.sections.find((s) => s.title === "Licensing")!
    const expiry = lic.facts.find((f) => f.label === "Licence expiry")!
    expect(expiry.confidence).toBe("unknown")
    expect(expiry.value).toBe("Not published")
  })

  it("shows the conversion route step by step", () => {
    const r = buildHmoCheckReport(
      input({ article_4_status: "none_found", bedrooms: 4 }),
      NOW
    )
    const route = r.sections.find((s) => s.title === "Use class and conversion route")!
    expect(route.facts.some((f) => f.label === "C3 to C4")).toBe(true)
  })

  it("puts what would stop the purchase before the money", () => {
    const r = buildHmoCheckReport(input(), NOW)
    const titles = r.sections.map((s) => s.title)
    expect(titles.indexOf("Planning restrictions")).toBeLessThan(titles.indexOf("Money"))
    expect(titles.indexOf("Licensing")).toBeLessThan(titles.indexOf("Money"))
  })
})
