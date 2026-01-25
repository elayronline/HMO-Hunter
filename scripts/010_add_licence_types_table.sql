-- HMO Licence Types System
-- Supports multiple licence types per property with configurable types

-- 1. Licence Types Configuration Table (extendable without code changes)
CREATE TABLE IF NOT EXISTS licence_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- e.g., 'mandatory_hmo', 'additional_hmo', 'selective'
  name TEXT NOT NULL, -- e.g., 'Mandatory HMO Licence'
  description TEXT,
  applies_to TEXT[], -- e.g., ['england', 'wales'] or specific councils
  min_occupants INTEGER, -- Threshold for this licence type
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Property Licences Table (multiple licences per property)
CREATE TABLE IF NOT EXISTS property_licences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  licence_type_id UUID REFERENCES licence_types(id),
  licence_type_code TEXT NOT NULL, -- Denormalized for quick access
  licence_number TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'unknown', -- 'active', 'expired', 'pending', 'unknown'
  source TEXT DEFAULT 'unknown', -- 'council_api', 'manual', 'searchland', 'scraped'
  source_url TEXT,
  max_occupants INTEGER,
  max_households INTEGER,
  conditions TEXT[],
  raw_data JSONB, -- Store original API response
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(property_id, licence_type_code, licence_number)
);

-- 3. User Licence Preferences (for filter persistence)
CREATE TABLE IF NOT EXISTS user_licence_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled_licence_types TEXT[], -- Which licence types to show
  show_expired BOOLEAN DEFAULT TRUE,
  show_unknown BOOLEAN DEFAULT TRUE,
  highlight_expiring_days INTEGER DEFAULT 90, -- Warn if expiring within X days
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id)
);

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_property_licences_property ON property_licences(property_id);
CREATE INDEX IF NOT EXISTS idx_property_licences_type ON property_licences(licence_type_code);
CREATE INDEX IF NOT EXISTS idx_property_licences_status ON property_licences(status);
CREATE INDEX IF NOT EXISTS idx_property_licences_end_date ON property_licences(end_date);

-- 5. Insert default licence types (UK HMO licence categories)
INSERT INTO licence_types (code, name, description, applies_to, min_occupants, display_order) VALUES
  ('mandatory_hmo', 'Mandatory HMO Licence', 'Required for properties with 5+ occupants from 2+ households sharing facilities', ARRAY['england', 'wales'], 5, 1),
  ('additional_hmo', 'Additional HMO Licence', 'Council-specific scheme for smaller HMOs (typically 3-4 occupants)', ARRAY['england', 'wales'], 3, 2),
  ('selective_licence', 'Selective Licence', 'Required in designated areas for all private rented properties', ARRAY['england', 'wales'], 1, 3),
  ('article_4', 'Article 4 Direction', 'Planning restriction requiring permission to convert to HMO', ARRAY['england', 'wales'], NULL, 4),
  ('scottish_hmo', 'Scottish HMO Licence', 'Required for all HMOs in Scotland (3+ unrelated occupants)', ARRAY['scotland'], 3, 5),
  ('ni_hmo', 'Northern Ireland HMO Licence', 'Required for HMOs in Northern Ireland', ARRAY['northern_ireland'], 3, 6)
ON CONFLICT (code) DO NOTHING;

-- 6. Function to calculate licence status based on dates
CREATE OR REPLACE FUNCTION calculate_licence_status(
  p_start_date DATE,
  p_end_date DATE
) RETURNS TEXT AS $$
BEGIN
  IF p_start_date IS NULL AND p_end_date IS NULL THEN
    RETURN 'unknown';
  ELSIF p_end_date IS NULL THEN
    RETURN 'active'; -- No end date means indefinite
  ELSIF p_end_date < CURRENT_DATE THEN
    RETURN 'expired';
  ELSIF p_start_date IS NOT NULL AND p_start_date > CURRENT_DATE THEN
    RETURN 'pending';
  ELSE
    RETURN 'active';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. Trigger to auto-update status on insert/update
CREATE OR REPLACE FUNCTION update_licence_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := calculate_licence_status(NEW.start_date, NEW.end_date);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_licence_status ON property_licences;
CREATE TRIGGER trigger_update_licence_status
  BEFORE INSERT OR UPDATE OF start_date, end_date ON property_licences
  FOR EACH ROW
  EXECUTE FUNCTION update_licence_status();

-- 8. View for easy querying with licence type details
CREATE OR REPLACE VIEW property_licences_view AS
SELECT
  pl.*,
  lt.name AS licence_type_name,
  lt.description AS licence_type_description,
  lt.display_order,
  CASE
    WHEN pl.end_date IS NULL THEN NULL
    WHEN pl.end_date < CURRENT_DATE THEN 'expired'
    WHEN pl.end_date < CURRENT_DATE + INTERVAL '90 days' THEN 'expiring_soon'
    ELSE 'valid'
  END AS expiry_warning
FROM property_licences pl
LEFT JOIN licence_types lt ON pl.licence_type_id = lt.id OR pl.licence_type_code = lt.code;

-- 9. RLS Policies
ALTER TABLE property_licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_licence_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view property licences" ON property_licences
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage licence preferences" ON user_licence_preferences
  FOR ALL USING (auth.uid() = user_id);

-- 10. Grants
GRANT SELECT ON licence_types TO authenticated, anon;
GRANT SELECT ON property_licences TO authenticated, anon;
GRANT SELECT ON property_licences_view TO authenticated, anon;
GRANT ALL ON user_licence_preferences TO authenticated;
