import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Total properties
  const { count: total } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })

  // Zoopla-sourced (external_id starts with zoopla-)
  const { count: zooplaSourced } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")

  // HMO register matched to Zoopla
  const { count: zooplaMatched } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("media_source_url", "zoopla_matched%")

  // Properties with multiple images
  const { data: allProps } = await supabase
    .from("properties")
    .select("id, images, external_id, media_source_url")

  const withMultipleImages = allProps?.filter(p => p.images && p.images.length > 1).length || 0
  const withZooplaImages = allProps?.filter(p =>
    p.external_id?.startsWith("zoopla-") ||
    p.media_source_url?.includes("zoopla")
  ).length || 0

  return NextResponse.json({
    total: total || 0,
    zooplaSourced: zooplaSourced || 0,
    zooplaMatched: zooplaMatched || 0,
    totalWithZooplaImages: withZooplaImages,
    withMultipleImages,
    hmoRegisterOnly: (total || 0) - (zooplaSourced || 0),
    coverage: {
      zooplaImages: `${(((zooplaSourced || 0) + (zooplaMatched || 0)) / (total || 1) * 100).toFixed(1)}%`,
      multipleImages: `${((withMultipleImages / (total || 1)) * 100).toFixed(1)}%`,
    }
  })
}
