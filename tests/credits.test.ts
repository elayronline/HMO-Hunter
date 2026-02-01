import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  CREDIT_COSTS,
  getTimeUntilReset,
  formatCreditStatus,
  type UserCredits,
} from "@/lib/credits"

describe("CREDIT_COSTS", () => {
  it("should have correct costs for all actions", () => {
    expect(CREDIT_COSTS.property_view).toBe(1)
    expect(CREDIT_COSTS.contact_data_view).toBe(2)
    expect(CREDIT_COSTS.contact_data_copy).toBe(3)
    expect(CREDIT_COSTS.save_property).toBe(1)
    expect(CREDIT_COSTS.save_search).toBe(2)
    expect(CREDIT_COSTS.create_price_alert).toBe(5)
    expect(CREDIT_COSTS.csv_export).toBe(10)
  })

  it("should have all expected action types", () => {
    const expectedActions = [
      "property_view",
      "contact_data_view",
      "contact_data_copy",
      "save_property",
      "save_search",
      "create_price_alert",
      "csv_export",
    ]
    expect(Object.keys(CREDIT_COSTS)).toEqual(expectedActions)
  })
})

describe("getTimeUntilReset", () => {
  it("should return hours and minutes until midnight UTC", () => {
    const result = getTimeUntilReset()

    expect(result).toHaveProperty("hours")
    expect(result).toHaveProperty("minutes")
    expect(result).toHaveProperty("formatted")

    // Hours should be between 0-23
    expect(result.hours).toBeGreaterThanOrEqual(0)
    expect(result.hours).toBeLessThanOrEqual(23)

    // Minutes should be between 0-59
    expect(result.minutes).toBeGreaterThanOrEqual(0)
    expect(result.minutes).toBeLessThanOrEqual(59)
  })

  it("should return formatted string", () => {
    const result = getTimeUntilReset()
    expect(result.formatted).toMatch(/^\d+h \d+m$/)
  })

  it("should calculate time correctly", () => {
    // Mock a specific time to test calculation
    const mockDate = new Date("2024-01-15T14:30:00.000Z")
    vi.setSystemTime(mockDate)

    const result = getTimeUntilReset()

    // At 14:30 UTC, we have 9 hours 30 minutes until midnight
    expect(result.hours).toBe(9)
    // Allow for rounding differences (29 or 30 minutes depending on millisecond precision)
    expect(result.minutes).toBeGreaterThanOrEqual(29)
    expect(result.minutes).toBeLessThanOrEqual(30)

    vi.useRealTimers()
  })
})

describe("formatCreditStatus", () => {
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

  it("should calculate credits remaining correctly", () => {
    const credits = createMockCredits({ credits_used: 50 })
    const result = formatCreditStatus(credits)

    expect(result.creditsRemaining).toBe(100)
    expect(result.creditsTotal).toBe(150)
  })

  it("should calculate percent used correctly", () => {
    const credits = createMockCredits({ credits_used: 75 })
    const result = formatCreditStatus(credits)

    expect(result.percentUsed).toBe(50)
  })

  it("should show warning when 80% or more used", () => {
    const credits = createMockCredits({ credits_used: 120 }) // 80% used
    const result = formatCreditStatus(credits)

    expect(result.isWarning).toBe(true)
    expect(result.isBlocked).toBe(false)
  })

  it("should show blocked when 100% used", () => {
    const credits = createMockCredits({ credits_used: 150 })
    const result = formatCreditStatus(credits)

    expect(result.isWarning).toBe(false)
    expect(result.isBlocked).toBe(true)
  })

  it("should not show warning when less than 80% used", () => {
    const credits = createMockCredits({ credits_used: 100 }) // 66% used
    const result = formatCreditStatus(credits)

    expect(result.isWarning).toBe(false)
    expect(result.isBlocked).toBe(false)
  })

  it("should calculate free views remaining correctly", () => {
    const credits = createMockCredits({ free_property_views_used: 15 })
    const result = formatCreditStatus(credits)

    expect(result.freeViewsRemaining).toBe(5)
  })
})
