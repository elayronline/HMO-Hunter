-- Recent HMO planning decisions.
--
-- WHY
-- An Article 4 direction does not ban HMOs, it removes permitted development so
-- that permission is required. Whether that permission is routinely granted or
-- routinely refused is the difference between a formality and a wall, and it is
-- the single most useful thing an investor can know before buying in an Article
-- 4 area. Nobody publishes it, but it is computable by joining decisions to the
-- council registry.
--
-- SOURCE AND LICENSING
-- planning.data.gov.uk covers four councils, so this comes from PlanIt, which
-- aggregates council portals nationally. PlanIt's terms do not address
-- commercial redistribution, so rows are tagged source='planit' and treated as
-- NON-REDISTRIBUTABLE by the provenance layer until written permission exists.
-- council_url is retained on every row so the product can attribute and link to
-- the authority's own portal rather than redistribute, if it comes to that.

CREATE TABLE IF NOT EXISTS hmo_planning_decisions (
  -- PlanIt's unique key, e.g. "Enfield/26/03113/CND".
  id                TEXT PRIMARY KEY,
  reference         TEXT,
  council_name      TEXT,
  -- Joins to article4_councils.slug. Nullable: PlanIt's area names do not always
  -- resolve to an LPA, and a bad join is worse than an absent one.
  council_slug      TEXT,

  description       TEXT,
  app_state         TEXT,
  app_type          TEXT,
  received_date     DATE,
  decided_date      DATE,

  address           TEXT,
  postcode          TEXT,
  longitude         DOUBLE PRECISION,
  latitude          DOUBLE PRECISION,

  -- Classification. `kind` may be 'unclear', which is excluded from every
  -- statistic rather than bucketed with a guess.
  kind              TEXT NOT NULL DEFAULT 'unclear'
    CHECK (kind IN (
      'new_small_hmo', 'new_large_hmo', 'hmo_intensification', 'reversion',
      'existing_use_certificate', 'ancillary', 'not_hmo', 'unclear'
    )),
  -- True only for kinds that add HMO supply. A de-conversion must never count.
  adds_supply       BOOLEAN NOT NULL DEFAULT FALSE,
  occupants         INTEGER,
  -- Which classifier rule fired, so results can be audited and diffed against
  -- the LLM classifier when it replaces these deterministic rules.
  matched_rule      TEXT,
  classifier_version TEXT NOT NULL DEFAULT 'rules-v1',

  council_url       TEXT,
  planit_url        TEXT,
  source            TEXT NOT NULL DEFAULT 'planit',
  retrieved_at      TIMESTAMPTZ NOT NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE hmo_planning_decisions IS
  'HMO planning applications and decisions from PlanIt. Source is not cleared for redistribution — see add_hmo_planning_decisions.sql.';
COMMENT ON COLUMN hmo_planning_decisions.adds_supply IS
  'True only for new_small_hmo, new_large_hmo and hmo_intensification. Reversions and certificates of existing use never add supply.';
COMMENT ON COLUMN hmo_planning_decisions.kind IS
  'Classified application type. unclear is excluded from statistics, never counted as a negative or a positive.';
COMMENT ON COLUMN hmo_planning_decisions.council_slug IS
  'Joins to article4_councils.slug. NULL when PlanIt''s area name could not be resolved to an LPA.';

CREATE INDEX IF NOT EXISTS idx_hmo_decisions_decided ON hmo_planning_decisions(decided_date DESC);
CREATE INDEX IF NOT EXISTS idx_hmo_decisions_council ON hmo_planning_decisions(council_slug);
CREATE INDEX IF NOT EXISTS idx_hmo_decisions_state ON hmo_planning_decisions(app_state);
CREATE INDEX IF NOT EXISTS idx_hmo_decisions_supply ON hmo_planning_decisions(adds_supply) WHERE adds_supply;
-- Supports "recent approvals near this property" without a PostGIS dependency.
CREATE INDEX IF NOT EXISTS idx_hmo_decisions_latlng ON hmo_planning_decisions(latitude, longitude);
