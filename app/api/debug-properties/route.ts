import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Count by listing_type
    const { data: byListingType } = await supabase
      .from("properties")
      .select("listing_type")
      .not("listing_type", "is", null)

    const listingTypeCounts: Record<string, number> = {}
    byListingType?.forEach((p: any) => {
      listingTypeCounts[p.listing_type] = (listingTypeCounts[p.listing_type] || 0) + 1
    })

    // Count by property_type
    const { data: byPropertyType } = await supabase
      .from("properties")
      .select("property_type")
      .not("property_type", "is", null)

    const propertyTypeCounts: Record<string, number> = {}
    byPropertyType?.forEach((p: any) => {
      propertyTypeCounts[p.property_type] = (propertyTypeCounts[p.property_type] || 0) + 1
    })

    // Count HMO flags
    const { count: totalCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })

    const { count: licensedCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("licensed_hmo", true)

    const { count: potentialCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("is_potential_hmo", true)

    const { count: expiredCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("licence_status", "expired")

    // Count purchase properties that match HMO filters
    const { count: purchaseHmoCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("listing_type", "purchase")
      .or("licensed_hmo.eq.true,is_potential_hmo.eq.true,licence_status.eq.expired")

    // Sample purchase properties
    const { data: samplePurchase } = await supabase
      .from("properties")
      .select("id, address, city, listing_type, property_type, is_potential_hmo, licensed_hmo, purchase_price, bedrooms")
      .eq("listing_type", "purchase")
      .eq("is_potential_hmo", true)
      .limit(5)

    return NextResponse.json({
      total: totalCount,
      byListingType: listingTypeCounts,
      byPropertyType: propertyTypeCounts,
      hmoFlags: {
        licensed: licensedCount,
        potential: potentialCount,
        expired: expiredCount,
      },
      purchaseWithHmoFlags: purchaseHmoCount,
      samplePurchaseProperties: samplePurchase,
    })
  } catch (error) {
    console.error("[DebugProperties] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
