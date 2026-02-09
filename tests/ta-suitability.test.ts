import { describe, it, expect } from "vitest"
import {
  assessTASuitability,
  CRITERIA_LABELS,
  type TASuitability,
  type TASuitabilityResult,
} from "@/lib/services/ta-suitability"
import type { Property } from "@/lib/types/database"

/**
 * Helper to create a minimal Property object for testing.
 * Fills in all required fields with sensible defaults,
 * then applies overrides.
 */
function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: "test-id",
    title: "Test Property",
    address: "123 Test Street",
    postcode: "M14 5TQ",
    city: "Manchester",
    country: "England",
    latitude: 53.4,
    longitude: -2.2,
    listing_type: "rent",
    price_pcm: 600,
    purchase_price: null,
    estimated_rent_per_room: null,
    property_type: "HMO",
    hmo_status: "Licensed HMO",
    tenure: null,
    licensed_hmo: true,
    source_type: null,
    source_name: null,
    source_url: null,
    external_id: null,
    last_synced: null,
    last_ingested_at: null,
    last_seen_at: null,
    is_stale: false,
    stale_marked_at: null,
    bedrooms: 3,
    bathrooms: 1,
    is_furnished: false,
    is_student_friendly: false,
    is_pet_friendly: false,
    has_garden: false,
    has_parking: false,
    wifi_included: false,
    near_tube_station: false,
    available_from: null,
    description: null,
    image_url: null,
    images: null,
    floor_plans: null,
    primary_image: null,
    media_source_url: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    last_updated: null,
    licence_id: null,
    licence_start_date: null,
    licence_end_date: null,
    licence_status: "active",
    hmo_licence_number: "LIC-001",
    hmo_licence_start: null,
    hmo_licence_end: null,
    hmo_max_occupants: 5,
    hmo_max_households: null,
    hmo_storeys: null,
    epc_rating: "C",
    epc_floor_area: 80,
    epc_energy_efficiency: 72,
    epc_certificate_url: null,
    owner_name: null,
    owner_company_name: null,
    owner_company_number: null,
    licence_holder_name: null,
    licence_holder_company: null,
    article_4_area: false,
    article_4_direction_date: null,
    article_4_notes: null,
    deal_score: 70,
    gross_yield: 8.5,
    is_potential_hmo: false,
    hmo_classification: null,
    hmo_classification_confidence: null,
    hmo_classification_reasons: null,
    broadband_speed: null,
    broadband_provider: null,
    broadband_type: null,
    ...overrides,
  } as Property
}

