-- Migration: Add broadband coverage lookup table
-- Data source: OFCOM Connected Nations 2024
-- Run this in Supabase SQL Editor

-- Create broadband coverage table
CREATE TABLE IF NOT EXISTS broadband_coverage (
  postcode TEXT PRIMARY KEY,
  sfbb_available NUMERIC,      -- Superfast (30Mbit+) availability %
  ufbb_available NUMERIC,      -- Ultrafast (100Mbit+) availability %
  gigabit_available NUMERIC,   -- Gigabit (1000Mbit+) availability %
  below_uso NUMERIC,           -- % premises below Universal Service Obligation
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_broadband_postcode ON broadband_coverage(postcode);

-- Add comment
COMMENT ON TABLE broadband_coverage IS 'OFCOM Connected Nations 2024 broadband coverage data by postcode';

-- Grant access
GRANT SELECT ON broadband_coverage TO anon, authenticated;
