-- Migration 016: Clear the licence data invented by migration 012
--
-- scripts/DO_NOT_RUN_012_populate_licence_term_data.sql opens with "This adds sample
-- licence dates to properties marked as Licensed HMO" and then writes, for
-- every licensed row in each city, one hardcoded start/end pair, a reference
-- built from MD5(address), and an occupancy of bedrooms + 1. It has been in
-- the database ever since, indistinguishable from data a council published.
--
-- WHAT IT LEFT BEHIND (measured 2026-08-15, 2,958 rows)
--
--   licence_id           252 rows, 252 matching ^[A-Z]{2,3}-HMO-[0-9a-f]{6}$
--                        and zero not matching — there is no real reference in
--                        the column at all
--   licence_start_date   252 rows, 6 distinct values
--   licence_end_date     252 rows, 6 distinct values
--   max_occupants        252 rows, 252 equal to bedrooms + 1
--
-- Six expiry dates across 252 properties is the tell. Real licences do not
-- expire on six days.
--
-- The published equivalents live in hmo_licence_reference (335 rows, 314
-- distinct — 24/02862/HMOMAN, 2023/01386/HMO/PS, HAC-117637-1) and
-- hmo_licence_expiry (313 rows, 255 distinct). Those are untouched here.
--
-- WHY NOW
--
-- The read path already stopped using these columns, and
-- tests/seeded-licence-columns.test.ts keeps it that way. But ingestion still
-- writes to them — lib/ingestion/adapters/searchland.ts,
-- adapters/propertydata-hmo.ts, app/api/enrich-hmo-licence, and
-- app/api/scrape-council-hmo all set licence_id, licence_end_date and
-- max_occupants from real registers. The moment one of those runs, a genuine
-- licence term lands in a column that is 100% fiction today, and the two
-- become impossible to tell apart. Clearing the seed first is what keeps that
-- distinction available.
--
-- WHAT THIS DOES NOT TOUCH, DELIBERATELY
--
--   licensed_hmo    Migration 012 set it true, but only WHERE hmo_status =
--                   'Licensed HMO', which was already on the row from a
--                   source. The flag is a restatement of that, not an
--                   invention, and it decides whether a property is served at
--                   all — clearing it would remove 252 properties from the
--                   platform.
--
--   licence_status  'active' on 232 of these rows is migration 012's word, not
--                   a council's, so it has a claim to being cleared. It is
--                   left because nulling it would silently shrink the "Any
--                   Licensed HMO" filter: that query uses PostgREST
--                   `licence_status=neq.expired`, and SQL three-valued logic
--                   excludes NULL from a `<>` comparison — verified against
--                   this database, where 2,364 NULL rows are matched by
--                   neq.expired exactly 0 times. Clear it only together with a
--                   change to `or(licence_status.is.null,
--                   licence_status.neq.expired)` in getProperties().
--
-- AFTER THIS RUNS
--
-- 113 of the 252 carry published licence data and will show it. The other 139
-- will read "Licensed, but the register published no reference or dates",
-- which is what was true all along.
--
-- Safe to run twice: every statement is guarded on the seeded values still
-- being present.

BEGIN;

-- Before.
SELECT
  'before' AS stage,
  count(*) FILTER (WHERE licence_id IS NOT NULL)         AS licence_id,
  count(*) FILTER (WHERE licence_start_date IS NOT NULL) AS licence_start_date,
  count(*) FILTER (WHERE licence_end_date IS NOT NULL)   AS licence_end_date,
  count(*) FILTER (WHERE max_occupants IS NOT NULL)      AS max_occupants
FROM properties;

-- Refuse to run if anything in these columns is NOT recognisably seeded.
-- A real value would mean ingestion has already written one, and this
-- migration must not delete it.
DO $$
DECLARE
  unrecognised integer;
BEGIN
  SELECT count(*) INTO unrecognised
  FROM properties
  WHERE (licence_id IS NOT NULL AND licence_id !~ '^[A-Z]{2,3}-HMO-[0-9a-f]{6}$')
     OR (licence_id IS NULL AND (licence_start_date IS NOT NULL
                              OR licence_end_date IS NOT NULL
                              OR max_occupants IS NOT NULL));

  IF unrecognised > 0 THEN
    RAISE EXCEPTION
      'Aborting: % row(s) hold licence data that does not match the migration-012 signature. Real licence data may have landed since this migration was written — review those rows before clearing anything.',
      unrecognised;
  END IF;
END $$;

-- The reference. Every value is SUBSTRING(MD5(address) FROM 1 FOR 6) behind a
-- city prefix; the guard makes that explicit rather than trusting the count.
UPDATE properties
SET licence_id = NULL
WHERE licence_id ~ '^[A-Z]{2,3}-HMO-[0-9a-f]{6}$';

-- The term. Only the exact pairs migration 012 writes, so a real term that
-- happens to sit on a seeded row survives. The last pair is its "Add one
-- expired licence example in Bristol for demonstration".
UPDATE properties
SET licence_start_date = NULL,
    licence_end_date = NULL
WHERE (licence_start_date, licence_end_date) IN (
  (DATE '2022-03-15', DATE '2027-03-14'),  -- London
  (DATE '2021-09-01', DATE '2026-08-31'),  -- Manchester
  (DATE '2023-01-10', DATE '2028-01-09'),  -- Birmingham
  (DATE '2020-06-20', DATE '2025-06-19'),  -- Bristol
  (DATE '2022-11-01', DATE '2027-10-31'),  -- Reading
  (DATE '2021-04-15', DATE '2026-04-14'),  -- Newcastle
  (DATE '2022-01-01', DATE '2026-12-31'),  -- catch-all
  (DATE '2019-06-20', DATE '2024-06-19')   -- 78 Redland Road, Bristol
);

-- The occupancy, only where it is still the formula.
UPDATE properties
SET max_occupants = NULL
WHERE max_occupants IS NOT NULL
  AND bedrooms IS NOT NULL
  AND max_occupants = bedrooms + 1;

-- After. All four should read 0; anything left is a real value the guards
-- above deliberately spared, and is worth looking at.
SELECT
  'after' AS stage,
  count(*) FILTER (WHERE licence_id IS NOT NULL)         AS licence_id,
  count(*) FILTER (WHERE licence_start_date IS NOT NULL) AS licence_start_date,
  count(*) FILTER (WHERE licence_end_date IS NOT NULL)   AS licence_end_date,
  count(*) FILTER (WHERE max_occupants IS NOT NULL)      AS max_occupants
FROM properties;

-- What the 252 rows can now say for themselves.
SELECT
  count(*) FILTER (WHERE hmo_licence_reference IS NOT NULL
                      OR hmo_licence_expiry IS NOT NULL) AS with_published_licence_data,
  count(*) FILTER (WHERE hmo_licence_reference IS NULL
                     AND hmo_licence_expiry IS NULL)     AS honestly_undated
FROM properties
WHERE licensed_hmo IS TRUE;

COMMIT;
