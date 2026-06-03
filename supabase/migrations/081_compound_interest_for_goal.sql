-- ============================================================================
-- Migration 081: compound_interest_for_goal RPC
-- ============================================================================
-- Makes accrued interest spendable by compounding daily interest into the
-- goal's current_balance_cents whenever a screen explicitly calls the RPC.
-- Currently wired into GoalDetailV2Screen's useFocusEffect so a fresh
-- balance is always shown.
--
-- Compounding model — daily, based on current balance (NOT simple interest
-- as the original spec comment suggested). Each call uses the locked
-- snapshot of current_balance_cents, which already includes any previously
-- credited interest, so calling daily for a year yields roughly
-- balance * (1 + apy/365)^365 ≈ balance * e^apy, NOT balance * (1 + apy).
-- Document this so future readers understand why the formula uses the
-- post-deposit balance.
--
-- Idempotency — keyed on whole calendar days since last_interest_accrual_at.
-- Re-calling within the same calendar day returns early with
-- reason='no_days_elapsed' without touching state. The "days elapsed"
-- calculation uses date-minus-date arithmetic, NOT EXTRACT(DAY FROM
-- interval) — the latter returns only the days component (e.g. 17 from
-- "2 years 3 months 17 days"), which would silently undercount for any
-- goal idle longer than a month.
--
-- Defensive — ADD COLUMN IF NOT EXISTS for every column we read or write.
-- Lets this migration run cleanly regardless of which prior
-- savings-tracking migrations have landed.
-- ============================================================================

-- ── Column safety net ───────────────────────────────────────────────────────
ALTER TABLE user_savings_goals
  ADD COLUMN IF NOT EXISTS apy NUMERIC DEFAULT 0;

ALTER TABLE user_savings_goals
  ADD COLUMN IF NOT EXISTS accrued_interest_cents BIGINT DEFAULT 0;

ALTER TABLE user_savings_goals
  ADD COLUMN IF NOT EXISTS total_interest_earned_cents BIGINT DEFAULT 0;

ALTER TABLE user_savings_goals
  ADD COLUMN IF NOT EXISTS last_interest_accrual_at TIMESTAMPTZ;

ALTER TABLE user_savings_goals
  ADD COLUMN IF NOT EXISTS goal_status TEXT DEFAULT 'active';

-- Backfill apy for existing goals based on savings_type. Only touches rows
-- where apy is currently null or zero (so any genuinely-customised APY is
-- preserved). 'locked' goals get a 1%/year bonus per lock-period year.
UPDATE user_savings_goals
SET apy = CASE
  WHEN savings_type = 'flexible' THEN 0
  WHEN savings_type = 'emergency' THEN 2
  WHEN savings_type = 'locked' THEN 4 + COALESCE(lock_period_months / 12.0, 0)
  ELSE 0
END
WHERE apy IS NULL OR apy = 0;

-- ── RPC: compound_interest_for_goal ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION compound_interest_for_goal(p_goal_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_goal RECORD;
  v_days INTEGER;
  v_interest_cents BIGINT;
  v_balance_before BIGINT;
  v_new_balance BIGINT;
BEGIN
  -- Lock the row + read everything we need in one shot. created_at is
  -- pulled so we can fall back to it if last_interest_accrual_at is null
  -- (a freshly created goal that has never been compounded).
  SELECT
    current_balance_cents,
    apy,
    last_interest_accrual_at,
    created_at,
    user_id
  INTO v_goal
  FROM user_savings_goals
  WHERE id = p_goal_id AND goal_status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'goal_not_found_or_inactive',
      'message', 'Goal does not exist or is not in active status.'
    );
  END IF;

  -- No balance → nothing to compound.
  IF v_goal.current_balance_cents <= 0 THEN
    RETURN jsonb_build_object('success', true, 'compounded', false, 'reason', 'zero_balance');
  END IF;

  -- Whole calendar days since last accrual. Date-minus-date is the
  -- canonical PostgreSQL idiom — returns an integer day count over the
  -- entire interval. EXTRACT(DAY FROM interval) would only return the
  -- days COMPONENT (e.g. 17 from "2 years 3 months 17 days"), which is
  -- the bug the original spec had.
  v_days := (NOW()::date - COALESCE(v_goal.last_interest_accrual_at, v_goal.created_at)::date);
  IF v_days <= 0 THEN
    RETURN jsonb_build_object('success', true, 'compounded', false, 'reason', 'no_days_elapsed');
  END IF;

  -- Daily compounding (not simple interest, despite the original spec
  -- comment): the formula uses the CURRENT balance, which already
  -- includes any previously credited interest. Calling daily for a year
  -- approximates balance * e^apy, not balance * (1 + apy).
  v_interest_cents := FLOOR(v_goal.current_balance_cents * v_goal.apy / 100 / 365 * v_days);
  IF v_interest_cents = 0 THEN
    RETURN jsonb_build_object('success', true, 'compounded', false, 'reason', 'interest_too_small');
  END IF;

  v_balance_before := v_goal.current_balance_cents;

  -- Credit the interest to the goal balance. Reset accrued_interest_cents
  -- to zero (the running pre-compound tally is now realised) and stamp
  -- last_interest_accrual_at so subsequent same-day calls short-circuit.
  UPDATE user_savings_goals
  SET current_balance_cents = current_balance_cents + v_interest_cents,
      accrued_interest_cents = 0,
      total_interest_earned_cents = COALESCE(total_interest_earned_cents, 0) + v_interest_cents,
      last_interest_accrual_at = NOW(),
      updated_at = NOW()
  WHERE id = p_goal_id
  RETURNING current_balance_cents INTO v_new_balance;

  -- Audit row for the interest credit. Mirrors the column set used by
  -- transfer_to_goal / credit_goal_external for consistency. Assumes
  -- savings_transactions.transaction_type accepts 'interest' — if a
  -- CHECK constraint rejects it, the first compound call will surface
  -- the error and the constraint can be widened.
  INSERT INTO savings_transactions (
    savings_goal_id,
    user_id,
    transaction_type,
    source,
    amount_cents,
    balance_before_cents,
    balance_after_cents,
    transaction_status,
    created_at
  )
  VALUES (
    p_goal_id,
    v_goal.user_id,
    'interest',
    'system',
    v_interest_cents,
    v_balance_before,
    v_new_balance,
    'completed',
    NOW()
  );

  -- Trigger milestone detection. Interest income can push the goal across
  -- a threshold (e.g. 49% → 50%). Mirrors what transfer_to_goal and
  -- credit_goal_external do for deposit paths — interest shouldn't be a
  -- second-class money-in path that silently misses milestone awards.
  PERFORM _record_goal_milestones(p_goal_id);

  RETURN jsonb_build_object(
    'success', true,
    'compounded', true,
    'interest_cents', v_interest_cents,
    'days_compounded', v_days,
    'new_balance_cents', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compound_interest_for_goal(UUID)
  TO authenticated, service_role;

-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('081', 'compound_interest_for_goal', ARRAY['-- 081: compound_interest_for_goal'])
ON CONFLICT (version) DO NOTHING;
