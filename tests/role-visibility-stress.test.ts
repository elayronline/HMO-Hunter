/**
 * Stress tests: Role-based visibility configuration
 *
 * Validates lib/role-visibility.ts exhaustively:
 *  - Every role returns the correct boolean set
 *  - Fallback (null/undefined/unknown) returns all-visible
 *  - Cross-role invariants (e.g. investor NEVER has showTaSuitability)
 *  - Bulk: iterate every (role × flag) combination
 */

import { describe, it, expect } from "vitest"
import {
  ROLE_VISIBILITY,
  getVisibilityForRole,
  type RoleVisibility,
} from "@/lib/role-visibility"
import type { UserType } from "@/components/role-selection-modal"

const ALL_ROLES: UserType[] = ["investor", "council_ta", "operator", "agent"]

const ALL_FLAGS: (keyof RoleVisibility)[] = [
  "showDealScore",
  "showDealVerdict",
  "showYieldMetrics",
  "showR2RMetrics",
  "showLhaComparison",
  "showTaSuitability",
  "showYieldCalculator",
  "showOwnership",
  "showHmoClassification",
]

// ============================================================================
// 1. Exact per-role flag values
// ============================================================================
describe("Exact Per-Role Flag Values", () => {
  // -- Investor --
  describe("investor", () => {
    const v = ROLE_VISIBILITY.investor
    it("showDealScore = true", () => expect(v.showDealScore).toBe(true))
    it("showDealVerdict = true", () => expect(v.showDealVerdict).toBe(true))
    it("showYieldMetrics = true", () => expect(v.showYieldMetrics).toBe(true))
    it("showR2RMetrics = false", () => expect(v.showR2RMetrics).toBe(false))
    it("showLhaComparison = false", () => expect(v.showLhaComparison).toBe(false))
    it("showTaSuitability = false", () => expect(v.showTaSuitability).toBe(false))
    it("showYieldCalculator = true", () => expect(v.showYieldCalculator).toBe(true))
    it("showOwnership = true", () => expect(v.showOwnership).toBe(true))
    it("showHmoClassification = true", () => expect(v.showHmoClassification).toBe(true))
  })

  // -- Council/TA --
  describe("council_ta", () => {
    const v = ROLE_VISIBILITY.council_ta
    it("showDealScore = false", () => expect(v.showDealScore).toBe(false))
    it("showDealVerdict = false", () => expect(v.showDealVerdict).toBe(false))
    it("showYieldMetrics = false", () => expect(v.showYieldMetrics).toBe(false))
    it("showR2RMetrics = true", () => expect(v.showR2RMetrics).toBe(true))
    it("showLhaComparison = true", () => expect(v.showLhaComparison).toBe(true))
    it("showTaSuitability = true", () => expect(v.showTaSuitability).toBe(true))
    it("showYieldCalculator = false", () => expect(v.showYieldCalculator).toBe(false))
    it("showOwnership = false", () => expect(v.showOwnership).toBe(false))
    it("showHmoClassification = false", () => expect(v.showHmoClassification).toBe(false))
  })

  // -- Operator --
  describe("operator", () => {
    const v = ROLE_VISIBILITY.operator
    it("showDealScore = false", () => expect(v.showDealScore).toBe(false))
    it("showDealVerdict = false", () => expect(v.showDealVerdict).toBe(false))
    it("showYieldMetrics = false", () => expect(v.showYieldMetrics).toBe(false))
    it("showR2RMetrics = false", () => expect(v.showR2RMetrics).toBe(false))
    it("showLhaComparison = false", () => expect(v.showLhaComparison).toBe(false))
    it("showTaSuitability = false", () => expect(v.showTaSuitability).toBe(false))
    it("showYieldCalculator = false", () => expect(v.showYieldCalculator).toBe(false))
    it("showOwnership = true", () => expect(v.showOwnership).toBe(true))
    it("showHmoClassification = false", () => expect(v.showHmoClassification).toBe(false))
  })

  // -- Agent --
  describe("agent", () => {
    const v = ROLE_VISIBILITY.agent
    it("showDealScore = true", () => expect(v.showDealScore).toBe(true))
    it("showDealVerdict = true", () => expect(v.showDealVerdict).toBe(true))
    it("showYieldMetrics = true", () => expect(v.showYieldMetrics).toBe(true))
    it("showR2RMetrics = false", () => expect(v.showR2RMetrics).toBe(false))
    it("showLhaComparison = false", () => expect(v.showLhaComparison).toBe(false))
    it("showTaSuitability = false", () => expect(v.showTaSuitability).toBe(false))
    it("showYieldCalculator = true", () => expect(v.showYieldCalculator).toBe(true))
    it("showOwnership = true", () => expect(v.showOwnership).toBe(true))
    it("showHmoClassification = true", () => expect(v.showHmoClassification).toBe(true))
  })
})

