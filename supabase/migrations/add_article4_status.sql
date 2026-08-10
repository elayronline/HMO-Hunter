-- Article 4: replace the two-state boolean with a three-state status.
--
-- WHY
-- `properties.article_4_area` is a BOOLEAN DEFAULT FALSE. The enrichment job
-- point-in-polygons each property against planning.data.gov.uk and writes
-- FALSE on a miss. But that national feed contains only 72 HMO-related Article 4
-- areas across 38 councils. Manchester, Leeds, Nottingham, Sheffield, Brighton,
-- Portsmouth and ~18 other major HMO markets publish nothing to it.
--
-- So every property in those cities was being recorded as a CONFIRMED NEGATIVE
-- when the truth is "we never checked a source that covers this council".
-- `app/actions/properties.ts` then serves those rows under the
-- "exclude Article 4" filter, presenting them to investors as unrestricted.
--
-- A boolean cannot express the difference between "verified not in an Article 4
-- area" and "unknown". That distinction is the product, so it becomes a column.
--
--   in_force   - point falls inside a known HMO Article 4 boundary
--   none_found - point checked AND its planning authority is covered by a source
--                that publishes its HMO directions; no boundary matched
--   unknown    - not yet checked, or the planning authority is not covered by
--                any source we hold. NEVER infer a negative from this.

ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_status TEXT
  NOT NULL DEFAULT 'unknown'
  CHECK (article_4_status IN ('in_force', 'none_found', 'unknown'));

-- Provenance. Every fact carries where it came from and when, so the phase-2
-- API can serve confidence alongside values and mechanically exclude
-- non-redistributable sources (Searchland, Kamma) from resold responses.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_checked_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_source TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_area_name TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_council TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS article_4_council_covered BOOLEAN;

COMMENT ON COLUMN properties.article_4_status IS
  'Three-state Article 4 result: in_force | none_found | unknown. none_found is a verified negative and may only be written when article_4_council_covered is true.';
COMMENT ON COLUMN properties.article_4_checked_at IS
  'When Article 4 status was last determined. NULL means never checked.';
COMMENT ON COLUMN properties.article_4_source IS
  'Provenance for the status, e.g. planning.data.gov.uk. Governs redistribution rights.';
COMMENT ON COLUMN properties.article_4_area_name IS
  'Name of the matched Article 4 direction area, when status is in_force.';
COMMENT ON COLUMN properties.article_4_council IS
  'Local planning authority resolved for this point.';
COMMENT ON COLUMN properties.article_4_council_covered IS
  'Whether the resolved planning authority publishes HMO Article 4 data to a source we hold. Gates none_found.';

-- Backfill. Guarded on article_4_checked_at IS NULL so re-running the migration
-- cannot clobber statuses written by the enrichment job afterwards.
--
-- TRUE  -> in_force. A positive polygon hit was a real signal; the feed's false
--          POSITIVE rate is low, it is the false NEGATIVE rate that is broken.
-- FALSE -> unknown.  These were written on a miss against a 38-council feed and
--          are not verified negatives. Demoting them is the point of this change.
-- NULL  -> unknown.
UPDATE properties
SET
  article_4_status = CASE WHEN article_4_area IS TRUE THEN 'in_force' ELSE 'unknown' END,
  article_4_source = CASE WHEN article_4_area IS TRUE THEN 'legacy:pre-migration' ELSE NULL END
WHERE article_4_checked_at IS NULL;

-- New rows must not inherit a fabricated negative. The boolean stays for the
-- ~15 existing read sites but is now derived from article_4_status, never the
-- source of truth. Treat it as deprecated.
ALTER TABLE properties ALTER COLUMN article_4_area DROP DEFAULT;

COMMENT ON COLUMN properties.article_4_area IS
  'DEPRECATED - use article_4_status. Kept for backwards compatibility and mirrors (article_4_status = ''in_force''). Cannot represent "unknown", so never filter a negative on this column.';

CREATE INDEX IF NOT EXISTS idx_properties_article_4_status ON properties(article_4_status);
CREATE INDEX IF NOT EXISTS idx_properties_article_4_checked_at ON properties(article_4_checked_at);
