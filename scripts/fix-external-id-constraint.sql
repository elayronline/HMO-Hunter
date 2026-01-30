-- ============================================================
-- HMO Hunter: Fix external_id Constraint
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- This fixes: "no unique or exclusion constraint matching ON CONFLICT"
-- ============================================================

-- Step 1: Clean up any NULL external_ids by generating unique ones
UPDATE properties
SET external_id = 'LEGACY-' || id::text
WHERE external_id IS NULL;

-- Step 2: Check for and remove any duplicates (keep the most recent)
-- First, let's see if there are any duplicates
SELECT external_id, COUNT(*) as count
FROM properties
WHERE external_id IS NOT NULL
GROUP BY external_id
HAVING COUNT(*) > 1;

-- If duplicates exist, remove them (keeping the newest record)
DELETE FROM properties a
USING properties b
WHERE a.external_id = b.external_id
  AND a.external_id IS NOT NULL
  AND a.created_at < b.created_at;

-- Step 3: Drop existing constraint if any (won't error if doesn't exist)
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_external_id_key;

-- Step 4: Add the unique constraint
ALTER TABLE properties ADD CONSTRAINT properties_external_id_key UNIQUE (external_id);

-- Step 5: Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_properties_external_id ON properties(external_id);

-- Step 6: Verify the constraint was created
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'properties'
  AND constraint_type = 'UNIQUE';

-- Done! You should see 'properties_external_id_key' in the results above.
SELECT 'Constraint fix complete!' as status;
