import { createServiceRoleClient } from "./supabase/server"

/**
 * WHAT A USER IS ALLOWED TO DO — the single source of truth.
 *
 * This replaces two systems that overlapped and could disagree:
 *
 *   1. `user_credits.role` ('admin' | 'standard_pro') with a per-action credit
 *      price for twelve actions. Measured 2026-08-19 across every account:
 *      `credits_used` was 0 for all of them. It never charged anyone.
 *   2. `auth.users.raw_user_meta_data.is_premium`, a hand-set flag that hard
 *      locked owner and contact data. Measured the same day: true for all five
 *      users, so it gated nobody.
 *
 * Owner data was gated by BOTH — a Premium lock and a 2-3 credit deduction on
 * the same click. The API blended the two sources (`role === 'admin' ||
 * is_premium`) while the UI read only the metadata flag, so an admin without
 * the flag saw locks the API would have opened.
 *
 * One column, `user_credits.tier`, now answers the question everywhere.
 */

export type Tier = "free" | "pro" | "admin"

export const TIERS: readonly Tier[] = ["free", "pro", "admin"] as const

/**
 * A capability is something a tier can or cannot do at all. Anything that is
 * merely "how many" belongs in TIER_LIMITS instead — keeping the two apart is
 * what stopped the old system asking "can you?" and "how many left?" in the
 * same breath and answering with two different mechanisms.
 */
export type Capability =
  | "owner_data"        // owner name, company, directors, licence holder
  | "contact_data"      // phone, email, correspondence address
  | "export"            // CSV and PDF export of a chosen set
  | "admin_console"

export interface TierLimits {
  /** Property detail views per day. null means no limit. */
  propertyViewsPerDay: number | null
  savedProperties: number | null
  savedSearches: number | null
  priceAlerts: number | null
}

const CAPABILITIES: Record<Tier, readonly Capability[]> = {
  free: [],
  pro: ["owner_data", "contact_data", "export"],
  admin: ["owner_data", "contact_data", "export", "admin_console"],
}

export const TIER_LIMITS: Record<Tier, TierLimits> = {
  free: {
    propertyViewsPerDay: 20,
    savedProperties: 10,
    savedSearches: 3,
    priceAlerts: 3,
  },
  pro: {
    propertyViewsPerDay: null,
    savedProperties: 100,
    savedSearches: 10,
    priceAlerts: 10,
  },
  admin: {
    propertyViewsPerDay: null,
    savedProperties: null,
    savedSearches: null,
    priceAlerts: null,
  },
}

/** Display names. Used in UI copy so a tier is never spelled two ways. */
export const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  pro: "Pro",
  admin: "Admin",
}

export type ResourceType = "saved_properties" | "saved_searches" | "price_alerts"

const RESOURCE_LIMIT_KEY: Record<ResourceType, keyof TierLimits> = {
  saved_properties: "savedProperties",
  saved_searches: "savedSearches",
  price_alerts: "priceAlerts",
}

const RESOURCE_COUNT_COLUMN: Record<ResourceType, string> = {
  saved_properties: "saved_properties_count",
  saved_searches: "saved_searches_count",
  price_alerts: "active_price_alerts_count",
}

/**
 * Pure: can this tier do this at all?
 *
 * Deliberately takes a tier rather than a user id, so the policy can be tested
 * without a database and read without tracing a query.
 */
export function can(tier: Tier, capability: Capability): boolean {
  return CAPABILITIES[tier].includes(capability)
}

/** Pure: the limit for a resource, or null where the tier has none. */
export function limitFor(tier: Tier, resource: ResourceType): number | null {
  return TIER_LIMITS[tier][RESOURCE_LIMIT_KEY[resource]]
}

/**
 * Pure: is this user at their cap?
 *
 * `null` limit means unlimited, which is NOT the same as a limit of zero — the
 * old code used 999999 for "unlimited" and that number leaked into the UI.
 */
