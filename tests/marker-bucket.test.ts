import { describe, expect, it } from "vitest"
import { article4Unverified, countMarkerBuckets, markerBucket } from "@/lib/properties/marker-bucket"

/**
 * These cases are the ones the legend got wrong. Each was measured against the
 * live table before being written down, so the numbers in the comments are
 * observations, not illustrations.
 */
describe("markerBucket — the cascade the map actually draws", () => {
  it("draws Article 4 red even when the property is licensed", () => {
    // 285 licensed properties are inside an Article 4 area. The old legend
    // counted every one of them under a teal swatch they never render.
    expect(
      markerBucket({ article_4_status: "in_force" as const, hmo_status: "Licensed HMO" })
    ).toBe("article4")
  })

  it("draws Article 4 red even when the licence has lapsed", () => {
    // 85 of the 98 lapsed licences are inside an Article 4 area.
    expect(
      markerBucket({ article_4_status: "in_force" as const, licence_status: "expired" })
    ).toBe("article4")
  })

  it("draws a licensed HMO green when it is also a conversion candidate", () => {
    // The remaining 211 licensed properties lose to the conversion branch,
    // which is why no row in the table could render the teal swatch.
    expect(
      markerBucket({ hmo_status: "Licensed HMO", is_potential_hmo: true })
    ).toBe("conversion")
  })

  it("does not draw amber for a licence that is only expired by date", () => {
    // categorise() calls these lapsed; the marker only reads licence_status,
    // so 12 properties were counted amber and drawn otherwise.
    expect(
      markerBucket({ licence_status: "active", hmo_status: "Licensed HMO" })
    ).toBe("licensed")
  })

  it("gives everything else a bucket rather than dropping it", () => {
    // 95 markers render in a fifth colour the legend never mentioned.
    expect(markerBucket({})).toBe("other")
  })

  it("respects the conversion layer flag", () => {
    expect(markerBucket({ is_potential_hmo: true }, false)).not.toBe("conversion")
  })

  it("treats an unestablished Article 4 position as unverified, not as clear", () => {
    // 942 rows have no position either way; 536 were checked and found outside
    // one. Reading the deprecated boolean made those two look identical.
    expect(article4Unverified({ article_4_status: "unknown" })).toBe(true)
    expect(article4Unverified({})).toBe(true)
    expect(article4Unverified({ article_4_status: "none_found" })).toBe(false)
    expect(article4Unverified({ article_4_status: "in_force" })).toBe(false)
  })

  it("counts unverified across buckets rather than as one of them", () => {
    const counts = countMarkerBuckets([
      { article_4_status: "unknown", is_potential_hmo: true },
      { article_4_status: "none_found", is_potential_hmo: true },
    ])
    expect(counts.conversion).toBe(2)
    expect(counts.unverified).toBe(1)
  })

  it("puts every property in exactly one bucket", () => {
    const properties = [
      { article_4_status: "in_force" as const, hmo_status: "Licensed HMO" },
      { licence_status: "expired" },
      { is_potential_hmo: true },
      { hmo_status: "Licensed HMO" },
      {},
    ]
    const counts = countMarkerBuckets(properties)
    const { unverified, ...buckets } = counts
    const total = Object.values(buckets).reduce((a, b) => a + b, 0)
    expect(total).toBe(properties.length)
    expect(counts.article4).toBe(1)
    expect(counts.expired).toBe(1)
    expect(counts.conversion).toBe(1)
    expect(counts.licensed).toBe(1)
    expect(counts.other).toBe(1)
  })
})
