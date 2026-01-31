import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deductCredits, isAdmin } from "@/lib/credits"
import { validateBody } from "@/lib/validation/api-validation"
import { trackContactSchema } from "@/lib/validation/schemas"

// POST - Track contact data view/copy and deduct credits
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Validate request body
  const validation = await validateBody(request, trackContactSchema)
  if (!validation.success) {
    return validation.error
  }

  const { propertyId, action, contactType, contactName } = validation.data

  try {

    // Determine credit cost based on action
    let creditAction: 'contact_data_view' | 'contact_data_copy'
    if (action === 'view') {
      creditAction = 'contact_data_view'
    } else if (action === 'copy') {
      creditAction = 'contact_data_copy'
    } else {
      // For call/email, treat as view
      creditAction = 'contact_data_view'
    }

    // Check if admin (no credit deduction)
    const adminCheck = await isAdmin(user.id)
    let creditsRemaining: number | undefined = undefined
    let creditWarning: string | null | undefined = null

    if (!adminCheck) {
      // Deduct credits
      const creditResult = await deductCredits(user.id, creditAction)

      if (!creditResult.success) {
        return NextResponse.json({
          error: creditResult.error || "Insufficient credits",
          insufficientCredits: true,
          creditsRemaining: creditResult.credits_remaining,
          resetAt: creditResult.reset_at,
        }, { status: 429 })
      }

      creditsRemaining = creditResult.credits_remaining
      creditWarning = creditResult.warning
    }

    // Log the access for GDPR compliance
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}/api/gdpr/log-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          ownerName: contactName,
          dataAccessed: [contactType, action],
          accessType: action,
        }),
      })
    } catch (logError) {
      console.error("[TrackContact] Failed to log GDPR access:", logError)
    }

    return NextResponse.json({
      success: true,
      creditsRemaining,
      warning: creditWarning,
    })
  } catch (error) {
    console.error("[TrackContact] Error:", error)
    return NextResponse.json({ error: "Failed to track contact access" }, { status: 500 })
  }
}
