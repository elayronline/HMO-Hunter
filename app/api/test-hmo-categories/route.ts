import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/test-hmo-categories
 *
 * Check current HMO category distribution
 */
export async function GET() {
  try {
    const { data: properties } = await supabaseAdmin
      .from("properties")
      .select("id, hmo_status, licensed_hmo, licence_status")
      .eq("is_stale", false)

    if (!properties) {
      return NextResponse.json({ error: "No properties found" }, { status: 404 })
    }

    const stats = {
      total: properties.length,
      licensedHMO: properties.filter(p => p.hmo_status === "Licensed HMO").length,
      unlicensedHMO: properties.filter(p => p.hmo_status === "Unlicensed HMO").length,
      potentialHMO: properties.filter(p => p.hmo_status === "Potential HMO").length,
      // Additional checks for data integrity
      withLicenceTrue: properties.filter(p => p.licensed_hmo === true).length,
      withLicenceFalse: properties.filter(p => p.licensed_hmo === false).length,
      withActiveStatus: properties.filter(p => p.licence_status === "active").length,
      withNoLicenceStatus: properties.filter(p => !p.licence_status).length,
    }

    // Check for mismatches
    const mismatches = {
      licensedButNotActive: properties.filter(p =>
        p.hmo_status === "Licensed HMO" && p.licence_status !== "active"
      ).length,
      unlicensedButActive: properties.filter(p =>
        p.hmo_status === "Unlicensed HMO" && p.licence_status === "active"
      ).length,
      licensedHmoFalseButLicensedStatus: properties.filter(p =>
        p.licensed_hmo === false && p.hmo_status === "Licensed HMO"
      ).length,
    }

    return NextResponse.json({
      message: "HMO Category Distribution",
      stats,
      mismatches,
      recommendation: stats.unlicensedHMO === 0
        ? "POST to add test unlicensed HMO data"
        : "Data looks good",
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
    }, { status: 500 })
  }
}

/**
 * POST /api/test-hmo-categories
 *
 * Add test data for unlicensed HMOs and fix categorization
 */
export async function POST() {
  const log: string[] = []

  try {
    log.push("Updating HMO categories based on licence data...")

    // Get all properties
    const { data: properties, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("id, address, hmo_status, licensed_hmo, licence_status")
      .eq("is_stale", false)

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
        error: "No properties found",
        log,
      })
    }

    log.push(`Found ${properties.length} properties to check`)

    let updatedToLicensed = 0
    let updatedToUnlicensed = 0
    let alreadyCorrect = 0

    for (const property of properties) {
      const hasActiveLicence = property.licence_status === "active" || property.licensed_hmo === true
      const isPotentialHMO = property.hmo_status === "Potential HMO"

      // Skip Potential HMOs - they have their own status
      if (isPotentialHMO) {
        alreadyCorrect++
        continue
      }

      let correctStatus: string
      if (hasActiveLicence) {
        correctStatus = "Licensed HMO"
      } else {
        correctStatus = "Unlicensed HMO"
      }

      if (property.hmo_status !== correctStatus) {
        const { error: updateError } = await supabaseAdmin
          .from("properties")
          .update({
            hmo_status: correctStatus,
            licensed_hmo: hasActiveLicence,
          })
          .eq("id", property.id)

        if (updateError) {
          log.push(`  Error updating ${property.address}: ${updateError.message}`)
        } else {
          if (correctStatus === "Licensed HMO") {
            updatedToLicensed++
            log.push(`  ${property.address}: Updated to Licensed HMO`)
          } else {
            updatedToUnlicensed++
            log.push(`  ${property.address}: Updated to Unlicensed HMO`)
          }
        }
      } else {
        alreadyCorrect++
      }
    }

    // Now add some test unlicensed HMOs by updating a few licensed ones
    // Only do this if there are no unlicensed HMOs
    const { data: unlicensedCount } = await supabaseAdmin
      .from("properties")
      .select("id")
      .eq("hmo_status", "Unlicensed HMO")
      .eq("is_stale", false)

    if (!unlicensedCount || unlicensedCount.length < 5) {
      log.push("")
      log.push("Adding test unlicensed HMO data...")

      // Get some licensed properties to convert for testing
      const { data: licensedProps } = await supabaseAdmin
        .from("properties")
        .select("id, address")
        .eq("hmo_status", "Licensed HMO")
        .eq("is_stale", false)
        .limit(10)

      if (licensedProps && licensedProps.length > 0) {
        // Convert every 3rd one to unlicensed for testing
        let constraintError = false
        for (let i = 0; i < licensedProps.length; i += 3) {
          const prop = licensedProps[i]
          const { error } = await supabaseAdmin
            .from("properties")
            .update({
              hmo_status: "Unlicensed HMO",
              licensed_hmo: false,
              licence_status: null,
            })
            .eq("id", prop.id)

          if (!error) {
            updatedToUnlicensed++
            log.push(`  Test: ${prop.address} -> Unlicensed HMO`)
          } else if (error.message.includes("check constraint")) {
            constraintError = true
          }
        }

        if (constraintError && updatedToUnlicensed === 0) {
          log.push("")
          log.push("⚠️ DATABASE CONSTRAINT ERROR DETECTED")
          log.push("The database constraint 'properties_hmo_status_check' needs to be updated.")
          log.push("Run this SQL in Supabase Dashboard > SQL Editor:")
          log.push("")
          log.push("ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_hmo_status_check;")
          log.push("ALTER TABLE properties ADD CONSTRAINT properties_hmo_status_check")
          log.push("  CHECK (hmo_status IN ('Unlicensed HMO', 'Licensed HMO', 'Potential HMO'));")
        }
      }
    }

    log.push("")
    log.push(`Summary:`)
    log.push(`  - Updated to Licensed HMO: ${updatedToLicensed}`)
    log.push(`  - Updated to Unlicensed HMO: ${updatedToUnlicensed}`)
    log.push(`  - Already correct: ${alreadyCorrect}`)

    return NextResponse.json({
      success: true,
      message: "HMO categories updated",
      log,
      summary: {
        updatedToLicensed,
        updatedToUnlicensed,
        alreadyCorrect,
      },
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
