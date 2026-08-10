/**
 * Provenance envelope for Article 4 facts.
 *
 * Phase 2 resells this data, which changes what a response has to carry. Three
 * rules are enforced here in code rather than left as conventions:
 *
 *  1. No bare values. Every fact ships with where it came from, when, and how
 *     confident we are. Retrofitting that into a published schema is brutal, so
 *     the envelope exists before there are customers.
 *
 *  2. Redistribution is derived from the source, never asserted by a caller.
 *     planning.data.gov.uk is OGL v3 and resellable; Searchland and Kamma are
 *     commercial licences that forbid it. If their data reaches a resold
 *     response that is a contract problem, not a bug. Unknown sources fail
 *     closed to not-redistributable.
 *
 *  3. Withheld is not the same as unknown. When a fact is suppressed for
 *     licensing, the response says so explicitly. Letting it collapse into
 *     "unknown" would repeat the exact mistake this whole feature exists to fix
 *     — an absence being read as a negative.
 */

export type Confidence = "verified" | "reported" | "unknown"

export type SourceId =
  | "planning.data.gov.uk"
  | "council-website"
  | "llm-extraction"
  | "manual-verification"
  | "searchland"
  | "kamma"

interface SourcePolicy {
  label: string
  licence: string
  /** May this source's values appear in a resold API response? */
  redistributable: boolean
  /** Authoritative sources may claim `verified` without a human sign-off. */
  authoritative: boolean
  /** Values must carry a verbatim quote from the source document. */
  requiresQuote: boolean
  note?: string
}

export const SOURCES: Record<SourceId, SourcePolicy> = {
  "planning.data.gov.uk": {
    label: "UK Government Planning Data",
    licence: "OGL-3.0",
    redistributable: true,
    authoritative: true,
    requiresQuote: false,
  },
  "council-website": {
    label: "Local authority publication",
    licence: "facts-not-copyrightable",
    redistributable: true,
    authoritative: true,
    requiresQuote: true,
    note: "Facts extracted from council publications are redistributable; the source documents themselves are not.",
  },
  "llm-extraction": {
    label: "Automated extraction",
    licence: "derived",
    redistributable: true,
    authoritative: false,
    requiresQuote: true,
    note: "Never authoritative on its own — every value must quote its source, and the quote is verified against the fetched document.",
  },
  "manual-verification": {
    label: "Human verified",
    licence: "first-party",
    redistributable: true,
    authoritative: true,
    requiresQuote: false,
  },
  searchland: {
    label: "Searchland",
    licence: "commercial",
    redistributable: false,
    authoritative: false,
    requiresQuote: false,
    note: "Commercial terms prohibit redistribution. Usable in the product, never in a resold response.",
  },
  kamma: {
    label: "Kamma",
    licence: "commercial",
    redistributable: false,
    authoritative: false,
    requiresQuote: false,
    note: "Commercial terms prohibit redistribution.",
  },
}

export interface Sourced<T> {
  value: T | null
  confidence: Confidence
  source: SourceId | null
  sourceUrl: string | null
  /** Verbatim excerpt supporting the value. Required for non-authoritative sources. */
  sourceQuote: string | null
  retrievedAt: string | null
  verifiedAt: string | null
  /** Derived from the source policy. Never set directly. */
  redistributable: boolean
  /** Set when the value was suppressed rather than absent. */
  withheld?: "source-licence"
}

export function isRedistributable(source: SourceId | null | undefined): boolean {
  if (!source) return false // fail closed
  return SOURCES[source]?.redistributable ?? false
}

/**
 * Build an envelope, downgrading anything that cannot justify its own claim.
 *
 * A value is only as trustworthy as its evidence, so this refuses to take the
 * caller's word for it:
 *   - no value at all           -> unknown
 *   - non-authoritative source with no quote or URL -> unknown
 *   - `verified` from a non-authoritative source without a human sign-off
 *                               -> downgraded to reported
 */
export function sourced<T>(input: {
  value: T | null | undefined
  source?: SourceId | null
  sourceUrl?: string | null
  sourceQuote?: string | null
  retrievedAt?: string | null
  verifiedAt?: string | null
  confidence?: Confidence
}): Sourced<T> {
  const source = input.source ?? null
  const policy = source ? SOURCES[source] : undefined
  const sourceUrl = input.sourceUrl ?? null
  const sourceQuote = input.sourceQuote ?? null
  const verifiedAt = input.verifiedAt ?? null

  const empty: Sourced<T> = {
    value: null,
    confidence: "unknown",
    source,
    sourceUrl,
    sourceQuote,
    retrievedAt: input.retrievedAt ?? null,
    verifiedAt,
    redistributable: isRedistributable(source),
  }

  if (input.value === null || input.value === undefined) return empty

  // A source that needs evidence and hasn't produced any is not a fact.
  if (policy?.requiresQuote && !sourceQuote && !sourceUrl) return empty

  let confidence: Confidence = input.confidence ?? (policy?.authoritative ? "verified" : "reported")
  if (confidence === "verified" && !policy?.authoritative && !verifiedAt) {
    confidence = "reported"
  }
  if (!source) confidence = "unknown"

  return {
    value: confidence === "unknown" ? null : (input.value as T),
    confidence,
    source,
    sourceUrl,
    sourceQuote,
    retrievedAt: input.retrievedAt ?? null,
    verifiedAt,
    redistributable: isRedistributable(source),
  }
}

/**
 * Strip a field for redistribution.
 *
 * The value goes, the shape stays, and `withheld` marks why — so a consumer can
 * tell "we cannot share this" from "there is nothing to share". Conflating the
 * two is how a licensing restriction turns into a false negative.
 */
export function withholdField<T>(field: Sourced<T>): Sourced<T> {
  if (field.redistributable) return field
  return {
    ...field,
    value: null,
    confidence: "unknown",
    sourceQuote: null,
    withheld: "source-licence",
  }
}

/** Apply redistribution rules across every Sourced field of an object. */
export function forRedistribution<T extends Record<string, any>>(payload: T): T {
  const out: Record<string, any> = Array.isArray(payload) ? [...payload] : { ...payload }

  for (const [key, value] of Object.entries(out)) {
    if (isSourcedField(value)) {
      out[key] = withholdField(value)
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => (v && typeof v === "object" ? forRedistribution(v) : v))
    } else if (value && typeof value === "object") {
      out[key] = forRedistribution(value)
    }
  }

  return out as T
}

function isSourcedField(value: unknown): value is Sourced<unknown> {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    "value" in (value as object) &&
    "confidence" in (value as object) &&
    "redistributable" in (value as object)
  )
}
