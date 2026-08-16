import { describe, it, expect } from "vitest"
import curatedJson from "@/lib/article4/curated-councils.json"
import {
  curatedByCouncilName,
  wholeAuthorityDirectionInForce,
} from "@/lib/article4/curated"

/**
 * `coversWholeAuthority` is the only curated fact allowed to decide an
 * individual property, so it carries the most risk in this file: setting it
 * wrongly asserts a live planning restriction across an entire city on evidence
 * that does not support one.
 *
 * These tests guard the two ways it goes wrong — flagging an extent that is
 * explicitly partial, and letting a direction bind before it commences.
 */

const councils = (curatedJson as any).councils as {
  slug: string
  name: string
  directions: {
    extent: string | null
    commencedOn: string | null
    endedOn: string | null
    coversWholeAuthority?: boolean
    sourceUrl: string
    quote: string
  }[]
}[]

const flagged = councils.flatMap((c) =>
  c.directions.filter((d) => d.coversWholeAuthority).map((d) => ({ slug: c.slug, ...d }))
)

describe("whole-authority curated directions", () => {
  it("flags a meaningful number without flagging everything", () => {
    // A flag on every direction would mean the distinction had stopped being
    // made; zero would mean the overlay is dead code.
    expect(flagged.length).toBeGreaterThan(10)
    expect(flagged.length).toBeLessThan(councils.length)
  })

  /**
   * The prose these extents are written in defeats substring matching, which is
   * exactly why the flag is set by hand. Sheffield's extent is "Designated
   * Article 4 area only — not city-wide"; a regex for "city-wide" marks it
   * covered and puts 132 Sheffield properties into a restriction they may not
   * be in.
   */
  it("never flags an extent that states it is not authority-wide", () => {
    // Only the clause describing the extent as it stands. Several entries carry
    // the superseded extent after a semicolon — Hillingdon reads "All parts of
    // the borough since late 2025; previously only the wards of Brunel and
    // Uxbridge South", where the limiting word belongs to the history.
    const currentExtent = (extent: string | null) => (extent ?? "").split(";")[0]

    const contradictory = flagged.filter((d) =>
      /\bnot (city|borough|district|county)-wide\b|\bonly\b|\bexcept the wards\b|\balmost\b/i.test(
        currentExtent(d.extent)
      )
    )
    expect(contradictory.map((d) => d.slug)).toEqual([])
  })

  it("leaves the partial councils unflagged", () => {
    for (const slug of ["sheffield", "leeds", "reading", "bristol", "salford", "brent"]) {
      const council = councils.find((c) => c.slug === slug)
      expect(council, `${slug} missing from curated file`).toBeTruthy()
      expect(
        council!.directions.some((d) => d.coversWholeAuthority),
        `${slug} must not be treated as whole-authority`
      ).toBe(false)
    }
  })

  /**
   * Durham's countywide direction was recorded before it commenced on
   * 17 August 2026. Force is derived on read, so the same record answers
   * differently either side of that date with no job to run.
   */
  it("does not apply a direction before it commences", () => {
    const dayBefore = new Date("2026-08-16T12:00:00.000Z")
    const dayAfter = new Date("2026-08-17T12:00:00.000Z")

    expect(wholeAuthorityDirectionInForce("durham", dayBefore)).toBeNull()
    expect(wholeAuthorityDirectionInForce("durham", dayAfter)).not.toBeNull()
  })

  it("does not apply a direction that has ended", () => {
    const ended = councils.flatMap((c) =>
      c.directions.filter((d) => d.coversWholeAuthority && d.endedOn)
    )
    for (const d of ended) {
      const afterEnd = new Date(new Date(d.endedOn!).getTime() + 86_400_000)
      const council = councils.find((c) => c.directions.includes(d))!
      expect(wholeAuthorityDirectionInForce(council.slug, afterEnd)).toBeNull()
    }
  })

  it("returns nothing for a council nobody has curated", () => {
    expect(wholeAuthorityDirectionInForce("not-a-real-council")).toBeNull()
  })
})

describe("matching a planning authority name to a curated council", () => {
  /**
   * The boundary lookup returns statutory names. Left unnormalised these miss,
   * and a miss is silent — the property simply stays unknown, which reads
   * identically to "no direction here".
   */
  it("matches names carrying statutory decoration", () => {
    expect(curatedByCouncilName("Bristol, City of")?.slug).toBe("bristol")
    expect(curatedByCouncilName("Kingston upon Hull, City of")?.slug).toBe("kingston-upon-hull")
    expect(curatedByCouncilName("Manchester")?.slug).toBe("manchester")
    expect(curatedByCouncilName("Brighton and Hove")?.slug).toBe("brighton-and-hove")
    expect(curatedByCouncilName("Tower Hamlets")?.slug).toBe("tower-hamlets")
  })

  it("does not match a council that is absent", () => {
    expect(curatedByCouncilName("Somewhere That Does Not Exist")).toBeNull()
    expect(curatedByCouncilName("")).toBeNull()
  })
})

/**
 * Southampton is kept as the worked example of how a disagreement gets settled.
 *
 * Its extent originally read "City-wide" on the strength of a council page
 * summary, while the quoted wording stated no extent at all and the national
 * feed published partial polygons that left 86 Southampton properties as
 * none_found. Two sources disagreeing is the signal to stop, not to pick the
 * one that claims more — so the flag came off and stayed off until someone read
 * the direction itself.
 *
 * The direction settles it. Schedule 2 designates "All those properties
 * situated within the administrative area of Southampton City Council", and the
 * attached plan is the city boundary map. The feed was the incomplete party.
 * The record now cites that document rather than a page summarising it.
 */
describe("Southampton, re-verified against the direction itself", () => {
  const southampton = councils.find((c) => c.slug === "southampton")!
  const direction = southampton.directions.find((d) => d.coversWholeAuthority)

  it("is treated as whole-authority", () => {
    expect(direction).toBeTruthy()
    expect(wholeAuthorityDirectionInForce("Southampton")).not.toBeNull()
  })

  it("cites the direction document and the extent wording that settles it", () => {
    expect(direction!.quote).toContain("administrative area of Southampton City Council")
    expect(direction!.sourceUrl).toContain("southampton.gov.uk")
    // Recorded from the document's own commencement clause, not inferred.
    expect(direction!.commencedOn).toBe("2012-03-23")
  })

  it("was not in force before it commenced", () => {
    expect(wholeAuthorityDirectionInForce("Southampton", new Date("2012-03-22"))).toBeNull()
    expect(wholeAuthorityDirectionInForce("Southampton", new Date("2012-03-24"))).not.toBeNull()
  })
})
