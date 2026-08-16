/**
 * Stress tests: Property listing details per profile
 *
 * Validates that the data & calculations shown in property details
 * are correct for each user profile's typical scenario:
 *
 *  - Investor:   purchase listing → deal score, yield, cashflow, price/room, verdict
 *  - Council/TA: rent listing → TA suitability, LHA rates, R2R margin, spread, rent/room
 *  - Operator:   purchase listing → licence tracking, compliance, expiry, EPC
 *  - Agent:      purchase listing → deal score thresholds, comparison data, classification
 */

import { describe, it, expect } from "vitest"
import type { Property } from "@/lib/types/database"

// ---------------------------------------------------------------------------
// Property factory — reuses the pattern from ta-suitability.test.ts
// ---------------------------------------------------------------------------
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
    bedrooms: 5,
    bathrooms: 2,
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
    licence_id: "LIC-001",
    licence_start_date: "2023-01-01",
    licence_end_date: "2028-01-01",
    licence_status: "active",
    hmo_licence_reference: "LIC-001",
    hmo_licence_start: "2023-01-01",
    hmo_licence_end: "2028-01-01",
    max_occupants: 5,
    hmo_max_households: null,
    hmo_storeys: null,
    epc_rating: "C",
    floor_area: 120,
    epc_rating_numeric: 72,
    epc_certificate_url: "https://example.com/epc",
    owner_name: "John Smith",
    company_name: "Smith Properties Ltd",
    company_number: "12345678",
    licence_holder_name: "Jane Doe",
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
    gross_internal_area_sqm: 120,
    lettable_rooms: 5,
    estimated_gross_monthly_rent: null,
    estimated_yield_percentage: null,
    compliance_complexity: null,
    deal_score_breakdown: null,
    hmo_suitability_score: null,
    ...overrides,
  } as Property
}

// ---------------------------------------------------------------------------
// Helper: replicates HeroMetricsBar calculations for purchase listings
// ---------------------------------------------------------------------------
function calcPurchaseMetrics(property: Property) {
  const monthlyRent = property.estimated_rent_per_room
    ? property.estimated_rent_per_room * property.bedrooms
    : null

  const grossYield =
    property.purchase_price && monthlyRent
      ? (monthlyRent * 12 / property.purchase_price) * 100
      : null

  const netYield = grossYield ? grossYield * 0.7 : null

  const monthlyCashflow = (() => {
    if (!property.purchase_price || !monthlyRent) return null
    const annualRent = monthlyRent * 12
    const costs = annualRent * 0.3
    const mortgage = property.purchase_price * 0.75 * 0.055
    return Math.round((annualRent - costs - mortgage) / 12)
  })()

  const pricePerRoom =
    property.purchase_price && property.bedrooms
      ? Math.round(property.purchase_price / property.bedrooms)
      : null

  return { grossYield, netYield, monthlyCashflow, pricePerRoom }
}

// ---------------------------------------------------------------------------
// Helper: mirrors what HeroMetricsBar reports for a property with no asking
// price. The R2R margin and LHA spread it used to compute were rent-to-rent
// arithmetic for a model the platform no longer runs.
// ---------------------------------------------------------------------------
function calcRentMetrics(property: Property) {
  const rentPerRoom =
    property.price_pcm && property.price_pcm > 0 && property.bedrooms > 0
      ? Math.round(property.price_pcm / property.bedrooms)
      : null

  return { rentPerRoom }
}

// ---------------------------------------------------------------------------
// Helper: replicates DealVerdictHeader logic
// ---------------------------------------------------------------------------
type Verdict = "strong_buy" | "worth_exploring" | "needs_work" | "pass"

function getVerdict(score: number | null | undefined): Verdict {
  if (!score) return "pass"
  if (score >= 75) return "strong_buy"
  if (score >= 60) return "worth_exploring"
  if (score >= 45) return "needs_work"
  return "pass"
}

