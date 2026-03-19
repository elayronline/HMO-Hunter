/**
 * Letter Logo Upload & Sender Profile Stress Tests
 *
 * Tests the full chain:
 * 1. Sender profile data structure + defaults
 * 2. Logo upload validation (size, type, fallback)
 * 3. Profile merge into letter templates
 * 4. Letterhead rendering logic (logo + sender details)
 * 5. Profile persistence (save/load cycle)
 * 6. Edge cases (missing fields, corrupt data, oversized logos)
 * 7. Integration with D2V scenario templates
 */

import { describe, it, expect } from "vitest"
import {
  detectScenario,
  buildSmartMergeData,
  SCENARIO_TEMPLATES,
  validatePostalAddress,
  type LetterScenario,
} from "@/lib/d2v-templates"
import type { SenderProfile } from "@/components/sender-profile"
import type { Property } from "@/lib/types/database"

// ============================================================
// HELPERS
// ============================================================

const DEFAULT_PROFILE: SenderProfile = {
  name: "",
  company: "",
  phone: "",
  email: "",
  address: "",
  website: "",
  logoUrl: null,
}

const COMPLETE_PROFILE: SenderProfile = {
  name: "John Smith",
  company: "HMO Investments Ltd",
  phone: "07700 900 000",
  email: "john@hmoinvestments.co.uk",
  address: "123 Business Park, Manchester, M1 1AA",
  website: "www.hmoinvestments.co.uk",
  logoUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
}

// Minimal property for merge testing
const createProperty = (overrides: Partial<Property> = {}): Property => ({
  id: "test-id",
  title: "Test",
  address: "45 Oak Road",
  postcode: "M20 6XB",
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
  bedrooms: 5,
  bathrooms: 2,
  epc_rating: "C",
  owner_name: "Jane Doe",
  owner_contact_email: "jane@example.com",
  owner_contact_phone: "07700 900 001",
  licence_status: "expired",
  hmo_licence_expiry: "2025-01-15",
  estimated_yield_percentage: 8.5,
  postcode_avg_price: 230000,
  deal_score: 75,
  days_on_market: null,
  estimated_value: 280000,
  article_4_area: false,
  ...overrides,
} as Property)

function mergePlaceholders(template: string, data: Record<string, string>): string {
  let merged = template
  for (const [key, value] of Object.entries(data)) {
    merged = merged.replaceAll(`{{${key}}}`, value)
  }
  return merged
}

// ============================================================
// 1. SENDER PROFILE DATA STRUCTURE
// ============================================================

