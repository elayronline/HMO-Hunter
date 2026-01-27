import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/db-migrate
 *
 * Runs database migrations to add missing columns
 */
export async function POST() {
  const log: string[] = []
  const migrations: string[] = []

  try {
    log.push("Starting database migrations...")

    // Check if epc_certificate_url column exists by trying to select it
    const { error: checkError } = await supabaseAdmin
      .from("properties")
      .select("id")
      .limit(1)

    if (checkError) {
      log.push(`Database connection error: ${checkError.message}`)
      return NextResponse.json({
        success: false,
        error: checkError.message,
        log,
      }, { status: 500 })
    }

    // Try to add epc_certificate_url column
    // Using raw SQL via rpc or direct insert to test
    const testUpdate = await supabaseAdmin
      .from("properties")
      .update({ epc_certificate_url: null } as any)
      .eq("id", "00000000-0000-0000-0000-000000000000") // Non-existent ID

    if (testUpdate.error?.message?.includes("column") && testUpdate.error?.message?.includes("does not exist")) {
      log.push("Column epc_certificate_url does not exist - needs to be added via Supabase dashboard")
      migrations.push("epc_certificate_url")
    } else {
      log.push("Column epc_certificate_url already exists or accessible")
    }

    // Check for epc_expiry_date
    const testUpdate2 = await supabaseAdmin
      .from("properties")
      .update({ epc_expiry_date: null } as any)
      .eq("id", "00000000-0000-0000-0000-000000000000")

    if (testUpdate2.error?.message?.includes("column") && testUpdate2.error?.message?.includes("does not exist")) {
      log.push("Column epc_expiry_date does not exist - needs to be added via Supabase dashboard")
      migrations.push("epc_expiry_date")
    } else {
      log.push("Column epc_expiry_date already exists or accessible")
    }

    // Check for epc_rating_numeric
    const testUpdate3 = await supabaseAdmin
      .from("properties")
      .update({ epc_rating_numeric: null } as any)
      .eq("id", "00000000-0000-0000-0000-000000000000")

    if (testUpdate3.error?.message?.includes("column") && testUpdate3.error?.message?.includes("does not exist")) {
      log.push("Column epc_rating_numeric does not exist - needs to be added via Supabase dashboard")
      migrations.push("epc_rating_numeric")
    } else {
      log.push("Column epc_rating_numeric already exists or accessible")
    }

    if (migrations.length > 0) {
      return NextResponse.json({
        success: false,
        message: "Database migrations needed",
        migrationsNeeded: migrations,
        sql: `
-- Run this SQL in Supabase Dashboard > SQL Editor:

-- Add EPC certificate URL column
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_certificate_url TEXT;

-- Add EPC expiry date column
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_expiry_date DATE;

-- Add EPC rating numeric column
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_rating_numeric INTEGER;

-- Create index for EPC queries
CREATE INDEX IF NOT EXISTS idx_properties_epc_certificate ON properties(epc_certificate_url) WHERE epc_certificate_url IS NOT NULL;
        `.trim(),
        log,
      })
    }

    return NextResponse.json({
      success: true,
      message: "All required columns exist",
      log,
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
 * GET /api/db-migrate
 */
export async function GET() {
  return NextResponse.json({
    message: "POST to check and run database migrations",
    description: "Checks for missing columns and provides SQL to add them",
    usage: {
      method: "POST",
      body: "none required",
    },
  })
}
