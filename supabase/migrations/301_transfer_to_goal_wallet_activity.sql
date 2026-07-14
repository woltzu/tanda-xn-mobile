-- ═══════════════════════════════════════════════════════════════════════════
-- 301_transfer_to_goal_wallet_activity.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix: wallet -> goal deposits didn't appear in the Home Recent Activity
-- feed. transfer_to_goal (migration 078) wrote a savings_transactions row
-- but never touched wallet_transactions, and useRecentActivity reads
-- wallet_transactions for the ledger portion of its feed. Users saw the
-- milestone celebration land but not the deposit that triggered it.
--
-- This migration redefines transfer_to_goal so the successful debit
-- side-effect also writes a wallet_transactions row, matching the shape
-- useRecentActivity understands:
--
--   transaction_type = 'goal_deposit'
--   direction        = 'debit'
--   amount_cents     = -p_amount_cents      (negative → hook renders as
--                                            an "out" row, matching the
--                                            circle-contribution rendering)
--   balance_type     = 'main'
--   balance_before/after_cents from v_wallet_balance_before ± delta
--   reference_type   = 'goal'
--   reference_id     = p_goal_id
--   description      = 'Deposited $N.NN to {goal_name}'
--   metadata         = { goal_id, goal_name, savings_transaction_id }
--
-- Isolation guarantee: the wallet_transactions insert lives inside its own
-- BEGIN … EXCEPTION WHEN OTHERS THEN … END sub-block. A failure there is
-- logged and swallowed so the wallet debit + goal credit + savings_
-- transactions row that already committed above still stand. Same
-- philosophy as _record_goal_milestones — never fail the money-move for
-- a downstream cosmetic write.
--
-- Everything above the new insert is byte-identical to migration 078's
-- body except for adding `name` to the goal SELECT (needed for the
-- description). CREATE OR REPLACE overwrites the deployed function.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.transfer_to_goal(
  p_goal_id      UUID,
  p_amount_cents BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid                   UUID := auth.uid();
  v_wallet_id             UUID;
  v_wallet_balance_before BIGINT;
  v_goal_balance_before   BIGINT;
  v_goal_balance_after    BIGINT;
  v_goal_owner            UUID;
  v_goal_name             TEXT;
  v_savings_txn_id        UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  SELECT id, main_balance_cents
    INTO v_wallet_id, v_wallet_balance_before
  FROM public.user_wallets
  WHERE user_id = v_uid
  LIMIT 1
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No wallet found for user');
  END IF;
  IF v_wallet_balance_before < p_amount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
  END IF;

  SELECT user_id, current_balance_cents, name
    INTO v_goal_owner, v_goal_balance_before, v_goal_name
  FROM public.user_savings_goals
  WHERE id = p_goal_id
  FOR UPDATE;

  IF v_goal_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
  END IF;
  IF v_goal_owner <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal does not belong to user');
  END IF;

  v_goal_balance_after := v_goal_balance_before + p_amount_cents;

  UPDATE public.user_wallets
     SET main_balance_cents = main_balance_cents - p_amount_cents,
         updated_at         = NOW()
   WHERE id = v_wallet_id;

  UPDATE public.user_savings_goals
     SET current_balance_cents = v_goal_balance_after,
         total_deposits_cents  = COALESCE(total_deposits_cents, 0) + p_amount_cents,
         last_deposit_at       = NOW(),
         updated_at            = NOW()
   WHERE id = p_goal_id;

  INSERT INTO public.savings_transactions (
    savings_goal_id, user_id, transaction_type, source,
    amount_cents, balance_before_cents, balance_after_cents,
    transaction_status
  ) VALUES (
    p_goal_id, v_uid, 'deposit', 'wallet',
    p_amount_cents, v_goal_balance_before, v_goal_balance_after,
    'completed'
  )
  RETURNING id INTO v_savings_txn_id;

  -- ── Home activity-feed row (migration 301) ────────────────────────────
  -- Mirror this debit into wallet_transactions so useRecentActivity picks
  -- it up. See the docblock at the top of this file for schema mapping.
  -- Wrapped so a failure here (RLS drift, missing column) never rolls
  -- back the money-move above.
  BEGIN
    INSERT INTO public.wallet_transactions (
      wallet_id, user_id,
      transaction_type, direction,
      amount_cents,
      balance_type,
      balance_before_cents, balance_after_cents,
      reference_type, reference_id,
      description, transaction_status,
      metadata
    ) VALUES (
      v_wallet_id, v_uid,
      'goal_deposit', 'debit',
      -p_amount_cents,
      'main',
      v_wallet_balance_before,
      v_wallet_balance_before - p_amount_cents,
      'goal', p_goal_id,
      'Deposited $' || to_char(p_amount_cents::NUMERIC / 100, 'FM999999999990.00')
        || ' to ' || COALESCE(v_goal_name, 'your goal'),
      'completed',
      jsonb_build_object(
        'goal_id', p_goal_id,
        'goal_name', v_goal_name,
        'savings_transaction_id', v_savings_txn_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '[transfer_to_goal] wallet_transactions insert silenced for goal %: %',
                 p_goal_id, SQLERRM;
  END;

  -- Milestone detection (already bulletproofed by migration 294's outer
  -- EXCEPTION wrapper — never fails the enclosing transaction).
  PERFORM public._record_goal_milestones(p_goal_id);

  RETURN jsonb_build_object(
    'success',              true,
    'goal_balance_cents',   v_goal_balance_after,
    'wallet_balance_cents', v_wallet_balance_before - p_amount_cents
  );
END;
$$;

-- Preserve the existing GRANTs (migration 078 already sets these but a
-- CREATE OR REPLACE can drop them on some Postgres versions — being
-- explicit here keeps client callers working).
GRANT EXECUTE ON FUNCTION public.transfer_to_goal(UUID, BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_to_goal(UUID, BIGINT) FROM anon, public;

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '301',
  'transfer_to_goal_wallet_activity',
  ARRAY['-- 301: transfer_to_goal also inserts a wallet_transactions row for the Home activity feed']
)
ON CONFLICT (version) DO NOTHING;