export function isAtCap(tier: Tier, resource: ResourceType, current: number): boolean {
  const limit = limitFor(tier, resource)
  if (limit === null) return false
  return current >= limit
}

/**
 * Pure: what a reader should be told when a capability is missing.
 *
 * Returns null when the tier has the capability, so a caller can use it
 * directly as "the reason this is locked, if it is".
 */
export function lockReason(tier: Tier, capability: Capability): string | null {
  if (can(tier, capability)) return null
  switch (capability) {
    case "owner_data":
      return "Owner details are part of Pro."
    case "contact_data":
      return "Contact details are part of Pro."
    case "export":
      return "Exporting a saved set is part of Pro."
    case "admin_console":
      return "This area is internal."
  }
}

export interface UserEntitlements {
  userId: string
  tier: Tier
  limits: TierLimits
  savedPropertiesCount: number
  savedSearchesCount: number
  activePriceAlertsCount: number
  propertyViewsToday: number
}

function rowToEntitlements(userId: string, row: Record<string, unknown>): UserEntitlements {
  const tier = normaliseTier(row.tier)
  return {
    userId,
    tier,
    limits: TIER_LIMITS[tier],
    savedPropertiesCount: Number(row.saved_properties_count ?? 0),
    savedSearchesCount: Number(row.saved_searches_count ?? 0),
    activePriceAlertsCount: Number(row.active_price_alerts_count ?? 0),
    propertyViewsToday: Number(row.property_views_today ?? 0),
  }
}

/**
 * An unrecognised value is treated as 'free' rather than trusted or thrown on.
 * A row that somehow holds a tier this build does not know about must not be
 * read as granting more than the lowest tier.
 */
export function normaliseTier(value: unknown): Tier {
  return TIERS.includes(value as Tier) ? (value as Tier) : "free"
}

/**
 * Read a user's entitlements. Returns null when there is no row, which callers
 * must treat as "not entitled" rather than defaulting to a tier — a missing row
 * is an unknown, and the old code's `|| 150` style fallbacks are exactly how a
 * missing fact became a granted one.
 */
export async function getUserEntitlements(userId: string): Promise<UserEntitlements | null> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from("user_credits")
    .select(
      "tier, saved_properties_count, saved_searches_count, active_price_alerts_count, property_views_today, views_reset_at",
    )
    .eq("user_id", userId)
    .single()

  if (error || !data) return null

  const row = data as Record<string, unknown>

  // The daily view counter resets at midnight UTC. Reading a stale counter as
  // today's would lock a Free user out of views they have not taken.
  if (isStaleViewWindow(row.views_reset_at as string | null)) {
    row.property_views_today = 0
  }

  return rowToEntitlements(userId, row)
}

/** Exported for tests: has the counter's day rolled over? */
export function isStaleViewWindow(resetAt: string | null, now: Date = new Date()): boolean {
  if (!resetAt) return true
  const reset = new Date(resetAt)
  if (Number.isNaN(reset.getTime())) return true
  return (
    reset.getUTCFullYear() !== now.getUTCFullYear() ||
    reset.getUTCMonth() !== now.getUTCMonth() ||
    reset.getUTCDate() !== now.getUTCDate()
  )
}

export async function getUserTier(userId: string): Promise<Tier | null> {
  const ent = await getUserEntitlements(userId)
  return ent?.tier ?? null
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getUserTier(userId)) === "admin"
}

export interface CapCheck {
  allowed: boolean
  tier: Tier
  current: number
  limit: number | null
  reason?: string
}

/**
 * Check a resource cap without consuming anything. Capacity is the only thing
 * that is counted now; nothing is priced.
 */
