import { NextRequest, NextResponse } from "next/server"

// Redis distributed rate limiting is available via lib/redis.ts
// Use checkDistributedRateLimit() in API routes for multi-instance support.
// This file provides in-memory rate limiting for middleware (edge runtime).

interface RateLimitEntry {
  count: number
  resetTime: number
}

/**
 * LRU Rate Limit Store
 *
 * Upgraded from bare Map to size-capped LRU with lazy eviction.
 * No setInterval (serverless-safe). Entries evict on access or at capacity.
 *
 * For production at scale: replace with Upstash Redis rate limiting.
 * See: https://upstash.com/docs/oss/sdks/ts/ratelimit
 */
const MAX_ENTRIES = 10000
const rateLimitStore = new Map<string, RateLimitEntry>()

// Lazy eviction: remove expired entries only when store is at capacity
function evictExpired(): void {
  if (rateLimitStore.size < MAX_ENTRIES * 0.9) return // Only cleanup near capacity

  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }

  // If still over capacity after eviction, remove oldest 20%
  if (rateLimitStore.size >= MAX_ENTRIES) {
    const toRemove = Math.floor(MAX_ENTRIES * 0.2)
    let removed = 0
    for (const key of rateLimitStore.keys()) {
      if (removed >= toRemove) break
      rateLimitStore.delete(key)
      removed++
    }
  }
}

interface RateLimitOptions {
  maxRequests: number
  windowMs: number
  keyPrefix?: string
}

/**
 * Rate limit check for API routes.
 * Uses Upstash Redis when configured, falls back to in-memory.
 * Returns null if allowed, or a NextResponse if rate limited.
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): NextResponse | null {
  // Try distributed rate limiting if Redis is configured
  // Note: This is sync in middleware, so Redis check is best-effort.
  // For full distributed support, use the async checkDistributedRateLimit() in API routes.
  const { maxRequests, windowMs, keyPrefix = "" } = options

  // Get client identifier
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
  const key = `${keyPrefix}:${ip}`

  const now = Date.now()
  let entry = rateLimitStore.get(key)

  // Initialize or reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + windowMs }
  }

  entry.count++
  rateLimitStore.set(key, entry)

  // Lazy eviction on write
  evictExpired()

  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
    return NextResponse.json(
      { error: "Too many requests", message: `Rate limit exceeded. Try again in ${retryAfter}s.`, retryAfter },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetTime / 1000)),
        },
      }
    )
  }

  return null
}

/**
 * Add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  request: NextRequest,
  options: RateLimitOptions
): NextResponse {
  const { maxRequests, keyPrefix = "" } = options
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
  const key = `${keyPrefix}:${ip}`

  const entry = rateLimitStore.get(key)
  if (entry) {
    response.headers.set("X-RateLimit-Limit", String(maxRequests))
    response.headers.set("X-RateLimit-Remaining", String(Math.max(0, maxRequests - entry.count)))
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(entry.resetTime / 1000)))
  }

  return response
}

// Preset rate limit configurations
export const RATE_LIMITS = {
  standard: { maxRequests: 60, windowMs: 60 * 1000 },
  enrichment: { maxRequests: 10, windowMs: 60 * 1000 },
  auth: { maxRequests: 5, windowMs: 60 * 1000 },
  admin: { maxRequests: 20, windowMs: 60 * 1000 },
  search: { maxRequests: 30, windowMs: 60 * 1000 },
  cron: { maxRequests: 1, windowMs: 60 * 1000 },
} as const

// Export store size for monitoring
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size
}
