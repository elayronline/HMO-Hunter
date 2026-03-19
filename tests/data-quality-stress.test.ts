import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  FRESHNESS_RULES,
  assessFreshness,
  calculateCompleteness,
  calculateDataQuality,
  buildRefreshQueue,
  getQualityLabel,
  COMPLETENESS_FIELDS,
  type DataSource,
  type FreshnessStatus,
  type FreshnessRule,
} from "@/lib/data-quality"

// Helper: create a date N days ago
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

// Helper: create a full property mock
const createProperty = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "test-property-1",
  address: "123 Test Street",
  postcode: "M1 1AA",
  city: "Manchester",
  bedrooms: 5,
  bathrooms: 2,
  listing_type: "purchase",
  purchase_price: 250000,
  price_pcm: null,
  hmo_status: "Licensed HMO",
  licence_status: "active",
  epc_rating: "C",
  owner_name: "John Smith",
  owner_contact_email: "john@example.com",
  owner_contact_phone: "07700900000",
  licence_holder_name: "John Smith",
  company_name: null,
  article_4_area: false,
  gross_internal_area_sqm: 120,
  estimated_yield_percentage: 8.5,
  primary_image: "https://example.com/image.jpg",
  broadband_max_down: 100,
  year_built: 1920,
  deal_score: 75,
  lettable_rooms: 5,
  registered_owner: "John Smith",
  last_sale_price: 200000,
  // Enrichment timestamps
  last_seen_at: daysAgo(1),
  propertydata_enriched_at: daysAgo(15),
  title_last_enriched_at: daysAgo(30),
  streetdata_enriched_at: daysAgo(45),
  patma_enriched_at: daysAgo(20),
  broadband_last_checked: daysAgo(60),
  landregistry_last_checked: daysAgo(50),
  zoopla_enriched_at: daysAgo(5),
  ...overrides,
})

// ============================================================
// FRESHNESS RULES CONFIGURATION
// ============================================================

describe("Freshness Rules Configuration", () => {
  const allSources: DataSource[] = [
    "listing", "hmo_register", "title_owner", "epc", "planning",
    "companies_house", "street_data", "patma", "broadband",
    "land_registry", "kamma", "zoopla_images",
  ]

  it("should define rules for all data sources", () => {
    allSources.forEach(source => {
      expect(FRESHNESS_RULES[source]).toBeDefined()
      expect(FRESHNESS_RULES[source].source).toBe(source)
    })
  })

  it("should have 12 data sources defined", () => {
    expect(Object.keys(FRESHNESS_RULES)).toHaveLength(12)
  })

  it("should have valid threshold ordering for every source", () => {
    allSources.forEach(source => {
      const rule = FRESHNESS_RULES[source]
      expect(rule.liveThreshold).toBeLessThanOrEqual(rule.freshThreshold)
      expect(rule.freshThreshold).toBeLessThanOrEqual(rule.agingThreshold)
      expect(rule.agingThreshold).toBeLessThanOrEqual(rule.staleThreshold)
    })
  })

  it("should have positive thresholds for all sources", () => {
    allSources.forEach(source => {
      const rule = FRESHNESS_RULES[source]
      expect(rule.liveThreshold).toBeGreaterThan(0)
      expect(rule.freshThreshold).toBeGreaterThan(0)
      expect(rule.agingThreshold).toBeGreaterThan(0)
      expect(rule.staleThreshold).toBeGreaterThan(0)
    })
  })

  it("should have valid priority values (1, 2, or 3)", () => {
    allSources.forEach(source => {
      expect([1, 2, 3]).toContain(FRESHNESS_RULES[source].refreshPriority)
    })
  })

  it("should have valid volatility values", () => {
    allSources.forEach(source => {
      expect(["high", "medium", "low"]).toContain(FRESHNESS_RULES[source].volatility)
    })
  })

  it("high-volatility sources should have shorter stale thresholds", () => {
    const highVol = allSources.filter(s => FRESHNESS_RULES[s].volatility === "high")
    const lowVol = allSources.filter(s => FRESHNESS_RULES[s].volatility === "low")

    highVol.forEach(h => {
      lowVol.forEach(l => {
        expect(FRESHNESS_RULES[h].staleThreshold).toBeLessThanOrEqual(FRESHNESS_RULES[l].staleThreshold)
      })
    })
  })

  it("critical priority sources should have shorter stale thresholds than nice-to-have", () => {
    const critical = allSources.filter(s => FRESHNESS_RULES[s].refreshPriority === 1)
    const niceToHave = allSources.filter(s => FRESHNESS_RULES[s].refreshPriority === 3)

    critical.forEach(c => {
      niceToHave.forEach(n => {
        expect(FRESHNESS_RULES[c].staleThreshold).toBeLessThanOrEqual(FRESHNESS_RULES[n].staleThreshold)
      })
    })
  })

  it("listing source should have the shortest stale threshold", () => {
    const listingStale = FRESHNESS_RULES.listing.staleThreshold
    allSources.forEach(source => {
      expect(FRESHNESS_RULES[source].staleThreshold).toBeGreaterThanOrEqual(listingStale)
    })
  })

  it("EPC source should have the longest thresholds (valid 10 years)", () => {
    const epcStale = FRESHNESS_RULES.epc.staleThreshold
    expect(epcStale).toBeGreaterThanOrEqual(365)
  })
})

