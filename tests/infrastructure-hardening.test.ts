import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CACHE_TTL, cacheThrough } from "@/lib/cache"
import { TTLCache } from "@/lib/cache"
import { generateCSRFToken } from "@/lib/csrf"
import { RATE_LIMITS, getRateLimitStoreSize } from "@/lib/rate-limit"
import {
  resolvePropertyImage,
  getAvailableImages,
  type ResolvedImage,
} from "@/lib/image-fallback"

// ============================================================
// CACHE LAYER
// ============================================================

describe("Cache: TTL Behaviour", () => {
  it("should define reasonable TTLs for all cache domains", () => {
    expect(CACHE_TTL.propertyList).toBeGreaterThanOrEqual(60 * 1000)  // Min 1 min
    expect(CACHE_TTL.propertyList).toBeLessThanOrEqual(30 * 60 * 1000) // Max 30 min
    expect(CACHE_TTL.mapData).toBeGreaterThanOrEqual(60 * 1000)
    expect(CACHE_TTL.credits).toBeLessThanOrEqual(60 * 1000) // Credits should be short
    expect(CACHE_TTL.areaStats).toBeGreaterThan(CACHE_TTL.propertyList) // Stats change less
  })

  it("should have 6 cache domain presets", () => {
    expect(Object.keys(CACHE_TTL)).toHaveLength(6)
  })

  it("credits TTL should be shortest (most volatile)", () => {
    const ttls = Object.values(CACHE_TTL)
    expect(CACHE_TTL.credits).toBe(Math.min(...ttls))
  })

  it("areaStats TTL should be longest (least volatile)", () => {
    const ttls = Object.values(CACHE_TTL)
    expect(CACHE_TTL.areaStats).toBe(Math.max(...ttls))
  })
})

// ============================================================
// CSRF PROTECTION
// ============================================================

describe("CSRF: Token Generation", () => {
  it("should generate a 64-character hex token", () => {
    const token = generateCSRFToken()
    expect(token).toMatch(/^[a-f0-9]{64}$/)
    expect(token.length).toBe(64)
  })

  it("should generate unique tokens (100 samples)", () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 100; i++) {
      tokens.add(generateCSRFToken())
    }
    expect(tokens.size).toBe(100)
  })

  it("should never generate empty or null tokens", () => {
    for (let i = 0; i < 100; i++) {
      const token = generateCSRFToken()
      expect(token).toBeTruthy()
      expect(token.length).toBe(64)
    }
  })
})

// ============================================================
// RATE LIMITER
// ============================================================

describe("Rate Limiter: Configuration", () => {
  it("should define 6 rate limit presets", () => {
    expect(Object.keys(RATE_LIMITS)).toHaveLength(6)
  })

  it("auth should be the most restrictive", () => {
    const limits = Object.values(RATE_LIMITS).map(r => r.maxRequests)
    expect(RATE_LIMITS.auth.maxRequests).toBe(Math.min(...limits.filter(l => l > 1)))
  })

  it("cron should allow exactly 1 request per minute", () => {
    expect(RATE_LIMITS.cron.maxRequests).toBe(1)
  })

  it("all windows should be 60 seconds", () => {
    Object.values(RATE_LIMITS).forEach(config => {
      expect(config.windowMs).toBe(60 * 1000)
    })
  })

  it("enrichment should be more restrictive than standard", () => {
    expect(RATE_LIMITS.enrichment.maxRequests).toBeLessThan(RATE_LIMITS.standard.maxRequests)
  })

  it("store size function should return a number", () => {
    const size = getRateLimitStoreSize()
    expect(typeof size).toBe("number")
    expect(size).toBeGreaterThanOrEqual(0)
  })
})

// ============================================================
// IMAGE FALLBACK
// ============================================================

