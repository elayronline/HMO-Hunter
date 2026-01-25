-- Migration 006: Add Potential HMO Analysis Fields
-- Run this in Supabase SQL Editor

-- Floor Area & Layout
ALTER TABLE properties ADD COLUMN IF NOT EXISTS gross_internal_area_sqm DECIMAL(10,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor_area_band TEXT CHECK (floor_area_band IN ('under_90', '90_120', '120_plus'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS room_count INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS lettable_rooms INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS current_layout JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS ceiling_height_compliant BOOLEAN;

-- HMO Suitability & Classification
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_suitability_score INTEGER CHECK (hmo_suitability_score >= 0 AND hmo_suitability_score <= 100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_classification TEXT CHECK (hmo_classification IN ('ready_to_go', 'value_add', 'not_suitable'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS potential_occupants INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS requires_mandatory_licensing BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS compliance_complexity TEXT CHECK (compliance_complexity IN ('low', 'medium', 'high'));

-- Space Standards Compliance
ALTER TABLE properties ADD COLUMN IF NOT EXISTS meets_space_standards BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS bathroom_ratio_compliant BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS kitchen_size_compliant BOOLEAN;

-- EPC & Upgrade Viability
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_upgrade_viable BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_upgrade_cost_estimate INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_improvement_potential TEXT CHECK (epc_improvement_potential IN ('high', 'medium', 'low', 'none'));

-- Financial Analysis
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_rent_per_room INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_gross_monthly_rent INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_annual_income INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS yield_band TEXT CHECK (yield_band IN ('low', 'medium', 'high'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_yield_percentage DECIMAL(5,2);

-- Deal Scoring
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deal_score INTEGER CHECK (deal_score >= 0 AND deal_score <= 100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deal_score_breakdown JSONB;

-- Property Flags
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_ex_local_authority BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS has_value_add_potential BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS requires_major_structural_work BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_potential_hmo BOOLEAN DEFAULT FALSE;

-- Watchlist
ALTER TABLE properties ADD COLUMN IF NOT EXISTS watchlist_count INTEGER DEFAULT 0;

-- Create indexes for filtering
CREATE INDEX IF NOT EXISTS idx_properties_is_potential_hmo ON properties(is_potential_hmo);
CREATE INDEX IF NOT EXISTS idx_properties_hmo_classification ON properties(hmo_classification);
CREATE INDEX IF NOT EXISTS idx_properties_floor_area_band ON properties(floor_area_band);
CREATE INDEX IF NOT EXISTS idx_properties_yield_band ON properties(yield_band);
CREATE INDEX IF NOT EXISTS idx_properties_deal_score ON properties(deal_score);
CREATE INDEX IF NOT EXISTS idx_properties_is_ex_local_authority ON properties(is_ex_local_authority);

-- Add comments
COMMENT ON COLUMN properties.gross_internal_area_sqm IS 'Gross internal floor area in square meters';
COMMENT ON COLUMN properties.floor_area_band IS 'Floor area classification: under_90, 90_120, 120_plus';
COMMENT ON COLUMN properties.hmo_suitability_score IS 'Overall HMO suitability score 0-100';
COMMENT ON COLUMN properties.hmo_classification IS 'ready_to_go, value_add, or not_suitable';
COMMENT ON COLUMN properties.deal_score IS 'Overall deal ranking score 0-100';
COMMENT ON COLUMN properties.deal_score_breakdown IS 'JSON breakdown of scoring factors';
COMMENT ON COLUMN properties.is_potential_hmo IS 'Flag for properties identified as potential HMOs';
