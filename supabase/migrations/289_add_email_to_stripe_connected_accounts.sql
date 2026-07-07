-- ═══════════════════════════════════════════════════════════════════════════
-- 289_add_email_to_stripe_connected_accounts.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The `create-connect-account` Edge Function inserts into
-- `stripe_connected_accounts` with an `email` column that was never
-- actually added to the table. Every Add-Bank attempt for a brand-new
-- user therefore fails at the INSERT with
--   Could not find the 'email' column of 'stripe_connected_accounts' in the schema cache
-- and surfaces to the client as "Failed to persist connected account".
--
-- The Stripe side succeeds — the caller ends up with an orphaned
-- Connect account on Stripe but no matching row on our side, so the
-- next attempt with the same idempotency key just refuses the same way.
--
-- Fix: add the column with IF NOT EXISTS so the migration is idempotent.
-- No backfill needed — pre-existing rows had no source of truth for
-- email either (the column literally didn't exist), so NULL is fine
-- and future rows will populate on insert.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.stripe_connected_accounts
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Self-register. Idempotent via ON CONFLICT.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '289',
  'add_email_to_stripe_connected_accounts',
  ARRAY['-- 289: add_email_to_stripe_connected_accounts']
)
ON CONFLICT (version) DO NOTHING;
