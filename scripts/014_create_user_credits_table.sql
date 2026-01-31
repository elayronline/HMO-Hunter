-- Create user_credits table for beta credit system
-- Daily credits: 150 for standard_pro, unlimited for admin
-- Resets at midnight UTC

CREATE TABLE IF NOT EXISTS public.user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'standard_pro' CHECK (role IN ('admin', 'standard_pro')),

  -- Credit allocation
  daily_credits INTEGER NOT NULL DEFAULT 150,
  credits_used INTEGER NOT NULL DEFAULT 0,

  -- Free property views (20 free per day)
  free_property_views_used INTEGER NOT NULL DEFAULT 0,
  free_property_views_limit INTEGER NOT NULL DEFAULT 20,

  -- Resource caps (not credit-based)
  saved_properties_count INTEGER NOT NULL DEFAULT 0,
  saved_properties_limit INTEGER NOT NULL DEFAULT 100,
  saved_searches_count INTEGER NOT NULL DEFAULT 0,
  saved_searches_limit INTEGER NOT NULL DEFAULT 10,
  active_price_alerts_count INTEGER NOT NULL DEFAULT 0,
  active_price_alerts_limit INTEGER NOT NULL DEFAULT 10,

  -- Reset tracking
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

-- Users can view their own credits
CREATE POLICY "user_credits_select_own"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for backend operations)
CREATE POLICY "user_credits_service_all"
  ON public.user_credits FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON public.user_credits(user_id);

-- Credit costs configuration table
CREATE TABLE IF NOT EXISTS public.credit_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT UNIQUE NOT NULL,
  cost INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert credit costs
INSERT INTO public.credit_costs (action, cost, description) VALUES
  ('property_view', 1, 'View property details (after 20 free views)'),
  ('contact_data_view', 2, 'View owner/licence holder contact information'),
  ('contact_data_copy', 3, 'Copy contact information to clipboard'),
  ('save_property', 1, 'Save a property to favorites'),
  ('save_search', 2, 'Save a search filter configuration'),
  ('create_price_alert', 5, 'Create a new price alert'),
  ('csv_export', 10, 'Export properties to CSV')
ON CONFLICT (action) DO NOTHING;

-- Function to check if daily reset is needed and perform it
CREATE OR REPLACE FUNCTION public.check_and_reset_daily_credits(p_user_id UUID)
RETURNS public.user_credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits public.user_credits;
  v_now TIMESTAMP WITH TIME ZONE := CURRENT_TIMESTAMP;
  v_today_midnight TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate today's midnight UTC
  v_today_midnight := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  -- Get current credits record
  SELECT * INTO v_credits FROM public.user_credits WHERE user_id = p_user_id;

  -- If no record exists, return NULL
  IF v_credits IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if reset is needed (last reset was before today's midnight UTC)
  IF v_credits.last_reset_at < v_today_midnight THEN
    UPDATE public.user_credits
    SET
      credits_used = 0,
      free_property_views_used = 0,
      last_reset_at = v_now,
      updated_at = v_now
    WHERE user_id = p_user_id
    RETURNING * INTO v_credits;
  END IF;

  RETURN v_credits;
END;
$$;

-- Function to deduct credits for an action
CREATE OR REPLACE FUNCTION public.deduct_credits(
  p_user_id UUID,
  p_action TEXT,
  p_count INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits public.user_credits;
  v_cost INTEGER;
  v_total_cost INTEGER;
  v_remaining INTEGER;
  v_warning_threshold INTEGER;
  v_is_admin BOOLEAN;
BEGIN
  -- First, check and reset if needed
  v_credits := public.check_and_reset_daily_credits(p_user_id);

  IF v_credits IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User credits record not found'
    );
  END IF;

  -- Admin has unlimited credits
  IF v_credits.role = 'admin' THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_admin', true,
      'credits_remaining', -1,
      'message', 'Admin - unlimited credits'
    );
  END IF;

  -- Handle free property views
  IF p_action = 'property_view' THEN
    IF v_credits.free_property_views_used < v_credits.free_property_views_limit THEN
      -- Use free view instead of credits
      UPDATE public.user_credits
      SET
        free_property_views_used = free_property_views_used + p_count,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = p_user_id
      RETURNING * INTO v_credits;

      RETURN jsonb_build_object(
        'success', true,
        'free_view_used', true,
        'free_views_remaining', v_credits.free_property_views_limit - v_credits.free_property_views_used,
        'credits_remaining', v_credits.daily_credits - v_credits.credits_used,
        'message', 'Free property view used'
      );
    END IF;
  END IF;

  -- Get credit cost for action
  SELECT cost INTO v_cost FROM public.credit_costs WHERE action = p_action;

  IF v_cost IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unknown action: ' || p_action
    );
  END IF;

  v_total_cost := v_cost * p_count;
  v_remaining := v_credits.daily_credits - v_credits.credits_used;
  v_warning_threshold := (v_credits.daily_credits * 0.8)::INTEGER;

  -- Check if user has enough credits
  IF v_credits.credits_used + v_total_cost > v_credits.daily_credits THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'credits_remaining', v_remaining,
      'credits_required', v_total_cost,
      'reset_at', date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC' + INTERVAL '1 day') AT TIME ZONE 'UTC'
    );
  END IF;

  -- Deduct credits
  UPDATE public.user_credits
  SET
    credits_used = credits_used + v_total_cost,
    updated_at = CURRENT_TIMESTAMP
  WHERE user_id = p_user_id
  RETURNING * INTO v_credits;

  v_remaining := v_credits.daily_credits - v_credits.credits_used;

  -- Build response with warning if needed
  RETURN jsonb_build_object(
    'success', true,
    'credits_deducted', v_total_cost,
    'credits_remaining', v_remaining,
    'credits_total', v_credits.daily_credits,
    'warning', CASE
      WHEN v_remaining <= (v_credits.daily_credits * 0.2) THEN
        'You have ' || v_remaining || ' credits remaining today. Resets at midnight UTC.'
      ELSE NULL
    END,
    'reset_at', date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'UTC' + INTERVAL '1 day') AT TIME ZONE 'UTC'
  );
