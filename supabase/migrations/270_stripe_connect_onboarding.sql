-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 270: stripe_connect_onboarding
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds the column the stripe-create-account-link Edge Function writes to
-- when an organizer completes Stripe Connect Express onboarding. The id
-- is needed later on the payout side (stripe.transfers.create with
-- destination = account_id) — once a trip collects funds in escrow and
-- the organizer is ready to be paid out, we look this column up.
--
-- RLS: profiles already has policies that let a user read/update their
-- own row (auth.uid() = id). The Edge Function uses the service-role
-- key and bypasses RLS, so no extra policy is needed here.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_connect_account_id
  ON profiles(stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '270',
  'stripe_connect_onboarding',
  ARRAY['-- 270: stripe_connect_onboarding']
)
ON CONFLICT (version) DO NOTHING;
