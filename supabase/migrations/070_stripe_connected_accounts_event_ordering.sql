-- ============================================================================
-- Migration 070: last_account_event_at on stripe_connected_accounts
-- ============================================================================
-- Stage 1 of the Stripe Connect payout architecture rebuild.
--
-- Tracks the `event.created` timestamp of the most-recent account.updated
-- Stripe event applied to this row. The stripe-webhook function uses this
-- column to reject stale (out-of-order) deliveries via a `lte` comparison
-- (Layer 2 idempotency, paired with Layer 1 = UNIQUE on stripe_event_id).
--
-- See: docs/audit/24_stripe_connect_payout_path.md
--      supabase/functions/stripe-webhook/index.ts (account.updated branch)
-- ============================================================================

ALTER TABLE public.stripe_connected_accounts
  ADD COLUMN IF NOT EXISTS last_account_event_at timestamptz NULL;

COMMENT ON COLUMN public.stripe_connected_accounts.last_account_event_at
  IS 'event.created from the most recent account.updated Stripe event applied to this row. Used by stripe-webhook for out-of-order event protection (Layer 2 idempotency). NULL means no account.updated has been processed for this account yet.';
