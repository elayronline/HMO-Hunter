-- Migration: D2V Follow-Up Sequences + Response Tracking

-- Follow-up sequences for automated drip campaigns
CREATE TABLE IF NOT EXISTS d2v_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES d2v_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES d2v_recipients(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL DEFAULT 1 CHECK (sequence_number BETWEEN 1 AND 5),
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'skipped')),
  channel TEXT NOT NULL DEFAULT 'letter' CHECK (channel IN ('letter', 'email')),
  template_body TEXT,       -- Merged follow-up content
  template_subject TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recipient_id, sequence_number)
);

-- Response tracking per recipient
ALTER TABLE d2v_recipients ADD COLUMN IF NOT EXISTS reference_code TEXT;
ALTER TABLE d2v_recipients ADD COLUMN IF NOT EXISTS response_notes TEXT;
ALTER TABLE d2v_recipients ADD COLUMN IF NOT EXISTS response_type TEXT CHECK (response_type IN ('call', 'email', 'letter', 'meeting', 'rejected', 'not_interested'));
ALTER TABLE d2v_recipients ADD COLUMN IF NOT EXISTS address_validated BOOLEAN DEFAULT false;
ALTER TABLE d2v_recipients ADD COLUMN IF NOT EXISTS address_confidence TEXT CHECK (address_confidence IN ('high', 'medium', 'low'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_d2v_sequences_scheduled ON d2v_sequences(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_d2v_sequences_recipient ON d2v_sequences(recipient_id);
CREATE INDEX IF NOT EXISTS idx_d2v_recipients_reference ON d2v_recipients(reference_code);

-- RLS
ALTER TABLE d2v_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sequences"
  ON d2v_sequences FOR ALL USING (
    campaign_id IN (SELECT id FROM d2v_campaigns WHERE user_id = auth.uid())
  );
