-- ════════════════════════════════════════════════════════════════════════════
-- 078: goal_milestones_check — auto-record threshold crossings + completion
-- ════════════════════════════════════════════════════════════════════════════
--
-- Whenever a goal's balance increases via wallet (transfer_to_goal, migration
-- 073) or via Stripe (credit_goal_external, migrations 074/076), check
-- whether any of the 10/25/50/75/90/100% milestones have been crossed for
-- the FIRST time and insert a goal_milestones row. At 100%, also flip
-- user_savings_goals.goal_status to 'completed' and stamp completed_at.
--
-- Architecture (per the planning discussion, Option B):
--   - One private helper RPC _record_goal_milestones(p_goal_id) holds the
--     percentage math. SECURITY DEFINER, search_path-pinned, executable
--     by service_role only (it's called from the other two SECURITY DEFINER
--     functions, which already run as the function owner).
--   - transfer_to_goal and credit_goal_external are CREATE OR REPLACE'd
--     verbatim with a single new line: a PERFORM call to the helper after
--     the goal balance UPDATE.
--   - Idempotency on goal_milestones: a fresh UNIQUE (goal_id,
--     milestone_percent) constraint + ON CONFLICT DO NOTHING. A user can
--     cross the same threshold twice (deposit, withdraw past, deposit
--     back above) and the original reached_at is preserved.
--
-- Schema decisions:
--   - Uses the EXISTING goal_milestones table shape (milestone_percent
--     INTEGER + celebrated BOOLEAN) — DO NOT match the original spec's
--     proposed shape (milestone_type TEXT + notified). The screen
--     GoalMilestonesScreen reads the existing shape; changing it would
--     break that screen.
--   - goal_status vocabulary expanded from {'active','closed'} to
--     {'active','closed','completed'}. No CHECK constraint on goal_status
--     today, so this is purely additive.
--
-- Withdrawal note:
--   The transfer_from_goal RPC (migration 073) is INTENTIONALLY not
--   modified. Withdrawing past a threshold doesn't un-achieve it; the
--   goal_milestones rows persist and goal_status stays 'completed' even
--   if balance drops back below 100%. This matches user-intuition for
--   "achievement"-style records.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Idempotency anchor on goal_milestones ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.goal_milestones'::regclass
      AND conname  = 'goal_milestones_goal_pct_unique'
  ) THEN
    ALTER TABLE public.goal_milestones
      ADD CONSTRAINT goal_milestones_goal_pct_unique
      UNIQUE (goal_id, milestone_percent);
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. _record_goal_milestones — shared helper (service_role only)
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._record_goal_milestones(p_goal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target     BIGINT;
  v_balance    BIGINT;
  v_threshold  INT;
  v_thresholds INT[] := ARRAY[10, 25, 50, 75, 90, 100];
BEGIN
  SELECT target_amount_cents, current_balance_cents
    INTO v_target, v_balance
  FROM public.user_savings_goals
  WHERE id = p_goal_id;

  -- No goal, no target, or zero target → nothing to compute. Silent return
  -- so callers don't have to branch on this edge case.
  IF v_target IS NULL OR v_target <= 0 OR v_balance IS NULL THEN
    RETURN;
  END IF;

  -- For each threshold, INSERT … ON CONFLICT DO NOTHING. Multiply-before-
  -- divide so we never lose precision to integer truncation.
  FOREACH v_threshold IN ARRAY v_thresholds LOOP
    IF v_balance * 100 >= v_threshold::BIGINT * v_target THEN
      INSERT INTO public.goal_milestones (goal_id, milestone_percent, reached_at)
      VALUES (p_goal_id, v_threshold, NOW())
      ON CONFLICT (goal_id, milestone_percent) DO NOTHING;
    END IF;
  END LOOP;

  -- 100%+ → mark goal completed. COALESCE preserves the original
  -- completed_at so a withdraw-and-redeposit cycle doesn't clobber the
  -- first-achievement timestamp. Conditional WHERE prevents redundant
  -- UPDATEs (and bumps to updated_at) once the goal is already completed.
  IF v_balance * 100 >= 100::BIGINT * v_target THEN
    UPDATE public.user_savings_goals
       SET goal_status  = 'completed',
           completed_at = COALESCE(completed_at, NOW()),
           updated_at   = NOW()
     WHERE id = p_goal_id
       AND goal_status <> 'completed';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public._record_goal_milestones(UUID)
  TO service_role;
REVOKE EXECUTE ON FUNCTION public._record_goal_milestones(UUID)
  FROM anon, authenticated, public;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. CREATE OR REPLACE transfer_to_goal (originally migration 073)
-- ════════════════════════════════════════════════════════════════════════════
-- Same body as 073. The only diff is the PERFORM call near the end. Comments
-- in the function are kept minimal because the canonical reference is the
-- 073 migration file; this restatement exists only to inject the helper
-- call without losing the function's other guarantees.
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

  SELECT user_id, current_balance_cents
    INTO v_goal_owner, v_goal_balance_before
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
  );

  -- ── Migration 078 addition ──────────────────────────────────────────────
  -- Run milestone detection AFTER the balance update so the helper reads
  -- the NEW balance. The helper may also flip goal_status to 'completed';
  -- because it COALESCEs completed_at and only UPDATEs when status changes,
  -- a re-run for an already-completed goal is a no-op.
  PERFORM public._record_goal_milestones(p_goal_id);

  RETURN jsonb_build_object(
    'success',              true,
    'goal_balance_cents',   v_goal_balance_after,
    'wallet_balance_cents', v_wallet_balance_before - p_amount_cents
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_to_goal(UUID, BIGINT)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.transfer_to_goal(UUID, BIGINT)
  FROM anon, public;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. CREATE OR REPLACE credit_goal_external (originally 074, updated 076)
-- ════════════════════════════════════════════════════════════════════════════
-- Same body as 076 plus the PERFORM call. Both branches (pending → completed
-- upgrade AND fresh insert) end with the milestone check.
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
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_fee_cents IS NULL OR p_fee_cents < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fee must be non-negative');
  END IF;
  IF p_stripe_pi_id IS NULL OR length(p_stripe_pi_id) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stripe payment intent id is required');
  END IF;

  -- Pre-lock idempotency check (only completed rows count).
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

  SELECT user_id, current_balance_cents
    INTO v_goal_owner, v_goal_balance_before
  FROM public.user_savings_goals
  WHERE id = p_goal_id
  FOR UPDATE;

  IF v_goal_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
  END IF;

  -- Post-lock idempotency re-check.
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

  UPDATE public.user_savings_goals
     SET current_balance_cents = v_goal_balance_after,
         total_deposits_cents  = COALESCE(total_deposits_cents, 0) + p_amount_cents,
         last_deposit_at       = NOW(),
         updated_at            = NOW()
   WHERE id = p_goal_id;

  IF v_existing_id IS NOT NULL THEN
    -- Upgrade path: pending → completed with recomputed balance fields.
    UPDATE public.savings_transactions
       SET transaction_status   = 'completed',
           balance_before_cents = v_goal_balance_before,
           balance_after_cents  = v_goal_balance_after,
           fee_cents            = COALESCE(p_fee_cents, 0),
           metadata             = COALESCE(metadata, '{}'::jsonb)
                                  || jsonb_build_object('upgraded_from_pending', true)
     WHERE id = v_existing_id;
  ELSE
    -- Fresh path: cards (no .processing) or banks where .succeeded arrived
    -- first.
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

  -- ── Migration 078 addition ──────────────────────────────────────────────
  -- Same as in transfer_to_goal. Runs once per call regardless of which
  -- branch above executed, since the goal balance UPDATE happened in both.
  PERFORM public._record_goal_milestones(p_goal_id);

  RETURN jsonb_build_object(
    'success',            true,
    'goal_balance_cents', v_goal_balance_after
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_goal_external(UUID, BIGINT, BIGINT, TEXT, TEXT)
  TO service_role;
REVOKE EXECUTE ON FUNCTION public.credit_goal_external(UUID, BIGINT, BIGINT, TEXT, TEXT)
  FROM anon, authenticated, public;

-- ════════════════════════════════════════════════════════════════════════════
-- Self-register
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '078',
  'goal_milestones_check',
  ARRAY['-- 078: goal_milestones_check (_record_goal_milestones helper + transfer_to_goal/credit_goal_external integration)']
)
ON CONFLICT (version) DO NOTHING;
