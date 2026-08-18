import { describe, expect, it } from "vitest"
import { countMarkerBuckets, markerBucket } from "@/lib/properties/marker-bucket"

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
      markerBucket({ article_4_area: true, hmo_status: "Licensed HMO" })
    ).toBe("article4")
  })

  it("draws Article 4 red even when the licence has lapsed", () => {
    // 85 of the 98 lapsed licences are inside an Article 4 area.
    expect(
      markerBucket({ article_4_area: true, licence_status: "expired" })
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

  it("puts every property in exactly one bucket", () => {
    const properties = [
      { article_4_area: true, hmo_status: "Licensed HMO" },
      { licence_status: "expired" },
      { is_potential_hmo: true },
      { hmo_status: "Licensed HMO" },
      {},
    ]
    const counts = countMarkerBuckets(properties)
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    expect(total).toBe(properties.length)
    expect(counts).toEqual({
      article4: 1,
      expired: 1,
      conversion: 1,
      licensed: 1,
      other: 1,
    })
  })
})