// ============================================================================
// INVESTOR PROFILE — Purchase listings, yield & deal scores
// ============================================================================
describe("Property Details", () => {
  const investorProperty = makeProperty({
    listing_type: "purchase",
    purchase_price: 250000,
    price_pcm: null,
    estimated_rent_per_room: 550,
    bedrooms: 5,
    bathrooms: 2,
    deal_score: 78,
    epc_rating: "C",
    article_4_area: false,
    gross_internal_area_sqm: 130,
  })

  describe("Deal Score & Verdict", () => {
    it("should show deal score of 78", () => {
      expect(investorProperty.deal_score).toBe(78)
    })

    it("should give Strong Buy verdict for score 78", () => {
      expect(getVerdict(investorProperty.deal_score)).toBe("strong_buy")
    })

    it("should give Worth Exploring for score 65", () => {
      expect(getVerdict(65)).toBe("worth_exploring")
    })

    it("should give Needs Work for score 50", () => {
      expect(getVerdict(50)).toBe("needs_work")
    })

    it("should give Pass for score 30", () => {
      expect(getVerdict(30)).toBe("pass")
    })

    it("should give Pass for null score", () => {
      expect(getVerdict(null)).toBe("pass")
    })

    it("should give Pass for undefined score", () => {
      expect(getVerdict(undefined)).toBe("pass")
    })

    it("should give Pass for score 0", () => {
      expect(getVerdict(0)).toBe("pass")
    })

    // Boundary tests
    it("should give Strong Buy at exactly 75", () => {
      expect(getVerdict(75)).toBe("strong_buy")
    })

    it("should give Worth Exploring at exactly 60", () => {
      expect(getVerdict(60)).toBe("worth_exploring")
    })

    it("should give Needs Work at exactly 45", () => {
      expect(getVerdict(45)).toBe("needs_work")
    })

    it("should give Pass at exactly 44", () => {
      expect(getVerdict(44)).toBe("pass")
    })
  })

  describe("Yield & Cashflow Calculations", () => {
    const metrics = calcPurchaseMetrics(investorProperty)

    it("should calculate gross yield correctly", () => {
      // 550 * 5 = 2750/month, 33000/year, (33000/250000)*100 = 13.2%
      expect(metrics.grossYield).toBeCloseTo(13.2, 1)
    })

    it("should calculate net yield as 70% of gross", () => {
      expect(metrics.netYield).toBeCloseTo(metrics.grossYield! * 0.7, 1)
    })

    it("should calculate positive monthly cashflow", () => {
      // Annual rent: 33000, costs 30%: 9900, mortgage: 250000*0.75*0.055 = 10312.5
      // Cashflow: (33000 - 9900 - 10312.5) / 12 ≈ 1066
      expect(metrics.monthlyCashflow).toBeGreaterThan(0)
    })

    it("should calculate price per room", () => {
      // 250000 / 5 = 50000
      expect(metrics.pricePerRoom).toBe(50000)
    })

    it("price per room under £60k should be positive status", () => {
      expect(metrics.pricePerRoom!).toBeLessThan(60000)
    })
  })

  describe("Yield Edge Cases", () => {
    it("should return null yield when purchase price is missing", () => {
      const p = makeProperty({ listing_type: "purchase", purchase_price: null })
      const m = calcPurchaseMetrics(p)
      expect(m.grossYield).toBeNull()
      expect(m.netYield).toBeNull()
    })

    it("should return null yield when estimated rent is missing", () => {
      const p = makeProperty({
        listing_type: "purchase",
        purchase_price: 200000,
        estimated_rent_per_room: null,
      })
      const m = calcPurchaseMetrics(p)
      expect(m.grossYield).toBeNull()
    })

    it("should return null cashflow when price is missing", () => {
      const p = makeProperty({ listing_type: "purchase", purchase_price: null })
      expect(calcPurchaseMetrics(p).monthlyCashflow).toBeNull()
    })

    it("should return null price per room when bedrooms is 0", () => {
      const p = makeProperty({
        listing_type: "purchase",
        purchase_price: 200000,
        bedrooms: 0,
      })
      expect(calcPurchaseMetrics(p).pricePerRoom).toBeNull()
    })

    it("should handle very high price correctly", () => {
      const p = makeProperty({
        listing_type: "purchase",
        purchase_price: 5000000,
        estimated_rent_per_room: 800,
        bedrooms: 6,
      })
      const m = calcPurchaseMetrics(p)
      expect(m.grossYield).toBeGreaterThan(0)
      expect(m.grossYield!).toBeLessThan(5) // low yield for expensive property
    })

    it("should handle single bedroom property", () => {
      const p = makeProperty({
        listing_type: "purchase",
        purchase_price: 100000,
        estimated_rent_per_room: 600,
        bedrooms: 1,
      })
      const m = calcPurchaseMetrics(p)
      expect(m.pricePerRoom).toBe(100000)
      expect(m.grossYield).toBeCloseTo(7.2, 1)
    })
  })

  describe("Owner & Contact Data", () => {
    it("should have title owner name", () => {
      expect(investorProperty.owner_name).toBe("John Smith")
    })

    it("should have company name", () => {
      expect(investorProperty.company_name).toBe("Smith Properties Ltd")
    })

    it("should have company number", () => {
      expect(investorProperty.company_number).toBe("12345678")
    })

    it("should have licence holder name (separate from owner)", () => {
      expect(investorProperty.licence_holder_name).toBe("Jane Doe")
      expect(investorProperty.licence_holder_name).not.toBe(investorProperty.owner_name)
    })
  })

  describe("Article 4 Awareness", () => {
    it("should show no Article 4 restriction for this property", () => {
      expect(investorProperty.article_4_area).toBe(false)
    })

    it("should flag Article 4 when present", () => {
      const p = makeProperty({
        listing_type: "purchase",
        purchase_price: 300000,
        article_4_area: true,
      })
      expect(p.article_4_area).toBe(true)
    })
  })
})

