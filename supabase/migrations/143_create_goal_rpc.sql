-- =============================================================================
-- 143: create_goal RPC — atomic savings-goal creation
-- =============================================================================
-- Replaces the 3-round-trip prep+insert chain in
-- `hooks/useGoalActions.ts::createGoal` (savings_goal_types lookup +
-- user_wallets lookup + INSERT user_savings_goals).
--
-- Single SECURITY DEFINER transaction:
--   1. Resolve wallet_id from user_wallets (NOT NULL FK on goals).
--   2. Resolve savings_goal_type_id from the caller's savings_type code
--      ('flexible' | 'emergency' | 'locked').
--   3. INSERT user_savings_goals with all V2 fields the caller passes.
--   4. Return (goal_id, current_balance_cents, target_amount_cents).
--
-- The Express create flow (P1) calls this RPC; the legacy in-screen wizard
-- and post-V2 GoalCreateScreen also benefit from the cleanup.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_goal(
  p_name                       TEXT,
  p_target_amount_cents        BIGINT      DEFAULT NULL,
  p_savings_type               TEXT        DEFAULT 'flexible',
  p_emoji                      TEXT        DEFAULT NULL,
  p_category                   TEXT        DEFAULT NULL,
  p_goal_type                  TEXT        DEFAULT NULL,
  p_target_date                DATE        DEFAULT NULL,
  p_monthly_contribution_cents BIGINT      DEFAULT NULL,
  p_auto_deposit_enabled       BOOLEAN     DEFAULT FALSE,
  p_auto_deposit_day           INT         DEFAULT NULL,
  p_locked_until               DATE        DEFAULT NULL,
  p_lock_period_months         INT         DEFAULT NULL,
  p_linked_circle_id           UUID        DEFAULT NULL,
  p_circle_payout_action       TEXT        DEFAULT NULL,
  p_circle_payout_percent      INT         DEFAULT NULL
)
RETURNS TABLE (
  goal_id               UUID,
  current_balance_cents BIGINT,
  target_amount_cents   BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id     UUID;
  v_wallet_id   UUID;
  v_type_id     UUID;
  v_type_code   TEXT;
  v_goal_id     UUID;
BEGIN
  -- ── Auth ────────────────────────────────────────────────────────────────
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  -- ── Input validation ────────────────────────────────────────────────────
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF p_target_amount_cents IS NOT NULL AND p_target_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_target_amount';
  END IF;

  -- Normalise the savings_type code with a default fallback. Anything
  -- outside the known set falls back to 'general' (the existing live
  -- code for the no-lock tier) so a typo doesn't kill the create.
  v_type_code := CASE lower(COALESCE(p_savings_type, ''))
    WHEN 'flexible'  THEN 'general'
    WHEN 'general'   THEN 'general'
    WHEN 'emergency' THEN 'emergency'
    WHEN 'locked'    THEN 'locked'
    ELSE 'general'
  END;

  -- ── Resolve savings_goal_type_id (NOT NULL FK) ──────────────────────────
  SELECT id INTO v_type_id
  FROM public.savings_goal_types
  WHERE code = v_type_code
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'savings_goal_type_not_found';
  END IF;

  -- ── Resolve wallet_id (NOT NULL FK) ─────────────────────────────────────
  SELECT id INTO v_wallet_id
  FROM public.user_wallets
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'wallet_not_found';
  END IF;

  -- ── INSERT user_savings_goals ───────────────────────────────────────────
  -- Stored savings_type carries the V2 client value verbatim ('flexible' /
  -- 'emergency' / 'locked') so the screen can render correctly without a
  -- reverse mapping. The FK savings_goal_type_id carries the live code
  -- ('general' / 'emergency' / 'locked') so existing interest-accrual and
  -- penalty machinery keeps working.
  INSERT INTO public.user_savings_goals (
    user_id, wallet_id, savings_goal_type_id,
    name, target_amount_cents, target_date,
    current_balance_cents,
    emoji, goal_type, category, savings_type,
    monthly_contribution_cents,
    auto_deposit_enabled, auto_deposit_day,
    locked_until, lock_period_months,
    linked_circle_id, circle_payout_action, circle_payout_percent,
    goal_status
  )
  VALUES (
    v_user_id, v_wallet_id, v_type_id,
    trim(p_name), p_target_amount_cents, p_target_date,
    0,
    NULLIF(trim(p_emoji), ''), p_goal_type, p_category,
    COALESCE(NULLIF(p_savings_type, ''), 'flexible'),
    p_monthly_contribution_cents,
    COALESCE(p_auto_deposit_enabled, FALSE), p_auto_deposit_day,
    p_locked_until, p_lock_period_months,
    p_linked_circle_id, p_circle_payout_action, p_circle_payout_percent,
    'active'
  )
  RETURNING id INTO v_goal_id;

  RETURN QUERY
    SELECT v_goal_id, 0::BIGINT, p_target_amount_cents;
END;
$$;

REVOKE ALL ON FUNCTION public.create_goal(
  TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, DATE, BIGINT, BOOLEAN, INT, DATE, INT, UUID, TEXT, INT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_goal(
  TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, DATE, BIGINT, BOOLEAN, INT, DATE, INT, UUID, TEXT, INT
) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_goal(
  TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, DATE, BIGINT, BOOLEAN, INT, DATE, INT, UUID, TEXT, INT
) TO authenticated;

-- =============================================================================
-- Self-register
-- =============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '143',
  'create_goal_rpc',
  ARRAY['-- 143: create_goal_rpc']
)
ON CONFLICT (version) DO NOTHING;
