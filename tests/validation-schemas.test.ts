import { describe, it, expect } from "vitest"
import {
  uuidSchema,
  emailSchema,
  paginationSchema,
  priceAlertCreateSchema,
  savedSearchCreateSchema,
  exportRequestSchema,
  propertyFiltersSchema,
  zooplaIngestSchema,
  rightmoveIngestSchema,
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
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.minPrice).toBe(100000)
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

  it("should accept all Phase 6 filters combined", () => {
    const result = propertyFiltersSchema.safeParse({
      listingType: "rent",
      minBedrooms: 3,
      minBathrooms: 2,
      isFurnished: true,
      hasParking: false,
    })
    expect(result.success).toBe(true)
  })
})

describe("zooplaIngestSchema — an unbounded sale run must be unrepresentable", () => {
  const sale = (over: Record<string, unknown> = {}) =>
    zooplaIngestSchema.safeParse({ area: "Nottingham", listingType: "sale", ...over })

  // This is the exact shape the route accepted before, and it is what put
  // 1,053 purchase rows at a £1.5m median into the table in a single run.
  it("rejects a sale run with no bounds at all", () => {
    const result = sale()
    expect(result.success).toBe(false)
  })

  it("rejects a sale run with a bedroom floor but no ceiling", () => {
    expect(sale({ minBedrooms: 3 }).success).toBe(false)
  })

  it("rejects a sale run with a ceiling but no bedroom floor", () => {
    expect(sale({ maxPrice: 750000 }).success).toBe(false)
  })

  it("accepts a sale run that states both", () => {
    const result = sale({ maxPrice: 750000, minBedrooms: 3 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.maxPrice).toBe(750000)
      expect(result.data.minBedrooms).toBe(3)
    }
  })

  it("names the missing bound, so the caller knows which one to add", () => {
    const result = sale({ minBedrooms: 3 })
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("maxPrice"))).toBe(true)
    }
  })

  // Rent runs are not the problem — the rental stock is not what skewed — so
  // they stay unbounded by choice rather than by omission.
  it("leaves a rent run free of required bounds", () => {
    const result = zooplaIngestSchema.safeParse({ area: "Nottingham", listingType: "rent" })
    expect(result.success).toBe(true)
  })

  it("still requires a location", () => {
    expect(zooplaIngestSchema.safeParse({ listingType: "rent" }).success).toBe(false)
  })

  it("accepts a postcode instead of an area", () => {
    expect(zooplaIngestSchema.safeParse({ postcode: "NG7 2AB", listingType: "rent" }).success).toBe(true)
  })

  it("rejects an inverted price range", () => {
    expect(sale({ maxPrice: 500000, minPrice: 900000, minBedrooms: 3 }).success).toBe(false)
  })

  it("rejects an inverted bedroom range", () => {
    expect(sale({ maxPrice: 750000, minBedrooms: 6, maxBedrooms: 3 }).success).toBe(false)
  })

  it("caps limit at 100, because the adapter pages at 100", () => {
    expect(sale({ maxPrice: 750000, minBedrooms: 3, limit: 500 }).success).toBe(false)
  })

  it("defaults listingType to rent, so an omitted type never silently runs a sale", () => {
    const result = zooplaIngestSchema.safeParse({ area: "Nottingham" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.listingType).toBe("rent")
  })
})

describe("rightmoveIngestSchema — rent is unrepresentable, not merely non-default", () => {
  const buy = (over: Record<string, unknown> = {}) =>
    rightmoveIngestSchema.safeParse({ area: "Nottingham", maxPrice: 500000, minBedrooms: 4, ...over })

  it("accepts a bounded purchase run", () => {
    expect(buy().success).toBe(true)
  })

  // The whole point. zooplaIngestSchema takes listingType and defaults it to
  // "rent"; this one has no such field, and .strict() means asking for rentals
  // is an error rather than a silently dropped key.
  it("rejects a run that asks for rentals", () => {
    const result = buy({ listingType: "rent" })
    expect(result.success).toBe(false)
  })

  it("rejects listingType even when it says purchase", () => {
    expect(buy({ listingType: "purchase" }).success).toBe(false)
  })

  it("rejects an unbounded run with no ceiling", () => {
    const result = rightmoveIngestSchema.safeParse({ area: "Nottingham", minBedrooms: 4 })
    expect(result.success).toBe(false)
  })

  it("rejects a run with no bedroom floor", () => {
    const result = rightmoveIngestSchema.safeParse({ area: "Nottingham", maxPrice: 500000 })
    expect(result.success).toBe(false)
  })

  // Fewer than three bedrooms is not an HMO conversion candidate.
  it("rejects a bedroom floor below 3", () => {
    expect(buy({ minBedrooms: 2 }).success).toBe(false)
  })

  it("requires either a postcode or an area", () => {
    const result = rightmoveIngestSchema.safeParse({ maxPrice: 500000, minBedrooms: 4 })
    expect(result.success).toBe(false)
  })

  it("rejects a price range that inverts", () => {
    expect(buy({ minPrice: 600000 }).success).toBe(false)
  })

  it("rejects a bedroom range that inverts", () => {
    expect(buy({ minBedrooms: 6, maxBedrooms: 4 }).success).toBe(false)
  })

  it("defaults the search radius rather than leaving it unset", () => {
    const result = buy()
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.radiusMiles).toBe(0.25)
  })
})
