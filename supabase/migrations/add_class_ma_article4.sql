-- Class MA Article 4 directions: commercial (Use Class E) to dwellinghouse (C3).
--
-- WHY
-- A commercial building becomes an HMO in two steps, not one:
--
--   E  -> C3   permitted development under Class MA
--   C3 -> C4   permitted development under Class L
--
-- An Article 4 direction can withdraw either, independently, and councils
-- routinely withdraw one and not the other. Luton has removed Class MA across
-- its town centre and business parks while leaving C3-to-C4 untouched; the
-- reverse is commoner still. A conversion is therefore only as good as its
-- weaker step, and a registry that records only the HMO direction reports a
-- blocked route as an open one.
--
-- The registry already read these rows from the feed and discarded them as "not
-- HMO-related", which is true and beside the point. 20 directions across 8
-- councils in the live feed.
--
-- Both columns default false, and false means "no direction recorded" rather
-- than "no direction exists" — the same distinction article_4_status was split
-- three ways to preserve. Whether the council was checked at all is carried by
-- coverage_level, not by these.

ALTER TABLE article4_councils
  ADD COLUMN IF NOT EXISTS has_class_ma_article4 BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE article4_councils
  ADD COLUMN IF NOT EXISTS class_ma_direction_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN article4_councils.has_class_ma_article4 IS
  'A Class MA direction is in force: commercial to residential permitted development is withdrawn. Independent of the HMO direction — a commercial conversion needs both rights, so this alone can block one.';

COMMENT ON COLUMN article4_councils.class_ma_direction_count IS
  'Class MA directions published by this council, in force or not. Display only; use has_class_ma_article4 to judge whether a conversion route is open.';

CREATE INDEX IF NOT EXISTS idx_article4_councils_class_ma
  ON article4_councils(has_class_ma_article4) WHERE has_class_ma_article4;
