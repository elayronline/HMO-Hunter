import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const includeStale = searchParams.get("includeStale") === "true"
  const city = searchParams.get("city")

  try {
    let query = supabaseAdmin
      .from("properties")
      .select("id, title, address, postcode, city, latitude, longitude, hmo_status, listing_type, bedrooms, is_stale, owner_name, owner_type, company_name, company_number, epc_rating, owner_contact_phone, owner_contact_email")

    if (!includeStale) {
      query = query.eq("is_stale", false)
    }

    if (city) {
      query = query.eq("city", city)
    }

    const { data: properties, error } = await query.limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by hmo_status
    const byStatus: Record<string, number> = {}
    const byCity: Record<string, number> = {}

    properties?.forEach(p => {
      byStatus[p.hmo_status || 'unknown'] = (byStatus[p.hmo_status || 'unknown'] || 0) + 1
      byCity[p.city || 'unknown'] = (byCity[p.city || 'unknown'] || 0) + 1
    })

    return NextResponse.json({
      total: properties?.length || 0,
      byStatus,
      byCity,
      properties: properties?.slice(0, 20).map(p => ({
        title: p.title?.substring(0, 40),
        address: p.address,
        city: p.city,
        lat: p.latitude,
        lng: p.longitude,
        hmo_status: p.hmo_status,
        is_stale: p.is_stale,
        owner_name: p.owner_name,
        owner_type: p.owner_type,
        company_name: p.company_name,
        company_number: p.company_number,
        epc_rating: p.epc_rating,
        owner_contact_phone: p.owner_contact_phone,
        owner_contact_email: p.owner_contact_email,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
