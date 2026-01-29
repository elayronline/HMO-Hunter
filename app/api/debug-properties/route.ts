import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get counts using count queries (no row limit issues)
    const { count: totalPurchaseCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("listing_type", "purchase")

    const { count: purchaseWithHmoFlagsCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("listing_type", "purchase")
      .or("licensed_hmo.eq.true,is_potential_hmo.eq.true,licence_status.eq.expired")

    const { count: purchaseMissingFlagsCount } = await supabase
      .from("properties")
      .select("*", { count: "exact", head: true })
      .eq("listing_type", "purchase")
      .or("licensed_hmo.is.null,licensed_hmo.eq.false")
      .or("is_potential_hmo.is.null,is_potential_hmo.eq.false")
      .is("licence_status", null)

    // Get sample of properties for segment calculation
    const { data: allProperties, error: fetchError } = await supabase
      .from("properties")
      .select("id, listing_type, property_type, licensed_hmo, is_potential_hmo, licence_status, hmo_classification, article_4_area, purchase_price, bedrooms")
      .eq("listing_type", "purchase")
      .or("licensed_hmo.eq.true,is_potential_hmo.eq.true,licence_status.eq.expired")
      .limit(2000)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    // Filter to purchase only (matching default UI behavior)
    const purchaseProperties = allProperties?.filter(p => p.listing_type === "purchase") || []

    // Calculate segment counts (matching UI logic exactly)
    const segments = {
      all: purchaseProperties.length,
      licensed: 0,
      expired: 0,
      opportunities: 0,
      restricted: 0,
    }

    const classification_counts: Record<string, number> = {}

    for (const p of purchaseProperties) {
      // Licensed HMOs with active licence
      if (p.licensed_hmo && p.licence_status !== "expired") {
        segments.licensed++
      }
      // Expired licence HMOs
      if (p.licence_status === "expired") {
        segments.expired++
      }
      // Opportunities - potential HMOs with classification
      if (p.is_potential_hmo && (p.hmo_classification === "ready_to_go" || p.hmo_classification === "value_add")) {
        segments.opportunities++
      }
      // Restricted - Article 4 areas
      if (p.article_4_area) {
        segments.restricted++
      }
      // Track classification values
      const cls = p.hmo_classification || "null"
      classification_counts[cls] = (classification_counts[cls] || 0) + 1
    }

    // Count by listing_type
    const listingTypeCounts: Record<string, number> = {}
    allProperties?.forEach((p: any) => {
      const lt = p.listing_type || "null"
      listingTypeCounts[lt] = (listingTypeCounts[lt] || 0) + 1
    })

    // Count by property_type
    const propertyTypeCounts: Record<string, number> = {}
    purchaseProperties.forEach((p: any) => {
      const pt = p.property_type || "null"
      propertyTypeCounts[pt] = (propertyTypeCounts[pt] || 0) + 1
    })

    // Properties missing classification (potential HMOs without ready_to_go/value_add)
    const missingClassification = purchaseProperties.filter(
      p => p.is_potential_hmo && !p.hmo_classification
    ).length

    return NextResponse.json({
      totalPurchase: totalPurchaseCount,
      purchaseWithHmoFlags: purchaseWithHmoFlagsCount,
      purchaseMissingFlags: purchaseMissingFlagsCount,
      sampledProperties: purchaseProperties.length,
      segments,
      classification_counts,
      missingClassification,
      byListingType: listingTypeCounts,
      byPropertyType: propertyTypeCounts,
      sampleOpportunities: purchaseProperties
        .filter(p => p.is_potential_hmo && (p.hmo_classification === "ready_to_go" || p.hmo_classification === "value_add"))
        .slice(0, 3),
      issues: {
        potentialWithoutClassification: missingClassification,
        needsClassificationFix: missingClassification > 0,
      }
    })
  } catch (error) {
    console.error("[DebugProperties] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
