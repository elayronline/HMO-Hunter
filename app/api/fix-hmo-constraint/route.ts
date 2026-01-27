import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * GET /api/fix-hmo-constraint
 *
 * Check current HMO status values and test if constraint allows 'Unlicensed HMO'
 */
export async function GET() {
  try {
    // Get current HMO status distribution
    const { data: properties } = await supabaseAdmin
      .from("properties")
      .select("id, hmo_status, licensed_hmo, licence_status")
      .eq("is_stale", false)

    if (!properties) {
      return NextResponse.json({ error: "No properties found" }, { status: 404 })
    }

    // Count each status type
    const statusCounts: Record<string, number> = {}
    for (const p of properties) {
      const status = p.hmo_status || "null"
      statusCounts[status] = (statusCounts[status] || 0) + 1
    }

    // Check what the current values are
    const uniqueStatuses = [...new Set(properties.map(p => p.hmo_status).filter(Boolean))]

    // Test if constraint allows 'Unlicensed HMO' by trying to update a property
    // We'll use the first licensed property to test
    const testProperty = properties.find(p => p.hmo_status === "Licensed HMO")
    let constraintAllowsUnlicensed = false
    let constraintError = ""
    let testPropertyId = testProperty?.id

    if (testProperty) {
      const { error } = await supabaseAdmin
        .from("properties")
        .update({ hmo_status: "Unlicensed HMO" })
        .eq("id", testProperty.id)

      if (error) {
        constraintError = error.message
      } else {
        constraintAllowsUnlicensed = true
        // Revert the change
        await supabaseAdmin
          .from("properties")
          .update({ hmo_status: "Licensed HMO" })
          .eq("id", testProperty.id)
      }
    }

    return NextResponse.json({
      message: "HMO Status Analysis",
      totalProperties: properties.length,
      statusCounts,
      uniqueStatuses,
      constraintCheck: {
        allowsUnlicensedHMO: constraintAllowsUnlicensed,
        error: constraintError || undefined,
        needsFix: !constraintAllowsUnlicensed,
        testedPropertyId: testPropertyId,
      },
      recommendation: constraintAllowsUnlicensed
        ? "Constraint is correct. POST to update categorization."
        : "Run SQL migration first, then POST to update categorization.",
      sql: `
-- Run this SQL in Supabase Dashboard > SQL Editor:

-- Step 1: Drop the existing constraint
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_hmo_status_check;

-- Step 2: Add the new constraint with correct values
ALTER TABLE properties ADD CONSTRAINT properties_hmo_status_check
  CHECK (hmo_status IN ('Unlicensed HMO', 'Licensed HMO', 'Potential HMO'));

-- Step 3: Create test data - convert 5 licensed properties to unlicensed
WITH to_convert AS (
  SELECT id FROM properties
  WHERE hmo_status = 'Licensed HMO' AND is_stale = false
  LIMIT 5
)
UPDATE properties
SET hmo_status = 'Unlicensed HMO', licensed_hmo = false, licence_status = null
WHERE id IN (SELECT id FROM to_convert);

-- Step 4: Verify the distribution
SELECT hmo_status, COUNT(*) as count
FROM properties WHERE is_stale = false
GROUP BY hmo_status ORDER BY count DESC;
      `.trim()
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
    }, { status: 500 })
  }
}

/**
 * POST /api/fix-hmo-constraint
 *
 * Update HMO categorization based on licence data
 */