// ============================================================
// FRESHNESS ASSESSMENT
// ============================================================

describe("assessFreshness()", () => {
  const listingRule = FRESHNESS_RULES.listing

  it("should return 'live' for data enriched today", () => {
    const result = assessFreshness(daysAgo(0), listingRule)
    expect(result.status).toBe("live")
    expect(result.actionRequired).toBe(false)
  })

  it("should return 'fresh' for data within fresh threshold", () => {
    const result = assessFreshness(daysAgo(2), listingRule)
    expect(result.status).toBe("fresh")
    expect(result.actionRequired).toBe(false)
  })

  it("should return 'aging' for data within aging threshold", () => {
    const result = assessFreshness(daysAgo(5), listingRule)
    expect(result.status).toBe("aging")
    expect(result.actionRequired).toBe(false)
  })

  it("should return 'stale' for data within stale threshold", () => {
    const result = assessFreshness(daysAgo(10), listingRule)
    expect(result.status).toBe("stale")
    expect(result.actionRequired).toBe(true)
  })

  it("should return 'expired' for data beyond stale threshold", () => {
    const result = assessFreshness(daysAgo(30), listingRule)
    expect(result.status).toBe("expired")
    expect(result.actionRequired).toBe(true)
  })

  it("should return 'expired' for null enrichment date", () => {
    const result = assessFreshness(null, listingRule)
    expect(result.status).toBe("expired")
    expect(result.daysSince).toBe(Infinity)
    expect(result.actionRequired).toBe(true)
  })

  it("should calculate correct days since enrichment", () => {
    const result = assessFreshness(daysAgo(5), listingRule)
    expect(result.daysSince).toBe(5)
  })

  it("should apply different rules per source", () => {
    // Same date, different rules
    const date = daysAgo(50)
    const listingResult = assessFreshness(date, FRESHNESS_RULES.listing)
    const epcResult = assessFreshness(date, FRESHNESS_RULES.epc)

    expect(listingResult.status).toBe("expired")  // listing stale at 14d
    expect(["live", "fresh"]).toContain(epcResult.status) // EPC live/fresh at 30-180d
  })

  it("should handle boundary conditions exactly", () => {
    // Exactly at liveThreshold boundary
    const result = assessFreshness(daysAgo(1), listingRule)
    expect(result.status).toBe("live")

    // Exactly at freshThreshold boundary
    const freshResult = assessFreshness(daysAgo(3), listingRule)
    expect(freshResult.status).toBe("fresh")

    // Exactly at staleThreshold boundary
    const staleResult = assessFreshness(daysAgo(14), listingRule)
    expect(staleResult.status).toBe("stale")
  })
})