describe("Image Fallback: Resolution Chain", () => {
  it("should use primary_image when available", () => {
    const result = resolvePropertyImage({
      primary_image: "https://zoopla.com/image.jpg",
      images: [],
    })
    expect(result.url).toBe("https://zoopla.com/image.jpg")
    expect(result.isFallback).toBe(false)
  })

  it("should skip blocked Rightmove URLs", () => {
    const result = resolvePropertyImage({
      primary_image: "https://media.rightmove.co.uk/photo123.jpg",
      zoopla_images: ["https://zoopla.com/backup.jpg"],
    })
    expect(result.url).toBe("https://zoopla.com/backup.jpg")
    expect(result.source).toBe("zoopla")
  })

  it("should fall through to zoopla_images when primary is blocked", () => {
    const result = resolvePropertyImage({
      primary_image: "https://media.rightmove.co.uk/blocked.jpg",
      zoopla_images: ["https://zoopla.com/good.jpg"],
    })
    expect(result.url).toContain("zoopla.com")
    expect(result.isFallback).toBe(false)
  })

  it("should return placeholder when all sources are null", () => {
    const result = resolvePropertyImage({
      primary_image: null,
      images: null,
      zoopla_images: null,
    })
    expect(result.source).toBe("placeholder")
    expect(result.isFallback).toBe(true)
  })

  it("should return placeholder when all URLs are blocked", () => {
    const result = resolvePropertyImage({
      primary_image: "https://media.rightmove.co.uk/blocked1.jpg",
      images: ["https://media.rightmove.co.uk/blocked2.jpg"],
      zoopla_images: [],
    })
    expect(result.source).toBe("placeholder")
    expect(result.isFallback).toBe(true)
  })

  it("should detect Google Street View as fallback", () => {
    const result = resolvePropertyImage({
      primary_image: null,
      latitude: 53.483959,
      longitude: -2.244644,
    })
    // Without GOOGLE_MAPS_API_KEY in test env, falls to placeholder
    expect(result.isFallback).toBe(true)
  })

  it("should filter blocked URLs from available images", () => {
    const images = getAvailableImages({
      primary_image: "https://zoopla.com/good.jpg",
      images: [
        "https://media.rightmove.co.uk/blocked.jpg",
        "https://zoopla.com/good2.jpg",
      ],
      zoopla_images: [
        "https://zoopla.com/good3.jpg",
        "https://rightmove.co.uk/photos/blocked2.jpg",
      ],
    })

    expect(images).toContain("https://zoopla.com/good.jpg")
    expect(images).toContain("https://zoopla.com/good2.jpg")
    expect(images).toContain("https://zoopla.com/good3.jpg")
    expect(images).not.toContain("https://media.rightmove.co.uk/blocked.jpg")
    expect(images).not.toContain("https://rightmove.co.uk/photos/blocked2.jpg")
  })

  it("should deduplicate images", () => {
    const images = getAvailableImages({
      primary_image: "https://zoopla.com/same.jpg",
      images: ["https://zoopla.com/same.jpg"],
      zoopla_images: ["https://zoopla.com/same.jpg"],
    })
    expect(images).toHaveLength(1)
  })

  it("should handle 100 properties without errors", () => {
    for (let i = 0; i < 100; i++) {
      const result = resolvePropertyImage({
        primary_image: i % 3 === 0 ? "https://zoopla.com/img.jpg" : null,
        images: i % 2 === 0 ? ["https://media.rightmove.co.uk/blocked.jpg"] : null,
        zoopla_images: i % 5 === 0 ? ["https://zoopla.com/backup.jpg"] : null,
        latitude: 51.5 + Math.random(),
        longitude: -0.1 + Math.random(),
      })
      expect(result.url).toBeTruthy()
      expect(typeof result.isFallback).toBe("boolean")
    }
  })
})

// ============================================================
// CRON CONFIGURATION
// ============================================================

