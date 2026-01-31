-- Migration: Add HM Land Registry enrichment fields
-- Data source: HM Land Registry Price Paid Data (Free) + Business Gateway (Paid)
-- Run this in Supabase SQL Editor

-- Add Land Registry enrichment columns
ALTER TABLE properties ADD COLUMN IF NOT EXISTS landregistry_last_checked TIMESTAMP WITH TIME ZONE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_sale_price INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS last_sale_date DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type_lr TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS tenure_lr TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS new_build BOOLEAN;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS postcode_avg_price INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS postcode_transactions INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS registered_owner TEXT;

-- Add index for properties without Land Registry data
CREATE INDEX IF NOT EXISTS idx_properties_landregistry_pending
ON properties(landregistry_last_checked)
WHERE landregistry_last_checked IS NULL AND is_stale = false;

-- Add comment
COMMENT ON COLUMN properties.last_sale_price IS 'Last sale price from Land Registry Price Paid Data';
COMMENT ON COLUMN properties.last_sale_date IS 'Date of last sale from Land Registry';
COMMENT ON COLUMN properties.property_type_lr IS 'Property type from Land Registry (Detached, Semi-Detached, Terraced, Flat)';
COMMENT ON COLUMN properties.tenure_lr IS 'Tenure from Land Registry (Freehold, Leasehold)';
COMMENT ON COLUMN properties.new_build IS 'Whether property was new build at time of last sale';
COMMENT ON COLUMN properties.postcode_avg_price IS 'Average sale price in postcode area';
COMMENT ON COLUMN properties.postcode_transactions IS 'Number of transactions in postcode area';
COMMENT ON COLUMN properties.registered_owner IS 'Registered owner name from Land Registry title search';
