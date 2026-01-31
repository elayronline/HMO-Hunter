import { NextRequest, NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { requireAdmin } from "@/lib/api-auth"
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit"

/**
 * POST /api/fix-database
 *
 * Comprehensive database fix:
 * 1. Adds missing columns to properties table
 * 2. Creates property_licences table
 * 3. Creates licence_types table
 * 4. Adds unique constraint on external_id
 *
 * Requires admin authentication
 */
export async function POST(request: NextRequest) {
  // Rate limit check
  const rateLimitResponse = checkRateLimit(request, {
    ...RATE_LIMITS.admin,
    keyPrefix: "fix-database"
  })
  if (rateLimitResponse) return rateLimitResponse

  // Require admin access for database modifications
  const auth = await requireAdmin()
  if (!auth.authenticated) {
    return auth.response
  }

  const log: string[] = []
  const issues: { issue: string; status: "fixed" | "needs_manual" | "ok" }[] = []

  try {
    log.push("[FixDB] Starting comprehensive database check and fix...")

    // ============================================
    // 1. Check for unique constraint on external_id
    // ============================================
    log.push("\n[1/4] Checking external_id unique constraint...")

    // Test by trying to find duplicates
    const { data: duplicates } = await supabaseAdmin
      .from("properties")
      .select("external_id")
      .not("external_id", "is", null)

    const externalIds = duplicates?.map(d => d.external_id) || []
    const hasDuplicates = externalIds.length !== new Set(externalIds).size

    if (hasDuplicates) {
      log.push("  - Found duplicate external_ids - need to clean before adding constraint")
      issues.push({ issue: "external_id_duplicates", status: "needs_manual" })
    } else {
      log.push("  - No duplicate external_ids found")
      issues.push({ issue: "external_id_constraint", status: "needs_manual" })
    }

    // ============================================
    // 2. Check property_licences table
    // ============================================
    log.push("\n[2/4] Checking property_licences table...")

    const { error: licencesError } = await supabaseAdmin
      .from("property_licences")
      .select("id")
      .limit(1)

    if (licencesError?.message.includes("does not exist")) {
      log.push("  - Table property_licences does NOT exist")
      issues.push({ issue: "property_licences_table", status: "needs_manual" })
    } else {
      log.push("  - Table property_licences exists")
      issues.push({ issue: "property_licences_table", status: "ok" })
    }

    // ============================================
    // 3. Check licence_types table
    // ============================================
    log.push("\n[3/4] Checking licence_types table...")

    const { error: typesError } = await supabaseAdmin
      .from("licence_types")
      .select("id")
      .limit(1)

    if (typesError?.message.includes("does not exist")) {
      log.push("  - Table licence_types does NOT exist")
      issues.push({ issue: "licence_types_table", status: "needs_manual" })
    } else {
      log.push("  - Table licence_types exists")
      issues.push({ issue: "licence_types_table", status: "ok" })
    }

    // ============================================
    // 4. Check missing columns on properties table
    // ============================================
    log.push("\n[4/4] Checking properties table columns...")

    const columnsToCheck = [
      "article_4_area", "conservation_area", "is_potential_hmo",
      "hmo_classification", "deal_score", "external_id"
    ]

    const missingColumns: string[] = []
    for (const col of columnsToCheck) {
      const { error } = await supabaseAdmin
        .from("properties")
        .select(col)
        .limit(1)

      if (error?.message.includes("does not exist")) {
        missingColumns.push(col)
      }
    }

    if (missingColumns.length > 0) {
      log.push(`  - Missing columns: ${missingColumns.join(", ")}`)
      issues.push({ issue: "missing_columns", status: "needs_manual" })
    } else {
      log.push("  - All required columns exist")
      issues.push({ issue: "missing_columns", status: "ok" })
    }

    // Count issues that need fixing
    const needsManual = issues.filter(i => i.status === "needs_manual").length

    return NextResponse.json({
      success: needsManual === 0,
      message: needsManual === 0
        ? "All database checks passed!"
        : `Found ${needsManual} issues that need manual SQL execution`,
      log,
      issues,
      instructions: needsManual > 0
        ? "Run GET /api/fix-database to get the SQL migration script, then execute it in Supabase SQL Editor"
        : "Database is properly configured",
    })

  } catch (error) {
    log.push(`\nError: ${error}`)
    console.error("[FixDB] Error:", error)
    return NextResponse.json({
      success: false,
      error: String(error),
      log,
      issues,
    }, { status: 500 })
  }
}

export async function GET() {
  // Return the comprehensive SQL migration script
  const sql = `-- ============================================================
-- HMO Hunter Database Migration Script
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ============================================================
-- PART 1: Add unique constraint on external_id
-- This fixes: "no unique or exclusion constraint matching ON CONFLICT"
-- ============================================================

-- First, clean up any NULL external_ids by generating unique ones
UPDATE properties
SET external_id = 'LEGACY-' || id::text
WHERE external_id IS NULL;

-- Remove any duplicates (keep the most recent)
DELETE FROM properties a
USING properties b
WHERE a.external_id = b.external_id
  AND a.id < b.id;

-- Now add the unique constraint
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_external_id_key;
ALTER TABLE properties ADD CONSTRAINT properties_external_id_key UNIQUE (external_id);

-- Also add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_external_id ON properties(external_id);

-- ============================================================
-- PART 2: Create licence_types table
-- ============================================================

CREATE TABLE IF NOT EXISTS licence_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed licence types
INSERT INTO licence_types (code, name, description, display_order) VALUES
  ('mandatory_hmo', 'Mandatory HMO Licence', 'Required for HMOs with 5+ occupants forming 2+ households', 1),
  ('additional_hmo', 'Additional HMO Licence', 'Required in areas with additional licensing schemes', 2),
  ('selective', 'Selective Licence', 'Required for all private rentals in designated areas', 3),
  ('article_4', 'Article 4 Direction', 'Planning permission required for HMO conversion', 4)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- PART 3: Create property_licences table
-- ============================================================

CREATE TABLE IF NOT EXISTS property_licences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  licence_type_id UUID REFERENCES licence_types(id),
  licence_type_code TEXT NOT NULL,
  licence_number TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'unknown' CHECK (status IN ('active', 'expired', 'pending', 'revoked', 'unknown')),
  source TEXT DEFAULT 'manual',
  source_url TEXT,
  max_occupants INTEGER,
  max_households INTEGER,
  conditions JSONB,
  raw_data JSONB,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (property_id, licence_type_code, licence_number)
);

-- Add indexes for property_licences
CREATE INDEX IF NOT EXISTS idx_property_licences_property_id ON property_licences(property_id);
CREATE INDEX IF NOT EXISTS idx_property_licences_status ON property_licences(status);
CREATE INDEX IF NOT EXISTS idx_property_licences_type_code ON property_licences(licence_type_code);

-- ============================================================
-- PART 4: Add missing columns to properties table
-- ============================================================

-- Planning constraints
ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_area BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS conservation_area BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS listed_building_grade TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS planning_constraints JSONB;

-- Potential HMO Analysis
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_potential_hmo BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_classification TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deal_score INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deal_score_breakdown JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS gross_internal_area_sqm DECIMAL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor_area_band TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor_area DECIMAL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS room_count INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS lettable_rooms INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS current_layout JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ceiling_height_compliant BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_suitability_score INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS potential_occupants INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS requires_mandatory_licensing BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_complexity TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS meets_space_standards BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bathroom_ratio_compliant BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS kitchen_size_compliant BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_upgrade_viable BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_upgrade_cost_estimate INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_improvement_potential TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_gross_monthly_rent INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_annual_income INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS yield_band TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_yield_percentage DECIMAL;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_ex_local_authority BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS has_value_add_potential BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS requires_major_structural_work BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS watchlist_count INTEGER DEFAULT 0;

-- ============================================================
-- PART 5: Set default values for existing records
-- ============================================================

UPDATE properties SET
  article_4_area = COALESCE(article_4_area, false),
  conservation_area = COALESCE(conservation_area, false),
  is_potential_hmo = COALESCE(is_potential_hmo, false),
  is_ex_local_authority = COALESCE(is_ex_local_authority, false),
  has_value_add_potential = COALESCE(has_value_add_potential, false),
  requires_major_structural_work = COALESCE(requires_major_structural_work, false),
  watchlist_count = COALESCE(watchlist_count, 0)
WHERE article_4_area IS NULL
   OR conservation_area IS NULL
   OR is_potential_hmo IS NULL;

-- ============================================================
-- PART 6: Enable Row Level Security (RLS) on new tables
-- ============================================================

ALTER TABLE licence_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_licences ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access to licence_types"
  ON licence_types FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to property_licences"
  ON property_licences FOR SELECT
  USING (true);

-- Create policies for service role write access
CREATE POLICY "Allow service role full access to licence_types"
  ON licence_types FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access to property_licences"
  ON property_licences FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================
-- VERIFICATION: Check the migration was successful
-- ============================================================

SELECT 'Migration complete!' as status;

-- Verify tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('properties', 'property_licences', 'licence_types');

-- Verify unique constraint
SELECT constraint_name FROM information_schema.table_constraints
WHERE table_name = 'properties' AND constraint_type = 'UNIQUE';

-- Count records
SELECT
  (SELECT COUNT(*) FROM properties) as properties_count,
  (SELECT COUNT(*) FROM licence_types) as licence_types_count,
  (SELECT COUNT(*) FROM property_licences) as property_licences_count;
`

  return new Response(sql, {
    headers: { 'Content-Type': 'text/plain' }
  })
}
