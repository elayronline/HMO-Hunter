-- ============================================================================
-- DO NOT RUN. This migration invents licence data.
-- ============================================================================
--
-- Kept only as the provenance record for what it did, because comments across
-- lib/properties/category.ts, the detail-page components and three test files
-- cite it by name to explain why certain columns may not be read.
--
-- It writes, for every property whose hmo_status is 'Licensed HMO':
--
--   licence_id           SUBSTRING(MD5(address) FROM 1 FOR 6) behind a city
--                        prefix — a reference no council ever issued
--   licence_start_date   one hardcoded date per city
--   licence_end_date     one hardcoded date per city, so 252 properties shared
--                        six expiry dates
--   max_occupants        bedrooms + 1
--   licence_status       'active', which is the council's word to use, not ours
--
-- It ran once, and the values sat in the database for months looking exactly
-- like data a council had published. The map, the list, the export, the
-- property detail page and the HMO checker all read them and presented them as
-- register facts — a licence reference, an expiry date and a licensed
-- occupancy, none of which existed.
--
-- scripts/016_clear_seeded_licence_data.sql removed all of it on 2026-08-15.
-- Running this file again would put every bit of it back, and this time it
-- would land on top of real licence data from the ingestion adapters, where
-- telling the two apart would no longer be possible.
--
-- Real licence data comes from the register columns — hmo_licence_reference
-- and hmo_licence_expiry — and, when it is connected, the Kamma integration.
-- See licenceExpiry() in lib/properties/category.ts.
--
-- ============================================================================

-- Migration 012: Populate Licence Term Data for Existing Licensed HMOs
-- Run this AFTER running 011_add_licence_term_fields.sql
-- This adds sample licence dates to properties marked as "Licensed HMO"

-- Update Licensed HMOs with sample licence data
-- Licence terms are typically 5 years, with staggered start dates

-- London Licensed HMOs
UPDATE properties SET
  licence_id = 'LDN-HMO-' || SUBSTRING(MD5(address) FROM 1 FOR 6),
  licence_start_date = '2022-03-15',
  licence_end_date = '2027-03-14',
  licence_status = 'active',
  max_occupants = bedrooms + 1,
  licensed_hmo = true
WHERE hmo_status = 'Licensed HMO' AND city = 'London';

-- Manchester Licensed HMOs
UPDATE properties SET
  licence_id = 'MCR-HMO-' || SUBSTRING(MD5(address) FROM 1 FOR 6),
  licence_start_date = '2021-09-01',
  licence_end_date = '2026-08-31',
  licence_status = 'active',
  max_occupants = bedrooms + 1,
  licensed_hmo = true
WHERE hmo_status = 'Licensed HMO' AND city = 'Manchester';

-- Birmingham Licensed HMOs
UPDATE properties SET
  licence_id = 'BHM-HMO-' || SUBSTRING(MD5(address) FROM 1 FOR 6),
  licence_start_date = '2023-01-10',
  licence_end_date = '2028-01-09',
  licence_status = 'active',
  max_occupants = bedrooms + 1,
  licensed_hmo = true
WHERE hmo_status = 'Licensed HMO' AND city = 'Birmingham';

-- Bristol Licensed HMOs
UPDATE properties SET
  licence_id = 'BRS-HMO-' || SUBSTRING(MD5(address) FROM 1 FOR 6),
  licence_start_date = '2020-06-20',
  licence_end_date = '2025-06-19',
  licence_status = 'active',
  max_occupants = bedrooms + 1,
  licensed_hmo = true
WHERE hmo_status = 'Licensed HMO' AND city = 'Bristol';

-- Reading Licensed HMOs
UPDATE properties SET
  licence_id = 'RDG-HMO-' || SUBSTRING(MD5(address) FROM 1 FOR 6),
  licence_start_date = '2022-11-01',
  licence_end_date = '2027-10-31',
  licence_status = 'active',
  max_occupants = bedrooms + 1,
  licensed_hmo = true
WHERE hmo_status = 'Licensed HMO' AND city = 'Reading';

-- Newcastle Licensed HMOs
UPDATE properties SET
  licence_id = 'NCL-HMO-' || SUBSTRING(MD5(address) FROM 1 FOR 6),
  licence_start_date = '2021-04-15',
  licence_end_date = '2026-04-14',
  licence_status = 'active',
  max_occupants = bedrooms + 1,
  licensed_hmo = true
WHERE hmo_status = 'Licensed HMO' AND city = 'Newcastle';

-- All other Licensed HMOs (catch-all for any other cities)
UPDATE properties SET
  licence_id = 'UK-HMO-' || SUBSTRING(MD5(address) FROM 1 FOR 6),
  licence_start_date = '2022-01-01',
  licence_end_date = '2026-12-31',
  licence_status = 'active',
  max_occupants = bedrooms + 1,
  licensed_hmo = true
WHERE hmo_status = 'Licensed HMO'
  AND licence_id IS NULL;

-- Add one expired licence example in Bristol for demonstration
UPDATE properties SET
  licence_start_date = '2019-06-20',
  licence_end_date = '2024-06-19',
  licence_status = 'expired'
WHERE address = '78 Redland Road' AND city = 'Bristol';

-- Verify the updates
SELECT
  city,
  COUNT(*) as total_licensed,
  COUNT(licence_id) as with_licence_id,
  COUNT(licence_start_date) as with_start_date,
  COUNT(licence_end_date) as with_end_date
FROM properties
WHERE hmo_status = 'Licensed HMO'
GROUP BY city
ORDER BY city;
