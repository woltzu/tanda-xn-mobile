-- ════════════════════════════════════════════════════════════════════════════
-- 076: pending_goal_deposits — pending → completed transition for ACH
-- ════════════════════════════════════════════════════════════════════════════
--
-- For ACH deposits via Stripe Financial Connections (migration 075), Stripe
-- fires `payment_intent.processing` immediately when the PI is confirmed
-- (typically within seconds of the user linking their bank), then fires
-- `payment_intent.succeeded` 3-5 business days later when the ACH actually
-- clears. Users were previously left with no transaction visibility for
-- that entire window because the webhook only acted on .succeeded.
--
-- This migration adds:
--   1. record_pending_goal_deposit(...) — invoked by the webhook on
--      .processing to insert a `pending` savings_transactions row so the
--      user sees the deposit in their activity feed immediately.
--   2. CREATE OR REPLACE of credit_goal_external (originally migration
--      074) so it now handles the pending-upgrade path: when invoked
--      from .succeeded, if a pending row already exists for this PI it
--      upgrades the row to completed and credits the goal atomically;
--      otherwise it falls through to the fresh-insert path (cards and
--      banks that skipped processing).
--
-- Design choice (Option A from the planning discussion):
--   The pending row's balance_before and balance_after both equal the
--   current goal balance — honest "as of pending, nothing has changed".
--   credit_goal_external recomputes both fields on upgrade based on the
--   actual goal balance at settle time (which may have moved if other
--   deposits landed during the 3-5 day window).
--
-- Idempotency layers:
--   - record_pending_goal_deposit: ON CONFLICT (stripe_payment_intent_id)
--     DO NOTHING handles Stripe-side retries of .processing AND the rare
--     case where .succeeded arrives first then .processing.
--   - credit_goal_external: pre-lock + post-lock checks ensure two
--     concurrent .succeeded deliveries can't double-credit. Status check
--     means only `completed` rows count as already-handled — a pending
--     row falls through to the upgrade path.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- record_pending_goal_deposit
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.record_pending_goal_deposit(
  p_goal_id        UUID,
  p_amount_cents   BIGINT,
  p_fee_cents      BIGINT DEFAULT 0,
  p_source         TEXT   DEFAULT 'bank',
  p_stripe_pi_id   TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_goal_owner   UUID;
  v_goal_balance BIGINT;
BEGIN
  -- ── Input validation ────────────────────────────────────────────────────
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_stripe_pi_id IS NULL OR length(p_stripe_pi_id) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stripe payment intent id is required');
  END IF;

  -- ── Snapshot the goal for owner + balance fields ───────────────────────
  -- No FOR UPDATE — we are not mutating the goal row. The snapshot can
  -- drift between read and INSERT; that's fine because credit_goal_external
  -- recomputes balance_before/after at upgrade time from the actual
  -- balance.
  SELECT user_id, current_balance_cents
    INTO v_goal_owner, v_goal_balance
  FROM public.user_savings_goals
  WHERE id = p_goal_id;

  IF v_goal_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
  END IF;

  -- ── Insert the pending row ──────────────────────────────────────────────
  -- ON CONFLICT (stripe_payment_intent_id) DO NOTHING covers:
  --   - Stripe retrying the same .processing event.
  --   - .succeeded arriving before .processing (in which case the row was
  --     already inserted with status='completed' by credit_goal_external,
  --     and we leave it alone).
  INSERT INTO public.savings_transactions (
    savings_goal_id, user_id, transaction_type, source,
    amount_cents, fee_cents,
    balance_before_cents, balance_after_cents,
    transaction_status, stripe_payment_intent_id,
    metadata
  ) VALUES (
    p_goal_id, v_goal_owner, 'deposit', p_source,
    p_amount_cents, COALESCE(p_fee_cents, 0),
    v_goal_balance, v_goal_balance,
    'pending', p_stripe_pi_id,
    jsonb_build_object(
      'payment_method',      p_source,
      'fee_cents',           COALESCE(p_fee_cents, 0),
      'external_deposit',    true,
      'pending_via_webhook', true
    )
  )
  ON CONFLICT (stripe_payment_intent_id) DO NOTHING;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_pending_goal_deposit(UUID, BIGINT, BIGINT, TEXT, TEXT)
  TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_pending_goal_deposit(UUID, BIGINT, BIGINT, TEXT, TEXT)
  FROM anon, authenticated, public;

-- ════════════════════════════════════════════════════════════════════════════
-- credit_goal_external (replaces migration 074's version)
-- ════════════════════════════════════════════════════════════════════════════
-- Same external signature; new internal behavior. Caller (webhook) is
-- unchanged. The idempotency contract from the caller's perspective is the
-- same: "calling more than once for the same stripe_payment_intent_id is
-- safe and won't double-credit". What changes is HOW the function decides
-- already-handled vs needs-action:
--
--   Old (074):  any savings_transactions row for this PI → idempotent_replay.
--   New (076):  only a *completed* row counts as already-handled. A pending
--               row (inserted by record_pending_goal_deposit) is upgraded
--               to completed and the goal is credited.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.credit_goal_external(
  p_goal_id        UUID,
  p_amount_cents   BIGINT,
  p_fee_cents      BIGINT DEFAULT 0,
  p_source         TEXT   DEFAULT 'card',
  p_stripe_pi_id   TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_goal_owner           UUID;
  v_goal_balance_before  BIGINT;
  v_goal_balance_after   BIGINT;
  v_existing_id          UUID;
  v_existing_status      TEXT;
BEGIN
  -- ── Input validation ────────────────────────────────────────────────────
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_fee_cents IS NULL OR p_fee_cents < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fee must be non-negative');
  END IF;
  IF p_stripe_pi_id IS NULL OR length(p_stripe_pi_id) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stripe payment intent id is required');
  END IF;

  -- ── Pre-lock idempotency check ──────────────────────────────────────────
  -- Cheap exit for the common case (Stripe re-delivers a succeeded event
  -- that we already fully processed). Only completed rows count — a
  -- pending row needs the upgrade path below.
  SELECT id, transaction_status
    INTO v_existing_id, v_existing_status
  FROM public.savings_transactions
  WHERE stripe_payment_intent_id = p_stripe_pi_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_status = 'completed' THEN
    RETURN jsonb_build_object(
      'success',           true,
      'idempotent_replay', true,
      'transaction_id',    v_existing_id
    );
  END IF;

  -- ── Lock the goal row ───────────────────────────────────────────────────
  -- Serialises concurrent succeeded deliveries (rare but possible) and
  -- gives us a stable balance_before to record on the upgrade.
  SELECT user_id, current_balance_cents
    INTO v_goal_owner, v_goal_balance_before
  FROM public.user_savings_goals
  WHERE id = p_goal_id
  FOR UPDATE;

  IF v_goal_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
  END IF;

  -- ── Post-lock idempotency re-check ──────────────────────────────────────
  -- A concurrent caller may have completed the same PI between our
  -- pre-check and the lock acquisition. Re-read the row to find out.
  SELECT id, transaction_status
    INTO v_existing_id, v_existing_status
  FROM public.savings_transactions
  WHERE stripe_payment_intent_id = p_stripe_pi_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL AND v_existing_status = 'completed' THEN
    RETURN jsonb_build_object(
      'success',           true,
      'idempotent_replay', true,
      'transaction_id',    v_existing_id
    );
  END IF;

  v_goal_balance_after := v_goal_balance_before + p_amount_cents;

  -- ── Credit the goal ─────────────────────────────────────────────────────
  UPDATE public.user_savings_goals
     SET current_balance_cents = v_goal_balance_after,
         total_deposits_cents  = COALESCE(total_deposits_cents, 0) + p_amount_cents,
         last_deposit_at       = NOW(),
         updated_at            = NOW()
   WHERE id = p_goal_id;

  IF v_existing_id IS NOT NULL THEN
    -- ── Upgrade path: pending row exists ─────────────────────────────────
    -- Update it to completed with recomputed balance fields. The original
    -- pending row stored snapshot balance fields (Option A: both equal
    -- the goal balance at .processing time); the actual transition that
    -- the user sees in their feed should reflect the real before/after
    -- so we overwrite both. fee_cents is also refreshed in case the
    -- caller corrected it between .processing and .succeeded.
    UPDATE public.savings_transactions
       SET transaction_status   = 'completed',
           balance_before_cents = v_goal_balance_before,
           balance_after_cents  = v_goal_balance_after,
           fee_cents            = COALESCE(p_fee_cents, 0),
           metadata             = COALESCE(metadata, '{}'::jsonb)
                                  || jsonb_build_object('upgraded_from_pending', true)
     WHERE id = v_existing_id;
  ELSE
    -- ── Fresh path: no existing row ──────────────────────────────────────
    -- Cards (which skip .processing) and banks where .succeeded arrives
    -- before .processing land here.
    INSERT INTO public.savings_transactions (
      savings_goal_id, user_id, transaction_type, source,
      amount_cents, fee_cents,
      balance_before_cents, balance_after_cents,
      transaction_status, stripe_payment_intent_id,
      metadata
    ) VALUES (
      p_goal_id, v_goal_owner, 'deposit', p_source,
      p_amount_cents, p_fee_cents,
      v_goal_balance_before, v_goal_balance_after,
      'completed', p_stripe_pi_id,
      jsonb_build_object(
        'payment_method',   p_source,
        'fee_cents',        p_fee_cents,
        'external_deposit', true
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'success',            true,
    'goal_balance_cents', v_goal_balance_after
  );
END;
$$;

-- Re-state the grants. CREATE OR REPLACE FUNCTION preserves existing
-- privileges per the PG docs, but a fresh restatement is cheap insurance
-- against environment drift.
GRANT EXECUTE ON FUNCTION public.credit_goal_external(UUID, BIGINT, BIGINT, TEXT, TEXT)
  TO service_role;
REVOKE EXECUTE ON FUNCTION public.credit_goal_external(UUID, BIGINT, BIGINT, TEXT, TEXT)
  FROM anon, authenticated, public;

-- ════════════════════════════════════════════════════════════════════════════
-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '076',
  'pending_goal_deposits',
  ARRAY['-- 076: pending_goal_deposits (record_pending_goal_deposit + credit_goal_external upgrade path)']
)
ON CONFLICT (version) DO NOTHING;
