import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { PotentialHMOAnalyzer } from "@/lib/ingestion/enrichment/potential-hmo-analyzer"

export const maxDuration = 300 // 5 minutes timeout

/**
 * POST /api/analyze-properties
 *
 * Analyzes all properties to identify potential HMOs and calculate deal scores.
 * This should be run after ingestion to populate the is_potential_hmo, hmo_classification,
 * and deal_score fields.
 */
export async function POST() {
  try {
    const supabase = await createClient()
    const analyzer = new PotentialHMOAnalyzer()

    // Get all properties that haven't been analyzed yet
    const { data: properties, error: fetchError } = await supabase
      .from("properties")
      .select("*")
      .or("is_potential_hmo.is.null,deal_score.is.null")
      .eq("is_stale", false)
      .limit(500)

    if (fetchError) {
      console.error("[Analyze] Failed to fetch properties:", fetchError)
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      )
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties need analysis",
        analyzed: 0,
      })
    }

    console.log(`[Analyze] Analyzing ${properties.length} properties...`)

    let analyzed = 0
    let potentialHMOs = 0
    let errors = 0

    for (const property of properties) {
      try {
        const enrichment = await analyzer.enrich(property)

        if (Object.keys(enrichment).length > 0) {
          const { error: updateError } = await supabase
            .from("properties")
            .update(enrichment)
            .eq("id", property.id)

          if (updateError) {
            console.error(`[Analyze] Failed to update property ${property.id}:`, updateError)
            errors++
          } else {
            analyzed++
            if (enrichment.is_potential_hmo) {
              potentialHMOs++
            }
          }
        }
      } catch (err) {
        console.error(`[Analyze] Error analyzing property ${property.id}:`, err)
        errors++
      }
    }

    console.log(`[Analyze] Complete: ${analyzed} analyzed, ${potentialHMOs} potential HMOs found, ${errors} errors`)

    return NextResponse.json({
      success: true,
      message: `Analysis complete`,
      analyzed,
      potentialHMOs,
      errors,
    })
  } catch (error) {
    console.error("[Analyze] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Use POST to analyze properties for potential HMO status",
    description: "This endpoint analyzes existing properties to identify HMO conversion opportunities",
    fields_populated: [
      "is_potential_hmo",
      "hmo_classification",
      "deal_score",
      "deal_score_breakdown",
      "potential_occupants",
      "estimated_gross_monthly_rent",
      "yield_band",
      "floor_area_band",
    ],
  })
}
