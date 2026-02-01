import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { isAdmin } from "@/lib/credits"

// PATCH - Activate or deactivate a user account
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
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

  // Prevent self-deactivation
  if (userId === user.id) {
    return NextResponse.json({ error: "Cannot modify your own account status" }, { status: 400 })
  }

  const { is_active, reason } = await request.json()

  if (typeof is_active !== 'boolean') {
    return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 })
  }

  // Use service role to update
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Update user_credits table
  const updateData: Record<string, unknown> = {
    is_active,
    updated_at: new Date().toISOString()
  }

  if (!is_active) {
    updateData.deactivated_at = new Date().toISOString()
    updateData.deactivation_reason = reason || 'Deactivated by admin'
  } else {
    updateData.deactivated_at = null
    updateData.deactivation_reason = null
  }

  const { error: creditsError } = await supabaseAdmin
    .from('user_credits')
    .update(updateData)
    .eq('user_id', userId)

  if (creditsError) {
    console.error("[Admin] Error updating account status:", creditsError)
    return NextResponse.json({ error: "Failed to update account status" }, { status: 500 })
  }

  // If deactivating, also sign out all their sessions
  if (!is_active) {
    try {
      await supabaseAdmin.auth.admin.signOut(userId, 'global')
    } catch (err) {
      console.error("[Admin] Error signing out user:", err)
      // Continue anyway - the account is still deactivated
    }
  }

  console.log(`[Admin] User ${userId} ${is_active ? 'reactivated' : 'deactivated'} by admin ${user.id}`)

  return NextResponse.json({
    success: true,
    is_active,
    message: is_active ? 'Account reactivated' : 'Account deactivated'
  })
}
