import { describe, it, expect } from "vitest"
import {
  getStepsForRole,
  ROLE_STEPS,
  FALLBACK_STEPS,
  type Step,
  type HighlightPosition,
  type ArrowDirection,
} from "@/lib/walkthrough-steps"
import type { UserType } from "@/components/role-selection-modal"

const ALL_ROLES: UserType[] = ["investor", "council_ta", "operator", "agent"]

const VALID_POSITIONS: HighlightPosition[] = [
  "center", "top-left", "top-center", "top-right",
  "left", "right", "bottom-left", "bottom-center",
  "center-left", "center-right",
]

const VALID_ARROWS: ArrowDirection[] = ["up", "down", "left", "right", "none"]

const REQUIRED_STEP_FIELDS: (keyof Step)[] = [
  "icon", "title", "description", "color", "bgColor", "highlight", "arrow", "targetHint",
]

// ============================================================================
// Data Integrity
// ============================================================================
describe("Step Data Integrity", () => {
  ALL_ROLES.forEach((role) => {
    describe(`${role} steps`, () => {
      const steps = getStepsForRole(role)

      it("should return a non-empty array", () => {
        expect(Array.isArray(steps)).toBe(true)
        expect(steps.length).toBeGreaterThan(0)
      })

      it("should have 7 steps", () => {
        expect(steps.length).toBe(7)
      })

      steps.forEach((step, index) => {
        describe(`step ${index + 1}: ${step.title}`, () => {
          REQUIRED_STEP_FIELDS.forEach((field) => {
            it(`should have ${field} defined`, () => {
              expect(step[field]).toBeDefined()
            })
          })

          it("should have non-empty title", () => {
            expect(step.title.trim().length).toBeGreaterThan(0)
          })

          it("should have non-empty description", () => {
            expect(step.description.trim().length).toBeGreaterThan(0)
          })

          it("should have a valid highlight position", () => {
            expect(VALID_POSITIONS).toContain(step.highlight)
          })

          it("should have a valid arrow direction", () => {
            expect(VALID_ARROWS).toContain(step.arrow)
          })

          it("should have a valid icon component", () => {
            expect(step.icon).toBeDefined()
            expect(typeof step.icon === "function" || typeof step.icon === "object").toBe(true)
          })

          it("should have valid Tailwind color class", () => {
            expect(step.color).toMatch(/^text-\w+-\d+$/)
          })

          it("should have valid Tailwind bg class", () => {
            expect(step.bgColor).toMatch(/^bg-\w+-\d+$/)
          })
        })
      })
    })
  })

  describe("fallback steps", () => {
    it("should have 6 steps", () => {
      expect(FALLBACK_STEPS.length).toBe(6)
    })

    FALLBACK_STEPS.forEach((step, index) => {
      it(`step ${index + 1} should have all required fields`, () => {
        REQUIRED_STEP_FIELDS.forEach((field) => {
          expect(step[field]).toBeDefined()
        })
      })
    })
  })
})

// ============================================================================
// Shared Steps Consistency
// ============================================================================
describe("Shared Steps Consistency", () => {
  it("every role should start with a Welcome step", () => {
    ALL_ROLES.forEach((role) => {
      const steps = getStepsForRole(role)
      expect(steps[0].title).toContain("Welcome")
    })
  })

  it("every role should end with a You're Ready step", () => {
    ALL_ROLES.forEach((role) => {
      const steps = getStepsForRole(role)
      expect(steps[steps.length - 1].title).toContain("Ready")
    })
  })

  it("every role should have a Property Map step", () => {
    ALL_ROLES.forEach((role) => {
      const steps = getStepsForRole(role)
      const mapStep = steps.find((s) => s.title === "Property Map")
      expect(mapStep).toBeDefined()
    })
  })

  it("every role should have a Search & Filters step", () => {
    ALL_ROLES.forEach((role) => {
      const steps = getStepsForRole(role)
      const filterStep = steps.find((s) => s.title === "Search & Filters")
      expect(filterStep).toBeDefined()
    })
  })

  it("every role should have a Quick Filter Tabs step", () => {
    ALL_ROLES.forEach((role) => {
      const steps = getStepsForRole(role)
      const tabStep = steps.find((s) => s.title === "Quick Filter Tabs")
      expect(tabStep).toBeDefined()
    })
  })

  it("every role should have a Property Details step with showPropertyDetails flag", () => {
    ALL_ROLES.forEach((role) => {
      const steps = getStepsForRole(role)
      const detailsStep = steps.find((s) => s.showPropertyDetails === true)
      expect(detailsStep).toBeDefined()
      expect(detailsStep!.title).toContain("Property Details")
    })
  })

  it("exactly one step per role should have showPropertyDetails = true", () => {
    ALL_ROLES.forEach((role) => {
      const steps = getStepsForRole(role)
      const detailSteps = steps.filter((s) => s.showPropertyDetails === true)
      expect(detailSteps.length).toBe(1)
    })
  })

  it("fallback steps should also have exactly one showPropertyDetails step", () => {
    const detailSteps = FALLBACK_STEPS.filter((s) => s.showPropertyDetails === true)
    expect(detailSteps.length).toBe(1)
  })
})

