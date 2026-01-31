import { NextRequest, NextResponse } from "next/server"

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store for rate limiting
// For production, use Redis or similar
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 60000) // Clean up every minute

interface RateLimitOptions {
  maxRequests: number  // Maximum requests allowed in the window
  windowMs: number     // Time window in milliseconds
  keyPrefix?: string   // Optional prefix for the rate limit key
}

/**
 * Rate limit check for API routes
 * Returns null if allowed, or a NextResponse if rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): NextResponse | null {
  const { maxRequests, windowMs, keyPrefix = "" } = options

  // Get client identifier (IP address or forwarded IP)
  const forwarded = request.headers.get("x-forwarded-for")
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"

  // Create rate limit key
  const key = `${keyPrefix}:${ip}`

  const now = Date.now()
  let entry = rateLimitStore.get(key)

  // Initialize or reset if window expired
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + windowMs
    }
  }

  entry.count++
  rateLimitStore.set(key, entry)

  // Check if rate limited
  if (entry.count > maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000)

    return NextResponse.json(
      {
        error: "Too many requests",
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetTime / 1000))
        }
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
  // Standard API endpoints - 60 requests per minute
  standard: { maxRequests: 60, windowMs: 60 * 1000 },

  // Enrichment endpoints - 10 requests per minute (these are expensive)
  enrichment: { maxRequests: 10, windowMs: 60 * 1000 },

  // Auth endpoints - 5 requests per minute (prevent brute force)
  auth: { maxRequests: 5, windowMs: 60 * 1000 },

  // Admin endpoints - 20 requests per minute
  admin: { maxRequests: 20, windowMs: 60 * 1000 },

  // Search/filter endpoints - 30 requests per minute
  search: { maxRequests: 30, windowMs: 60 * 1000 }
} as const
