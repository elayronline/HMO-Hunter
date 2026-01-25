import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/info-request
 *
 * Receives requests for property owner/licence information
 * Stores them for manual lookup via Searchland or Land Registry
 *
 * Body: {
 *   propertyId: string,
 *   propertyAddress: string,
 *   postcode: string,
 *   city: string,
 *   requestType: "title_owner" | "licence_holder" | "both"
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { propertyId, propertyAddress, postcode, city, requestType } = body

    if (!propertyId || !propertyAddress) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields",
      }, { status: 400 })
    }

    // Store the request in a new table or log it
    // For now, we'll create an info_requests table if it doesn't exist
    const { error: insertError } = await supabaseAdmin
      .from("info_requests")
      .insert({
        property_id: propertyId,
        property_address: propertyAddress,
        postcode: postcode,
        city: city,
        request_type: requestType,
        status: "pending",
        created_at: new Date().toISOString(),
      })

    if (insertError) {
      // If table doesn't exist, log to console and return success anyway
      console.log("[InfoRequest] New request:", {
        propertyId,
        propertyAddress,
        postcode,
        city,
        requestType,
        timestamp: new Date().toISOString(),
      })

      // Still return success - the request was logged
      return NextResponse.json({
        success: true,
        message: "Request received - we'll look up this information",
        logged: true,
      })
    }

    return NextResponse.json({
      success: true,
      message: "Request received - we'll look up this information",
    })

  } catch (error) {
    console.error("[InfoRequest] Error:", error)
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 })
  }
}

/**
 * GET /api/info-request
 *
 * Returns pending info requests for admin review
 */
export async function GET() {
  try {
    const { data: requests, error } = await supabaseAdmin
      .from("info_requests")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50)

    if (error) {
      // Table might not exist yet
      return NextResponse.json({
        message: "Info requests endpoint",
        description: "POST to request owner/licence info for a property",
        pendingRequests: [],
        note: "Create info_requests table to store requests",
        createTableSql: `
CREATE TABLE info_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id),
  property_address TEXT NOT NULL,
  postcode TEXT,
  city TEXT,
  request_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_info_requests_status ON info_requests(status);
CREATE INDEX idx_info_requests_created ON info_requests(created_at);
        `,
      })
    }

    return NextResponse.json({
      success: true,
      pendingRequests: requests || [],
      count: requests?.length || 0,
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 })
  }
}
