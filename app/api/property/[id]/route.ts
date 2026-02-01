import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { createClient } from "@/lib/supabase/server"

// Public fields - safe to return without authentication
const PUBLIC_FIELDS = `
  id,
  address,
  postcode,
  city,
  latitude,
  longitude,
  listing_type,
  purchase_price,
  price_pcm,
  bedrooms,
  bathrooms,
  property_type,
  floor_area_sqm,
  epc_rating,
  epc_floor_area,
  is_hmo_licensed,
  hmo_status,
  licence_type,
  licence_expiry,
  article_4,
  broadband_speed,
  has_fiber,
  primary_image,
  images,
  floor_plans,
  source_url,
  created_at,
  updated_at
`

// Additional fields for authenticated users
const AUTHENTICATED_FIELDS = `
  ${PUBLIC_FIELDS},
  owner_name,
  owner_company_name,
  owner_company_number,
  licence_holder_name,
  licence_holder_company,
  hmo_licence_number,
  hmo_licence_start,
  hmo_licence_end,
  hmo_max_occupants,
  gross_yield,
  deal_score,
  classification,
  external_id
`

// All fields including contact info for premium/admin users
const PREMIUM_FIELDS = `
  ${AUTHENTICATED_FIELDS},
  owner_email,
  owner_phone,
  owner_address,
  contact_email,
  contact_phone
`

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: "Invalid property ID" }, { status: 400 })
    }

    // Check authentication
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Determine which fields to return based on auth status
    let selectFields = PUBLIC_FIELDS
    let isPremium = false

    if (user) {
      // Check if user is premium or admin
      const { data: credits } = await supabaseAdmin
        .from("user_credits")
        .select("role")
        .eq("user_id", user.id)
        .single()

      isPremium = credits?.role === "admin" || user.user_metadata?.is_premium === true

      if (isPremium) {
        selectFields = PREMIUM_FIELDS
      } else {
        selectFields = AUTHENTICATED_FIELDS
      }
    }

    const { data: property, error } = await supabaseAdmin
      .from("properties")
      .select(selectFields)
      .eq("id", id)
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Property not found" }, { status: 404 })
      }
      console.error("[Property API] Database error:", error)
      return NextResponse.json({ error: "Failed to fetch property" }, { status: 500 })
    }

    return NextResponse.json({
      property,
      _meta: {
        authenticated: !!user,
        premium: isPremium,
      }
    })
  } catch (error) {
    console.error("[Property API] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
