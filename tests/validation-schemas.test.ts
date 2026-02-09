import { describe, it, expect } from "vitest"
import {
  uuidSchema,
  emailSchema,
  paginationSchema,
  priceAlertCreateSchema,
  savedSearchCreateSchema,
  exportRequestSchema,
  propertyFiltersSchema,
} from "@/lib/validation/schemas"

describe("uuidSchema", () => {
  it("should validate correct UUIDs", () => {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000"
    expect(uuidSchema.safeParse(validUuid).success).toBe(true)
  })

  it("should reject invalid UUIDs", () => {
    expect(uuidSchema.safeParse("invalid-uuid").success).toBe(false)
    expect(uuidSchema.safeParse("12345").success).toBe(false)
    expect(uuidSchema.safeParse("").success).toBe(false)
  })
})

describe("emailSchema", () => {
  it("should validate correct emails", () => {
    expect(emailSchema.safeParse("test@example.com").success).toBe(true)
    expect(emailSchema.safeParse("user.name@domain.co.uk").success).toBe(true)
  })

  it("should reject invalid emails", () => {
    expect(emailSchema.safeParse("invalid-email").success).toBe(false)
    expect(emailSchema.safeParse("@domain.com").success).toBe(false)
    expect(emailSchema.safeParse("user@").success).toBe(false)
    expect(emailSchema.safeParse("").success).toBe(false)
  })
})

describe("paginationSchema", () => {
  it("should validate with defaults", () => {
    const result = paginationSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(1)
      expect(result.data.limit).toBe(20)
    }
  })

  it("should accept valid page and limit", () => {
    const result = paginationSchema.safeParse({ page: 5, limit: 50 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(5)
      expect(result.data.limit).toBe(50)
    }
  })

  it("should coerce string numbers", () => {
    const result = paginationSchema.safeParse({ page: "3", limit: "25" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.page).toBe(3)
      expect(result.data.limit).toBe(25)
    }
  })

  it("should reject limit over 100", () => {
    const result = paginationSchema.safeParse({ page: 1, limit: 150 })
    expect(result.success).toBe(false)
  })

  it("should reject negative page", () => {
    const result = paginationSchema.safeParse({ page: -1, limit: 20 })
    expect(result.success).toBe(false)
  })
})

describe("priceAlertCreateSchema", () => {
  it("should validate price_drop alert with property_id", () => {
    const result = priceAlertCreateSchema.safeParse({
      alert_type: "price_drop",
      property_id: "123e4567-e89b-12d3-a456-426614174000",
    })
    expect(result.success).toBe(true)
  })

  it("should reject price_drop alert without property_id", () => {
    const result = priceAlertCreateSchema.safeParse({
      alert_type: "price_drop",
    })
    expect(result.success).toBe(false)
  })

  it("should validate new_listing alert without property_id", () => {
    const result = priceAlertCreateSchema.safeParse({
      alert_type: "new_listing",
      postcode: "M14",
    })
    expect(result.success).toBe(true)
  })

  it("should validate area_watch alert", () => {
    const result = priceAlertCreateSchema.safeParse({
      alert_type: "area_watch",
      area: "Manchester",
      radius_miles: 5,
    })
    expect(result.success).toBe(true)
  })

  it("should reject invalid alert_type", () => {
    const result = priceAlertCreateSchema.safeParse({
      alert_type: "invalid_type",
    })
    expect(result.success).toBe(false)
  })

  it("should apply defaults for notify_email and frequency", () => {
    const result = priceAlertCreateSchema.safeParse({
      alert_type: "new_listing",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.notify_email).toBe(true)
      expect(result.data.frequency).toBe("instant")
    }
  })

  it("should validate price_threshold alert", () => {
    const result = priceAlertCreateSchema.safeParse({
      alert_type: "price_threshold",
      target_price: 250000,
      price_direction: "below",
    })
    expect(result.success).toBe(true)
  })
})

