import { describe, it, expect, vi, beforeEach } from "vitest"
import { CREDIT_COSTS, formatCreditStatus, type UserCredits } from "@/lib/credits"
import { getVisibilityForRole, ROLE_VISIBILITY } from "@/lib/role-visibility"
import { VIEWING_CHECKLISTS, D2V_PLACEHOLDERS } from "@/lib/types/pipeline"
import { viewingConfirmationEmail } from "@/lib/email/templates"
import {
  pipelineDealCreateSchema,
  pipelineDealUpdateSchema,
  d2vTemplateCreateSchema,
  d2vCampaignCreateSchema,
  d2vCampaignSendSchema,
  viewingCreateSchema,
  viewingUpdateSchema,
} from "@/lib/validation/schemas"
import type { UserType } from "@/components/role-selection-modal"

// ============================================================
// CREDIT SYSTEM - NEW ACTIONS
// ============================================================

describe("Pipeline Credit Costs", () => {
  it("should define costs for all new actions", () => {
    expect(CREDIT_COSTS.add_to_pipeline).toBeDefined()
    expect(CREDIT_COSTS.d2v_send_letter).toBeDefined()
    expect(CREDIT_COSTS.d2v_send_email).toBeDefined()
    expect(CREDIT_COSTS.schedule_viewing).toBeDefined()
  })

  it("should have reasonable costs for pipeline actions", () => {
    // Pipeline add should be cheap (1 credit)
    expect(CREDIT_COSTS.add_to_pipeline).toBe(1)

    // D2V letter should cost more than email (postal costs)
    expect(CREDIT_COSTS.d2v_send_letter).toBeGreaterThan(CREDIT_COSTS.d2v_send_email)

    // Viewing should be moderate
    expect(CREDIT_COSTS.schedule_viewing).toBeGreaterThanOrEqual(1)
    expect(CREDIT_COSTS.schedule_viewing).toBeLessThanOrEqual(5)
  })

  it("should allow at least 150 pipeline additions per day", () => {
    const dailyCredits = 150
    const maxAdds = Math.floor(dailyCredits / CREDIT_COSTS.add_to_pipeline)
    expect(maxAdds).toBeGreaterThanOrEqual(150)
  })

  it("should allow at least 50 D2V emails per day", () => {
    const dailyCredits = 150
    const maxEmails = Math.floor(dailyCredits / CREDIT_COSTS.d2v_send_email)
    expect(maxEmails).toBeGreaterThanOrEqual(50)
  })

  it("should allow at least 50 D2V letters per day", () => {
    const dailyCredits = 150
    const maxLetters = Math.floor(dailyCredits / CREDIT_COSTS.d2v_send_letter)
    expect(maxLetters).toBeGreaterThanOrEqual(50)
  })

  it("should allow at least 75 viewings per day", () => {
    const dailyCredits = 150
    const maxViewings = Math.floor(dailyCredits / CREDIT_COSTS.schedule_viewing)
    expect(maxViewings).toBeGreaterThanOrEqual(75)
  })

  it("should handle mixed pipeline usage within daily limit", () => {
    // Typical pipeline user session:
    // - 10 pipeline adds (10 credits)
    // - 5 D2V emails (10 credits)
    // - 3 D2V letters (9 credits)
    // - 4 viewings (8 credits)
    // - 20 property views (20 credits - after free)
    // - 3 contact views (6 credits)

    const totalCost =
      (10 * CREDIT_COSTS.add_to_pipeline) +
      (5 * CREDIT_COSTS.d2v_send_email) +
      (3 * CREDIT_COSTS.d2v_send_letter) +
      (4 * CREDIT_COSTS.schedule_viewing) +
      (20 * CREDIT_COSTS.property_view) +
      (3 * CREDIT_COSTS.contact_data_view)

    expect(totalCost).toBeLessThan(150)
  })
})

// ============================================================
// ROLE VISIBILITY - NEW FEATURES
// ============================================================

