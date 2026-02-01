import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { isAdmin } from "@/lib/credits"

// POST - Adjust user credits (top up, reset, etc.)
export async function POST(
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

  const { adjustment_type, amount, reason } = await request.json()

  // Validate adjustment type
  const validTypes = ['top_up', 'reset', 'bonus', 'penalty']
  if (!validTypes.includes(adjustment_type)) {
    return NextResponse.json({
      error: `Invalid adjustment_type. Must be one of: ${validTypes.join(', ')}`
    }, { status: 400 })
  }

  // Validate amount for types that require it
  if (adjustment_type !== 'reset' && (typeof amount !== 'number' || amount <= 0)) {
    return NextResponse.json({ error: "amount must be a positive number" }, { status: 400 })
  }

  // Use service role to update
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Get current credits
  const { data: currentCredits, error: fetchError } = await supabaseAdmin
    .from('user_credits')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (fetchError || !currentCredits) {
    console.error("[Admin] Error fetching user credits:", fetchError)
    return NextResponse.json({ error: "User not found or has no credits record" }, { status: 404 })
  }

  let newCreditsUsed = currentCredits.credits_used
  let newDailyCredits = currentCredits.daily_credits

  switch (adjustment_type) {
    case 'top_up':
      // Add to daily limit
      newDailyCredits = currentCredits.daily_credits + amount
      break
    case 'reset':
      // Reset credits used to 0
      newCreditsUsed = 0
      break
    case 'bonus':
      // Reduce credits used (effectively giving bonus credits)
      newCreditsUsed = Math.max(0, currentCredits.credits_used - amount)
      break
    case 'penalty':
      // Increase credits used
      newCreditsUsed = currentCredits.credits_used + amount
      break
  }

  // Update user credits
  const { error: updateError } = await supabaseAdmin
    .from('user_credits')
    .update({
      credits_used: newCreditsUsed,
      daily_credits: newDailyCredits,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', userId)

  if (updateError) {
    console.error("[Admin] Error updating credits:", updateError)
    return NextResponse.json({ error: "Failed to update credits" }, { status: 500 })
  }

  // Record the adjustment in audit log
  const { error: auditError } = await supabaseAdmin
    .from('credit_adjustments')
    .insert({
      user_id: userId,
      admin_id: user.id,
      adjustment_type,
      amount: amount || 0,
      reason: reason || `${adjustment_type} by admin`,
      previous_credits_used: currentCredits.credits_used,
      new_credits_used: newCreditsUsed,
      previous_daily_credits: currentCredits.daily_credits,
      new_daily_credits: newDailyCredits
    })

  if (auditError) {
    // Log but don't fail - the credit update succeeded
    console.error("[Admin] Error recording audit:", auditError)
  }

  console.log(`[Admin] Credits adjusted for user ${userId} by admin ${user.id}: ${adjustment_type} ${amount || 'N/A'}`)

  return NextResponse.json({
    success: true,
    adjustment_type,
    previous: {
      credits_used: currentCredits.credits_used,
      daily_credits: currentCredits.daily_credits
    },
    current: {
      credits_used: newCreditsUsed,
      daily_credits: newDailyCredits
    }
  })
}

// GET - Get credit adjustment history for a user
export async function GET(
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

  // Use service role to fetch
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: adjustments, error } = await supabaseAdmin
    .from('credit_adjustments')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    console.error("[Admin] Error fetching adjustments:", error)
    return NextResponse.json({ error: "Failed to fetch adjustments" }, { status: 500 })
  }

  return NextResponse.json({ adjustments })
}
