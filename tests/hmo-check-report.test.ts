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

/**
 * Two questions, two reports. Someone looking at an operating HMO wants to know
 * what it holds; someone looking at a house or a shop wants to know whether they
 * could turn it into one.
 */
describe("the report answers the question that was asked", () => {
  it("treats a licensed property as an existing HMO", () => {
    const r = buildHmoCheckReport(input({ licensed_hmo: true, hmo_licence_expiry: "2028-01-01" }), NOW)
    expect(r.purpose).toBe("existing_hmo")
    expect(r.headline).toContain("operating HMO")
  })

  it("treats an unlicensed property as a conversion question", () => {
    const r = buildHmoCheckReport(input({ licensed_hmo: false }), NOW)
    expect(r.purpose).toBe("conversion")
  })

  // For a conversion the route is the point, so it comes before the licence.
  it("leads a conversion with the route and an existing HMO with its licence", () => {
    const conv = buildHmoCheckReport(input({ licensed_hmo: false, article_4_status: "none_found" }), NOW)
    const titles = conv.sections.map((s) => s.title)
    expect(titles.indexOf("Use class and conversion route")).toBeLessThan(titles.indexOf("Licensing"))

    const existing = buildHmoCheckReport(input({ licensed_hmo: true }), NOW)
    const eTitles = existing.sections.map((s) => s.title)
    expect(eTitles.indexOf("Licensing")).toBeLessThan(eTitles.indexOf("Use class and conversion route"))
  })

  it("says plainly when a conversion looks like permitted development", () => {
    const r = buildHmoCheckReport(input({ licensed_hmo: false, article_4_status: "none_found" }), NOW)
    expect(r.headline).toContain("permitted development")
  })
})

/**
 * Precedent is only useful to someone who has to apply. Showing it where the
 * change is permitted development suggests a hurdle that is not there.
 */
describe("planning precedent appears if and only if it applies", () => {
  const decisions = [
    {
      reference: "26/01234/FUL",
      address: "10 Example Road",
      description: "Change of use from C3 dwellinghouse to 6 person HMO (sui generis)",
      outcome: "Permitted",
      decidedDate: "2026-05-01",
      addsSupply: true,
    },
  ]

  it("is shown where an Article 4 means an application is required", () => {
    const r = buildHmoCheckReport(
      input({ article_4_status: "in_force", recentDecisions: decisions, councilApprovalRate: 0.4, councilDecisionCount: 20 }),
      NOW
    )
    const section = r.sections.find((s) => s.title === "What this council has recently decided")
    expect(section).toBeDefined()
    // What was approved matters more than how many were.
    expect(section!.facts.some((f) => f.note?.includes("6 person HMO"))).toBe(true)
  })

  it("is hidden where the change is permitted development", () => {
    const r = buildHmoCheckReport(
      input({ licensed_hmo: false, article_4_status: "none_found", recentDecisions: decisions }),
      NOW
    )
    expect(r.sections.find((s) => s.title === "What this council has recently decided")).toBeUndefined()
  })

  // An unchecked council may well require an application, so the reader should
  // see what that would look like.
  it("is shown where the council's position is unknown", () => {
    const r = buildHmoCheckReport(
      input({ licensed_hmo: false, article_4_status: "unknown", recentDecisions: decisions }),
      NOW
    )
    expect(r.sections.find((s) => s.title === "What this council has recently decided")).toBeDefined()
  })

  it("warns when a council refuses more than it permits", () => {
    const r = buildHmoCheckReport(
      input({ article_4_status: "in_force", recentDecisions: decisions, councilApprovalRate: 0.3, councilDecisionCount: 30 }),
      NOW
    )
    const rate = r.sections
      .find((s) => s.title === "What this council has recently decided")!
      .facts.find((f) => f.label.includes("Approval rate"))!
    expect(rate.note).toContain("refuses more")
  })

  it("refuses to read a trend from a handful of decisions", () => {
    const r = buildHmoCheckReport(
      input({ article_4_status: "in_force", recentDecisions: decisions, councilApprovalRate: 0.5, councilDecisionCount: 4 }),
      NOW
    )
    const rate = r.sections
      .find((s) => s.title === "What this council has recently decided")!
      .facts.find((f) => f.label.includes("Approval rate"))!
    expect(rate.note).toContain("Too few decisions")
  })
})
