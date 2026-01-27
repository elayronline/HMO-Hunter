import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/test-floor-plans
 *
 * Adds test floor plan data to a few properties for UI testing
 */
export async function POST() {
  const log: string[] = []

  try {
    log.push("Adding test floor plan data...")

    // Get a few London properties
    const { data: properties, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("id, address, postcode")
      .eq("city", "London")
      .eq("is_stale", false)
      .limit(5)

    if (fetchError) {
      return NextResponse.json({
        success: false,
        error: fetchError.message,
        log,
      }, { status: 500 })
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No London properties found",
        log,
      })
    }

    log.push(`Found ${properties.length} properties to update`)

    // Sample floor plan images (using placeholder floor plans)
    const sampleFloorPlans = [
      [
        "https://www.onthemarket.com/static/images/demo/floor-plan.png",
      ],
      [
        "https://images.unsplash.com/photo-1560185009-5bf9f2849488?w=800&h=600&fit=crop",
      ],
    ]

    // Sample EPC certificate URLs (real UK EPC certificate URLs format)
    // These point to the official gov.uk EPC certificate pages
    const sampleEpcUrls = [
      "https://find-energy-certificate.service.gov.uk/energy-certificate/0000-0000-0000-0000-0000",
      "https://find-energy-certificate.service.gov.uk/energy-certificate/1111-1111-1111-1111-1111",
    ]

    let updated = 0

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i]

      // Alternate between having floor plans and EPC only
      const hasFloorPlanImages = i % 3 === 0
      const hasEpcUrl = i % 2 === 0 || i % 3 !== 0

      const updateData: any = {}

      // Add floor plan images to some properties
      if (i < 3) {
        updateData.floor_plans = sampleFloorPlans[i % sampleFloorPlans.length]
        log.push(`  ${property.address}: Adding floor plan images`)
      }

      // Note: epc_certificate_url column may not exist yet
      // Uncomment below once column is added to database:
      // if (hasEpcUrl) {
      //   const cleanPostcode = property.postcode.replace(/\s/g, "").toUpperCase()
      //   updateData.epc_certificate_url = `https://find-energy-certificate.service.gov.uk/energy-certificate/${cleanPostcode}-${property.id.substring(0, 8)}`
      //   log.push(`  ${property.address}: Adding EPC certificate URL`)
      // }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from("properties")
          .update(updateData)
          .eq("id", property.id)

        if (updateError) {
          log.push(`  Error updating ${property.address}: ${updateError.message}`)
        } else {
          updated++
        }
      }
    }

    log.push("")
    log.push(`Updated ${updated} properties with test floor plan data`)

    return NextResponse.json({
      success: true,
      message: `Added test floor plan data to ${updated} properties`,
      log,
      note: "Refresh the page to see the floor plan badges and sections",
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({
      success: false,
      error: String(error),
      log,
    }, { status: 500 })
  }
}

/**
 * DELETE /api/test-floor-plans
 *
 * Removes test floor plan data
 */
export async function DELETE() {
  try {
    // Clear test floor plan data
    const { error } = await supabaseAdmin
      .from("properties")
      .update({
        floor_plans: null,
        epc_certificate_url: null,
      })
      .eq("city", "London")

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Cleared test floor plan data from London properties",
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error),
    }, { status: 500 })
  }
}

/**
 * GET /api/test-floor-plans
 */
export async function GET() {
  // Check current floor plan data status
  const { data: properties } = await supabaseAdmin
    .from("properties")
    .select("id, address, floor_plans")
    .eq("city", "London")
    .eq("is_stale", false)
    .limit(20)

  const withFloorPlans = properties?.filter(p => p.floor_plans && p.floor_plans.length > 0).length || 0
  const total = properties?.length || 0

  return NextResponse.json({
    message: "POST to add test floor plan data, DELETE to remove it",
    currentStatus: {
      totalLondonProperties: total,
      withFloorPlans,
      withoutFloorPlans: total - withFloorPlans,
    },
    note: "This adds sample floor plan images and EPC URLs for testing the UI",
  })
}
