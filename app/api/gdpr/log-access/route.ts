import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  CONTACT_ACCESS_TYPES,
  logContactAccess,
  requestMetadata,
  type ContactAccessType,
} from "@/lib/gdpr/contact-access-log"

/**
 * POST /api/gdpr/log-access
 *
 * Logs access to contact data for GDPR audit compliance.
 * Called when a user views, copies, or exports contact information.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { propertyId, ownerName, dataAccessed, accessType } = body

    // Validate required fields
    if (!propertyId || !dataAccessed || !accessType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Validate access type
    if (!CONTACT_ACCESS_TYPES.includes(accessType as ContactAccessType)) {
      return NextResponse.json(
        { error: "Invalid access type" },
        { status: 400 }
      )
    }

    // Get current user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Shared with /api/track-contact, which writes the row directly rather than
    // posting here — see lib/gdpr/contact-access-log.ts for why.
    const { ipAddress, userAgent } = requestMetadata(request)
    const { error } = await logContactAccess({
      userId: user?.id ?? null,
      propertyId,
      ownerName: ownerName ?? null,
      dataAccessed: Array.isArray(dataAccessed) ? dataAccessed : [dataAccessed],
      accessType: accessType as ContactAccessType,
      ipAddress,
      userAgent,
    })

    if (error) {
      console.error("[GDPR] access log write FAILED:", error)
      // The read is not denied because the audit write failed, but the failure
      // is not swallowed either.
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error("Access log error:", error)
    // Don't fail the request if logging fails
    return NextResponse.json({ success: true })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to log contact data access",
    usage: {
      propertyId: "UUID of the property",
      ownerName: "Name of the owner (optional)",
      dataAccessed: ["phone", "email", "address"],
      accessType: "view | copy | export | call | email",
    },
  })
}
