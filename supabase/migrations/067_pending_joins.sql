-- ============================================================================
-- 067: pending_joins table
-- Holds "I want to join this circle" intent between QuickJoin submit and
-- magic-link confirmation. Rows are created by anonymous users (pre-auth)
-- and read back after the user confirms their email and JoinConfirm runs.
-- ============================================================================

CREATE TABLE IF NOT EXISTS pending_joins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL, -- 'debit_card' | 'apple_pay' | 'cash_app' | 'paypal'
  payment_details_encrypted TEXT, -- last 4 digits only for demo; full tokenization post-Stripe
  consented_to_rules BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation', -- 'awaiting_confirmation' | 'completed' | 'expired'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pending_joins_email_code ON pending_joins(email, invite_code);
CREATE INDEX IF NOT EXISTS idx_pending_joins_status
  ON pending_joins(status) WHERE status = 'awaiting_confirmation';

-- RLS
ALTER TABLE pending_joins ENABLE ROW LEVEL SECURITY;

-- Users can only see their own pending joins (by email match from JWT)
DROP POLICY IF EXISTS "Users see own pending joins" ON pending_joins;
CREATE POLICY "Users see own pending joins"
  ON pending_joins FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

-- Anyone can insert (pre-auth flow creates the row before the magic link)
DROP POLICY IF EXISTS "Anonymous can create pending joins" ON pending_joins;
CREATE POLICY "Anonymous can create pending joins"
  ON pending_joins FOR INSERT
  WITH CHECK (true);

-- Users can update their own row (to mark completed after magic-link confirm)
DROP POLICY IF EXISTS "Users update own pending joins" ON pending_joins;
CREATE POLICY "Users update own pending joins"
  ON pending_joins FOR UPDATE
  USING (auth.jwt() ->> 'email' = email);
