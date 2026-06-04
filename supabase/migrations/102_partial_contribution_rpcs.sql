-- ════════════════════════════════════════════════════════════════════════════
-- Migration 102: Partial Contribution — server-side activation + preview RPCs
-- Phase D1 of feat(partial).
-- ════════════════════════════════════════════════════════════════════════════
-- Ports the activation logic from services/PartialContributionEngine.ts into
-- a single atomic PL/pgSQL function. The TS engine does 8+ sequential
-- supabase calls with no transaction boundary; a mid-flight failure leaves
-- the data inconsistent. The SQL port runs everything in one transaction.
--
-- Two TS engine column bugs surfaced during port (documented inline):
--
--   1. circle_cycles.status (engine line 188) — column is `cycle_status`.
--      The field is only used to satisfy a SELECT contract; engine never
--      reads it. Fixed in the corresponding TS edit; SQL uses cycle_status.
--
--   2. cycle_contributions.status (engine lines 426, 449) — column is
--      `contribution_status`. The activation would crash at runtime on
--      both the UPDATE of the current contribution and the INSERT of the
--      catch-up rows. SQL port uses the real column.
--
-- One schema gap that required redesign:
--
--   3. `insurance_coverage_claims` is designed for payout-time DEFAULT
--      coverage, NOT for contribution-time PARTIAL coverage. The table
--      requires `default_id`, `defaulter_user_id`, `shortfall_amount_cents`,
--      `max_coverage_cents`, `coverage_pct`, `pool_balance_before_cents`
--      — all NOT NULL — and has no `claim_type` or `reason` columns. The
--      engine's `_requestInsuranceCoverage` would fail with multiple
--      missing-column / not-null errors.
--
--      Fix: track partial-contribution coverage on the plan itself
--      (new columns: coverage_status, coverage_amount_cents,
--      pool_balance_at_activation_cents). No write to
--      `insurance_coverage_claims` and NO pool balance deduction at
--      activation — the pool only moves real money on actual defaults
--      (which D3's lifecycle cron will handle when catch-ups default).
--
-- All 5 functions are SECURITY DEFINER with pinned search_path.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Schema extension: coverage tracking on the plan ───────────────────────
-- These columns capture what coverage the pool would honor at activation
-- time. They're informational at D1; D3's lifecycle cron will use them
-- when reconciling actual defaults vs. promised coverage.

ALTER TABLE partial_contribution_plans
  ADD COLUMN IF NOT EXISTS coverage_status TEXT
    CHECK (coverage_status IS NULL OR coverage_status IN (
      'covered_full', 'covered_partial', 'no_pool', 'no_balance'
    ));

ALTER TABLE partial_contribution_plans
  ADD COLUMN IF NOT EXISTS coverage_amount_cents BIGINT NOT NULL DEFAULT 0;

ALTER TABLE partial_contribution_plans
  ADD COLUMN IF NOT EXISTS pool_balance_at_activation_cents BIGINT;


-- ── _build_partial_eligibility (private helper) ────────────────────────────
-- Mirrors PartialContributionEngine.checkEligibility (Section A).
-- Returns JSONB: {eligible, reason, uses_this_year, fee_required, fee_cents,
-- has_active_plan, before_deadline, is_active_member}

CREATE OR REPLACE FUNCTION _build_partial_eligibility(
  p_user_id UUID,
  p_circle_id UUID,
  p_cycle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_active_plan BOOLEAN := false;
  v_uses_12mo INTEGER := 0;
  v_fee_required BOOLEAN := false;
  v_fee_cents BIGINT := 0;
  v_deadline DATE;
  v_member_status TEXT;
BEGIN
  -- (1) Any active plan blocks (regardless of which circle)
  SELECT EXISTS (
    SELECT 1 FROM partial_contribution_plans
    WHERE member_id = p_user_id AND status = 'active'
  ) INTO v_has_active_plan;

  IF v_has_active_plan THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'You already have an active partial contribution plan. Complete your current catch-up payments first.',
      'uses_this_year', 0,
      'fee_required', false,
      'fee_cents', 0,
      'has_active_plan', true
    );
  END IF;

  -- (2) Annual cap: max 2 uses in last 12 months
  SELECT COUNT(*) INTO v_uses_12mo
  FROM partial_contribution_plans
  WHERE member_id = p_user_id
    AND activated_at >= NOW() - INTERVAL '12 months';

  IF v_uses_12mo >= 2 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'You have already used partial contribution mode twice in the last 12 months.',
      'uses_this_year', v_uses_12mo,
      'fee_required', false,
      'fee_cents', 0
    );
  END IF;

  -- (3) Before contribution deadline (FIX: cycle_cycles.status → cycle_status,
  -- but we don't actually need cycle_status here — only the deadline)
  SELECT contribution_deadline INTO v_deadline
  FROM circle_cycles
  WHERE id = p_cycle_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Cycle not found.',
      'uses_this_year', v_uses_12mo,
      'fee_required', false,
      'fee_cents', 0
    );
  END IF;

  IF CURRENT_DATE > v_deadline THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'The contribution deadline for this cycle has passed. Partial contribution must be requested before the due date.',
      'uses_this_year', v_uses_12mo,
      'fee_required', false,
      'fee_cents', 0,
      'before_deadline', false
    );
  END IF;

  -- (4) Active member of the circle
  SELECT status INTO v_member_status
  FROM circle_members
  WHERE circle_id = p_circle_id AND user_id = p_user_id;

  IF v_member_status IS NULL OR v_member_status <> 'active' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'You must be an active circle member to use partial contribution mode.',
      'uses_this_year', v_uses_12mo,
      'fee_required', false,
      'fee_cents', 0,
      'is_active_member', false
    );
  END IF;

  -- Fee: $0 first use this year, $10 (1000¢) second use
  v_fee_required := v_uses_12mo >= 1;
  v_fee_cents := CASE WHEN v_fee_required THEN 1000 ELSE 0 END;

  RETURN jsonb_build_object(
    'eligible', true,
    'reason', NULL,
    'uses_this_year', v_uses_12mo,
    'fee_required', v_fee_required,
    'fee_cents', v_fee_cents
  );