// ============================================================
// COMPLETENESS SCORING
// ============================================================

describe("calculateCompleteness()", () => {
  it("should score a fully populated property highly", () => {
    const prop = createProperty()
    const result = calculateCompleteness(prop)
    expect(result.score).toBeGreaterThanOrEqual(80)
    expect(result.grade).toMatch(/^[AB]$/)
    expect(result.missingCritical).toHaveLength(0)
  })

  it("should score an empty property as F", () => {
    const result = calculateCompleteness({})
    expect(result.score).toBe(0)
    expect(result.grade).toBe("F")
    expect(result.missingCritical.length).toBeGreaterThan(0)
  })

  it("should penalise missing critical fields heavily", () => {
    const withCritical = calculateCompleteness(createProperty())
    const withoutAddress = calculateCompleteness(createProperty({ address: null, postcode: null }))
    expect(withCritical.score).toBeGreaterThan(withoutAddress.score)
    expect(withoutAddress.missingCritical).toContain("address")
  })

  it("should track filled vs total fields", () => {
    const result = calculateCompleteness(createProperty())
    expect(result.filledFields).toBeGreaterThan(0)
    expect(result.totalFields).toBeGreaterThan(0)
    expect(result.filledFields).toBeLessThanOrEqual(result.totalFields)
  })

  it("should have breakdown per group", () => {
    const result = calculateCompleteness(createProperty())
    expect(result.breakdown.critical).toBeDefined()
    expect(result.breakdown.important).toBeDefined()
    expect(result.breakdown.enrichment).toBeDefined()

    expect(result.breakdown.critical.score).toBeGreaterThanOrEqual(0)
    expect(result.breakdown.critical.score).toBeLessThanOrEqual(100)
  })

  it("should handle null, undefined, empty string, and false as missing", () => {
    const prop = createProperty({
      address: null,
      postcode: undefined,
      city: "",
      article_4_area: false,
    })
    const result = calculateCompleteness(prop)
    expect(result.missingCritical).toContain("address")
    expect(result.missingCritical).toContain("postcode")
    expect(result.missingCritical).toContain("city")
  })

  it("should assign correct grades at boundaries", () => {
    // We can't easily control exact scores, but test grade mapping
    const full = calculateCompleteness(createProperty())
    expect(["A", "B"]).toContain(full.grade)

    const empty = calculateCompleteness({})
    expect(empty.grade).toBe("F")
  })

  it("should have consistent field counts across runs", () => {
    const a = calculateCompleteness(createProperty())
    const b = calculateCompleteness(createProperty())
    expect(a.totalFields).toBe(b.totalFields)
    expect(a.filledFields).toBe(b.filledFields)
  })
})

// ============================================================
// DATA QUALITY SCORE
// ============================================================

