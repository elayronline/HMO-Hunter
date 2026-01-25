-- Add separate contact fields for Licence Holder (distinct from Title Owner)
-- Run this in Supabase SQL Editor

-- Licence Holder specific contact information
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS licence_holder_name TEXT,
ADD COLUMN IF NOT EXISTS licence_holder_email TEXT,
ADD COLUMN IF NOT EXISTS licence_holder_phone TEXT,
ADD COLUMN IF NOT EXISTS licence_holder_address TEXT;

-- Add comment to clarify the distinction
COMMENT ON COLUMN properties.owner_name IS 'Title Owner name from Land Registry';
COMMENT ON COLUMN properties.owner_contact_email IS 'Title Owner email (from tracing/lookup)';
COMMENT ON COLUMN properties.owner_contact_phone IS 'Title Owner phone (from tracing/lookup)';
COMMENT ON COLUMN properties.licence_holder_name IS 'HMO Licence Holder name from council register';
COMMENT ON COLUMN properties.licence_holder_email IS 'Licence Holder email (from council/lookup)';
COMMENT ON COLUMN properties.licence_holder_phone IS 'Licence Holder phone (from council/lookup)';
COMMENT ON COLUMN properties.licence_holder_address IS 'Licence Holder correspondence address';

-- Index for searching by licence holder
CREATE INDEX IF NOT EXISTS idx_licence_holder_name ON properties(licence_holder_name) WHERE licence_holder_name IS NOT NULL;
