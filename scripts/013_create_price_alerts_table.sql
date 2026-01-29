-- ═══════════════════════════════════════════════════════════════════════════
-- Price Alerts System
-- Allows users to set up alerts for price changes and new property matches
-- ═══════════════════════════════════════════════════════════════════════════

-- Price Alerts Table
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert Type
  alert_type TEXT NOT NULL CHECK (alert_type IN ('price_drop', 'new_listing', 'price_threshold', 'area_watch')),

  -- Property-specific alerts (for price_drop)
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- Area/search-based alerts (for new_listing, area_watch)
  search_criteria JSONB, -- Stores filter criteria for matching new listings

  -- Price threshold alerts
  target_price INTEGER,
  price_direction TEXT CHECK (price_direction IN ('below', 'above')),

  -- Location for area watch
  postcode TEXT,
  area TEXT,
  radius_miles NUMERIC(4,2) DEFAULT 1,

  -- Alert settings
  is_active BOOLEAN DEFAULT true,
  notify_email BOOLEAN DEFAULT true,
  notify_push BOOLEAN DEFAULT false,

  -- Frequency control
  frequency TEXT DEFAULT 'instant' CHECK (frequency IN ('instant', 'daily', 'weekly')),
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Price Alert History (tracks all triggered alerts)
CREATE TABLE IF NOT EXISTS price_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES price_alerts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What triggered the alert
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('price_drop', 'price_increase', 'new_listing', 'threshold_reached')),

  -- Property details at time of trigger
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  property_address TEXT,
  property_postcode TEXT,

  -- Price information
  previous_price INTEGER,
  new_price INTEGER,
  price_change INTEGER,
  price_change_percent NUMERIC(5,2),

  -- Notification status
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  push_sent BOOLEAN DEFAULT false,
  push_sent_at TIMESTAMPTZ,

  -- User interaction
  viewed_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Watched Properties (simplified price tracking)
CREATE TABLE IF NOT EXISTS watched_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

  -- Price tracking
  initial_price INTEGER,
  current_price INTEGER,
  lowest_price INTEGER,
  highest_price INTEGER,

  -- Price history (stored as JSONB array)
  price_history JSONB DEFAULT '[]'::jsonb,

  -- Notes
  user_notes TEXT,

  -- Alert preferences for this specific property
  alert_on_price_drop BOOLEAN DEFAULT true,
  alert_on_price_increase BOOLEAN DEFAULT false,
  price_drop_threshold_percent NUMERIC(4,2) DEFAULT 5, -- Alert if drops more than 5%

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, property_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_alerts_user_id ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_property_id ON price_alerts(property_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_active ON price_alerts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_price_alerts_type ON price_alerts(alert_type);

CREATE INDEX IF NOT EXISTS idx_alert_history_user_id ON price_alert_history(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_alert_id ON price_alert_history(alert_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created ON price_alert_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_watched_properties_user_id ON watched_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_watched_properties_property_id ON watched_properties(property_id);

-- Enable RLS
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched_properties ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only see their own alerts
CREATE POLICY "Users can view own alerts" ON price_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own alerts" ON price_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own alerts" ON price_alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own alerts" ON price_alerts
  FOR DELETE USING (auth.uid() = user_id);

-- Alert history policies
CREATE POLICY "Users can view own alert history" ON price_alert_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert alert history" ON price_alert_history
  FOR INSERT WITH CHECK (true);

-- Watched properties policies
CREATE POLICY "Users can view own watched properties" ON watched_properties
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own watched properties" ON watched_properties
  FOR ALL USING (auth.uid() = user_id);

-- Function to update price history when property price changes
CREATE OR REPLACE FUNCTION update_watched_property_price()
RETURNS TRIGGER AS $$
BEGIN
  -- If price changed, update watched properties
  IF OLD.purchase_price IS DISTINCT FROM NEW.purchase_price OR OLD.price_pcm IS DISTINCT FROM NEW.price_pcm THEN
    UPDATE watched_properties
    SET
      current_price = COALESCE(NEW.purchase_price, NEW.price_pcm),
      lowest_price = LEAST(lowest_price, COALESCE(NEW.purchase_price, NEW.price_pcm)),
      highest_price = GREATEST(highest_price, COALESCE(NEW.purchase_price, NEW.price_pcm)),
      price_history = price_history || jsonb_build_object(
        'price', COALESCE(NEW.purchase_price, NEW.price_pcm),
        'date', NOW()
      ),
      updated_at = NOW()
    WHERE property_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track price changes
DROP TRIGGER IF EXISTS trigger_update_watched_property_price ON properties;
CREATE TRIGGER trigger_update_watched_property_price
  AFTER UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_watched_property_price();
