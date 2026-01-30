-- Migration: Add enrichment fields for Zoopla, StreetData, PaTMa, and PropertyData APIs
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════════════════════
-- ZOOPLA ENRICHMENT FIELDS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_listing_id TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_listing_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_price_pcm INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_price_pw INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_agent_name TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_agent_phone TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_images JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_floor_plan_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_first_published DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_days_on_market INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_area_avg_price INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_zed_index INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zoopla_enriched_at TIMESTAMP WITH TIME ZONE;

-- ═══════════════════════════════════════════════════════════════════════════
-- STREETDATA ENRICHMENT FIELDS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE properties ADD COLUMN IF NOT EXISTS streetdata_property_id TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS year_built TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS construction_age_band TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tenure TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS council_tax_band TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS internal_area_sqm NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_bungalow BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS has_outdoor_space BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS streetdata_enriched_at TIMESTAMP WITH TIME ZONE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PATMA ENRICHMENT FIELDS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE properties ADD COLUMN IF NOT EXISTS patma_asking_price_mean INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS patma_asking_price_median INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS patma_sold_price_mean INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS patma_sold_price_median INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS patma_price_data_points INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS patma_search_radius_miles NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS patma_enriched_at TIMESTAMP WITH TIME ZONE;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROPERTYDATA HMO ENRICHMENT FIELDS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_licence_reference TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_licence_type TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_licence_expiry DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_council TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_max_occupancy INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_sleeping_rooms INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_shared_bathrooms INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS propertydata_enriched_at TIMESTAMP WITH TIME ZONE;

-- ═══════════════════════════════════════════════════════════════════════════
-- CALCULATED/DERIVED FIELDS
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_rental_yield NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS price_per_sqm NUMERIC;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_enriched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS enrichment_sources JSONB;

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_properties_zoopla_listing_id ON properties(zoopla_listing_id);
CREATE INDEX IF NOT EXISTS idx_properties_hmo_licence_reference ON properties(hmo_licence_reference);
CREATE INDEX IF NOT EXISTS idx_properties_year_built ON properties(year_built);
CREATE INDEX IF NOT EXISTS idx_properties_tenure ON properties(tenure);
CREATE INDEX IF NOT EXISTS idx_properties_last_enriched ON properties(last_enriched_at);
