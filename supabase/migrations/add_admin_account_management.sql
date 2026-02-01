-- Add account deactivation fields to user_credits
ALTER TABLE public.user_credits
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deactivation_reason TEXT;

-- Create index for active users
CREATE INDEX IF NOT EXISTS idx_user_credits_is_active ON public.user_credits(is_active);

-- Create credit adjustments audit table
CREATE TABLE IF NOT EXISTS public.credit_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES auth.users(id),
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('top_up', 'reset', 'bonus', 'penalty')),
    amount INTEGER NOT NULL,
    reason TEXT,
    previous_credits_used INTEGER,
    new_credits_used INTEGER,
    previous_daily_credits INTEGER,
    new_daily_credits INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for audit lookups
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_user_id ON public.credit_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_admin_id ON public.credit_adjustments(admin_id);
CREATE INDEX IF NOT EXISTS idx_credit_adjustments_created_at ON public.credit_adjustments(created_at DESC);

-- Enable RLS on credit_adjustments
ALTER TABLE public.credit_adjustments ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read all adjustments
CREATE POLICY "Admins can read credit adjustments" ON public.credit_adjustments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.user_credits
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Policy: Admins can insert adjustments
CREATE POLICY "Admins can insert credit adjustments" ON public.credit_adjustments
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_credits
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );
