import { describe, it, expect } from "vitest"
import {
  curatedCouncils,
  curatedBySlug,
  assessCurated,
  applyCuratedOverlay,
  ARTICLE4_SOURCE_COUNCIL_VERIFIED,
} from "@/lib/article4/curated"
import type { CouncilRecord } from "@/lib/article4/registry"
import { buildCaveats } from "@/lib/article4/assessment"
import goldSetJson from "@/lib/article4/eval/gold-set.json"

function record(over: Partial<CouncilRecord> = {}): CouncilRecord {
  return {
    slug: "example",
    name: "Example",
    gssCode: "E00000001",
    matchKey: "example",
    organisationEntity: null,
    publishesHmoArticle4: false,
    hasHmoArticle4InForce: false,
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
    retrievedAt: "2026-08-11T00:00:00.000Z",
    ...over,
  }
}

describe("curated file", () => {
  it("carries a quote and a council source for every direction", () => {
    for (const council of curatedCouncils()) {
      for (const d of council.directions) {
        expect(d.quote, `${council.slug} quote`).toBeTruthy()
        expect(d.sourceUrl, `${council.slug} source`).toMatch(/^https:\/\//)
        // planning.data.gov.uk is what the pipeline reads. Citing it here would
        // make the overlay a mirror of the feed rather than knowledge added to it.
        expect(d.sourceUrl, `${council.slug} must not cite the feed`).not.toContain(
          "planning.data.gov.uk"
        )
      }
    }
  })

  it("covers the councils the feed misses", () => {
    for (const slug of ["manchester", "leeds", "sheffield", "nottingham", "durham", "middlesbrough"]) {
      expect(curatedBySlug(slug), slug).not.toBeNull()
    }
  })
})

// Durham confirmed a countywide direction commencing 17 August 2026. Because
// force is derived from the date on every read, nothing has to run that morning
// for it to take effect — which is the whole reason the date is stored rather
// than a boolean.
describe("Durham's countywide direction commences on its own", () => {
  const durham = curatedBySlug("durham")!

  it("is not in force the day before", () => {
    const before = assessCurated(durham, new Date("2026-08-16T23:00:00.000Z"))
    const countywide = before.states.find((s) => s.direction.extent === "Whole of County Durham")
    expect(countywide?.state).toBe("made_not_in_force")
    expect(before.nextCommencementDate).toBe("2026-08-17")
  })

  it("is in force on the day, with no refresh in between", () => {
    const after = assessCurated(durham, new Date("2026-08-17T06:00:00.000Z"))
    const countywide = after.states.find((s) => s.direction.extent === "Whole of County Durham")
    expect(countywide?.state).toBe("in_force")
    expect(after.extents).toContain("Whole of County Durham")
  })

  // The defined-area directions have applied since 2016 and are unaffected.
  it("still reports the pre-existing city directions before the countywide one starts", () => {
    const before = assessCurated(durham, new Date("2026-08-16T23:00:00.000Z"))
    expect(before.inForce).toBe(true)
  })
})

describe("applyCuratedOverlay", () => {
  it("turns a council the feed knows nothing about into a known restriction", () => {
    const out = applyCuratedOverlay(record({ slug: "manchester", name: "Manchester" }))

    expect(out.hasHmoArticle4InForce).toBe(true)
    expect(out.coverageLevel).toBe("directions_only")
    expect(out.source).toBe(ARTICLE4_SOURCE_COUNCIL_VERIFIED)
  })

  // The point of directions_only: we know the council restricts, but without a
  // polygon we cannot say whether a given property sits inside the boundary.
  // Promoting to `boundaries` would license a confident negative we cannot back.
  it("never promotes a curated council to boundary coverage", () => {
    const out = applyCuratedOverlay(record({ slug: "leeds", name: "Leeds" }))
    expect(out.coverageLevel).not.toBe("boundaries")
  })

  it("leaves a council the curated file does not mention untouched", () => {
    const input = record({ slug: "nowhere-in-particular" })
    expect(applyCuratedOverlay(input)).toEqual(input)
  })

  it("keeps testable geometry when the feed already has boundaries", () => {
    const out = applyCuratedOverlay(
      record({
        slug: "bristol",
        coverageLevel: "boundaries",
        areaCountWithGeometry: 9,
        publishesHmoArticle4: true,
        hasHmoArticle4InForce: true,
      })
    )
    expect(out.coverageLevel).toBe("boundaries")
    expect(out.areaCountWithGeometry).toBe(9)
  })

  it("surfaces a pending direction with its date", () => {
    const out = applyCuratedOverlay(
      record({ slug: "durham", name: "County Durham" }),
      new Date("2026-08-01T00:00:00.000Z")
    )
    expect(out.directionsNotYetInForce).toBeGreaterThan(0)
    expect(out.nextCommencementDate).toBe("2026-08-17")
  })

  it("cannot assert a negative — Preston has only a future direction", () => {
    const out = applyCuratedOverlay(
      record({ slug: "preston", name: "Preston" }),
      new Date("2026-08-11T00:00:00.000Z")
    )
    expect(out.hasHmoArticle4InForce).toBe(false)
    expect(out.nextCommencementDate).toBe("2027-02-15")
  })
})

/**
 * The overlay and the gold set come from the same research. That is fine while
 * they stay on opposite sides of the measurement: the gold set is the answer
 * key, the feed is what gets marked. Serving predictions from the overlay would
 * mark the answer key against itself and report a recall near 100% that means
 * nothing at all.
 */
describe("the overlay stays out of the measurement", () => {
  it("is not consulted by the eval, which predicts from the feed alone", () => {
    const source = readEvalTest()
    expect(source).toContain("buildCouncilRegistry")
    expect(source).not.toContain("applyCuratedOverlay")
    expect(source).not.toContain("curatedBySlug")
  })

  it("does not silently agree with the gold set on councils nobody verified", () => {
    const gold = goldSetJson as unknown as {
      councils: { slug: string; status: string }[]
    }
    const verified = new Set(
      gold.councils.filter((c) => c.status === "verified").map((c) => c.slug)
    )
    // Every curated council traces back to a verified entry, so the overlay can
    // never claim more than someone actually checked.
    for (const c of curatedCouncils()) {
      expect(verified.has(c.slug), `${c.slug} curated without verification`).toBe(true)
    }
  })
})

function readEvalTest(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs") as typeof import("fs")
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("path") as typeof import("path")
  return fs.readFileSync(path.join(process.cwd(), "tests/article4-eval.test.ts"), "utf8")
}

// Wording matters here: this text is what a buyer reads before deciding whether
// to walk away from a purchase.
describe("caveat wording for a curated council", () => {
  it("does not announce that a confirmed council publishes zero directions", () => {
    const out = applyCuratedOverlay(record({ slug: "manchester", name: "Manchester" }))
    const caveats = buildCaveats(out, "england")
    expect(caveats.some((c) => c.includes("publishes 0"))).toBe(false)
    expect(caveats.some((c) => c.includes("council's own published information"))).toBe(true)
  })
})

/**
 * Immediate directions bind from day one but cease to have effect unless the
 * council confirms them within six months. Two in the curated set were made this
 * way, and they land on opposite sides of that deadline.
 */
describe("immediate directions and their confirmation deadline", () => {
  it("Rossendale was confirmed, one day inside its window", () => {
    const rossendale = curatedBySlug("rossendale")!
    const direction = rossendale.directions[0]

    // In force 19 September 2025, so the six-month deadline fell on 19 March 2026.
    expect(direction.commencedOn).toBe("2025-09-19")
    expect(direction.confirmedOn).toBe("2026-03-18")

    const assessed = assessCurated(rossendale, new Date("2026-08-11T00:00:00.000Z"))
    expect(assessed.inForce).toBe(true)
    expect(assessed.needsReconfirmation).toHaveLength(0)
  })

  it("Bury is in force with its deadline still ahead", () => {
    const bury = curatedBySlug("bury")!
    const direction = bury.directions[0]

    expect(direction.confirmBy).toBe("2027-01-16")
    expect(direction.confirmedOn).toBeUndefined()

    const assessed = assessCurated(bury, new Date("2026-08-11T00:00:00.000Z"))
    expect(assessed.inForce).toBe(true)
    expect(assessed.needsReconfirmation).toHaveLength(0)
  })

  // The point of the field: after the deadline the entry stops being trustworthy
  // on its own, and says so, instead of quietly ageing into a wrong answer.
  it("flags Bury for re-checking once its deadline passes unconfirmed", () => {
    const bury = curatedBySlug("bury")!
    const assessed = assessCurated(bury, new Date("2027-01-17T00:00:00.000Z"))

    expect(assessed.needsReconfirmation).toHaveLength(1)
    expect(assessed.inForce).toBe(true) // fail closed: still treated as restricted

    const out = applyCuratedOverlay(
      record({ slug: "bury", name: "Bury" }),
      new Date("2027-01-17T00:00:00.000Z")
    )
    expect(out.provisionalPastDeadline).toBe("2027-01-16")

    const caveat = buildCaveats(out, "england").find((c) => c.includes("cease to have effect"))
    expect(caveat).toBeDefined()
    expect(caveat).toContain("needs checking with the council")
  })
})
