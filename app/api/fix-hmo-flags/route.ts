import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Fix HMO flags for properties that are missing is_potential_hmo
 * For purchase listings: All are potential HMOs (investment opportunities)
 * For rent listings: Only 3+ bedrooms are potential HMOs
 */
export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get purchase properties without HMO flags - ALL purchase listings are opportunities
    const { data: purchaseProperties, error: purchaseError } = await supabase
      .from("properties")
      .select("id, bedrooms, is_potential_hmo, hmo_classification, licensed_hmo")
      .eq("listing_type", "purchase")
      .or("is_potential_hmo.is.null,is_potential_hmo.eq.false")
      .eq("licensed_hmo", false)
      .limit(1000)

    if (purchaseError) {
      return NextResponse.json({ error: purchaseError.message }, { status: 500 })
    }

    // Get rent properties with 3+ bedrooms without HMO flags
    const { data: rentProperties, error: rentError } = await supabase
      .from("properties")
      .select("id, bedrooms, is_potential_hmo, hmo_classification, licensed_hmo")
      .eq("listing_type", "rent")
      .gte("bedrooms", 3)
      .or("is_potential_hmo.is.null,is_potential_hmo.eq.false")
      .eq("licensed_hmo", false)
      .limit(1000)

    if (rentError) {
      return NextResponse.json({ error: rentError.message }, { status: 500 })
    }

    const allProperties = [...(purchaseProperties || []), ...(rentProperties || [])]

    if (allProperties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties need updating",
        updated: 0,
      })
    }

    let updated = 0
    const errors: string[] = []

    for (const property of allProperties) {
      // Classify based on bedrooms: 5+ = ready_to_go, 3-4 = value_add, <3 = value_add (still opportunity)
      const bedrooms = property.bedrooms || 0
      const hmoClassification = bedrooms >= 5 ? "ready_to_go" : "value_add"

      const { error } = await supabase
        .from("properties")
        .update({
          is_potential_hmo: true,
          hmo_classification: property.hmo_classification || hmoClassification,
          hmo_status: "Potential HMO",
        })
        .eq("id", property.id)

      if (error) {
        errors.push(`${property.id}: ${error.message}`)
      } else {
        updated++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} properties with HMO flags`,
      updated,
      purchaseUpdated: purchaseProperties?.length || 0,
      rentUpdated: rentProperties?.length || 0,
      total: allProperties.length,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error("[FixHMOFlags] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to this endpoint to fix HMO flags for properties with 3+ bedrooms",
  })
}
