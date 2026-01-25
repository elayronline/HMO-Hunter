import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase-admin"

/**
 * POST /api/fix-database
 *
 * Adds missing columns to the properties table for Potential HMO analysis
 */
export async function POST() {
  try {
    console.log("[FixDB] Adding missing columns to properties table...")

    // Add columns one by one to handle cases where some already exist
    const columnsToAdd = [
      // Phase 3 - Planning
      { name: "article_4_area", type: "BOOLEAN DEFAULT false" },
      { name: "conservation_area", type: "BOOLEAN DEFAULT false" },
      { name: "listed_building_grade", type: "TEXT" },
      { name: "planning_constraints", type: "JSONB" },

      // Phase 4 - Potential HMO Analysis
      { name: "is_potential_hmo", type: "BOOLEAN DEFAULT false" },
      { name: "hmo_classification", type: "TEXT" },
      { name: "deal_score", type: "INTEGER" },
      { name: "deal_score_breakdown", type: "JSONB" },
      { name: "gross_internal_area_sqm", type: "DECIMAL" },
      { name: "floor_area_band", type: "TEXT" },
      { name: "room_count", type: "INTEGER" },
      { name: "lettable_rooms", type: "INTEGER" },
      { name: "current_layout", type: "JSONB" },
      { name: "ceiling_height_compliant", type: "BOOLEAN" },
      { name: "hmo_suitability_score", type: "INTEGER" },
      { name: "potential_occupants", type: "INTEGER" },
      { name: "requires_mandatory_licensing", type: "BOOLEAN" },
      { name: "compliance_complexity", type: "TEXT" },
      { name: "meets_space_standards", type: "BOOLEAN" },
      { name: "bathroom_ratio_compliant", type: "BOOLEAN" },
      { name: "kitchen_size_compliant", type: "BOOLEAN" },
      { name: "epc_upgrade_viable", type: "BOOLEAN" },
      { name: "epc_upgrade_cost_estimate", type: "INTEGER" },
      { name: "epc_improvement_potential", type: "TEXT" },
      { name: "estimated_gross_monthly_rent", type: "INTEGER" },
      { name: "estimated_annual_income", type: "INTEGER" },
      { name: "yield_band", type: "TEXT" },
      { name: "estimated_yield_percentage", type: "DECIMAL" },
      { name: "is_ex_local_authority", type: "BOOLEAN DEFAULT false" },
      { name: "has_value_add_potential", type: "BOOLEAN DEFAULT false" },
      { name: "requires_major_structural_work", type: "BOOLEAN DEFAULT false" },
      { name: "watchlist_count", type: "INTEGER DEFAULT 0" },
      { name: "floor_area", type: "DECIMAL" },
    ]

    const results: { column: string; status: string }[] = []

    for (const col of columnsToAdd) {
      try {
        // Try to add the column - will fail if it already exists
        const { error } = await supabaseAdmin.rpc('exec_sql', {
          sql: `ALTER TABLE properties ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
        })

        if (error) {
          // Try direct SQL if RPC fails
          const { error: directError } = await supabaseAdmin
            .from('properties')
            .select(col.name)
            .limit(1)

          if (directError && directError.message.includes('does not exist')) {
            results.push({ column: col.name, status: "needs_manual_add" })
          } else {
            results.push({ column: col.name, status: "exists" })
          }
        } else {
          results.push({ column: col.name, status: "added" })
        }
      } catch (err) {
        results.push({ column: col.name, status: `error: ${err}` })
      }
    }

    // Generate SQL for manual execution if needed
    const manualSQL = columnsToAdd.map(col =>
      `ALTER TABLE properties ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
    ).join('\n')

    return NextResponse.json({
      message: "Database check complete",
      results,
      manualSQL,
      instructions: "If columns show 'needs_manual_add', run the SQL in Supabase SQL Editor"
    })

  } catch (error) {
    console.error("[FixDB] Error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function GET() {
  // Return the SQL that needs to be run manually
  const sql = `
-- Run this in Supabase SQL Editor to add missing columns

-- Phase 3 - Planning constraints
ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_area BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS conservation_area BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS listed_building_grade TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS planning_constraints JSONB;

-- Phase 4 - Potential HMO Analysis
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

-- Update existing properties to have default values
UPDATE properties SET
  article_4_area = COALESCE(article_4_area, false),
  conservation_area = COALESCE(conservation_area, false),
  is_potential_hmo = COALESCE(is_potential_hmo, false),
  is_ex_local_authority = COALESCE(is_ex_local_authority, false),
  has_value_add_potential = COALESCE(has_value_add_potential, false),
  requires_major_structural_work = COALESCE(requires_major_structural_work, false),
  watchlist_count = COALESCE(watchlist_count, 0);
`

  return new Response(sql, {
    headers: { 'Content-Type': 'text/plain' }
  })
}
