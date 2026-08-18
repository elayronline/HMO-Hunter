/**
 * The HMO check: what someone needs to know about an address before they buy.
 *
 * The platform exists to help people source effectively and verify accurately,
 * and this report is the verification half made explicit. It is deliberately not
 * a scorecard. A number out of 100 invites a decision without reading, and the
 * whole difficulty of HMO buying is that the decisive facts are qualitative:
 * whether a planning restriction applies, whether a licence is about to lapse,
 * whether the thing you would need permission for is permitted at all.
 *
 * Three rules shape what goes in it:
 *
 *  1. **Every fact carries where it came from and when.** A council's own words
 *     and a national dataset's silence are not the same evidence, and the report
 *     says which it is holding.
 *
 *  2. **What we cannot tell you is part of the report, not omitted from it.**
 *     Absence of a recorded Article 4 is not absence of one — most councils
 *     publish nothing. A report that quietly leaves that out reads as an all
 *     clear, which is the single most expensive error this product can make.
 *
 *  3. **Nothing is asserted that could not be defended.** Where a value is
 *     inferred it says so, and where the underlying data is a regional average
 *     rather than a measurement, it says that too.
 *
 * The order below is deliberate: what would stop the purchase comes first, then
 * what it currently is, then what it could become, then the money. Someone
 * skimming the first section should already know whether to keep reading.
 */

import { assessUseClass, USE_CLASS_LABELS, type UseClassInput } from "@/lib/properties/use-class"
import { assessConversion, type ConversionAssessment } from "@/lib/properties/conversion"
import { categorise, MARKET_LABELS, LICENCE_LABELS, type CategorisableProperty } from "@/lib/properties/category"
import { roomRent } from "@/lib/properties/room-rents"

export type Confidence = "verified" | "recorded" | "inferred" | "unknown"

/**
 * What the reader is actually asking.
 *
 * An existing HMO and a possible conversion are different questions, and a
 * report that answers both at once answers neither well. Someone looking at an
 * operating HMO wants to know what it is and what it holds; someone looking at
 * an off-market house or a shop wants to know whether they could turn it into
 * one, and at what cost in permissions.
 */
export type ReportPurpose = "existing_hmo" | "conversion"

/** A decided HMO application in the same council. Precedent, not promise. */
export interface PlanningDecision {
  reference: string
  address: string | null
  description: string
  outcome: string
  decidedDate: string | null
  addsSupply: boolean
}

export interface ReportFact {
  label: string
  value: string
  confidence: Confidence
  /** Where it came from, in words a reader can act on. */
  source: string | null
  /** Why it matters, where that is not obvious. */
  note?: string
}

export interface ReportSection {
  title: string
  /** Shown when the section has nothing to say, rather than hiding the section. */
  emptyMessage: string
  facts: ReportFact[]
}

export interface HmoCheckReport {
  purpose: ReportPurpose
  address: string
  postcode: string | null
  council: string | null
  generatedAt: string
  /** The one-line answer, stated plainly and never as a score. */
  headline: string
  sections: ReportSection[]
  /** Everything the data cannot settle. Never empty in practice. */
  openQuestions: string[]
  disclaimer: string
}

export interface HmoCheckInput extends CategorisableProperty, UseClassInput {
  address?: string | null
  /** Needed to say whether the indicative rent is a city or a national figure. */
  city?: string | null
  postcode?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  floor_area_sqm?: number | null
  floor_plans?: string[] | null
  epc_rating?: string | null
  epc_expiry_date?: string | null
  purchase_price?: number | null
  estimated_rent_per_room?: number | null
  hmo_licence_expiry?: string | null
  licence_holder_name?: string | null
  owner_name?: string | null
  company_name?: string | null
  article_4_status?: string | null
  article_4_council?: string | null
  article_4_area_name?: string | null
  article_4_checked_at?: string | null
  article_4_source?: string | null
  /** From the curated overlay: the council's own words, where we hold them. */
  councilVerifiedQuote?: string | null
  councilVerifiedUrl?: string | null
  hmoArticle4InForce?: boolean
  classMaArticle4InForce?: boolean
  councilPositionKnown?: boolean
  /**
   * Recent decided HMO applications in this council. Only ever supplied when an
   * application would actually be needed — see needsPlanningApplication.
   */
  recentDecisions?: PlanningDecision[]
  /** Share of supply-adding applications this council permitted, 0-1. */
  councilApprovalRate?: number | null
  councilDecisionCount?: number | null
}

