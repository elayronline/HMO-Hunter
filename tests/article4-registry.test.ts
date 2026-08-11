import { describe, it, expect } from "vitest"
import {
  toSlug,
  isHmoRelated,
  dateRange,
  forceStateOn,
  coveredKeysFromRegistry,
  directionOnlyKeysFromRegistry,
  buildCouncilRegistry,
  HMO_PATTERN,
  type CouncilRecord,
} from "@/lib/article4/registry"

function council(over: Partial<CouncilRecord> = {}): CouncilRecord {
  return {
    slug: "example",
    name: "Example",
    gssCode: "E00000001",
    matchKey: "example",
    organisationEntity: 1,
    publishesHmoArticle4: false,
    directionsNotYetInForce: 0,
    nextCommencementDate: null,
    directionsExpired: 0,
    coverageLevel: "none",
    areaCount: 0,
    areaCountWithGeometry: 0,
    directionCount: 0,
    earliestCommencement: null,
    latestCommencement: null,
    documentUrls: [],
    directions: [],
    source: "planning.data.gov.uk",
    retrievedAt: "2026-08-10T00:00:00.000Z",
    ...over,
    // A council that publishes a direction is treated as having it in force
    // unless a test says otherwise, so cases written before force state was
    // modelled still mean what they meant. Anything testing the announced /
    // in-force distinction passes the flag explicitly.
    hasHmoArticle4InForce:
      over.hasHmoArticle4InForce ?? over.publishesHmoArticle4 ?? false,
  }
}

describe("toSlug", () => {
  it("produces readable, stable URL segments", () => {
    expect(toSlug("Newcastle upon Tyne")).toBe("newcastle-upon-tyne")
    expect(toSlug("Bristol, City of")).toBe("bristol")
    expect(toSlug("London Borough of Southwark")).toBe("southwark")
    expect(toSlug("Royal Borough of Kingston upon Thames")).toBe("kingston-upon-thames")
  })

  it("gives the same slug to both spellings of one council", () => {
    expect(toSlug("Bristol City Council")).toBe(toSlug("Bristol, City of"))
    expect(toSlug("Newcastle City Council")).toBe(toSlug("Newcastle upon Tyne"))
  })

  it("never emits leading, trailing or repeated hyphens", () => {
    for (const n of ["City of York Council", "  Leeds  ", "Bristol, City of"]) {
      const s = toSlug(n)
      expect(s).not.toMatch(/^-|-$|--/)
    }
  })
})

describe("isHmoRelated", () => {
  it("matches the ways councils describe HMO directions", () => {
    expect(isHmoRelated({ notes: "Housing in Multiple Occupation (HMO) Article 4" })).toBe(true)
    expect(isHmoRelated({ description: "Restricts change of use from C3 to C4" })).toBe(true)
    expect(isHmoRelated({ name: "Small HMO direction" })).toBe(true)
    expect(isHmoRelated({ description: "withdrawal of Class C4 permitted development" })).toBe(true)
  })

  it("rejects directions about something else", () => {
    expect(isHmoRelated({ name: "Agricultural land direction" })).toBe(false)
    expect(isHmoRelated({ description: "Demolition of boundary walls" })).toBe(false)
    expect(isHmoRelated({})).toBe(false)
  })

  it("excludes records that mention HMOs incidentally", () => {
    expect(isHmoRelated({ description: "caravan site with multiple occupation" })).toBe(false)
  })

  it("is case insensitive", () => {
    expect(HMO_PATTERN.test("HOUSES IN MULTIPLE OCCUPATION")).toBe(true)
  })
})

describe("dateRange", () => {
  it("finds the span, ignoring nulls", () => {
    expect(dateRange(["2016-02-25", null, "2011-11-25", undefined, "2024-10-14"])).toEqual({
      earliest: "2011-11-25",
      latest: "2024-10-14",
    })
  })

  it("returns nulls when nothing is dated", () => {
    expect(dateRange([null, undefined])).toEqual({ earliest: null, latest: null })
  })
})

describe("coverage gating", () => {
  const registry = [
    council({ slug: "bristol", matchKey: "bristol", coverageLevel: "boundaries", areaCountWithGeometry: 7 }),
    council({ slug: "crawley", matchKey: "crawley", coverageLevel: "directions_only", directionCount: 10 }),
    council({ slug: "manchester", matchKey: "manchester", coverageLevel: "none" }),
  ]

  it("only councils with testable geometry can produce a negative", () => {
    expect([...coveredKeysFromRegistry(registry)]).toEqual(["bristol"])
  })

  // Crawley publishes 10 HMO Article 4 directions and no boundaries. Counting it
  // as covered would assert "no Article 4 here" across a council we know is
  // restricted — a worse failure than the original bug.
  it("excludes councils that publish directions but no boundaries", () => {
    const covered = coveredKeysFromRegistry(registry)
    expect(covered.has("crawley")).toBe(false)
    expect(directionOnlyKeysFromRegistry(registry).has("crawley")).toBe(true)
  })

  it("keeps the two sets disjoint", () => {
    const covered = coveredKeysFromRegistry(registry)
    const directionOnly = directionOnlyKeysFromRegistry(registry)
    expect([...covered].filter((k) => directionOnly.has(k))).toEqual([])
  })

  it("treats councils publishing nothing as uncovered", () => {
    expect(coveredKeysFromRegistry(registry).has("manchester")).toBe(false)
    expect(directionOnlyKeysFromRegistry(registry).has("manchester")).toBe(false)
  })
})