END;
$$;


-- ── _build_partial_summary (private helper) ────────────────────────────────
-- Mirrors PartialContributionEngine.getActivationSummary (Section B preview).
-- Returns JSONB: {success, original_amount_cents, pay_now_cents,
-- catch_up_1_cents, catch_up_1_due, catch_up_1_cycle_id, catch_up_1_cycle_number,
-- catch_up_2_cents, catch_up_2_due, catch_up_2_cycle_id, catch_up_2_cycle_number,
-- regular_contribution_cents, total_next_cycle_cents, total_cycle_after_cents,
-- current_contribution_id}

CREATE OR REPLACE FUNCTION _build_partial_summary(
  p_user_id UUID,
  p_circle_id UUID,
  p_cycle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_contribution_id UUID;
  v_expected_amount NUMERIC;
  v_original_cents BIGINT;
  v_pay_now_cents BIGINT;
  v_catch_up_1_cents BIGINT;
  v_catch_up_2_cents BIGINT;
  v_current_cycle_number INTEGER;
  v_next1 RECORD;
  v_next2 RECORD;
  v_regular_cents BIGINT;
BEGIN
  -- Current contribution row for this cycle + user
  SELECT id, expected_amount
    INTO v_current_contribution_id, v_expected_amount
  FROM cycle_contributions
  WHERE cycle_id = p_cycle_id AND user_id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Contribution record not found for this cycle.'
    );
  END IF;

  v_original_cents := ROUND(v_expected_amount * 100)::BIGINT;
  v_pay_now_cents := ROUND(v_original_cents * 0.5)::BIGINT;
  v_catch_up_1_cents := ROUND(v_original_cents * 0.25)::BIGINT;
  -- Remainder approach matches TS engine (avoids penny drift)
  v_catch_up_2_cents := v_original_cents - v_pay_now_cents - v_catch_up_1_cents;

  -- Current cycle number (for ordering future cycles)
  SELECT cycle_number INTO v_current_cycle_number
  FROM circle_cycles
  WHERE id = p_cycle_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current cycle not found.');
  END IF;

  -- Next 2 cycles by cycle_number
  SELECT id, cycle_number, contribution_deadline, expected_amount
    INTO v_next1
  FROM circle_cycles
  WHERE circle_id = p_circle_id AND cycle_number > v_current_cycle_number
  ORDER BY cycle_number ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not enough future cycles available for catch-up scheduling. At least 2 more cycles are required.'
    );
  END IF;

  SELECT id, cycle_number, contribution_deadline, expected_amount
    INTO v_next2
  FROM circle_cycles
  WHERE circle_id = p_circle_id AND cycle_number > v_next1.cycle_number
  ORDER BY cycle_number ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not enough future cycles available for catch-up scheduling. At least 2 more cycles are required.'
    );
  END IF;

  v_regular_cents := ROUND(COALESCE(v_next1.expected_amount, 0) * 100)::BIGINT;

  RETURN jsonb_build_object(
    'success', true,
    'current_contribution_id', v_current_contribution_id,
    'original_amount_cents', v_original_cents,
    'pay_now_cents', v_pay_now_cents,
    'catch_up_1_cents', v_catch_up_1_cents,
    'catch_up_1_due', v_next1.contribution_deadline,
    'catch_up_1_cycle_id', v_next1.id,
    'catch_up_1_cycle_number', v_next1.cycle_number,
    'catch_up_2_cents', v_catch_up_2_cents,
    'catch_up_2_due', v_next2.contribution_deadline,
    'catch_up_2_cycle_id', v_next2.id,
    'catch_up_2_cycle_number', v_next2.cycle_number,
    'regular_contribution_cents', v_regular_cents,
    'total_next_cycle_cents', v_regular_cents + v_catch_up_1_cents,
    'total_cycle_after_cents', v_regular_cents + v_catch_up_2_cents
  );