const DISCLAIMER =
  "This report summarises what our sources record about this address. It is not a planning or legal opinion, and it is not a substitute for confirming the position with the local planning authority. Where a fact is marked inferred or unknown, treat it as a question to ask rather than an answer to rely on."

/**
 * Provenance identifiers are internal. This report gets exported as a PDF and
 * shown to lenders, vendors and agents, so a raw token like
 * "legacy:pre-migration" appearing under a planning restriction is both opaque
 * and quietly misleading — it reads like a system rather than a source.
 */
const LEGACY_SOURCE = "legacy:pre-migration"

function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null
  if (source.startsWith("http")) return source
  if (source === LEGACY_SOURCE) return "An earlier record, not re-checked"
  if (source === "planning.data.gov.uk") return "National planning dataset (planning.data.gov.uk)"
  return source
}

function article4Section(input: HmoCheckInput): ReportSection {
  const facts: ReportFact[] = []
  const status = input.article_4_status ?? "unknown"

  // A position carried over from the old boolean column was never the result of
  // a check against a published boundary. Presenting it as recorded would give
  // it the same weight as a dataset match, which is the overstatement this
  // report is built to avoid.
  const isLegacy = input.article_4_source === LEGACY_SOURCE

  // The most important line in the report. A boolean here would be a lie: the
  // national dataset holds 72 HMO areas across 38 councils, so its silence is
  // not evidence, and 16 of the councils we verified operate a direction it has
  // never heard of.
  if (status === "in_force") {
    facts.push({
      label: "Article 4 direction",
      value: input.article_4_area_name
        ? `In force — ${input.article_4_area_name}`
        : "In force for this council",
      confidence: input.councilVerifiedQuote ? "verified" : isLegacy ? "inferred" : "recorded",
      source: input.councilVerifiedUrl ?? sourceLabel(input.article_4_source),
      note: isLegacy
        ? "Converting to an HMO here needs planning permission. This position was carried over from an earlier record rather than matched against a published boundary, so confirm it with the council before relying on it."
        : "Converting to an HMO here needs planning permission. Permitted development does not apply.",
    })
  } else if (status === "none_found") {
    facts.push({
      label: "Article 4 direction",
      value: "None found in a council that publishes its directions",
      confidence: "recorded",
      source: sourceLabel(input.article_4_source),
      note: "This council publishes testable boundaries and this address falls outside them. That is a real negative rather than an absence of data.",
    })
  } else {
    facts.push({
      label: "Article 4 direction",
      value: "Not established",
      confidence: "unknown",
      source: null,
      note: "This council does not publish its Article 4 directions to the national dataset, and we have not verified it directly. Most councils that operate a direction publish nothing — treat this as unchecked, not as clear.",
    })
  }

  if (input.councilVerifiedQuote) {
    facts.push({
      label: "The council's own words",
      value: `"${input.councilVerifiedQuote}"`,
      confidence: "verified",
      source: input.councilVerifiedUrl ?? null,
      note: "Quoted from the council's own publication, which is what a dispute would be settled against.",
    })
  }

  if (input.article_4_checked_at) {
    facts.push({
      label: "Last checked",
      value: input.article_4_checked_at.slice(0, 10),
      confidence: "recorded",
      source: sourceLabel(input.article_4_source),
    })
  }

  return {
    title: "Planning restrictions",
    emptyMessage: "No planning position established for this address.",
    facts,
  }
}

