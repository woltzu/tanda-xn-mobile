-- =============================================================================
-- 140: money_transfers + process_send_money RPC
-- =============================================================================
-- The actual server-side ledger for the Send Money flow. Until now the mobile
-- app's WalletContext.sendMoney only appended a row to AsyncStorage — no
-- debit on user_wallets, no transfer record, no recipient notification path.
-- This migration adds:
--
--   1. The money_transfers table — every send produces one row.
--   2. The process_send_money RPC — single SECURITY DEFINER entry point that
--      atomically debits the sender's main_balance_cents (locking the row
--      FOR UPDATE), resolves the recipient's user_id by phone, writes the
--      transfer row, and returns (transfer_id, new_balance_cents).
--   3. RLS — sender can read own sends, recipient can read transfers
--      addressed to them. INSERT/UPDATE/DELETE are funnelled through the
--      RPC; no direct table writes from clients.
--
-- Status semantics:
--   - 'completed' when method=wallet AND recipient_user_id was resolved
--     (the funds are notionally available to credit later; an MVP-stage
--     credit step is deferred to a separate migration).
--   - 'pending'   otherwise (external rails — bank, mobile money, cash
--     pickup — or no matched TandaXn user). Status flips to 'completed'
--     out-of-band when the rail-specific worker confirms delivery.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.money_transfers (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id                UUID NOT NULL REFERENCES auth.users(id),
  recipient_user_id             UUID NULL REFERENCES auth.users(id),
  recipient_external_identifier TEXT NOT NULL,
  amount_cents                  BIGINT NOT NULL,
  currency                      TEXT NOT NULL,
  fee_cents                     BIGINT NOT NULL DEFAULT 0,
  method                        TEXT NOT NULL,
  funding_source                TEXT NOT NULL,
  stripe_payment_intent_id      TEXT NULL,
  status                        TEXT NOT NULL DEFAULT 'pending',
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT money_transfers_amount_positive   CHECK (amount_cents > 0),
  CONSTRAINT money_transfers_fee_non_negative  CHECK (fee_cents >= 0),
  CONSTRAINT money_transfers_method_known      CHECK (method IN ('wallet','bank','mobile','cash')),
  CONSTRAINT money_transfers_funding_known     CHECK (funding_source IN ('wallet','stripe')),
  CONSTRAINT money_transfers_status_known      CHECK (status IN ('pending','completed','failed','reversed'))
);

CREATE INDEX IF NOT EXISTS money_transfers_sender_created_idx
  ON public.money_transfers (sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS money_transfers_recipient_created_idx
  ON public.money_transfers (recipient_user_id, created_at DESC)
  WHERE recipient_user_id IS NOT NULL;

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE public.money_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS money_transfers_sender_select ON public.money_transfers;
CREATE POLICY money_transfers_sender_select ON public.money_transfers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = sender_user_id);

DROP POLICY IF EXISTS money_transfers_recipient_select ON public.money_transfers;
CREATE POLICY money_transfers_recipient_select ON public.money_transfers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_user_id);

-- No INSERT/UPDATE/DELETE policies — all writes go through the SECURITY
-- DEFINER RPC below, which runs as the function owner and bypasses RLS.

