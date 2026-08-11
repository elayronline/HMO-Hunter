import { describe, it, expect } from "vitest"
import {
  classify,
  isScorable,
  scoreGoldSet,
  formatReport,
  MIN_SCORABLE_FOR_HEADLINE,
  type GoldEntry,
  type GoldSet,
} from "@/lib/article4/eval/score"
import goldSetJson from "@/lib/article4/eval/gold-set.json"
import { buildCouncilRegistry } from "@/lib/article4/registry"

const goldSet = goldSetJson as unknown as GoldSet

/** A gold set containing exactly the entries a test cares about. */
function set(councils: GoldEntry[]): GoldSet {
  return { version: 1, councils }
}

function entry(over: Partial<GoldEntry> = {}): GoldEntry {
  return {
    slug: "example",
    name: "Example",
    gssCode: "E00000001",
    status: "verified",
    expected: { hasHmoArticle4: true, forceState: "in_force" as const, extent: null, commencedOn: null },
    evidence: { independentSource: true, sourceUrl: "https://example.gov.uk", quote: null },
    verifiedBy: "tester",
    verifiedAt: "2026-08-10T00:00:00.000Z",
    ...over,
  }
}

describe("classify", () => {
  it("scores the four outcomes", () => {
    expect(classify(true, "yes")).toBe("true_positive")
    expect(classify(false, "yes")).toBe("false_positive")
    expect(classify(true, "unknown")).toBe("miss")
    expect(classify(false, "unknown")).toBe("correct_abstention")
  })

  // Abstaining where nothing exists is correct behaviour, not a failure. The
  // pipeline is designed never to assert a negative, so this must not be
  // penalised as though it were one.
  it("treats abstention on a true negative as correct", () => {
    expect(classify(false, "unknown")).toBe("correct_abstention")
  })

  it("marks entries with no expected value unscorable", () => {
    expect(classify(null, "yes")).toBe("unscorable")
  })
})

describe("isScorable", () => {
  it("requires human verification", () => {
    expect(isScorable(entry({ status: "unverified" }))).toBe(false)
  })

  // The circularity guard. Verifying against planning.data.gov.uk and then
  // scoring a planning.data.gov.uk-driven pipeline measures nothing.
  it("requires an independent source", () => {
    expect(isScorable(entry({ evidence: { independentSource: false, sourceUrl: null, quote: null } }))).toBe(
      false
    )
  })

  it("requires a recorded expectation", () => {
    expect(isScorable(entry({ expected: { hasHmoArticle4: null, forceState: "unknown" as const, extent: null, commencedOn: null } }))).toBe(
      false
    )
  })

  it("accepts a fully verified independent entry", () => {
    expect(isScorable(entry())).toBe(true)
  })
})

describe("scoreGoldSet", () => {
  const gold = (councils: GoldEntry[]): GoldSet => ({ version: 1, councils })

  it("computes precision, recall and miss rate", () => {
    const report = scoreGoldSet(
      gold([
        entry({ slug: "a", expected: { hasHmoArticle4: true, forceState: "in_force" as const, extent: null, commencedOn: null } }),
        entry({ slug: "b", expected: { hasHmoArticle4: true, forceState: "in_force" as const, extent: null, commencedOn: null } }),
        entry({ slug: "c", expected: { hasHmoArticle4: false, forceState: "none" as const, extent: null, commencedOn: null } }),
      ]),
      (slug) => (slug === "a" ? "yes" : "unknown")
    )

    expect(report.truePositives).toBe(1)
    expect(report.misses).toBe(1)
    expect(report.correctAbstentions).toBe(1)
    expect(report.precision).toBe(1)
    expect(report.recall).toBe(0.5)
    expect(report.missRate).toBe(0.5)
  })

  it("excludes unverified and circular entries from scoring", () => {
    const report = scoreGoldSet(
      gold([
        entry({ slug: "verified" }),
        entry({ slug: "pending", status: "unverified" }),
        entry({
          slug: "circular",
          evidence: { independentSource: false, sourceUrl: null, quote: null },
        }),
      ]),
      () => "yes"
    )

    expect(report.scored).toBe(1)
    expect(report.pendingVerification).toBe(1)
    expect(report.excludedAsCircular).toBe(1)
    expect(report.warnings.join(" ")).toMatch(/agreement with itself/i)
  })

  // Guards against someone quoting a number off a gold set nobody has filled in.
  it("refuses to let a thin gold set look publishable", () => {
    const empty = scoreGoldSet(gold([entry({ status: "unverified" })]), () => "unknown")
    expect(empty.scored).toBe(0)
    expect(empty.precision).toBeNull()
    expect(empty.recall).toBeNull()
    expect(empty.warnings.join(" ")).toMatch(/do not quote an accuracy number/i)

    const thin = scoreGoldSet(gold([entry({ slug: "a" })]), () => "yes")
    expect(thin.warnings.join(" ")).toMatch(/indicative, not publishable/i)
  })

  it("names the councils it missed", () => {
    const report = scoreGoldSet(
      gold([entry({ slug: "manchester", name: "Manchester" })]),
      () => "unknown"
    )
    expect(report.results[0].outcome).toBe("miss")
    expect(formatReport(report)).toMatch(/missed: manchester/)
  })
})

