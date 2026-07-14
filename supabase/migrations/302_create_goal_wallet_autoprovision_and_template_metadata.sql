-- ═══════════════════════════════════════════════════════════════════════════
-- 302_create_goal_wallet_autoprovision_and_template_metadata.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Two fixes to public.create_goal (originally migration 143):
--
-- 1. Auto-provision a user_wallets row when the caller doesn't have one.
--    The prior body raised 'wallet_not_found' if the lookup came up empty,
--    which stranded 7 existing users in prod — they couldn't create any
--    goal at all because the "wallet_id NOT NULL FK" bar could never be
--    cleared. Wallets are cheap and a user with a goal is exactly the
--    kind of user we want to hand a wallet to unconditionally, so the
--    new body inserts a zero-balance wallet on first goal creation.
--
-- 2. Accept p_template_id and, when present, copy the goal_templates row's
--    `milestones` + `cost_breakdown` JSONB into user_savings_goals.metadata
--    under keys `template_id`, `template_milestones`, `template_cost_breakdown`,
--    `template_name`. The client's Milestones screen keys off these to
--    render custom stage rows (Foundation 30% / Walls 25% / …) instead of
--    the generic 10/25/50/75/90/100 arc.
--
-- Signature change: adds p_template_id UUID as the 16th param. The old
-- 15-arg overload is DROPped so PostgREST doesn't route to the stale
-- version — callers must pass the new column via useGoalActions.createGoal.
-- ═══════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_goal(
  TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, DATE, BIGINT, BOOLEAN, INT, DATE, INT, UUID, TEXT, INT
);

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
  p_circle_payout_percent      INT         DEFAULT NULL,
  p_template_id                UUID        DEFAULT NULL
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
  v_user_id            UUID;
  v_wallet_id          UUID;
  v_type_id            UUID;
  v_type_code          TEXT;
  v_goal_id            UUID;
  v_template_row       RECORD;
  v_metadata           JSONB := '{}'::jsonb;
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

  -- Normalise the savings_type code with a default fallback.
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

  -- ── Resolve wallet_id — auto-provision on first goal ────────────────────
  -- The prior version raised 'wallet_not_found' here, but that left the
  -- user unable to create ANY goal until an admin (or another flow) had
  -- inserted a wallet row for them. Auto-create instead. All non-user_id
  -- columns have defaults (main_balance_cents=0, wallet_status='active').
  SELECT id INTO v_wallet_id
  FROM public.user_wallets
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_wallet_id IS NULL THEN
    INSERT INTO public.user_wallets (user_id)
    VALUES (v_user_id)
    RETURNING id INTO v_wallet_id;
  END IF;

  -- ── Copy template metadata (optional) ───────────────────────────────────
  -- Store the raw milestones + cost_breakdown JSONB the template was
  -- built with. The Milestones screen keys off these fields to render
  -- custom stage rows (Foundation 30% / Walls 25% / etc.) instead of
  -- the default 10/25/50/75/90/100 arc.
  IF p_template_id IS NOT NULL THEN
    SELECT id, name, milestones, cost_breakdown
      INTO v_template_row
    FROM public.goal_templates
    WHERE id = p_template_id
      AND is_active = TRUE
    LIMIT 1;

    IF v_template_row.id IS NOT NULL THEN
      v_metadata := jsonb_build_object(
        'template_id',             v_template_row.id,
        'template_name',           v_template_row.name,
        'template_milestones',     v_template_row.milestones,
        'template_cost_breakdown', v_template_row.cost_breakdown
      );
    END IF;
    -- Unknown / inactive template_id is silently ignored — the user just
    -- gets a goal without the template metadata. Non-fatal.
  END IF;

  -- ── INSERT user_savings_goals ───────────────────────────────────────────
  INSERT INTO public.user_savings_goals (
    user_id, wallet_id, savings_goal_type_id,
    name, target_amount_cents, target_date,
    current_balance_cents,
    emoji, goal_type, category, savings_type,
    monthly_contribution_cents,
    auto_deposit_enabled, auto_deposit_day,
    locked_until, lock_period_months,
    linked_circle_id, circle_payout_action, circle_payout_percent,
    goal_status,
    metadata
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
    'active',
    v_metadata
  )
  RETURNING id INTO v_goal_id;

  RETURN QUERY
    SELECT v_goal_id, 0::BIGINT, p_target_amount_cents;
END;
$$;

-- Preserve grants.
REVOKE ALL ON FUNCTION public.create_goal(
  TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, DATE, BIGINT, BOOLEAN, INT, DATE, INT, UUID, TEXT, INT, UUID
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_goal(
  TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, DATE, BIGINT, BOOLEAN, INT, DATE, INT, UUID, TEXT, INT, UUID
) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_goal(
  TEXT, BIGINT, TEXT, TEXT, TEXT, TEXT, DATE, BIGINT, BOOLEAN, INT, DATE, INT, UUID, TEXT, INT, UUID
) TO authenticated;

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '302',
  'create_goal_wallet_autoprovision_and_template_metadata',
  ARRAY['-- 302: create_goal auto-provisions wallet + copies template metadata']
)
ON CONFLICT (version) DO NOTHING;
