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

  // Zoopla sourced
  const { count: zooplaSourced } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")

  // HMO Register properties
  const { count: hmoRegister } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .not("external_id", "like", "zoopla-%")

  // Potential HMOs
  const { count: potentialHMOs } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_potential_hmo", true)

  // By classification
  const { count: readyToGo } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("hmo_classification", "ready_to_go")

  const { count: valueAdd } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("hmo_classification", "value_add")

  // By bedroom count
  const { data: bedroomData } = await supabase
    .from("properties")
    .select("bedrooms")
    .eq("is_potential_hmo", true)

  const bedroomCounts: Record<string, number> = {}
  bedroomData?.forEach(p => {
    const beds = p.bedrooms || 0
    const key = beds >= 8 ? "8+" : beds.toString()
    bedroomCounts[key] = (bedroomCounts[key] || 0) + 1
  })

  // By yield band
  const { count: highYield } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_potential_hmo", true)
    .eq("yield_band", "high")

  const { count: mediumYield } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .eq("is_potential_hmo", true)
    .eq("yield_band", "medium")

  // With images
  const { data: allProps } = await supabase
    .from("properties")
    .select("id, images, external_id")
    .eq("is_potential_hmo", true)

  const withMultipleImages = allProps?.filter(p => p.images && p.images.length > 1).length || 0

  // Top deal scores
  const { data: topDeals } = await supabase
    .from("properties")
    .select("id, address, bedrooms, deal_score, hmo_classification, estimated_gross_monthly_rent, estimated_yield_percentage, city")
    .eq("is_potential_hmo", true)
    .order("deal_score", { ascending: false })
    .limit(20)

  // By city
  const { data: cityData } = await supabase
    .from("properties")
    .select("city")
    .eq("is_potential_hmo", true)

  const cityCounts: Record<string, number> = {}
  cityData?.forEach(p => {
    const city = p.city || "Unknown"
    cityCounts[city] = (cityCounts[city] || 0) + 1
  })

  // Sort cities by count
  const topCities = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([city, count]) => ({ city, count }))

  return NextResponse.json({
    summary: {
      totalProperties: total || 0,
      zooplaSourced: zooplaSourced || 0,
      hmoRegister: hmoRegister || 0,
      potentialHMOs: potentialHMOs || 0,
      withImages: withMultipleImages,
    },
    classification: {
      readyToGo: readyToGo || 0,
      valueAdd: valueAdd || 0,
    },
    yield: {
      high: highYield || 0,
      medium: mediumYield || 0,
    },
    byBedrooms: bedroomCounts,
    topCities,
    topDeals: topDeals?.map(d => ({
      address: d.address,
      city: d.city,
      bedrooms: d.bedrooms,
      dealScore: d.deal_score,
      classification: d.hmo_classification,
      monthlyRent: d.estimated_gross_monthly_rent,
      yield: d.estimated_yield_percentage,
    })),
  })
}