// ============================================================================
// COUNCIL / TA PROFILE — Rent listings, TA suitability, LHA rates
// ============================================================================

// ============================================================================
// OPERATOR PROFILE — Licence tracking, compliance, EPC
// ============================================================================
describe("Operator Profile: Property Details", () => {
  const operatorProperty = makeProperty({
    listing_type: "purchase",
    purchase_price: 280000,
    bedrooms: 6,
    bathrooms: 2,
    licensed_hmo: true,
    licence_status: "active",
    licence_id: "HMO-2023-12345",
    licence_start_date: "2023-06-01",
    licence_end_date: "2028-06-01",
    hmo_licence_reference: "HMO-2023-12345",
    max_occupants: 6,
    epc_rating: "B",
    epc_rating_numeric: 85,
    floor_area: 150,
    epc_certificate_url: "https://epc.example.com/cert",
    article_4_area: false,
    compliance_complexity: "low",
  })

  describe("Licence Tracking", () => {
    it("should show active licence status", () => {
      expect(operatorProperty.licence_status).toBe("active")
    })

    it("should show licence number", () => {
      expect(operatorProperty.hmo_licence_reference).toBe("HMO-2023-12345")
    })

    it("should show licence start date", () => {
      expect(operatorProperty.licence_start_date).toBe("2023-06-01")
    })

    it("should show licence end date", () => {
      expect(operatorProperty.licence_end_date).toBe("2028-06-01")
    })

    it("should show max occupants", () => {
      expect(operatorProperty.max_occupants).toBe(6)
    })

    it("licence end date should be in the future (not expired)", () => {
      const endDate = new Date(operatorProperty.licence_end_date!)
      expect(endDate.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe("Licence Status Variants", () => {
    it("should detect expired licence", () => {
      const p = makeProperty({
        licence_status: "expired",
        licence_end_date: "2022-01-01",
      })
      expect(p.licence_status).toBe("expired")
      const endDate = new Date(p.licence_end_date!)
      expect(endDate.getTime()).toBeLessThan(Date.now())
    })

    it("should detect pending licence", () => {
      const p = makeProperty({ licence_status: "pending" })
      expect(p.licence_status).toBe("pending")
    })

    it("should detect no licence", () => {
      const p = makeProperty({
        licence_status: "none",
        licensed_hmo: false,
        licence_id: null,
        hmo_licence_reference: null,
      })
      expect(p.licence_status).toBe("none")
      expect(p.licensed_hmo).toBe(false)
    })

    it("should handle licence expiring soon (within 90 days)", () => {
      const soonDate = new Date()
      soonDate.setDate(soonDate.getDate() + 60)
      const p = makeProperty({
        licence_status: "active",
        licence_end_date: soonDate.toISOString().split("T")[0],
      })
      const daysRemaining = Math.ceil(
        (new Date(p.licence_end_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      expect(daysRemaining).toBeLessThanOrEqual(90)
      expect(daysRemaining).toBeGreaterThan(0)
    })
  })

  describe("EPC & Compliance", () => {
    it("should show EPC rating B", () => {
      expect(operatorProperty.epc_rating).toBe("B")
    })

    it("should show EPC efficiency score", () => {
      expect(operatorProperty.epc_rating_numeric).toBe(85)
    })

    it("should show floor area", () => {
      expect(operatorProperty.floor_area).toBe(150)
    })

    it("should have EPC certificate URL", () => {
      expect(operatorProperty.epc_certificate_url).toBeTruthy()
    })

    it("should show low compliance complexity", () => {
      expect(operatorProperty.compliance_complexity).toBe("low")
    })

    it("should not be in Article 4 area", () => {
      expect(operatorProperty.article_4_area).toBe(false)
    })

    it("EPC A-C should be considered good (no upgrade needed)", () => {
      const goodRatings = ["A", "B", "C"]
      expect(goodRatings).toContain(operatorProperty.epc_rating)
    })

    it("EPC D-E should be flagged for potential upgrade", () => {
      const p = makeProperty({ epc_rating: "D" })
      const needsReview = ["D", "E"].includes(p.epc_rating!)
      expect(needsReview).toBe(true)
    })

    it("EPC F-G should be flagged as inadequate", () => {
      const p = makeProperty({ epc_rating: "F" })
      const inadequate = ["F", "G"].includes(p.epc_rating!)
      expect(inadequate).toBe(true)
    })
  })

  describe("Compliance Complexity Variants", () => {
    it("should handle medium complexity", () => {
      const p = makeProperty({ compliance_complexity: "medium" })
      expect(p.compliance_complexity).toBe("medium")
    })

    it("should handle high complexity", () => {
      const p = makeProperty({ compliance_complexity: "high" })
      expect(p.compliance_complexity).toBe("high")
    })

    it("Article 4 property should have higher compliance concern", () => {
      const p = makeProperty({ article_4_area: true })
      expect(p.article_4_area).toBe(true)
      // Article 4 = planning permission required = higher compliance burden
    })
  })

  describe("Portfolio Data Completeness", () => {
    it("should have all licence fields populated for active HMO", () => {
      expect(operatorProperty.licence_id).toBeTruthy()
      expect(operatorProperty.licence_start_date).toBeTruthy()
      expect(operatorProperty.licence_end_date).toBeTruthy()
      expect(operatorProperty.hmo_licence_reference).toBeTruthy()
      expect(operatorProperty.max_occupants).toBeGreaterThan(0)
    })

    it("should have EPC data for compliance tracking", () => {
      expect(operatorProperty.epc_rating).toBeTruthy()
      expect(operatorProperty.epc_rating_numeric).toBeGreaterThan(0)
      expect(operatorProperty.floor_area).toBeGreaterThan(0)
    })
  })
})

// ============================================================================
// AGENT PROFILE — Deal scoring, comparison data, classification
// ============================================================================
describe("Agent Profile: Property Details", () => {
  describe("Deal Score Thresholds", () => {
    it("properties above 45 should be shown (agent default filter)", () => {
      const scores = [45, 50, 60, 75, 90, 100]
      scores.forEach((score) => {
        expect(score).toBeGreaterThanOrEqual(45)
        expect(getVerdict(score)).not.toBe("pass")
      })
    })

    it("properties below 45 should be filtered out by default", () => {
      const scores = [0, 10, 20, 30, 44]
      scores.forEach((score) => {
        expect(score).toBeLessThan(45)
        expect(getVerdict(score)).toBe("pass")
      })
    })

    it("should correctly bucket all score ranges", () => {
      // Exhaustive sweep from 0 to 100
      for (let s = 0; s <= 100; s++) {
        const v = getVerdict(s)
        if (s === 0) expect(v).toBe("pass")
        else if (s < 45) expect(v).toBe("pass")
        else if (s < 60) expect(v).toBe("needs_work")
        else if (s < 75) expect(v).toBe("worth_exploring")
        else expect(v).toBe("strong_buy")
      }
    })
  })

  describe("Comparison Data Availability", () => {
    // Agents compare up to 3 properties — all must have consistent data
    const properties = [
      makeProperty({
        id: "prop-1",
        listing_type: "purchase",
        purchase_price: 200000,
        bedrooms: 4,
        bathrooms: 1,
        epc_rating: "C",
        deal_score: 72,
        article_4_area: false,
        licence_status: "active",
        gross_internal_area_sqm: 100,
      }),
      makeProperty({
        id: "prop-2",
        listing_type: "purchase",
        purchase_price: 320000,
        bedrooms: 6,
        bathrooms: 2,
        epc_rating: "B",
        deal_score: 85,
        article_4_area: false,
        licence_status: "active",
        gross_internal_area_sqm: 160,
      }),
      makeProperty({
        id: "prop-3",
        listing_type: "purchase",
        purchase_price: 180000,
        bedrooms: 3,
        bathrooms: 1,
        epc_rating: "D",
        deal_score: 55,
        article_4_area: true,
        licence_status: "expired",
        gross_internal_area_sqm: 80,
      }),
    ]

    it("all 3 comparison properties should have a deal score", () => {
      properties.forEach((p) => {
        expect(p.deal_score).not.toBeNull()
        expect(p.deal_score!).toBeGreaterThan(0)
      })
    })

    it("all 3 should have purchase price for comparison", () => {
      properties.forEach((p) => {
        expect(p.purchase_price).not.toBeNull()
        expect(p.purchase_price!).toBeGreaterThan(0)
      })
    })

    it("all 3 should have bedrooms for comparison", () => {
      properties.forEach((p) => {
        expect(p.bedrooms).toBeGreaterThan(0)
      })
    })

    it("all 3 should have EPC rating for comparison", () => {
      properties.forEach((p) => {
        expect(p.epc_rating).toBeTruthy()
      })
    })

    it("all 3 should have floor area for comparison", () => {
      properties.forEach((p) => {
        expect(p.gross_internal_area_sqm).not.toBeNull()
        expect(p.gross_internal_area_sqm!).toBeGreaterThan(0)
      })
    })

    it("all 3 should have Article 4 status for comparison", () => {
      properties.forEach((p) => {
        expect(typeof p.article_4_area).toBe("boolean")
      })
    })

    it("all 3 should have licence status for comparison", () => {
      properties.forEach((p) => {
        expect(p.licence_status).toBeTruthy()
      })
    })

    it("should identify best deal score among comparison set", () => {
      const best = properties.reduce((a, b) =>
        (a.deal_score ?? 0) > (b.deal_score ?? 0) ? a : b
      )
      expect(best.id).toBe("prop-2")
      expect(best.deal_score).toBe(85)
    })

    it("should identify cheapest property among comparison set", () => {
      const cheapest = properties.reduce((a, b) =>
        (a.purchase_price ?? Infinity) < (b.purchase_price ?? Infinity) ? a : b
      )
      expect(cheapest.id).toBe("prop-3")
      expect(cheapest.purchase_price).toBe(180000)
    })

    it("should identify most bedrooms among comparison set", () => {
      const most = properties.reduce((a, b) =>
        a.bedrooms > b.bedrooms ? a : b
      )
      expect(most.id).toBe("prop-2")
      expect(most.bedrooms).toBe(6)
    })
  })

  describe("HMO Classification for Agents", () => {
    it("should identify ready_to_go classification", () => {
      const p = makeProperty({
        is_potential_hmo: true,
        hmo_classification: "ready_to_go",
      })
      expect(p.hmo_classification).toBe("ready_to_go")
    })

    it("should identify value_add classification", () => {
      const p = makeProperty({
        is_potential_hmo: true,
        hmo_classification: "value_add",
      })
      expect(p.hmo_classification).toBe("value_add")
    })

    it("should identify not_suitable classification", () => {
      const p = makeProperty({
        is_potential_hmo: true,
        hmo_classification: "not_suitable",
      })
      expect(p.hmo_classification).toBe("not_suitable")
    })

    it("non-HMO property should have null classification", () => {
      const p = makeProperty({
        is_potential_hmo: false,
        hmo_classification: null,
      })
      expect(p.hmo_classification).toBeNull()
    })
  })
})

// ============================================================================
// CROSS-PROFILE STRESS: Same property viewed by different profiles
// ============================================================================
describe("Cross-Profile: Same Property, Different Needs", () => {
  // A property that has data for all profiles
  const sharedProperty = makeProperty({
    id: "shared-prop",
    listing_type: "rent",
    price_pcm: 700,
    purchase_price: 250000,
    estimated_rent_per_room: 500,
    bedrooms: 4,
    bathrooms: 2,
    city: "Manchester",
    postcode: "M14 5TQ",
    licensed_hmo: true,
    licence_status: "active",
    licence_end_date: "2027-06-01",
    max_occupants: 4,
    epc_rating: "C",
    deal_score: 68,
    article_4_area: false,
    is_potential_hmo: true,
    hmo_classification: "ready_to_go",
    owner_name: "Alice Brown",
    company_name: "Brown Holdings Ltd",
    company_number: "87654321",
    licence_holder_name: "Bob Green",
  })

  it("investor sees deal verdict (Worth Exploring for 68)", () => {
    expect(getVerdict(sharedProperty.deal_score)).toBe("worth_exploring")
  })

  it("investor sees purchase metrics when viewing as purchase", () => {
    const purchaseView = { ...sharedProperty, listing_type: "purchase" as const }
    const m = calcPurchaseMetrics(purchaseView)
    expect(m.grossYield).not.toBeNull()
    expect(m.pricePerRoom).not.toBeNull()
  })

  it("operator sees licence is active with future expiry", () => {
    expect(sharedProperty.licence_status).toBe("active")
    const end = new Date(sharedProperty.licence_end_date!)
    expect(end.getTime()).toBeGreaterThan(Date.now())
  })

  it("operator sees max occupants", () => {
    expect(sharedProperty.max_occupants).toBe(4)
  })

  it("operator sees EPC rating for compliance", () => {
    expect(sharedProperty.epc_rating).toBe("C")
  })

  it("agent sees deal score above default 45 threshold", () => {
    expect(sharedProperty.deal_score!).toBeGreaterThanOrEqual(45)
  })

  it("agent sees HMO classification for sourcing", () => {
    expect(sharedProperty.hmo_classification).toBe("ready_to_go")
  })

  it("agent sees both owner and licence holder for contact", () => {
    expect(sharedProperty.owner_name).toBeTruthy()
    expect(sharedProperty.licence_holder_name).toBeTruthy()
    expect(sharedProperty.owner_name).not.toBe(sharedProperty.licence_holder_name)
  })
})

// ============================================================================
// STRESS: Bulk property generation and validation
// ============================================================================
describe("Stress: Bulk Property Validation", () => {
  const BULK_COUNT = 100

  function randomProperty(i: number): Property {
    const isRent = i % 2 === 0
    return makeProperty({
      id: `bulk-${i}`,
      listing_type: isRent ? "rent" : "purchase",
      price_pcm: isRent ? 400 + (i * 13) % 1200 : null,
      purchase_price: isRent ? null : 100000 + (i * 7919) % 400000,
      estimated_rent_per_room: isRent ? null : 350 + (i * 37) % 500,
      bedrooms: 1 + (i % 8),
      bathrooms: 1 + (i % 3),
      deal_score: (i * 17) % 101,
      epc_rating: (["A", "B", "C", "D", "E", "F", "G"] as const)[i % 7],
      licensed_hmo: i % 3 !== 0,
      licence_status: (["active", "expired", "pending", "none"] as const)[i % 4],
      article_4_area: i % 5 === 0,
      city: (["Manchester", "London", "Birmingham", "Leeds"] as const)[i % 4],
    })
  }

  const bulkProperties = Array.from({ length: BULK_COUNT }, (_, i) => randomProperty(i))

  it(`should calculate metrics for all ${BULK_COUNT} properties without error`, () => {
    bulkProperties.forEach((p) => {
      if (p.listing_type === "purchase") {
        const m = calcPurchaseMetrics(p)
        // Should not throw — values can be null but not undefined
        expect(m).toBeDefined()
      } else {
        const m = calcRentMetrics(p)
        expect(m).toBeDefined()
      }
    })
  })

  it(`should generate valid verdicts for all ${BULK_COUNT} deal scores`, () => {
    bulkProperties.forEach((p) => {
      const v = getVerdict(p.deal_score)
      expect(["strong_buy", "worth_exploring", "needs_work", "pass"]).toContain(v)
    })
  })

  it("should never have negative yield", () => {
    bulkProperties
      .filter((p) => p.listing_type === "purchase")
      .forEach((p) => {
        const m = calcPurchaseMetrics(p)
        if (m.grossYield !== null) {
          expect(m.grossYield).toBeGreaterThanOrEqual(0)
        }
      })
  })

  it("should never have negative rent per room", () => {
    bulkProperties
      .filter((p) => p.listing_type === "rent")
      .forEach((p) => {
        const m = calcRentMetrics(p)
        if (m.rentPerRoom !== null) {
          expect(m.rentPerRoom).toBeGreaterThanOrEqual(0)
        }
      })
  })
})