describe("calculateDataQuality()", () => {
  it("should compute overall score for a well-enriched property", () => {
    const quality = calculateDataQuality(createProperty())
    expect(quality.overall).toBeGreaterThanOrEqual(0)
    expect(quality.overall).toBeLessThanOrEqual(100)
    expect(["A", "B", "C", "D", "F"]).toContain(quality.grade)
  })

  it("should include freshness, completeness, and confidence breakdowns", () => {
    const quality = calculateDataQuality(createProperty())
    expect(quality.freshness).toBeDefined()
    expect(quality.freshness.score).toBeGreaterThanOrEqual(0)
    expect(quality.freshness.sources.length).toBeGreaterThan(0)
    expect(quality.completeness).toBeDefined()
    expect(quality.confidence).toBeDefined()
  })

  it("should flag stale sources correctly", () => {
    const staleProperty = createProperty({
      last_seen_at: daysAgo(30),        // listing stale at 14d
      propertydata_enriched_at: null,   // never enriched
    })
    const quality = calculateDataQuality(staleProperty)
    expect(quality.freshness.staleCount).toBeGreaterThan(0)
    expect(quality.actionRequired.length).toBeGreaterThan(0)
  })

  it("should detect price discrepancy between listing and LR", () => {
    const prop = createProperty({
      purchase_price: 500000,
      last_sale_price: 100000,  // 80% difference
    })
    const quality = calculateDataQuality(prop)
    expect(quality.confidence.flags.length).toBeGreaterThan(0)
    expect(quality.confidence.flags[0]).toContain("Price discrepancy")
  })

  it("should detect owner name mismatch", () => {
    const prop = createProperty({
      owner_name: "John Smith",
      registered_owner: "Jane Doe",
    })
    const quality = calculateDataQuality(prop)
    // Test owner mismatch with a clean property that has no price discrepancy
    const prop2: Record<string, unknown> = {
      owner_name: "Alice Smith",
      registered_owner: "Bob Jones",
      purchase_price: null,
      last_sale_price: null,
      epc_rating: "C",
      hmo_status: "Licensed HMO",
      licence_status: "active",
      bedrooms: 3,
      lettable_rooms: 3,
    }
    const quality2 = calculateDataQuality(prop2)
    const ownerFlag = quality2.confidence.flags.find(f => f.includes("Owner name differs"))
    expect(ownerFlag).toBeDefined()
  })

  it("should score higher when all timestamps are recent", () => {
    const fresh = createProperty({
      last_seen_at: daysAgo(0),
      propertydata_enriched_at: daysAgo(1),
      title_last_enriched_at: daysAgo(5),
      streetdata_enriched_at: daysAgo(3),
      patma_enriched_at: daysAgo(2),
      broadband_last_checked: daysAgo(10),
      landregistry_last_checked: daysAgo(15),
      zoopla_enriched_at: daysAgo(1),
    })
    const stale = createProperty({
      last_seen_at: daysAgo(30),
      propertydata_enriched_at: daysAgo(100),
      title_last_enriched_at: daysAgo(400),
      streetdata_enriched_at: daysAgo(400),
      patma_enriched_at: daysAgo(100),
      broadband_last_checked: daysAgo(400),
      landregistry_last_checked: daysAgo(400),
      zoopla_enriched_at: daysAgo(200),
    })

    const freshQuality = calculateDataQuality(fresh)
    const staleQuality = calculateDataQuality(stale)
    expect(freshQuality.overall).toBeGreaterThan(staleQuality.overall)
    expect(freshQuality.freshness.score).toBeGreaterThan(staleQuality.freshness.score)
  })

  it("should handle property with no enrichment timestamps", () => {
    const bare = createProperty({
      last_seen_at: null,
      propertydata_enriched_at: null,
      title_last_enriched_at: null,
      streetdata_enriched_at: null,
      patma_enriched_at: null,
      broadband_last_checked: null,
      landregistry_last_checked: null,
      zoopla_enriched_at: null,
    })
    const quality = calculateDataQuality(bare)
    expect(quality.freshness.score).toBe(0)
    expect(quality.freshness.staleCount).toBeGreaterThan(0)
    // Completeness still contributes since many fields are populated from createProperty
    // but freshness is 0, so overall should be significantly lower
    expect(quality.overall).toBeLessThan(65)
  })

  it("should weight freshness at 40%, completeness at 35%, confidence at 25%", () => {
    // Create a property where we can predict approximate scores
    const prop = createProperty()
    const quality = calculateDataQuality(prop)

    // Verify the overall is a weighted combination (not exact due to rounding)
    const expectedApprox = Math.round(
      quality.freshness.score * 0.40 +
      quality.completeness.score * 0.35 +
      quality.confidence.score * 0.25
    )
    // Allow ±1 for rounding
    expect(Math.abs(quality.overall - expectedApprox)).toBeLessThanOrEqual(1)
  })
})

// ============================================================
// REFRESH QUEUE
// ============================================================