// ============================================================================
// Role-Specific Content
// ============================================================================
describe("Role-Specific Content", () => {
  it("investor steps should mention yield and deal score", () => {
    const steps = getStepsForRole("investor")
    const allText = steps.map((s) => s.description).join(" ").toLowerCase()
    expect(allText).toContain("yield")
    expect(allText).toContain("deal score")
  })

  it("council_ta steps should mention TA suitability and LHA", () => {
    const steps = getStepsForRole("council_ta")
    const allText = steps.map((s) => s.description).join(" ").toLowerCase()
    expect(allText).toContain("ta suitability")
    expect(allText).toContain("lha")
  })

  it("operator steps should mention licence and expiry", () => {
    const steps = getStepsForRole("operator")
    const allText = steps.map((s) => s.description).join(" ").toLowerCase()
    expect(allText).toContain("licence")
    expect(allText).toContain("expir")
  })

  it("agent steps should mention deal score and comparison", () => {
    const steps = getStepsForRole("agent")
    const allText = steps.map((s) => s.description).join(" ").toLowerCase()
    expect(allText).toContain("deal score")
    expect(allText).toContain("comparison")
  })

  // Cross-checks: roles should NOT contain each other's unique content
  it("investor steps should NOT mention TA suitability", () => {
    const steps = getStepsForRole("investor")
    const allText = steps.map((s) => s.description).join(" ").toLowerCase()
    expect(allText).not.toContain("ta suitability")
  })

  it("council_ta steps should NOT mention yield calculator", () => {
    const steps = getStepsForRole("council_ta")
    const allText = steps.map((s) => s.description).join(" ").toLowerCase()
    expect(allText).not.toContain("yield calculator")
  })

  it("operator steps should NOT mention comparison tool", () => {
    const steps = getStepsForRole("operator")
    const allText = steps.map((s) => s.description).join(" ").toLowerCase()
    expect(allText).not.toContain("comparison tool")
  })

  it("agent steps should NOT mention TA suitability", () => {
    const steps = getStepsForRole("agent")
    const allText = steps.map((s) => s.description).join(" ").toLowerCase()
    expect(allText).not.toContain("ta suitability")
  })

  it("each role welcome step should have a role-specific description", () => {
    const descriptions = ALL_ROLES.map(
      (role) => getStepsForRole(role)[0].description
    )
    const unique = new Set(descriptions)
    expect(unique.size).toBe(ALL_ROLES.length)
  })
})

// ============================================================================
// Edge Cases
// ============================================================================
describe("Edge Cases", () => {
  it("should return fallback steps for null role", () => {
    const steps = getStepsForRole(null)
    expect(steps).toBe(FALLBACK_STEPS)
    expect(steps.length).toBe(6)
  })

  it("should return fallback steps for undefined role", () => {
    const steps = getStepsForRole(undefined)
    expect(steps).toBe(FALLBACK_STEPS)
    expect(steps.length).toBe(6)
  })

  it("should return fallback steps for unknown role string", () => {
    const steps = getStepsForRole("unknown_role" as UserType)
    expect(steps).toBe(FALLBACK_STEPS)
  })

  it("should return fallback steps for empty string role", () => {
    const steps = getStepsForRole("" as UserType)
    expect(steps).toBe(FALLBACK_STEPS)
  })

  it("should return different steps for different roles", () => {
    const investorSteps = getStepsForRole("investor")
    const councilSteps = getStepsForRole("council_ta")
    // Middle steps should differ
    expect(investorSteps[1].description).not.toBe(councilSteps[1].description)
    expect(investorSteps[3].title).not.toBe(councilSteps[3].title)
  })

  it("should return stable references for the same role", () => {
    const a = getStepsForRole("investor")
    const b = getStepsForRole("investor")
    expect(a).toBe(b)
  })

  it("should return stable reference for fallback", () => {
    const a = getStepsForRole(null)
    const b = getStepsForRole(undefined)
    expect(a).toBe(b)
  })

  it("ROLE_STEPS should cover all 4 roles", () => {
    ALL_ROLES.forEach((role) => {
      expect(ROLE_STEPS[role]).toBeDefined()
      expect(ROLE_STEPS[role].length).toBeGreaterThan(0)
    })
  })
})

// ============================================================================
// No Step Gaps
// ============================================================================
describe("No Step Gaps", () => {
  ALL_ROLES.forEach((role) => {
    it(`${role} should have no undefined or null entries`, () => {
      const steps = getStepsForRole(role)
      steps.forEach((step, i) => {
        expect(step, `step ${i} is undefined/null for ${role}`).toBeDefined()
        expect(step, `step ${i} is null for ${role}`).not.toBeNull()
      })
    })
  })

  it("fallback steps should have no undefined entries", () => {
    FALLBACK_STEPS.forEach((step, i) => {
      expect(step, `fallback step ${i} is undefined`).toBeDefined()
      expect(step, `fallback step ${i} is null`).not.toBeNull()
    })
  })
})

// ============================================================================
// Stress: Bulk Iteration
// ============================================================================
describe("Stress: Bulk Iteration", () => {
  it("should handle 1000 sequential getStepsForRole calls without error", () => {
    for (let i = 0; i < 1000; i++) {
      const role = ALL_ROLES[i % ALL_ROLES.length]
      const steps = getStepsForRole(role)
      expect(steps.length).toBe(7)
    }
  })

  it("should handle rapid role switching", () => {
    let prev: Step[] | null = null
    for (let i = 0; i < 500; i++) {
      const role = ALL_ROLES[i % ALL_ROLES.length]
      const steps = getStepsForRole(role)
      if (prev && i % ALL_ROLES.length === 0) {
        // Same role should give same reference
        expect(steps).toBe(getStepsForRole(role))
      }
      prev = steps
    }
  })

  it("should handle alternating between valid and invalid roles", () => {
    const mixed = ["investor", null, "council_ta", undefined, "operator", "" as UserType, "agent", "fake" as UserType]
    mixed.forEach((role) => {
      const steps = getStepsForRole(role as UserType | null | undefined)
      expect(steps.length).toBeGreaterThan(0)
      expect(steps[0].title).toContain("Welcome")
    })
  })
})
