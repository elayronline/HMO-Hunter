import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { runIngestion } from "@/app/actions/ingestion"

export const maxDuration = 300 // 5 minutes

/**
 * POST /api/refresh-data
 *
 * Clears sample data and fetches fresh data from all APIs
 */
export async function POST() {
  const log: string[] = []

  try {
    // Step 1: Check if database has required columns
    log.push("[1/4] Checking database schema...")

    const { error: schemaError } = await supabaseAdmin
      .from("properties")
      .select("is_potential_hmo")
      .limit(1)

    if (schemaError && schemaError.message.includes("does not exist")) {
      return NextResponse.json({
        success: false,
        error: "Database missing required columns. Please run the SQL migration first.",
        instructions: "Go to http://localhost:3000/api/fix-database to get the SQL to run in Supabase",
        log,
      }, { status: 400 })
    }

    // Step 2: Clear existing sample/bad data
    log.push("[2/4] Clearing sample data...")

    const { error: deleteError } = await supabaseAdmin
      .from("properties")
      .delete()
      .or("source_name.is.null,source_name.eq.SampleData")

    if (deleteError) {
      log.push(`Warning: Could not delete sample data: ${deleteError.message}`)
    } else {
      log.push("Sample data cleared")
    }

    // Step 3: Run ingestion from all APIs
    log.push("[3/4] Running ingestion from APIs...")

    const results = await runIngestion()

    const summary = {
      sources: results.length,
      created: results.reduce((sum, r) => sum + r.created, 0),
      updated: results.reduce((sum, r) => sum + r.updated, 0),
      skipped: results.reduce((sum, r) => sum + r.skipped, 0),
      errors: results.reduce((sum, r) => sum + r.errors.length, 0),
    }

    log.push(`Ingestion complete: ${summary.created} created, ${summary.updated} updated, ${summary.errors} errors`)

    // Step 4: Verify data
    log.push("[4/4] Verifying data...")

    const { data: properties, error: countError } = await supabaseAdmin
      .from("properties")
      .select("id, city, latitude, longitude, hmo_status, is_potential_hmo")
      .eq("is_stale", false)
      .limit(500)

    const stats = {
      total: properties?.length || 0,
      byCity: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      withCoords: properties?.filter(p => p.latitude && p.longitude).length || 0,
      potentialHMO: properties?.filter(p => p.is_potential_hmo).length || 0,
    }

    properties?.forEach(p => {
      stats.byCity[p.city || "Unknown"] = (stats.byCity[p.city || "Unknown"] || 0) + 1
      stats.byStatus[p.hmo_status || "Unknown"] = (stats.byStatus[p.hmo_status || "Unknown"] || 0) + 1
    })

    log.push(`Total properties: ${stats.total}, With coordinates: ${stats.withCoords}, Potential HMOs: ${stats.potentialHMO}`)

    return NextResponse.json({
      success: true,
      message: "Data refresh complete",
      log,
      ingestionResults: results,
      stats,
    })

  } catch (error) {
    log.push(`Error: ${error}`)
    return NextResponse.json({
      success: false,
      error: String(error),
      log,
    }, { status: 500 })
  }
}

export async function GET() {
  // Check current data status
  const { data: properties, error } = await supabaseAdmin
    .from("properties")
    .select("id, city, latitude, longitude, hmo_status, is_potential_hmo, source_name")
    .eq("is_stale", false)
    .limit(500)

  if (error) {
    return NextResponse.json({
      error: error.message,
      hint: "If the error mentions missing columns, run: GET /api/fix-database and execute the SQL in Supabase",
    }, { status: 500 })
  }

  const stats = {
    total: properties?.length || 0,
    byCity: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    bySource: {} as Record<string, number>,
    withCoords: properties?.filter(p => p.latitude && p.longitude).length || 0,
    potentialHMO: properties?.filter(p => p.is_potential_hmo).length || 0,
  }

  properties?.forEach(p => {
    stats.byCity[p.city || "Unknown"] = (stats.byCity[p.city || "Unknown"] || 0) + 1
    stats.byStatus[p.hmo_status || "Unknown"] = (stats.byStatus[p.hmo_status || "Unknown"] || 0) + 1
    stats.bySource[p.source_name || "Unknown"] = (stats.bySource[p.source_name || "Unknown"] || 0) + 1
  })

  return NextResponse.json({
    message: "Current data status. Use POST to refresh data from APIs.",
    stats,
    instructions: {
      step1: "Run SQL from GET /api/fix-database in Supabase SQL Editor",
      step2: "POST /api/refresh-data to fetch fresh data from APIs",
    },
  })
}
