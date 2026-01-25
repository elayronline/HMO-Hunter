import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"

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
    const validAccessTypes = ["view", "copy", "export", "call", "email"]
    if (!validAccessTypes.includes(accessType)) {
      return NextResponse.json(
        { error: "Invalid access type" },
        { status: 400 }
      )
    }

    // Get current user
    const cookieStore = await cookies()
    const supabase = createClient(cookieStore)
    const { data: { user } } = await supabase.auth.getUser()

    // Get request metadata
    const userAgent = request.headers.get("user-agent") || "unknown"
    const forwardedFor = request.headers.get("x-forwarded-for")
    const ipAddress = forwardedFor?.split(",")[0]?.trim() || "unknown"

    // Insert audit log
    const { error } = await supabaseAdmin
      .from("contact_access_log")
      .insert({
        user_id: user?.id || null,
        property_id: propertyId,
        owner_name: ownerName || null,
        data_accessed: Array.isArray(dataAccessed) ? dataAccessed : [dataAccessed],
        access_type: accessType,
        ip_address: ipAddress,
        user_agent: userAgent,
      })

    if (error) {
      console.error("Error logging access:", error)
      // Don't fail the request if logging fails
      // Just log the error and continue
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