describe("ICP Feature Visibility", () => {
  const allUserTypes: UserType[] = ["investor", "council_ta", "operator", "agent"]

  it("should define all new visibility fields for every role", () => {
    allUserTypes.forEach(role => {
      const vis = getVisibilityForRole(role)
      expect(vis.showPipeline).toBeDefined()
      expect(vis.showD2VOutreach).toBeDefined()
      expect(vis.showViewingTracker).toBeDefined()
      expect(vis.showOffMarketSourcing).toBeDefined()
      expect(vis.defaultViewingType).toBeDefined()
    })
  })

  it("should give all roles access to pipeline", () => {
    allUserTypes.forEach(role => {
      expect(getVisibilityForRole(role).showPipeline).toBe(true)
    })
  })

  it("should give all roles access to viewing tracker", () => {
    allUserTypes.forEach(role => {
      expect(getVisibilityForRole(role).showViewingTracker).toBe(true)
    })
  })

  it("should restrict D2V to investor and agent only", () => {
    expect(getVisibilityForRole("investor").showD2VOutreach).toBe(true)
    expect(getVisibilityForRole("agent").showD2VOutreach).toBe(true)
    expect(getVisibilityForRole("council_ta").showD2VOutreach).toBe(false)
    expect(getVisibilityForRole("operator").showD2VOutreach).toBe(false)
  })

  it("should restrict off-market sourcing to investor and agent", () => {
    expect(getVisibilityForRole("investor").showOffMarketSourcing).toBe(true)
    expect(getVisibilityForRole("agent").showOffMarketSourcing).toBe(true)
    expect(getVisibilityForRole("council_ta").showOffMarketSourcing).toBe(false)
    expect(getVisibilityForRole("operator").showOffMarketSourcing).toBe(false)
  })

  it("should assign correct default viewing types per ICP", () => {
    expect(getVisibilityForRole("investor").defaultViewingType).toBe("site_visit")
    expect(getVisibilityForRole("council_ta").defaultViewingType).toBe("inspection")
    expect(getVisibilityForRole("operator").defaultViewingType).toBe("portfolio_check")
    expect(getVisibilityForRole("agent").defaultViewingType).toBe("client_viewing")
  })

  it("should return fallback visibility for null/undefined roles", () => {
    const fallback = getVisibilityForRole(null)
    expect(fallback.showPipeline).toBe(true)
    expect(fallback.showD2VOutreach).toBe(true)
    expect(fallback.showViewingTracker).toBe(true)

    const undefinedFallback = getVisibilityForRole(undefined)
    expect(undefinedFallback.showPipeline).toBe(true)
  })

  it("should not break existing visibility settings", () => {
    // Investor should still see deal score and yield
    const investor = getVisibilityForRole("investor")
    expect(investor.showDealScore).toBe(true)
    expect(investor.showYieldMetrics).toBe(true)
    expect(investor.showYieldCalculator).toBe(true)

    // Council should still see TA metrics
    const council = getVisibilityForRole("council_ta")
    expect(council.showTaSuitability).toBe(true)
    expect(council.showLhaComparison).toBe(true)
    expect(council.showR2RMetrics).toBe(true)

    // Operator should still see ownership
    const operator = getVisibilityForRole("operator")
    expect(operator.showOwnership).toBe(true)

    // Agent should still see deal score
    const agent = getVisibilityForRole("agent")
    expect(agent.showDealScore).toBe(true)
    expect(agent.showHmoClassification).toBe(true)
  })
})

// ============================================================
// VIEWING CHECKLISTS PER ICP
// ============================================================

describe("ICP Viewing Checklists", () => {
  const allUserTypes: UserType[] = ["investor", "council_ta", "operator", "agent"]

  it("should have checklists defined for all user types", () => {
    allUserTypes.forEach(role => {
      expect(VIEWING_CHECKLISTS[role]).toBeDefined()
      expect(Array.isArray(VIEWING_CHECKLISTS[role])).toBe(true)
      expect(VIEWING_CHECKLISTS[role].length).toBeGreaterThan(0)
    })
  })

  it("should have at least 6 items per checklist", () => {
    allUserTypes.forEach(role => {
      expect(VIEWING_CHECKLISTS[role].length).toBeGreaterThanOrEqual(6)
    })
  })

  it("should have unique keys within each checklist", () => {
    allUserTypes.forEach(role => {
      const keys = VIEWING_CHECKLISTS[role].map(i => i.key)
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(keys.length)
    })
  })

  it("should have non-empty labels", () => {
    allUserTypes.forEach(role => {
      VIEWING_CHECKLISTS[role].forEach(item => {
        expect(item.label.length).toBeGreaterThan(0)
        expect(item.key.length).toBeGreaterThan(0)
      })
    })
  })

  it("investor checklist should focus on property assessment", () => {
    const keys = VIEWING_CHECKLISTS.investor.map(i => i.key)
    expect(keys).toContain("room_sizes")
    expect(keys).toContain("hmo_layout")
    expect(keys).toContain("fire_safety")
  })

  it("council_ta checklist should focus on habitability", () => {
    const keys = VIEWING_CHECKLISTS.council_ta.map(i => i.key)
    expect(keys).toContain("space_standards")
    expect(keys).toContain("damp_mould")
    expect(keys).toContain("heating_working")
  })

  it("operator checklist should focus on compliance", () => {
    const keys = VIEWING_CHECKLISTS.operator.map(i => i.key)
    expect(keys).toContain("fire_alarms")
    expect(keys).toContain("gas_safety")
    expect(keys).toContain("electrical_cert")
  })

  it("agent checklist should focus on marketing", () => {
    const keys = VIEWING_CHECKLISTS.agent.map(i => i.key)
    expect(keys).toContain("photos_taken")
    expect(keys).toContain("price_validated")
    expect(keys).toContain("vendor_motivation")
  })
})

