import { describe, it, expect } from "vitest"
import {
  classifyArticle4,
  normaliseCouncilName,
  toLegacyBoolean,
  fetchCoveredCouncilKeys,
  type Article4Status,
} from "@/lib/article4/coverage"
import { validateFilters } from "@/lib/validation/filters"
import { propertyFiltersSchema } from "@/lib/validation/schemas"

/**
 * The rule these tests defend:
 *
 *   A negative may only be written when the property's planning authority is
 *   one that actually publishes HMO Article 4 boundaries. Everything else is
 *   `unknown`.
 *
 * The original code wrote `article_4_area = false` on any polygon miss against a
 * feed covering 38 of ~344 authorities, so every property in Manchester, Leeds,
 * Nottingham and Sheffield was recorded as a confirmed negative.
 */

describe("normaliseCouncilName", () => {
  it("strips council-type suffixes and prefixes", () => {
    expect(normaliseCouncilName("Manchester City Council")).toBe("manchester")
    expect(normaliseCouncilName("Sefton Metropolitan Borough Council")).toBe("sefton")
    expect(normaliseCouncilName("Harlow District Council")).toBe("harlow")
    expect(normaliseCouncilName("London Borough of Southwark")).toBe("southwark")
    expect(normaliseCouncilName("Royal Borough of Kingston upon Thames")).toBe("kingston upon thames")
  })

  it("handles the inverted district-dataset forms", () => {
    // The organisation dataset says "Bristol City Council"; the district
    // dataset says "Bristol, City of". Both must land on the same key.
    expect(normaliseCouncilName("Bristol, City of")).toBe("bristol")
    expect(normaliseCouncilName("Bristol City Council")).toBe("bristol")
    expect(normaliseCouncilName("City of York Council")).toBe("york")
    expect(normaliseCouncilName("York")).toBe("york")
  })

  it("applies aliases where the two datasets genuinely disagree", () => {
    expect(normaliseCouncilName("Newcastle City Council")).toBe("newcastle upon tyne")
    expect(normaliseCouncilName("Newcastle upon Tyne")).toBe("newcastle upon tyne")
  })

  it("does not collapse distinct authorities onto one key", () => {
    expect(normaliseCouncilName("Newcastle-under-Lyme")).not.toBe(
      normaliseCouncilName("Newcastle upon Tyne")
    )
    expect(normaliseCouncilName("Kingston upon Hull, City of")).not.toBe(
      normaliseCouncilName("Kingston upon Thames")
    )
  })

  it("is total on empty input", () => {
    expect(normaliseCouncilName("")).toBe("")
  })
})

describe("classifyArticle4", () => {
  const now = new Date("2026-08-10T00:00:00.000Z")

  it("returns in_force when a boundary matches", () => {
    const r = classifyArticle4({
      matchedAreaName: "Canterbury HMO Article 4 Direction 1",
      council: "Canterbury",
      councilCovered: true,
      now,
    })
    expect(r.status).toBe("in_force")
    expect(r.areaName).toBe("Canterbury HMO Article 4 Direction 1")
    expect(r.source).toBe("planning.data.gov.uk")
  })

  it("returns in_force even when coverage bookkeeping is unresolved", () => {
    // A positive hit is self-evidencing; it does not need the coverage set.
    const r = classifyArticle4({
      matchedAreaName: "Some direction",
      council: null,
      councilCovered: null,
      now,
    })
    expect(r.status).toBe("in_force")
  })

  it("returns none_found only when the council is covered", () => {
    const r = classifyArticle4({
      matchedAreaName: null,
      council: "Bristol, City of",
      councilCovered: true,
      now,
    })
    expect(r.status).toBe("none_found")
    expect(r.areaName).toBeNull()
    expect(r.checkedAt).toBe("2026-08-10T00:00:00.000Z")
  })

  // The regression. Manchester operates a city-wide HMO Article 4 and publishes
  // nothing to the national feed, so a miss there means "we cannot see it",
  // never "it is not there".
  it("returns unknown for a miss in an uncovered council", () => {
    const r = classifyArticle4({
      matchedAreaName: null,
      council: "Manchester",
      councilCovered: false,
      now,
    })
    expect(r.status).toBe("unknown")
    expect(r.status).not.toBe("none_found")
    expect(r.source).toBeNull()
  })

  it("returns unknown when the council could not be resolved", () => {
    for (const councilCovered of [null, false, true]) {
      const r = classifyArticle4({ matchedAreaName: null, council: null, councilCovered, now })
      expect(r.status).toBe("unknown")
    }
  })

  it("returns unknown when coverage is indeterminate", () => {
    const r = classifyArticle4({
      matchedAreaName: null,
      council: "Leeds",
      councilCovered: null,
      now,
    })
    expect(r.status).toBe("unknown")
  })

  it("always stamps checkedAt", () => {
    const r = classifyArticle4({ matchedAreaName: null, council: null, councilCovered: null })
    expect(Date.parse(r.checkedAt)).not.toBeNaN()
  })
})

