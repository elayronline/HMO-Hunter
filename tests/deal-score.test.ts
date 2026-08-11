import { describe, it, expect } from "vitest"
import { analyzePropertyForHMO } from "@/lib/services/potential-hmo-analyzer"
import type { Property } from "@/lib/types/database"

function property(over: Partial<Property> = {}): Property {
  return {
    id: "p1", title: "", address: "1 Test St", postcode: "M14 5AA", city: "Manchester",
    bedrooms: 5, bathrooms: 2, purchase_price: 250_000, epc_rating: "C",
    floor_area_sqm: 120, conservation_area: false,
    article_4_status: "none_found",
    owner_name: null, company_name: null, company_number: null,
    owner_contact_email: null, owner_contact_phone: null, owner_address: null,
    licensed_hmo: false, hmo_status: "Potential HMO",
    ...over,
  } as unknown as Property
}

describe("the deal score measures the deal", () => {
  // The bug: 20 of 100 points came from whether we hold the owner's contact
  // details, so a well-enriched property outranked a better one.
  it("does not change when we happen to hold the owner's contact details", () => {
    const withoutContact = analyzePropertyForHMO(property())
    const withContact = analyzePropertyForHMO(
      property({
        owner_name: "A Landlord",
        owner_contact_email: "a@example.com",
        licensed_hmo: true,
      } as Partial<Property>)
    )
    expect(withContact.dealScore).toBe(withoutContact.dealScore)
  })

  it("reports contactability separately, because it is still worth knowing", () => {
    const reachable = analyzePropertyForHMO(
      property({ owner_name: "A Landlord", owner_contact_email: "a@example.com" } as Partial<Property>)
    )
    const cold = analyzePropertyForHMO(property())
    expect(reachable.contactabilityScore).toBeGreaterThan(cold.contactabilityScore)
    expect(cold.contactabilityScore).toBe(0)
  })

  // The rent behind the yield is a city average applied to one building.
  it("says when the yield rests on a regional estimate rather than a rent", () => {
    const estimated = analyzePropertyForHMO(property())
    expect(estimated.dealScoreBreakdown.yieldBasis).toBe("regional_estimate")

    const measured = analyzePropertyForHMO(
      property({ estimated_rent_per_room: 650 } as Partial<Property>)
    )
    expect(measured.dealScoreBreakdown.yieldBasis).toBe("measured")
  })
})

describe("Article 4 in the compliance score", () => {
  // article_4_area, the deprecated boolean, is false both for "checked, clear"
  // and "never checked". Scoring on it gave an unexamined council full marks.
  it("does not score an unchecked council as though it were clear", () => {
    const verifiedClear = analyzePropertyForHMO(property({ article_4_status: "none_found" } as Partial<Property>))
    const neverChecked = analyzePropertyForHMO(property({ article_4_status: "unknown" } as Partial<Property>))
    expect(neverChecked.dealScoreBreakdown.complianceScore).toBeLessThan(
      verifiedClear.dealScoreBreakdown.complianceScore
    )
  })

  it("penalises a known Article 4 hardest of the three", () => {
    const inForce = analyzePropertyForHMO(property({ article_4_status: "in_force" } as Partial<Property>))
    const unknown = analyzePropertyForHMO(property({ article_4_status: "unknown" } as Partial<Property>))
    expect(inForce.dealScoreBreakdown.complianceScore).toBeLessThan(
      unknown.dealScoreBreakdown.complianceScore
    )
  })
})