describe("buildRefreshQueue()", () => {
  it("should return empty queue for fully fresh properties", () => {
    const prop = {
      id: "test-1",
      last_seen_at: daysAgo(0),
      propertydata_enriched_at: daysAgo(1),
      title_last_enriched_at: daysAgo(5),
      streetdata_enriched_at: daysAgo(5),
      patma_enriched_at: daysAgo(2),
      broadband_last_checked: daysAgo(10),
      landregistry_last_checked: daysAgo(10),
      zoopla_enriched_at: daysAgo(1),
    }
    const queue = buildRefreshQueue([prop])
    expect(queue.length).toBe(0)
  })

  it("should queue stale sources", () => {
    const prop = {
      id: "test-1",
      last_seen_at: daysAgo(30),           // listing stale at 14d
      propertydata_enriched_at: null,       // never enriched
      title_last_enriched_at: daysAgo(5),
      streetdata_enriched_at: daysAgo(5),
      patma_enriched_at: daysAgo(5),
      broadband_last_checked: daysAgo(5),
      landregistry_last_checked: daysAgo(5),
      zoopla_enriched_at: daysAgo(5),
    }
    const queue = buildRefreshQueue([prop])
    expect(queue.length).toBeGreaterThan(0)
    expect(queue[0].source).toBeDefined()
  })

  it("should prioritize critical sources over nice-to-have", () => {
    const prop = {
      id: "test-1",
      last_seen_at: daysAgo(30),                // critical, stale
      propertydata_enriched_at: daysAgo(200),   // critical, stale
      title_last_enriched_at: daysAgo(500),     // important, stale
      streetdata_enriched_at: daysAgo(500),     // nice-to-have, stale
      patma_enriched_at: daysAgo(200),          // important, stale
      broadband_last_checked: daysAgo(500),     // nice-to-have, stale
      landregistry_last_checked: daysAgo(500),  // important, stale
      zoopla_enriched_at: daysAgo(500),         // nice-to-have, stale
    }
    const queue = buildRefreshQueue([prop])

    // First items should be priority 1 (critical)
    const firstPriority = queue[0].priority
    const lastPriority = queue[queue.length - 1].priority
    expect(firstPriority).toBeLessThanOrEqual(lastPriority)
  })

  it("should respect maxItems limit", () => {
    const props = Array.from({ length: 50 }, (_, i) => ({
      id: `prop-${i}`,
      last_seen_at: null,
      propertydata_enriched_at: null,
      title_last_enriched_at: null,
      streetdata_enriched_at: null,
      patma_enriched_at: null,
      broadband_last_checked: null,
      landregistry_last_checked: null,
      zoopla_enriched_at: null,
    }))
    const queue = buildRefreshQueue(props, 20)
    expect(queue.length).toBeLessThanOrEqual(20)
  })

  it("should handle multiple properties correctly", () => {
    const props = [
      { id: "fresh", last_seen_at: daysAgo(0), propertydata_enriched_at: daysAgo(0), title_last_enriched_at: daysAgo(0), streetdata_enriched_at: daysAgo(0), patma_enriched_at: daysAgo(0), broadband_last_checked: daysAgo(0), landregistry_last_checked: daysAgo(0), zoopla_enriched_at: daysAgo(0) },
      { id: "stale", last_seen_at: daysAgo(100), propertydata_enriched_at: null, title_last_enriched_at: null, streetdata_enriched_at: null, patma_enriched_at: null, broadband_last_checked: null, landregistry_last_checked: null, zoopla_enriched_at: null },
    ]
    const queue = buildRefreshQueue(props)
    // Only stale property should generate candidates
    const staleIds = queue.filter(c => c.propertyId === "stale")
    const freshIds = queue.filter(c => c.propertyId === "fresh")
    expect(staleIds.length).toBeGreaterThan(0)
    expect(freshIds.length).toBe(0)
  })
})

// ============================================================
// QUALITY LABELS
// ============================================================

