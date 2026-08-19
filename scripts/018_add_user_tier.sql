-- 018: replace the credit/premium split with a single tier column.
--
-- WHY
--   Entitlement was answered by two systems that could disagree:
--     user_credits.role ('admin'|'standard_pro') + a per-action credit price,
--     and auth.users.raw_user_meta_data.is_premium, a hand-set flag.
--   Measured 2026-08-19: credits_used was 0 for every account, so nothing was
--   ever charged; is_premium was true for all 5 accounts, so it gated nobody.
--   Owner data was gated by both at once.
--
-- WHAT THIS DOES
--   Adds user_credits.tier ('free'|'pro'|'admin') and a daily property-view
--   counter, then backfills tier from the two old sources so that NOBODY LOSES
--   ACCESS THEY HAVE TODAY: role='admin' becomes admin, and anyone currently
--   holding is_premium=true becomes pro.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--   It does not drop daily_credits, credits_used, free_property_views_*, the
--   deduct_credits / check_and_reset_daily_credits / check_resource_cap
--   functions, or the is_premium metadata. Nothing reads them once the
--   application change lands, but removing them is a separate, irreversible
--   step that should follow a period with the new column in production.
--   Table name kept as user_credits for the same reason: it is now referenced
--   from exactly one module (lib/entitlements.ts), so the stale name is
--   contained and a rename would be churn across RLS policies for no benefit
--   today.

BEGIN;

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT 'free'
    CHECK (tier IN ('free', 'pro', 'admin'));

-- Free is the only tier that meters property views, so the counter lives here
-- rather than in the credit columns it replaces.
ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS property_views_today INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.user_credits
  ADD COLUMN IF NOT EXISTS views_reset_at TIMESTAMP WITH TIME ZONE;

-- Backfill. Order matters: admin wins over the premium flag, because an admin
-- without the metadata flag was already treated as premium by the API and must
-- not be demoted by this migration.
UPDATE public.user_credits uc
SET tier = 'admin'
WHERE uc.role = 'admin';

UPDATE public.user_credits uc
SET tier = 'pro'
FROM auth.users u
WHERE u.id = uc.user_id
  AND uc.tier <> 'admin'
  AND (u.raw_user_meta_data->>'is_premium')::text = 'true';

-- Bring the stored caps into line with the tier ladder. Counts are left alone;
-- only the limits move.
UPDATE public.user_credits
SET saved_properties_limit = 10,
    saved_searches_limit = 3,
    active_price_alerts_limit = 3
WHERE tier = 'free';

UPDATE public.user_credits
SET saved_properties_limit = 100,
    saved_searches_limit = 10,
    active_price_alerts_limit = 10
WHERE tier = 'pro';

-- Admin is unlimited in the application. The stored numbers are left high
-- rather than null so the NOT NULL columns stay valid; nothing reads them for
-- an admin.
UPDATE public.user_credits
SET saved_properties_limit = 999999,
    saved_searches_limit = 999999,
    active_price_alerts_limit = 999999
WHERE tier = 'admin';

CREATE INDEX IF NOT EXISTS user_credits_tier_idx ON public.user_credits (tier);

-- Audit for tier changes. Changing what somebody may see should be
-- attributable afterwards; the credit_adjustments table it replaces recorded
-- movements of a balance nothing ever spent.
CREATE TABLE IF NOT EXISTS public.tier_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Nullable on purpose: ON DELETE SET NULL would fail against NOT NULL, and
  -- losing the admin's account must not take the audit row with it.
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  previous_tier TEXT NOT NULL CHECK (previous_tier IN ('free', 'pro', 'admin')),
  new_tier TEXT NOT NULL CHECK (new_tier IN ('free', 'pro', 'admin')),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS tier_changes_user_idx ON public.tier_changes (user_id, created_at DESC);

ALTER TABLE public.tier_changes ENABLE ROW LEVEL SECURITY;

-- No policy is granted deliberately: this table is written and read through the
-- service role from the admin endpoints only. With RLS on and no policy, a
-- normal session cannot read who changed whose access.

-- Guard: every account must have landed on a tier that reflects what it could
-- do before this ran. If an account that currently sees owner data would come
-- out as 'free', stop rather than silently take access away.
DO $$
DECLARE
  demoted INTEGER;
  untiered INTEGER;
BEGIN
  SELECT count(*) INTO demoted
  FROM public.user_credits uc
  JOIN auth.users u ON u.id = uc.user_id
  WHERE (u.raw_user_meta_data->>'is_premium')::text = 'true'
    AND uc.tier = 'free';

  IF demoted > 0 THEN
    RAISE EXCEPTION
      'Refusing to migrate: % account(s) currently hold is_premium but would land on free.', demoted;
  END IF;

  SELECT count(*) INTO untiered
  FROM public.user_credits
  WHERE tier IS NULL OR tier NOT IN ('free', 'pro', 'admin');

  IF untiered > 0 THEN
    RAISE EXCEPTION 'Refusing to migrate: % row(s) hold an unrecognised tier.', untiered;
  END IF;
END $$;

COMMIT;
