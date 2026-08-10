import { describe, it, expect } from "vitest"
import {
  classifyHmoApplication,
  type HmoApplicationKind,
} from "@/lib/planning/hmo-classifier"

/**
 * Fixtures are verbatim descriptions pulled from PlanIt, hand-labelled. They
 * exist because the failure that matters here is silent: a de-conversion or a
 * condition discharge counted as an approval inverts the indicator rather than
 * breaking anything visibly.
 */
const FIXTURES: { desc: string; expect: HmoApplicationKind; occupants?: number | null }[] = [
  // --- creates a small HMO -------------------------------------------------
  {
    desc: "Change of use from a dwelling house (Use Class C3) to a six bedroom (six occupant) house in multiple occupation (Use Class C4)",
    expect: "new_small_hmo",
    occupants: 6,
  },
  {
    desc: "Change of use of from a dwellinghouse (Use Class C3) to a 5 Bedroom House of Multiple Occupation (Use Class C4).",
    expect: "new_small_hmo",
    occupants: 5,
  },
  {
    desc: "Change of use from Class C3 (6 no. bedroom residential dwellinghouse) to Class C4 (house in multiple occupation for up to 6 no. people)",
    expect: "new_small_hmo",
  },
  {
    desc: "CONVERSION TO A 5 NO. BEDROOM HOUSE IN MULTIPLE OCCUPATION WITH PROPOSED FIRST FLOOR SIDE EXTENSION",
    expect: "new_small_hmo",
    occupants: 5,
  },
  {
    desc: "Proposed conversion of dwellinghouse into a 4x bed 4x person house in multiple occupation (HMO) with cycle and refuse storage",
    expect: "new_small_hmo",
    occupants: 4,
  },

  // --- creates a large HMO -------------------------------------------------
  {
    desc: "Change of use from a dwelling house (Use Class C3) to a 13 bedroom (13 occupant) house in multiple occupation (sui generis) with two storey extension",
    expect: "new_large_hmo",
    occupants: 13,
  },
  {
    desc: "Change of use from dwellinghouse (Use Class C3) to a large House in Multiple Occupation (Sui Generis). Provision of cycle and bin storage.",
    expect: "new_large_hmo",
  },
  // Hyphenated "Sui-Generis" appears in the wild and must not fall through.
  {
    desc: "Change of use from dwelling house (Class C3) to HMO-house in multiple occupation (Sui-Generis) for up to seven persons",
    expect: "new_large_hmo",
    occupants: 7,
  },

  // --- existing HMO growing ------------------------------------------------
  {
    desc: "Change of use from 6 bedroom house of multiple occupation ( HMO) use class C4 to a 7 bedroom HMO, use class Sui Generis",
    expect: "hmo_intensification",
  },

  // --- removes HMO supply: the inversion trap ------------------------------
  {
    desc: "Internal alterations in association with change of use from HMO into 2 flats (Use Class C3)",
    expect: "reversion",
  },
  {
    desc: "Change of use from House of Multiple Occupation to Dog Grooming and Pet Spa.",
    expect: "reversion",
  },
  {
    desc: "The making of a material change of use from a House of Multiple Occupation to a hotel (falling within Use Class C1)",
    expect: "reversion",
  },
  {
    desc: "Conversion of an existing House in Multiple Occupation into two 'duplex' style flats; with new side entrance",
    expect: "reversion",
  },

  // --- certificates: existing use is not new supply ------------------------
  {
    desc: "Certificate of Existing Lawful Development for Use as a house in multiple occupation",
    expect: "existing_use_certificate",
  },
  {
    desc: "Lawful Development Certificate for the existing use of the property as a House in Multiple Occupation (HMO Sui Generis) occupied by 8 unrelated residents",
    expect: "existing_use_certificate",
  },
  {
    desc: "Section 191 application to determine the lawful use of the application site as a mixed use, comprising a flat and a house of multiple occupation",
    expect: "existing_use_certificate",
  },
  // Unqualified certificates are assumed existing: under-counts supply rather
  // than inventing it.
  {
    desc: "Certificate of lawful use for House in Multiple Occupation (Use Class C4)",
    expect: "existing_use_certificate",
  },

  // --- certificates: proposed use IS new supply ----------------------------
  {
    desc: "Application for a Lawful Development Certificate for a Proposed use or development - Change of use from Dwelling (C3) to a small House in Multiple Occupation (C4)",
    expect: "new_small_hmo",
  },
  {
    desc: "Certificate of lawfulness under S192 for a change of use from a single dwellinghouse (Class C3) to a House in multiple occupation",
    expect: "new_small_hmo",
  },
  {
    desc: "Proposed lawful development certificate for the change of use of dwelling to 4-bed house in multiple occupation",
    expect: "new_small_hmo",
    occupants: 4,
  },

  // --- not a decision on HMO use -------------------------------------------
  {
    desc: "Details pursuant to condition 5 (Cycle Store), 6 (Refuse) on planning permission MC/26/0889 - change of use to house in multiple occupation",
    expect: "ancillary",
  },
  {
    desc: "Details of appearance, landscaping, layout and scale for the erection of two pairs of semi-detached dwellinghouses and a house in multiple occupation",
    expect: "ancillary",
  },
  {
    desc: "Retrospective planning application for a single storey side extension to a House in Multiple Occupation",
    expect: "ancillary",
  },

  // --- shares the vocabulary, is not an HMO --------------------------------
  {
    desc: "Change of use of first floor of Unit 26 (former Debenhams unit) to sui generis (cinema)",
    expect: "not_hmo",
  },
  {
    desc: "Erection of a single storey rear extension to a dwelling",
    expect: "not_hmo",
  },
]

