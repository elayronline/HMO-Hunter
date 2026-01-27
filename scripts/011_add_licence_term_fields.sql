-- Migration 011: Add Licence Term Fields to Properties Table
-- These fields store the HMO licence dates and status directly on the property
-- Run this in Supabase SQL Editor

-- Licensed HMO boolean flag (if not already present)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS licensed_hmo BOOLEAN DEFAULT FALSE;

-- HMO Status (if not already present - original column was hmo_type)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'hmo_status') THEN
    ALTER TABLE properties ADD COLUMN hmo_status TEXT CHECK (hmo_status IN ('Unlicensed HMO', 'Licensed HMO', 'Potential HMO'));
  END IF;
END $$;

-- Licence Term Fields
ALTER TABLE properties ADD COLUMN IF NOT EXISTS licence_id TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS licence_start_date DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS licence_end_date DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS licence_status TEXT CHECK (licence_status IN ('active', 'expired', 'pending', 'none'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS max_occupants INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS uprn TEXT;

-- Create indexes for filtering by licence status and dates
CREATE INDEX IF NOT EXISTS idx_properties_licence_status ON properties(licence_status);
CREATE INDEX IF NOT EXISTS idx_properties_licence_end_date ON properties(licence_end_date);
CREATE INDEX IF NOT EXISTS idx_properties_uprn ON properties(uprn);

-- Add comments for documentation
COMMENT ON COLUMN properties.licence_id IS 'HMO licence reference number from council register';
COMMENT ON COLUMN properties.licence_start_date IS 'Start date of the current HMO licence term';
COMMENT ON COLUMN properties.licence_end_date IS 'End/expiry date of the current HMO licence term';
COMMENT ON COLUMN properties.licence_status IS 'Current status of the HMO licence: active, expired, pending, or none';
COMMENT ON COLUMN properties.max_occupants IS 'Maximum number of occupants permitted under the licence';
COMMENT ON COLUMN properties.uprn IS 'Unique Property Reference Number';