function licenceSection(input: HmoCheckInput, now: Date): ReportSection {
  const facts: ReportFact[] = []
  const category = categorise(input, now)

  facts.push({
    label: "Licence status",
    value: LICENCE_LABELS[category.licence],
    confidence: input.licensed_hmo ? "recorded" : "inferred",
    source: input.licensed_hmo ? "HMO licence register" : null,
  })

  if (category.daysToExpiry !== null) {
    const d = category.daysToExpiry
    facts.push({
      label: "Licence expiry",
      value:
        d < 0
          ? `${input.hmo_licence_expiry} — expired ${Math.abs(d)} days ago`
          : `${input.hmo_licence_expiry} — ${d} days remaining`,
      confidence: "recorded",
      source: "HMO licence register",
      note:
        d < 0
          ? "An expired licence on an operating HMO is an enforcement risk for the current owner and a negotiating point for a buyer."
          : d <= 183
            ? "Renewal falls due within six months. A seller facing renewal is a seller with a deadline."
            : undefined,
    })
  } else if (input.licensed_hmo) {
    facts.push({
      label: "Licence expiry",
      value: "Not published",
      confidence: "unknown",
      source: null,
      note: "The council records a licence but no expiry date. Around half of licensed properties are in this position, so it says nothing about the licence itself.",
    })
  }

  if (input.licence_holder_name || input.owner_name || input.company_name) {
    facts.push({
      label: "Held by",
      value: input.licence_holder_name ?? input.owner_name ?? input.company_name ?? "",
      confidence: "recorded",
      source: input.licence_holder_name ? "HMO licence register" : "Land Registry",
    })
  }

  return {
    title: "Licensing",
    emptyMessage: "No licence recorded for this address.",
    facts,
  }
}

function useAndConversionSection(
  input: HmoCheckInput,
  conversion: ConversionAssessment
): ReportSection {
  const use = assessUseClass(input)
  const facts: ReportFact[] = [
    {
      label: "Current use class",
      value: USE_CLASS_LABELS[use.useClass],
      confidence: use.basis === "recorded" ? "recorded" : use.basis === "inferred" ? "inferred" : "unknown",
      source: use.basis === "recorded" ? "HMO licence register" : null,
      note: use.reason,
    },
  ]

  for (const step of conversion.steps) {
    facts.push({
      label: `${step.from} to ${step.to}`,
      value:
        step.status === "permitted_development"
          ? "Permitted development"
          : step.status === "planning_permission_required"
            ? "Planning permission required"
            : step.status === "no_permitted_route"
              ? "No permitted route"
              : "Not established",
      confidence: step.status === "unknown" ? "unknown" : "recorded",
      source: step.gpdoClass ? `GPDO 2015, ${step.gpdoClass}` : null,
      note: step.note,
    })
  }

  return {
    title: "Use class and conversion route",
    emptyMessage: "Not enough information to establish the use class.",
    facts,
  }
}

function buildingSection(input: HmoCheckInput): ReportSection {
  const facts: ReportFact[] = []

  if (input.bedrooms != null) {
    facts.push({
      label: "Bedrooms",
      value: String(input.bedrooms),
      confidence: "recorded",
      source: "Listing",
    })
  }
  if (input.floor_area_sqm != null) {
    facts.push({
      label: "Floor area",
      value: `${input.floor_area_sqm} m²`,
      confidence: "recorded",
      source: "EPC register",
      note: "Room counts have to be checked against this and against the council's minimum room sizes.",
    })
  }
  if (input.epc_rating) {
    facts.push({
      label: "EPC rating",
      value: input.epc_rating + (input.epc_expiry_date ? ` (valid to ${input.epc_expiry_date})` : ""),
      confidence: "recorded",
      source: "EPC register",
      note: ["A", "B", "C"].includes(input.epc_rating)
        ? undefined
        : "Below C. A rented HMO is likely to need improvement work to remain lettable under MEES.",
    })
  }
  facts.push({
    label: "Floor plan",
    value: input.floor_plans?.length ? "Available" : "Not available",
    confidence: "recorded",
    source: input.floor_plans?.length ? "Listing" : null,
    note: input.floor_plans?.length
      ? undefined
      : "Without one, any room count is an assumption rather than a measurement.",
  })

  return {
    title: "The building",
    emptyMessage: "No physical details recorded.",
    facts,
  }
}