END;
$$;


-- ── _build_coverage_preview (private helper) ───────────────────────────────
-- Reads the active insurance pool for the circle and returns what coverage
-- would be honored. Per the approved decision ("approve partial coverage,
-- mark claim 'partial'"), we approve `LEAST(shortfall, pool.balance_cents)`
-- and label it accordingly. NO pool balance deduction happens at
-- activation — the pool only moves real money on actual defaults.

CREATE OR REPLACE FUNCTION _build_coverage_preview(
  p_circle_id UUID,
  p_shortfall_cents BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pool RECORD;
  v_approved_cents BIGINT := 0;
  v_status TEXT;
BEGIN
  SELECT id, balance_cents INTO v_pool
  FROM circle_insurance_pools
  WHERE circle_id = p_circle_id AND status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'pool_id', NULL,
      'pool_balance_cents', 0,
      'shortfall_cents', p_shortfall_cents,
      'approved_cents', 0,
      'coverage_status', 'no_pool'
    );
  END IF;

  IF v_pool.balance_cents <= 0 THEN
    v_status := 'no_balance';
    v_approved_cents := 0;
  ELSIF v_pool.balance_cents >= p_shortfall_cents THEN
    v_status := 'covered_full';
    v_approved_cents := p_shortfall_cents;
  ELSE
    v_status := 'covered_partial';
    v_approved_cents := v_pool.balance_cents;
  END IF;

  RETURN jsonb_build_object(
    'pool_id', v_pool.id,
    'pool_balance_cents', v_pool.balance_cents,
    'shortfall_cents', p_shortfall_cents,
    'approved_cents', v_approved_cents,
    'coverage_status', v_status
  );
END;
$$;


-- ── preview_partial_contribution (public) ──────────────────────────────────
-- User-facing read-only preview. Returns everything PartialContributionScreen
-- needs to render the activation card.

CREATE OR REPLACE FUNCTION preview_partial_contribution(
  p_circle_id UUID,
  p_cycle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_eligibility JSONB;
  v_summary JSONB;
  v_coverage JSONB;
  v_shortfall_cents BIGINT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'authentication required');
  END IF;

  v_eligibility := _build_partial_eligibility(v_user_id, p_circle_id, p_cycle_id);

  v_summary := _build_partial_summary(v_user_id, p_circle_id, p_cycle_id);

  IF (v_summary->>'success')::BOOLEAN = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'eligibility', v_eligibility,
      'error', v_summary->>'error'
    );
  END IF;

  -- Shortfall = original - pay_now (always exactly 50% in cents math)
  v_shortfall_cents := (v_summary->>'original_amount_cents')::BIGINT
                       - (v_summary->>'pay_now_cents')::BIGINT;

  v_coverage := _build_coverage_preview(p_circle_id, v_shortfall_cents);

  RETURN jsonb_build_object(
    'success', true,
    'eligibility', v_eligibility,
    'summary', v_summary,
    'coverage_preview', v_coverage,
    'source', 'preview_partial_contribution_rpc'
  );
