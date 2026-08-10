/**
 * Classifies planning application descriptions into HMO outcomes.
 *
 * A keyword match on "HMO" is not enough, and treating it as one would produce
 * a misleading indicator rather than a useful one. Three traps in the live data:
 *
 *  - Direction is often reversed. "Change of use from HMO into 2 flats (Use
 *    Class C3)" removes supply. Counted as an approval it inverts the signal.
 *  - Lawful Development Certificates split two ways. "Existing use" regularises
 *    an HMO that is already operating; "proposed development" creates a new one.
 *    Merging them inflates apparent new supply.
 *  - Condition discharges and non-material amendments reference the original
 *    permission verbatim, so they look like fresh approvals and are not.
 *
 * Same rule as everywhere else in this feature: when the text does not support a
 * confident call the answer is `unclear`, and `unclear` is excluded from every
 * statistic rather than bucketed with a guess.
 *
 * These are deterministic rules with measured accuracy (see
 * tests/hmo-classifier.test.ts). The interface is deliberately the same shape
 * the LLM extractor will use, so it can be swapped in and scored against the
 * same fixtures.
 */

export type HmoApplicationKind =
  /** Creates a small HMO, C4, 3-6 occupants. */
  | "new_small_hmo"
  /** Creates a large HMO, sui generis, 7+ occupants. */
  | "new_large_hmo"
  /** Existing HMO growing past 6 occupants: C4 to sui generis. */
  | "hmo_intensification"
  /** HMO returning to C3 or self-contained flats. Removes supply. */
  | "reversion"
  /** Certificate confirming an existing HMO use. Not new supply. */
  | "existing_use_certificate"
  /** Condition discharge, amendment, reserved matters. Not a decision on HMO use. */
  | "ancillary"
  /** Mentions the vocabulary but concerns something else. */
  | "not_hmo"
  /** Text does not support a confident call. Never counted. */
  | "unclear"

export interface HmoClassification {
  kind: HmoApplicationKind
  /** Occupants or bedrooms stated in the description, when given. */
  occupants: number | null
  /** True when this application adds HMO supply — the headline indicator. */
  addsSupply: boolean
  /** Which rule fired, for auditing and for diffing against the LLM later. */
  matchedRule: string
}

const HMO_TERMS =
  /\bhmo\b|house[s]?\s*(?:in|of)\s*multiple\s*occupa(?:tion|ncy)|multiple\s*occupation/i

/** Condition discharges, amendments and reserved matters quote the parent permission verbatim. */
const ANCILLARY =
  /details\s+(?:submitted\s+)?pursuant|pursuant\s+to\s+condition|discharge\s+of\s+condition|details\s+pursuant|non[-\s]material\s+amendment|reserved\s+matters|approval\s+of\s+details|variation\s+of\s+condition|removal\s+of\s+condition|details\s+of\s+appearance|appearance,?\s+landscaping/i

/** Anything the HMO use is being replaced by. */
const NON_HMO_TARGET =
  /\bc3\b|use\s*class\s*c3|dwelling|dwellinghouse|self[-\s]contained|\bflats?\b|single\s+family|\bclass\s*e\b|\bc1\b|hotel|shop|office|salon|spa|grooming|retail|caf[eé]|restaurant/

/**
 * HMO -> something else. Must be tested before the "creates an HMO" rules, and
 * has to catch both "change of use FROM an HMO TO x" and "conversion of an
 * existing HMO INTO x", which councils use interchangeably.
 */
const REVERSION = new RegExp(
  `(?:from|of)\\s+(?:[^.]{0,60}?)(?:\\bhmo\\b|house[s]?\\s*(?:in|of)\\s*multiple\\s*occupa(?:tion|ncy))[^.]{0,80}?\\b(?:to|into)\\b[^.]{0,80}?(?:${NON_HMO_TARGET.source})`,
  "i"
)

