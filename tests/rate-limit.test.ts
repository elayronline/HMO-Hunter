import { describe, it, expect, beforeEach, vi } from "vitest"

// We'll test the rate limit logic directly
// Since the rate limiter uses global state, we need to mock it

describe("Rate Limit Logic", () => {
  // Simulated rate limiter for testing
  class TestRateLimiter {
    private requests: Map<string, number[]> = new Map()

    constructor(
      private maxRequests: number,
      private windowMs: number
    ) {}

    check(identifier: string): { allowed: boolean; remaining: number; resetIn: number } {
      const now = Date.now()
      const windowStart = now - this.windowMs

      // Get existing requests for this identifier
      const existingRequests = this.requests.get(identifier) || []

      // Filter to only requests within the window
      const validRequests = existingRequests.filter(time => time > windowStart)

      // Check if we can make another request
      if (validRequests.length >= this.maxRequests) {
        const oldestRequest = Math.min(...validRequests)
        const resetIn = oldestRequest + this.windowMs - now
        return {
          allowed: false,
          remaining: 0,
          resetIn: Math.max(0, resetIn),
        }
      }

      // Record this request
      validRequests.push(now)
      this.requests.set(identifier, validRequests)

      return {
        allowed: true,
        remaining: this.maxRequests - validRequests.length,
        resetIn: this.windowMs,
      }
    }

    reset(identifier: string): void {
      this.requests.delete(identifier)
    }
  }

  describe("Standard Rate Limiter", () => {
    let rateLimiter: TestRateLimiter

    beforeEach(() => {
      // 60 requests per minute
      rateLimiter = new TestRateLimiter(60, 60000)
    })

    it("should allow requests under the limit", () => {
      const result = rateLimiter.check("test-ip")
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(59)
    })

    it("should track remaining requests correctly", () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.check("test-ip")
      }
      const result = rateLimiter.check("test-ip")
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(49)
    })

    it("should block when limit reached", () => {
      for (let i = 0; i < 60; i++) {
        rateLimiter.check("test-ip")
      }
      const result = rateLimiter.check("test-ip")
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it("should track different IPs separately", () => {
      for (let i = 0; i < 60; i++) {
        rateLimiter.check("ip-1")
      }

      // ip-1 should be blocked
      expect(rateLimiter.check("ip-1").allowed).toBe(false)

      // ip-2 should still be allowed
      expect(rateLimiter.check("ip-2").allowed).toBe(true)
    })

    it("should reset after time window", () => {
      // Use fake timers
      vi.useFakeTimers()

      for (let i = 0; i < 60; i++) {
        rateLimiter.check("test-ip")
      }
      expect(rateLimiter.check("test-ip").allowed).toBe(false)

      // Advance time past the window
      vi.advanceTimersByTime(61000)

      // Should be allowed again
      expect(rateLimiter.check("test-ip").allowed).toBe(true)

      vi.useRealTimers()
    })
  })

  describe("Auth Rate Limiter (Strict)", () => {
    let rateLimiter: TestRateLimiter

    beforeEach(() => {
      // 5 requests per minute for auth
      rateLimiter = new TestRateLimiter(5, 60000)
    })

    it("should have stricter limits", () => {
      for (let i = 0; i < 5; i++) {
        rateLimiter.check("test-ip")
      }
      const result = rateLimiter.check("test-ip")
      expect(result.allowed).toBe(false)
    })
  })

  describe("Enrichment Rate Limiter (Strict)", () => {
    let rateLimiter: TestRateLimiter

    beforeEach(() => {
      // 10 requests per minute for enrichment
      rateLimiter = new TestRateLimiter(10, 60000)
    })

    it("should have strict limits for expensive operations", () => {
      for (let i = 0; i < 10; i++) {
        rateLimiter.check("test-ip")
      }
      const result = rateLimiter.check("test-ip")
      expect(result.allowed).toBe(false)
    })
  })
})

describe("IP Extraction Logic", () => {
  function extractIp(headers: Record<string, string | undefined>): string {
    // X-Forwarded-For may contain multiple IPs - take the first (client IP)
    const forwarded = headers["x-forwarded-for"]
    if (forwarded) {
      const ips = forwarded.split(",").map(ip => ip.trim())
      return ips[0] || "unknown"
    }

    // Fallback to X-Real-IP
    const realIp = headers["x-real-ip"]
    if (realIp) {
      return realIp
    }

    return "unknown"
  }

  it("should extract IP from X-Forwarded-For", () => {
    const ip = extractIp({ "x-forwarded-for": "192.168.1.1" })
    expect(ip).toBe("192.168.1.1")
  })

  it("should handle multiple IPs in X-Forwarded-For", () => {
    const ip = extractIp({ "x-forwarded-for": "192.168.1.1, 10.0.0.1, 172.16.0.1" })
    expect(ip).toBe("192.168.1.1")
  })

  it("should fallback to X-Real-IP", () => {
    const ip = extractIp({ "x-real-ip": "192.168.1.1" })
    expect(ip).toBe("192.168.1.1")
  })

  it("should prefer X-Forwarded-For over X-Real-IP", () => {
    const ip = extractIp({
      "x-forwarded-for": "192.168.1.1",
      "x-real-ip": "10.0.0.1",
    })
    expect(ip).toBe("192.168.1.1")
  })

  it("should return unknown when no IP headers", () => {
    const ip = extractIp({})
    expect(ip).toBe("unknown")
  })
})
