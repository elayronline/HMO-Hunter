import { describe, it, expect } from "vitest"
import {
  detectScenario,
  buildSmartMergeData,
  SCENARIO_TEMPLATES,
  validatePostalAddress,
  FOLLOW_UP_TEMPLATES,
  type LetterScenario,
} from "@/lib/d2v-templates"
import type { Property } from "@/lib/types/database"

// Helper: create a minimal property for testing
const createTestProperty = (overrides: Partial<Property> = {}): Property => ({
  id: "test-id",
  title: "Test Property",
  address: "123 Test Street",
  postcode: "M1 1AA",
  city: "Manchester",
  country: "UK",
  latitude: 53.48,
  longitude: -2.24,
  listing_type: "purchase",
  price_pcm: null,
  purchase_price: 250000,
  estimated_rent_per_room: null,
  property_type: "HMO",
  hmo_status: "Licensed HMO",
  tenure: "freehold",
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
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  last_updated: null,
  licence_id: null,
  licence_start_date: null,
  licence_end_date: null,
  licence_status: "active",
  max_occupants: 5,
  licence_holder_name: null,
  licence_holder_email: null,
  licence_holder_phone: null,
  licence_holder_address: null,
  uprn: null,
  year_built: 1920,
  estimated_value: 280000,
  rental_yield: null,
  area_population: null,
  area_avg_rent: null,
  owner_name: "John Smith",
  owner_address: null,
  owner_type: "individual",
  owner_contact_email: "john@example.com",
  owner_contact_phone: "07700900000",
  company_name: null,
  company_number: null,
  company_status: null,
  company_incorporation_date: null,
  directors: null,
  epc_rating: "C",
  epc_rating_numeric: null,
  epc_certificate_url: null,
  epc_expiry_date: null,
  article_4_area: false,
  planning_constraints: null,
  conservation_area: false,
  listed_building_grade: null,
  title_number: null,
  title_last_enriched_at: null,
  owner_enrichment_source: null,
  contact_data_added_at: null,
  contact_data_source: null,
  contact_data_opted_out: false,
  gross_internal_area_sqm: 120,
  floor_area_band: "120_plus",
  room_count: 6,
  lettable_rooms: 5,
  current_layout: null,
  ceiling_height_compliant: true,
  hmo_suitability_score: 80,
  hmo_classification: "ready_to_go",
  potential_occupants: 5,
  requires_mandatory_licensing: true,
  compliance_complexity: "low",
  meets_space_standards: true,
  bathroom_ratio_compliant: true,
  kitchen_size_compliant: true,
  epc_upgrade_viable: null,
  epc_upgrade_cost_estimate: null,
  epc_improvement_potential: null,
  estimated_gross_monthly_rent: 2500,
  estimated_annual_income: 30000,
  yield_band: "high",
  estimated_yield_percentage: 8.5,
  deal_score: 75,
  deal_score_breakdown: null,
  is_ex_local_authority: false,
  has_value_add_potential: false,
  requires_major_structural_work: false,
  is_potential_hmo: false,
  watchlist_count: 0,
  broadband_basic_down: null, broadband_basic_up: null,
  broadband_superfast_down: null, broadband_superfast_up: null,
  broadband_ultrafast_down: null, broadband_ultrafast_up: null,
  broadband_max_down: null, broadband_max_up: null,
  has_fiber: null, has_superfast: null, broadband_last_checked: null,
  agent_name: null, agent_phone: null, agent_email: null,
  agent_address: null, agent_logo: null, agent_profile_url: null,
  days_on_market: null, first_listed_date: null, price_change_summary: null,
  zoopla_listing_id: null, zoopla_listing_url: null, zoopla_price_pcm: null,
  zoopla_price_pw: null, zoopla_agent_name: null, zoopla_agent_phone: null,
  zoopla_images: null, zoopla_floor_plan_url: null, zoopla_first_published: null,
  zoopla_days_on_market: null, zoopla_area_avg_price: null, zoopla_zed_index: null,
  zoopla_enriched_at: null,
  streetdata_property_id: null, construction_age_band: null, council_tax_band: null,
  internal_area_sqm: null, is_bungalow: null, has_outdoor_space: null,
  streetdata_enriched_at: null,
  patma_asking_price_mean: null, patma_asking_price_median: null,
  patma_sold_price_mean: null, patma_sold_price_median: null,
  patma_price_data_points: null, patma_search_radius_miles: null,
  patma_enriched_at: null,
  hmo_licence_reference: null, hmo_licence_type: null, hmo_licence_expiry: null,
  hmo_council: null, hmo_max_occupancy: null, hmo_sleeping_rooms: null,
  hmo_shared_bathrooms: null, propertydata_enriched_at: null,
  estimated_rental_yield: null, price_per_sqm: null,
  last_enriched_at: null, enrichment_sources: null,
  landregistry_last_checked: null, last_sale_price: null, last_sale_date: null,
  property_type_lr: null, tenure_lr: null, new_build: null,
  postcode_avg_price: 230000, postcode_transactions: null, registered_owner: null,
  ...overrides,
} as Property)

