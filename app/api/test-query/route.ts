import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Test same query as getProperties with showPotentialHMOs = true
  const { data, error, count } = await supabase
    .from("properties")
    .select("id, address, city, latitude, longitude, is_potential_hmo, listing_type", { count: "exact" })
    .or("is_stale.eq.false,is_stale.is.null")
    .eq("listing_type", "rent")
    .limit(50)

  if (error) {
    return NextResponse.json({ error: error.message })
  }

  return NextResponse.json({
    count,
    sampleProperties: data?.slice(0, 10).map(p => ({
      id: p.id.slice(0, 8),
      address: p.address?.slice(0, 30),
      city: p.city,
      lat: p.latitude,
      lng: p.longitude,
      isPotentialHmo: p.is_potential_hmo,
      listingType: p.listing_type,
    }))
  })
}