describe("toLegacyBoolean", () => {
  it("maps the three states onto the deprecated boolean", () => {
    expect(toLegacyBoolean("in_force")).toBe(true)
    expect(toLegacyBoolean("none_found")).toBe(false)
    // unknown must be null, not false — the whole point of the change.
    expect(toLegacyBoolean("unknown")).toBeNull()
  })

  it("never renders unknown as a negative", () => {
    const states: Article4Status[] = ["in_force", "none_found", "unknown"]
    const negatives = states.filter((s) => toLegacyBoolean(s) === false)
    expect(negatives).toEqual(["none_found"])
  })
})

describe("article4Filter validation", () => {
  it("accepts all four filter intents", () => {
    for (const v of ["include", "exclude", "confirmed_clear", "only"]) {
      expect(propertyFiltersSchema.safeParse({ article4Filter: v }).success, v).toBe(true)
      expect(validateFilters({ article4Filter: v as any }).article4Filter, v).toBe(v)
    }
  })

  it("rejects unknown filter values", () => {
    expect(propertyFiltersSchema.safeParse({ article4Filter: "not_a_filter" }).success).toBe(false)
    expect(validateFilters({ article4Filter: "not_a_filter" as any }).article4Filter).toBeUndefined()
  })

  it("keeps exclude and confirmed_clear distinct", () => {
    // exclude tolerates uncertainty; confirmed_clear does not. Collapsing them
    // is what let unverified stock be served as Article-4-free.
    expect(validateFilters({ article4Filter: "exclude" }).article4Filter).not.toBe(
      validateFilters({ article4Filter: "confirmed_clear" }).article4Filter
    )
  })
})

describe("fetchCoveredCouncilKeys", () => {
  it("returns an empty set when given nothing, so callers stay at unknown", async () => {
    const keys = await fetchCoveredCouncilKeys([])
    expect(keys.size).toBe(0)
  })
})

/**
 * Live guard against upstream naming drift.
 *
 * Council names are matched across two planning.data.gov.uk datasets that spell
 * the same body differently. If that mapping breaks, councils silently drop out
 * of the covered set — which is safe (they become `unknown`) but quietly guts
 * coverage. This asserts every council currently publishing HMO Article 4 areas
 * still resolves to a real LPA district.
 *
 * Skipped in CI to avoid network flake; runs locally.
 */
describe.skipIf(process.env.CI)("council name matching against live planning data", () => {
  const ENTITY = "https://www.planning.data.gov.uk/entity.json"

  async function paginate(query: string): Promise<any[]> {
    const rows: any[] = []
    for (let offset = 0; ; offset += 500) {
      const page = await fetch(`${ENTITY}?${query}&limit=500&offset=${offset}`).then((r) => r.json())
      const batch = page.entities ?? []
      rows.push(...batch)
      if (batch.length < 500) return rows
    }
  }

  it("resolves every covered council to an LPA district", async () => {
    // ~7,300 areas across 15 pages; the HMO-related ones are scattered
    // throughout, so this has to walk the whole set.
    //
    // No `field=` projection here: the API returns `organisation-entity` as an
    // empty string when fields are projected, which silently empties the
    // covered set. Full records cost ~3s and are correct.
    const areas = await paginate("dataset=article-4-direction-area")
    expect(areas.length).toBeGreaterThan(1000)

    const HMO = /hmo|multiple occupation|class c4|c3 to c4|shared (house|dwelling)/i
    const orgIds = new Set<number>(
      areas
        .filter((e: any) =>
          HMO.test(`${e.name ?? ""} ${e.notes ?? ""} ${e.description ?? ""}`)
        )
        .map((e: any) => e["organisation-entity"])
        .filter(Boolean)
    )
    expect(orgIds.size).toBeGreaterThan(0)

    const covered = await fetchCoveredCouncilKeys(orgIds)

    const districts = await paginate("dataset=local-authority-district&field=name")
    const districtKeys = new Set(districts.map((d: any) => normaliseCouncilName(d.name)))

    const unmatched = [...covered].filter((k) => !districtKeys.has(k))
    expect(unmatched, `councils that no longer map to an LPA: ${unmatched.join(", ")}`).toEqual([])
  }, 120_000)
})
