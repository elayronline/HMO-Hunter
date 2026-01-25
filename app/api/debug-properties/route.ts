import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const includeStale = searchParams.get("includeStale") === "true"
  const city = searchParams.get("city")

  try {
    let query = supabaseAdmin
      .from("properties")
      .select("id, title, address, postcode, city, latitude, longitude, hmo_status, listing_type, bedrooms, is_stale")

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
        city: p.city,
        lat: p.latitude,
        lng: p.longitude,
        hmo_status: p.hmo_status,
        is_stale: p.is_stale,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
