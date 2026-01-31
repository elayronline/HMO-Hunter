import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getUserCredits, formatCreditStatus, getTimeUntilReset } from "@/lib/credits"

export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const credits = await getUserCredits(user.id)

  if (!credits) {
    return NextResponse.json({ error: "Credits record not found" }, { status: 404 })
  }

  const status = formatCreditStatus(credits)
  const resetTime = getTimeUntilReset()

  return NextResponse.json({
    role: credits.role,
    isAdmin: credits.role === 'admin',

    // Daily credits
    credits: {
      remaining: status.creditsRemaining,
      total: status.creditsTotal,
      used: credits.credits_used,
      percentUsed: status.percentUsed,
    },

    // Free property views
    freePropertyViews: {
      remaining: status.freeViewsRemaining,
      total: credits.free_property_views_limit,
      used: credits.free_property_views_used,
    },

    // Resource caps
    resources: {
      savedProperties: {
        current: credits.saved_properties_count,
        limit: credits.saved_properties_limit,
      },
      savedSearches: {
        current: credits.saved_searches_count,
        limit: credits.saved_searches_limit,
      },
      priceAlerts: {
        current: credits.active_price_alerts_count,
        limit: credits.active_price_alerts_limit,
      },
    },

    // Status
    isWarning: status.isWarning,
    isBlocked: status.isBlocked,

    // Reset info
    resetIn: resetTime.formatted,
    resetAt: new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate() + 1,
      0, 0, 0, 0
    )).toISOString(),

    lastResetAt: credits.last_reset_at,
  })
}
