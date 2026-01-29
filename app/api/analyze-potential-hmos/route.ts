import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { analyzePropertyForHMO } from "@/lib/services/potential-hmo-analyzer"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Analyze Zoopla properties for HMO potential based on HMO Hunter criteria:
 * - 3+ bedrooms
 * - Floor area 90+ sqm (estimated)
 * - Not in Article 4 area
 * - Good EPC (A-D ideal)
 * - Can accommodate 3+ residents
 *
 * Then enriches with data from other APIs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const limit = body.limit || 100
    const minBedrooms = body.minBedrooms || 3

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get Zoopla properties that meet basic HMO criteria
    // Include properties not yet analyzed OR with 3+ bedrooms that should be re-checked
    const { data: properties, error } = await supabase
      .from("properties")
      .select("*")
      .like("external_id", "zoopla-%")
      .gte("bedrooms", minBedrooms)
      .order("bedrooms", { ascending: false }) // Prioritize larger properties
      .limit(limit)

    if (error) {
      console.error("[AnalyzeHMO] Error fetching properties:", error)
      return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
    }

    console.log(`[AnalyzeHMO] Analyzing ${properties?.length || 0} Zoopla properties for HMO potential...`)

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No properties to analyze",
        analyzed: 0,
        potentialHMOs: 0,
        readyToGo: 0,
        valueAdd: 0,
      })
    }

    const results = {
      analyzed: 0,
      potentialHMOs: 0,
      readyToGo: 0,
      valueAdd: 0,
      notSuitable: 0,
      details: [] as any[],
    }

    for (const property of properties) {
      try {
        // For rental properties, estimate purchase price for yield calculation
        // UK average price-to-rent ratio ~20x annual rent
        if (!property.purchase_price && property.price_pcm) {
          property.purchase_price = property.price_pcm * 12 * 18 // 18x for HMO areas
        }

        // Run HMO analysis
        const analysis = analyzePropertyForHMO(property)

        // Update property with analysis results
        const updateData: any = {
          is_potential_hmo: analysis.isPotentialHMO,
          hmo_classification: analysis.hmoClassification,
          deal_score: analysis.dealScore,
          potential_occupants: analysis.potentialOccupants,
          lettable_rooms: analysis.lettableRooms,
          estimated_rent_per_room: analysis.estimatedRentPerRoom,
          estimated_gross_monthly_rent: analysis.estimatedGrossMonthlyRent,
          estimated_yield_percentage: analysis.estimatedYieldPercentage,
          yield_band: analysis.yieldBand,
          floor_area_band: analysis.floorAreaBand,
          requires_mandatory_licensing: analysis.requiresMandatoryLicensing,
          compliance_complexity: analysis.complianceComplexity,
          epc_improvement_potential: analysis.epcImprovementPotential,
          has_value_add_potential: analysis.hasValueAddPotential,
        }

        // Update HMO status based on analysis
        if (analysis.isPotentialHMO) {
          updateData.hmo_status = "Potential HMO"
        }

        const { error: updateError } = await supabase
          .from("properties")
          .update(updateData)
          .eq("id", property.id)

        if (!updateError) {
          results.analyzed++

          if (analysis.isPotentialHMO) {
            results.potentialHMOs++
            if (analysis.hmoClassification === "ready_to_go") results.readyToGo++
            if (analysis.hmoClassification === "value_add") results.valueAdd++

            results.details.push({
              id: property.id,
              address: property.address,
              bedrooms: property.bedrooms,
              classification: analysis.hmoClassification,
              dealScore: analysis.dealScore,
              estimatedYield: `${analysis.estimatedYieldPercentage}%`,
              monthlyRent: `£${analysis.estimatedGrossMonthlyRent}`,
              lettableRooms: analysis.lettableRooms,
            })
          } else {
            results.notSuitable++
          }
        }
      } catch (err) {
        console.error(`[AnalyzeHMO] Error analyzing ${property.id}:`, err)
      }
    }

    console.log(`[AnalyzeHMO] Complete: ${results.potentialHMOs} potential HMOs found (${results.readyToGo} ready-to-go, ${results.valueAdd} value-add)`)

    return NextResponse.json({
      success: true,
      analyzed: results.analyzed,
      potentialHMOs: results.potentialHMOs,
      readyToGo: results.readyToGo,
      valueAdd: results.valueAdd,
      notSuitable: results.notSuitable,
      details: results.details.slice(0, 20),
    })

  } catch (error) {
    console.error("[AnalyzeHMO] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * GET stats on potential HMOs
 */
export async function GET() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { count: total } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")

  const { count: analyzed } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")
    .not("is_potential_hmo", "is", null)

  const { count: potentialHMOs } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")
    .eq("is_potential_hmo", true)

  const { count: readyToGo } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")
    .eq("hmo_classification", "ready_to_go")

  const { count: valueAdd } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")
    .eq("hmo_classification", "value_add")

  const { count: needsAnalysis } = await supabase
    .from("properties")
    .select("*", { count: "exact", head: true })
    .like("external_id", "zoopla-%")
    .gte("bedrooms", 3)
    .is("is_potential_hmo", null)

  return NextResponse.json({
    zooplaProperties: total || 0,
    analyzed: analyzed || 0,
    needsAnalysis: needsAnalysis || 0,
    potentialHMOs: potentialHMOs || 0,
    readyToGo: readyToGo || 0,
    valueAdd: valueAdd || 0,
  })
}