function moneySection(input: HmoCheckInput): ReportSection {
  const facts: ReportFact[] = []

  // A price only means "asking price" when something is actually being asked.
  // Licence register records are not listings, and any figure attached to one
  // came from an estimate rather than a vendor — presenting it as recorded from
  // a listing would assert a fact about a sale that is not happening.
  if (input.purchase_price != null) {
    const isListed = input.listing_type === "purchase"
    facts.push({
      label: isListed ? "Asking price" : "Estimated value",
      value: `£${input.purchase_price.toLocaleString()}`,
      confidence: isListed ? "recorded" : "inferred",
      source: isListed ? "Listing" : null,
      note: isListed
        ? undefined
        : "This property is not on the market, so no asking price exists. This figure is an estimate and should not be treated as a valuation or as evidence of what it would sell for.",
    })
  }

  if (input.price_pcm != null) {
    facts.push({
      label: "Currently let at",
      value: `£${input.price_pcm.toLocaleString()} pcm`,
      confidence: "recorded",
      source: "Letting listing",
      note: "What the property achieves today, not an estimate.",
    })
  }

  // Most of the estate falls outside the cities we hold a rate for, so the
  // wording has to distinguish the two. Describing a single national figure as
  // "the average for this city" would overstate the majority of reports, and
  // this one number is what a reader builds their whole case on.
  if (input.estimated_rent_per_room != null && input.bedrooms) {
    const gross = input.estimated_rent_per_room * input.bedrooms * 12
    const basis = roomRent(input.city, input.article_4_council)
    const fromCity = basis.basis === "city" && basis.rate === input.estimated_rent_per_room
    facts.push({
      label: "Indicative gross rent",
      value: `£${gross.toLocaleString()} a year at £${input.estimated_rent_per_room} per room`,
      confidence: "inferred",
      source: null,
      note: fromCity
        ? `Built from the average room rent for ${basis.city} and the current bedroom count — not from this property's own letting history. It is a starting point for your own numbers, not a valuation.`
        : "Built from a single national average room rent, because we hold no rate for this location, and the current bedroom count. It is not specific to this area and not a valuation — treat it as the roughest of the figures here and replace it with a local comparable before relying on it.",
    })
  }

  return {
    title: "Money",
    emptyMessage: "No price or rent recorded for this address.",
    facts,
  }
}

/**
 * Whether the reader would actually have to apply for permission.
 *
 * This is the gate on showing planning precedent. What other people got
 * approved is only useful to someone facing a decision of their own — if the
 * change is permitted development, no committee is going to consider it, and
 * listing recent approvals would suggest a hurdle that is not there. Where the
 * council's position is unestablished the gate opens too, because an unchecked
 * restriction may well require an application and the reader should see what
 * that would look like.
 */
export function needsPlanningApplication(conversion: ConversionAssessment): boolean {
  return conversion.steps.some(
    (s) =>
      s.status === "planning_permission_required" ||
      s.status === "no_permitted_route" ||
      s.status === "unknown"
  )
}

/**
 * What this council has actually decided on comparable applications.
 *
 * Precedent, not promise: every application turns on its own merits, and an
 * approval rate is a description of the past. It earns its place because the
 * alternative is a buyer guessing, and a council that refused four of the last
 * five supply-adding applications is telling you something a policy document
 * will not.
 *
 * Descriptions are included because what was approved matters more than how
 * many: permission for a six-bed sui generis HMO and permission to add an
 * en-suite are both "approved" and mean entirely different things.
 */