-- =============================================================================
-- process_send_money RPC
-- =============================================================================
CREATE OR REPLACE FUNCTION public.process_send_money(
  p_amount_cents          BIGINT,
  p_currency              TEXT,
  p_recipient_identifier  TEXT,
  p_method                TEXT,
  p_funding_source        TEXT,
  p_fee_cents             BIGINT DEFAULT 0,
  p_stripe_intent_id      TEXT   DEFAULT NULL
)
RETURNS TABLE (
  transfer_id        UUID,
  new_balance_cents  BIGINT,
  recipient_matched  BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sender_id      UUID;
  v_recipient_id   UUID;
  v_total_debit    BIGINT;
  v_balance_before BIGINT;
  v_balance_after  BIGINT;
  v_transfer_id    UUID;
  v_status         TEXT;
BEGIN
  -- ──────────────────────────────────────────────────────────────────────
  -- Auth + input validation
  -- ──────────────────────────────────────────────────────────────────────
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF p_fee_cents IS NULL OR p_fee_cents < 0 THEN
    RAISE EXCEPTION 'invalid_fee';
  END IF;
  IF p_recipient_identifier IS NULL OR length(trim(p_recipient_identifier)) = 0 THEN
    RAISE EXCEPTION 'missing_recipient';
  END IF;
  IF p_method NOT IN ('wallet','bank','mobile','cash') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;
  IF p_funding_source NOT IN ('wallet','stripe') THEN
    RAISE EXCEPTION 'invalid_funding_source';
  END IF;

  v_total_debit := p_amount_cents + p_fee_cents;

  -- ──────────────────────────────────────────────────────────────────────
  -- Resolve recipient on TandaXn (phone exact match). Best-effort —
  -- non-matches just leave recipient_user_id NULL and status 'pending'.
  -- ──────────────────────────────────────────────────────────────────────
  SELECT id INTO v_recipient_id
  FROM public.profiles
  WHERE phone = p_recipient_identifier
  LIMIT 1;

  -- ──────────────────────────────────────────────────────────────────────
  -- Debit (wallet-funded path) — locks the row for the duration of the
  -- transaction so a concurrent send/contribution can't oversell.
  -- ──────────────────────────────────────────────────────────────────────
  IF p_funding_source = 'wallet' THEN
    SELECT main_balance_cents INTO v_balance_before
    FROM public.user_wallets
    WHERE user_id = v_sender_id
    FOR UPDATE;

    IF v_balance_before IS NULL THEN
      RAISE EXCEPTION 'no_wallet';
    END IF;
    IF v_balance_before < v_total_debit THEN
      RAISE EXCEPTION 'insufficient_funds';
    END IF;

    UPDATE public.user_wallets
       SET main_balance_cents = main_balance_cents - v_total_debit,
           last_activity_at   = NOW(),
           updated_at         = NOW()
     WHERE user_id = v_sender_id;

    v_balance_after := v_balance_before - v_total_debit;
  ELSE
    -- Stripe-funded path: wallet balance is unchanged. We still read it
    -- so the caller gets a consistent post-send balance to display.
    SELECT main_balance_cents INTO v_balance_after
    FROM public.user_wallets
    WHERE user_id = v_sender_id;
    v_balance_after := COALESCE(v_balance_after, 0);
  END IF;

  -- ──────────────────────────────────────────────────────────────────────
  -- Status — wallet-to-wallet between two TandaXn users is settled
  -- immediately; everything else awaits an external rail confirmation.
  -- ──────────────────────────────────────────────────────────────────────
  IF p_method = 'wallet' AND v_recipient_id IS NOT NULL THEN
    v_status := 'completed';
  ELSE
    v_status := 'pending';
  END IF;

  -- ──────────────────────────────────────────────────────────────────────
  -- Record
  -- ──────────────────────────────────────────────────────────────────────
  INSERT INTO public.money_transfers (
    sender_user_id, recipient_user_id, recipient_external_identifier,
    amount_cents, currency, fee_cents, method, funding_source,
    stripe_payment_intent_id, status
  )
  VALUES (
    v_sender_id, v_recipient_id, p_recipient_identifier,
    p_amount_cents, p_currency, p_fee_cents, p_method, p_funding_source,
    p_stripe_intent_id, v_status
  )
  RETURNING id INTO v_transfer_id;

  RETURN QUERY
    SELECT v_transfer_id, v_balance_after, (v_recipient_id IS NOT NULL);
END;
$$;

-- Lock down — only authenticated callers.
REVOKE ALL ON FUNCTION public.process_send_money(BIGINT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_send_money(BIGINT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.process_send_money(BIGINT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT) TO authenticated;

-- =============================================================================
-- Self-register
-- =============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '140',
  'money_transfers',
  ARRAY['-- 140: money_transfers']
)
ON CONFLICT (version) DO NOTHING;
