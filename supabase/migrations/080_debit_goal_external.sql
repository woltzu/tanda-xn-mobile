-- ============================================================================
-- Migration 080: debit_goal_external RPC
-- ============================================================================
-- Part of Option A: safe, partial support for external (bank/Stripe-payout)
-- goal withdrawals. This RPC will be called from a future Stripe payout
-- Edge Function (NOT from the client) to debit a savings goal and write
-- an audit row keyed by stripe_payout_id.
--
-- For now: no Edge Function calls this yet. It's a primitive ready to be
-- wired when bank withdrawals ship. Service-role only — GRANT/REVOKE
-- below ensures client roles cannot call it directly.
--
-- IDEMPOTENCY: keyed on stripe_payout_id. A duplicate Stripe webhook
-- delivery (same po_xxx) will find an existing savings_transactions row
-- and return { success: true, idempotent_replay: true } without touching
-- the goal balance again.
--
-- NOTE ON PARAMETER ORDER (deviation from spec):
-- The original Option A spec had p_fee_cents (with default 0) listed
-- BEFORE p_source and p_stripe_payout_id (both no default). PostgreSQL
-- requires parameters without defaults to come before parameters with
-- defaults, so that signature fails at CREATE FUNCTION with:
--   "input parameters after one with a default value must also have defaults"
-- We reorder: p_fee_cents (the only defaulted param) moved to last.
-- Callers using named-parameter syntax (Supabase RPC default) are
-- unaffected; positional callers would need to swap. No callers yet.
--
-- See: migration 079 (adds stripe_payout_id column).
-- ============================================================================

CREATE OR REPLACE FUNCTION debit_goal_external(
  p_goal_id UUID,
  p_amount_cents BIGINT,
  p_source TEXT,
  p_stripe_payout_id TEXT,
  p_fee_cents BIGINT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing_id UUID;
  v_user_id UUID;
  v_balance_before BIGINT;
  v_balance_after BIGINT;
BEGIN
  -- ── Idempotency check (Layer 1) ─────────────────────────────────────────
  -- If we've already processed this Stripe payout id, return early without
  -- touching the goal. Pairs with the UNIQUE constraint added in 079.
  SELECT id INTO v_existing_id
  FROM savings_transactions
  WHERE stripe_payout_id = p_stripe_payout_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'transaction_id', v_existing_id
    );
  END IF;

  -- ── Lock the goal row + read current balance ────────────────────────────
  SELECT user_id, current_balance_cents
    INTO v_user_id, v_balance_before
  FROM user_savings_goals
  WHERE id = p_goal_id
  FOR UPDATE;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'goal_not_found',
      'message', 'Savings goal does not exist.'
    );
  END IF;

  -- ── Sufficient-balance check ────────────────────────────────────────────
  IF v_balance_before < p_amount_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'insufficient_balance',
      'message', 'Goal balance is less than the requested withdrawal amount.',
      'balance_cents', v_balance_before,
      'requested_cents', p_amount_cents
    );
  END IF;

  -- ── Ownership / authorization ───────────────────────────────────────────
  -- Caller must be service_role (enforced by GRANT/REVOKE at bottom). If
  -- this is ever opened to authenticated callers, gate on
  -- v_user_id = auth.uid() before this point.

  -- ── Insert the pending transaction row ──────────────────────────────────
  INSERT INTO savings_transactions (
    savings_goal_id,
    user_id,
    transaction_type,
    source,
    amount_cents,
    fee_cents,
    stripe_payout_id,
    balance_before_cents,
    balance_after_cents,
    transaction_status,
    created_at
  )
  VALUES (
    p_goal_id,
    v_user_id,
    'withdrawal',
    p_source,
    p_amount_cents,
    p_fee_cents,
    p_stripe_payout_id,
    v_balance_before,
    v_balance_before - p_amount_cents,
    'pending',
    NOW()
  );

  -- ── Debit the goal ──────────────────────────────────────────────────────
  UPDATE user_savings_goals
  SET current_balance_cents = current_balance_cents - p_amount_cents,
      total_withdrawals_cents = COALESCE(total_withdrawals_cents, 0) + p_amount_cents,
      updated_at = NOW()
  WHERE id = p_goal_id
  RETURNING current_balance_cents INTO v_balance_after;

  RETURN jsonb_build_object(
    'success', true,
    'goal_balance_cents', v_balance_after,
    'balance_before_cents', v_balance_before
  );
END;
$$;

-- Service-role only. Anon/authenticated MUST NOT have direct access to a
-- function that debits a balance without a uid match.
REVOKE EXECUTE ON FUNCTION public.debit_goal_external(UUID, BIGINT, TEXT, TEXT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.debit_goal_external(UUID, BIGINT, TEXT, TEXT, BIGINT)
  TO service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('080', 'debit_goal_external', ARRAY['-- 080: debit_goal_external'])
ON CONFLICT (version) DO NOTHING;
