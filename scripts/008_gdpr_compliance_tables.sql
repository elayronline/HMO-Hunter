-- GDPR Compliance Tables for HMO Hunter
-- Run this in Supabase SQL Editor

-- 1. Contact Data Access Audit Log
-- Tracks who accessed what contact data and when
CREATE TABLE IF NOT EXISTS contact_access_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  property_id UUID REFERENCES properties(id),
  owner_name TEXT,
  data_accessed TEXT[], -- e.g., ['phone', 'email', 'address']
  access_type TEXT NOT NULL, -- 'view', 'export', 'copy'
  ip_address TEXT,
  user_agent TEXT,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_contact_access_user ON contact_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_contact_access_property ON contact_access_log(property_id);
CREATE INDEX IF NOT EXISTS idx_contact_access_date ON contact_access_log(accessed_at);

-- 2. Data Subject Opt-Out Registry
-- Property owners who have requested removal of their contact data
CREATE TABLE IF NOT EXISTS gdpr_optouts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT,
  phone TEXT,
  owner_name TEXT,
  property_address TEXT,
  request_type TEXT NOT NULL, -- 'removal', 'access', 'objection'
  request_reason TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'rejected'
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- Index for checking if someone has opted out
CREATE INDEX IF NOT EXISTS idx_optout_email ON gdpr_optouts(email) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_optout_phone ON gdpr_optouts(phone) WHERE status = 'completed';

-- 3. Data Retention Tracking
-- Track when contact data was added for auto-deletion after 24 months
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS contact_data_added_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS contact_data_source TEXT, -- 'searchland', 'companies_house', 'tracego', 'manual'
ADD COLUMN IF NOT EXISTS contact_data_opted_out BOOLEAN DEFAULT FALSE;

-- 4. User Consent Tracking
-- Track user agreement to data usage terms
CREATE TABLE IF NOT EXISTS user_consent (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  privacy_policy_accepted BOOLEAN DEFAULT FALSE,
  privacy_policy_version TEXT,
  privacy_policy_accepted_at TIMESTAMP WITH TIME ZONE,
  terms_accepted BOOLEAN DEFAULT FALSE,
  terms_version TEXT,
  terms_accepted_at TIMESTAMP WITH TIME ZONE,
  marketing_consent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Function to check if contact should be hidden (opted out)
CREATE OR REPLACE FUNCTION is_contact_opted_out(check_email TEXT, check_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM gdpr_optouts
    WHERE status = 'completed'
    AND request_type = 'removal'
    AND (
      (check_email IS NOT NULL AND email = check_email) OR
      (check_phone IS NOT NULL AND phone = check_phone)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- 6. Function to auto-delete stale contact data (run as scheduled job)
CREATE OR REPLACE FUNCTION cleanup_stale_contact_data()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  UPDATE properties
  SET
    owner_contact_phone = NULL,
    owner_contact_email = NULL,
    contact_data_added_at = NULL,
    contact_data_source = NULL
  WHERE
    contact_data_added_at IS NOT NULL
    AND contact_data_added_at < NOW() - INTERVAL '24 months'
    AND (owner_contact_phone IS NOT NULL OR owner_contact_email IS NOT NULL);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS Policies for audit log (only admins can read, system can write)
ALTER TABLE contact_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own access logs" ON contact_access_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own access logs" ON contact_access_log
  FOR SELECT USING (auth.uid() = user_id);

-- 8. RLS for opt-outs (anyone can submit, only admins process)
ALTER TABLE gdpr_optouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit opt-out request" ON gdpr_optouts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can view their own requests" ON gdpr_optouts
  FOR SELECT USING (email IS NOT NULL);

-- Grant necessary permissions
GRANT SELECT, INSERT ON contact_access_log TO authenticated;
GRANT SELECT, INSERT ON gdpr_optouts TO authenticated;
GRANT INSERT ON gdpr_optouts TO anon;
GRANT SELECT, INSERT, UPDATE ON user_consent TO authenticated;