describe("getQualityLabel()", () => {
  it("should return 'Verified' for scores >= 90", () => {
    expect(getQualityLabel(90).label).toBe("Verified")
    expect(getQualityLabel(100).label).toBe("Verified")
  })

  it("should return 'Reliable' for scores 75-89", () => {
    expect(getQualityLabel(75).label).toBe("Reliable")
    expect(getQualityLabel(89).label).toBe("Reliable")
  })

  it("should return 'Fair' for scores 60-74", () => {
    expect(getQualityLabel(60).label).toBe("Fair")
    expect(getQualityLabel(74).label).toBe("Fair")
  })

  it("should return 'Outdated' for scores 40-59", () => {
    expect(getQualityLabel(40).label).toBe("Outdated")
    expect(getQualityLabel(59).label).toBe("Outdated")
  })

  it("should return 'Unverified' for scores < 40", () => {
    expect(getQualityLabel(0).label).toBe("Unverified")
    expect(getQualityLabel(39).label).toBe("Unverified")
  })

  it("should return valid color classes for all tiers", () => {
    for (let score = 0; score <= 100; score += 10) {
      const label = getQualityLabel(score)
      expect(label.color).toMatch(/^text-/)
      expect(label.bgColor).toMatch(/^bg-/)
      expect(label.borderColor).toMatch(/^border-/)
      expect(label.description.length).toBeGreaterThan(0)
    }
  })
})

// ============================================================
// STRESS TESTS
// ============================================================

describe("Stress: Bulk Quality Scoring", () => {
  it("should score 1000 properties without errors", () => {
    for (let i = 0; i < 1000; i++) {
      const prop = createProperty({
        last_seen_at: daysAgo(Math.floor(Math.random() * 60)),
        propertydata_enriched_at: Math.random() > 0.3 ? daysAgo(Math.floor(Math.random() * 120)) : null,
        title_last_enriched_at: Math.random() > 0.4 ? daysAgo(Math.floor(Math.random() * 365)) : null,
      })
      const quality = calculateDataQuality(prop)
      expect(quality.overall).toBeGreaterThanOrEqual(0)
      expect(quality.overall).toBeLessThanOrEqual(100)
      expect(["A", "B", "C", "D", "F"]).toContain(quality.grade)
    }
  })

  it("should handle completely empty properties 1000 times", () => {
    for (let i = 0; i < 1000; i++) {
      const quality = calculateDataQuality({})
      expect(quality.overall).toBeGreaterThanOrEqual(0)
      expect(quality.completeness.score).toBe(0)
      expect(quality.grade).toBe("F")
    }
  })

  it("should produce stable scores for identical properties", () => {
    const prop = createProperty()
    const scores: number[] = []
    for (let i = 0; i < 100; i++) {
      scores.push(calculateDataQuality(prop).overall)
    }
    const allSame = scores.every(s => s === scores[0])
    expect(allSame).toBe(true)
  })

  it("should process 500-property refresh queue under 50ms", () => {
    const props = Array.from({ length: 500 }, (_, i) => ({
      id: `prop-${i}`,
      last_seen_at: daysAgo(Math.floor(Math.random() * 100)),
      propertydata_enriched_at: Math.random() > 0.5 ? daysAgo(Math.floor(Math.random() * 200)) : null,
      title_last_enriched_at: Math.random() > 0.5 ? daysAgo(Math.floor(Math.random() * 500)) : null,
      streetdata_enriched_at: Math.random() > 0.5 ? daysAgo(Math.floor(Math.random() * 500)) : null,
      patma_enriched_at: Math.random() > 0.5 ? daysAgo(Math.floor(Math.random() * 200)) : null,
      broadband_last_checked: Math.random() > 0.5 ? daysAgo(Math.floor(Math.random() * 500)) : null,
      landregistry_last_checked: Math.random() > 0.5 ? daysAgo(Math.floor(Math.random() * 500)) : null,
      zoopla_enriched_at: Math.random() > 0.5 ? daysAgo(Math.floor(Math.random() * 200)) : null,
    }))

    const start = performance.now()
    const queue = buildRefreshQueue(props, 100)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(50)
    expect(queue.length).toBeLessThanOrEqual(100)
  })
})

