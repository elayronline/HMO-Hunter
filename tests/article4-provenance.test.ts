import { describe, it, expect } from "vitest"
import {
  SOURCES,
  isRedistributable,
  sourced,
  withholdField,
  forRedistribution,
  type SourceId,
} from "@/lib/article4/provenance"
import {
  buildCouncilAssessment,
  buildCaveats,
  jurisdictionFromGss,
  ENGLAND_HMO_USE_CLASSES,
} from "@/lib/article4/assessment"
import type { CouncilRecord } from "@/lib/article4/registry"

function council(over: Partial<CouncilRecord> = {}): CouncilRecord {
  return {
    slug: "example",
    name: "Example",
    gssCode: "E08000001",
    matchKey: "example",
    organisationEntity: 1,
    publishesHmoArticle4: false,
    directionsNotYetInForce: 0,
    nextCommencementDate: null,
    directionsExpired: 0,
    hasClassMaArticle4InForce: false,
    classMaDirectionCount: 0,
    provisionalPastDeadline: null,
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

describe("redistribution rights", () => {
  it("permits the open-licensed sources", () => {
    expect(isRedistributable("planning.data.gov.uk")).toBe(true)
    expect(isRedistributable("council-website")).toBe(true)
    expect(isRedistributable("manual-verification")).toBe(true)
    expect(isRedistributable("llm-extraction")).toBe(true)
  })

  // The commercial trap: these are usable in the product but reselling them is
  // a licence breach, so the boundary is enforced in code rather than remembered.
  it("refuses the commercial sources", () => {
    expect(isRedistributable("searchland")).toBe(false)
    expect(isRedistributable("kamma")).toBe(false)
  })

  it("fails closed on an unknown or missing source", () => {
    expect(isRedistributable(null)).toBe(false)
    expect(isRedistributable(undefined)).toBe(false)
    expect(isRedistributable("something-else" as SourceId)).toBe(false)
  })

  it("derives the flag from policy rather than the caller", () => {
    const field = sourced({ value: true, source: "searchland" })
    expect(field.redistributable).toBe(false)
  })

  it("keeps every declared source's policy explicit", () => {
    for (const [id, policy] of Object.entries(SOURCES)) {
      expect(typeof policy.redistributable, id).toBe("boolean")
      expect(typeof policy.authoritative, id).toBe("boolean")
    }
  })
})

describe("sourced()", () => {
  const at = "2026-08-10T00:00:00.000Z"

  it("treats an authoritative source as verified", () => {
    const f = sourced({ value: true, source: "planning.data.gov.uk", retrievedAt: at })
    expect(f.confidence).toBe("verified")
    expect(f.value).toBe(true)
  })

  it("will not let extraction claim verified without a human sign-off", () => {
    const f = sourced({
      value: "city-wide",
      source: "llm-extraction",
      sourceQuote: "the direction applies to the whole district",
      sourceUrl: "https://example.gov.uk/a4.pdf",
      confidence: "verified",
    })
    expect(f.confidence).toBe("reported")
  })

  it("accepts verified extraction once a human has signed it off", () => {
    const f = sourced({
      value: "city-wide",
      source: "llm-extraction",
      sourceQuote: "applies to the whole district",
      sourceUrl: "https://example.gov.uk/a4.pdf",
      confidence: "verified",
      verifiedAt: at,
    })
    expect(f.confidence).toBe("verified")
  })

  // The anti-hallucination gate: an extracted claim with no evidence is not a
  // fact, so it never reaches a consumer as one.
  it("discards values from quote-requiring sources that cite nothing", () => {
    const f = sourced({ value: "city-wide", source: "llm-extraction" })
    expect(f.value).toBeNull()
    expect(f.confidence).toBe("unknown")
  })

  it("returns unknown when there is no value", () => {
    for (const v of [null, undefined]) {
      expect(sourced({ value: v, source: "planning.data.gov.uk" }).confidence).toBe("unknown")
    }
  })

  it("returns unknown when there is no source", () => {
    const f = sourced({ value: true })
    expect(f.confidence).toBe("unknown")
    expect(f.value).toBeNull()
    expect(f.redistributable).toBe(false)
  })
})

describe("withholding", () => {
  it("suppresses the value but marks why", () => {
    const held = withholdField(sourced({ value: true, source: "searchland" }))
    expect(held.value).toBeNull()
    expect(held.withheld).toBe("source-licence")
  })

  // Withheld must never be mistaken for a negative — that is the same failure
  // that made article_4_area = false meaningless.
  it("distinguishes withheld from simply unknown", () => {
    const held = withholdField(sourced({ value: true, source: "kamma" }))
    const absent = sourced<boolean>({ value: null, source: "planning.data.gov.uk" })
    expect(held.withheld).toBe("source-licence")
    expect(absent.withheld).toBeUndefined()
    expect(held.value).toBeNull()
    expect(absent.value).toBeNull()
  })

  it("leaves redistributable fields untouched", () => {
    const open = sourced({ value: true, source: "planning.data.gov.uk" })
    expect(withholdField(open)).toEqual(open)
  })

  it("strips restricted fields anywhere in a nested payload", () => {
    const payload = {
      open: sourced({ value: "yes", source: "planning.data.gov.uk" }),
      closed: sourced({ value: "secret", source: "searchland" }),
      nested: { inner: sourced({ value: "secret", source: "kamma" }) },
      list: [{ deep: sourced({ value: "secret", source: "searchland" }) }],
    }
    const out = forRedistribution(payload)
    expect(out.open.value).toBe("yes")
    expect(out.closed.value).toBeNull()
    expect(out.nested.inner.value).toBeNull()
    expect(out.list[0].deep.value).toBeNull()
    expect(out.list[0].deep.withheld).toBe("source-licence")
  })

  it("leaves plain non-envelope values alone", () => {
    const out = forRedistribution({ slug: "bristol", count: 7, tags: ["a", "b"] })
    expect(out).toEqual({ slug: "bristol", count: 7, tags: ["a", "b"] })
  })
})

describe("jurisdiction", () => {
  it("reads the regime from the GSS prefix", () => {
    expect(jurisdictionFromGss("E08000003")).toBe("england")
    expect(jurisdictionFromGss("W06000015")).toBe("wales")
    expect(jurisdictionFromGss("S12000036")).toBe("scotland")
    expect(jurisdictionFromGss(null)).toBe("unknown")
  })
})

describe("buildCouncilAssessment", () => {
  it("asserts a positive only where boundaries exist", () => {
    const a = buildCouncilAssessment(
      council({ coverageLevel: "boundaries", publishesHmoArticle4: true, areaCountWithGeometry: 7 })
    )
    expect(a.hmoArticle4.value).toBe(true)
    expect(a.hmoArticle4.confidence).toBe("verified")
  })

  // The central rule, restated at the API boundary: nothing published means we
  // do not know, never that the council is clear.
  it("never returns false for a council that publishes nothing", () => {
    const a = buildCouncilAssessment(council({ coverageLevel: "none" }))
    expect(a.hmoArticle4.value).not.toBe(false)
    expect(a.hmoArticle4.value).toBeNull()
    expect(a.hmoArticle4.confidence).toBe("unknown")
  })

  it("warns that a directions-only council cannot be mapped", () => {
    const a = buildCouncilAssessment(
      council({ name: "Crawley", coverageLevel: "directions_only", directionCount: 10, publishesHmoArticle4: true })
    )
    expect(a.caveats.join(" ")).toMatch(/no boundary data/i)
    expect(a.caveats.join(" ")).toMatch(/restricted until/i)
  })

  it("warns that absence from the dataset proves nothing", () => {
    const a = buildCouncilAssessment(council({ name: "Manchester", coverageLevel: "none" }))
    expect(a.caveats.join(" ")).toMatch(/not evidence that none exists/i)
  })

  it("only applies England's thresholds to English authorities", () => {
    expect(buildCouncilAssessment(council({ gssCode: "E08000003" })).useClasses).toEqual(
      ENGLAND_HMO_USE_CLASSES
    )
    const welsh = buildCouncilAssessment(council({ gssCode: "W06000015" }))
    expect(welsh.useClasses).toBeNull()
    expect(welsh.caveats.join(" ")).toMatch(/Wales operates its own/i)
  })

  it("states the statutory thresholds users actually need", () => {
    const text = JSON.stringify(ENGLAND_HMO_USE_CLASSES)
    expect(text).toMatch(/3-6 unrelated occupants/)
    expect(text).toMatch(/7 or more unrelated occupants/)
    expect(text).toMatch(/Class L/)
    expect(text).toMatch(/Sui generis/i)
  })

  it("keeps planning and licensing separate", () => {
    const a = buildCouncilAssessment(council())
    expect(a.licensingNote).toMatch(/separate regimes/i)
    expect(a.disclaimer).toMatch(/confirmed with the local planning authority/i)
  })

  it("survives redistribution filtering intact, since all of it is open data", () => {
    const a = buildCouncilAssessment(
      council({ coverageLevel: "boundaries", publishesHmoArticle4: true, areaCountWithGeometry: 3 })
    )
    const out = forRedistribution(a)
    expect(out.hmoArticle4.value).toBe(true)
    expect(out.hmoArticle4.withheld).toBeUndefined()
  })

  it("caveats a boundary-only council with no published directions", () => {
    const caveats = buildCaveats(
      council({ coverageLevel: "boundaries", areaCountWithGeometry: 2, directionCount: 0 }),
      "england"
    )
    expect(caveats.join(" ")).toMatch(/commencement dates and source documents may be incomplete/i)
  })
})

// A direction that binds nobody today must never read as one that does. The
// buyer-facing failure is symmetric and both directions are costly: reporting a
// future direction as live tells someone they need permission they do not need;
// hiding it entirely lets them complete a purchase weeks before it starts.
describe("announced versus in force", () => {
  it("does not assert an Article 4 for a direction that has not commenced", () => {
    const assessment = buildCouncilAssessment(
      council({
        name: "Preston",
        coverageLevel: "directions_only",
        publishesHmoArticle4: true,
        hasHmoArticle4InForce: false,
        directionsNotYetInForce: 1,
        nextCommencementDate: "2027-02-15",
        directionCount: 1,
      })
    )

    expect(assessment.hmoArticle4.value).toBeNull()
    expect(assessment.nextCommencement.value).toBe("2027-02-15")
  })

  it("warns with the commencement date so the reader can act on it", () => {
    const caveats = buildCaveats(
      council({
        name: "Preston",
        publishesHmoArticle4: true,
        hasHmoArticle4InForce: false,
        directionsNotYetInForce: 1,
        nextCommencementDate: "2027-02-15",
        coverageLevel: "directions_only",
      }),
      "england"
    )

    const warning = caveats.find((c) => c.includes("not yet in force"))
    expect(warning).toBeDefined()
    expect(warning).toContain("2027-02-15")
    expect(warning).toContain("No permission is required on that basis today")
  })

  it("still asserts an Article 4 where one is actually in force", () => {
    const assessment = buildCouncilAssessment(
      council({
        name: "Sheffield",
        coverageLevel: "boundaries",
        publishesHmoArticle4: true,
        hasHmoArticle4InForce: true,
        areaCountWithGeometry: 1,
      })
    )

    expect(assessment.hmoArticle4.value).toBe(true)
  })

  it("flags a lapsed direction rather than presenting it as current", () => {
    const caveats = buildCaveats(
      council({
        name: "Example",
        publishesHmoArticle4: true,
        hasHmoArticle4InForce: false,
        directionsExpired: 2,
        coverageLevel: "directions_only",
      }),
      "england"
    )

    expect(caveats.some((c) => c.includes("lapsed"))).toBe(true)
  })
})
