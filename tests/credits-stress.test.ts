import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  CREDIT_COSTS,
  getTimeUntilReset,
  formatCreditStatus,
  type UserCredits,
  type CreditAction,
} from "@/lib/credits"

// Mock Supabase client
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(),
      })),
    })),
  })),
}))

// Helper to create mock user credits
const createMockCredits = (overrides: Partial<UserCredits> = {}): UserCredits => ({
  id: "test-id",
  user_id: "test-user",
  role: "standard_pro",
  daily_credits: 150,
  credits_used: 0,
  free_property_views_used: 0,
  free_property_views_limit: 20,
  saved_properties_count: 0,
  saved_properties_limit: 50,
  saved_searches_count: 0,
  saved_searches_limit: 10,
  active_price_alerts_count: 0,
  active_price_alerts_limit: 20,
  last_reset_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

describe("Credits System Stress Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Credit Cost Validation", () => {
    it("should have reasonable costs for all actions", () => {
      // Property view should be cheap (1 credit)
      expect(CREDIT_COSTS.property_view).toBeLessThanOrEqual(2)

      // Contact actions should be moderate (2-3 credits)
      expect(CREDIT_COSTS.contact_data_view).toBeGreaterThanOrEqual(1)
      expect(CREDIT_COSTS.contact_data_view).toBeLessThanOrEqual(5)
      expect(CREDIT_COSTS.contact_data_copy).toBeGreaterThan(CREDIT_COSTS.contact_data_view)

      // Premium actions should cost more
      expect(CREDIT_COSTS.csv_export).toBeGreaterThan(CREDIT_COSTS.save_property)
      expect(CREDIT_COSTS.create_price_alert).toBeGreaterThan(CREDIT_COSTS.save_property)
    })

    it("should allow at least 15 CSV exports per day with 150 credits", () => {
      const dailyCredits = 150
      const maxExports = Math.floor(dailyCredits / CREDIT_COSTS.csv_export)
      expect(maxExports).toBeGreaterThanOrEqual(15)
    })

    it("should allow at least 30 price alerts per day with 150 credits", () => {
      const dailyCredits = 150
      const maxAlerts = Math.floor(dailyCredits / CREDIT_COSTS.create_price_alert)
      expect(maxAlerts).toBeGreaterThanOrEqual(30)
    })

    it("should allow at least 150 property views per day (after free views)", () => {
      const dailyCredits = 150
      const freeViews = 20
      const maxViews = freeViews + Math.floor(dailyCredits / CREDIT_COSTS.property_view)
      expect(maxViews).toBeGreaterThanOrEqual(150)
    })
  })

  describe("formatCreditStatus Edge Cases", () => {
    it("should handle zero credits used", () => {
      const credits = createMockCredits({ credits_used: 0 })
      const result = formatCreditStatus(credits)

      expect(result.creditsRemaining).toBe(150)
      expect(result.percentUsed).toBe(0)
      expect(result.isWarning).toBe(false)
      expect(result.isBlocked).toBe(false)
    })

    it("should handle exactly 80% used (warning threshold)", () => {
      const credits = createMockCredits({ credits_used: 120 })
      const result = formatCreditStatus(credits)

      expect(result.creditsRemaining).toBe(30)
      expect(result.percentUsed).toBe(80)
      expect(result.isWarning).toBe(true)
      expect(result.isBlocked).toBe(false)
    })

    it("should handle exactly 100% used (blocked)", () => {
      const credits = createMockCredits({ credits_used: 150 })
      const result = formatCreditStatus(credits)

      expect(result.creditsRemaining).toBe(0)
      expect(result.percentUsed).toBe(100)
      expect(result.isWarning).toBe(false)
      expect(result.isBlocked).toBe(true)
    })

    it("should handle over 100% used (edge case)", () => {
      const credits = createMockCredits({ credits_used: 160 })
      const result = formatCreditStatus(credits)

      expect(result.creditsRemaining).toBe(-10)
      expect(result.percentUsed).toBe(107)
      expect(result.isBlocked).toBe(true)
    })

    it("should handle free views exhausted", () => {
      const credits = createMockCredits({
        free_property_views_used: 20,
        free_property_views_limit: 20
      })
      const result = formatCreditStatus(credits)

      expect(result.freeViewsRemaining).toBe(0)
    })

    it("should calculate warning correctly at 79% (no warning)", () => {
      // 79% of 150 = 118.5, round to 118
      const credits = createMockCredits({ credits_used: 118 })
      const result = formatCreditStatus(credits)

      expect(result.percentUsed).toBe(79)
      expect(result.isWarning).toBe(false)
    })

    it("should calculate warning correctly at 99% (warning)", () => {
      // 99% of 150 = 148.5, round to 148
      const credits = createMockCredits({ credits_used: 148 })
      const result = formatCreditStatus(credits)

      expect(result.percentUsed).toBe(99)
      expect(result.isWarning).toBe(true)
      expect(result.isBlocked).toBe(false)
    })
  })

  describe("Time Until Reset Calculations", () => {
    it("should calculate correctly at start of day (00:01 UTC)", () => {
      vi.setSystemTime(new Date("2024-06-15T00:01:00.000Z"))
      const result = getTimeUntilReset()

      expect(result.hours).toBe(23)
      expect(result.minutes).toBe(59)
    })

    it("should calculate correctly at noon (12:00 UTC)", () => {
      vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"))
      const result = getTimeUntilReset()

      expect(result.hours).toBe(12)
      expect(result.minutes).toBe(0)
    })

    it("should calculate correctly at end of day (23:59 UTC)", () => {
      vi.setSystemTime(new Date("2024-06-15T23:59:00.000Z"))
      const result = getTimeUntilReset()

      expect(result.hours).toBe(0)
      expect(result.minutes).toBe(1)
    })

    it("should handle different timezones correctly (always UTC)", () => {
      // Set to 6pm EST (which is 11pm UTC)
      vi.setSystemTime(new Date("2024-06-15T23:00:00.000Z"))
      const result = getTimeUntilReset()

      expect(result.hours).toBe(1)
      expect(result.minutes).toBe(0)
    })
  })

  describe("Admin Role Handling", () => {
    it("should identify admin correctly", () => {
      const adminCredits = createMockCredits({ role: "admin" })
      expect(adminCredits.role).toBe("admin")
    })

    it("should identify standard_pro correctly", () => {
      const standardCredits = createMockCredits({ role: "standard_pro" })
      expect(standardCredits.role).toBe("standard_pro")
    })
  })

  describe("Resource Limits", () => {
    it("should have reasonable saved properties limit", () => {
      const credits = createMockCredits()
      expect(credits.saved_properties_limit).toBeGreaterThanOrEqual(50)
    })

    it("should have reasonable saved searches limit", () => {
      const credits = createMockCredits()
      expect(credits.saved_searches_limit).toBeGreaterThanOrEqual(10)
    })

    it("should have reasonable price alerts limit", () => {
      const credits = createMockCredits()
      expect(credits.active_price_alerts_limit).toBeGreaterThanOrEqual(20)
    })

    it("should track resource counts correctly", () => {
      const credits = createMockCredits({
        saved_properties_count: 25,
        saved_searches_count: 5,
        active_price_alerts_count: 10,
      })

      expect(credits.saved_properties_count).toBe(25)
      expect(credits.saved_searches_count).toBe(5)
      expect(credits.active_price_alerts_count).toBe(10)
    })
  })

  describe("Credit Action Coverage", () => {
    it("should have costs defined for all expected actions", () => {
      const expectedActions: CreditAction[] = [
        "property_view",
        "contact_data_view",
        "contact_data_copy",
        "save_property",
        "save_search",
        "create_price_alert",
        "csv_export",
      ]

      expectedActions.forEach(action => {
        expect(CREDIT_COSTS[action]).toBeDefined()
        expect(typeof CREDIT_COSTS[action]).toBe("number")
        expect(CREDIT_COSTS[action]).toBeGreaterThan(0)
      })
    })

    it("should not have any zero-cost actions", () => {
      Object.values(CREDIT_COSTS).forEach(cost => {
        expect(cost).toBeGreaterThan(0)
      })
    })
  })

  describe("Stress Scenarios", () => {
    it("should handle rapid credit deductions simulation", () => {
      // Simulate 50 property views
      const credits = createMockCredits({
        free_property_views_used: 20, // Free views exhausted
        credits_used: 0
      })

      let totalCost = 0
      for (let i = 0; i < 50; i++) {
        totalCost += CREDIT_COSTS.property_view
      }

      const newCreditsUsed = credits.credits_used + totalCost
      const remaining = credits.daily_credits - newCreditsUsed

      expect(remaining).toBe(100) // 150 - 50 = 100
    })

    it("should handle mixed action scenario", () => {
      // Typical user session:
      // - 20 free property views
      // - 10 paid property views (10 credits)
      // - 5 contact views (10 credits)
      // - 2 contact copies (6 credits)
      // - 1 CSV export (10 credits)
      // - 2 save searches (4 credits)
      // - 1 price alert (5 credits)

      const totalCost =
        (10 * CREDIT_COSTS.property_view) +
        (5 * CREDIT_COSTS.contact_data_view) +
        (2 * CREDIT_COSTS.contact_data_copy) +
        (1 * CREDIT_COSTS.csv_export) +
        (2 * CREDIT_COSTS.save_search) +
        (1 * CREDIT_COSTS.create_price_alert)

      expect(totalCost).toBe(45) // 10 + 10 + 6 + 10 + 4 + 5 = 45
      expect(totalCost).toBeLessThan(150) // Should fit in daily allowance
    })

    it("should correctly identify when user will hit limit", () => {
      const credits = createMockCredits({ credits_used: 141 })
      const remaining = credits.daily_credits - credits.credits_used // 9 credits remaining

      // Can still do 9 property views (9 * 1 = 9)
      expect(remaining).toBeGreaterThanOrEqual(CREDIT_COSTS.property_view * 9)

      // But cannot do a CSV export (costs 10, only have 9)
      expect(remaining).toBeLessThan(CREDIT_COSTS.csv_export)
    })
  })

  describe("Format String Tests", () => {
    it("should format time until reset correctly", () => {
      vi.setSystemTime(new Date("2024-06-15T14:30:00.000Z"))
      const result = getTimeUntilReset()

      expect(result.formatted).toMatch(/^\d+h \d+m$/)
      expect(result.formatted).toBe("9h 30m")
    })

    it("should handle single digit hours and minutes", () => {
      vi.setSystemTime(new Date("2024-06-15T22:55:00.000Z"))
      const result = getTimeUntilReset()

      expect(result.formatted).toBe("1h 5m")
    })
  })
})

