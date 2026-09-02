/**
 * Upstash Redis Client + Distributed Rate Limiting + Cache
 *
 * Replaces in-memory Map with Upstash Redis for:
 * - Multi-instance rate limiting (serverless safe)
 * - Distributed caching across Vercel functions
 * - TTL-based auto-expiry (no memory leaks)
 *
 * Setup: Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local
 * Get keys from: https://console.upstash.com
 *
 * Falls back to in-memory when Redis is not configured.
 */

import { Redis } from "@upstash/redis"
import { Ratelimit } from "@upstash/ratelimit"
import { NextResponse, type NextRequest } from "next/server"
import { RATE_LIMITS, checkRateLimit, type RateLimitPreset } from "@/lib/rate-limit"

// ============================================================
// REDIS CLIENT
// ============================================================

let redisClient: Redis | null = null

/**
 * Two naming conventions reach the same instance, and both have to work.
 *
 * Provisioning Upstash through the Vercel Marketplace injects KV_REST_API_URL
 * and KV_REST_API_TOKEN. Signing up at upstash.com directly gives you
 * UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN. This module read only
 * the second pair, so the marketplace install — the route Vercel actually
 * recommends — provisioned a working Redis that the application then ignored,
 * silently falling back to the per-instance counter it was meant to replace.
 *
 * Reading both is not a compatibility shim; it is the honest description of how
 * this credential arrives. The Upstash names are preferred because they say
 * what the service is: KV_REST_API_URL would equally describe Vercel KV,
 * Cloudflare KV or anything else behind a REST key-value API.
 */
function redisCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  return url && token ? { url, token } : null
}

export function getRedis(): Redis | null {
  if (redisClient) return redisClient

  const credentials = redisCredentials()
  if (!credentials) return null

  redisClient = new Redis(credentials)
  return redisClient
}

export function isRedisConfigured(): boolean {
  return redisCredentials() !== null
}

// ============================================================
// DISTRIBUTED RATE LIMITING
// ============================================================

let rateLimiters: Record<RateLimitPreset, Ratelimit> | null = null

/**
 * The limiters, built from RATE_LIMITS so the two paths cannot disagree.
 *
 * These were previously a second hardcoded copy of the same six numbers. They
 * happened to match, which is worse than not matching: nothing would have
 * caught the day they stopped, and the effective limit would then depend on
 * whether Redis was configured — a rate limit that changes silently with
 * deployment configuration is not a rate limit anyone can reason about.
 */
function getRateLimiters(): Record<RateLimitPreset, Ratelimit> | null {
  if (rateLimiters) return rateLimiters

  const redis = getRedis()
  if (!redis) return null

  const build = (preset: RateLimitPreset) =>
    new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        RATE_LIMITS[preset].maxRequests,
        `${Math.round(RATE_LIMITS[preset].windowMs / 1000)} s`
      ),
      prefix: `rl:${preset}`,
    })

  rateLimiters = {
    standard: build("standard"),
    enrichment: build("enrichment"),
    auth: build("auth"),
    admin: build("admin"),
    search: build("search"),
    cron: build("cron"),
  }

  return rateLimiters
}

/**
 * Check rate limit using Upstash Redis (distributed).
 * Returns { success, remaining, reset } or null if Redis not configured.
 */
export async function checkDistributedRateLimit(
  identifier: string,
  preset: "standard" | "enrichment" | "auth" | "admin" | "search" | "cron"
): Promise<{ success: boolean; remaining: number; reset: number } | null> {
  const limiters = getRateLimiters()
  if (!limiters) return null // Fall back to in-memory

  const limiter = limiters[preset]
  if (!limiter) return null

  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    remaining: result.remaining,
    reset: result.reset,
  }
}

/**
 * The rate limit middleware enforces — distributed where possible, local where not.
 *
 * ORDER MATTERS AND SO DOES THE FALLBACK
 *
 * Redis is asked first because it is the only one of the two that can count
 * across instances. When it is unconfigured, checkDistributedRateLimit returns
 * null and this drops to the per-instance counter rather than allowing the
 * request unchecked: a missing environment variable must not silently remove a
 * protection.
 *
 * When Redis is configured but UNREACHABLE, the same thing happens, and that is
 * a deliberate trade. Failing closed on a rate limiter means an Upstash outage
 * takes the whole site down; failing open entirely means an outage removes the
 * limit. Falling back to the local counter keeps a limit in force — a weaker
 * one, per instance — and the error is logged rather than swallowed so the
 * degradation is visible.
 */
export async function enforceRateLimit(
  request: NextRequest,
  preset: RateLimitPreset,
  keyPrefix: string
): Promise<NextResponse | null> {
  const { maxRequests, windowMs } = RATE_LIMITS[preset]

  if (isRedisConfigured()) {
    try {
      const forwarded = request.headers.get("x-forwarded-for")
      const ip =
        forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown"
      const result = await checkDistributedRateLimit(`${keyPrefix}:${ip}`, preset)

      if (result) {
        if (result.success) return null
        const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
        return NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Try again in ${retryAfter}s.`,
            retryAfter,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(maxRequests),
              "X-RateLimit-Remaining": String(Math.max(0, result.remaining)),
              "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
            },
          }
        )
      }
    } catch (error) {
      // Visible, not swallowed: the site is now rate limiting per instance.
      console.error("[RateLimit] Redis unavailable, falling back to in-memory:", error)
    }
  }

  return checkRateLimit(request, { maxRequests, windowMs, keyPrefix })
}

// ============================================================
// DISTRIBUTED CACHE
// ============================================================

/**
 * Get a cached value from Redis.
 */
export async function redisGet<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null

  try {
    return await redis.get<T>(key)
  } catch {
    return null
  }
}

/**
 * Set a value in Redis with TTL.
 */
export async function redisSet<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false

  try {
    await redis.set(key, value, { ex: ttlSeconds })
    return true
  } catch {
    return false
  }
}

/**
 * Delete a cache key.
 */
export async function redisDel(key: string): Promise<boolean> {
  const redis = getRedis()
  if (!redis) return false

  try {
    await redis.del(key)
    return true
  } catch {
    return false
  }
}

/**
 * Cache-through with Redis: get from cache or compute + cache.
 * Falls back to direct computation if Redis not available.
 */
export async function redisCacheThrough<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>
): Promise<T> {
  // Try Redis first
  const cached = await redisGet<T>(key)
  if (cached !== null) return cached

  // Compute
  const data = await compute()

  // Cache in Redis (fire-and-forget)
  redisSet(key, data, ttlSeconds).catch(() => {})

  return data
}
