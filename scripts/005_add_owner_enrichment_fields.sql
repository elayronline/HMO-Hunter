-- Migration 005: Add Owner/Contact, EPC, and Planning Enrichment Fields
-- Run this in Supabase SQL Editor

-- Owner/Contact Information
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_address TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_type TEXT CHECK (owner_type IN ('individual', 'company', 'trust', 'government', 'unknown'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_contact_email TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_contact_phone TEXT;

-- Company Information (for corporate landlords)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_number TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_status TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS company_incorporation_date DATE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS directors JSONB;

-- EPC (Energy Performance Certificate) Data
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_rating TEXT CHECK (epc_rating IN ('A', 'B', 'C', 'D', 'E', 'F', 'G'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_rating_numeric INTEGER CHECK (epc_rating_numeric >= 0 AND epc_rating_numeric <= 100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_certificate_url TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS epc_expiry_date DATE;

-- Planning Constraints
ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_area BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS planning_constraints JSONB;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS conservation_area BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS listed_building_grade TEXT CHECK (listed_building_grade IN ('I', 'II*', 'II', NULL));

-- Enrichment Tracking
ALTER TABLE properties ADD COLUMN IF NOT EXISTS title_number TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS title_last_enriched_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS owner_enrichment_source TEXT;

-- Create indexes for commonly filtered fields
CREATE INDEX IF NOT EXISTS idx_properties_epc_rating ON properties(epc_rating);
CREATE INDEX IF NOT EXISTS idx_properties_article_4_area ON properties(article_4_area);
CREATE INDEX IF NOT EXISTS idx_properties_conservation_area ON properties(conservation_area);
CREATE INDEX IF NOT EXISTS idx_properties_owner_type ON properties(owner_type);
CREATE INDEX IF NOT EXISTS idx_properties_company_number ON properties(company_number);

-- Add comments for documentation
COMMENT ON COLUMN properties.owner_name IS 'Name of the property owner from Land Registry';
COMMENT ON COLUMN properties.owner_address IS 'Registered address of the property owner';
COMMENT ON COLUMN properties.owner_type IS 'Type of owner: individual, company, trust, government, or unknown';
COMMENT ON COLUMN properties.owner_contact_email IS 'Contact email if available from public records';
COMMENT ON COLUMN properties.owner_contact_phone IS 'Contact phone if available from public records';
COMMENT ON COLUMN properties.company_name IS 'Company name for corporate landlords';
COMMENT ON COLUMN properties.company_number IS 'Companies House registration number';
COMMENT ON COLUMN properties.company_status IS 'Company status (active, dissolved, etc.)';
COMMENT ON COLUMN properties.company_incorporation_date IS 'Date the company was incorporated';
COMMENT ON COLUMN properties.directors IS 'JSON array of company directors with names and roles';
COMMENT ON COLUMN properties.epc_rating IS 'Energy Performance Certificate rating (A-G)';
COMMENT ON COLUMN properties.epc_rating_numeric IS 'Numeric EPC score (0-100)';
COMMENT ON COLUMN properties.epc_certificate_url IS 'URL to the official EPC certificate';
COMMENT ON COLUMN properties.epc_expiry_date IS 'Date when the EPC certificate expires';
COMMENT ON COLUMN properties.article_4_area IS 'Whether the property is in an Article 4 direction area';
COMMENT ON COLUMN properties.planning_constraints IS 'JSON array of planning constraints affecting the property';
COMMENT ON COLUMN properties.conservation_area IS 'Whether the property is in a conservation area';
COMMENT ON COLUMN properties.listed_building_grade IS 'Listed building grade if applicable (I, II*, II)';
COMMENT ON COLUMN properties.title_number IS 'Land Registry title number';
COMMENT ON COLUMN properties.title_last_enriched_at IS 'When title/owner data was last enriched';
COMMENT ON COLUMN properties.owner_enrichment_source IS 'Source of owner enrichment data (searchland, companies_house)';
