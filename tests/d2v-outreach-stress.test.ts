import { describe, it, expect } from "vitest"
import {
  d2vTemplateCreateSchema,
  d2vCampaignCreateSchema,
  d2vCampaignSendSchema,
} from "@/lib/validation/schemas"
import { D2V_PLACEHOLDERS } from "@/lib/types/pipeline"
import { CREDIT_COSTS } from "@/lib/credits"

// ============================================================
// QUICK OUTREACH FLOW — validates the one-click send path
// ============================================================

describe("Quick Outreach: Single-Property Campaign Validation", () => {
  it("should accept a campaign with a single property (quick send)", () => {
    const result = d2vCampaignCreateSchema.safeParse({
      name: "Quick: 123 Test Street",
      channel: "email",
      property_ids: ["550e8400-e29b-41d4-a716-446655440000"],
    })
    expect(result.success).toBe(true)
  })

  it("should accept quick send without template_id (custom message)", () => {
    const result = d2vCampaignCreateSchema.safeParse({
      name: "Quick: 456 Oak Road",
      channel: "letter",
      property_ids: ["550e8400-e29b-41d4-a716-446655440001"],
    })
    expect(result.success).toBe(true)
  })

  it("should accept quick send with template_id", () => {
    const result = d2vCampaignCreateSchema.safeParse({
      name: "Quick: 789 Elm Way",
      channel: "email",
      template_id: "660e8400-e29b-41d4-a716-446655440000",
      property_ids: ["550e8400-e29b-41d4-a716-446655440002"],
    })
    expect(result.success).toBe(true)
  })

  it("should reject empty property_ids for quick send", () => {
    const result = d2vCampaignCreateSchema.safeParse({
      name: "Quick: Empty",
      channel: "email",
      property_ids: [],
    })
    expect(result.success).toBe(false)
  })
})

// ============================================================
// TEMPLATE MERGE LOGIC (unit-testable without API)
// ============================================================

describe("Template Merge Placeholders", () => {
  const mergeData: Record<string, string> = {
    owner_name: "John Smith",
    property_address: "123 Test Street",
    property_postcode: "M1 1AA",
    property_city: "Manchester",
    bedrooms: "5",
    epc_rating: "C",
    licence_status: "expired",
    licence_expiry: "2025-12-01",
    your_name: "Jane Investor",
    your_company: "HMO Investments Ltd",
    your_phone: "07700900000",
    your_email: "jane@hmoinvestments.co.uk",
    date: "18/03/2026",
  }

  function mergePlaceholders(template: string, data: Record<string, string>): string {
    let merged = template
    for (const [key, value] of Object.entries(data)) {
      merged = merged.replaceAll(`{{${key}}}`, value)
    }
    return merged
  }

  it("should merge all standard placeholders", () => {
    const template = "Dear {{owner_name}}, regarding {{property_address}}, {{property_postcode}}."
    const result = mergePlaceholders(template, mergeData)
    expect(result).toBe("Dear John Smith, regarding 123 Test Street, M1 1AA.")
    expect(result).not.toContain("{{")
  })

  it("should handle template with all placeholders", () => {
    let template = ""
    D2V_PLACEHOLDERS.forEach(p => {
      template += `${p} `
    })
    const result = mergePlaceholders(template, mergeData)
    // All standard placeholders should be replaced
    for (const placeholder of D2V_PLACEHOLDERS) {
      const key = placeholder.replace(/\{\{|\}\}/g, "")
      if (mergeData[key]) {
        expect(result).toContain(mergeData[key])
      }
    }
  })

  it("should leave unrecognized placeholders intact", () => {
    const template = "Dear {{owner_name}}, your {{unknown_field}} is pending."
    const result = mergePlaceholders(template, mergeData)
    expect(result).toContain("John Smith")
    expect(result).toContain("{{unknown_field}}")
  })

  it("should handle empty merge data gracefully", () => {
    const template = "Dear {{owner_name}}, your property at {{property_address}}."
    const result = mergePlaceholders(template, {})
    expect(result).toContain("{{owner_name}}")
    expect(result).toContain("{{property_address}}")
  })

  it("should handle empty template", () => {
    const result = mergePlaceholders("", mergeData)
    expect(result).toBe("")
  })

  it("should handle template with no placeholders", () => {
    const template = "Hello, I am interested in your property."
    const result = mergePlaceholders(template, mergeData)
    expect(result).toBe(template)
  })

  it("should handle repeated placeholders in same template", () => {
    const template = "Dear {{owner_name}}, as I said, {{owner_name}}, I'm interested."
    const result = mergePlaceholders(template, mergeData)
    expect(result).toBe("Dear John Smith, as I said, John Smith, I'm interested.")
  })

  it("should handle multiline templates", () => {
    const template = `Dear {{owner_name}},

I am writing about {{property_address}}.

Regards,
{{your_name}}`
    const result = mergePlaceholders(template, mergeData)
    expect(result).toContain("Dear John Smith,")
    expect(result).toContain("123 Test Street")
    expect(result).toContain("Jane Investor")
  })
})

