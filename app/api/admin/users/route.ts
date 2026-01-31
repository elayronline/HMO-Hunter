import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { isAdmin } from "@/lib/credits"

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
    const credits = creditsMap.get(u.id)
    return {
      id: u.id,
      email: u.email,
      role: credits?.role || 'standard_pro',
      created_at: u.created_at,
      last_sign_in: u.last_sign_in_at,
      credits: credits ? {
        daily_credits: credits.daily_credits,
        credits_used: credits.credits_used,
        saved_properties_count: credits.saved_properties_count,
        saved_searches_count: credits.saved_searches_count,
        active_price_alerts_count: credits.active_price_alerts_count,
      } : null
    }
  })

  // Calculate stats
  const stats = {
    total_users: users.length,
    admin_count: users.filter(u => u.role === 'admin').length,
    standard_pro_count: users.filter(u => u.role === 'standard_pro').length,
    active_today: users.filter(u => {
      const credits = creditsMap.get(u.id)
      return credits?.credits_used > 0
    }).length
  }

  return NextResponse.json({ users, stats })
}

// PATCH - Update user role (admin only)
export async function PATCH(request: NextRequest) {
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

  const { userId, role } = await request.json()

  if (!userId || !role || !['admin', 'standard_pro'].includes(role)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  // Use service role to update
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Update user_credits table
  const { error: creditsError } = await supabaseAdmin
    .from('user_credits')
    .update({
      role,
      daily_credits: role === 'admin' ? 999999 : 150,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)

  if (creditsError) {
    console.error("[Admin] Error updating credits:", creditsError)
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 })
  }

  // Update user metadata
  const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      role,
      is_admin: role === 'admin',
      is_premium: true
    }
  })

  if (authUpdateError) {
    console.error("[Admin] Error updating auth:", authUpdateError)
  }

  return NextResponse.json({ success: true })
}
