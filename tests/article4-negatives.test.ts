import { describe, it, expect } from "vitest"
import curatedJson from "@/lib/article4/curated-councils.json"
import {
  curatedNegativeFor,
  directionForceState,
  wholeAuthorityDirectionInForce,
  type CuratedDirection,
} from "@/lib/article4/curated"

/**
 * Two mechanisms guarded here, both of which fail dangerously if they fail at
 * all: recording that a council is clear, and deciding whether a dateless
 * direction binds.
 */

const councils = (curatedJson as any).councils as {
  slug: string
  name: string
  directions: CuratedDirection[]
  noHmoArticle4?: { checkedOn: string; sourceUrl: string; quote: string; note?: string }
}[]

const direction = (over: Partial<CuratedDirection> = {}): CuratedDirection => ({
  name: "test",
  extent: null,
  commencedOn: null,
  endedOn: null,
  sourceUrl: "https://example.gov.uk",
  quote: "q",
  ...over,
})

describe("what a dateless direction amounts to", () => {
  /**
   * The whole reason this field exists. forceStateOn treats a missing
   * commencement date as in force, so before this a proposed direction — which
   * has no commencement date, because it has not commenced — would have
   * asserted a live restriction over every property in the authority.
   */
  it("treats a proposed direction as binding nobody", () => {
    expect(directionForceState(direction({ forceState: "proposed" }))).toBe("proposed")
  })

  it("keeps a proposed direction non-binding even if a date is attached", () => {
    // A date on a proposal is a target, not a commencement.
    const d = direction({ forceState: "proposed", commencedOn: "2020-01-01" })
    expect(directionForceState(d)).toBe("proposed")
  })

  it("establishes nothing when neither a date nor a force state is recorded", () => {
    expect(directionForceState(direction())).toBe("unknown")
  })

  it("honours an explicit in_force where the council publishes no date", () => {
    expect(directionForceState(direction({ forceState: "in_force" }))).toBe("in_force")
  })

  it("prefers the date over the explicit state when both are present", () => {
    const future = direction({ forceState: "in_force", commencedOn: "2099-01-01" })
    expect(directionForceState(future)).toBe("made_not_in_force")
  })

  it("expires a dateless direction that has an end date in the past", () => {
    const d = direction({ forceState: "in_force", endedOn: "2020-01-01" })
    expect(directionForceState(d)).toBe("expired")
  })
})

describe("every dateless direction in the file states its force", () => {
  /**
   * Without this the resolver silently downgrades them to `unknown` and
   * properties quietly stop being flagged — a regression that looks like
   * nothing happening.
   */
  it("has no direction lacking both a date and a force state", () => {
    const unresolved = councils.flatMap((c) =>
      c.directions.filter((d) => !d.commencedOn && !d.forceState).map(() => c.slug)
    )
    expect(unresolved).toEqual([])
  })
})

describe("recording a council as clear", () => {
  it("returns the negative for a council checked and found clear", () => {
    const negative = curatedNegativeFor("Cambridge")
    expect(negative).not.toBeNull()
    expect(negative!.sourceUrl).toContain("cambridge.gov.uk")
    expect(negative!.quote.length).toBeGreaterThan(40)
  })

  it("returns nothing for a council nobody has checked", () => {
    expect(curatedNegativeFor("not-a-real-council")).toBeNull()
  })

  /**
   * The contradiction that matters. If a council somehow carries both a live
   * direction and a negative, the restriction is the answer that keeps someone
   * safe, so the negative is refused rather than averaged with it.
   */
  it("refuses a negative wherever a direction is in force", () => {
    for (const c of councils) {
      if (!c.noHmoArticle4) continue
      const anyInForce = c.directions.some((d) => directionForceState(d) === "in_force")
      if (anyInForce) {
        expect(curatedNegativeFor(c.slug), `${c.slug} holds both`).toBeNull()
      }
    }
  })

  it("never records a council as both clear and whole-authority restricted", () => {
    const contradictory = councils
      .filter((c) => c.noHmoArticle4 && wholeAuthorityDirectionInForce(c.slug))
      .map((c) => c.slug)
    expect(contradictory).toEqual([])
  })

  it("holds negatives to the same evidence standard as positives", () => {
    for (const c of councils) {
      const n = c.noHmoArticle4
      if (!n) continue
      expect(n.sourceUrl, `${c.slug} negative needs a source`).toMatch(/^https:\/\//)
      expect(n.quote?.trim().length, `${c.slug} negative needs a quote`).toBeGreaterThan(0)
      expect(n.checkedOn, `${c.slug} negative needs a date`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

/**
 * Cambridge is the case the negative record was built for: its own committee
 * record commissions only a feasibility study, so there is no direction, while
 * local reporting describes restrictions as coming. Announced is not in force,
 * and the note carries that distinction rather than the status.
 */
describe("Cambridge", () => {
  const cambridge = councils.find((c) => c.slug === "cambridge")!

  it("is recorded as clear, with nothing in force", () => {
    expect(cambridge.noHmoArticle4).toBeTruthy()
    expect(cambridge.directions.filter((d) => directionForceState(d) === "in_force")).toEqual([])
    expect(wholeAuthorityDirectionInForce("Cambridge")).toBeNull()
  })

  it("records the coming direction as a note, not as a restriction", () => {
    expect(cambridge.noHmoArticle4!.note).toBeTruthy()
    expect(curatedNegativeFor("Cambridge")).not.toBeNull()
  })
})