// ============================================================================
// 2. getVisibilityForRole() function
// ============================================================================
describe("getVisibilityForRole()", () => {
  ALL_ROLES.forEach((role) => {
    it(`returns ROLE_VISIBILITY[${role}] for known role`, () => {
      expect(getVisibilityForRole(role)).toEqual(ROLE_VISIBILITY[role])
    })
  })

  it("returns all-true fallback for null", () => {
    const fb = getVisibilityForRole(null)
    ALL_FLAGS.forEach((flag) => {
      expect(fb[flag]).toBe(true)
    })
  })

  it("returns all-true fallback for undefined", () => {
    const fb = getVisibilityForRole(undefined)
    ALL_FLAGS.forEach((flag) => {
      expect(fb[flag]).toBe(true)
    })
  })

  it("returns all-true fallback for unknown role string", () => {
    const fb = getVisibilityForRole("unknown_role" as UserType)
    ALL_FLAGS.forEach((flag) => {
      expect(fb[flag]).toBe(true)
    })
  })

  it("returns all-true fallback for empty string", () => {
    const fb = getVisibilityForRole("" as UserType)
    ALL_FLAGS.forEach((flag) => {
      expect(fb[flag]).toBe(true)
    })
  })
})

// ============================================================================
// 3. Fallback has every flag set to true
// ============================================================================
describe("Fallback Completeness", () => {
  const fallback = getVisibilityForRole(null)

  ALL_FLAGS.forEach((flag) => {
    it(`fallback.${flag} is true`, () => {
      expect(fallback[flag]).toBe(true)
    })
  })

  it("fallback has exactly the same keys as role configs", () => {
    const fallbackKeys = Object.keys(fallback).sort()
    const investorKeys = Object.keys(ROLE_VISIBILITY.investor).sort()
    expect(fallbackKeys).toEqual(investorKeys)
  })
})

