-- Migration: Add Deal Pipeline, D2V Outreach, and Viewing Tracker
-- Features mapped to ICP profiles: investor, council_ta, operator, agent

-- ============================================================
-- 1. DEAL PIPELINE
-- ============================================================

-- Pipeline stages are ICP-specific, stored as config
CREATE TABLE IF NOT EXISTS pipeline_deals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  stage TEXT NOT NULL DEFAULT 'identified',
  label TEXT,                          -- User-defined label (e.g., "hot lead", "follow up")
  notes TEXT,
  priority INTEGER DEFAULT 0 CHECK (priority BETWEEN 0 AND 3),  -- 0=none, 1=low, 2=medium, 3=high
  assigned_to TEXT,                    -- For future team feature
  expected_value NUMERIC,             -- Estimated deal value
  stage_entered_at TIMESTAMPTZ DEFAULT now(),
  stage_history JSONB DEFAULT '[]'::jsonb,  -- [{stage, entered_at, exited_at}]
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ,
  UNIQUE(user_id, property_id)
);

-- Pipeline stage definitions per ICP
CREATE TABLE IF NOT EXISTS pipeline_stage_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_type TEXT NOT NULL,             -- investor, council_ta, operator, agent
  stage_key TEXT NOT NULL,
  stage_label TEXT NOT NULL,
  stage_order INTEGER NOT NULL,
  color TEXT DEFAULT '#64748b',
  is_terminal BOOLEAN DEFAULT false,   -- completed/dead stages
  UNIQUE(user_type, stage_key)
);

