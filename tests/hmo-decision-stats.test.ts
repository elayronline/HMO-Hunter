import { describe, it, expect } from "vitest"
import {
  computeApprovalStats,
  groupByCouncil,
  boundingBox,
  distanceKm,
  MIN_DECISIONS_FOR_RATE,
  describeApprovalRate,
  type DecisionRow,
} from "@/lib/planning/decision-stats"
import { normaliseApplication, searchApplications } from "@/lib/planning/planit"

function row(over: Partial<DecisionRow> = {}): DecisionRow {
  return {
    kind: "new_small_hmo",
    adds_supply: true,
    app_state: "Permitted",
    decided_date: "2026-07-01",
    council_slug: "bristol",
    occupants: 5,
    ...over,
  }
}

describe("computeApprovalStats", () => {
  it("rates approvals against refusals only", () => {
    const stats = computeApprovalStats([
      row({ app_state: "Permitted" }),
      row({ app_state: "Permitted" }),
      row({ app_state: "Permitted" }),
      row({ app_state: "Rejected" }),
    ])
    expect(stats.permitted).toBe(3)
    expect(stats.rejected).toBe(1)
    expect(stats.approvalRate).toBe(0.75)
  })

  it("accepts 'Refused' as well as 'Rejected'", () => {
    const stats = computeApprovalStats([row({ app_state: "Refused" })])
    expect(stats.rejected).toBe(1)
  })

  // Withdrawn is not a refusal and undecided has not happened. Counting either
  // as a negative would understate how permissive a council actually is.
  it("excludes withdrawn and undecided from the rate", () => {
    const stats = computeApprovalStats([
      row({ app_state: "Permitted" }),
      row({ app_state: "Withdrawn" }),
      row({ app_state: "Undecided" }),
      row({ app_state: null }),
    ])
    expect(stats.decided).toBe(1)
    expect(stats.approvalRate).toBe(1)
    expect(stats.withdrawn).toBe(1)
    expect(stats.pending).toBe(2)
  })

  // The rate answers "can I get permission to create an HMO here". A
  // de-conversion or a certificate of existing use is a decision about
  // something else entirely.
  it("counts only supply-adding applications", () => {
    const stats = computeApprovalStats([
      row({ adds_supply: true, app_state: "Permitted" }),
      row({ adds_supply: false, kind: "reversion", app_state: "Permitted" }),
      row({ adds_supply: false, kind: "existing_use_certificate", app_state: "Permitted" }),
      row({ adds_supply: false, kind: "ancillary", app_state: "Rejected" }),
      row({ adds_supply: false, kind: "unclear", app_state: "Rejected" }),
    ])
    expect(stats.decided).toBe(1)
    expect(stats.approvalRate).toBe(1)
    expect(stats.excluded).toBe(4)
  })

  it("returns null rather than zero when nothing is decided", () => {
    const stats = computeApprovalStats([row({ app_state: "Undecided" })])
    expect(stats.approvalRate).toBeNull()
    expect(stats.approvalRate).not.toBe(0)
  })

  it("flags a sample too thin to mean anything", () => {
    const thin = computeApprovalStats([row(), row()])
    expect(thin.lowConfidence).toBe(true)

    const enough = computeApprovalStats(
      Array.from({ length: MIN_DECISIONS_FOR_RATE }, () => row())
    )
    expect(enough.lowConfidence).toBe(false)
  })

  it("takes the median occupants of permitted applications", () => {
    const stats = computeApprovalStats([
      row({ occupants: 4 }),
      row({ occupants: 6 }),
      row({ occupants: 8 }),
      row({ occupants: 20, app_state: "Rejected" }), // refused, must not count
    ])
    expect(stats.medianOccupants).toBe(6)
  })

  it("handles an empty set without dividing by zero", () => {
    const stats = computeApprovalStats([])
    expect(stats.approvalRate).toBeNull()
    expect(stats.decided).toBe(0)
  })
})

describe("groupByCouncil", () => {
  it("splits stats per council, busiest first", () => {
    const groups = groupByCouncil([
      row({ council_slug: "bristol" }),
      row({ council_slug: "bristol", app_state: "Rejected" }),
      row({ council_slug: "leeds" }),
    ])
    expect(groups[0].councilSlug).toBe("bristol")
    expect(groups[0].decided).toBe(2)
    expect(groups[0].approvalRate).toBe(0.5)
  })

  // A wrong council attribution would corrupt the per-council rate this feature
  // exists to produce, so unresolved rows are dropped rather than guessed.
  it("drops rows with no council attribution", () => {
    const groups = groupByCouncil([row({ council_slug: null }), row({ council_slug: "bristol" })])
    expect(groups).toHaveLength(1)
    expect(groups[0].councilSlug).toBe("bristol")
  })
})

describe("geo helpers", () => {
  it("measures a known distance", () => {
    // Bristol to Bath is roughly 17 km.
    const d = distanceKm(51.4545, -2.5879, 51.3811, -2.3590)
    expect(d).toBeGreaterThan(15)
    expect(d).toBeLessThan(20)
  })

  it("is zero for the same point", () => {
    expect(distanceKm(51.45, -2.58, 51.45, -2.58)).toBe(0)
  })

  it("builds a box that contains the radius", () => {
    const box = boundingBox(51.45, -2.58, 2)
    expect(box.minLat).toBeLessThan(51.45)
    expect(box.maxLat).toBeGreaterThan(51.45)
    expect(distanceKm(51.45, -2.58, box.maxLat, -2.58)).toBeGreaterThanOrEqual(2)
  })

  it("does not produce absurd longitudes near the poles", () => {
    const box = boundingBox(89.99, 0, 50)
    expect(box.minLng).toBeGreaterThanOrEqual(-180)
    expect(box.maxLng).toBeLessThanOrEqual(180)
  })
})

