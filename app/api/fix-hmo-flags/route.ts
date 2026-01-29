import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Fix HMO flags for properties that are missing is_potential_hmo
 * Sets is_potential_hmo = true for properties with 3+ bedrooms
 */
export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get properties with 3+ bedrooms that don't have is_potential_hmo set
    const { data: properties, error: fetchError } = await supabase
      .from("properties")
      .select("id, bedrooms, is_potential_hmo, hmo_classification")
      .gte("bedrooms", 3)
      .or("is_potential_hmo.is.null,is_potential_hmo.eq.false")
      .limit(1000)

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties need updating",
        updated: 0,
      })
    }

    let updated = 0
    const errors: string[] = []

    for (const property of properties) {
      // Classify based on bedrooms
      const hmoClassification = property.bedrooms >= 5 ? "ready_to_go" : "value_add"

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
      total: properties.length,
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
