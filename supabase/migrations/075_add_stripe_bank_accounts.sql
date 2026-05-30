-- ════════════════════════════════════════════════════════════════════════════
-- 075: add_stripe_bank_accounts — linked bank accounts via Financial Connections
-- ════════════════════════════════════════════════════════════════════════════
--
-- Stores the user-facing record of a Stripe-attached us_bank_account
-- PaymentMethod (created via Stripe Financial Connections in the
-- stripe-create-bank-session / stripe-attach-bank-payment-method edge
-- functions). The Stripe-side identifiers live here so the client can
-- list the user's linked banks and pick one when funding a goal.
--
-- Why a dedicated table (vs reading PaymentMethods from Stripe on demand):
--   - List queries can be RLS-scoped without a Stripe API round-trip.
--   - We get a real created_at + status for UI affordances
--     (e.g. "linked Apr 4", "verifying").
--   - The FC account id is captured for forensic linkage when a
--     PaymentIntent is later created using this PaymentMethod.
--
-- Idempotency:
--   stripe_payment_method_id is UNIQUE, so the attach edge function can
--   safely re-upsert if the user re-links the same bank account.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stripe_bank_accounts (
  id                                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_payment_method_id                TEXT NOT NULL UNIQUE,
  stripe_financial_connections_account_id TEXT,
  bank_name                               TEXT,
  last4                                   TEXT,
  account_holder_name                     TEXT,
  status                                  TEXT DEFAULT 'active',
  created_at                              TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at                              TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_bank_accounts_user
  ON public.stripe_bank_accounts(user_id);

ALTER TABLE public.stripe_bank_accounts ENABLE ROW LEVEL SECURITY;

-- ── RLS policies ───────────────────────────────────────────────────────────
-- Self-service for the owning user (mirrors the pe_usg_* / pe_st_* pattern
-- already used by user_savings_goals / savings_transactions). WITH CHECK is
-- written explicitly even where USING would fall through, to match the
-- house style and make the predicate visible at audit time.
--
-- Plus a service-role escape hatch for the edge functions that need to
-- upsert on behalf of the user during the FC attach flow.
DROP POLICY IF EXISTS pe_sba_select  ON public.stripe_bank_accounts;
DROP POLICY IF EXISTS pe_sba_insert  ON public.stripe_bank_accounts;
DROP POLICY IF EXISTS pe_sba_update  ON public.stripe_bank_accounts;
DROP POLICY IF EXISTS pe_sba_delete  ON public.stripe_bank_accounts;
DROP POLICY IF EXISTS pe_sba_service ON public.stripe_bank_accounts;

CREATE POLICY pe_sba_select ON public.stripe_bank_accounts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY pe_sba_insert ON public.stripe_bank_accounts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY pe_sba_update ON public.stripe_bank_accounts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY pe_sba_delete ON public.stripe_bank_accounts
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY pe_sba_service ON public.stripe_bank_accounts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════
-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '075',
  'add_stripe_bank_accounts',
  ARRAY['-- 075: add_stripe_bank_accounts (table + RLS for Stripe Financial Connections linked banks)']
)
ON CONFLICT (version) DO NOTHING;
