import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { lockReason, userCan } from "@/lib/entitlements"
import { validateBody } from "@/lib/validation/api-validation"
import { trackContactSchema } from "@/lib/validation/schemas"
import { logContactAccess, requestMetadata, type ContactAccessType } from "@/lib/gdpr/contact-access-log"

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

    /*
     * Written here rather than by posting to /api/gdpr/log-access.
     *
     * That call sent no cookies, so the endpoint saw no session and would have
     * stored user_id: null — an access log that records that contact data was
     * read but not who read it. And its URL began with a bare slash, because
     * NEXT_PUBLIC_SITE_URL is set in no environment, so server-side fetch threw
     * before it ever got that far. The throw landed in a catch that only wrote
     * to the console. contact_access_log held 0 rows.
     *
     * This route already has the authenticated user and the real request, which
     * is everything the row needs.
     */
    const { ipAddress, userAgent } = requestMetadata(request)
    const { error: logError } = await logContactAccess({
      userId: user.id,
      propertyId,
      ownerName: contactName ?? null,
      dataAccessed: [contactType, action],
      accessType: action as ContactAccessType,
      ipAddress,
      userAgent,
    })

    /*
     * A failed audit write is surfaced, not swallowed. It does not deny the
     * reader data they are entitled to — refusing access because logging broke
     * would be the wrong trade — but it must be visible, because silence is
     * exactly how this went unnoticed for the life of the feature.
     */
    if (logError) {
      console.error("[TrackContact] GDPR access log write FAILED:", logError)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[TrackContact] Error:", error)
    return NextResponse.json({ error: "Failed to track contact access" }, { status: 500 })
  }
}
