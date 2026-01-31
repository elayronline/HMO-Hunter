import { createServiceRoleClient } from "./supabase/server"

// Credit costs for each action
export const CREDIT_COSTS = {
  property_view: 1,        // After 20 free views
  contact_data_view: 2,
  contact_data_copy: 3,
  save_property: 1,
  save_search: 2,
  create_price_alert: 5,
  csv_export: 10,
} as const

export type CreditAction = keyof typeof CREDIT_COSTS

// Resource types that have caps (not credit-based)
export type ResourceType = 'saved_properties' | 'saved_searches' | 'price_alerts'

export interface UserCredits {
  id: string
  user_id: string
  role: 'admin' | 'standard_pro'
  daily_credits: number
  credits_used: number
  free_property_views_used: number
  free_property_views_limit: number
  saved_properties_count: number
  saved_properties_limit: number
  saved_searches_count: number
  saved_searches_limit: number
  active_price_alerts_count: number
  active_price_alerts_limit: number
  last_reset_at: string
  created_at: string
  updated_at: string
}

export interface CreditDeductionResult {
  success: boolean
  error?: string
  is_admin?: boolean
  free_view_used?: boolean
  free_views_remaining?: number
  credits_deducted?: number
  credits_remaining?: number
  credits_total?: number
  credits_required?: number
  warning?: string | null
  reset_at?: string
  message?: string
}

export interface ResourceCapResult {
  success: boolean
  error?: string
  is_admin?: boolean
  current?: number
  limit?: number
  warning?: string | null
  resource?: string
}

/**
 * Get user's current credit balance and usage
 */
export async function getUserCredits(userId: string): Promise<UserCredits | null> {
  const supabase = createServiceRoleClient()

  // First, trigger the reset check
  const { data: resetData } = await supabase
    .rpc('check_and_reset_daily_credits', { p_user_id: userId })

  if (resetData) {
    return resetData as UserCredits
  }

  // Fallback to direct query
  const { data, error } = await supabase
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return null
  }

  return data as UserCredits
}

/**
 * Deduct credits for an action
 * Returns success/failure and remaining credits
 */
export async function deductCredits(
  userId: string,
  action: CreditAction,
  count: number = 1
): Promise<CreditDeductionResult> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .rpc('deduct_credits', {
      p_user_id: userId,
      p_action: action,
      p_count: count
    })

  if (error) {
    return {
      success: false,
      error: error.message
    }
  }

  return data as CreditDeductionResult
}

/**
 * Check if user can perform an action (without deducting)
 */
export async function canPerformAction(
  userId: string,
  action: CreditAction,
  count: number = 1
): Promise<{ allowed: boolean; reason?: string; warning?: string }> {
  const credits = await getUserCredits(userId)

  if (!credits) {
    return { allowed: false, reason: 'User credits not found' }
  }

  // Admins can do anything
  if (credits.role === 'admin') {
    return { allowed: true }
  }

  // Special handling for property views (free views)
  if (action === 'property_view') {
    if (credits.free_property_views_used < credits.free_property_views_limit) {
      const freeRemaining = credits.free_property_views_limit - credits.free_property_views_used
      if (freeRemaining <= 5) {
        return {
          allowed: true,
          warning: `${freeRemaining} free property views remaining today`
        }
      }
      return { allowed: true }
    }
  }

  const cost = CREDIT_COSTS[action] * count
  const remaining = credits.daily_credits - credits.credits_used
  const warningThreshold = Math.floor(credits.daily_credits * 0.2) // 20% remaining

  if (remaining < cost) {
    return {
      allowed: false,
      reason: `Insufficient credits. Need ${cost}, have ${remaining}. Resets at midnight UTC.`
    }
  }

  if (remaining - cost <= warningThreshold) {
    return {
      allowed: true,
      warning: `${remaining - cost} credits remaining after this action`
    }
  }

  return { allowed: true }
}

/**
 * Check resource cap (saved properties, searches, alerts)
 */
export async function checkResourceCap(
  userId: string,
  resource: ResourceType
): Promise<ResourceCapResult> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .rpc('check_resource_cap', {
      p_user_id: userId,
      p_resource: resource
    })

  if (error) {
    return {
      success: false,
      error: error.message
    }
  }

  return data as ResourceCapResult
}

/**
 * Update resource count after adding/removing items
 */
export async function updateResourceCount(
  userId: string,
  resource: ResourceType,
  delta: number
): Promise<boolean> {
  const supabase = createServiceRoleClient()

  const columnMap: Record<ResourceType, string> = {
    saved_properties: 'saved_properties_count',
    saved_searches: 'saved_searches_count',
    price_alerts: 'active_price_alerts_count'
  }

  const column = columnMap[resource]

  // First get current count
  const { data: current } = await supabase
    .from('user_credits')
    .select(column)
    .eq('user_id', userId)
    .single()

  if (!current) return false

  const currentValue = (current as unknown as Record<string, number>)[column] || 0
  const newCount = Math.max(0, currentValue + delta)

  const { error } = await supabase
    .from('user_credits')
    .update({
      [column]: newCount,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)

  return !error
}

/**
 * Get time until next credit reset (midnight UTC)
 */
export function getTimeUntilReset(): { hours: number; minutes: number; formatted: string } {
  const now = new Date()
  const utcMidnight = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ))

  const diff = utcMidnight.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  return {
    hours,
    minutes,
    formatted: `${hours}h ${minutes}m`
  }
}

/**
 * Format credit usage for display
 */
export function formatCreditStatus(credits: UserCredits): {
  creditsRemaining: number
  creditsTotal: number
  percentUsed: number
  freeViewsRemaining: number
  isWarning: boolean
  isBlocked: boolean
} {
  const creditsRemaining = credits.daily_credits - credits.credits_used
  const percentUsed = Math.round((credits.credits_used / credits.daily_credits) * 100)

  return {
    creditsRemaining,
    creditsTotal: credits.daily_credits,
    percentUsed,
    freeViewsRemaining: credits.free_property_views_limit - credits.free_property_views_used,
    isWarning: percentUsed >= 80 && percentUsed < 100,
    isBlocked: percentUsed >= 100
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const credits = await getUserCredits(userId)
  return credits?.role === 'admin'
}
