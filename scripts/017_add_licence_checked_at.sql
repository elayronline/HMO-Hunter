-- When the HMO register was last read for this property.
--
-- The platform had no way to tell "this licence has expired" from "we have not
-- looked since". It called 98 properties "licence expired"; 83 of them carried
-- licence_status 'active' from the register, and the expiry dates behind the
-- claim were a median of 0.7 years old. Without a read time there is nothing to
-- age the claim against, so the inference could never be qualified — only
-- asserted.
--
-- Null means never read, which is the honest starting state for every existing
-- row: nothing in the table records when its licence data was fetched, and
-- back-filling a date would invent the very fact this column exists to hold.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS licence_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN properties.licence_checked_at IS
  'When an HMO register was last read for this property. Null means never read — never back-fill it.';

-- Reading a licence state is only useful next to when it was read.
CREATE INDEX IF NOT EXISTS idx_properties_licence_checked_at
  ON properties (licence_checked_at)
  WHERE licence_checked_at IS NOT NULL;