// ============================================================
// SCENARIO DETECTION
// ============================================================

describe("Scenario Detection", () => {
  it("should detect expired licence", () => {
    const prop = createTestProperty({ licence_status: "expired" })
    expect(detectScenario(prop)).toBe("expired_licence")
  })

  it("should detect expiring licence (within 90 days)", () => {
    const expiry = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    const prop = createTestProperty({ hmo_licence_expiry: expiry, licence_status: "active" })
    expect(detectScenario(prop)).toBe("expiring_licence")
  })

  it("should NOT detect expiring if > 90 days away", () => {
    const expiry = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString()
    const prop = createTestProperty({ hmo_licence_expiry: expiry, licence_status: "active" })
    expect(detectScenario(prop)).not.toBe("expiring_licence")
  })

  it("should detect long on market (180+ days)", () => {
    const prop = createTestProperty({ days_on_market: 200, licence_status: "active" })
    expect(detectScenario(prop)).toBe("long_on_market")
  })

  it("should detect unlicensed potential", () => {
    const prop = createTestProperty({ is_potential_hmo: true, licensed_hmo: false, licence_status: "none" })
    expect(detectScenario(prop)).toBe("unlicensed_potential")
  })

  it("should detect rent-to-rent for rental properties", () => {
    const prop = createTestProperty({ listing_type: "rent", licence_status: "active" })
    expect(detectScenario(prop)).toBe("rent_to_rent")
  })

  it("should fall back to general purchase", () => {
    const prop = createTestProperty({ licence_status: "active" })
    expect(detectScenario(prop)).toBe("general_purchase")
  })

  it("should prioritise expired over long on market", () => {
    const prop = createTestProperty({ licence_status: "expired", days_on_market: 300 })
    expect(detectScenario(prop)).toBe("expired_licence")
  })
})

// ============================================================
// SMART MERGE DATA
// ============================================================

describe("Smart Merge Data", () => {
  it("should include all standard fields", () => {
    const data = buildSmartMergeData(createTestProperty())
    expect(data.owner_name).toBe("John Smith")
    expect(data.property_address).toBe("123 Test Street")
    expect(data.property_postcode).toBe("M1 1AA")
    expect(data.property_city).toBe("Manchester")
    expect(data.bedrooms).toBe("5")
    expect(data.epc_rating).toBe("C")
  })

  it("should include smart fields from property intelligence", () => {
    const data = buildSmartMergeData(createTestProperty())
    expect(data.street_avg_price).toContain("£")
    expect(data.estimated_yield).toContain("%")
    expect(data.reference_code).toMatch(/^HMO-/)
  })

  it("should generate unique reference codes", () => {
    const codes = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const data = buildSmartMergeData(createTestProperty())
      codes.add(data.reference_code)
    }
    // Some may collide due to tight loop timing, but should have variety
    expect(codes.size).toBeGreaterThanOrEqual(2)
  })

  it("should handle missing optional fields gracefully", () => {
    const data = buildSmartMergeData(createTestProperty({
      postcode_avg_price: null,
      estimated_yield_percentage: null,
      days_on_market: null,
      hmo_licence_expiry: null,
    }))
    expect(data.street_avg_price).toBe("")
    expect(data.estimated_yield).toBe("")
    expect(data.days_on_market).toBe("")
    expect(data.licence_expiry).toBe("")
  })

  it("should fallback owner name to licence holder", () => {
    const data = buildSmartMergeData(createTestProperty({
      owner_name: null,
      licence_holder_name: "Jane Doe",
    }))
    expect(data.owner_name).toBe("Jane Doe")
  })

  it("should fallback to 'Property Owner' when no name", () => {
    const data = buildSmartMergeData(createTestProperty({
      owner_name: null,
      licence_holder_name: null,
    }))
    expect(data.owner_name).toBe("Property Owner")
  })
})