const LDC =
  /certificate\s+of\s+lawful|lawful\s+development\s+certificate|certificate\s+of\s+existing\s+lawful|lawfulness|lawful\s+use/i
// s191 certifies an EXISTING use; s192 certifies a PROPOSED one. Where a
// description cites the section, that is more reliable than the prose.
const LDC_S191 = /\bs\.?\s?191\b|section\s*191/i
const LDC_S192 = /\bs\.?\s?192\b|section\s*192/i
const LDC_EXISTING = /\bexisting\b|\bcontinued\b|\bcontinuing\b/i
const LDC_PROPOSED = /\bproposed\b/i

/** Physical works to a building already in HMO use — no decision on the use itself. */
const WORKS_ONLY =
  /\b(?:extension|alteration|dormer|loft\s+conversion|outbuilding|porch|render|fenestration|roof\s+light)\b/i
const CHANGE_OF_USE = /change\s+of\s+use|conversion\s+(?:of|to)|convert(?:ed|ing)?\s+to|use\s+of\s+/i

const SUI_GENERIS = /sui[\s-]*generis/i
const C4 = /\bc4\b|use\s*class\s*c4|class\s*c4|small\s+house|small\s+hmo/i
const FROM_C4 = /from[^.]{0,80}?(?:\bc4\b|use\s*class\s*c4|class\s*c4)/i

/** Non-residential uses that share the "sui generis" vocabulary. */
const NOT_HMO_CONTEXT =
  /\bcinema\b|\bcasino\b|\bnightclub\b|\bpetrol\b|\blaunderette\b|\btheatre\b|\bhot\s*food\b|\bdrinking\s+establishment\b|\bchildren'?s?\s+(?:residential\s+)?home\b|\bcare\s+home\b|\bc2\b(?!\s*to)/i

