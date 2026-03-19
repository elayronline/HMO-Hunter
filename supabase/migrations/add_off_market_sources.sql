-- Migration: Off-market data sources (Gazette Probate, Unclaimed Estates, Land Registry Repossessions)

-- ============================================================
-- OFF-MARKET LEADS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS off_market_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('gazette_probate', 'unclaimed_estate', 'land_registry_repo', 'expired_licence', 'manual')),
  -- Person/estate info
  deceased_name TEXT,
  date_of_death DATE,
  place_of_death TEXT,
  -- Property info (may be null for unclaimed estates)
  property_address TEXT,
  postcode TEXT,
  city TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  -- Gazette-specific
  gazette_notice_id TEXT UNIQUE,
  solicitor_name TEXT,
  solicitor_address TEXT,
  solicitor_reference TEXT,
  claim_expiry_date DATE,
  -- Unclaimed estate-specific
  bv_reference TEXT UNIQUE,
  -- Land Registry repo-specific
  transaction_id TEXT UNIQUE,
  sale_price INTEGER,
  sale_date DATE,
  property_type TEXT,    -- D, S, T, F, O
  tenure TEXT,           -- F=Freehold, L=Leasehold
  ppd_category TEXT,     -- A=Standard, B=Additional (repos)
  -- Matching
  matched_property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  -- Scoring
  opportunity_score INTEGER DEFAULT 50 CHECK (opportunity_score BETWEEN 0 AND 100),
  -- Status
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'in_pipeline', 'dismissed')),
  notes TEXT,
  -- Metadata
  ingested_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_off_market_leads_source ON off_market_leads(source);
CREATE INDEX IF NOT EXISTS idx_off_market_leads_postcode ON off_market_leads(postcode);
CREATE INDEX IF NOT EXISTS idx_off_market_leads_city ON off_market_leads(city);
CREATE INDEX IF NOT EXISTS idx_off_market_leads_status ON off_market_leads(status);
CREATE INDEX IF NOT EXISTS idx_off_market_leads_score ON off_market_leads(opportunity_score DESC);
CREATE INDEX IF NOT EXISTS idx_off_market_leads_ingested ON off_market_leads(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_off_market_leads_matched ON off_market_leads(matched_property_id) WHERE matched_property_id IS NOT NULL;

-- No RLS — off-market leads are shared data, access controlled at API level