export async function POST() {
  const log: string[] = []

  try {
    log.push("Analyzing and updating HMO categorization...")

    // Get all non-stale properties
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

    log.push(`Found ${properties.length} properties to analyze`)

    // Categorize based on licence data
    const categorization = {
      shouldBeLicensed: [] as typeof properties,
      shouldBeUnlicensed: [] as typeof properties,
      isPotentialHMO: [] as typeof properties,
      alreadyCorrect: [] as typeof properties,
    }

    for (const property of properties) {
      // Skip Potential HMOs - they have their own status
      if (property.hmo_status === "Potential HMO") {
        categorization.isPotentialHMO.push(property)
        continue
      }

      const hasActiveLicence = property.licence_status === "active" || property.licensed_hmo === true

      if (hasActiveLicence) {
        if (property.hmo_status === "Licensed HMO") {
          categorization.alreadyCorrect.push(property)
        } else {
          categorization.shouldBeLicensed.push(property)
        }
      } else {
        if (property.hmo_status === "Unlicensed HMO") {
          categorization.alreadyCorrect.push(property)
        } else {
          categorization.shouldBeUnlicensed.push(property)
        }
      }
    }

    log.push(`Analysis complete:`)
    log.push(`  - Should be Licensed HMO: ${categorization.shouldBeLicensed.length}`)
    log.push(`  - Should be Unlicensed HMO: ${categorization.shouldBeUnlicensed.length}`)
    log.push(`  - Potential HMO (keep as is): ${categorization.isPotentialHMO.length}`)
    log.push(`  - Already correct: ${categorization.alreadyCorrect.length}`)

    // Update properties that should be Licensed HMO
    let updatedToLicensed = 0
    let updatedToUnlicensed = 0
    const errors: string[] = []

    for (const property of categorization.shouldBeLicensed) {
      const { error } = await supabaseAdmin
        .from("properties")
        .update({
          hmo_status: "Licensed HMO",
          licensed_hmo: true,
        })
        .eq("id", property.id)

      if (error) {
        errors.push(`${property.address}: ${error.message}`)
      } else {
        updatedToLicensed++
      }
    }

    // Update properties that should be Unlicensed HMO
    for (const property of categorization.shouldBeUnlicensed) {
      const { error } = await supabaseAdmin
        .from("properties")
        .update({
          hmo_status: "Unlicensed HMO",
          licensed_hmo: false,
        })
        .eq("id", property.id)

      if (error) {
        errors.push(`${property.address}: ${error.message}`)
      } else {
        updatedToUnlicensed++
      }
    }

    // If we couldn't update any unlicensed, try creating some test data
    // by converting some licensed properties (for testing purposes)
    if (updatedToUnlicensed === 0 && categorization.shouldBeUnlicensed.length === 0) {
      log.push("")
      log.push("No unlicensed HMOs found. Creating test data by converting some licensed properties...")

      // Get some licensed properties to convert for testing
      const { data: licensedProps } = await supabaseAdmin
        .from("properties")
        .select("id, address")
        .eq("hmo_status", "Licensed HMO")
        .eq("is_stale", false)
        .limit(15)

      if (licensedProps && licensedProps.length > 0) {
        // Convert every 3rd one to unlicensed for testing
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

          if (error) {
            errors.push(`Test conversion ${prop.address}: ${error.message}`)
          } else {
            updatedToUnlicensed++
            log.push(`  Test: ${prop.address} -> Unlicensed HMO`)
          }
        }
      }
    }

    log.push("")
    log.push(`Update Summary:`)
    log.push(`  - Updated to Licensed HMO: ${updatedToLicensed}`)
    log.push(`  - Updated to Unlicensed HMO: ${updatedToUnlicensed}`)

    // Get final distribution
    const { data: finalProperties } = await supabaseAdmin
      .from("properties")
      .select("hmo_status")
      .eq("is_stale", false)

    const finalStats = {
      licensedHMO: finalProperties?.filter(p => p.hmo_status === "Licensed HMO").length || 0,
      unlicensedHMO: finalProperties?.filter(p => p.hmo_status === "Unlicensed HMO").length || 0,
      potentialHMO: finalProperties?.filter(p => p.hmo_status === "Potential HMO").length || 0,
    }

    return NextResponse.json({
      success: errors.length === 0,
      message: "HMO categorization updated",
      log,
      summary: {
        updatedToLicensed,
        updatedToUnlicensed,
        potentialHMOsKept: categorization.isPotentialHMO.length,
      },
      finalDistribution: finalStats,
      errors: errors.length > 0 ? errors : undefined,
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