describe("normaliseApplication", () => {
  it("maps a PlanIt record onto our shape", () => {
    const app = normaliseApplication({
      name: "Enfield/26/03113/CND",
      uid: "26/03113/CND",
      area_name: "Enfield",
      description: "Change of use to HMO",
      app_state: "Permitted",
      app_type: "Full",
      start_date: "2026-07-22",
      decided_date: "2026-07-30",
      address: "52 Exeter Road London N9 0JG",
      postcode: "N9 0JG",
      location_x: -0.049734,
      location_y: 51.626132,
      url: "https://council.example/app",
      link: "https://www.planit.org.uk/planapplic/Enfield/26/03113/CND/",
    })

    expect(app?.name).toBe("Enfield/26/03113/CND")
    expect(app?.councilName).toBe("Enfield")
    expect(app?.decidedDate).toBe("2026-07-30")
    expect(app?.longitude).toBeCloseTo(-0.049734)
    expect(app?.councilUrl).toBe("https://council.example/app")
  })

  it("falls back to GeoJSON coordinates", () => {
    const app = normaliseApplication({
      name: "X/1",
      location: { type: "Point", coordinates: [-1.5, 52.9] },
    })
    expect(app?.longitude).toBe(-1.5)
    expect(app?.latitude).toBe(52.9)
  })

  it("truncates timestamps to dates and survives missing fields", () => {
    const app = normaliseApplication({ name: "X/1", decided_date: "2026-07-30T09:57:51.218464" })
    expect(app?.decidedDate).toBe("2026-07-30")
    expect(app?.postcode).toBeNull()
    expect(app?.longitude).toBeNull()
  })

  it("rejects a record with no key", () => {
    expect(normaliseApplication({ description: "no name" })).toBeNull()
    expect(normaliseApplication(null)).toBeNull()
  })
})

describe.skipIf(process.env.CI)("PlanIt live", () => {
  it("returns decided HMO applications with the fields we depend on", async () => {
    const result = await searchApplications({
      search: "house in multiple occupation",
      appState: "Permitted",
      limit: 50,
    })

    expect(result.applications.length).toBeGreaterThan(10)

    const withCoords = result.applications.filter((a) => a.longitude !== null && a.latitude !== null)
    const withCouncil = result.applications.filter((a) => a.councilName)
    const withPortal = result.applications.filter((a) => a.councilUrl)

    // These three drive the map layer, the per-council rate and attribution.
    expect(withCoords.length / result.applications.length).toBeGreaterThan(0.8)
    expect(withCouncil.length).toBe(result.applications.length)
    expect(withPortal.length / result.applications.length).toBeGreaterThan(0.8)

    // Breadth is the whole reason for using PlanIt over the government feed,
    // which carries four councils.
    expect(new Set(result.applications.map((a) => a.councilName)).size).toBeGreaterThan(10)
  }, 120_000)
})

describe("describeApprovalRate", () => {
  const withRate = (permitted: number, rejected: number) =>
    describeApprovalRate(
      computeApprovalStats([
        ...Array.from({ length: permitted }, () => row({ app_state: "Permitted" })),
        ...Array.from({ length: rejected }, () => row({ app_state: "Rejected" })),
      ])
    )

  it("bands the rate from routinely granted to rarely granted", () => {
    expect(withRate(9, 1).band).toBe("routinely_granted")
    expect(withRate(7, 3).band).toBe("usually_granted")
    expect(withRate(5, 5).band).toBe("mixed")
    expect(withRate(2, 8).band).toBe("often_refused")
    expect(withRate(1, 20).band).toBe("rarely_granted")
  })

  // Enfield granted 2 of 46 in live data. That has to read as a barrier, not as
  // a neutral statistic.
  it("marks a de facto barrier as rarely granted", () => {
    const d = withRate(2, 44)
    expect(d.band).toBe("rarely_granted")
    expect(d.summary).toMatch(/2 of 46 decided applications approved \(4%\)/)
  })

  // The recurring failure mode: an absence must never render as a refusal.
  it("describes no decisions as unknown, never as zero approval", () => {
    const d = describeApprovalRate(computeApprovalStats([]))
    expect(d.band).toBe("unknown")
    expect(d.summary).toMatch(/not evidence that permission would be refused/i)
    expect(d.summary).not.toMatch(/0%/)
  })

  it("leads with counts and flags a small sample", () => {
    const d = withRate(3, 1)
    expect(d.summary).toMatch(/^3 of 4 decided applications approved \(75%\)/)
    expect(d.summary).toMatch(/small sample/i)
  })

  it("stays descriptive rather than advisory", () => {
    for (const [p, r] of [[9, 1], [1, 9], [5, 5]]) {
      const d = withRate(p, r)
      expect(d.summary).not.toMatch(/\byou should\b|\bwe recommend\b|\bavoid\b|\bgood investment\b/i)
    }
  })
})
