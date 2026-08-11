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

export type Confidence = "verified" | "recorded" | "inferred" | "unknown"

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
}

const DISCLAIMER =
  "This report summarises what our sources record about this address. It is not a planning or legal opinion, and it is not a substitute for confirming the position with the local planning authority. Where a fact is marked inferred or unknown, treat it as a question to ask rather than an answer to rely on."

function article4Section(input: HmoCheckInput): ReportSection {
  const facts: ReportFact[] = []
  const status = input.article_4_status ?? "unknown"

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
      confidence: input.councilVerifiedQuote ? "verified" : "recorded",
      source: input.councilVerifiedUrl ?? input.article_4_source ?? null,
      note: "Converting to an HMO here needs planning permission. Permitted development does not apply.",
    })
  } else if (status === "none_found") {
    facts.push({
      label: "Article 4 direction",
      value: "None found in a council that publishes its directions",
      confidence: "recorded",
      source: input.article_4_source ?? null,
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
      source: input.article_4_source ?? null,
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

  if (input.purchase_price != null) {
    facts.push({
      label: "Asking price",
      value: `£${input.purchase_price.toLocaleString()}`,
      confidence: "recorded",
      source: "Listing",
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

  if (input.estimated_rent_per_room != null && input.bedrooms) {
    const gross = input.estimated_rent_per_room * input.bedrooms * 12
    facts.push({
      label: "Indicative gross rent",
      value: `£${gross.toLocaleString()} a year at £${input.estimated_rent_per_room} per room`,
      confidence: "inferred",
      source: null,
      note: "Built from a per-room estimate and the current bedroom count. It is a starting point for your own numbers, not a valuation.",
    })
  }

  return {
    title: "Money",
    emptyMessage: "No price or rent recorded for this address.",
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

  // The headline states the position rather than rating it. Someone who reads
  // only this line should still be told the thing that would change their mind.
  const headline =
    input.article_4_status === "in_force"
      ? "An Article 4 direction applies here — converting to an HMO needs planning permission."
      : input.article_4_status === "none_found"
        ? `No Article 4 direction found. ${MARKET_LABELS[category.market]}, ${LICENCE_LABELS[category.licence].toLowerCase()}.`
        : "This council's Article 4 position has not been established — treat the planning position as unchecked."

  return {
    address: input.address ?? "",
    postcode: input.postcode ?? null,
    council: input.article_4_council ?? null,
    generatedAt: now.toISOString(),
    headline,
    sections: [
      article4Section(input),
      licenceSection(input, now),
      useAndConversionSection(input, conversion),
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