// ============================================================================
// 4. Cross-role invariants — hard rules that must always hold
// ============================================================================
describe("Cross-Role Invariants", () => {
  // Investor should NEVER see TA stuff
  it("investor never has showTaSuitability", () => {
    expect(ROLE_VISIBILITY.investor.showTaSuitability).toBe(false)
  })
  it("investor never has showLhaComparison", () => {
    expect(ROLE_VISIBILITY.investor.showLhaComparison).toBe(false)
  })
  it("investor never has showR2RMetrics", () => {
    expect(ROLE_VISIBILITY.investor.showR2RMetrics).toBe(false)
  })

  // Council should NEVER see deal scores or yield calculators
  it("council_ta never has showDealScore", () => {
    expect(ROLE_VISIBILITY.council_ta.showDealScore).toBe(false)
  })
  it("council_ta never has showDealVerdict", () => {
    expect(ROLE_VISIBILITY.council_ta.showDealVerdict).toBe(false)
  })
  it("council_ta never has showYieldCalculator", () => {
    expect(ROLE_VISIBILITY.council_ta.showYieldCalculator).toBe(false)
  })
  it("council_ta never has showYieldMetrics", () => {
    expect(ROLE_VISIBILITY.council_ta.showYieldMetrics).toBe(false)
  })
  it("council_ta never has showOwnership", () => {
    expect(ROLE_VISIBILITY.council_ta.showOwnership).toBe(false)
  })

  // Operator is minimal — only ownership
  it("operator only has showOwnership", () => {
    const op = ROLE_VISIBILITY.operator
    const trueFlags = ALL_FLAGS.filter((f) => op[f])
    expect(trueFlags).toEqual(["showOwnership"])
  })

  // Agent mirrors investor
  it("agent has same deal-related flags as investor", () => {
    expect(ROLE_VISIBILITY.agent.showDealScore).toBe(ROLE_VISIBILITY.investor.showDealScore)
    expect(ROLE_VISIBILITY.agent.showDealVerdict).toBe(ROLE_VISIBILITY.investor.showDealVerdict)
    expect(ROLE_VISIBILITY.agent.showYieldMetrics).toBe(ROLE_VISIBILITY.investor.showYieldMetrics)
    expect(ROLE_VISIBILITY.agent.showYieldCalculator).toBe(ROLE_VISIBILITY.investor.showYieldCalculator)
    expect(ROLE_VISIBILITY.agent.showHmoClassification).toBe(ROLE_VISIBILITY.investor.showHmoClassification)
  })

  // No role should ever have R2R and Yield at the same time
  ALL_ROLES.forEach((role) => {
    it(`${role} never has both showYieldMetrics and showR2RMetrics`, () => {
      const v = ROLE_VISIBILITY[role]
      expect(v.showYieldMetrics && v.showR2RMetrics).toBe(false)
    })
  })

  // TA-only flags should only be true for council_ta
  const taOnlyFlags: (keyof RoleVisibility)[] = ["showTaSuitability", "showLhaComparison", "showR2RMetrics"]
  taOnlyFlags.forEach((flag) => {
    ALL_ROLES.filter((r) => r !== "council_ta").forEach((role) => {
      it(`${role} does NOT have ${flag}`, () => {
        expect(ROLE_VISIBILITY[role][flag]).toBe(false)
      })
    })
  })
})

// ============================================================================
// 5. Structure & type safety
// ============================================================================
describe("Structure & Type Safety", () => {
  it("ROLE_VISIBILITY has exactly 4 roles", () => {
    expect(Object.keys(ROLE_VISIBILITY)).toHaveLength(4)
  })

  it("every role config has exactly 9 boolean flags", () => {
    ALL_ROLES.forEach((role) => {
      const config = ROLE_VISIBILITY[role]
      const keys = Object.keys(config)
      expect(keys).toHaveLength(9)
      keys.forEach((k) => {
        expect(typeof config[k as keyof RoleVisibility]).toBe("boolean")
      })
    })
  })

  it("all role configs have the same keys", () => {
    const referenceKeys = Object.keys(ROLE_VISIBILITY.investor).sort()
    ALL_ROLES.forEach((role) => {
      expect(Object.keys(ROLE_VISIBILITY[role]).sort()).toEqual(referenceKeys)
    })
  })
})

// ============================================================================
// 6. Bulk: every (role × flag) produces a boolean
// ============================================================================
describe("Bulk: Role × Flag Matrix", () => {
  ALL_ROLES.forEach((role) => {
    ALL_FLAGS.forEach((flag) => {
      it(`${role}.${flag} is a boolean`, () => {
        const v = getVisibilityForRole(role)
        expect(typeof v[flag]).toBe("boolean")
      })
    })
  })
})

