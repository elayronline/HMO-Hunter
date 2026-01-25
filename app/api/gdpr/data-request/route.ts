import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/gdpr/data-request
 *
 * Handles GDPR data subject requests:
 * - removal: Delete contact details
 * - access: Provide copy of data
 * - rectification: Correct data
 * - objection: Stop processing
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { requestType, name, email, phone, propertyAddress, reason } = body

    // Validate required fields
    if (!requestType || !name || !email) {
      return NextResponse.json(
        { error: "Missing required fields: requestType, name, and email are required" },
        { status: 400 }
      )
    }

    // Validate request type
    const validTypes = ["removal", "access", "rectification", "objection"]
    if (!validTypes.includes(requestType)) {
      return NextResponse.json(
        { error: "Invalid request type" },
        { status: 400 }
      )
    }

    // Insert the request into the database
    const { data, error } = await supabaseAdmin
      .from("gdpr_optouts")
      .insert({
        request_type: requestType,
        owner_name: name,
        email: email,
        phone: phone || null,
        property_address: propertyAddress || null,
        request_reason: reason || null,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      console.error("Error inserting GDPR request:", error)
      return NextResponse.json(
        { error: "Failed to submit request. Please try again." },
        { status: 500 }
      )
    }

    // If it's a removal request, immediately mark matching properties
    if (requestType === "removal") {
      // Mark properties with matching email/phone as opted out
      const updates: Promise<any>[] = []

      if (email) {
        updates.push(
          supabaseAdmin
            .from("properties")
            .update({ contact_data_opted_out: true })
            .eq("owner_contact_email", email)
        )
      }

      if (phone) {
        updates.push(
          supabaseAdmin
            .from("properties")
            .update({ contact_data_opted_out: true })
            .eq("owner_contact_phone", phone)
        )
      }

      await Promise.all(updates)
    }

    // Generate reference number
    const reference = `GDPR-${new Date().toISOString().split("T")[0]}-${data.id.substring(0, 8).toUpperCase()}`

    return NextResponse.json({
      success: true,
      message: "Request submitted successfully",
      reference,
      estimatedCompletion: "30 days",
    })

  } catch (error) {
    console.error("GDPR request error:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again." },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to submit a GDPR data subject request",
    validRequestTypes: ["removal", "access", "rectification", "objection"],
    requiredFields: ["requestType", "name", "email"],
    optionalFields: ["phone", "propertyAddress", "reason"],
  })
}
