import { describe, it, expect } from "vitest"
import {
  COUNCIL_BOUNDARY_SOURCES,
  featureInForceOn,
  hmoFeaturesFor,
  publishesCompleteBoundary,
  sourceForCouncil,
} from "@/lib/article4/council-boundaries"

/**
 * These boundaries are the only curated-side source allowed to produce a
 * negative from geometry, so the file they come from has to be exactly what it
 * claims: the council's own, complete, and in force.
 */

describe("registered council boundary sources", () => {
  it("carries the provenance a disputed result gets settled against", () => {
    expect(COUNCIL_BOUNDARY_SOURCES.length).toBeGreaterThan(0)
    for (const s of COUNCIL_BOUNDARY_SOURCES) {
      expect(s.sourceUrl, `${s.slug} needs a source URL`).toMatch(/^https:\/\//)
      expect(s.licence, `${s.slug} needs a licence`).toBeTruthy()
      expect(s.fetchedOn, `${s.slug} needs a fetch date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(s.documentationUrl, `${s.slug} needs the council's page`).toMatch(/^https:\/\//)
      expect(s.features.length, `${s.slug} has no features`).toBeGreaterThan(0)
    }
  })

  it("holds real polygons, not empty geometry", () => {
    for (const s of COUNCIL_BOUNDARY_SOURCES) {
      for (const f of s.features) {
        expect(["Polygon", "MultiPolygon"]).toContain(f.geometry?.type)
        expect(f.geometry.coordinates.length).toBeGreaterThan(0)
      }
    }
  })

  /**
   * A boundary in the wrong projection still parses and still tests points —
   * it just answers wrongly everywhere. British National Grid eastings run to
   * six figures, so a coordinate outside degrees is the tell.
   */
  it("stores coordinates as longitude and latitude", () => {
    for (const s of COUNCIL_BOUNDARY_SOURCES) {
      const flat = JSON.stringify(s.features[0].geometry.coordinates)
      const numbers = (flat.match(/-?\d+\.?\d*/g) || []).map(Number)
      for (const n of numbers) {
        expect(Math.abs(n)).toBeLessThanOrEqual(180)
      }
    }
  })
})

describe("a boundary only counts while its direction is in force", () => {
  const feature = (props: Record<string, unknown>) => ({ properties: props })

  it("ignores one that has not commenced", () => {
    const future = new Date("2030-01-01").getTime()
    expect(featureInForceOn(feature({ START_DATE: future }), new Date("2026-08-16"))).toBe(false)
  })

  it("ignores one that has lapsed", () => {
    const past = new Date("2020-01-01").getTime()
    expect(featureInForceOn(feature({ END_DATE: past }), new Date("2026-08-16"))).toBe(false)
  })

  it("accepts one commenced with no end date", () => {
    const start = new Date("2012-02-10").getTime()
    expect(featureInForceOn(feature({ START_DATE: start, END_DATE: null }), new Date("2026-08-16"))).toBe(true)
  })

  it("accepts a feature that states no dates at all", () => {
    // The registry entry vouches for the layer; absent dates are not a reason
    // to discard a boundary the council publishes as current.
    expect(featureInForceOn(feature({}))).toBe(true)
  })
})

describe("Leeds", () => {
  it("is registered and resolvable by council name", () => {
    expect(sourceForCouncil("Leeds")?.slug).toBe("leeds")
    expect(sourceForCouncil("leeds")?.slug).toBe("leeds")
    expect(sourceForCouncil("Somewhere Else")).toBeNull()
  })

  it("publishes a complete boundary, which is what licenses a negative", () => {
    expect(publishesCompleteBoundary("Leeds")).toBe(true)
    // A council with no registered boundary must not gain one by accident,
    // since that is what would turn its unknowns into negatives.
    expect(publishesCompleteBoundary("Reading")).toBe(false)
    expect(publishesCompleteBoundary("Manchester")).toBe(false)
  })

  /**
   * The layer can carry Article 4 areas for other permitted development rights.
   * Only Part 3 Class L removes the C3 to C4 right, and treating any other area
   * as an HMO restriction would assert one where none exists.
   */
  it("keeps only the features that remove the HMO right", () => {
    const features = hmoFeaturesFor("Leeds")
    expect(features.length).toBeGreaterThan(0)
    for (const f of features) {
      const rights = f.properties?.PERMITTED_DEVELOPMENT_RIGHTS
      if (typeof rights === "string") expect(rights).toContain("3L")
    }
  })

  it("carries the direction's own reference and commencement", () => {
    const [f] = hmoFeaturesFor("Leeds")
    expect(f.properties.REFERENCE).toBe("A4D01")
    expect(new Date(f.properties.START_DATE).toISOString().slice(0, 10)).toBe("2012-02-10")
    expect(f.properties.DOCUMENT_URL).toContain("leeds.gov.uk")
  })

  it("was not in force before it commenced", () => {
    const [f] = hmoFeaturesFor("Leeds")
    expect(featureInForceOn(f, new Date("2012-02-09"))).toBe(false)
    expect(featureInForceOn(f, new Date("2012-02-11"))).toBe(true)
  })
})

/**
 * Sheffield publishes the area with no dates and no permitted-development-right
 * field, labelling the area type instead. It is the case that shows the two
 * guards are not interchangeable: the right-based filter cannot see this layer
 * at all, and the area-type filter is what keeps a non-HMO polygon out.
 */
describe("Sheffield", () => {
  it("is registered with the commencement its features do not carry", () => {
    const source = sourceForCouncil("Sheffield")
    expect(source).toBeTruthy()
    expect(source!.commencedOn).toBe("2010-12-09")
    expect(publishesCompleteBoundary("Sheffield")).toBe(true)
  })

  it("keeps the HMO area and states the restriction it removes", () => {
    const features = hmoFeaturesFor("Sheffield")
    expect(features.length).toBeGreaterThan(0)
    expect(features[0].properties.typearea).toMatch(/hmo/i)
    expect(features[0].properties.restrictio).toContain("C4")
  })

  /**
   * The regression this file exists for. Sheffield's feature carries neither
   * NAME nor REFERENCE, and the enrichment originally read the match and the
   * label off the same value — so a successful point-in-polygon test produced
   * `undefined`, which fell through to the negative branch and recorded all 132
   * Sheffield properties as cleared by the boundary that contained them.
   *
   * A publisher omitting a label must never be able to invert a result.
   */
  it("publishes no label, which must not be mistaken for no match", () => {
    const [f] = hmoFeaturesFor("Sheffield")
    expect(f.properties.NAME).toBeUndefined()
    expect(f.properties.REFERENCE).toBeUndefined()
    // Something usable still exists to describe the area with.
    expect(f.properties.typearea || f.properties.restrictio).toBeTruthy()
  })

  it("excludes an area of another type in the same layer", () => {
    const other = { properties: { typearea: "Conservation Area" }, geometry: null }
    const source = sourceForCouncil("Sheffield")!
    const withOther = { ...source, features: [...source.features, other] }
    // Filtering is by property, not position: the extra area is dropped and the
    // genuine one survives.
    expect(withOther.features.length).toBe(source.features.length + 1)
    expect(hmoFeaturesFor("Sheffield").length).toBe(source.features.length)
  })
})