describe("assessTASuitability", () => {
  describe("suitable (5/5 criteria)", () => {
    it("should return suitable when all criteria are met", () => {
      const property = makeProperty({
        listing_type: "rent",
        price_pcm: 600, // Manchester 3-bed LHA monthly ≈ £673, 600 < 673*1.1
        licensed_hmo: true,
        licence_status: "active",
        epc_rating: "C",
        bedrooms: 3,
        city: "Manchester",
      })

      const result = assessTASuitability(property)

      expect(result.suitability).toBe("suitable")
      expect(result.score).toBe(5)
      expect(result.criteria.isRental).toBe(true)
      expect(result.criteria.hasActiveLicence).toBe(true)
      expect(result.criteria.hasAdequateEpc).toBe(true)
      expect(result.criteria.hasMinBedrooms).toBe(true)
      expect(result.criteria.withinLhaBudget).toBe(true)
    })

    it("should count as rental if price_pcm > 0 even with purchase listing type", () => {
      const property = makeProperty({
        listing_type: "purchase",
        price_pcm: 500,
        licensed_hmo: true,
        licence_status: "active",
        epc_rating: "B",
        bedrooms: 2,
        city: "Liverpool", // LHA 2-bed ≈ £474/mo, 500 < 474*1.1=521
      })

      const result = assessTASuitability(property)
      expect(result.criteria.isRental).toBe(true)
    })

    it("should accept all EPC ratings A through E", () => {
      for (const rating of ["A", "B", "C", "D", "E"] as const) {
        const property = makeProperty({ epc_rating: rating })
        const result = assessTASuitability(property)
        expect(result.criteria.hasAdequateEpc, `EPC ${rating} should be adequate`).toBe(true)
      }
    })
  })

  describe("partial (3-4 criteria)", () => {
    it("should return partial when 4 criteria met", () => {
      const property = makeProperty({
        listing_type: "rent",
        price_pcm: 2000, // Way over LHA budget
        licensed_hmo: true,
        licence_status: "active",
        epc_rating: "C",
        bedrooms: 3,
        city: "Manchester",
      })

      const result = assessTASuitability(property)

      expect(result.suitability).toBe("partial")
      expect(result.score).toBe(4)
      expect(result.criteria.withinLhaBudget).toBe(false)
    })

    it("should return partial when 3 criteria met", () => {
      const property = makeProperty({
        listing_type: "rent",
        price_pcm: 2000,
        licensed_hmo: false,
        licence_status: "none",
        epc_rating: "C",
        bedrooms: 3,
        city: "Manchester",
      })

      const result = assessTASuitability(property)

      expect(result.suitability).toBe("partial")
      expect(result.score).toBe(3)
    })
  })

  describe("not_suitable (<3 criteria)", () => {
    it("should return not_suitable when only 2 criteria met", () => {
      const property = makeProperty({
        listing_type: "purchase",
        price_pcm: null,
        licensed_hmo: false,
        licence_status: "none",
        epc_rating: "F",
        bedrooms: 3,
        city: "Manchester",
      })

      const result = assessTASuitability(property)

      expect(result.suitability).toBe("not_suitable")
      expect(result.score).toBeLessThan(3)
    })

    it("should return not_suitable when no criteria met", () => {
      const property = makeProperty({
        listing_type: "purchase",
        price_pcm: null,
        licensed_hmo: false,
        licence_status: "none",
        epc_rating: null,
        bedrooms: 1,
        city: "Atlantis", // Unknown city — no LHA rate
      })

      const result = assessTASuitability(property)

      expect(result.suitability).toBe("not_suitable")
      expect(result.score).toBe(0)
      expect(result.criteria.isRental).toBe(false)
      expect(result.criteria.hasActiveLicence).toBe(false)
      expect(result.criteria.hasAdequateEpc).toBe(false)
      expect(result.criteria.hasMinBedrooms).toBe(false)
      expect(result.criteria.withinLhaBudget).toBe(false)
    })
  })

  describe("individual criteria", () => {
    it("should require bedrooms >= 2", () => {
      expect(assessTASuitability(makeProperty({ bedrooms: 1 })).criteria.hasMinBedrooms).toBe(false)
      expect(assessTASuitability(makeProperty({ bedrooms: 2 })).criteria.hasMinBedrooms).toBe(true)
      expect(assessTASuitability(makeProperty({ bedrooms: 5 })).criteria.hasMinBedrooms).toBe(true)
    })

    it("should treat 0 bedrooms as not meeting minimum", () => {
      expect(assessTASuitability(makeProperty({ bedrooms: 0 })).criteria.hasMinBedrooms).toBe(false)
    })

    it("should reject EPC rating F and G", () => {
      expect(assessTASuitability(makeProperty({ epc_rating: "F" })).criteria.hasAdequateEpc).toBe(false)
      expect(assessTASuitability(makeProperty({ epc_rating: "G" })).criteria.hasAdequateEpc).toBe(false)
    })

    it("should reject null/undefined EPC", () => {
      expect(assessTASuitability(makeProperty({ epc_rating: null })).criteria.hasAdequateEpc).toBe(false)
    })

    it("should check licence via licensed_hmo flag", () => {
      const result = assessTASuitability(makeProperty({ licensed_hmo: true, licence_status: "expired" }))
      expect(result.criteria.hasActiveLicence).toBe(true) // licensed_hmo alone is sufficient
    })

    it("should check licence via licence_status active", () => {
      const result = assessTASuitability(makeProperty({ licensed_hmo: false, licence_status: "active" }))
      expect(result.criteria.hasActiveLicence).toBe(true) // licence_status === "active" alone is sufficient
    })

    it("should reject unlicensed property", () => {
      const result = assessTASuitability(makeProperty({ licensed_hmo: false, licence_status: "expired" }))
      expect(result.criteria.hasActiveLicence).toBe(false)
    })

    it("should check LHA budget at 110% threshold", () => {
      // Manchester 3-bed weekly = 155.34, monthly = round(155.34 * 52 / 12) = 673
      const lhaMonthly = Math.round((155.34 * 52) / 12) // 673
      const threshold = lhaMonthly * 1.1 // ~740.3

      const under = assessTASuitability(makeProperty({ price_pcm: 740, bedrooms: 3, city: "Manchester" }))
      expect(under.criteria.withinLhaBudget).toBe(true)

      const over = assessTASuitability(makeProperty({ price_pcm: 741, bedrooms: 3, city: "Manchester" }))
      expect(over.criteria.withinLhaBudget).toBe(false)
    })

    it("should fail LHA budget check when price_pcm is null", () => {
      const result = assessTASuitability(makeProperty({ price_pcm: null }))
      expect(result.criteria.withinLhaBudget).toBe(false)
    })

    it("should fail LHA budget check for unknown city", () => {
      const result = assessTASuitability(makeProperty({ city: "Atlantis", price_pcm: 100 }))
      expect(result.criteria.withinLhaBudget).toBe(false)
    })
  })

  describe("result structure", () => {
    it("should include LHA monthly rate", () => {
      const result = assessTASuitability(makeProperty({ city: "Manchester", bedrooms: 3 }))
      expect(result.lhaMonthly).not.toBeNull()
      expect(result.lhaMonthly).toBeGreaterThan(0)
    })

    it("should include null LHA for unknown city", () => {
      const result = assessTASuitability(makeProperty({ city: "Atlantis" }))
      expect(result.lhaMonthly).toBeNull()
    })

    it("should include a human-readable reason", () => {
      const suitable = assessTASuitability(makeProperty())
      expect(suitable.reason).toContain("criteria")

      const notSuitable = assessTASuitability(makeProperty({
        listing_type: "purchase",
        price_pcm: null,
        licensed_hmo: false,
        licence_status: "none",
        epc_rating: null,
        bedrooms: 1,
      }))
      expect(notSuitable.reason).toContain("criteria")
    })
  })
})

describe("CRITERIA_LABELS", () => {
  it("should have labels for all 5 criteria", () => {
    expect(CRITERIA_LABELS.isRental).toBeDefined()
    expect(CRITERIA_LABELS.hasActiveLicence).toBeDefined()
    expect(CRITERIA_LABELS.hasAdequateEpc).toBeDefined()
    expect(CRITERIA_LABELS.hasMinBedrooms).toBeDefined()
    expect(CRITERIA_LABELS.withinLhaBudget).toBeDefined()
  })

  it("should have non-empty string labels", () => {
    for (const [key, label] of Object.entries(CRITERIA_LABELS)) {
      expect(label.length, `${key} has empty label`).toBeGreaterThan(0)
    }
  })
})