describe("savedSearchCreateSchema", () => {
  it("should validate with name and filters", () => {
    const result = savedSearchCreateSchema.safeParse({
      name: "My Search",
      filters: { city: "Manchester", minPrice: 100000 },
    })
    expect(result.success).toBe(true)
  })

  it("should trim whitespace from name", () => {
    const result = savedSearchCreateSchema.safeParse({
      name: "  My Search  ",
      filters: {},
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("My Search")
    }
  })

  it("should reject empty name", () => {
    const result = savedSearchCreateSchema.safeParse({
      name: "",
      filters: {},
    })
    expect(result.success).toBe(false)
  })

  it("should reject name over 100 characters", () => {
    const result = savedSearchCreateSchema.safeParse({
      name: "a".repeat(101),
      filters: {},
    })
    expect(result.success).toBe(false)
  })
})

describe("exportRequestSchema", () => {
  it("should validate with property IDs", () => {
    const result = exportRequestSchema.safeParse({
      propertyIds: [
        "123e4567-e89b-12d3-a456-426614174000",
        "223e4567-e89b-12d3-a456-426614174001",
      ],
    })
    expect(result.success).toBe(true)
  })

  it("should validate with filters", () => {
    const result = exportRequestSchema.safeParse({
      filters: {
        listingType: "purchase",
        city: "Manchester",
        minPrice: 100000,
        maxPrice: 500000,
      },
    })
    expect(result.success).toBe(true)
  })

  it("should reject more than 500 property IDs", () => {
    const result = exportRequestSchema.safeParse({
      propertyIds: Array(501).fill("123e4567-e89b-12d3-a456-426614174000"),
    })
    expect(result.success).toBe(false)
  })

  it("should validate empty request", () => {
    const result = exportRequestSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe("propertyFiltersSchema", () => {
  it("should validate listing type", () => {
    const result = propertyFiltersSchema.safeParse({
      listingType: "rent",
    })
    expect(result.success).toBe(true)
  })

  it("should validate price range", () => {
    const result = propertyFiltersSchema.safeParse({
      minPrice: 100000,
      maxPrice: 500000,
    })
    expect(result.success).toBe(true)
  })

  it("should validate EPC rating filter", () => {
    const result = propertyFiltersSchema.safeParse({
      minEpcRating: "C",
    })
    expect(result.success).toBe(true)
  })

  it("should validate Article 4 filter", () => {
    const result = propertyFiltersSchema.safeParse({
      article4Filter: "only",
    })
    expect(result.success).toBe(true)
  })

  it("should coerce string numbers", () => {
    const result = propertyFiltersSchema.safeParse({
      minPrice: "100000",
      minDealScore: "75",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.minPrice).toBe(100000)
      expect(result.data.minDealScore).toBe(75)
    }
  })

  it("should validate HMO classification", () => {
    const result = propertyFiltersSchema.safeParse({
      hmoClassification: "ready_to_go",
    })
    expect(result.success).toBe(true)
  })

  it("should validate yield band", () => {
    const result = propertyFiltersSchema.safeParse({
      yieldBand: "high",
    })
    expect(result.success).toBe(true)
  })

  it("should reject deal score over 100", () => {
    const result = propertyFiltersSchema.safeParse({
      minDealScore: 150,
    })
    expect(result.success).toBe(false)
  })

  it("should reject negative min price", () => {
    const result = propertyFiltersSchema.safeParse({
      minPrice: -100,
    })
    expect(result.success).toBe(false)
  })

  // Phase 6 - TA Sourcing filter validation
  it("should validate minBedrooms filter", () => {
    const result = propertyFiltersSchema.safeParse({ minBedrooms: 3 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.minBedrooms).toBe(3)
    }
  })

  it("should coerce string minBedrooms", () => {
    const result = propertyFiltersSchema.safeParse({ minBedrooms: "4" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.minBedrooms).toBe(4)
    }
  })

  it("should reject minBedrooms below 1", () => {
    expect(propertyFiltersSchema.safeParse({ minBedrooms: 0 }).success).toBe(false)
    expect(propertyFiltersSchema.safeParse({ minBedrooms: -1 }).success).toBe(false)
  })

  it("should reject minBedrooms above 20", () => {
    expect(propertyFiltersSchema.safeParse({ minBedrooms: 21 }).success).toBe(false)
  })

  it("should validate minBathrooms filter", () => {
    const result = propertyFiltersSchema.safeParse({ minBathrooms: 2 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.minBathrooms).toBe(2)
    }
  })

  it("should reject minBathrooms above 10", () => {
    expect(propertyFiltersSchema.safeParse({ minBathrooms: 11 }).success).toBe(false)
  })

  it("should validate boolean isFurnished filter", () => {
    const result = propertyFiltersSchema.safeParse({ isFurnished: true })
    expect(result.success).toBe(true)
  })

  it("should validate boolean hasParking filter", () => {
    const result = propertyFiltersSchema.safeParse({ hasParking: true })
    expect(result.success).toBe(true)
  })

  it("should validate taSuitability filter", () => {
    expect(propertyFiltersSchema.safeParse({ taSuitability: "suitable" }).success).toBe(true)
    expect(propertyFiltersSchema.safeParse({ taSuitability: "partial" }).success).toBe(true)
  })

  it("should reject invalid taSuitability value", () => {
    expect(propertyFiltersSchema.safeParse({ taSuitability: "invalid" }).success).toBe(false)
    expect(propertyFiltersSchema.safeParse({ taSuitability: "not_suitable" }).success).toBe(false)
  })

  it("should accept all Phase 6 filters combined", () => {
    const result = propertyFiltersSchema.safeParse({
      listingType: "rent",
      minBedrooms: 3,
      minBathrooms: 2,
      isFurnished: true,
      hasParking: false,
      taSuitability: "suitable",
    })
    expect(result.success).toBe(true)
  })
})
