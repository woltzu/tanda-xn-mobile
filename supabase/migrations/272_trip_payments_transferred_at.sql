-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 272: trip_payments_transferred_at
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds the `transferred_at` timestamp the stripe-webhook EF stamps when a
-- transfer.paid event fires for a trip-payment-linked Stripe Transfer.
-- Bucket B (migration 271) stamped transfer_id at release time — that
-- records the *intent* to transfer. transferred_at records the moment
-- Stripe confirms the funds actually landed on the connected account,
-- which can be hours later for ACH-backed payouts.
--
-- Idempotency: webhook UPDATE filters on status != 'transferred' so
-- redeliveries skip; transferred_at is overwritten by the first apply
-- only (subsequent updates short-circuit before writing).
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE trip_payments
  ADD COLUMN IF NOT EXISTS transferred_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trip_payments_transferred_at
  ON trip_payments(transferred_at)
  WHERE transferred_at IS NOT NULL;

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '272',
  'trip_payments_transferred_at',
  ARRAY['-- 272: trip_payments_transferred_at']
)
ON CONFLICT (version) DO NOTHING;
