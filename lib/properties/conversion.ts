/**
 * Whether a property can become an HMO, and what stands in the way.
 *
 * A commercial conversion is not one permission but two, taken in order:
 *
 *   1. Class MA   commercial (E) → dwellinghouse (C3)
 *   2. Class L    dwellinghouse (C3) → small HMO (C4)
 *
 * Either can be withdrawn by an Article 4 direction, independently, and a great
 * many councils have withdrawn one without the other. Luton has removed Class MA
 * across its town centre and business parks while leaving C3→C4 alone; the
 * reverse is far more common still. So a route is only as good as its weaker
 * step, and quoting one permission while ignoring the other is how a conversion
 * gets sold as permitted development when it needs a full application.
 *
 * What this returns is never a yes. The most it says is that no direction is
 * recorded against either step — which is a statement about what we know, not
 * about what the council will do. Whether a building can actually take the
 * layout is a question for the floor plan and the council, and the assessment
 * says so rather than implying otherwise.
 */

import type { UseClass } from "./use-class"

/** How a route stands, on what we hold. */
export type RouteStatus =
  /** No Article 4 direction recorded against this step. */
  | "permitted_development"
  /** An Article 4 direction removes the right; a full application is needed. */
  | "planning_permission_required"
  /** No permitted development route exists for this step in any council. */
  | "no_permitted_route"
  /** The council's position is not known. Never treat as either of the above. */
  | "unknown"

export interface ConversionStep {
  from: UseClass
  to: UseClass
  /** The GPDO class the step relies on, where there is one. */
  gpdoClass: string | null
  status: RouteStatus
  note: string
}

export interface ConversionAssessment {
  /** True only where every step is permitted development on what we hold. */
  wholeRoutePermitted: boolean
  steps: ConversionStep[]
  /** What stops it, in the order a buyer would hit it. */
  blockers: string[]
  /** What cannot be judged from data and needs a person. */
  openQuestions: string[]
}

export interface ConversionInput {
  useClass: UseClass
  /** An HMO Article 4 direction is in force for this council. */
  hmoArticle4InForce: boolean
  /**
   * A Class MA direction is in force — commercial to residential withdrawn.
   * Separate from the HMO one and frequently present without it.
   */
  classMaArticle4InForce: boolean
  /** False when the council's Article 4 position has not been established. */
  councilPositionKnown: boolean
  /** Whether a floor plan exists to judge the layout against. */
  hasFloorPlan: boolean
  bedrooms?: number | null
}

function hmoStep(input: ConversionInput): ConversionStep {
  const base = { from: "C3" as UseClass, to: "C4" as UseClass, gpdoClass: "Schedule 2, Part 3, Class L" }

  if (!input.councilPositionKnown) {
    return {
      ...base,
      status: "unknown",
      note: "This council's Article 4 position has not been established, so whether C3 to C4 is still permitted development here is unknown.",
    }
  }
  return input.hmoArticle4InForce
    ? {
        ...base,
        status: "planning_permission_required",
        note: "An HMO Article 4 direction is in force, so the C3 to C4 right has been withdrawn and a full planning application is required.",
      }
    : {
        ...base,
        status: "permitted_development",
        note: "No HMO Article 4 direction is recorded for this council, so C3 to C4 remains permitted development.",
      }
}

