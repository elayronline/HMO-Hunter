-- Article 4 council registry.
--
-- WHY
-- The enrichment job resolves the covered-council set by firing one HTTP request
-- per organisation on every run, against a third-party API, and throws the
-- result away. That is slow, rate-limit exposed, and leaves nothing for the
-- council pages to render.
--
-- Three planning.data.gov.uk datasets describe the same thing and share no
-- foreign keys — districts (344 LPAs), direction areas (72 HMO-related, with
-- geometry) and directions (63 HMO-related, with the source PDFs). The only
-- join is council name, spelled differently in each. This table is the resolved
-- result: one row per council.

CREATE TABLE IF NOT EXISTS article4_councils (
  slug                     TEXT PRIMARY KEY,
  name                     TEXT NOT NULL,
  gss_code                 TEXT,
  match_key                TEXT NOT NULL,
  organisation_entity      INTEGER,

  -- Only 'boundaries' may gate a verified negative.
  --   boundaries      - testable geometry; a polygon miss is a real negative
  --   directions_only - a known HMO Article 4 exists but no boundary is
  --                     published, so nothing can be tested. Crawley (10
  --                     directions) and Tower Hamlets sit here. Treating these
  --                     as covered would assert a confident negative in a
  --                     council we know is restricted.
  --   none            - nothing published; absence tells us nothing
  coverage_level           TEXT NOT NULL DEFAULT 'none'
    CHECK (coverage_level IN ('boundaries', 'directions_only', 'none')),

  publishes_hmo_article4   BOOLEAN NOT NULL DEFAULT FALSE,
  area_count               INTEGER NOT NULL DEFAULT 0,
  -- Areas we can actually point-in-polygon. This, not area_count, gates negatives.
  area_count_with_geometry INTEGER NOT NULL DEFAULT 0,
  direction_count          INTEGER NOT NULL DEFAULT 0,
  earliest_commencement    DATE,
  latest_commencement      DATE,
  document_urls            TEXT[] NOT NULL DEFAULT '{}',

  source                   TEXT NOT NULL,
  retrieved_at             TIMESTAMPTZ NOT NULL,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE article4_councils IS
  'One row per local planning authority, resolving the three planning.data.gov.uk Article 4 datasets into a single record.';
COMMENT ON COLUMN article4_councils.coverage_level IS
  'boundaries | directions_only | none. Only boundaries permits writing properties.article_4_status = none_found.';
COMMENT ON COLUMN article4_councils.match_key IS
  'Normalised council name used to join across datasets that spell it differently.';
COMMENT ON COLUMN article4_councils.document_urls IS
  'Council-published source documents. These are the citation targets for extracted regulation facts.';

CREATE INDEX IF NOT EXISTS idx_article4_councils_match_key ON article4_councils(match_key);
CREATE INDEX IF NOT EXISTS idx_article4_councils_coverage ON article4_councils(coverage_level);

-- Individual directions, kept separate so each carries its own commencement
-- date and source document — the unit a citation points at.
CREATE TABLE IF NOT EXISTS article4_directions (
  entity        BIGINT PRIMARY KEY,
  council_slug  TEXT NOT NULL REFERENCES article4_councils(slug) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT '',
  reference     TEXT,
  commenced_on  DATE,
  ended_on      DATE,
  document_url  TEXT,
  description   TEXT,
  source        TEXT NOT NULL,
  retrieved_at  TIMESTAMPTZ NOT NULL
);

COMMENT ON TABLE article4_directions IS
  'HMO-related Article 4 directions from planning.data.gov.uk, one row per legal instrument.';
COMMENT ON COLUMN article4_directions.document_url IS
  'Council-published notice or PDF. Required for any fact extracted from this direction to be citable.';

CREATE INDEX IF NOT EXISTS idx_article4_directions_council ON article4_directions(council_slug);
CREATE INDEX IF NOT EXISTS idx_article4_directions_commenced ON article4_directions(commenced_on);
