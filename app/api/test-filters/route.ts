import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/test-filters
 *
 * Adds varied test data for filter testing
 */
export async function POST() {
  const log: string[] = []

  try {
    log.push("Adding test filter data...")

    // Get all properties
    const { data: properties, error: fetchError } = await supabaseAdmin
      .from("properties")
      .select("id, address")
      .eq("is_stale", false)
      .limit(30)

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

    log.push(`Found ${properties.length} properties to update`)

    // Distribute filter values across properties for realistic testing
    const today = new Date()
    const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    const pastDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago

    let updated = 0

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i]

      // Distribute values to create variety:
      // ~20% pet friendly
      // ~50% furnished
      // ~60% student friendly
      // ~40% available now, ~30% available in future, ~30% null (immediate)

      const isPetFriendly = i % 5 === 0
      const isFurnished = i % 2 === 0
      const isStudentFriendly = i % 5 !== 3 && i % 5 !== 4

      let availableFrom: string | null = null
      if (i % 3 === 0) {
        // Available now (past date)
        availableFrom = pastDate.toISOString().split("T")[0]
      } else if (i % 3 === 1) {
        // Available in future
        availableFrom = futureDate.toISOString().split("T")[0]
      }
      // else null = immediately available

      const { error: updateError } = await supabaseAdmin
        .from("properties")
        .update({
          is_pet_friendly: isPetFriendly,
          is_furnished: isFurnished,
          is_student_friendly: isStudentFriendly,
          available_from: availableFrom,
        })
        .eq("id", property.id)

      if (updateError) {
        log.push(`  Error updating ${property.address}: ${updateError.message}`)
      } else {
        updated++
        log.push(`  Updated: ${property.address}`)
        log.push(`    - Pet Friendly: ${isPetFriendly}`)
        log.push(`    - Furnished: ${isFurnished}`)
        log.push(`    - Student Friendly: ${isStudentFriendly}`)
        log.push(`    - Available From: ${availableFrom || "Immediate"}`)
      }
    }

    log.push("")
    log.push(`Updated ${updated} properties with test filter data`)

    return NextResponse.json({
      success: true,
      message: `Updated ${updated} properties with varied filter data`,
      log,
      summary: {
        petFriendly: Math.floor(properties.length / 5),
        furnished: Math.floor(properties.length / 2),
        studentFriendly: Math.floor(properties.length * 0.6),
        availableNow: Math.floor(properties.length / 3) + Math.floor(properties.length / 3),
        availableFuture: Math.floor(properties.length / 3),
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

/**
 * GET /api/test-filters
 *
 * Check current filter data distribution
 */
export async function GET() {
  try {
    const { data: properties } = await supabaseAdmin
      .from("properties")
      .select("id, is_pet_friendly, is_furnished, is_student_friendly, available_from")
      .eq("is_stale", false)

    if (!properties) {
      return NextResponse.json({ error: "No properties found" }, { status: 404 })
    }

    const today = new Date().toISOString().split("T")[0]

    const stats = {
      total: properties.length,
      petFriendly: properties.filter(p => p.is_pet_friendly === true).length,
      notPetFriendly: properties.filter(p => p.is_pet_friendly === false).length,
      furnished: properties.filter(p => p.is_furnished === true).length,
      notFurnished: properties.filter(p => p.is_furnished === false).length,
      studentFriendly: properties.filter(p => p.is_student_friendly === true).length,
      notStudentFriendly: properties.filter(p => p.is_student_friendly === false).length,
      availableNow: properties.filter(p => p.available_from === null || p.available_from <= today).length,
      availableFuture: properties.filter(p => p.available_from !== null && p.available_from > today).length,
      noAvailabilityDate: properties.filter(p => p.available_from === null).length,
    }

    return NextResponse.json({
      message: "Current filter data distribution",
      stats,
      percentages: {
        petFriendly: `${((stats.petFriendly / stats.total) * 100).toFixed(1)}%`,
        furnished: `${((stats.furnished / stats.total) * 100).toFixed(1)}%`,
        studentFriendly: `${((stats.studentFriendly / stats.total) * 100).toFixed(1)}%`,
        availableNow: `${((stats.availableNow / stats.total) * 100).toFixed(1)}%`,
      },
      recommendation: stats.petFriendly === 0
        ? "POST to this endpoint to add varied test data for filter testing"
        : "Filter data looks varied enough for testing",
    })
  } catch (error) {
    return NextResponse.json({
      error: String(error),
    }, { status: 500 })
  }
}