export function assessConversion(input: ConversionInput): ConversionAssessment {
  const steps: ConversionStep[] = []
  const blockers: string[] = []
  const openQuestions: string[] = []

  if (input.useClass === "E") {
    // Step one: commercial to residential.
    if (!input.councilPositionKnown) {
      steps.push({
        from: "E",
        to: "C3",
        gpdoClass: "Schedule 2, Part 3, Class MA",
        status: "unknown",
        note: "This council's Article 4 position has not been established, so whether Class MA is still available here is unknown.",
      })
    } else if (input.classMaArticle4InForce) {
      steps.push({
        from: "E",
        to: "C3",
        gpdoClass: "Schedule 2, Part 3, Class MA",
        status: "planning_permission_required",
        note: "A Class MA Article 4 direction is in force, so commercial to residential has been withdrawn and needs a full application before any HMO use is reached.",
      })
      blockers.push("Class MA withdrawn by Article 4 — commercial to residential needs planning permission")
    } else {
      steps.push({
        from: "E",
        to: "C3",
        gpdoClass: "Schedule 2, Part 3, Class MA",
        status: "permitted_development",
        note: "No Class MA Article 4 direction is recorded for this council. Class MA still carries its own qualifying conditions — two years of prior Class E use, and prior approval — which are not assessed here.",
      })
      openQuestions.push(
        "Class MA requires the building to have been in Class E use for a continuous two years before the prior approval application. Nothing in our data establishes that."
      )
      openQuestions.push(
        "Prior approval is still required — transport, contamination, flooding, noise, natural light and fire safety. It is a decision, not a formality."
      )
    }

    const second = hmoStep(input)
    steps.push(second)
    if (second.status === "planning_permission_required") {
      blockers.push("HMO Article 4 in force — C3 to C4 needs planning permission")
    }
  } else if (input.useClass === "C2") {
    steps.push({
      from: "C2",
      to: "C4",
      gpdoClass: null,
      status: "no_permitted_route",
      note: "C2 is a residential institution rather than a dwellinghouse, so there is no permitted development route to HMO use from it. A full planning application is required whatever the council's Article 4 position.",
    })
    blockers.push("No permitted development route exists from C2 — a full application is required")
  } else if (input.useClass === "C3") {
    const step = hmoStep(input)
    steps.push(step)
    if (step.status === "planning_permission_required") {
      blockers.push("HMO Article 4 in force — C3 to C4 needs planning permission")
    }
  } else if (input.useClass === "unknown") {
    // The class is not established, but the route still matters — this is the
    // ordinary case for an unlicensed house, and dropping the section would
    // leave the reader with nothing where the answer is "probably, if". So the
    // route is shown on a stated condition rather than on an assumption
    // presented as fact.
    const step = hmoStep(input)
    steps.push({
      ...step,
      note: `If this is currently a C3 dwellinghouse — which we have not established — ${
        step.note.charAt(0).toLowerCase() + step.note.slice(1)
      }`,
    })
    if (step.status === "planning_permission_required") {
      blockers.push("HMO Article 4 in force — C3 to C4 needs planning permission")
    }
    openQuestions.push(
      "The property's current lawful use is not established. If it is already in HMO use, no change of use is needed; if it is something other than a dwellinghouse, the route above does not apply. The council's planning records will settle it."
    )
  } else if (
    input.useClass === "C4" ||
    input.useClass === "sui_generis" ||
    input.useClass === "hmo_unspecified"
  ) {
    return {
      wholeRoutePermitted: true,
      steps: [],
      blockers: [],
      openQuestions:
        input.useClass === "hmo_unspecified"
          ? [
              "Already in HMO use, so no change of use is needed. Whether that use is C4 or sui generis is not established — it matters if the number of occupants is ever increased, because moving into sui generis needs planning permission.",
            ]
          : ["Already in HMO use — no change of use is needed."],
    }
  } else {
    return {
      wholeRoutePermitted: false,
      steps: [],
      blockers: [],
      openQuestions: ["The property's use class is unknown, so no route can be assessed."],
    }
  }

  // Layout is the question data cannot answer. A route being permitted says
  // nothing about whether the building takes the rooms.
  openQuestions.push(
    input.hasFloorPlan
      ? "A floor plan is available — check room sizes against the council's HMO amenity standards before relying on the room count."
      : "No floor plan is available, so the achievable room count cannot be judged. Treat any yield built on an assumed room count as unverified."
  )

  if (input.useClass === "E" && (input.bedrooms == null || input.bedrooms === 0)) {
    openQuestions.push(
      "A commercial unit has no bedroom count, so any room count is a proposal rather than a fact about the building."
    )
  }

  return {
    wholeRoutePermitted:
      steps.length > 0 && steps.every((s) => s.status === "permitted_development"),
    steps,
    blockers,
    openQuestions,
  }
}
