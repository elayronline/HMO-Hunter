import type { Property } from "@/lib/types/database"
import { getLhaMonthlyRate } from "@/lib/data/lha-rates"

export type TASuitability = "suitable" | "partial" | "not_suitable"

export interface TASuitabilityResult {
  suitability: TASuitability
  score: number // 0-5 criteria met
  criteria: {
    isRental: boolean
    hasActiveLicence: boolean
    hasAdequateEpc: boolean
    hasMinBedrooms: boolean
    withinLhaBudget: boolean
  }
  lhaMonthly: number | null
  reason: string
}

/**
 * Assess whether a property is suitable for Temporary Accommodation (TA) placement.
 *
 * Criteria:
 * 1. Available to rent (listing_type === "rent" or has price_pcm)
 * 2. HMO licensed with active licence
 * 3. EPC rating A-E (minimum habitable standard)
 * 4. At least 2 bedrooms
 * 5. Rent within 110% of the Local Housing Allowance rate
 */
export function assessTASuitability(property: Property): TASuitabilityResult {
  const lhaMonthly = getLhaMonthlyRate(
    property.city,
    property.bedrooms,
    property.postcode
  )

  const criteria = {
    isRental:
      property.listing_type === "rent" ||
      (property.price_pcm !== null && property.price_pcm !== undefined && property.price_pcm > 0),
    hasActiveLicence:
      property.licensed_hmo === true ||
      property.licence_status === "active",
    hasAdequateEpc:
      property.epc_rating !== null &&
      property.epc_rating !== undefined &&
      ["A", "B", "C", "D", "E"].includes(property.epc_rating),
    hasMinBedrooms: (property.bedrooms ?? 0) >= 2,
    withinLhaBudget:
      lhaMonthly !== null &&
      property.price_pcm !== null &&
      property.price_pcm !== undefined &&
      property.price_pcm > 0
        ? property.price_pcm <= lhaMonthly * 1.1
        : false,
  }

  const score = Object.values(criteria).filter(Boolean).length

  let suitability: TASuitability
  let reason: string

  if (score >= 5) {
    suitability = "suitable"
    reason = "Meets all TA placement criteria"
  } else if (score >= 3) {
    suitability = "partial"
    reason = `Meets ${score}/5 criteria — review required`
  } else {
    suitability = "not_suitable"
    reason = `Only meets ${score}/5 criteria`
  }

  return { suitability, score, criteria, lhaMonthly, reason }
}

/** Human-readable labels for each criterion */
export const CRITERIA_LABELS: Record<string, string> = {
  isRental: "Available to rent",
  hasActiveLicence: "HMO licensed (active)",
  hasAdequateEpc: "EPC rating A-E",
  hasMinBedrooms: "2+ bedrooms",
  withinLhaBudget: "Within 110% of LHA rate",
}
