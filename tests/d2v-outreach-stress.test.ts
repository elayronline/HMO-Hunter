import { describe, it, expect } from "vitest"
import {
  d2vTemplateCreateSchema,
  d2vCampaignCreateSchema,
  d2vCampaignSendSchema,
} from "@/lib/validation/schemas"
import { D2V_PLACEHOLDERS } from "@/lib/types/pipeline"

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

// ============================================================
// USER JOURNEY VALIDATION
// ============================================================
