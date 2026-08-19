import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { isAdmin, normaliseTier } from "@/lib/entitlements"

// GET all users with their credit info (admin only)
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is admin
  const adminCheck = await isAdmin(user.id)
  if (!adminCheck) {
    return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 })
  }

  // Use service role to list all users
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get all users from auth
  const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers()

  if (listError) {
    console.error("[Admin] Error listing users:", listError)
    return NextResponse.json({ error: "Failed to list users" }, { status: 500 })
  }

  // Get credit info for all users
  const { data: creditsData, error: creditsError } = await supabaseAdmin
    .from('user_credits')
    .select('*')

  const creditsMap = new Map(
    (creditsData || []).map((c: any) => [c.user_id, c])
  )

  const users = authUsers.users.map(u => {
    const record = creditsMap.get(u.id)
    return {
      id: u.id,
      email: u.email,
      // A missing record is an unknown, and the lowest tier is the safe read.
      tier: normaliseTier(record?.tier),
      hasRecord: Boolean(record),
      is_active: record?.is_active ?? true,
      deactivated_at: record?.deactivated_at || null,
      deactivation_reason: record?.deactivation_reason || null,
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      usage: record ? {
        saved_properties_count: record.saved_properties_count,
        saved_searches_count: record.saved_searches_count,
        active_price_alerts_count: record.active_price_alerts_count,
        property_views_today: record.property_views_today ?? 0,
      } : null
    }
  })

  const stats = {
    total_users: users.length,
    admin_count: users.filter(u => u.tier === 'admin').length,
    pro_count: users.filter(u => u.tier === 'pro').length,
    free_count: users.filter(u => u.tier === 'free').length,
    // "Active today" used to mean credits_used > 0, which was 0 for every
    // account ever — so the figure always read zero. It now counts accounts
    // that have taken a property view today.
    active_today: users.filter(u => (u.usage?.property_views_today ?? 0) > 0).length,
    deactivated_count: users.filter(u => !u.is_active).length
  }

  return NextResponse.json({ users, stats })
}

// Role changes live at /api/admin/users/[userId]/tier, which validates the
// tier, refuses an admin demoting themselves, and writes an audit row.
//
// The PATCH that used to sit here set `is_premium: true` in user metadata for
// EVERY user it touched, whatever role was being assigned. That is why all
// five accounts held the flag and the premium gate passed everybody.