-- Pipeline labels for organisation
CREATE TABLE IF NOT EXISTS pipeline_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Indexes for pipeline
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_user ON pipeline_deals(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_stage ON pipeline_deals(user_id, stage);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_property ON pipeline_deals(property_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_deals_archived ON pipeline_deals(user_id, archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pipeline_stage_config_type ON pipeline_stage_config(user_type, stage_order);

-- RLS for pipeline_deals
ALTER TABLE pipeline_deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own pipeline deals"
  ON pipeline_deals FOR ALL USING (auth.uid() = user_id);

-- RLS for pipeline_labels
ALTER TABLE pipeline_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own labels"
  ON pipeline_labels FOR ALL USING (auth.uid() = user_id);

-- Seed default pipeline stages per ICP
INSERT INTO pipeline_stage_config (user_type, stage_key, stage_label, stage_order, color, is_terminal) VALUES
  -- Investor: Purchase-focused flow
  ('investor', 'identified',   'Identified',    1, '#94a3b8', false),
  ('investor', 'researched',   'Researched',    2, '#60a5fa', false),
  ('investor', 'contacted',    'Contacted',     3, '#a78bfa', false),
  ('investor', 'viewing',      'Viewing',       4, '#fbbf24', false),
  ('investor', 'offer_made',   'Offer Made',    5, '#f97316', false),
  ('investor', 'under_offer',  'Under Offer',   6, '#22d3ee', false),
  ('investor', 'completed',    'Completed',     7, '#22c55e', true),
  ('investor', 'dead',         'Dead',          8, '#ef4444', true),

  -- Council/TA: Placement-focused flow
  ('council_ta', 'identified',      'Identified',       1, '#94a3b8', false),
  ('council_ta', 'assessed',        'Assessed',         2, '#60a5fa', false),
  ('council_ta', 'shortlisted',     'Shortlisted',      3, '#a78bfa', false),
  ('council_ta', 'inspection',      'Inspection',       4, '#fbbf24', false),
  ('council_ta', 'placement_ready', 'Placement Ready',  5, '#22d3ee', false),
  ('council_ta', 'placed',          'Placed',           6, '#22c55e', true),
  ('council_ta', 'rejected',        'Rejected',         7, '#ef4444', true),

  -- Operator: Portfolio management flow
  ('operator', 'identified',        'Identified',        1, '#94a3b8', false),
  ('operator', 'compliance_check',  'Compliance Check',  2, '#60a5fa', false),
  ('operator', 'renewal_due',       'Renewal Due',       3, '#fbbf24', false),
  ('operator', 'in_progress',       'In Progress',       4, '#a78bfa', false),
  ('operator', 'compliant',         'Compliant',         5, '#22c55e', true),
  ('operator', 'non_compliant',     'Non-Compliant',     6, '#ef4444', true),

  -- Agent: Sourcing flow
  ('agent', 'sourced',        'Sourced',          1, '#94a3b8', false),
  ('agent', 'packaged',       'Packaged',         2, '#60a5fa', false),
  ('agent', 'presented',      'Presented',        3, '#a78bfa', false),
  ('agent', 'client_viewing', 'Client Viewing',   4, '#fbbf24', false),
  ('agent', 'offer',          'Offer',            5, '#f97316', false),
  ('agent', 'exchanged',      'Exchanged',        6, '#22c55e', true),
  ('agent', 'fallen_through', 'Fallen Through',   7, '#ef4444', true)
ON CONFLICT DO NOTHING;


-- ============================================================
-- 2. D2V (DIRECT TO VENDOR) OUTREACH
-- ============================================================

CREATE TABLE IF NOT EXISTS d2v_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject TEXT,                        -- For email templates
  body TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'letter' CHECK (channel IN ('letter', 'email')),
  placeholders JSONB DEFAULT '[]'::jsonb,  -- Available merge fields
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS d2v_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id UUID REFERENCES d2v_templates(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'letter' CHECK (channel IN ('letter', 'email')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,      -- For email tracking
  responded_count INTEGER DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS d2v_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES d2v_campaigns(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  recipient_name TEXT,
  recipient_email TEXT,
  recipient_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'responded', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  error_message TEXT,
  merge_data JSONB DEFAULT '{}'::jsonb,  -- Personalisation data
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for D2V
CREATE INDEX IF NOT EXISTS idx_d2v_campaigns_user ON d2v_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_d2v_campaigns_status ON d2v_campaigns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_d2v_recipients_campaign ON d2v_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_d2v_recipients_property ON d2v_recipients(property_id);
CREATE INDEX IF NOT EXISTS idx_d2v_recipients_status ON d2v_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_d2v_templates_user ON d2v_templates(user_id);

-- RLS for D2V
ALTER TABLE d2v_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own templates"
  ON d2v_templates FOR ALL USING (auth.uid() = user_id);

ALTER TABLE d2v_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own campaigns"
  ON d2v_campaigns FOR ALL USING (auth.uid() = user_id);

ALTER TABLE d2v_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own campaign recipients"
  ON d2v_recipients FOR ALL USING (
    campaign_id IN (SELECT id FROM d2v_campaigns WHERE user_id = auth.uid())
  );


-- ============================================================
-- 3. VIEWING TRACKER
-- ============================================================

CREATE TABLE IF NOT EXISTS property_viewings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  pipeline_deal_id UUID REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  viewing_type TEXT NOT NULL DEFAULT 'site_visit' CHECK (viewing_type IN (
    'site_visit',       -- Investor: in-person property visit
    'inspection',       -- Council/TA: formal inspection
    'portfolio_check',  -- Operator: routine check
    'client_viewing'    -- Agent: showing to client
  )),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  notes TEXT,
  attendees TEXT[],                    -- List of people attending
  contact_name TEXT,                   -- Who arranged it (agent/owner)
  contact_phone TEXT,
  contact_email TEXT,
  checklist JSONB DEFAULT '{}'::jsonb, -- ICP-specific checklist items
  photos TEXT[],                       -- URLs to uploaded photos from viewing
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for viewings
CREATE INDEX IF NOT EXISTS idx_viewings_user ON property_viewings(user_id);
CREATE INDEX IF NOT EXISTS idx_viewings_scheduled ON property_viewings(user_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_viewings_property ON property_viewings(property_id);
CREATE INDEX IF NOT EXISTS idx_viewings_status ON property_viewings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_viewings_pipeline ON property_viewings(pipeline_deal_id);

-- RLS for viewings
ALTER TABLE property_viewings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own viewings"
  ON property_viewings FOR ALL USING (auth.uid() = user_id);


-- ============================================================
-- 4. OFF-MARKET SOURCING VIEWS
-- ============================================================

-- Materialised view for off-market opportunities
-- Expired licences, long-vacant, no recent activity
CREATE OR REPLACE VIEW off_market_opportunities AS
SELECT
  p.id,
  p.address,
  p.postcode,
  p.city,
  p.bedrooms,
  p.purchase_price,
  p.price_pcm,
  p.owner_name,
  p.owner_contact_email,
  p.owner_contact_phone,
  p.licence_holder_name,
  p.licence_holder_email,
  p.hmo_licence_expiry,
  p.licence_status,
  p.epc_rating,
  p.deal_score,
  p.hmo_classification,
  p.article_4_area,
  CASE
    WHEN p.licence_status = 'expired' THEN 'expired_licence'
    WHEN p.hmo_licence_expiry IS NOT NULL
         AND p.hmo_licence_expiry::date < (CURRENT_DATE + INTERVAL '90 days') THEN 'expiring_licence'
    WHEN p.days_on_market > 180 THEN 'long_on_market'
    WHEN p.is_stale = true THEN 'stale_listing'
    WHEN p.is_potential_hmo = true AND p.licensed_hmo = false THEN 'unlicensed_potential'
    ELSE 'other'
  END AS opportunity_type,
  CASE
    WHEN p.licence_status = 'expired' THEN 90
    WHEN p.hmo_licence_expiry IS NOT NULL
         AND p.hmo_licence_expiry::date < (CURRENT_DATE + INTERVAL '90 days') THEN 80
    WHEN p.is_potential_hmo = true AND p.licensed_hmo = false THEN 70
    WHEN p.days_on_market > 180 THEN 60
    ELSE 50
  END AS opportunity_score
FROM properties p
WHERE
  p.licence_status = 'expired'
  OR (p.hmo_licence_expiry IS NOT NULL AND p.hmo_licence_expiry::date < (CURRENT_DATE + INTERVAL '90 days'))
  OR p.days_on_market > 180
  OR p.is_stale = true
  OR (p.is_potential_hmo = true AND p.licensed_hmo = false);