END;
$$;

-- Function to check resource caps (saved properties, searches, alerts)
CREATE OR REPLACE FUNCTION public.check_resource_cap(
  p_user_id UUID,
  p_resource TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits public.user_credits;
  v_current INTEGER;
  v_limit INTEGER;
  v_warning_threshold INTEGER;
BEGIN
  SELECT * INTO v_credits FROM public.user_credits WHERE user_id = p_user_id;

  IF v_credits IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User credits record not found');
  END IF;

  -- Admin has no caps
  IF v_credits.role = 'admin' THEN
    RETURN jsonb_build_object('success', true, 'is_admin', true);
  END IF;

  -- Get current count and limit based on resource type
  CASE p_resource
    WHEN 'saved_properties' THEN
      v_current := v_credits.saved_properties_count;
      v_limit := v_credits.saved_properties_limit;
    WHEN 'saved_searches' THEN
      v_current := v_credits.saved_searches_count;
      v_limit := v_credits.saved_searches_limit;
    WHEN 'price_alerts' THEN
      v_current := v_credits.active_price_alerts_count;
      v_limit := v_credits.active_price_alerts_limit;
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'Unknown resource: ' || p_resource);
  END CASE;

  v_warning_threshold := (v_limit * 0.8)::INTEGER;

  -- Check if at cap
  IF v_current >= v_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Resource limit reached',
      'current', v_current,
      'limit', v_limit,
      'resource', p_resource
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'current', v_current,
    'limit', v_limit,
    'warning', CASE WHEN v_current >= v_warning_threshold THEN
      'You have used ' || v_current || ' of ' || v_limit || ' ' || replace(p_resource, '_', ' ')
    ELSE NULL END
  );
END;
$$;

-- Modify the handle_new_user function to also create credits record
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_daily_credits INTEGER;
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null)
  )
  ON CONFLICT (id) DO NOTHING;

  -- Determine role based on email
  IF new.email = 'elayronline@gmail.com' THEN
    v_role := 'admin';
    v_daily_credits := 999999; -- Effectively unlimited
  ELSE
    v_role := 'standard_pro';
    v_daily_credits := 150;
  END IF;

  -- Create credits record
  INSERT INTO public.user_credits (user_id, role, daily_credits)
  VALUES (new.id, v_role, v_daily_credits)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update user metadata with role
  UPDATE auth.users
  SET raw_user_meta_data =
    COALESCE(raw_user_meta_data, '{}'::jsonb) ||
    jsonb_build_object(
      'role', v_role,
      'is_admin', v_role = 'admin',
      'is_premium', true  -- All beta users get premium features
    )
  WHERE id = new.id;

  RETURN new;
END;
$$;

-- Create credits records for existing users
INSERT INTO public.user_credits (user_id, role, daily_credits)
SELECT
  id,
  CASE WHEN email = 'elayronline@gmail.com' THEN 'admin' ELSE 'standard_pro' END,
  CASE WHEN email = 'elayronline@gmail.com' THEN 999999 ELSE 150 END
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_credits WHERE user_id IS NOT NULL)
ON CONFLICT (user_id) DO NOTHING;

-- Update existing users' metadata
UPDATE auth.users
SET raw_user_meta_data =
  COALESCE(raw_user_meta_data, '{}'::jsonb) ||
  jsonb_build_object(
    'role', CASE WHEN email = 'elayronline@gmail.com' THEN 'admin' ELSE 'standard_pro' END,
    'is_admin', email = 'elayronline@gmail.com',
    'is_premium', true
  );
