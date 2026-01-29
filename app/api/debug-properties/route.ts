import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Check Zoopla properties coordinates
  const { data: zooplaProps, count: zooplaCount } = await supabase
    .from("properties")
    .select("id, address, city, latitude, longitude, is_potential_hmo, images", { count: "exact" })
    .like("external_id", "zoopla-%")
    .limit(10)

  // Count properties with valid coordinates
  const { count: withCoords } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .neq("latitude", 0)
    .neq("longitude", 0)

  // Count properties without coordinates
  const { count: noCoords } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")
    .or("latitude.is.null,longitude.is.null,latitude.eq.0,longitude.eq.0")

  // Check if is_potential_hmo is set
  const { count: potentialHmo } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")
    .eq("is_potential_hmo", true)

  // Check properties visible (not filtered out)
  const { count: visibleCount } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .or("is_stale.eq.false,is_stale.is.null")
    .not("latitude", "is", null)
    .not("longitude", "is", null)

  return NextResponse.json({
    zooplaTotal: zooplaCount,
    withCoordinates: withCoords,
    withoutCoordinates: noCoords,
    potentialHmos: potentialHmo,
    visibleCount: visibleCount,
    sampleZoopla: zooplaProps?.map(p => ({
      address: p.address?.slice(0, 40),
      city: p.city,
      lat: p.latitude,
      lng: p.longitude,
      isPotentialHmo: p.is_potential_hmo,
      hasImages: p.images?.length || 0,
    })),
  })
}