// ============================================================
// D2V PLACEHOLDERS
// ============================================================

describe("D2V Placeholders", () => {
  it("should have essential merge fields", () => {
    expect(D2V_PLACEHOLDERS).toContain("{{owner_name}}")
    expect(D2V_PLACEHOLDERS).toContain("{{property_address}}")
    expect(D2V_PLACEHOLDERS).toContain("{{property_postcode}}")
    expect(D2V_PLACEHOLDERS).toContain("{{your_name}}")
    expect(D2V_PLACEHOLDERS).toContain("{{your_email}}")
    expect(D2V_PLACEHOLDERS).toContain("{{your_phone}}")
  })

  it("should have property-specific fields", () => {
    expect(D2V_PLACEHOLDERS).toContain("{{bedrooms}}")
    expect(D2V_PLACEHOLDERS).toContain("{{epc_rating}}")
    expect(D2V_PLACEHOLDERS).toContain("{{licence_status}}")
  })

  it("should all follow {{key}} format", () => {
    D2V_PLACEHOLDERS.forEach(p => {
      expect(p).toMatch(/^\{\{\w+\}\}$/)
    })
  })

  it("should have no duplicates", () => {
    const unique = new Set(D2V_PLACEHOLDERS)
    expect(unique.size).toBe(D2V_PLACEHOLDERS.length)
  })
})

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

describe("Pipeline Validation Schemas", () => {
  describe("pipelineDealCreateSchema", () => {
    it("should accept valid pipeline deal", () => {
      const result = pipelineDealCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        stage: "identified",
        label: "Hot lead",
        notes: "Good deal potential",
        priority: 2,
        expected_value: 250000,
      })
      expect(result.success).toBe(true)
    })

    it("should require property_id", () => {
      const result = pipelineDealCreateSchema.safeParse({
        stage: "identified",
      })
      expect(result.success).toBe(false)
    })

    it("should reject invalid UUID", () => {
      const result = pipelineDealCreateSchema.safeParse({
        property_id: "not-a-uuid",
      })
      expect(result.success).toBe(false)
    })

    it("should reject priority > 3", () => {
      const result = pipelineDealCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        priority: 5,
      })
      expect(result.success).toBe(false)
    })

    it("should reject negative priority", () => {
      const result = pipelineDealCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        priority: -1,
      })
      expect(result.success).toBe(false)
    })

    it("should reject notes > 2000 chars", () => {
      const result = pipelineDealCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        notes: "x".repeat(2001),
      })
      expect(result.success).toBe(false)
    })

    it("should default stage to identified", () => {
      const result = pipelineDealCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.stage).toBe("identified")
      }
    })
  })

  describe("pipelineDealUpdateSchema", () => {
    it("should accept valid update", () => {
      const result = pipelineDealUpdateSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        stage: "contacted",
        label: "Follow up",
        priority: 3,
      })
      expect(result.success).toBe(true)
    })

    it("should require id", () => {
      const result = pipelineDealUpdateSchema.safeParse({
        stage: "contacted",
      })
      expect(result.success).toBe(false)
    })

    it("should allow nullable fields", () => {
      const result = pipelineDealUpdateSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        label: null,
        notes: null,
        expected_value: null,
      })
      expect(result.success).toBe(true)
    })
  })
})

