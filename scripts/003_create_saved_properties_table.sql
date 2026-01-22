-- Create saved_properties table (user favorites/bookmarks)
CREATE TABLE IF NOT EXISTS public.saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, property_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_saved_properties_user ON public.saved_properties (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_properties_property ON public.saved_properties (property_id);

-- Enable RLS
ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;

-- Users can only view their own saved properties
CREATE POLICY "saved_properties_select_own"
  ON public.saved_properties FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own saved properties
CREATE POLICY "saved_properties_insert_own"
  ON public.saved_properties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own saved properties
CREATE POLICY "saved_properties_update_own"
  ON public.saved_properties FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own saved properties
CREATE POLICY "saved_properties_delete_own"
  ON public.saved_properties FOR DELETE
  USING (auth.uid() = user_id);
