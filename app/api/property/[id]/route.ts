import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { createClient } from "@/lib/supabase/server"

/*
 * Every field list below named columns that are not on the table. The public
 * list alone had seven — floor_area_sqm, epc_floor_area, is_hmo_licensed,
 * licence_type, licence_expiry, article_4, broadband_speed — so PostgREST
 * answered 42703 and this endpoint returned 500 to every caller at every tier,
 * signed in or not. The property detail card refreshes itself through here
 * after enrichment, which is why that refresh has never once succeeded.
 *
 * Names are the real ones now. The licence pair is hmo_licence_reference and
 * hmo_licence_expiry; licence_id, licence_start_date, licence_end_date and
 * max_occupants are absent on purpose — see licenceExpiry() in
 * lib/properties/category.ts for why nothing may read them.
 */

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
  gross_internal_area_sqm,
  floor_area,
  epc_rating,
  licensed_hmo,
  licence_status,
  hmo_status,
  hmo_licence_type,
  hmo_licence_expiry,
  hmo_licence_reference,
  article_4_status,
  article_4_area,
  article_4_council,
  broadband_max_down,
  has_fiber,
  primary_image,
  images,
  floor_plans,
  source_name,
  source_url,
  created_at,
  updated_at
`

// Additional fields for authenticated users. Who owns it, not how to reach
// them — that is the premium tier below.
const AUTHENTICATED_FIELDS = `
  ${PUBLIC_FIELDS},
  owner_name,
  owner_type,
  company_name,
  company_number,
  licence_holder_name,
  external_id
`

// All fields including contact info for premium/admin users
const PREMIUM_FIELDS = `
  ${AUTHENTICATED_FIELDS},
  owner_contact_email,
  owner_contact_phone,
  owner_address,
  licence_holder_email,
  licence_holder_phone,
  contact_data_opted_out
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

    // A direct link to a rental listing must 404 rather than render, otherwise
    // something the platform no longer sources stays reachable by id. Same rule
    // as isServed(): for sale, or an HMO with licence evidence.
    // .single() turns the empty result into PGRST116, already handled below as
    // "Property not found".
    const { data: property, error } = await supabaseAdmin
      .from("properties")
      .select(selectFields)
      .eq("id", id)
      .or("listing_type.eq.purchase,licensed_hmo.eq.true,licence_status.eq.expired")
      .single()

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Property not found" }, { status: 404 })
      }
      console.error("[Property API] Database error:", error)
      return NextResponse.json({ error: "Failed to fetch property" }, { status: 500 })
    }

    // getProperties() strips contact details for owners who have opted out.
    // This route reads through the service-role client, so nothing else would.
    const row = property as unknown as Record<string, unknown> | null
    const released =
      row && row.contact_data_opted_out
        ? { ...row, owner_contact_email: null, owner_contact_phone: null, licence_holder_email: null, licence_holder_phone: null }
        : row

    return NextResponse.json({
      property: released,
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
