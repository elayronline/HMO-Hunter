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
  /**
   * In HMO use, but which side of the C4 / sui generis line is not established.
   *
   * Its own value rather than a guess at C4, because the two are not degrees of
   * the same thing: C4 can be reached from C3 by permitted development and sui
   * generis never can. Naming one when the register published no occupancy told
   * 347 properties they had a permitted route that may not exist — 131 of them
   * while displaying seven or more bedrooms beside the words "small HMO".
   */
  | "hmo_unspecified"
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
  /**
   * A maximum occupancy a council actually granted, and nothing else.
   *
   * Deliberately not named max_occupants. That column exists on every property
   * row and holds bedrooms + 1 on all 252 rows that have a value — a formula
   * from scripts/012_populate_licence_term_data.sql, not a council's figure.
   * Callers pass whole property rows, so a field of that name would have been
   * picked up at runtime whatever the type said, and the branch below grades
   * its conclusion "recorded": the report was telling a buyer "Licensed for 6
   * occupants, within the 3-6 range that defines a small HMO" on the strength
   * of arithmetic.
   *
   * Nothing populates this today. No column in the schema holds a published
   * occupancy, so every licensed property falls through to hmo_unspecified,
   * which is the true answer. Wire it up when a register supplies one.
   */
  licensed_max_occupants?: number | null
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

/**
 * Commercial types, matching the set categorisation uses. Kept as a type check
 * rather than guessed from a missing bedroom count: a house with no bedrooms
 * recorded is a gap in the data, not a shop.
 */
const COMMERCIAL_TYPES = new Set(["commercial", "office", "retail", "class e"])

export function assessUseClass(input: UseClassInput): UseClassAssessment {
  const occupants = input.licensed_max_occupants ?? null
  const beds = input.bedrooms ?? null
  const licensed = Boolean(input.licensed_hmo) || input.licence_status === "expired"
  const type = input.property_type?.trim().toLowerCase()

  // A licence is the strongest evidence available: a council granted it against
  // a stated maximum occupancy, so both the HMO use and its size are recorded.
  if (licensed && occupants !== null) {
    return occupants >= SUI_GENERIS_FROM
      ? {
          useClass: "sui_generis",
          basis: "recorded",
          reason: `Licensed for ${occupants} occupants, which is at or above the ${SUI_GENERIS_FROM}-occupant threshold, so the use is sui generis rather than C4.`,
        }
      : {
          useClass: "C4",
          basis: "recorded",
          reason: `Licensed for ${occupants} occupants, within the 3-6 range that defines a small HMO.`,
        }
  }

  // Licensed, but the register published no maximum occupancy. The HMO use is
  // recorded; its size is not. Guessing C4 here would assert a permitted
  // development route that sui generis does not have.
  if (licensed) {
    const bedNote =
      beds !== null && beds >= SUI_GENERIS_FROM
        ? ` The listing shows ${beds} bedrooms, which points towards sui generis, but bedrooms are not occupants and the council published no figure.`
        : ""
    return {
      useClass: "hmo_unspecified",
      basis: "recorded",
      reason: `An HMO licence is recorded, so the property is in HMO use. The register gives no maximum occupancy, so whether that use is C4 or sui generis is not established — and the difference decides whether a permitted development route exists at all.${bedNote}`,
    }
  }

  // Commercial stock. The starting point for a Class MA conversion, and until
  // now unreachable: property_type was an input this function never read, so
  // the commercial route in conversion.ts could never fire.
  if (type && COMMERCIAL_TYPES.has(type)) {
    return {
      useClass: "E",
      basis: "recorded",
      reason: `Recorded as ${input.property_type}, which falls in Class E — the starting point for a Class MA conversion to residential.`,
    }
  }

  // A property too small to be a C4 at all. This is a physical constraint
  // rather than a reading of the data, which is why it survives the rule
  // against inferring: three unrelated occupants will not fit in two bedrooms.
  if (beds !== null && beds > 0 && beds <= 2) {
    return {
      useClass: "C3",
      basis: "inferred",
      reason: `${beds} bedroom${beds === 1 ? "" : "s"}, which cannot house the three unrelated occupants a C4 HMO requires, so the use is C3.`,
    }
  }

  // Everything else is a guess and is no longer made. A five-bedroom house with
  // no licence may be a family home or an unlicensed HMO, and the data does not
  // say which. Naming C3 read as a fact and was frequently wrong.
  return {
    useClass: "unknown",
    basis: "none",
    reason:
      beds !== null && beds > 0
        ? `${beds} bedrooms, but nothing records the current use and no licence is held. A house this size could be a single dwelling or an unlicensed HMO — the data does not distinguish them, so the class is not established.`
        : "No licence, occupancy or bedroom count to establish a use class from.",
  }
}

export const USE_CLASS_LABELS: Record<UseClass, string> = {
  C2: "C2 — residential institution",
  C3: "C3 — dwellinghouse",
  C4: "C4 — small HMO",
  sui_generis: "Sui generis — large HMO",
  hmo_unspecified: "HMO — size class not established",
  E: "Class E — commercial",
  unknown: "Use class unknown",
}