describe("classifyHmoApplication", () => {
  it.each(FIXTURES)("classifies: $desc", ({ desc, expect: kind, occupants }) => {
    const result = classifyHmoApplication(desc)
    expect(result.kind, desc).toBe(kind)
    if (occupants !== undefined) {
      expect(result.occupants, `occupants for: ${desc}`).toBe(occupants)
    }
  })

  it("classifies the whole fixture set correctly", () => {
    const wrong = FIXTURES.filter((f) => classifyHmoApplication(f.desc).kind !== f.expect)
    expect(wrong.map((f) => f.desc)).toEqual([])
  })
})

describe("addsSupply", () => {
  it("is true only for the three supply-adding kinds", () => {
    const supplyAdding = FIXTURES.filter((f) => classifyHmoApplication(f.desc).addsSupply)
    const kinds = new Set(supplyAdding.map((f) => classifyHmoApplication(f.desc).kind))
    expect([...kinds].sort()).toEqual(["hmo_intensification", "new_large_hmo", "new_small_hmo"])
  })

  // The single most important invariant: a de-conversion must never register as
  // added supply, or the indicator points the wrong way.
  it("is never true for a reversion", () => {
    const reversions = FIXTURES.filter((f) => f.expect === "reversion")
    expect(reversions.length).toBeGreaterThan(2)
    for (const f of reversions) {
      expect(classifyHmoApplication(f.desc).addsSupply, f.desc).toBe(false)
    }
  })

  it("is never true for certificates of existing use, ancillary work or non-HMO", () => {
    for (const kind of ["existing_use_certificate", "ancillary", "not_hmo"] as const) {
      for (const f of FIXTURES.filter((x) => x.expect === kind)) {
        expect(classifyHmoApplication(f.desc).addsSupply, f.desc).toBe(false)
      }
    }
  })
})

describe("occupant extraction", () => {
  it("reads the many ways councils write a count", () => {
    const cases: [string, number][] = [
      ["a 6 bedroom house in multiple occupation", 6],
      ["4-bed house in multiple occupation", 4],
      ["4x bed 4x person house in multiple occupation", 4],
      ["5 NO. BEDROOM HOUSE IN MULTIPLE OCCUPATION", 5],
      ["house in multiple occupation for up to 6no. occupants", 6],
      ["house in multiple occupation for up to seven persons", 7],
    ]
    for (const [text, expected] of cases) {
      expect(classifyHmoApplication(text).occupants, text).toBe(expected)
    }
  })

  it("prefers an occupant count over a bedroom count", () => {
    expect(
      classifyHmoApplication("8 bedroom house in multiple occupation for 9 occupants").occupants
    ).toBe(9)
  })

  it("rejects implausible counts", () => {
    expect(classifyHmoApplication("conversion to 250 bedroom house in multiple occupation").occupants).toBeNull()
  })
})

describe("degenerate input", () => {
  it("never throws and never guesses", () => {
    for (const input of [null, undefined, "", "   "]) {
      const r = classifyHmoApplication(input)
      expect(["unclear", "not_hmo"]).toContain(r.kind)
      expect(r.addsSupply).toBe(false)
    }
  })

  it("records which rule fired, for auditing", () => {
    expect(classifyHmoApplication("Change of use from C3 to C4 house in multiple occupation").matchedRule)
      .toBeTruthy()
  })
})
