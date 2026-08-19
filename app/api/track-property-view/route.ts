import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkPropertyViewAllowance, recordPropertyView } from "@/lib/entitlements"

// POST - Meter a property view. Free is capped per day; Pro and Admin are not.
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { propertyId } = await request.json()

    if (!propertyId) {
      return NextResponse.json({ error: "Property ID required" }, { status: 400 })
    }

    // Views are the one thing Free meters by volume. The allowance check
    // returns early for tiers with no limit rather than counting something
    // nothing reads.
    const allowance = await checkPropertyViewAllowance(user.id)

    if (!allowance.allowed) {
      return NextResponse.json(
        {
          error: allowance.reason,
          limitReached: true,
          tier: allowance.tier,
          limit: allowance.limit,
        },
        { status: 429 },
      )
    }

    await recordPropertyView(user.id)

    return NextResponse.json({
      success: true,
      tier: allowance.tier,
      limit: allowance.limit,
      // null remaining means the tier has no limit, which is not the same as
      // none left. Callers must not render it as a number.
      viewsRemaining: allowance.remaining === null ? null : Math.max(0, allowance.remaining - 1),
    })
  } catch (error) {
    console.error("[TrackPropertyView] Error:", error)
    return NextResponse.json({ error: "Failed to track property view" }, { status: 500 })
  }
}