/**
 * Live build. Guards the joins across three datasets that share no foreign keys
 * and spell council names differently — the part most likely to rot upstream.
 * Skipped in CI to avoid network flake.
 */
describe.skipIf(process.env.CI)("buildCouncilRegistry against live planning data", () => {
  it("builds a coherent registry", async () => {
    const registry = await buildCouncilRegistry()

    expect(registry.length).toBeGreaterThan(300) // ~344 LPAs, minus duplicate slugs

    // Slugs are primary keys; a collision would silently merge two councils.
    expect(new Set(registry.map((c) => c.slug)).size).toBe(registry.length)

    // The invariant the whole feature rests on.
    const wrong = registry.filter((c) => c.coverageLevel === "boundaries" && c.areaCountWithGeometry === 0)
    expect(wrong, "councils marked testable with no geometry").toEqual([])

    const covered = coveredKeysFromRegistry(registry)
    const directionOnly = directionOnlyKeysFromRegistry(registry)
    expect(covered.size).toBeGreaterThan(20)
    expect([...covered].filter((k) => directionOnly.has(k))).toEqual([])

    // Councils with known city-wide HMO Article 4 that publish nothing to the
    // national feed must not be marked covered.
    for (const slug of ["manchester", "leeds", "nottingham", "sheffield"]) {
      const c = registry.find((x) => x.slug === slug)
      expect(c, `${slug} missing from LPA list`).toBeDefined()
      expect(c!.coverageLevel, `${slug} must not be treated as covered`).not.toBe("boundaries")
    }

    // Directions are the citation backbone — most should carry a source URL.
    const withDirections = registry.filter((c) => c.directionCount > 0)
    const withDocs = withDirections.filter((c) => c.documentUrls.length > 0)
    expect(withDocs.length / withDirections.length).toBeGreaterThan(0.7)
  }, 180_000)
})

// Announced is not in force. Verifying the gold set against council websites on
// 2026-08-11 found this to be the dominant real-world error: of the first ten
// councils checked, Preston had a direction made 29 January 2026 that does not
// commence until 15 February 2027, and Stoke-on-Trent's was only proposed. Both
// were recorded as live restrictions. Before `forceStateOn` the registry read
// start-date and end-date from the feed and then never consulted either.
describe("forceStateOn", () => {
  const today = new Date("2026-08-11T09:00:00.000Z")

  it("a direction that has commenced and not ended is in force", () => {
    expect(forceStateOn("2011-12-10", null, today)).toBe("in_force")
  })

  it("a direction commencing in the future is made, not in force", () => {
    expect(forceStateOn("2027-02-15", null, today)).toBe("made_not_in_force")
  })

  it("a direction whose end date has passed is expired", () => {
    expect(forceStateOn("2011-12-10", "2020-01-01", today)).toBe("expired")
  })

  it("treats an undated direction as in force, because omitting the start date is common and dropping it would lose a real restriction", () => {
    expect(forceStateOn(null, null, today)).toBe("in_force")
  })

  it("still restricts on its commencement day and on its end day", () => {
    expect(forceStateOn("2026-08-11", null, today)).toBe("in_force")
    expect(forceStateOn("2011-12-10", "2026-08-11", today)).toBe("in_force")
  })

  it("expires the day after the end date, not before", () => {
    expect(forceStateOn("2011-12-10", "2026-08-10", today)).toBe("expired")
  })
})

// The bare `hmo` alternative used to match inside place names. Ten records in
// the live feed were affected, and four of them ("Richmond Road", a commercial
// to residential direction) made Kingston upon Thames read as an HMO Article 4
// council — a false positive, which is the one failure mode this pipeline is
// otherwise incapable of. Kingston's own list of directions contains no HMO one.
describe("isHmoRelated does not match place names containing 'hmo'", () => {
  const notHmo = [
    { name: "Richmond Road", description: "Article 4 Direction for commercial, business and service use to residential use" },
    { name: "Winchmore Hill", description: "Winchmore Hill Conservation Area" },
    { name: "Rochmount, St Annes Crescent, L17", description: "incomplete data" },
    { name: "Land bounded by Parkhurst Road/Wandsworth Road/Ellergreen Road/Rushmore Road", description: null },
    { name: "Land at the Junction of Beach Road and Richmond Street, Weston-super-Mare", description: "Restrictions on the use of land" },
    { name: "Former Vicarage adjoining Land at Richmond Park, L6", description: null },
  ]

  for (const entity of notHmo) {
    it(`rejects "${entity.name.slice(0, 40)}"`, () => {
      expect(isHmoRelated(entity)).toBe(false)
    })
  }

  // The boundary must not cost us the plural, which is how councils usually
  // write it. Dropping a real direction is worse than the bug being fixed.
  it("still matches the plural and the parenthesised forms councils actually use", () => {
    expect(isHmoRelated({ name: "Article 4 for HMOs" })).toBe(true)
    expect(isHmoRelated({ name: "HMOs Mutley, Greenbank, City Centre and surrounding areas" })).toBe(true)
    expect(isHmoRelated({ name: "Small HMO Article 4 Direction" })).toBe(true)
    expect(isHmoRelated({ name: "Houses in Multiple Occupation (HMO) Direction" })).toBe(true)
    expect(isHmoRelated({ name: "Change of use C3 to C4" })).toBe(true)
  })
})
