-- Create saved_searches table for storing user filter configurations
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP WITH TIME ZONE,
  use_count INTEGER DEFAULT 0,

  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

-- Users can only view their own saved searches
CREATE POLICY "saved_searches_select_own"
  ON public.saved_searches FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own saved searches
CREATE POLICY "saved_searches_insert_own"
  ON public.saved_searches FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own saved searches
CREATE POLICY "saved_searches_update_own"
  ON public.saved_searches FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can only delete their own saved searches
CREATE POLICY "saved_searches_delete_own"
  ON public.saved_searches FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON public.saved_searches(user_id);