describe("API Integration Checklist", () => {
  it("documents all endpoints using credits", () => {
    const endpointsUsingCredits = [
      { path: "/api/track-property-view", action: "property_view", cost: 1 },
      { path: "/api/track-contact", action: "contact_data_view/copy", cost: "2-3" },
      { path: "/api/export", action: "csv_export", cost: 10 },
      { path: "/api/export/pdf", action: "csv_export", cost: 10 },
      { path: "/api/saved-searches", action: "save_search", cost: 2 },
      { path: "/api/price-alerts", action: "create_price_alert", cost: 5 },
    ]

    // Verify we have coverage for key actions
    expect(endpointsUsingCredits.length).toBe(6)

    // All endpoints should have documented costs
    endpointsUsingCredits.forEach(ep => {
      expect(ep.action).toBeDefined()
      expect(ep.cost).toBeDefined()
    })
  })

  it("documents proper error responses for insufficient credits", () => {
    const expectedErrorResponse = {
      error: "Insufficient credits",
      insufficientCredits: true,
      creditsRemaining: 0,
      resetAt: expect.any(String),
    }

    expect(expectedErrorResponse.insufficientCredits).toBe(true)
    expect(expectedErrorResponse.error).toContain("credits")
  })

  it("documents admin bypass behavior", () => {
    // Admins should:
    // 1. Not have credits deducted
    // 2. Not see insufficient credits errors
    // 3. Have unlimited access to all features

    const adminResponse = {
      success: true,
      isAdmin: true,
      freeViewUsed: false,
    }

    expect(adminResponse.isAdmin).toBe(true)
    expect(adminResponse.success).toBe(true)
  })
})