// ============================================================
// SCENARIO TEMPLATES
// ============================================================

describe("Scenario Templates", () => {
  const allScenarios: LetterScenario[] = [
    "expired_licence", "expiring_licence", "long_on_market",
    "probate_estate", "unlicensed_potential", "general_purchase",
    "rent_to_rent", "portfolio_acquisition",
  ]

  it("should have 8 scenario templates", () => {
    expect(Object.keys(SCENARIO_TEMPLATES)).toHaveLength(8)
  })

  allScenarios.forEach(scenario => {
    describe(scenario, () => {
      const config = SCENARIO_TEMPLATES[scenario]

      it("should have a non-empty label", () => {
        expect(config.label.length).toBeGreaterThan(0)
      })

      it("should have letter template with placeholders", () => {
        expect(config.letterTemplate.length).toBeGreaterThan(100)
        // Probate uses "Sir/Madam", portfolio uses city not address — both valid
        expect(
          config.letterTemplate.includes("{{owner_name}}") ||
          config.letterTemplate.includes("Sir/Madam")
        ).toBe(true)
        expect(
          config.letterTemplate.includes("{{property_address}}") ||
          config.letterTemplate.includes("{{property_city}}")
        ).toBe(true)
        expect(config.letterTemplate).toContain("{{reference_code}}")
      })

      it("should have email template with placeholders", () => {
        expect(config.emailTemplate.length).toBeGreaterThan(50)
        expect(
          config.emailTemplate.includes("{{owner_name}}") ||
          config.emailTemplate.includes("Sir/Madam")
        ).toBe(true)
        expect(config.emailTemplate).toContain("{{reference_code}}")
      })

      it("should have follow-up schedule", () => {
        expect(config.followUpDays.length).toBeGreaterThan(0)
        // Follow-ups should be in ascending order
        for (let i = 1; i < config.followUpDays.length; i++) {
          expect(config.followUpDays[i]).toBeGreaterThan(config.followUpDays[i - 1])
        }
      })

      it("should have a subject line", () => {
        expect(config.subject.length).toBeGreaterThan(0)
      })

      it("letter template should fully merge with smart data", () => {
        const data = buildSmartMergeData(createTestProperty())
        let merged = config.letterTemplate
        for (const [key, value] of Object.entries(data)) {
          merged = merged.replaceAll(`{{${key}}}`, value)
        }
        // Should have no remaining {{...}} (except maybe company_name for portfolio)
        const remaining = merged.match(/\{\{(\w+)\}\}/g) || []
        const allowedUnmerged = ["company_name"] // OK if company_name is null
        const unexpected = remaining.filter(r => !allowedUnmerged.some(a => r.includes(a)))
        expect(unexpected).toHaveLength(0)
      })
    })
  })

  it("expired_licence template should mention the expiry date", () => {
    expect(SCENARIO_TEMPLATES.expired_licence.letterTemplate).toContain("{{licence_expiry}}")
  })

  it("expiring_licence template should mention days until expiry", () => {
    expect(SCENARIO_TEMPLATES.expiring_licence.letterTemplate).toContain("{{days_until_expiry}}")
  })

  it("long_on_market template should mention days on market", () => {
    expect(SCENARIO_TEMPLATES.long_on_market.letterTemplate).toContain("{{days_on_market}}")
  })

  it("unlicensed_potential template should mention yield", () => {
    expect(SCENARIO_TEMPLATES.unlicensed_potential.letterTemplate).toContain("{{estimated_yield}}")
  })

  it("probate template should be sensitive (no 'buy' language in first line)", () => {
    const firstLine = SCENARIO_TEMPLATES.probate_estate.letterTemplate.split("\n")[0]
    expect(firstLine.toLowerCase()).not.toContain("buy")
    expect(firstLine.toLowerCase()).not.toContain("purchase")
  })
})

// ============================================================
// FOLLOW-UP TEMPLATES
// ============================================================

