import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/map-data
 *
 * Returns property data specifically for map display, bypassing any caching.
 * Use this to debug map marker issues.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const city = searchParams.get("city") || "London"

  try {
    const { data: properties, error } = await supabaseAdmin
      .from("properties")
      .select("id, title, address, city, latitude, longitude, hmo_status, bedrooms, listing_type, price_pcm, purchase_price, source_url, zoopla_listing_url, agent_phone, licensed_hmo")
      .eq("city", city)
      .eq("is_stale", false)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(200)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Calculate spread
    const lats = properties?.map(p => p.latitude) || []
    const lngs = properties?.map(p => p.longitude) || []

    const stats = {
      total: properties?.length || 0,
      lat: {
        min: Math.min(...lats),
        max: Math.max(...lats),
        spread: Math.max(...lats) - Math.min(...lats),
      },
      lng: {
        min: Math.min(...lngs),
        max: Math.max(...lngs),
        spread: Math.max(...lngs) - Math.min(...lngs),
      },
    }

    // Group by hmo_status
    const byStatus: Record<string, number> = {}
    properties?.forEach(p => {
      byStatus[p.hmo_status || 'unknown'] = (byStatus[p.hmo_status || 'unknown'] || 0) + 1
    })

    return NextResponse.json({
      city,
      stats,
      byStatus,
      properties: properties?.map(p => ({
        id: p.id,
        title: p.title,
        lat: p.latitude,
        lng: p.longitude,
        hmo_status: p.hmo_status,
        bedrooms: p.bedrooms,
        price: p.listing_type === 'rent' ? p.price_pcm : p.purchase_price,
        listing_type: p.listing_type,
        source_url: p.source_url,
        zoopla_listing_url: p.zoopla_listing_url,
        agent_phone: p.agent_phone,
        licensed_hmo: p.licensed_hmo,
      })),
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
