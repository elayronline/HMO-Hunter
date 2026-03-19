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

// ============================================================
// REDIS CLIENT
// ============================================================

let redisClient: Redis | null = null

export function getRedis(): Redis | null {
  if (redisClient) return redisClient

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  redisClient = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  return redisClient
}

export function isRedisConfigured(): boolean {
  return !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN
}

// ============================================================
// DISTRIBUTED RATE LIMITING
// ============================================================

let rateLimiters: Record<string, Ratelimit> | null = null

function getRateLimiters(): Record<string, Ratelimit> | null {
  if (rateLimiters) return rateLimiters

  const redis = getRedis()
  if (!redis) return null

  rateLimiters = {
    standard: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, "60 s"), prefix: "rl:standard" }),
    enrichment: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, "60 s"), prefix: "rl:enrich" }),
    auth: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, "60 s"), prefix: "rl:auth" }),
    admin: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, "60 s"), prefix: "rl:admin" }),
    search: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, "60 s"), prefix: "rl:search" }),
    cron: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1, "60 s"), prefix: "rl:cron" }),
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
