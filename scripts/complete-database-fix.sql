-- ============================================================
-- HMO Hunter: Complete Database Fix
-- Run this ENTIRE script in Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste & Run
-- ============================================================

-- ============================================================
-- PART 1: Fix external_id unique constraint
-- Fixes: "no unique or exclusion constraint matching ON CONFLICT"
-- ============================================================

-- Clean up NULL external_ids
UPDATE properties
SET external_id = 'LEGACY-' || id::text
WHERE external_id IS NULL;

-- Remove duplicates (keep newest)
DELETE FROM properties a
USING properties b
WHERE a.external_id = b.external_id
  AND a.external_id IS NOT NULL
  AND a.id < b.id;

-- Add unique constraint
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_external_id_key;
ALTER TABLE properties ADD CONSTRAINT properties_external_id_key UNIQUE (external_id);

-- Add index
CREATE INDEX IF NOT EXISTS idx_properties_external_id ON properties(external_id);

-- ============================================================
-- PART 2: Create/recreate licence_types table
-- ============================================================

DROP TABLE IF EXISTS property_licences CASCADE;
DROP TABLE IF EXISTS licence_types CASCADE;

CREATE TABLE licence_types (
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
  ('article_4', 'Article 4 Direction', 'Planning permission required for HMO conversion', 4);

-- ============================================================
-- PART 3: Create property_licences table
-- ============================================================

CREATE TABLE property_licences (
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

-- Indexes
CREATE INDEX idx_property_licences_property_id ON property_licences(property_id);
CREATE INDEX idx_property_licences_status ON property_licences(status);
CREATE INDEX idx_property_licences_type_code ON property_licences(licence_type_code);

-- ============================================================
-- PART 4: Enable RLS and create policies
-- ============================================================

ALTER TABLE licence_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_licences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to licence_types" ON licence_types;
DROP POLICY IF EXISTS "Allow public read access to property_licences" ON property_licences;
DROP POLICY IF EXISTS "Allow service role full access to licence_types" ON licence_types;
DROP POLICY IF EXISTS "Allow service role full access to property_licences" ON property_licences;

-- Create read policies for public access
CREATE POLICY "Allow public read access to licence_types"
  ON licence_types FOR SELECT
  USING (true);

CREATE POLICY "Allow public read access to property_licences"
  ON property_licences FOR SELECT
  USING (true);

-- Create write policies for service role
CREATE POLICY "Allow service role full access to licence_types"
  ON licence_types FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow service role full access to property_licences"
  ON property_licences FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- PART 5: Notify PostgREST to reload schema
-- This is done automatically, but we explicitly call it
-- ============================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT 'Migration complete!' as status;

-- Check tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('properties', 'property_licences', 'licence_types')
ORDER BY table_name;

-- Check constraints
SELECT constraint_name, table_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND table_name IN ('properties', 'property_licences')
AND constraint_type IN ('UNIQUE', 'PRIMARY KEY', 'FOREIGN KEY')
ORDER BY table_name, constraint_name;

-- Count records
SELECT 'properties' as table_name, COUNT(*) as count FROM properties
UNION ALL
SELECT 'licence_types', COUNT(*) FROM licence_types
UNION ALL
SELECT 'property_licences', COUNT(*) FROM property_licences;