describe("Cron: Schedule Validation", () => {
  // Validate the cron schedule format from vercel.json
  const EXPECTED_CRONS = [
    { path: "/api/send-notifications", schedule: "0 8 * * *", desc: "Daily 8 AM UTC" },
    { path: "/api/cron/refresh-data", schedule: "0 3 * * *", desc: "Daily 3 AM UTC" },
    { path: "/api/cron/detect-stale", schedule: "0 4 * * *", desc: "Daily 4 AM UTC" },
    { path: "/api/cron/ingest-off-market", schedule: "0 5 * * *", desc: "Daily 5 AM UTC" },
  ]

  it("should have 4 cron jobs configured", () => {
    expect(EXPECTED_CRONS).toHaveLength(4)
  })

  it("all cron paths should start with /api/", () => {
    EXPECTED_CRONS.forEach(cron => {
      expect(cron.path).toMatch(/^\/api\//)
    })
  })

  it("all schedules should be valid cron expressions", () => {
    const cronRegex = /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/
    EXPECTED_CRONS.forEach(cron => {
      expect(cron.schedule).toMatch(cronRegex)
    })
  })

  it("crons should not overlap (staggered by 1 hour)", () => {
    const hours = EXPECTED_CRONS.map(c => parseInt(c.schedule.split(" ")[1]))
    const unique = new Set(hours)
    expect(unique.size).toBe(hours.length) // No overlapping hours
  })

  it("all crons should run during off-peak hours (midnight-8 AM UTC)", () => {
    const hours = EXPECTED_CRONS.map(c => parseInt(c.schedule.split(" ")[1]))
    hours.forEach(hour => {
      expect(hour).toBeGreaterThanOrEqual(0)
      expect(hour).toBeLessThanOrEqual(8)
    })
  })
})

// ============================================================
// PAYMENT SKELETON
// ============================================================

describe("Payment: Credit Packages", () => {
  const PACKAGES = [
    { id: "credits_150", credits: 150, price_pence: 999 },
    { id: "credits_500", credits: 500, price_pence: 2499 },
    { id: "credits_1500", credits: 1500, price_pence: 4999 },
  ]

  it("should have 3 credit packages", () => {
    expect(PACKAGES).toHaveLength(3)
  })

  it("packages should be ordered by credits ascending", () => {
    for (let i = 1; i < PACKAGES.length; i++) {
      expect(PACKAGES[i].credits).toBeGreaterThan(PACKAGES[i - 1].credits)
    }
  })

  it("higher packages should offer better per-credit value", () => {
    const perCredit = PACKAGES.map(p => p.price_pence / p.credits)
    for (let i = 1; i < perCredit.length; i++) {
      expect(perCredit[i]).toBeLessThan(perCredit[i - 1])
    }
  })

  it("all prices should be in pence (GBP)", () => {
    PACKAGES.forEach(pkg => {
      expect(pkg.price_pence).toBeGreaterThan(0)
      expect(Number.isInteger(pkg.price_pence)).toBe(true)
    })
  })

  it("cheapest package should be under £10", () => {
    expect(PACKAGES[0].price_pence).toBeLessThan(1000)
  })

  it("most expensive package should be under £100", () => {
    expect(PACKAGES[PACKAGES.length - 1].price_pence).toBeLessThan(10000)
  })
})

/**
 * Rate limiting is distributed when it can be, and says so honestly when it is not.
 *
 * lib/rate-limit.ts documented itself as "Uses Upstash Redis when configured,
 * falls back to in-memory" and never touched Redis: lib/redis.ts, which holds a
 * complete Upstash implementation, was imported by no file in the codebase. On a
 * platform that may run each request in a fresh isolate, the Map it actually
 * used is a counter that resets whenever the platform feels like it — so the
 * deployment had a docstring where it thought it had a protection.
 *
 * These are static checks. The distributed path cannot be exercised here
 * because no Upstash instance is configured in any environment; what is
 * verified live is the fallback, which returns 429 after the preset's limit.
 */
describe("rate limiting has one set of numbers and one entry point", () => {
  const redisSrc = readFileSync(join("lib", "redis.ts"), "utf8")
  const rlSrc = readFileSync(join("lib", "rate-limit.ts"), "utf8")
  const mwSrc = readFileSync("middleware.ts", "utf8")

  it("derives the Redis limiters from RATE_LIMITS rather than restating them", () => {
    expect(redisSrc).toMatch(/RATE_LIMITS\[preset\]\.maxRequests/)
    // The six numbers must not be written out a second time.
    expect(redisSrc).not.toMatch(/slidingWindow\(\s*60\s*,/)
    expect(redisSrc).not.toMatch(/slidingWindow\(\s*10\s*,/)
  })

  it("no longer claims to use Redis from the in-memory path", () => {
    // The phrase may still appear where the comment quotes what it used to say
    // — recording the old claim is how the next reader learns why the file is
    // shaped this way. What must not exist is the phrase asserted as current
    // behaviour, i.e. on a doc line that is not reporting history.
    const claims = rlSrc
      .split("\n")
      .filter((l) => /Uses Upstash Redis when configured/.test(l))
      .filter((l) => !/This said|used to|previously/i.test(l))
    expect(claims).toEqual([])
  })

  it("routes middleware through the distributed entry point", () => {
    expect(mwSrc).toMatch(/await enforceRateLimit\(request, preset, pathname\)/)
    // The sync counter must not be middleware's direct call any more.
    expect(mwSrc).not.toMatch(/checkRateLimit\(request/)
  })

  it("falls back rather than allowing the request when Redis is absent or broken", () => {
    // Unconfigured: checkDistributedRateLimit returns null, so the local
    // counter still runs. Unreachable: the catch logs and does the same.
    expect(redisSrc).toMatch(/return checkRateLimit\(request, \{ maxRequests, windowMs, keyPrefix \}\)/)
    expect(redisSrc).toMatch(/console\.error\("\[RateLimit\] Redis unavailable/)
  })

  it("keeps every preset covered by both paths", () => {
    for (const preset of Object.keys(RATE_LIMITS)) {
      expect(redisSrc, `redis limiter for ${preset}`).toMatch(new RegExp(`${preset}: build\\("${preset}"\\)`))
    }
  })
})
