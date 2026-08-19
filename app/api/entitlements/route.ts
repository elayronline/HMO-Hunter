import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  TIER_LABELS,
  can,
  getUserEntitlements,
  type Capability,
} from "@/lib/entitlements"

/**
 * What this account is allowed to do. Replaces /api/credits, which reported a
 * daily credit balance that was never spent — `credits_used` was 0 for every
 * account in the database when this was written.
 *
 * Limits are reported as `null` where the tier has none. The old endpoint sent
 * 999999 for an admin, and that number reached the UI.
 */
export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ent = await getUserEntitlements(user.id)

  if (!ent) {
    // No row is an unknown, not a tier. Saying "free" here would grant a
    // capability set on the strength of a missing record.
    return NextResponse.json({ error: "No account record found" }, { status: 404 })
  }

  const capabilities: Capability[] = [
    "owner_data",
    "contact_data",
    "export",
    "admin_console",
  ]

  return NextResponse.json({
    tier: ent.tier,
    tierLabel: TIER_LABELS[ent.tier],
    isAdmin: ent.tier === "admin",

    can: Object.fromEntries(capabilities.map((c) => [c, can(ent.tier, c)])),

    propertyViews: {
      used: ent.propertyViewsToday,
      limit: ent.limits.propertyViewsPerDay,
      remaining:
        ent.limits.propertyViewsPerDay === null
          ? null
          : Math.max(0, ent.limits.propertyViewsPerDay - ent.propertyViewsToday),
    },

    resources: {
      savedProperties: {
        current: ent.savedPropertiesCount,
        limit: ent.limits.savedProperties,
      },
      savedSearches: {
        current: ent.savedSearchesCount,
        limit: ent.limits.savedSearches,
      },
      priceAlerts: {
        current: ent.activePriceAlertsCount,
        limit: ent.limits.priceAlerts,
      },
    },
  })
}