function precedentSection(input: HmoCheckInput): ReportSection {
  const facts: ReportFact[] = []
  const decisions = input.recentDecisions ?? []

  if (input.councilApprovalRate != null && (input.councilDecisionCount ?? 0) > 0) {
    const pct = Math.round(input.councilApprovalRate * 100)
    facts.push({
      label: "Approval rate for HMO applications",
      value: `${pct}% of ${input.councilDecisionCount} decided applications`,
      confidence: "recorded",
      source: "PlanIt / council planning registers",
      note:
        (input.councilDecisionCount ?? 0) < 10
          ? "Too few decisions to read as a trend. Treat it as context, not a probability."
          : pct < 50
            ? "This council refuses more supply-adding HMO applications than it permits. Budget for the possibility of refusal."
            : undefined,
    })
  }

  for (const d of decisions.slice(0, 5)) {
    facts.push({
      label: [d.decidedDate, d.address].filter(Boolean).join(" · ") || d.reference,
      value: d.outcome,
      confidence: "recorded",
      source: `Planning reference ${d.reference}`,
      // The description is the point: it says what was actually allowed.
      note: d.description.length > 240 ? `${d.description.slice(0, 240)}…` : d.description,
    })
  }

  return {
    title: "What this council has recently decided",
    emptyMessage:
      "No decided HMO applications recorded for this council. That reflects our coverage rather than the council's activity.",
    facts,
  }
}

export function buildHmoCheckReport(input: HmoCheckInput, now: Date = new Date()): HmoCheckReport {
  const category = categorise(input, now)
  const conversion = assessConversion({
    useClass: assessUseClass(input).useClass,
    hmoArticle4InForce: input.hmoArticle4InForce ?? input.article_4_status === "in_force",
    classMaArticle4InForce: input.classMaArticle4InForce ?? false,
    councilPositionKnown:
      input.councilPositionKnown ?? (input.article_4_status === "in_force" || input.article_4_status === "none_found"),
    hasFloorPlan: Boolean(input.floor_plans?.length),
    bedrooms: input.bedrooms,
  })

  // Which question is being asked. An operating HMO and a possible conversion
  // are different reports, and answering both at once answers neither.
  const purpose: ReportPurpose =
    category.licence === "unlicensed" && !input.licensed_hmo ? "conversion" : "existing_hmo"

  const applicationNeeded = needsPlanningApplication(conversion)

  // The headline answers the question that was asked, and states the position
  // rather than rating it. Someone who reads only this line should still be
  // told the thing that would change their mind.
  const headline =
    purpose === "existing_hmo"
      ? input.article_4_status === "in_force"
        ? `An operating HMO in an Article 4 area. ${LICENCE_LABELS[category.licence]}.`
        : `An operating HMO. ${LICENCE_LABELS[category.licence]}.`
      : input.article_4_status === "in_force"
        ? "An Article 4 direction applies here — converting to an HMO needs planning permission."
        : input.article_4_status === "none_found"
          ? conversion.wholeRoutePermitted
            ? "No Article 4 direction found — conversion to a small HMO looks like permitted development."
            : "No Article 4 direction found, but the route is not clear — see the steps below."
          : "This council's Article 4 position has not been established — treat the planning position as unchecked."

  return {
    purpose,
    address: input.address ?? "",
    postcode: input.postcode ?? null,
    council: input.article_4_council ?? null,
    generatedAt: now.toISOString(),
    headline,
    sections: [
      article4Section(input),
      // An existing HMO leads with what it holds; a conversion leads with
      // whether it is possible at all.
      ...(purpose === "existing_hmo"
        ? [licenceSection(input, now), useAndConversionSection(input, conversion)]
        : [useAndConversionSection(input, conversion), licenceSection(input, now)]),
      // Precedent only where an application would actually be required. For
      // permitted development it would imply a hurdle that does not exist.
      ...(applicationNeeded ? [precedentSection(input)] : []),
      buildingSection(input),
      moneySection(input),
    ],
    openQuestions: [
      ...conversion.openQuestions,
      ...(input.article_4_status !== "in_force" && input.article_4_status !== "none_found"
        ? ["Confirm the Article 4 position directly with the council before relying on permitted development."]
        : []),
    ],
    disclaimer: DISCLAIMER,
  }
}
