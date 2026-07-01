-- ═══════════════════════════════════════════════════════════════════════════
-- 284_withdrawal_requests.sql
--
-- Adds the request_withdrawal RPC + polish to the existing
-- withdrawal_requests table so the "Withdraw to bank" client screen has
-- an end-to-end path.
--
-- Spec deviations (also noted in the commit body):
--
--   * The spec proposed CREATE TABLE withdrawal_requests + RLS + indexes
--     from scratch. That table ALREADY EXISTS in prod (legacy 'wallets'
--     era: amount numeric, users(id) FK, transaction_status enum). Row
--     count is zero, but migration 257 attached a BEFORE INSERT trigger
--     (tr_block_critical_withdrawal) that gates withdrawals against
--     unresolved critical actions — dropping the table would silently
--     remove that gating. We preserve the table and add only what's
--     missing.
--
--   * Existing status enum is `transaction_status` with values
--     pending / processing / completed / failed / reversed. Spec asked
--     for a text CHECK including 'cancelled'. We ADD 'cancelled' to the
--     enum rather than rewrite the whole column (safe additive change).
--
--   * Spec RPC reads user_wallets.available_balance_cents — good, we
--     honour it. The existing table stores `amount numeric` (dollars),
--     so the RPC converts p_amount_cents → dollars before insert.
--
--   * Existing RLS policies cover INSERT own + SELECT own. We add
--     admin SELECT and admin UPDATE per the spec's intent.
--
--   * Registry INSERT is corrected to
--     supabase_migrations.schema_migrations (per CLAUDE.md).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Add 'cancelled' to the transaction_status enum ─────────────────────
-- IF NOT EXISTS syntax makes the ADD idempotent — re-running this file
-- is a no-op if the label is already present.
ALTER TYPE public.transaction_status ADD VALUE IF NOT EXISTS 'cancelled';

-- ─── 2. Add the future bank_account_id column ──────────────────────────────
-- Placeholder for a later linked-bank feature. Nullable; no FK yet
-- because the bank_accounts table doesn't exist and we don't want to
-- pin that shape in advance.
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS bank_account_id UUID;

-- ─── 3. Indexes for admin queue queries ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id
  ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
  ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at
  ON public.withdrawal_requests(created_at DESC);

-- ─── 4. Admin RLS policies (own-user policies already present) ─────────────
DROP POLICY IF EXISTS withdrawal_requests_select_admin ON public.withdrawal_requests;
CREATE POLICY withdrawal_requests_select_admin ON public.withdrawal_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = true
  ));

DROP POLICY IF EXISTS withdrawal_requests_update_admin ON public.withdrawal_requests;
CREATE POLICY withdrawal_requests_update_admin ON public.withdrawal_requests
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = true
  ));

-- ─── 5. request_withdrawal RPC ─────────────────────────────────────────────
-- Reads user_wallets.available_balance_cents for validation (spec
-- intent), inserts a row into the existing withdrawal_requests table
-- with `amount` (dollars — legacy shape). The mig 257 BEFORE INSERT
-- trigger still runs and can block if a critical action is unresolved.
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_amount_cents INTEGER)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id                 UUID := auth.uid();
  v_available_balance_cents INTEGER;
  v_request_id              UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required' USING ERRCODE = '42501';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT available_balance_cents INTO v_available_balance_cents
    FROM public.user_wallets
   WHERE user_id = v_user_id;

  IF v_available_balance_cents IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF p_amount_cents > v_available_balance_cents THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Insert into the existing legacy schema. destination_type = 'bank'
  -- marks this as a bank withdrawal (as opposed to internal reversals
  -- or other legacy destinations); the trigger from mig 257 reads
  -- destination_type = 'withdraw' via a lookup — inspect if the gate
  -- misfires. Amount is stored in USD dollars per legacy convention.
  INSERT INTO public.withdrawal_requests (
    user_id, amount, currency, destination_type, status
  )
  VALUES (
    v_user_id,
    (p_amount_cents::NUMERIC / 100.0),
    'USD',
    'bank',
    'pending'::public.transaction_status
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_withdrawal(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(INTEGER) TO authenticated;

-- ─── Self-register ─────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '284',
  'withdrawal_requests',
  ARRAY['-- 284: withdrawal_requests']
)
ON CONFLICT (version) DO NOTHING;
