import { describe, it, expect } from "vitest"
import { datedChanges, splitByExpiry, coverageGaps, HORIZON_DAYS } from "@/lib/dashboard/attention"

const NOW = new Date("2026-08-12T00:00:00.000Z")

describe("dated changes", () => {
  // The reason this section exists: it arrives whether or not anyone looks.
  it("surfaces Durham's countywide direction before it commences", () => {
    const durham = datedChanges(NOW).find((c) => c.council.includes("Durham"))
    expect(durham).toBeDefined()
    expect(durham!.date).toBe("2026-08-17")
    expect(durham!.daysAway).toBe(5)
    expect(durham!.kind).toBe("commences")
    expect(durham!.sourceUrl).toContain("durham.gov.uk")
  })

  it("orders by date, soonest first", () => {
    const dates = datedChanges(NOW).map((c) => c.date)
    expect([...dates].sort()).toEqual(dates)
  })

  // A confirmation deadline is the opposite event to a commencement: the
  // restriction disappears, and nothing happens on the day to announce it.
  it("includes a confirmation deadline as its own kind of change", () => {
    const bury = datedChanges(NOW).find((c) => c.council.includes("Bury"))
    expect(bury?.kind).toBe("confirmation_deadline")
    expect(bury?.detail).toContain("ceases to have effect")
  })

  it("does not show a direction that has already commenced", () => {
    // Everything returned is in the future; a commenced direction is a fact
    // about the present and belongs in the report, not the diary.
    for (const change of datedChanges(NOW)) {
      expect(change.daysAway).toBeGreaterThan(0)
    }
  })

  it("stops at the horizon rather than listing everything ever", () => {
    for (const change of datedChanges(NOW)) {
      expect(change.daysAway).toBeLessThanOrEqual(HORIZON_DAYS)
    }
  })
})

describe("licences by expiry", () => {
  const rows = [
    { id: "1", address: "Soon", hmo_licence_expiry: "2026-09-01" },
    { id: "2", address: "Later", hmo_licence_expiry: "2026-12-01" },
    { id: "3", address: "Gone", hmo_licence_expiry: "2026-01-01" },
    { id: "4", address: "Long gone", hmo_licence_expiry: "2025-01-01" },
  ]

  // Two different conversations: a renewal the owner is already thinking about,
  // and a problem they may not know they have.
  it("separates running out from already expired", () => {
    const { expiringSoon, expired } = splitByExpiry(rows, NOW)
    expect(expiringSoon.map((l) => l.address)).toEqual(["Soon", "Later"])
    expect(expired.map((l) => l.address)).toEqual(["Gone", "Long gone"])
  })

  it("counts days remaining, and days since, correctly", () => {
    const { expiringSoon, expired } = splitByExpiry(rows, NOW)
    expect(expiringSoon[0].daysRemaining).toBe(20)
    expect(expired[0].daysRemaining).toBeLessThan(0)
    expect(expired[0].expired).toBe(true)
  })

  it("puts the most urgent first in both lists", () => {
    const { expiringSoon, expired } = splitByExpiry(rows, NOW)
    expect(expiringSoon[0].address).toBe("Soon")
    // Most recently expired first — the freshest opportunity.
    expect(expired[0].address).toBe("Gone")
  })
})

describe("coverage gaps", () => {
  it("reports what is unverified rather than hiding it", () => {
    const gaps = coverageGaps({
      total: 1554, article4Unknown: 1402, noEpc: 408, noFloorPlan: 274, noOwner: 1448,
    })
    const a4 = gaps.find((g) => g.label.includes("Article 4"))!
    expect(a4.count).toBe(1402)
    expect(a4.note).toContain("unchecked, not clear")
  })

  it("omits a gap that does not exist rather than showing a zero", () => {
    const gaps = coverageGaps({ total: 100, article4Unknown: 0, noEpc: 5, noFloorPlan: 0, noOwner: 0 })
    expect(gaps).toHaveLength(1)
    expect(gaps[0].label).toContain("EPC")
  })
})