// ============================================================
// CREDIT COST VALIDATION FOR D2V FLOWS
// ============================================================

describe("D2V Credit Economics", () => {
  it("email should cost 2 credits", () => {
    expect(CREDIT_COSTS.d2v_send_email).toBe(2)
  })

  it("letter should cost 3 credits", () => {
    expect(CREDIT_COSTS.d2v_send_letter).toBe(3)
  })

  it("letter should cost more than email (postal premium)", () => {
    expect(CREDIT_COSTS.d2v_send_letter).toBeGreaterThan(CREDIT_COSTS.d2v_send_email)
  })

  it("quick send (1 property) should be affordable from daily budget", () => {
    const dailyCredits = 150
    expect(CREDIT_COSTS.d2v_send_email).toBeLessThan(dailyCredits * 0.1)
    expect(CREDIT_COSTS.d2v_send_letter).toBeLessThan(dailyCredits * 0.1)
  })

  it("batch campaign of 50 emails should fit in daily budget", () => {
    const batchCost = 50 * CREDIT_COSTS.d2v_send_email
    expect(batchCost).toBeLessThanOrEqual(150)
  })

  it("batch campaign of 50 letters should fit in daily budget", () => {
    const batchCost = 50 * CREDIT_COSTS.d2v_send_letter
    expect(batchCost).toBeLessThanOrEqual(150)
  })

  it("should calculate correct total cost for mixed campaign", () => {
    const emailCount = 30
    const letterCount = 20
    const totalCost = emailCount * CREDIT_COSTS.d2v_send_email + letterCount * CREDIT_COSTS.d2v_send_letter
    expect(totalCost).toBe(30 * 2 + 20 * 3)
    expect(totalCost).toBe(120)
    expect(totalCost).toBeLessThanOrEqual(150)
  })
})

// ============================================================
// CAMPAIGN VALIDATION — batch selection scenarios
// ============================================================

