import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { lockReason, userCan } from "@/lib/entitlements"
import { validateBody } from "@/lib/validation/api-validation"
import { trackContactSchema } from "@/lib/validation/schemas"

// POST - Check entitlement for contact data, then log the access for GDPR
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

    // Contact data is a Pro capability. Viewing and copying used to cost 2 and
    // 3 credits respectively ON TOP of a hard is_premium lock, so the same
    // click was gated twice by two systems that could disagree about whether
    // the reader was entitled at all.
    if (!(await userCan(user.id, "contact_data"))) {
      return NextResponse.json(
        { error: lockReason("free", "contact_data"), upgradeRequired: true },
        { status: 403 },
      )
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[TrackContact] Error:", error)
    return NextResponse.json({ error: "Failed to track contact access" }, { status: 500 })
  }
}
