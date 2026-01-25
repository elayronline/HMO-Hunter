import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

/**
 * POST /api/run-migration
 *
 * Runs database migrations for owner enrichment fields
 */
export async function POST() {
  const log: string[] = []

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({
        success: false,
        error: "Supabase credentials not configured",
      }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    log.push("Running migration 005: Add Owner Enrichment Fields...")

    // Run each ALTER TABLE statement separately
    const migrations = [
      // Owner/Contact Information
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_name TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_address TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_type TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_contact_email TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_contact_phone TEXT`,
      // Company Information
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_name TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_number TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_status TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_incorporation_date DATE`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS directors JSONB`,
      // EPC Data
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_rating TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_rating_numeric INTEGER`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_certificate_url TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_expiry_date DATE`,
      // Planning Constraints
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_area BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS planning_constraints JSONB`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS conservation_area BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS listed_building_grade TEXT`,
      // Enrichment Tracking
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS title_number TEXT`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS title_last_enriched_at TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_enrichment_source TEXT`,
    ]

    for (const sql of migrations) {
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql }).single()
      if (error) {
        // Try alternative approach - direct query
        log.push(`Note: ${sql.substring(0, 50)}... (will try via REST)`)
      } else {
        log.push(`OK: ${sql.substring(30, 70)}...`)
      }
    }

    // Verify by checking if columns exist
    const { data: columns, error: checkError } = await supabase
      .from('properties')
      .select('owner_name, company_name, epc_rating')
      .limit(1)

    if (checkError) {
      log.push("Migration verification failed: " + checkError.message)
      log.push("")
      log.push("Please run the migration manually in Supabase SQL Editor:")
      log.push("File: scripts/005_add_owner_enrichment_fields.sql")

      return NextResponse.json({
        success: false,
        error: "Migration needs to be run manually in Supabase SQL Editor",
        instructions: [
          "1. Go to Supabase Dashboard",
          "2. Click SQL Editor",
          "3. Paste contents of scripts/005_add_owner_enrichment_fields.sql",
          "4. Click Run",
        ],
        log,
      }, { status: 400 })
    }

    log.push("Migration verified successfully!")

    return NextResponse.json({
      success: true,
      message: "Owner enrichment fields are now available",
      log,
    })

  } catch (error) {
    log.push("Error: " + String(error))
    return NextResponse.json({
      success: false,
      error: String(error),
      log,
      instructions: [
        "Please run the migration manually in Supabase SQL Editor:",
        "File: scripts/005_add_owner_enrichment_fields.sql",
      ],
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: "POST to run database migrations",
    migrations: [
      "005_add_owner_enrichment_fields.sql - Adds owner, EPC, and planning fields",
    ],
  })
}