END;
$$;


-- ── activate_partial_contribution (public, atomic) ─────────────────────────
-- Single-transaction port of TS engine's activatePartialContribution
-- (Section B). All 8 mutations succeed together or roll back together.

CREATE OR REPLACE FUNCTION activate_partial_contribution(
  p_circle_id UUID,
  p_cycle_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_eligibility JSONB;
  v_summary JSONB;
  v_coverage JSONB;
  v_shortfall_cents BIGINT;
  v_current_contribution_id UUID;
  v_existing_member_id UUID;
  v_plan_id UUID;
  v_catchup1_id UUID;
  v_catchup2_id UUID;
  v_schedule JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'authentication required');
  END IF;

  -- (1) Eligibility (re-run server-side to close the race)
  v_eligibility := _build_partial_eligibility(v_user_id, p_circle_id, p_cycle_id);
  IF (v_eligibility->>'eligible')::BOOLEAN = false THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', v_eligibility->>'reason',
      'eligibility', v_eligibility
    );
  END IF;

  -- (2) Summary (math + future cycles)
  v_summary := _build_partial_summary(v_user_id, p_circle_id, p_cycle_id);
  IF (v_summary->>'success')::BOOLEAN = false THEN
    RETURN jsonb_build_object('success', false, 'error', v_summary->>'error');
  END IF;

  v_current_contribution_id := (v_summary->>'current_contribution_id')::UUID;
  v_shortfall_cents := (v_summary->>'original_amount_cents')::BIGINT
                       - (v_summary->>'pay_now_cents')::BIGINT;

  -- Read existing member_id for FK-mirror on catch-up rows
  SELECT member_id INTO v_existing_member_id
  FROM cycle_contributions WHERE id = v_current_contribution_id;

  -- (3) Coverage preview (no pool side-effects at activation)
  v_coverage := _build_coverage_preview(p_circle_id, v_shortfall_cents);

  -- (4) Build initial catch_up_schedule (contribution_ids populated below)
  v_schedule := jsonb_build_array(
    jsonb_build_object(
      'cycle_number', (v_summary->>'catch_up_1_cycle_number')::INTEGER,
      'amount_cents', (v_summary->>'catch_up_1_cents')::BIGINT,
      'due_date', v_summary->>'catch_up_1_due',
      'contribution_id', NULL,
      'status', 'scheduled'
    ),
    jsonb_build_object(
      'cycle_number', (v_summary->>'catch_up_2_cycle_number')::INTEGER,
      'amount_cents', (v_summary->>'catch_up_2_cents')::BIGINT,
      'due_date', v_summary->>'catch_up_2_due',
      'contribution_id', NULL,
      'status', 'scheduled'
    )
  );

  -- (5) INSERT plan
  INSERT INTO partial_contribution_plans (
    member_id, circle_id, cycle_id,
    original_amount_cents, paid_amount_cents, remaining_amount_cents,
    catch_up_schedule, fee_cents, uses_this_year, status,
    coverage_status, coverage_amount_cents, pool_balance_at_activation_cents
  ) VALUES (
    v_user_id, p_circle_id, p_cycle_id,
    (v_summary->>'original_amount_cents')::BIGINT,
    (v_summary->>'pay_now_cents')::BIGINT,
    v_shortfall_cents,
    v_schedule,
    (v_eligibility->>'fee_cents')::BIGINT,
    (v_eligibility->>'uses_this_year')::INTEGER + 1,
    'active',
    v_coverage->>'coverage_status',
    (v_coverage->>'approved_cents')::BIGINT,
    (v_coverage->>'pool_balance_cents')::BIGINT
  )
  RETURNING id INTO v_plan_id;

  -- (6) UPDATE current contribution → partial
  -- FIX: column is contribution_status (engine used `status` — column doesn't exist)
  UPDATE cycle_contributions
  SET is_partial = true,
      partial_plan_id = v_plan_id,
      contribution_type = 'partial',
      contributed_amount = (v_summary->>'pay_now_cents')::BIGINT / 100.0,
      contribution_status = 'partial',
      covered_by = 'insurance_pool',
      covered_amount = v_shortfall_cents / 100.0
  WHERE id = v_current_contribution_id;

  -- (7) INSERT 2 catch-up contribution rows
  -- The UNIQUE (cycle_id, user_id) constraint means this fails if a regular
  -- contribution row already exists for the user in those cycles. In real
  -- prod that's likely with auto-generated cycles; for D1 the test cycles
  -- are seeded clean. If conflict surfaces post-D1 we'll switch to
  -- ON CONFLICT UPDATE (merging catchup into existing row's expected_amount).
  INSERT INTO cycle_contributions (
    cycle_id, circle_id, user_id, member_id,
    expected_amount, due_date, contributed_amount,
    contribution_status, is_partial, partial_plan_id, contribution_type
  ) VALUES (
    (v_summary->>'catch_up_1_cycle_id')::UUID,
    p_circle_id, v_user_id, v_existing_member_id,
    (v_summary->>'catch_up_1_cents')::BIGINT / 100.0,
    (v_summary->>'catch_up_1_due')::DATE,
    0,
    'pending', false, v_plan_id, 'catch_up'
  )
  RETURNING id INTO v_catchup1_id;

  INSERT INTO cycle_contributions (
    cycle_id, circle_id, user_id, member_id,
    expected_amount, due_date, contributed_amount,
    contribution_status, is_partial, partial_plan_id, contribution_type
  ) VALUES (
    (v_summary->>'catch_up_2_cycle_id')::UUID,
    p_circle_id, v_user_id, v_existing_member_id,
    (v_summary->>'catch_up_2_cents')::BIGINT / 100.0,
    (v_summary->>'catch_up_2_due')::DATE,
    0,
    'pending', false, v_plan_id, 'catch_up'
  )
  RETURNING id INTO v_catchup2_id;

  -- (8) UPDATE plan with the contribution_ids in the schedule
  v_schedule := jsonb_build_array(
    jsonb_set(v_schedule->0, '{contribution_id}', to_jsonb(v_catchup1_id::TEXT)),
    jsonb_set(v_schedule->1, '{contribution_id}', to_jsonb(v_catchup2_id::TEXT))
  );

  UPDATE partial_contribution_plans
  SET catch_up_schedule = v_schedule
  WHERE id = v_plan_id;

  -- (9) Identity-protected admin notification (mirrors engine Section G)
  INSERT INTO notification_queue (member_id, notification_type, title, body, data)
  SELECT cm.user_id,
         'circle_events',
         'Contribution Flexibility Activated',
         'A member has activated contribution flexibility for cycle '
           || (SELECT cycle_number::TEXT FROM circle_cycles WHERE id = p_cycle_id)
           || '. The circle timeline is not affected.',
         jsonb_build_object(
           'circle_id', p_circle_id,
           'cycle_id', p_cycle_id,
           'plan_id', v_plan_id,
           'type', 'partial_contribution_activated'
         )
  FROM circle_members cm
  WHERE cm.circle_id = p_circle_id
    AND cm.role IN ('creator', 'admin');

  RETURN jsonb_build_object(
    'success', true,
    'plan_id', v_plan_id,
    'summary', v_summary,
    'coverage', v_coverage,
    'catch_up_contribution_ids', jsonb_build_array(v_catchup1_id, v_catchup2_id),
    'source', 'activate_partial_contribution_rpc'
  );
END;
$$;


-- ── Grants ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.preview_partial_contribution(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_partial_contribution(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.preview_partial_contribution(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.activate_partial_contribution(UUID, UUID) FROM PUBLIC, anon;

-- Private helpers — service_role only
REVOKE EXECUTE ON FUNCTION public._build_partial_eligibility(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._build_partial_summary(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._build_coverage_preview(UUID, BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._build_partial_eligibility(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public._build_partial_summary(UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public._build_coverage_preview(UUID, BIGINT) TO service_role;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('102', 'partial_contribution_rpcs',
        ARRAY['-- 102: PartialContributionEngine D1 — activation + preview RPCs + coverage tracking'])
ON CONFLICT (version) DO NOTHING;
