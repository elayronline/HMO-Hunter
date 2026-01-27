-- Create properties table
CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  address TEXT NOT NULL,
  postcode TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT DEFAULT 'UK',
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  price_pcm DECIMAL(10, 2) NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('HMO', 'Flat', 'House', 'Studio')),
  hmo_type TEXT CHECK (hmo_type IN ('Unlicensed HMO', 'Licensed HMO', 'Potential HMO')),
  bedrooms INTEGER NOT NULL,
  bathrooms INTEGER NOT NULL,
  has_garden BOOLEAN DEFAULT false,
  has_parking BOOLEAN DEFAULT false,
  is_furnished BOOLEAN DEFAULT false,
  is_student_friendly BOOLEAN DEFAULT false,
  is_pet_friendly BOOLEAN DEFAULT false,
  wifi_included BOOLEAN DEFAULT false,
  near_tube_station BOOLEAN DEFAULT false,
  available_from DATE,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for location-based queries
CREATE INDEX IF NOT EXISTS idx_properties_location ON public.properties (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_properties_city ON public.properties (city);
CREATE INDEX IF NOT EXISTS idx_properties_price ON public.properties (price_pcm);
CREATE INDEX IF NOT EXISTS idx_properties_type ON public.properties (property_type);

-- Enable RLS
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Properties are public - anyone can view them
CREATE POLICY "properties_select_all"
  ON public.properties FOR SELECT
  USING (true);

-- Only authenticated users can insert properties
CREATE POLICY "properties_insert_authenticated"
  ON public.properties FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Only authenticated users can update properties
CREATE POLICY "properties_update_authenticated"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (true);

-- Only authenticated users can delete properties
CREATE POLICY "properties_delete_authenticated"
  ON public.properties FOR DELETE
  TO authenticated
  USING (true);