describe("Stress: Edge Cases", () => {
  it("should handle future dates gracefully", () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const result = assessFreshness(futureDate, FRESHNESS_RULES.listing)
    expect(result.status).toBe("live")
    expect(result.daysSince).toBeLessThanOrEqual(0)
  })

  it("should handle very old dates", () => {
    const veryOld = "2000-01-01T00:00:00.000Z"
    const result = assessFreshness(veryOld, FRESHNESS_RULES.listing)
    expect(result.status).toBe("expired")
    expect(result.daysSince).toBeGreaterThan(9000)
  })

  it("should handle invalid date strings", () => {
    const result = assessFreshness("not-a-date", FRESHNESS_RULES.listing)
    // NaN date should result in expired
    expect(result.daysSince).toBe(NaN)
  })

  it("should handle property with all null enrichment fields", () => {
    const quality = calculateDataQuality(createProperty({
      address: null, postcode: null, city: null, bedrooms: null,
      listing_type: null, purchase_price: null, price_pcm: null,
      last_seen_at: null, propertydata_enriched_at: null,
      title_last_enriched_at: null, streetdata_enriched_at: null,
      patma_enriched_at: null, broadband_last_checked: null,
      landregistry_last_checked: null, zoopla_enriched_at: null,
    }))
    expect(quality.overall).toBeGreaterThanOrEqual(0)
    expect(quality.freshness.score).toBe(0)
  })

  it("should not produce NaN or Infinity in final scores", () => {
    const testCases = [
      {},
      createProperty(),
      createProperty({ last_seen_at: null }),
      createProperty({ bedrooms: 0, bathrooms: 0 }),
    ]

    testCases.forEach(prop => {
      const quality = calculateDataQuality(prop)
      expect(Number.isFinite(quality.overall)).toBe(true)
      expect(Number.isFinite(quality.freshness.score)).toBe(true)
      expect(Number.isFinite(quality.completeness.score)).toBe(true)
      expect(Number.isFinite(quality.confidence.score)).toBe(true)
    })
  })
})

describe("Completeness Field Coverage", () => {
  it("should have at least 5 critical fields", () => {
    expect(COMPLETENESS_FIELDS.critical.length).toBeGreaterThanOrEqual(5)
  })

  it("should have at least 5 important fields", () => {
    expect(COMPLETENESS_FIELDS.important.length).toBeGreaterThanOrEqual(5)
  })

  it("should have at least 8 enrichment fields", () => {
    expect(COMPLETENESS_FIELDS.enrichment.length).toBeGreaterThanOrEqual(8)
  })

  it("should have positive weights for all fields", () => {
    for (const [, fields] of Object.entries(COMPLETENESS_FIELDS)) {
      for (const { weight } of fields) {
        expect(weight).toBeGreaterThan(0)
      }
    }
  })

  it("should have unique field names across all groups", () => {
    const allFields: string[] = []
    for (const [, fields] of Object.entries(COMPLETENESS_FIELDS)) {
      for (const { field } of fields) {
        allFields.push(field)
      }
    }
    const unique = new Set(allFields)
    expect(unique.size).toBe(allFields.length)
  })

  it("critical fields should have higher average weight than enrichment fields", () => {
    const criticalAvg = COMPLETENESS_FIELDS.critical.reduce((s, f) => s + f.weight, 0) / COMPLETENESS_FIELDS.critical.length
    const enrichmentAvg = COMPLETENESS_FIELDS.enrichment.reduce((s, f) => s + f.weight, 0) / COMPLETENESS_FIELDS.enrichment.length
    expect(criticalAvg).toBeGreaterThan(enrichmentAvg)
  })
})