// ============================================================================
// 7. Idempotency & immutability
// ============================================================================
describe("Idempotency & Immutability", () => {
  it("calling getVisibilityForRole twice returns equal objects", () => {
    ALL_ROLES.forEach((role) => {
      expect(getVisibilityForRole(role)).toEqual(getVisibilityForRole(role))
    })
  })

  it("fallback called 100 times always returns same result", () => {
    const first = getVisibilityForRole(null)
    for (let i = 0; i < 100; i++) {
      expect(getVisibilityForRole(null)).toEqual(first)
    }
  })

  it("role configs called 100 times always return same result", () => {
    ALL_ROLES.forEach((role) => {
      const first = getVisibilityForRole(role)
      for (let i = 0; i < 100; i++) {
        expect(getVisibilityForRole(role)).toEqual(first)
      }
    })
  })
})

// ============================================================================
// 8. Flag count sanity per role
// ============================================================================
describe("Flag Count Sanity", () => {
  it("investor has 6 true flags", () => {
    const v = ROLE_VISIBILITY.investor
    const trueCount = ALL_FLAGS.filter((f) => v[f]).length
    expect(trueCount).toBe(6)
  })

  it("council_ta has 3 true flags", () => {
    const v = ROLE_VISIBILITY.council_ta
    const trueCount = ALL_FLAGS.filter((f) => v[f]).length
    expect(trueCount).toBe(3)
  })

  it("operator has 1 true flag", () => {
    const v = ROLE_VISIBILITY.operator
    const trueCount = ALL_FLAGS.filter((f) => v[f]).length
    expect(trueCount).toBe(1)
  })

  it("agent has 6 true flags", () => {
    const v = ROLE_VISIBILITY.agent
    const trueCount = ALL_FLAGS.filter((f) => v[f]).length
    expect(trueCount).toBe(6)
  })

  it("fallback has all 9 flags true", () => {
    const v = getVisibilityForRole(null)
    const trueCount = ALL_FLAGS.filter((f) => v[f]).length
    expect(trueCount).toBe(9)
  })
})

// ============================================================================
// 9. Symmetry checks
// ============================================================================
describe("Symmetry Checks", () => {
  it("investor and agent have identical visibility", () => {
    expect(ROLE_VISIBILITY.investor).toEqual(ROLE_VISIBILITY.agent)
  })

  it("council_ta is the only role with R2R metrics", () => {
    const rolesWithR2R = ALL_ROLES.filter((r) => ROLE_VISIBILITY[r].showR2RMetrics)
    expect(rolesWithR2R).toEqual(["council_ta"])
  })

  it("council_ta is the only role with TA suitability", () => {
    const rolesWithTA = ALL_ROLES.filter((r) => ROLE_VISIBILITY[r].showTaSuitability)
    expect(rolesWithTA).toEqual(["council_ta"])
  })

  it("council_ta is the only role with LHA comparison", () => {
    const rolesWithLHA = ALL_ROLES.filter((r) => ROLE_VISIBILITY[r].showLhaComparison)
    expect(rolesWithLHA).toEqual(["council_ta"])
  })
})

// ============================================================================
// 10. Stress: rapid alternating role lookups
// ============================================================================
describe("Stress: Rapid Role Lookups", () => {
  it("handles 1000 alternating role lookups without error", () => {
    const inputs: (UserType | null | undefined)[] = [
      ...ALL_ROLES,
      null,
      undefined,
      "bad" as UserType,
    ]
    for (let i = 0; i < 1000; i++) {
      const input = inputs[i % inputs.length]
      const result = getVisibilityForRole(input)
      expect(result).toBeDefined()
      expect(typeof result.showDealScore).toBe("boolean")
    }
  })

  it("1000 random role lookups all return valid configs", () => {
    for (let i = 0; i < 1000; i++) {
      const role = ALL_ROLES[Math.floor(Math.random() * ALL_ROLES.length)]
      const v = getVisibilityForRole(role)
      ALL_FLAGS.forEach((flag) => {
        expect(typeof v[flag]).toBe("boolean")
      })
    }
  })
})
