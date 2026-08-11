/**
 * What planning use class a property operates under, and what it would take to
 * make it an HMO.
 *
 * The council-level reference text in lib/article4/assessment.ts describes the
 * classes in the abstract. This answers it for a specific property, which is a
 * different question and a much less certain one: nothing in the data records a
 * use class, so it has to be inferred, and an inference presented as a fact is
 * the failure this codebase keeps finding. Every result therefore carries how it
 * was arrived at, and `inferred` is the normal case.
 *
 * The route to an HMO differs by where you start:
 *
 *   C3  → C4   permitted development (GPDO Sch.2 Pt.3 Class L), unless an
 *              Article 4 direction removes it
 *   C3  → sui generis   always a full application, whatever the council
 *   E   → C3   permitted development (Class MA), then C3 → C4 as above. Two
 *              rights, either of which an Article 4 direction can remove — so a
 *              commercial conversion is only as viable as the weaker one
 *   C2  → C4/sui generis   always a full application. C2 is a residential
 *              institution, not a dwellinghouse, so no permitted development
 *              route exists at all
 */

export type UseClass =
  /** Residential institution — care home, hospital, residential school. */
  | "C2"
  /** Dwellinghouse: a single household, or up to two unrelated occupants. */
  | "C3"
  /** Small HMO: 3-6 unrelated occupants sharing amenities. */
  | "C4"
  /** Large HMO: 7 or more unrelated occupants. No class of its own. */
  | "sui_generis"
  /** Commercial, business and service — the starting point for a conversion. */
  | "E"
  /** Nothing in the data supports a view. */
  | "unknown"

/** How much weight the class carries. */
export type UseClassBasis =
  /** Recorded by a source — a licence, a register entry, a listing. */
  | "recorded"
  /** Derived from occupancy or bedroom count. A reading, not a record. */
  | "inferred"
  /** No basis. */
  | "none"

export interface UseClassAssessment {
  useClass: UseClass
  basis: UseClassBasis
  /** Plain sentence naming what the conclusion rests on. */
  reason: string
}

export interface UseClassInput {
  property_type?: string | null
  bedrooms?: number | null
  max_occupants?: number | null
  licensed_hmo?: boolean | null
  licence_status?: string | null
  hmo_status?: string | null
}

/**
 * The occupancy that decides C4 from sui generis.
 *
 * Occupants, not bedrooms. A seven-bedroom house let to six people is C4; a
 * four-bedroom house let to eight is sui generis. Bedrooms are only ever a
 * stand-in for occupancy, which is why using them is marked `inferred`.
 */
const SUI_GENERIS_FROM = 7

export function assessUseClass(input: UseClassInput): UseClassAssessment {
  const occupants = input.max_occupants ?? null
  const beds = input.bedrooms ?? null
  const licensed = Boolean(input.licensed_hmo) || input.licence_status === "expired"

  // A licence is the strongest evidence available: a council granted it against
  // a stated maximum occupancy, so both the HMO use and its size are recorded.
  if (licensed && occupants !== null) {
    return occupants >= SUI_GENERIS_FROM
      ? {
          useClass: "sui_generis",
          basis: "recorded",
          reason: `Licensed for ${occupants} occupants, which is above the ${SUI_GENERIS_FROM}-occupant threshold, so the use is sui generis rather than C4.`,
        }
      : {
          useClass: "C4",
          basis: "recorded",
          reason: `Licensed for ${occupants} occupants, within the 3-6 range that defines a small HMO.`,
        }
  }

  if (licensed) {
    return {
      useClass: "C4",
      basis: "inferred",
      reason:
        "Holds an HMO licence but the register gives no maximum occupancy, so the class cannot be separated from sui generis. C4 is the smaller claim of the two.",
    }
  }

  if (occupants !== null && occupants >= SUI_GENERIS_FROM) {
    return {
      useClass: "sui_generis",
      basis: "inferred",
      reason: `Recorded occupancy of ${occupants} is above the ${SUI_GENERIS_FROM}-occupant threshold, though no licence confirms the use.`,
    }
  }

  if (beds !== null && beds > 0) {
    if (beds <= 2) {
      return {
        useClass: "C3",
        basis: "inferred",
        reason: `${beds} bedroom${beds === 1 ? "" : "s"}, which cannot house the three unrelated occupants a C4 HMO requires.`,
      }
    }
    return {
      useClass: "C3",
      basis: "inferred",
      reason: `${beds} bedrooms, but nothing records it as being in HMO use — a house of this size is C3 until it is let to three or more unrelated occupants.`,
    }
  }

  return {
    useClass: "unknown",
    basis: "none",
    reason: "No occupancy, bedroom count or licence to reason from.",
  }
}

export const USE_CLASS_LABELS: Record<UseClass, string> = {
  C2: "C2 — residential institution",
  C3: "C3 — dwellinghouse",
  C4: "C4 — small HMO",
  sui_generis: "Sui generis — large HMO",
  E: "Class E — commercial",
  unknown: "Use class unknown",
}
