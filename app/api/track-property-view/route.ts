import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deductCredits, isAdmin, getUserCredits } from "@/lib/credits"

// POST - Track property view and deduct credits (after free views used)
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

    // Check if admin (no credit deduction)
    const adminCheck = await isAdmin(user.id)
    if (adminCheck) {
      return NextResponse.json({
        success: true,
        isAdmin: true,
        freeViewUsed: false,
      })
    }

    // Deduct credits for property view (handles free views internally)
    const creditResult = await deductCredits(user.id, 'property_view')

    if (!creditResult.success) {
      return NextResponse.json({
        error: creditResult.error || "Insufficient credits",
        insufficientCredits: true,
        creditsRemaining: creditResult.credits_remaining,
        resetAt: creditResult.reset_at,
      }, { status: 429 })
    }

    return NextResponse.json({
      success: true,
      freeViewUsed: creditResult.free_view_used || false,
      freeViewsRemaining: creditResult.free_views_remaining,
      creditsRemaining: creditResult.credits_remaining,
      warning: creditResult.warning,
    })
  } catch (error) {
    console.error("[TrackPropertyView] Error:", error)
    return NextResponse.json({ error: "Failed to track property view" }, { status: 500 })
  }
}
