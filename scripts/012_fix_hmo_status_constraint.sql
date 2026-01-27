-- Migration 012: Fix HMO Status Constraint
-- This migration updates the hmo_status CHECK constraint to include "Unlicensed HMO"
-- Run this in Supabase Dashboard > SQL Editor

-- Step 1: Drop the existing constraint
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_hmo_status_check;

-- Step 2: Add the new constraint with correct values
-- Allowed values: 'Unlicensed HMO', 'Licensed HMO', 'Potential HMO'
ALTER TABLE properties ADD CONSTRAINT properties_hmo_status_check
  CHECK (hmo_status IN ('Unlicensed HMO', 'Licensed HMO', 'Potential HMO'));

-- Step 3: Update any old 'Standard HMO' values to 'Unlicensed HMO'
UPDATE properties
SET hmo_status = 'Unlicensed HMO'
WHERE hmo_status = 'Standard HMO';

-- Step 4: For testing - convert some licensed properties to unlicensed
-- This creates test data so you can verify the UI shows both categories
-- Only run this if you want test data

-- Get 5 random licensed properties and make them unlicensed for testing
WITH to_convert AS (
  SELECT id
  FROM properties
  WHERE hmo_status = 'Licensed HMO'
    AND is_stale = false
  LIMIT 5
)
UPDATE properties
SET
  hmo_status = 'Unlicensed HMO',
  licensed_hmo = false,
  licence_status = null
WHERE id IN (SELECT id FROM to_convert);

-- Verify the distribution
SELECT
  hmo_status,
  COUNT(*) as count
FROM properties
WHERE is_stale = false
GROUP BY hmo_status
ORDER BY count DESC;