describe("gold-set.json", () => {
  it("is structurally valid", () => {
    expect(goldSet.version).toBe(1)
    expect(Array.isArray(goldSet.councils)).toBe(true)
    expect(goldSet.councils.length).toBeGreaterThan(40)

    const slugs = goldSet.councils.map((c) => c.slug)
    expect(new Set(slugs).size, "duplicate slugs").toBe(slugs.length)

    for (const c of goldSet.councils) {
      expect(["verified", "unverified"], c.slug).toContain(c.status)
      expect(c.evidence, c.slug).toBeDefined()
      expect(typeof c.evidence.independentSource, c.slug).toBe("boolean")
    }
  })

  it("covers positives, known gaps and expected negatives", () => {
    const kinds = new Set(goldSet.councils.map((c) => c.seededAs))
    expect(kinds).toContain("machine-positive")
    expect(kinds).toContain("known-missing")
    expect(kinds).toContain("likely-negative")
  })

  // Every seeded row is a hypothesis until a human confirms it. If this ever
  // fails, someone has marked entries verified without recording who or when.
  it("ships nothing pre-marked as verified", () => {
    const claimed = goldSet.councils.filter(
      (c) => c.status === "verified" && (!c.verifiedBy || !c.verifiedAt)
    )
    expect(claimed.map((c) => c.slug), "verified without attribution").toEqual([])
  })

  it("includes the majors the national feed is known to miss", () => {
    const slugs = new Set(goldSet.councils.map((c) => c.slug))
    for (const s of ["manchester", "leeds", "nottingham", "sheffield"]) {
      expect(slugs.has(s), `${s} missing from gold set`).toBe(true)
    }
  })
})

/**
 * Baseline measurement. Records what the current planning.data.gov.uk-only
 * pipeline achieves, so step 5's extractor has a number to beat.
 */
describe.skipIf(process.env.CI)("baseline against live registry", () => {
  it("measures the current pipeline and reports the gap", async () => {
    const registry = await buildCouncilRegistry()
    const covered = new Map(registry.map((c) => [c.slug, c.coverageLevel]))

    const report = scoreGoldSet(goldSet, (slug) => {
      const level = covered.get(slug)
      return level && level !== "none" ? "yes" : "unknown"
    })

    console.log("\n" + formatReport(report) + "\n")

    // Nothing is human-verified yet, so there is nothing to score. That is the
    // honest state, and this asserts the harness reports it rather than
    // inventing a figure.
    expect(report.totalEntries).toBeGreaterThan(40)
    expect(report.scored + report.pendingVerification + report.excludedAsCircular).toBe(
      report.totalEntries
    )
    if (report.scored < MIN_SCORABLE_FOR_HEADLINE) {
      expect(report.warnings.length).toBeGreaterThan(0)
    }
  }, 180_000)
})

// The gold set is the measuring stick, so a contradictory entry is worse than a
// missing one: it silently moves the headline figure. An entry claiming a live
// Article 4 whose force state says otherwise is excluded and named, never
// coerced into a verdict.
describe("announced versus in force in the gold set", () => {
  it("excludes an entry that claims an Article 4 which is not in force", () => {
    const report = scoreGoldSet(
      set([
        entry({ slug: "preston", expected: { hasHmoArticle4: true, forceState: "made_not_in_force", extent: null, commencedOn: "2027-02-15" } }),
      ]),
      () => "unknown"
    )

    expect(report.scored).toBe(0)
    expect(report.excludedAsInconsistent).toBe(1)
    expect(report.results[0].outcome).toBe("unscorable")
    expect(report.results[0].reason).toMatch(/not in force restricts nothing/)
    expect(report.warnings.some((w) => w.includes("internally inconsistent"))).toBe(true)
  })

  it("excludes a verified entry that never recorded a force state", () => {
    const report = scoreGoldSet(
      set([
        entry({ slug: "somewhere", expected: { hasHmoArticle4: false, forceState: "unknown", extent: null, commencedOn: null } }),
      ]),
      () => "unknown"
    )

    expect(report.scored).toBe(0)
    expect(report.excludedAsInconsistent).toBe(1)
  })

  // A council that made a direction which has not commenced genuinely has no
  // restriction today, so it is a real negative and must still be scorable —
  // this is what proves the pipeline is not over-claiming.
  it("scores a not-yet-in-force council as a confirmed negative", () => {
    const report = scoreGoldSet(
      set([
        entry({ slug: "preston", expected: { hasHmoArticle4: false, forceState: "made_not_in_force", extent: null, commencedOn: "2027-02-15" } }),
      ]),
      () => "unknown"
    )

    expect(report.scored).toBe(1)
    expect(report.excludedAsInconsistent).toBe(0)
    expect(report.correctAbstentions).toBe(1)
  })
})