describe("Follow-Up Templates", () => {
  it("should have 3 follow-up templates", () => {
    expect(Object.keys(FOLLOW_UP_TEMPLATES)).toHaveLength(3)
  })

  it("each follow-up should reference the reference code", () => {
    Object.values(FOLLOW_UP_TEMPLATES).forEach(template => {
      expect(template.body).toContain("{{reference_code}}")
    })
  })

  it("each follow-up should have a subject and body", () => {
    Object.values(FOLLOW_UP_TEMPLATES).forEach(template => {
      expect(template.subject.length).toBeGreaterThan(0)
      expect(template.body.length).toBeGreaterThan(50)
    })
  })

  it("final follow-up should be politely closing", () => {
    const final = FOLLOW_UP_TEMPLATES[2]
    expect(final.body.toLowerCase()).toContain("final")
  })
})

// ============================================================
// ADDRESS VALIDATION
// ============================================================

describe("Address Validation", () => {
  it("should validate a good UK address with full details as high confidence", () => {
    const result = validatePostalAddress("123 High Street, Manchester", "M1 1AA")
    expect(result.isValid).toBe(true)
    expect(result.confidence).toBe("high")
    expect(result.issues).toHaveLength(0)
  })

  it("should validate a minimal address as valid", () => {
    const result = validatePostalAddress("123 Test Street", "M1 1AA")
    expect(result.isValid).toBe(true)
    expect(["high", "medium"]).toContain(result.confidence)
  })

  it("should flag missing postcode", () => {
    const result = validatePostalAddress("123 Test Street", "")
    expect(result.isValid).toBe(false)
    expect(result.issues.some(i => i.includes("postcode"))).toBe(true)
  })

  it("should flag invalid postcode format", () => {
    const result = validatePostalAddress("123 Test Street", "INVALID")
    expect(result.issues.some(i => i.includes("postcode"))).toBe(true)
  })

  it("should flag very short address", () => {
    const result = validatePostalAddress("Hi", "M1 1AA")
    expect(result.isValid).toBe(false)
  })

  it("should flag missing house number", () => {
    const result = validatePostalAddress("Test Street, Manchester", "M1 1AA")
    expect(result.issues.some(i => i.includes("house number"))).toBe(true)
  })

  it("should flag placeholder addresses", () => {
    const result = validatePostalAddress("Unknown Address", "M1 1AA")
    expect(result.issues.some(i => i.includes("placeholder"))).toBe(true)
  })

  it("should accept common UK postcode formats", () => {
    const validPostcodes = ["M1 1AA", "SW1A 1AA", "EC1A 1BB", "LS1 2AB", "B1 1AA"]
    validPostcodes.forEach(pc => {
      const result = validatePostalAddress("123 Test Street", pc)
      expect(result.issues.filter(i => i.includes("postcode"))).toHaveLength(0)
    })
  })

  it("should return formatted address when valid", () => {
    const result = validatePostalAddress("123 test street ", " m1 1aa ")
    expect(result.formatted).toBe("123 test street, M1 1AA")
  })
})

// ============================================================
// STRESS: BULK TEMPLATE MERGING
// ============================================================

describe("Stress: Bulk Operations", () => {
  it("should merge 1000 letters in under 100ms", () => {
    const prop = createTestProperty()
    const data = buildSmartMergeData(prop)
    const template = SCENARIO_TEMPLATES.expired_licence.letterTemplate

    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      let merged = template
      for (const [key, value] of Object.entries(data)) {
        merged = merged.replaceAll(`{{${key}}}`, value)
      }
      expect(merged.length).toBeGreaterThan(0)
    }
    expect(performance.now() - start).toBeLessThan(100)
  })

  it("should detect scenario for 1000 properties in under 50ms", () => {
    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      const prop = createTestProperty({
        licence_status: i % 5 === 0 ? "expired" : "active",
        days_on_market: i % 3 === 0 ? 200 : 10,
        is_potential_hmo: i % 4 === 0,
      })
      detectScenario(prop)
    }
    expect(performance.now() - start).toBeLessThan(50)
  })

  it("should validate 1000 addresses in under 50ms", () => {
    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      validatePostalAddress(`${i} Test Street, Manchester`, "M1 1AA")
    }
    expect(performance.now() - start).toBeLessThan(50)
  })
})
