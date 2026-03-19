/**
 * In-Memory Cache with TTL
 *
 * LRU-style cache for property queries to reduce database load.
 * Serverless-safe: no setInterval, uses lazy eviction on access.
 *
 * For production scale: replace with Upstash Redis or Vercel KV.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
  createdAt: number
}

const MAX_ENTRIES = 500 // Cap memory usage

class TTLCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>()

  get(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null

    // Lazy eviction: check TTL on access
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return entry.data
  }

  set(key: string, data: T, ttlMs: number): void {
    // Evict oldest entries if at capacity
    if (this.store.size >= MAX_ENTRIES) {
      const oldestKey = this.store.keys().next().value
      if (oldestKey) this.store.delete(oldestKey)
    }

    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
    })
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  invalidatePattern(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) {
        this.store.delete(key)
      }
    }
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }

  // Lazy cleanup: remove expired entries (call periodically from routes if needed)
  cleanup(): number {
    const now = Date.now()
    let removed = 0
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key)
        removed++
      }
    }
    return removed
  }
}

// Singleton instances for different cache domains
export const propertyCache = new TTLCache()
export const queryCache = new TTLCache()
export const creditCache = new TTLCache()

// TTL presets (milliseconds)
export const CACHE_TTL = {
  propertyList: 5 * 60 * 1000,      // 5 minutes — property search results
  propertyDetail: 10 * 60 * 1000,   // 10 minutes — individual property
  mapData: 2 * 60 * 1000,           // 2 minutes — map tile data
  credits: 30 * 1000,               // 30 seconds — credit balance
  offMarket: 15 * 60 * 1000,        // 15 minutes — off-market leads
  areaStats: 30 * 60 * 1000,        // 30 minutes — area statistics
} as const

/**
 * Cache-through helper: get from cache or compute + cache
 */
export async function cacheThrough<T>(
  cache: TTLCache<T>,
  key: string,
  ttlMs: number,
  compute: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key) as T | null
  if (cached !== null) return cached

  const data = await compute()
  cache.set(key, data, ttlMs)
  return data
}
