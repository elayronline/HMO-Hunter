-- Migration: Add broadband/connectivity fields to properties table
-- Source: Ofcom Connected Nations Broadband API
-- Date: 2026-01-28

-- Add broadband speed fields
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS broadband_basic_down DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS broadband_basic_up DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS broadband_superfast_down DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS broadband_superfast_up DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS broadband_ultrafast_down DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS broadband_ultrafast_up DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS broadband_max_down DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS broadband_max_up DECIMAL(10, 2) DEFAULT NULL;

-- Add fiber/superfast availability flags
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS has_fiber BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS has_superfast BOOLEAN DEFAULT NULL;

-- Add tracking field
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS broadband_last_checked TIMESTAMPTZ DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN properties.broadband_basic_down IS 'Basic broadband max download speed in Mbps (from Ofcom)';
COMMENT ON COLUMN properties.broadband_basic_up IS 'Basic broadband max upload speed in Mbps (from Ofcom)';
COMMENT ON COLUMN properties.broadband_superfast_down IS 'Superfast broadband (30Mbps+) max download speed in Mbps';
COMMENT ON COLUMN properties.broadband_superfast_up IS 'Superfast broadband max upload speed in Mbps';
COMMENT ON COLUMN properties.broadband_ultrafast_down IS 'Ultrafast/Full Fiber (100Mbps+) max download speed in Mbps';
COMMENT ON COLUMN properties.broadband_ultrafast_up IS 'Ultrafast/Full Fiber max upload speed in Mbps';
COMMENT ON COLUMN properties.broadband_max_down IS 'Maximum available download speed across all technologies in Mbps';
COMMENT ON COLUMN properties.broadband_max_up IS 'Maximum available upload speed across all technologies in Mbps';
COMMENT ON COLUMN properties.has_fiber IS 'Whether Full Fiber (FTTP) broadband is available at this property';
COMMENT ON COLUMN properties.has_superfast IS 'Whether Superfast broadband (30Mbps+) is available at this property';
COMMENT ON COLUMN properties.broadband_last_checked IS 'When broadband availability was last checked via Ofcom API';

-- Create index for filtering by fiber availability
CREATE INDEX IF NOT EXISTS idx_properties_has_fiber ON properties(has_fiber) WHERE has_fiber IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_properties_has_superfast ON properties(has_superfast) WHERE has_superfast IS NOT NULL;

-- Create index for filtering by broadband speed
CREATE INDEX IF NOT EXISTS idx_properties_broadband_max_down ON properties(broadband_max_down) WHERE broadband_max_down IS NOT NULL;