/** Occupant count, preferred over bedroom count where both appear. */
function extractOccupants(text: string): number | null {
  const qty = "(?:\\s*[-\u2013]?\\s*(?:no\\.?|x|nr\\.?)?)?\\s*[-\u2013]?\\s*"
  const occupant = text.match(new RegExp(`(\\d{1,2})${qty}(?:occupant|person|people|resident|tenant)`, "i"))
  if (occupant) return clampCount(occupant[1])

  const bed = text.match(new RegExp(`(\\d{1,2})${qty}bed(?:room|space)?`, "i"))
  if (bed) return clampCount(bed[1])

  const worded = text.match(/\b(three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b\s*(?:no\.?\s*)?(?:bed|occupant|person|people|resident)/i)
  if (worded) return WORD_NUMBERS[worded[1].toLowerCase()] ?? null

  return null
}

const WORD_NUMBERS: Record<string, number> = {
  three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}

function clampCount(raw: string): number | null {
  const n = parseInt(raw, 10)
  // Beyond this it is almost certainly a block of flats or a typo, not an HMO.
  return Number.isFinite(n) && n >= 1 && n <= 40 ? n : null
}

const SUPPLY_ADDING: ReadonlySet<HmoApplicationKind> = new Set([
  "new_small_hmo",
  "new_large_hmo",
  "hmo_intensification",
])

function result(
  kind: HmoApplicationKind,
  matchedRule: string,
  occupants: number | null
): HmoClassification {
  return { kind, occupants, addsSupply: SUPPLY_ADDING.has(kind), matchedRule }
}

/**
 * Classify a planning application description.
 *
 * `appType` is advisory only — PlanIt files lawful-use certificates under
 * "Outline", "Amendment" and "Other" interchangeably, so the description is the
 * only reliable signal.
 */
export function classifyHmoApplication(
  description: string | null | undefined,
  appType?: string | null
): HmoClassification {
  const text = (description ?? "").replace(/\s+/g, " ").trim()
  if (!text) return result("unclear", "empty-description", null)

  const occupants = extractOccupants(text)

  if (!HMO_TERMS.test(text)) return result("not_hmo", "no-hmo-terms", occupants)

  // Ancillary first: these quote the parent permission and would otherwise
  // match whichever rule described the original scheme.
  if (ANCILLARY.test(text) || /^(conditions?|amendment)$/i.test(appType ?? "")) {
    if (ANCILLARY.test(text)) return result("ancillary", "ancillary-condition", occupants)
  }

  // Non-residential uses that merely share the vocabulary.
  if (NOT_HMO_CONTEXT.test(text) && !C4.test(text)) {
    return result("not_hmo", "non-residential-context", occupants)
  }

  // Direction before creation, so a de-conversion is never read as new supply.
  if (REVERSION.test(text)) return result("reversion", "reversion-to-c3", occupants)

  if (LDC.test(text)) {
    // The cited section is the most reliable signal: s191 certifies an existing
    // use, s192 a proposed one. Prose wording only decides when neither is given.
    const proposed = LDC_S192.test(text) || (!LDC_S191.test(text) && LDC_PROPOSED.test(text))
    const existing = LDC_S191.test(text) || (!LDC_S192.test(text) && LDC_EXISTING.test(text))

    if (proposed) {
      if (SUI_GENERIS.test(text)) return result("new_large_hmo", "ldc-proposed-sui-generis", occupants)
      if (C4.test(text)) return result("new_small_hmo", "ldc-proposed-c4", occupants)
      if (occupants !== null) {
        return occupants >= 7
          ? result("new_large_hmo", "ldc-proposed-occupants-7-plus", occupants)
          : result("new_small_hmo", "ldc-proposed-occupants-under-7", occupants)
      }
      if (/\b(?:to|into)\b[^.]{0,60}(?:\bhmo\b|multiple\s*occupa)/i.test(text)) {
        return result("new_small_hmo", "ldc-proposed-size-unknown", null)
      }
      return result("unclear", "ldc-proposed-unspecified", occupants)
    }

    if (existing) return result("existing_use_certificate", "ldc-existing-use", occupants)

    // An unqualified "certificate of lawful use" is overwhelmingly a s191
    // application about a use already operating. Reading it as existing
    // under-counts new supply rather than inventing it, which is the safer
    // direction for an indicator investors act on.
    return result("existing_use_certificate", "ldc-unqualified-assumed-existing", occupants)
  }

  if (SUI_GENERIS.test(text)) {
    // From C4 to sui generis is an existing HMO growing, not a new one.
    if (FROM_C4.test(text)) return result("hmo_intensification", "c4-to-sui-generis", occupants)
    return result("new_large_hmo", "to-sui-generis", occupants)
  }

  if (C4.test(text)) return result("new_small_hmo", "to-c4", occupants)

  // Physical works to a building already in HMO use. No decision is being made
  // on the use itself, so this is not new supply.
  if (WORKS_ONLY.test(text) && !CHANGE_OF_USE.test(text)) {
    return result("ancillary", "works-to-existing-hmo", occupants)
  }

  // No use class stated. A stated occupant count still places it either side of
  // the statutory 7-occupant line, which is the only distinction that matters.
  if (CHANGE_OF_USE.test(text) && occupants !== null) {
    return occupants >= 7
      ? result("new_large_hmo", "change-of-use-occupants-7-plus", occupants)
      : result("new_small_hmo", "change-of-use-occupants-under-7", occupants)
  }

  // A conversion to an HMO with no size given is still new supply, but its
  // scale is unknown — recorded as small, since C4 is the common case and
  // over-stating large HMOs would distort the intensification signal.
  if (CHANGE_OF_USE.test(text) && /\bto\b[^.]{0,40}(?:\bhmo\b|multiple\s*occupa)/i.test(text)) {
    return result("new_small_hmo", "change-of-use-to-hmo-size-unknown", null)
  }

  return result("unclear", "hmo-mentioned-no-direction", occupants)
}