export async function checkResourceCap(
  userId: string,
  resource: ResourceType,
): Promise<CapCheck> {
  const ent = await getUserEntitlements(userId)

  if (!ent) {
    return {
      allowed: false,
      tier: "free",
      current: 0,
      limit: limitFor("free", resource),
      reason: "No account record found.",
    }
  }

  const current =
    resource === "saved_properties"
      ? ent.savedPropertiesCount
      : resource === "saved_searches"
        ? ent.savedSearchesCount
        : ent.activePriceAlertsCount

  const limit = limitFor(ent.tier, resource)

  if (isAtCap(ent.tier, resource, current)) {
    return {
      allowed: false,
      tier: ent.tier,
      current,
      limit,
      reason: capMessage(ent.tier, resource, limit),
    }
  }

  return { allowed: true, tier: ent.tier, current, limit }
}

/** Pure, so the wording is testable and stated once. */
export function capMessage(tier: Tier, resource: ResourceType, limit: number | null): string {
  if (limit === null) return ""
  const noun =
    resource === "saved_properties"
      ? "saved properties"
      : resource === "saved_searches"
        ? "saved searches"
        : "price alerts"
  const upgrade = tier === "free" ? " Pro raises this limit." : ""
  return `You have reached your limit of ${limit} ${noun}.${upgrade}`
}

/** Check a capability for a user id. Convenience over getUserEntitlements. */
export async function userCan(userId: string, capability: Capability): Promise<boolean> {
  const tier = await getUserTier(userId)
  if (!tier) return false
  return can(tier, capability)
}

/**
 * Keep the stored resource counts in step. Counts are stored rather than
 * derived because the caps are read on every write path and a COUNT(*) per
 * check was the reason they were denormalised in the first place.
 */
export async function updateResourceCount(
  userId: string,
  resource: ResourceType,
  delta: number,
): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const column = RESOURCE_COUNT_COLUMN[resource]

  const { data: current } = await supabase
    .from("user_credits")
    .select(column)
    .eq("user_id", userId)
    .single()

  if (!current) return false

  const currentValue = (current as unknown as Record<string, number>)[column] || 0
  const newCount = Math.max(0, currentValue + delta)

  const { error } = await supabase
    .from("user_credits")
    .update({ [column]: newCount, updated_at: new Date().toISOString() })
    .eq("user_id", userId)

  return !error
}

export interface ViewCheck {
  allowed: boolean
  tier: Tier
  used: number
  limit: number | null
  remaining: number | null
  reason?: string
}

/**
 * Property detail views are the one thing Free meters by volume. Pro and Admin
 * have no limit, so this returns early for them rather than counting.
 */
export async function checkPropertyViewAllowance(userId: string): Promise<ViewCheck> {
  const ent = await getUserEntitlements(userId)

  if (!ent) {
    return {
      allowed: false,
      tier: "free",
      used: 0,
      limit: TIER_LIMITS.free.propertyViewsPerDay,
      remaining: 0,
      reason: "No account record found.",
    }
  }

  const limit = ent.limits.propertyViewsPerDay
  if (limit === null) {
    return { allowed: true, tier: ent.tier, used: ent.propertyViewsToday, limit: null, remaining: null }
  }

  const remaining = Math.max(0, limit - ent.propertyViewsToday)
  if (remaining === 0) {
    return {
      allowed: false,
      tier: ent.tier,
      used: ent.propertyViewsToday,
      limit,
      remaining: 0,
      reason: `You have used your ${limit} property views for today. Pro removes the limit.`,
    }
  }

  return { allowed: true, tier: ent.tier, used: ent.propertyViewsToday, limit, remaining }
}

/**
 * Record a property view against the daily counter. Only Free is metered, so
 * this is a no-op for the other tiers rather than a write nobody reads.
 */
export async function recordPropertyView(userId: string): Promise<void> {
  const ent = await getUserEntitlements(userId)
  if (!ent || ent.limits.propertyViewsPerDay === null) return

  const supabase = createServiceRoleClient()
  await supabase
    .from("user_credits")
    .update({
      property_views_today: ent.propertyViewsToday + 1,
      views_reset_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
}
