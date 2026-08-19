import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { TIERS, TIER_LIMITS, isAdmin, normaliseTier, type Tier } from "@/lib/entitlements"

/**
 * Move an account between tiers. Replaces the credit-adjustment endpoint,
 * which topped up, reset, bonused and penalised a balance that nothing ever
 * spent.
 *
 * Every change is written to tier_changes. Changing what somebody may see is
 * exactly the kind of action that needs to be attributable afterwards.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  const body = await request.json()
  const requested = body?.tier

  if (!TIERS.includes(requested as Tier)) {
    return NextResponse.json(
      { error: `Invalid tier. Must be one of: ${TIERS.join(", ")}` },
      { status: 400 },
    )
  }

  const tier = requested as Tier
  const reason = typeof body?.reason === "string" ? body.reason.trim() : ""

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: current, error: fetchError } = await supabaseAdmin
    .from("user_credits")
    .select("tier")
    .eq("user_id", userId)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: "User not found or has no account record" }, { status: 404 })
  }

  const previousTier = normaliseTier(current.tier)

  // An admin removing their own admin tier would lock them out of the page
  // they are standing on, and nobody else may be able to put it back.
  if (userId === user.id && previousTier === "admin" && tier !== "admin") {
    return NextResponse.json(
      { error: "You cannot remove your own admin tier." },
      { status: 400 },
    )
  }

  if (previousTier === tier) {
    return NextResponse.json({ success: true, tier, unchanged: true })
  }

  const limits = TIER_LIMITS[tier]

  const { error: updateError } = await supabaseAdmin
    .from("user_credits")
    .update({
      tier,
      // Stored caps follow the tier. 999999 stands in for "no limit" because
      // the columns are NOT NULL; nothing reads them for an unlimited tier.
      saved_properties_limit: limits.savedProperties ?? 999999,
      saved_searches_limit: limits.savedSearches ?? 999999,
      active_price_alerts_limit: limits.priceAlerts ?? 999999,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)

  if (updateError) {
    console.error("[Admin] Error updating tier:", updateError)
    return NextResponse.json({ error: "Failed to update tier" }, { status: 500 })
  }

  const { error: auditError } = await supabaseAdmin.from("tier_changes").insert({
    user_id: userId,
    admin_id: user.id,
    previous_tier: previousTier,
    new_tier: tier,
    reason: reason || `Moved to ${tier} by admin`,
  })

  if (auditError) {
    // The tier change succeeded; a missing audit row must not be reported as
    // a failed change, but it does need to be visible.
    console.error("[Admin] Tier changed but audit row failed:", auditError)
  }

  return NextResponse.json({
    success: true,
    previousTier,
    tier,
    auditRecorded: !auditError,
  })
}

/** Tier change history for one account. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await isAdmin(user.id))) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: changes, error } = await supabaseAdmin
    .from("tier_changes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("[Admin] Error fetching tier changes:", error)
    return NextResponse.json({ error: "Failed to fetch tier history" }, { status: 500 })
  }

  return NextResponse.json({ changes })
}
