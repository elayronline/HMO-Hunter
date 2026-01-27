-- Migration 007: Seed properties across multiple UK cities
-- Run this in Supabase SQL Editor AFTER running 006_add_potential_hmo_fields.sql

-- First, ensure we have the potential HMO columns
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_potential_hmo BOOLEAN DEFAULT FALSE;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS hmo_classification TEXT CHECK (hmo_classification IN ('ready_to_go', 'value_add', 'not_suitable'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS deal_score INTEGER CHECK (deal_score >= 0 AND deal_score <= 100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor_area_band TEXT CHECK (floor_area_band IN ('under_90', '90_120', '120_plus'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS yield_band TEXT CHECK (yield_band IN ('low', 'medium', 'high'));
ALTER TABLE properties ADD COLUMN IF NOT EXISTS potential_occupants INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_gross_monthly_rent INTEGER;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_yield_percentage DECIMAL(5,2);

-- London - Potential HMOs (Green markers - opportunities outside Article 4)
INSERT INTO public.properties (
  title, address, postcode, city, latitude, longitude,
  price_pcm, purchase_price, listing_type, property_type, hmo_status, bedrooms, bathrooms,
  is_potential_hmo, hmo_classification, deal_score, floor_area_band, yield_band,
  potential_occupants, estimated_gross_monthly_rent, article_4_area,
  has_garden, is_furnished, is_student_friendly, is_stale
) VALUES
-- London opportunities (outside Article 4)
('Investment Property - Stratford', '45 Stratford High Street', 'E15 2PJ', 'London', 51.5423, -0.0034, NULL, 385000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 78, '120_plus', 'high', 6, 4200, false, true, true, true, false),
('HMO Opportunity - Lewisham', '123 Lewisham Way', 'SE14 6PP', 'London', 51.4647, -0.0205, NULL, 425000, 'purchase', 'House', 'Unlicensed HMO', 6, 2, true, 'ready_to_go', 82, '120_plus', 'high', 7, 4900, false, true, true, true, false),
('Value Add - Croydon', '78 High Street', 'CR0 1NA', 'London', 51.3727, -0.0988, NULL, 320000, 'purchase', 'House', 'Unlicensed HMO', 4, 2, true, 'value_add', 65, '90_120', 'medium', 5, 3200, false, true, true, true, false),
('Investment - Barking', '56 Ripple Road', 'IG11 7PL', 'London', 51.5363, 0.0811, NULL, 295000, 'purchase', 'House', 'Unlicensed HMO', 4, 1, true, 'value_add', 72, '90_120', 'high', 5, 3000, false, false, true, false, false),

-- London licensed HMOs (in Article 4 areas - red markers)
('Licensed HMO - Camden', '89 Camden High Street', 'NW1 7JY', 'London', 51.5392, -0.1426, 4200, NULL, 'rent', 'House', 'Licensed HMO', 7, 2, false, NULL, 55, '120_plus', 'medium', NULL, NULL, true, true, true, false, false),
('Licensed HMO - Islington', '88 Upper Street', 'N1 0NP', 'London', 51.5416, -0.1030, 4300, NULL, 'rent', 'House', 'Licensed HMO', 7, 3, false, NULL, 50, '120_plus', 'medium', NULL, NULL, true, true, true, true, false),
('Licensed HMO - Southwark', '201 Borough High Street', 'SE1 1JA', 'London', 51.5012, -0.0919, 3900, NULL, 'rent', 'Flat', 'Licensed HMO', 5, 2, false, NULL, 45, '90_120', 'low', NULL, NULL, true, false, true, true, false),

-- Manchester - Multiple opportunities
('HMO Ready - Fallowfield', '45 Wilmslow Road', 'M14 6XQ', 'Manchester', 53.4488, -2.2187, NULL, 185000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 85, '120_plus', 'high', 6, 3300, false, true, true, true, false),
('Investment - Rusholme', '123 Wilmslow Road', 'M14 5LW', 'Manchester', 53.4555, -2.2176, NULL, 195000, 'purchase', 'House', 'Unlicensed HMO', 6, 2, true, 'ready_to_go', 88, '120_plus', 'high', 7, 3850, false, true, true, true, false),
('Value Add - Longsight', '78 Stockport Road', 'M12 4AA', 'Manchester', 53.4627, -2.2039, NULL, 155000, 'purchase', 'House', 'Unlicensed HMO', 4, 1, true, 'value_add', 70, '90_120', 'high', 5, 2600, false, false, true, true, false),
('Licensed HMO - Withington', '56 Burton Road', 'M20 3EB', 'Manchester', 53.4315, -2.2276, 2800, NULL, 'rent', 'House', 'Licensed HMO', 5, 2, false, NULL, 60, '90_120', 'medium', NULL, NULL, false, true, true, true, false),

-- Birmingham - Selly Oak (Article 4 area)
('Licensed HMO - Selly Oak', '45 Bristol Road', 'B29 6BD', 'Birmingham', 52.4398, -1.9356, 2400, NULL, 'rent', 'House', 'Licensed HMO', 6, 2, false, NULL, 40, '120_plus', 'low', NULL, NULL, true, true, true, true, false),
('Licensed HMO - Harborne', '78 High Street', 'B17 9NS', 'Birmingham', 52.4589, -1.9534, 2600, NULL, 'rent', 'House', 'Licensed HMO', 5, 2, false, NULL, 45, '90_120', 'low', NULL, NULL, true, true, true, true, false),
-- Birmingham opportunities (outside Article 4)
('HMO Ready - Erdington', '123 High Street', 'B23 6RH', 'Birmingham', 52.5262, -1.8406, NULL, 165000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 80, '120_plus', 'high', 6, 2900, false, true, true, true, false),
('Value Add - Handsworth', '56 Soho Road', 'B21 9DP', 'Birmingham', 52.5087, -1.9366, NULL, 145000, 'purchase', 'House', 'Unlicensed HMO', 4, 1, true, 'value_add', 75, '90_120', 'high', 5, 2400, false, false, true, false, false),

-- Leeds
('HMO Ready - Hyde Park', '34 Hyde Park Road', 'LS6 1AG', 'Leeds', 53.8176, -1.5582, NULL, 175000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 83, '120_plus', 'high', 6, 3000, false, true, true, true, false),
('Investment - Headingley', '89 Otley Road', 'LS6 3PX', 'Leeds', 53.8263, -1.5758, NULL, 195000, 'purchase', 'House', 'Unlicensed HMO', 6, 2, true, 'ready_to_go', 80, '120_plus', 'high', 7, 3500, false, true, true, true, false),
('Value Add - Burley', '67 Burley Road', 'LS3 1JP', 'Leeds', 53.8019, -1.5765, NULL, 140000, 'purchase', 'House', 'Unlicensed HMO', 4, 1, true, 'value_add', 72, '90_120', 'high', 5, 2400, false, false, true, true, false),

-- Bristol - Article 4 in Clifton/Redland
('Licensed HMO - Clifton', '45 Whiteladies Road', 'BS8 2NT', 'Bristol', 51.4629, -2.6141, 3200, NULL, 'rent', 'House', 'Licensed HMO', 6, 2, false, NULL, 48, '120_plus', 'low', NULL, NULL, true, true, true, true, false),
('Licensed HMO - Redland', '78 Redland Road', 'BS6 6AG', 'Bristol', 51.4720, -2.6057, 3000, NULL, 'rent', 'House', 'Licensed HMO', 5, 2, false, NULL, 45, '90_120', 'low', NULL, NULL, true, true, true, true, false),
-- Bristol opportunities (outside Article 4)
('HMO Ready - Fishponds', '123 Fishponds Road', 'BS16 3DL', 'Bristol', 51.4817, -2.5280, NULL, 265000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 76, '120_plus', 'high', 6, 3400, false, true, true, true, false),
('Value Add - Easton', '56 Stapleton Road', 'BS5 0QR', 'Bristol', 51.4657, -2.5574, NULL, 235000, 'purchase', 'House', 'Unlicensed HMO', 4, 2, true, 'value_add', 68, '90_120', 'medium', 5, 2800, false, false, true, false, false),

-- Liverpool
('HMO Ready - Wavertree', '45 Picton Road', 'L15 4LG', 'Liverpool', 53.4014, -2.9276, NULL, 115000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 90, '120_plus', 'high', 6, 2700, false, true, true, true, false),
('Investment - Kensington', '78 Edge Lane', 'L7 9JH', 'Liverpool', 53.4088, -2.9358, NULL, 98000, 'purchase', 'House', 'Unlicensed HMO', 4, 1, true, 'ready_to_go', 88, '90_120', 'high', 5, 2200, false, false, true, false, false),
('Value Add - Anfield', '34 Walton Breck Road', 'L4 0RE', 'Liverpool', 53.4296, -2.9594, NULL, 85000, 'purchase', 'House', 'Unlicensed HMO', 4, 1, true, 'value_add', 82, '90_120', 'high', 5, 2000, false, true, true, true, false),

-- Sheffield
('HMO Ready - Ecclesall', '45 Ecclesall Road', 'S11 8PR', 'Sheffield', 53.3698, -1.4916, NULL, 175000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 79, '120_plus', 'high', 6, 2800, false, true, true, true, false),
('Value Add - Crookes', '78 Crookes Road', 'S10 1UE', 'Sheffield', 53.3908, -1.5103, NULL, 155000, 'purchase', 'House', 'Unlicensed HMO', 4, 2, true, 'value_add', 74, '90_120', 'high', 5, 2400, false, true, true, true, false),

-- Nottingham
('HMO Ready - Lenton', '34 Derby Road', 'NG7 2GW', 'Nottingham', 52.9479, -1.1800, NULL, 165000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 81, '120_plus', 'high', 6, 2700, false, true, true, true, false),
('Investment - Radford', '56 Ilkeston Road', 'NG7 3FX', 'Nottingham', 52.9591, -1.1876, NULL, 145000, 'purchase', 'House', 'Unlicensed HMO', 4, 1, true, 'ready_to_go', 84, '90_120', 'high', 5, 2400, false, false, true, true, false),

-- Portsmouth
('HMO Ready - Southsea', '45 Albert Road', 'PO5 2SE', 'Portsmouth', 50.7835, -1.0817, NULL, 215000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 77, '120_plus', 'high', 6, 3000, false, true, true, true, false),
('Value Add - Milton', '78 Milton Road', 'PO4 8PR', 'Portsmouth', 50.8011, -1.0621, NULL, 185000, 'purchase', 'House', 'Unlicensed HMO', 4, 1, true, 'value_add', 70, '90_120', 'medium', 5, 2500, false, false, true, false, false),

-- Reading
('HMO Ready - East Reading', '45 London Road', 'RG1 5AU', 'Reading', 51.4565, -0.9683, NULL, 285000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 74, '120_plus', 'medium', 6, 3600, false, true, true, true, false),
('Licensed HMO - West Reading', '78 Oxford Road', 'RG30 1AP', 'Reading', 51.4541, -1.0066, 3400, NULL, 'rent', 'House', 'Licensed HMO', 6, 2, false, NULL, 52, '120_plus', 'medium', NULL, NULL, true, true, true, true, false),

-- Newcastle
('HMO Ready - Fenham', '45 Fenham Hall Drive', 'NE4 9XD', 'Newcastle', 54.9816, -1.6517, NULL, 135000, 'purchase', 'House', 'Unlicensed HMO', 5, 2, true, 'ready_to_go', 86, '120_plus', 'high', 6, 2600, false, true, true, true, false),
('Licensed HMO - Jesmond', '78 Osborne Road', 'NE2 2AP', 'Newcastle', 54.9892, -1.6019, 2800, NULL, 'rent', 'House', 'Licensed HMO', 6, 2, false, NULL, 50, '120_plus', 'medium', NULL, NULL, true, true, true, true, false),
('Value Add - Heaton', '34 Chillingham Road', 'NE6 5LN', 'Newcastle', 54.9812, -1.5784, NULL, 125000, 'purchase', 'House', 'Unlicensed HMO', 4, 1, true, 'value_add', 78, '90_120', 'high', 5, 2200, false, false, true, true, false)

ON CONFLICT DO NOTHING;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_properties_is_potential_hmo ON properties(is_potential_hmo);
CREATE INDEX IF NOT EXISTS idx_properties_hmo_classification ON properties(hmo_classification);
CREATE INDEX IF NOT EXISTS idx_properties_deal_score ON properties(deal_score);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