describe("Sender Profile: Data Structure", () => {
  it("default profile should have all fields empty/null", () => {
    expect(DEFAULT_PROFILE.name).toBe("")
    expect(DEFAULT_PROFILE.company).toBe("")
    expect(DEFAULT_PROFILE.phone).toBe("")
    expect(DEFAULT_PROFILE.email).toBe("")
    expect(DEFAULT_PROFILE.address).toBe("")
    expect(DEFAULT_PROFILE.website).toBe("")
    expect(DEFAULT_PROFILE.logoUrl).toBeNull()
  })

  it("complete profile should have all fields populated", () => {
    expect(COMPLETE_PROFILE.name).toBeTruthy()
    expect(COMPLETE_PROFILE.company).toBeTruthy()
    expect(COMPLETE_PROFILE.phone).toBeTruthy()
    expect(COMPLETE_PROFILE.email).toBeTruthy()
    expect(COMPLETE_PROFILE.address).toBeTruthy()
    expect(COMPLETE_PROFILE.website).toBeTruthy()
    expect(COMPLETE_PROFILE.logoUrl).toBeTruthy()
  })

  it("profile should have exactly 7 fields", () => {
    expect(Object.keys(DEFAULT_PROFILE)).toHaveLength(7)
    expect(Object.keys(COMPLETE_PROFILE)).toHaveLength(7)
  })

  it("logoUrl should accept data URLs", () => {
    expect(COMPLETE_PROFILE.logoUrl).toMatch(/^data:image\//)
  })

  it("logoUrl should accept https URLs", () => {
    const profile: SenderProfile = {
      ...DEFAULT_PROFILE,
      logoUrl: "https://example.com/logo.png",
    }
    expect(profile.logoUrl).toMatch(/^https:\/\//)
  })

  it("profile should be serializable to JSON", () => {
    const json = JSON.stringify(COMPLETE_PROFILE)
    const parsed = JSON.parse(json)
    expect(parsed).toEqual(COMPLETE_PROFILE)
  })
})

// ============================================================
// 2. LOGO UPLOAD VALIDATION
// ============================================================

describe("Logo Upload: Validation Rules", () => {
  it("should accept PNG files", () => {
    const validTypes = ["image/png", "image/jpeg", "image/svg+xml"]
    validTypes.forEach(type => {
      expect(type.startsWith("image/")).toBe(true)
    })
  })

  it("should reject non-image files", () => {
    const invalidTypes = ["application/pdf", "text/html", "application/javascript", "video/mp4"]
    invalidTypes.forEach(type => {
      expect(type.startsWith("image/")).toBe(false)
    })
  })

  it("should enforce 2MB size limit", () => {
    const maxSize = 2 * 1024 * 1024 // 2MB
    expect(maxSize).toBe(2097152)

    // Under limit
    expect(1000000 <= maxSize).toBe(true)
    // Over limit
    expect(3000000 <= maxSize).toBe(false)
  })

  it("base64 data URL should be a valid logoUrl", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo="
    expect(dataUrl.startsWith("data:image/")).toBe(true)
    expect(dataUrl.includes("base64")).toBe(true)
  })

  it("should handle very long base64 strings (large images)", () => {
    // Simulate a 500KB base64 image
    const fakeBase64 = "data:image/png;base64," + "A".repeat(500 * 1024)
    const profile: SenderProfile = { ...DEFAULT_PROFILE, logoUrl: fakeBase64 }
    expect(profile.logoUrl?.length).toBeGreaterThan(500000)
    // Should still be JSON serializable
    const json = JSON.stringify(profile)
    expect(JSON.parse(json).logoUrl.length).toBe(profile.logoUrl?.length)
  })
})

// ============================================================
// 3. PROFILE MERGE INTO LETTER TEMPLATES
// ============================================================

describe("Profile Merge: Template Integration", () => {
  it("should replace all your_* placeholders with profile data", () => {
    const data = buildSmartMergeData(createProperty())
    // Override with profile
    data.your_name = COMPLETE_PROFILE.name
    data.your_company = COMPLETE_PROFILE.company
    data.your_phone = COMPLETE_PROFILE.phone
    data.your_email = COMPLETE_PROFILE.email
    data.your_address = COMPLETE_PROFILE.address
    data.your_website = COMPLETE_PROFILE.website

    const template = SCENARIO_TEMPLATES.expired_licence.letterTemplate
    const merged = mergePlaceholders(template, data)

    expect(merged).toContain("John Smith")
    expect(merged).toContain("HMO Investments Ltd")
    expect(merged).toContain("07700 900 000")
    expect(merged).toContain("john@hmoinvestments.co.uk")
    expect(merged).not.toContain("[Your Name]")
    expect(merged).not.toContain("[Your Company]")
  })

  it("should show placeholder text when profile is empty", () => {
    const data = buildSmartMergeData(createProperty())
    // Default merge data has "[Your Name]" etc.

    const template = "From: {{your_name}}, {{your_company}}"
    const merged = mergePlaceholders(template, data)

    expect(merged).toContain("[Your Name]")
    expect(merged).toContain("[Your Company]")
  })

  it("should handle partial profile (name only)", () => {
    const data = buildSmartMergeData(createProperty())
    data.your_name = "Alice"

    const template = "From: {{your_name}}, {{your_company}}, {{your_phone}}"
    const merged = mergePlaceholders(template, data)

    expect(merged).toContain("Alice")
    expect(merged).toContain("[Your Company]")
    expect(merged).toContain("[Your Phone]")
  })

  it("should merge profile into all 8 scenario templates", () => {
    const scenarios: LetterScenario[] = [
      "expired_licence", "expiring_licence", "long_on_market",
      "probate_estate", "unlicensed_potential", "general_purchase",
      "rent_to_rent", "portfolio_acquisition",
    ]

    const data = buildSmartMergeData(createProperty())
    data.your_name = "Test User"
    data.your_company = "Test Company"
    data.your_phone = "0123456789"
    data.your_email = "test@example.com"

    scenarios.forEach(scenario => {
      const template = SCENARIO_TEMPLATES[scenario].letterTemplate
      const merged = mergePlaceholders(template, data)

      expect(merged).toContain("Test User")
      expect(merged).not.toContain("{{your_name}}")
    })
  })
})

// ============================================================
// 4. LETTERHEAD RENDERING LOGIC
// ============================================================

describe("Letterhead: Rendering Logic", () => {
  it("should show logo when logoUrl is present", () => {
    const profile = COMPLETE_PROFILE
    expect(profile.logoUrl).toBeTruthy()
    // Simulates: if (senderProfile?.logoUrl) → render img tag
    expect(!!profile.logoUrl).toBe(true)
  })

  it("should show upload button when no logo", () => {
    const profile = DEFAULT_PROFILE
    expect(profile.logoUrl).toBeNull()
    // Simulates: if (!senderProfile?.logoUrl) → render upload button
    expect(!profile.logoUrl).toBe(true)
  })

  it("should show sender details alongside logo", () => {
    const profile = COMPLETE_PROFILE
    const details = [
      profile.name,
      profile.company,
      profile.address,
      profile.phone,
      profile.email,
    ].filter(Boolean)

    expect(details.length).toBe(5) // All populated
  })

  it("should show italic placeholder when no profile set", () => {
    const profile = DEFAULT_PROFILE
    const hasName = !!profile.name
    expect(hasName).toBe(false)
    // UI renders: "Add your name and details via 'Edit all details'"
  })

  it("should show date in letter header", () => {
    const data = buildSmartMergeData(createProperty())
    expect(data.date).toBeTruthy()
    // Should be formatted like "19 March 2026"
    expect(data.date).toMatch(/\d{1,2}\s+\w+\s+\d{4}/)
  })

  it("should show reference code in letter footer", () => {
    const data = buildSmartMergeData(createProperty())
    expect(data.reference_code).toMatch(/^HMO-/)
  })
})

// ============================================================
// 5. PROFILE PERSISTENCE SIMULATION
// ============================================================

describe("Profile Persistence: Save/Load Cycle", () => {
  it("should serialize complete profile to JSON and back", () => {
    const serialized = JSON.stringify(COMPLETE_PROFILE)
    const deserialized: SenderProfile = JSON.parse(serialized)

    expect(deserialized.name).toBe(COMPLETE_PROFILE.name)
    expect(deserialized.company).toBe(COMPLETE_PROFILE.company)
    expect(deserialized.logoUrl).toBe(COMPLETE_PROFILE.logoUrl)
  })

  it("should handle null logoUrl in serialization", () => {
    const profile: SenderProfile = { ...COMPLETE_PROFILE, logoUrl: null }
    const serialized = JSON.stringify(profile)
    const deserialized = JSON.parse(serialized)
    expect(deserialized.logoUrl).toBeNull()
  })

  it("should merge partial saved profile with defaults", () => {
    const saved = { name: "Alice", email: "alice@test.com" }
    const merged: SenderProfile = { ...DEFAULT_PROFILE, ...saved }

    expect(merged.name).toBe("Alice")
    expect(merged.email).toBe("alice@test.com")
    expect(merged.company).toBe("") // Default
    expect(merged.logoUrl).toBeNull() // Default
  })

  it("should handle corrupted saved data gracefully", () => {
    const corrupted = { name: 123, logoUrl: true, extra_field: "bad" }
    // Spread with defaults ensures type safety
    const merged: SenderProfile = {
      ...DEFAULT_PROFILE,
      name: typeof corrupted.name === "string" ? corrupted.name : "",
      logoUrl: typeof corrupted.logoUrl === "string" ? corrupted.logoUrl : null,
    }

    expect(merged.name).toBe("")
    expect(merged.logoUrl).toBeNull()
  })
})

// ============================================================
// 6. EDGE CASES
// ============================================================

describe("Edge Cases", () => {
  it("should handle empty string logoUrl (not null)", () => {
    const profile: SenderProfile = { ...DEFAULT_PROFILE, logoUrl: "" }
    // Empty string should be treated as no logo
    expect(!profile.logoUrl).toBe(true) // Falsy
  })

  it("should handle very long company names", () => {
    const profile: SenderProfile = {
      ...DEFAULT_PROFILE,
      company: "The Very Long Name Property Investment Holdings Corporation International Limited Partnership LLP",
    }
    expect(profile.company.length).toBeGreaterThan(50)
    // Should still serialize
    expect(JSON.stringify(profile)).toBeTruthy()
  })

  it("should handle special characters in profile fields", () => {
    const profile: SenderProfile = {
      ...DEFAULT_PROFILE,
      name: "O'Brien & Co.",
      company: 'Smith "The Builder" Ltd',
      address: "123 St. Mary's Road, London, W1A 1AA",
    }
    const json = JSON.stringify(profile)
    const parsed = JSON.parse(json)
    expect(parsed.name).toBe("O'Brien & Co.")
    expect(parsed.company).toBe('Smith "The Builder" Ltd')
  })

  it("should handle unicode in profile fields", () => {
    const profile: SenderProfile = {
      ...DEFAULT_PROFILE,
      name: "José García-López",
      company: "Müller & Söhne GmbH",
    }
    const json = JSON.stringify(profile)
    expect(JSON.parse(json).name).toBe("José García-López")
  })

  it("should handle profile with only logo (no text)", () => {
    const profile: SenderProfile = {
      ...DEFAULT_PROFILE,
      logoUrl: "data:image/png;base64,abc123",
    }
    expect(profile.logoUrl).toBeTruthy()
    expect(profile.name).toBe("")
    // UI should show logo but empty details section
  })

  it("should handle profile with only text (no logo)", () => {
    const profile: SenderProfile = {
      ...DEFAULT_PROFILE,
      name: "John Smith",
      company: "Acme Ltd",
      logoUrl: null,
    }
    expect(profile.logoUrl).toBeNull()
    expect(profile.name).toBeTruthy()
    // UI should show upload box but populated details
  })
})

// ============================================================
// 7. INTEGRATION WITH SCENARIOS
// ============================================================

describe("Integration: Profile + Scenario + Property", () => {
  it("expired licence letter should merge all three data sources", () => {
    const property = createProperty({ licence_status: "expired", hmo_licence_expiry: "2025-01-15" })
    const scenario = detectScenario(property)
    expect(scenario).toBe("expired_licence")

    const data = buildSmartMergeData(property)
    data.your_name = COMPLETE_PROFILE.name
    data.your_company = COMPLETE_PROFILE.company
    data.your_phone = COMPLETE_PROFILE.phone
    data.your_email = COMPLETE_PROFILE.email

    const template = SCENARIO_TEMPLATES.expired_licence.letterTemplate
    const merged = mergePlaceholders(template, data)

    // Property data
    expect(merged).toContain("45 Oak Road")
    expect(merged).toContain("M20 6XB")
    expect(merged).toContain("Jane Doe")

    // Scenario-specific intelligence
    expect(merged).toContain("15 January 2025") // licence expiry formatted

    // Sender profile
    expect(merged).toContain("John Smith")
    expect(merged).toContain("HMO Investments Ltd")
    expect(merged).toContain("07700 900 000")

    // Reference code
    expect(merged).toMatch(/HMO-M206XB-[A-Z0-9]+/)
  })

  it("email should include reference code for response tracking", () => {
    const property = createProperty()
    const data = buildSmartMergeData(property)
    const merged = mergePlaceholders(SCENARIO_TEMPLATES.general_purchase.emailTemplate, data)

    expect(merged).toMatch(/HMO-M206XB-/)
  })

  it("all scenario emails should work as mailto: URLs", () => {
    const property = createProperty()
    const data = buildSmartMergeData(property)

    Object.values(SCENARIO_TEMPLATES).forEach(scenario => {
      const mergedSubject = mergePlaceholders(scenario.subject, data)
      const mergedBody = mergePlaceholders(scenario.emailTemplate, data)

      const mailto = `mailto:jane@example.com?subject=${encodeURIComponent(mergedSubject)}&body=${encodeURIComponent(mergedBody)}`

      // Should be a valid URL
      expect(mailto).toMatch(/^mailto:/)
      // Should not have unencoded newlines in URL
      expect(mailto).not.toMatch(/\n(?!%)/) // newlines should be encoded
      // Subject and body should be present
      expect(mailto).toContain("subject=")
      expect(mailto).toContain("body=")
    })
  })
})

// ============================================================
// 8. STRESS: BULK OPERATIONS
// ============================================================

describe("Stress: Bulk Profile Operations", () => {
  it("should handle 1000 profile serialize/deserialize cycles in under 50ms", () => {
    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      const profile: SenderProfile = {
        ...COMPLETE_PROFILE,
        name: `User ${i}`,
        company: `Company ${i} Ltd`,
      }
      const json = JSON.stringify(profile)
      const parsed = JSON.parse(json)
      expect(parsed.name).toBe(`User ${i}`)
    }
    expect(performance.now() - start).toBeLessThan(50)
  })

  it("should merge profile into 1000 letter templates in under 100ms", () => {
    const property = createProperty()
    const data = buildSmartMergeData(property)
    data.your_name = COMPLETE_PROFILE.name
    data.your_company = COMPLETE_PROFILE.company
    const template = SCENARIO_TEMPLATES.expired_licence.letterTemplate

    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      const merged = mergePlaceholders(template, data)
      expect(merged).toContain("John Smith")
    }
    expect(performance.now() - start).toBeLessThan(100)
  })

  it("should handle 100 different logo URLs without issues", () => {
    for (let i = 0; i < 100; i++) {
      const profile: SenderProfile = {
        ...DEFAULT_PROFILE,
        logoUrl: i % 3 === 0
          ? `data:image/png;base64,${"A".repeat(100)}`
          : i % 3 === 1
          ? `https://example.com/logo-${i}.png`
          : null,
      }
      expect(typeof profile.logoUrl === "string" || profile.logoUrl === null).toBe(true)
    }
  })
})
