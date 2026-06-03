-- ============================================================================
-- Migration 079: stripe_payout_id on savings_transactions
-- ============================================================================
-- Part of Option A: safe, partial support for external (bank/Stripe-payout)
-- goal withdrawals. Adds the column that future debit_goal_external calls
-- will populate AND that the (future) Stripe payout webhook will use to
-- look up the matching savings_transactions row when the payout settles
-- or fails.
--
-- No Stripe wiring yet. This migration only opens the schema slot.
--
-- See: migration 080 (debit_goal_external RPC).
-- ============================================================================

ALTER TABLE savings_transactions
  ADD COLUMN IF NOT EXISTS stripe_payout_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_savings_transactions_payout
  ON savings_transactions(stripe_payout_id)
  WHERE stripe_payout_id IS NOT NULL;

COMMENT ON COLUMN savings_transactions.stripe_payout_id
  IS 'Stripe payout ID (po_...) that this withdrawal row maps to. NULL for wallet-only withdrawals. UNIQUE so a duplicate Stripe webhook delivery can be detected and skipped via the idempotency check in debit_goal_external.';

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('079', 'stripe_payout_id', ARRAY['-- 079: stripe_payout_id'])
ON CONFLICT (version) DO NOTHING;