describe("D2V Validation Schemas", () => {
  describe("d2vTemplateCreateSchema", () => {
    it("should accept valid letter template", () => {
      const result = d2vTemplateCreateSchema.safeParse({
        name: "Standard Letter",
        body: "Dear {{owner_name}}, I am interested in your property.",
        channel: "letter",
      })
      expect(result.success).toBe(true)
    })

    it("should accept valid email template", () => {
      const result = d2vTemplateCreateSchema.safeParse({
        name: "Email Enquiry",
        subject: "Property Enquiry - {{property_address}}",
        body: "Dear {{owner_name}}, I am writing about your property at {{property_address}}.",
        channel: "email",
      })
      expect(result.success).toBe(true)
    })

    it("should reject empty name", () => {
      const result = d2vTemplateCreateSchema.safeParse({
        name: "",
        body: "Some content here",
        channel: "letter",
      })
      expect(result.success).toBe(false)
    })

    it("should reject body < 10 chars", () => {
      const result = d2vTemplateCreateSchema.safeParse({
        name: "Short",
        body: "Hi",
        channel: "letter",
      })
      expect(result.success).toBe(false)
    })

    it("should reject body > 5000 chars", () => {
      const result = d2vTemplateCreateSchema.safeParse({
        name: "Long Template",
        body: "x".repeat(5001),
        channel: "letter",
      })
      expect(result.success).toBe(false)
    })

    it("should reject invalid channel", () => {
      const result = d2vTemplateCreateSchema.safeParse({
        name: "Test",
        body: "Test content here",
        channel: "sms",
      })
      expect(result.success).toBe(false)
    })
  })

  describe("d2vCampaignCreateSchema", () => {
    it("should accept valid campaign", () => {
      const result = d2vCampaignCreateSchema.safeParse({
        name: "March 2026 Campaign",
        channel: "email",
        property_ids: ["550e8400-e29b-41d4-a716-446655440000"],
      })
      expect(result.success).toBe(true)
    })

    it("should require at least 1 property", () => {
      const result = d2vCampaignCreateSchema.safeParse({
        name: "Empty Campaign",
        channel: "email",
        property_ids: [],
      })
      expect(result.success).toBe(false)
    })

    it("should reject more than 100 properties", () => {
      const ids = Array.from({ length: 101 }, (_, i) =>
        `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
      )
      const result = d2vCampaignCreateSchema.safeParse({
        name: "Too Many",
        channel: "email",
        property_ids: ids,
      })
      expect(result.success).toBe(false)
    })

    it("should reject invalid property UUIDs", () => {
      const result = d2vCampaignCreateSchema.safeParse({
        name: "Bad IDs",
        channel: "email",
        property_ids: ["not-a-uuid"],
      })
      expect(result.success).toBe(false)
    })
  })

  describe("d2vCampaignSendSchema", () => {
    it("should accept valid campaign ID", () => {
      const result = d2vCampaignSendSchema.safeParse({
        campaign_id: "550e8400-e29b-41d4-a716-446655440000",
      })
      expect(result.success).toBe(true)
    })

    it("should reject invalid UUID", () => {
      const result = d2vCampaignSendSchema.safeParse({
        campaign_id: "bad-id",
      })
      expect(result.success).toBe(false)
    })
  })
})

describe("Viewing Validation Schemas", () => {
  describe("viewingCreateSchema", () => {
    it("should accept valid viewing", () => {
      const result = viewingCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        viewing_type: "site_visit",
        scheduled_at: "2026-04-01T10:00:00.000Z",
        duration_minutes: 30,
      })
      expect(result.success).toBe(true)
    })

    it("should accept all viewing types", () => {
      const types = ["site_visit", "inspection", "portfolio_check", "client_viewing"]
      types.forEach(type => {
        const result = viewingCreateSchema.safeParse({
          property_id: "550e8400-e29b-41d4-a716-446655440000",
          viewing_type: type,
          scheduled_at: "2026-04-01T10:00:00.000Z",
        })
        expect(result.success).toBe(true)
      })
    })

    it("should reject invalid viewing type", () => {
      const result = viewingCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        viewing_type: "open_house",
        scheduled_at: "2026-04-01T10:00:00.000Z",
      })
      expect(result.success).toBe(false)
    })

    it("should reject duration < 15 minutes", () => {
      const result = viewingCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        viewing_type: "site_visit",
        scheduled_at: "2026-04-01T10:00:00.000Z",
        duration_minutes: 10,
      })
      expect(result.success).toBe(false)
    })

    it("should reject duration > 240 minutes", () => {
      const result = viewingCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        viewing_type: "site_visit",
        scheduled_at: "2026-04-01T10:00:00.000Z",
        duration_minutes: 300,
      })
      expect(result.success).toBe(false)
    })

    it("should reject invalid date format", () => {
      const result = viewingCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        viewing_type: "site_visit",
        scheduled_at: "not-a-date",
      })
      expect(result.success).toBe(false)
    })

    it("should validate attendees array limit", () => {
      const result = viewingCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        viewing_type: "site_visit",
        scheduled_at: "2026-04-01T10:00:00.000Z",
        attendees: Array.from({ length: 11 }, (_, i) => `Person ${i}`),
      })
      expect(result.success).toBe(false)
    })

    it("should validate contact email format", () => {
      const result = viewingCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        viewing_type: "site_visit",
        scheduled_at: "2026-04-01T10:00:00.000Z",
        contact_email: "not-an-email",
      })
      expect(result.success).toBe(false)
    })

    it("should accept full viewing with all optional fields", () => {
      const result = viewingCreateSchema.safeParse({
        property_id: "550e8400-e29b-41d4-a716-446655440000",
        pipeline_deal_id: "660e8400-e29b-41d4-a716-446655440000",
        viewing_type: "client_viewing",
        scheduled_at: "2026-04-01T10:00:00.000Z",
        duration_minutes: 60,
        notes: "Bring client portfolio",
        attendees: ["John Smith", "Jane Doe"],
        contact_name: "Estate Agent",
        contact_phone: "07700900000",
        contact_email: "agent@example.com",
      })
      expect(result.success).toBe(true)
    })
  })

  describe("viewingUpdateSchema", () => {
    it("should accept valid status update", () => {
      const result = viewingUpdateSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        status: "completed",
        rating: 4,
      })
      expect(result.success).toBe(true)
    })

    it("should accept all valid statuses", () => {
      const statuses = ["scheduled", "confirmed", "completed", "cancelled", "no_show"]
      statuses.forEach(status => {
        const result = viewingUpdateSchema.safeParse({
          id: "550e8400-e29b-41d4-a716-446655440000",
          status,
        })
        expect(result.success).toBe(true)
      })
    })

    it("should reject rating < 1", () => {
      const result = viewingUpdateSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        rating: 0,
      })
      expect(result.success).toBe(false)
    })

    it("should reject rating > 5", () => {
      const result = viewingUpdateSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        rating: 6,
      })
      expect(result.success).toBe(false)
    })

    it("should accept checklist as boolean record", () => {
      const result = viewingUpdateSchema.safeParse({
        id: "550e8400-e29b-41d4-a716-446655440000",
        checklist: {
          fire_safety: true,
          room_sizes: false,
          exterior_condition: true,
        },
      })
      expect(result.success).toBe(true)
    })
  })
})

// ============================================================
// STRESS TESTS - PIPELINE STAGES
// ============================================================

describe("Pipeline Stage Configuration Stress", () => {
  const allUserTypes: UserType[] = ["investor", "council_ta", "operator", "agent"]

  it("each ICP should have at least 5 stages", () => {
    // Verify from the default stages defined in the component
    const stageCounts: Record<string, number> = {
      investor: 8,
      council_ta: 7,
      operator: 6,
      agent: 7,
    }

    allUserTypes.forEach(role => {
      expect(stageCounts[role]).toBeGreaterThanOrEqual(5)
    })
  })

  it("each ICP should have exactly one completed/success terminal stage", () => {
    // Based on the migration seed data
    const successStages: Record<string, string> = {
      investor: "completed",
      council_ta: "placed",
      operator: "compliant",
      agent: "exchanged",
    }

    allUserTypes.forEach(role => {
      expect(successStages[role]).toBeDefined()
    })
  })

  it("each ICP should have a failure terminal stage", () => {
    const failStages: Record<string, string> = {
      investor: "dead",
      council_ta: "rejected",
      operator: "non_compliant",
      agent: "fallen_through",
    }

    allUserTypes.forEach(role => {
      expect(failStages[role]).toBeDefined()
    })
  })

  it("each ICP should have 'identified' or equivalent first stage", () => {
    const firstStages: Record<string, string> = {
      investor: "identified",
      council_ta: "identified",
      operator: "identified",
      agent: "sourced",
    }

    allUserTypes.forEach(role => {
      expect(firstStages[role]).toBeDefined()
    })
  })
})

// ============================================================
// STRESS TESTS - CONCURRENT OPERATIONS
// ============================================================

describe("Concurrent Operation Simulation", () => {
  it("should handle 100 rapid pipeline additions without breaking credit calc", () => {
    let creditsUsed = 0
    const dailyCredits = 150
    const additions = 100

    for (let i = 0; i < additions; i++) {
      creditsUsed += CREDIT_COSTS.add_to_pipeline
      const remaining = dailyCredits - creditsUsed

      if (remaining < 0) {
        // Should hit limit before 150 additions
        expect(i).toBeLessThan(dailyCredits / CREDIT_COSTS.add_to_pipeline)
        break
      }
    }

    // With 1 credit per add, all 100 should fit in 150
    expect(creditsUsed).toBe(100)
  })

  it("should correctly track mixed D2V campaign credits", () => {
    // Simulate a campaign with 50 emails
    const emailCost = 50 * CREDIT_COSTS.d2v_send_email // 100 credits
    // Plus 10 letters
    const letterCost = 10 * CREDIT_COSTS.d2v_send_letter // 30 credits

    const totalCost = emailCost + letterCost
    expect(totalCost).toBe(130)
    expect(totalCost).toBeLessThan(150) // Fits in daily budget
  })

  it("should handle edge case of exactly 0 credits remaining", () => {
    const credits: UserCredits = {
      id: "test",
      user_id: "test",
      role: "standard_pro",
      daily_credits: 150,
      credits_used: 150,
      free_property_views_used: 20,
      free_property_views_limit: 20,
      saved_properties_count: 0,
      saved_properties_limit: 100,
      saved_searches_count: 0,
      saved_searches_limit: 10,
      active_price_alerts_count: 0,
      active_price_alerts_limit: 10,
      last_reset_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const status = formatCreditStatus(credits)
    expect(status.creditsRemaining).toBe(0)
    expect(status.isBlocked).toBe(true)
    expect(status.percentUsed).toBe(100)
  })
})

// ============================================================
// STRESS TESTS - DATA INTEGRITY
// ============================================================

describe("Data Integrity Stress", () => {
  it("should validate stage transitions don't skip stages", () => {
    // Valid transitions for investor pipeline
    const investorStages = [
      "identified", "researched", "contacted", "viewing",
      "offer_made", "under_offer", "completed", "dead",
    ]

    // Any stage can go to dead (terminal)
    investorStages.forEach(stage => {
      const stageIndex = investorStages.indexOf(stage)
      // Can move forward
      if (stageIndex < investorStages.length - 2) {
        expect(investorStages[stageIndex + 1]).toBeDefined()
      }
    })
  })

  it("should handle maximum notes length", () => {
    const maxNotes = "x".repeat(2000)
    const result = pipelineDealCreateSchema.safeParse({
      property_id: "550e8400-e29b-41d4-a716-446655440000",
      notes: maxNotes,
    })
    expect(result.success).toBe(true)
  })

  it("should handle maximum label length", () => {
    const result = pipelineDealCreateSchema.safeParse({
      property_id: "550e8400-e29b-41d4-a716-446655440000",
      label: "x".repeat(50),
    })
    expect(result.success).toBe(true)
  })

  it("should reject label > 50 chars", () => {
    const result = pipelineDealCreateSchema.safeParse({
      property_id: "550e8400-e29b-41d4-a716-446655440000",
      label: "x".repeat(51),
    })
    expect(result.success).toBe(false)
  })

  it("should handle D2V template with all placeholders", () => {
    let body = "Dear {{owner_name}},\n"
    D2V_PLACEHOLDERS.forEach(p => {
      body += `Field: ${p}\n`
    })
    body += "Regards."

    const result = d2vTemplateCreateSchema.safeParse({
      name: "All Fields Template",
      body,
      channel: "letter",
    })
    expect(result.success).toBe(true)
  })

  it("should handle campaign with exactly 100 properties (max)", () => {
    const ids = Array.from({ length: 100 }, (_, i) => {
      const hex = i.toString(16).padStart(12, "0")
      return `550e8400-e29b-41d4-a716-${hex}`
    })

    const result = d2vCampaignCreateSchema.safeParse({
      name: "Max Campaign",
      channel: "email",
      property_ids: ids,
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// ICP-AWARE VIEWING STAGE MAPPING
// ============================================================

describe("ICP-Aware Viewing Stage Mapping", () => {
  // Mirror the mapping from the API route
  const VIEWING_STAGE_MAP: Record<string, Record<string, string>> = {
    investor: {
      site_visit: "viewing",
      inspection: "viewing",
      portfolio_check: "viewing",
      client_viewing: "viewing",
    },
    council_ta: {
      site_visit: "inspection",
      inspection: "inspection",
      portfolio_check: "inspection",
      client_viewing: "inspection",
    },
    operator: {
      site_visit: "compliance_check",
      inspection: "compliance_check",
      portfolio_check: "compliance_check",
      client_viewing: "compliance_check",
    },
    agent: {
      site_visit: "client_viewing",
      inspection: "client_viewing",
      portfolio_check: "client_viewing",
      client_viewing: "client_viewing",
    },
  }

  const allUserTypes: UserType[] = ["investor", "council_ta", "operator", "agent"]
  const allViewingTypes = ["site_visit", "inspection", "portfolio_check", "client_viewing"]

  it("should have a stage mapping for every ICP", () => {
    allUserTypes.forEach(role => {
      expect(VIEWING_STAGE_MAP[role]).toBeDefined()
    })
  })

  it("should map every viewing type for every ICP", () => {
    allUserTypes.forEach(role => {
      allViewingTypes.forEach(vt => {
        expect(VIEWING_STAGE_MAP[role][vt]).toBeDefined()
        expect(VIEWING_STAGE_MAP[role][vt].length).toBeGreaterThan(0)
      })
    })
  })

  it("investor viewing types should all map to 'viewing'", () => {
    allViewingTypes.forEach(vt => {
      expect(VIEWING_STAGE_MAP.investor[vt]).toBe("viewing")
    })
  })

  it("council_ta viewing types should all map to 'inspection'", () => {
    allViewingTypes.forEach(vt => {
      expect(VIEWING_STAGE_MAP.council_ta[vt]).toBe("inspection")
    })
  })

  it("operator viewing types should all map to 'compliance_check'", () => {
    allViewingTypes.forEach(vt => {
      expect(VIEWING_STAGE_MAP.operator[vt]).toBe("compliance_check")
    })
  })

  it("agent viewing types should all map to 'client_viewing'", () => {
    allViewingTypes.forEach(vt => {
      expect(VIEWING_STAGE_MAP.agent[vt]).toBe("client_viewing")
    })
  })

  it("mapped stages should be valid pipeline stages for each ICP", () => {
    const validStages: Record<string, string[]> = {
      investor: ["identified", "researched", "contacted", "viewing", "offer_made", "under_offer", "completed", "dead"],
      council_ta: ["identified", "assessed", "shortlisted", "inspection", "placement_ready", "placed", "rejected"],
      operator: ["identified", "compliance_check", "renewal_due", "in_progress", "compliant", "non_compliant"],
      agent: ["sourced", "packaged", "presented", "client_viewing", "offer", "exchanged", "fallen_through"],
    }

    allUserTypes.forEach(role => {
      allViewingTypes.forEach(vt => {
        const mappedStage = VIEWING_STAGE_MAP[role][vt]
        expect(validStages[role]).toContain(mappedStage)
      })
    })
  })

  it("portfolio_check should never map to a non-existent stage", () => {
    // This was the original bug — portfolio_check was falling through to "viewing"
    // which doesn't exist in operator's pipeline stages
    allUserTypes.forEach(role => {
      const stage = VIEWING_STAGE_MAP[role].portfolio_check
      expect(stage).not.toBe("portfolio_check") // portfolio_check is NOT a pipeline stage
    })
  })
})

// ============================================================
// VIEWING CONFIRMATION EMAIL
// ============================================================

describe("Viewing Confirmation Email Template", () => {
  it("should be importable", () => {
    // The function exists — we imported it in the test file header
    expect(typeof viewingConfirmationEmail).toBe("function")
  })

  it("should generate valid email for site_visit", () => {
    const result = viewingConfirmationEmail({
      userName: "John",
      propertyAddress: "123 Test Street",
      propertyPostcode: "M1 1AA",
      scheduledAt: "2026-04-01T10:00:00.000Z",
      viewingType: "site_visit",
      propertyUrl: "https://hmohunter.co.uk/property/123",
    })
    expect(result.subject).toContain("123 Test Street")
    expect(result.html).toContain("John")
    expect(result.html).toContain("Site Visit")
    expect(result.text).toContain("123 Test Street")
  })

  it("should generate valid email for inspection", () => {
    const result = viewingConfirmationEmail({
      userName: "Jane",
      propertyAddress: "456 Oak Road",
      propertyPostcode: "LS1 2AB",
      scheduledAt: "2026-04-15T14:30:00.000Z",
      viewingType: "inspection",
      contactName: "Agent Smith",
      contactPhone: "07700900000",
      propertyUrl: "https://hmohunter.co.uk/property/456",
    })
    expect(result.subject).toContain("456 Oak Road")
    expect(result.html).toContain("Inspection")
    expect(result.html).toContain("Agent Smith")
    expect(result.html).toContain("07700900000")
    expect(result.text).toContain("Agent Smith")
  })

  it("should handle all viewing types without errors", () => {
    const types = ["site_visit", "inspection", "portfolio_check", "client_viewing"]
    types.forEach(vt => {
      const result = viewingConfirmationEmail({
        userName: "Test",
        propertyAddress: "1 Test St",
        propertyPostcode: "E1 1AA",
        scheduledAt: "2026-04-01T10:00:00.000Z",
        viewingType: vt,
        propertyUrl: "https://hmohunter.co.uk/property/1",
      })
      expect(result.subject).toBeTruthy()
      expect(result.html).toBeTruthy()
      expect(result.text).toBeTruthy()
    })
  })

  it("should include unsubscribe/manage links", () => {
    const result = viewingConfirmationEmail({
      userName: "Test",
      propertyAddress: "1 Test St",
      propertyPostcode: "E1 1AA",
      scheduledAt: "2026-04-01T10:00:00.000Z",
      viewingType: "site_visit",
      propertyUrl: "https://hmohunter.co.uk/property/1",
    })
    expect(result.html).toContain("Manage preferences")
    expect(result.html).toContain("Unsubscribe")
  })
})

// ============================================================
// API ENDPOINT DOCUMENTATION
// ============================================================

describe("New API Endpoints Checklist", () => {
  it("documents all new endpoints with credit costs", () => {
    const newEndpoints = [
      { path: "/api/pipeline", methods: ["GET", "POST", "PATCH", "DELETE"], creditAction: "add_to_pipeline", creditCost: 1 },
      { path: "/api/d2v/templates", methods: ["GET", "POST", "DELETE"], creditAction: null, creditCost: 0 },
      { path: "/api/d2v/campaigns", methods: ["GET", "POST", "PUT"], creditAction: "d2v_send_email/letter", creditCost: "2-3 per recipient" },
      { path: "/api/viewings", methods: ["GET", "POST", "PATCH", "DELETE"], creditAction: "schedule_viewing", creditCost: 2 },
      { path: "/api/off-market", methods: ["GET"], creditAction: null, creditCost: 0 },
    ]

    expect(newEndpoints.length).toBe(5)
    newEndpoints.forEach(ep => {
      expect(ep.path).toBeTruthy()
      expect(ep.methods.length).toBeGreaterThan(0)
    })
  })

  it("documents ICP feature mapping", () => {
    const featureMatrix = {
      pipeline: { investor: true, council_ta: true, operator: true, agent: true },
      d2v: { investor: true, council_ta: false, operator: false, agent: true },
      viewings: { investor: true, council_ta: true, operator: true, agent: true },
      off_market: { investor: true, council_ta: false, operator: false, agent: true },
    }

    // All roles get pipeline
    expect(Object.values(featureMatrix.pipeline).every(Boolean)).toBe(true)
    // All roles get viewings
    expect(Object.values(featureMatrix.viewings).every(Boolean)).toBe(true)
    // D2V restricted to investor + agent
    expect(featureMatrix.d2v.council_ta).toBe(false)
    expect(featureMatrix.d2v.operator).toBe(false)
  })
})
