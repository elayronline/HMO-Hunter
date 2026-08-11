import { describe, it, expect } from "vitest"
import {
  getWalkthroughSteps,
  FALLBACK_STEPS,
  type Step,
  type HighlightPosition,
  type ArrowDirection,
} from "@/lib/walkthrough-steps"


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
  ;[null].forEach(() => {
    describe("walkthrough steps", () => {
      const steps = getWalkthroughSteps()

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
    ;[null].forEach(() => {
      const steps = getWalkthroughSteps()
      expect(steps[0].title).toContain("Welcome")
    })
  })

  it("every role should end with a You're Ready step", () => {
    ;[null].forEach(() => {
      const steps = getWalkthroughSteps()
      expect(steps[steps.length - 1].title).toContain("Ready")
    })
  })

  it("every role should have a Property Map step", () => {
    ;[null].forEach(() => {
      const steps = getWalkthroughSteps()
      const mapStep = steps.find((s) => s.title === "Property Map")
      expect(mapStep).toBeDefined()
    })
  })

  it("every role should have a Search & Filters step", () => {
    ;[null].forEach(() => {
      const steps = getWalkthroughSteps()
      const filterStep = steps.find((s) => s.title === "Search & Filters")
      expect(filterStep).toBeDefined()
    })
  })

  it("every role should have a Quick Filter Tabs step", () => {
    ;[null].forEach(() => {
      const steps = getWalkthroughSteps()
      const tabStep = steps.find((s) => s.title === "Quick Filter Tabs")
      expect(tabStep).toBeDefined()
    })
  })

  it("every role should have a Property Details step with showPropertyDetails flag", () => {
    ;[null].forEach(() => {
      const steps = getWalkthroughSteps()
      const detailsStep = steps.find((s) => s.showPropertyDetails === true)
      expect(detailsStep).toBeDefined()
      expect(detailsStep!.title).toContain("Property Details")
    })
  })

  it("exactly one step per role should have showPropertyDetails = true", () => {
    ;[null].forEach(() => {
      const steps = getWalkthroughSteps()
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
describe("Walkthrough Content", () => {
  // One walkthrough, so there is no longer any cross-role content to keep
  // apart. What it must still do is describe the two jobs the platform exists
  // for: finding opportunities, and checking they are what they appear to be.
  const allText = getWalkthroughSteps()
    .map((s) => s.description)
    .join(" ")
    .toLowerCase()

  it("covers sourcing", () => {
    expect(allText).toContain("yield")
    expect(allText).toContain("deal score")
  })

  it("covers verification", () => {
    expect(allText).toMatch(/licence|article 4|epc/)
  })

  // The removed models must not linger in the copy a new user is shown first.
  it("does not describe anything the platform no longer does", () => {
    expect(allText).not.toContain("ta suitability")
    expect(allText).not.toContain("lha")
    expect(allText).not.toContain("r2hmo")
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

// ============================================================================
// No Step Gaps
// ============================================================================
describe("No Step Gaps", () => {
  ;[null].forEach(() => {
    it("should have no undefined or null entries", () => {
      const steps = getWalkthroughSteps()
      steps.forEach((step, i) => {
        expect(step, "step ${i} is undefined/null for").toBeDefined()
        expect(step, "step ${i} is null for").not.toBeNull()
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