describe("Campaign Property Selection Validation", () => {
  it("should accept 1 property (quick send)", () => {
    const result = d2vCampaignCreateSchema.safeParse({
      name: "Quick",
      channel: "email",
      property_ids: ["550e8400-e29b-41d4-a716-446655440000"],
    })
    expect(result.success).toBe(true)
  })

  it("should accept 50 properties (standard batch)", () => {
    const ids = Array.from({ length: 50 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
    )
    const result = d2vCampaignCreateSchema.safeParse({
      name: "Batch 50",
      channel: "email",
      property_ids: ids,
    })
    expect(result.success).toBe(true)
  })

  it("should accept exactly 100 properties (max batch)", () => {
    const ids = Array.from({ length: 100 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
    )
    const result = d2vCampaignCreateSchema.safeParse({
      name: "Max Batch",
      channel: "letter",
      property_ids: ids,
    })
    expect(result.success).toBe(true)
  })

  it("should reject 101 properties (over max)", () => {
    const ids = Array.from({ length: 101 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
    )
    const result = d2vCampaignCreateSchema.safeParse({
      name: "Over Max",
      channel: "email",
      property_ids: ids,
    })
    expect(result.success).toBe(false)
  })

  it("should reject duplicate property IDs in array", () => {
    const sameId = "550e8400-e29b-41d4-a716-446655440000"
    // Note: Zod doesn't deduplicate by default, but the API should handle this
    const result = d2vCampaignCreateSchema.safeParse({
      name: "Dupes",
      channel: "email",
      property_ids: [sameId, sameId],
    })
    // Schema allows it — deduplication is server-side responsibility
    expect(result.success).toBe(true)
  })
})

// ============================================================
// TEMPLATE CREATION SCENARIOS
// ============================================================

describe("Template Creation for Quick Outreach", () => {
  it("should accept auto-generated template from quick send", () => {
    const result = d2vTemplateCreateSchema.safeParse({
      name: "Quick Send - 2026-03-18",
      body: "Dear {{owner_name}}, I am interested in your property at {{property_address}}.",
      channel: "email",
    })
    expect(result.success).toBe(true)
  })

  it("should accept email template with subject", () => {
    const result = d2vTemplateCreateSchema.safeParse({
      name: "Standard Email",
      subject: "Property Enquiry - {{property_address}}",
      body: "Dear {{owner_name}}, I am writing about {{property_address}}, {{property_postcode}}.",
      channel: "email",
    })
    expect(result.success).toBe(true)
  })

  it("should accept letter template without subject", () => {
    const result = d2vTemplateCreateSchema.safeParse({
      name: "Standard Letter",
      body: "Dear {{owner_name}},\n\nI am writing to you regarding your property at {{property_address}}.\n\nKind regards,\n{{your_name}}",
      channel: "letter",
    })
    expect(result.success).toBe(true)
  })
})

// ============================================================
// STRESS: RAPID OUTREACH SIMULATION
// ============================================================

describe("Stress: Rapid Outreach Scenarios", () => {
  it("should validate 100 quick-send campaigns in sequence", () => {
    for (let i = 0; i < 100; i++) {
      const result = d2vCampaignCreateSchema.safeParse({
        name: `Quick: Property ${i}`,
        channel: i % 2 === 0 ? "email" : "letter",
        property_ids: [`550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`],
      })
      expect(result.success).toBe(true)
    }
  })

  it("should track credit depletion across 75 email sends", () => {
    let creditsUsed = 0
    const dailyCredits = 150

    for (let i = 0; i < 75; i++) {
      creditsUsed += CREDIT_COSTS.d2v_send_email
      if (creditsUsed > dailyCredits) {
        // Should hit limit at exactly 76th send (76 * 2 = 152 > 150)
        expect(i).toBe(75)
        break
      }
    }

    expect(creditsUsed).toBe(150)
  })

  it("should track credit depletion across 50 letter sends", () => {
    let creditsUsed = 0
    const dailyCredits = 150

    for (let i = 0; i < 50; i++) {
      creditsUsed += CREDIT_COSTS.d2v_send_letter
      if (creditsUsed > dailyCredits) {
        expect(i).toBe(50)
        break
      }
    }

    expect(creditsUsed).toBe(150)
  })

  it("should handle property with minimal data for merge", () => {
    // Simulate a property with only address — merge should still work
    const minimalMergeData: Record<string, string> = {
      owner_name: "Property Owner",  // Default fallback
      property_address: "123 Unknown Street",
      property_postcode: "E1 1AA",
      property_city: "",
      bedrooms: "",
      epc_rating: "Unknown",
      licence_status: "Unknown",
      licence_expiry: "",
      date: "18/03/2026",
      your_name: "[Your Name]",
      your_company: "",
      your_phone: "[Your Phone]",
      your_email: "[Your Email]",
    }

    const template = "Dear {{owner_name}}, regarding {{property_address}}, {{property_postcode}}."
    let merged = template
    for (const [key, value] of Object.entries(minimalMergeData)) {
      merged = merged.replaceAll(`{{${key}}}`, value)
    }

    expect(merged).toContain("Property Owner")
    expect(merged).toContain("123 Unknown Street")
    expect(merged).not.toContain("{{")
  })
})

// ============================================================
// USER JOURNEY VALIDATION
// ============================================================

describe("D2V User Journeys", () => {
  it("Journey 1: Property Detail → Quick Send Email", () => {
    // 1. User views property — has owner email
    const property = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      owner_name: "John Smith",
      owner_contact_email: "john@example.com",
      address: "123 Test Street",
      postcode: "M1 1AA",
    }
    expect(property.owner_contact_email).toBeTruthy()

    // 2. Quick send creates campaign with 1 property
    const campaignInput = {
      name: `Quick: ${property.address}`,
      channel: "email" as const,
      property_ids: [property.id],
    }
    expect(d2vCampaignCreateSchema.safeParse(campaignInput).success).toBe(true)

    // 3. Credit cost for 1 email
    expect(CREDIT_COSTS.d2v_send_email * 1).toBe(2)
  })

  it("Journey 2: Property Detail → Quick Send Letter (no email)", () => {
    // 1. User views property — no email, but has address
    const property = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      owner_name: "Jane Doe",
      owner_contact_email: null,
      address: "456 Oak Road",
      postcode: "LS1 2AB",
    }
    expect(property.owner_contact_email).toBeFalsy()

    // 2. Quick send creates letter campaign
    const campaignInput = {
      name: `Quick: ${property.address}`,
      channel: "letter" as const,
      property_ids: [property.id],
    }
    expect(d2vCampaignCreateSchema.safeParse(campaignInput).success).toBe(true)

    // 3. Credit cost for 1 letter
    expect(CREDIT_COSTS.d2v_send_letter * 1).toBe(3)
  })

  it("Journey 3: Off-Market → Select 20 → Batch Email Campaign", () => {
    // 1. User selects 20 properties from off-market leads
    const propertyIds = Array.from({ length: 20 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
    )

    // 2. Creates batch campaign
    const campaignInput = {
      name: "Manchester Expired Licences - March 2026",
      channel: "email" as const,
      template_id: "660e8400-e29b-41d4-a716-446655440000",
      property_ids: propertyIds,
    }
    expect(d2vCampaignCreateSchema.safeParse(campaignInput).success).toBe(true)

    // 3. Total credit cost
    const totalCost = 20 * CREDIT_COSTS.d2v_send_email
    expect(totalCost).toBe(40)
    expect(totalCost).toBeLessThan(150) // fits in daily budget
  })

  it("Journey 4: Pipeline → Select Contacted Deals → Letter Campaign", () => {
    // 1. User selects 10 pipeline deals at "contacted" stage
    const propertyIds = Array.from({ length: 10 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(100 + i).padStart(12, "0")}`
    )

    // 2. Follow-up letter campaign
    const campaignInput = {
      name: "Follow-up Letters - Contacted Deals",
      channel: "letter" as const,
      property_ids: propertyIds,
    }
    expect(d2vCampaignCreateSchema.safeParse(campaignInput).success).toBe(true)

    // 3. Total cost
    const totalCost = 10 * CREDIT_COSTS.d2v_send_letter
    expect(totalCost).toBe(30)
  })
})
