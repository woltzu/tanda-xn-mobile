-- ============================================================================
-- Migration 115: dynamic cross-circle liquidity fees + circle-health
-- multiplier for insurance pool rate
-- ============================================================================
-- Two features in one migration because they share the same weekly cron
-- entry point (process_liquidity_pool_health_check) and the same risk
-- frame (pool/circle health -> price).
--
-- Step 1: schema
--   liquidity_pool gets 4 new pricing columns:
--     current_fee_30day_pct  default 3.0
--     current_fee_60day_pct  default 5.0
--     fee_floor_pct          default 2.0
--     fee_ceiling_pct        default 8.0
--   insurance_pool_rate_history gets a new column:
--     health_adjustment      numeric, default 0
--   so every rate write carries the circle-health contribution.
--
-- Step 2: process_liquidity_pool_health_check augmented
--   Previously only tuned max_utilization_pct + is_accepting_requests
--   based on default_rate_pct. Now also nudges current_fee_30day_pct
--   and current_fee_60day_pct each weekly run:
--     utilization_pct  > 70  -> +0.5pp both (clamped by ceiling)
--     default_rate_pct > 3   -> +0.5pp both (clamped by ceiling)
--     default_rate=0 AND utilization<30 -> -0.5pp both (clamped by floor)
--   Adjustments are cumulative across runs (each weekly run reads the
--   current fee and applies a delta) -- same idiom the existing
--   max_utilization adjustment already uses.
--
-- Step 3: dynamic-fee plumbing
--   3a. calculate_advance_fee trigger now OVERRIDES NEW.fee_pct from the
--       pool's current_fee_30day_pct / current_fee_60day_pct based on
--       NEW.fee_tier ('30_day' | '60_day') at approval time. The TS-side
--       hardcoded FEES table in CrossCircleLiquidityEngine becomes a
--       default that gets clobbered by the trigger; refactoring that
--       hardcode is a separate follow-up commit.
--   3b. check_liquidity_advance_eligibility now reads
--       current_fee_30day_pct / current_fee_60day_pct from the pool and
--       returns them in the JSONB response instead of '3.0'/'5.0'.
--
-- Step 4: calculate_pool_rate augmented with circle-health multiplier
--   After the existing XnScore + member-quality + default-history +
--   reputation adjustments, look up the latest circle_health_scores
--   row for the circle:
--     health_score >= 70  -> v_rate -= 0.0020   (0.2pp discount)
--     health_score <= 40  -> v_rate += 0.0050   (0.5pp penalty)
--     otherwise           -> no change
--   Then the same floor/ceiling clamp as before.
--   The history row carries the chosen health_adjustment.
--   Return type stays NUMERIC -- changing to JSONB would be a breaking
--   surface change for every caller; the history row carries the
--   breakdown for traceability.
--
-- Idempotency: every CREATE OR REPLACE / ADD COLUMN IF NOT EXISTS is
-- safe to re-run. Existing pool/policy data preserved.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Step 1: schema
-- ----------------------------------------------------------------------------
ALTER TABLE liquidity_pool
  ADD COLUMN IF NOT EXISTS current_fee_30day_pct NUMERIC DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS current_fee_60day_pct NUMERIC DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS fee_floor_pct         NUMERIC DEFAULT 2.0,
  ADD COLUMN IF NOT EXISTS fee_ceiling_pct       NUMERIC DEFAULT 8.0;

ALTER TABLE insurance_pool_rate_history
  ADD COLUMN IF NOT EXISTS health_adjustment NUMERIC DEFAULT 0;


-- ----------------------------------------------------------------------------
-- Step 2: process_liquidity_pool_health_check -- now also tunes fees
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_liquidity_pool_health_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_pool RECORD;
  v_old_max_util NUMERIC;
  v_new_max_util NUMERIC;
  v_old_accepting BOOLEAN;
  v_new_accepting BOOLEAN;
  v_recent_default_count INTEGER;
  v_changes JSONB := '[]'::jsonb;
  -- fee-tuning locals (Step 2)
  v_old_fee_30 NUMERIC;
  v_new_fee_30 NUMERIC;
  v_old_fee_60 NUMERIC;
  v_new_fee_60 NUMERIC;
  v_fee_delta NUMERIC := 0;
  v_fee_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT * INTO v_pool
  FROM liquidity_pool
  WHERE pool_name = 'primary'
  LIMIT 1;

  IF v_pool IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No primary pool found',
      'source', 'process_liquidity_pool_health_check_rpc'
    );
  END IF;

  v_old_max_util   := v_pool.max_utilization_pct;
  v_new_max_util   := v_old_max_util;
  v_old_accepting  := v_pool.is_accepting_requests;
  v_new_accepting  := v_old_accepting;
  v_old_fee_30     := v_pool.current_fee_30day_pct;
  v_new_fee_30     := v_old_fee_30;
  v_old_fee_60     := v_pool.current_fee_60day_pct;
  v_new_fee_60     := v_old_fee_60;

  SELECT COUNT(*) INTO v_recent_default_count
  FROM liquidity_advances
  WHERE status = 'defaulted'
    AND updated_at > NOW() - INTERVAL '30 days';

  -- ── max_utilization + accepting flag (existing logic) ────────────────
  IF v_pool.default_rate_pct > 8 THEN
    v_new_accepting := false;
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'change', 'safety_circuit_tripped',
      'reason', format('default_rate %s%% exceeds 8%% threshold',
                       ROUND(v_pool.default_rate_pct, 2)),
      'previous_value', v_old_accepting,
      'new_value', false
    ));
    v_new_max_util := GREATEST(30, v_old_max_util - 10);
  ELSIF v_pool.default_rate_pct > 5 THEN
    v_new_max_util := GREATEST(30, v_old_max_util - 10);
  ELSIF v_pool.default_rate_pct = 0 AND v_recent_default_count = 0 THEN
    v_new_max_util := LEAST(90, v_old_max_util + 5);
    IF NOT v_old_accepting THEN
      v_new_accepting := true;
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'change', 'safety_circuit_reset',
        'reason', 'default_rate=0 AND no defaults in 30 days',
        'previous_value', false,
        'new_value', true
      ));
    END IF;
  END IF;

  IF v_new_max_util <> v_old_max_util THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'change', 'max_utilization_adjusted',
      'previous_value', v_old_max_util,
      'new_value', v_new_max_util,
      'reason', CASE
        WHEN v_new_max_util > v_old_max_util THEN 'pool healthy, easing cap'
        ELSE 'risk elevated, tightening cap'
      END
    ));
  END IF;

  -- ── Step 2: fee tuning ──────────────────────────────────────────────
  -- Each weekly run reads the current fee and applies a delta. Deltas
  -- accumulate across runs until they hit the floor or ceiling, same
  -- idiom the max_utilization adjustment uses.
  IF v_pool.utilization_pct > 70 THEN
    v_fee_delta := v_fee_delta + 0.5;
    v_fee_reasons := array_append(v_fee_reasons,
      format('utilization %s%% > 70', ROUND(v_pool.utilization_pct, 2)));
  END IF;

  IF v_pool.default_rate_pct > 3 THEN
    v_fee_delta := v_fee_delta + 0.5;
    v_fee_reasons := array_append(v_fee_reasons,
      format('default_rate %s%% > 3', ROUND(v_pool.default_rate_pct, 2)));
  END IF;

  -- Easing condition (mutually exclusive with the raise conditions: a
  -- pool can't simultaneously have default_rate=0 + utilization<30 AND
  -- utilization>70). If both raise conditions are off and the easing
  -- condition fires, drop fees.
  IF v_fee_delta = 0
     AND v_pool.default_rate_pct = 0
     AND v_pool.utilization_pct < 30 THEN
    v_fee_delta := -0.5;
    v_fee_reasons := array_append(v_fee_reasons,
      format('healthy pool: default_rate=0 AND utilization %s%% < 30',
             ROUND(v_pool.utilization_pct, 2)));
  END IF;

  IF v_fee_delta <> 0 THEN
    v_new_fee_30 := GREATEST(v_pool.fee_floor_pct,
                    LEAST(v_pool.fee_ceiling_pct, v_old_fee_30 + v_fee_delta));
    v_new_fee_60 := GREATEST(v_pool.fee_floor_pct,
                    LEAST(v_pool.fee_ceiling_pct, v_old_fee_60 + v_fee_delta));
  END IF;

  IF v_new_fee_30 <> v_old_fee_30 OR v_new_fee_60 <> v_old_fee_60 THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'change', 'fees_adjusted',
      'previous_30day_pct', v_old_fee_30,
      'new_30day_pct', v_new_fee_30,
      'previous_60day_pct', v_old_fee_60,
      'new_60day_pct', v_new_fee_60,
      'delta_pp', v_fee_delta,
      'reasons', v_fee_reasons
    ));
  END IF;

  -- ── Apply all changes ──────────────────────────────────────────────
  IF (v_new_max_util <> v_old_max_util)
     OR (v_new_accepting <> v_old_accepting)
     OR (v_new_fee_30 <> v_old_fee_30)
     OR (v_new_fee_60 <> v_old_fee_60) THEN
    UPDATE liquidity_pool
    SET max_utilization_pct    = v_new_max_util,
        is_accepting_requests  = v_new_accepting,
        current_fee_30day_pct  = v_new_fee_30,
        current_fee_60day_pct  = v_new_fee_60,
        updated_at             = NOW()
    WHERE id = v_pool.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'changes_made', jsonb_array_length(v_changes),
    'changes', v_changes,
    'pool_state', jsonb_build_object(
      'default_rate_pct', v_pool.default_rate_pct,
      'utilization_pct', v_pool.utilization_pct,
      'old_max_utilization_pct', v_old_max_util,
      'new_max_utilization_pct', v_new_max_util,
      'old_accepting_flag', v_old_accepting,
      'new_accepting_flag', v_new_accepting,
      'old_fee_30day_pct', v_old_fee_30,
      'new_fee_30day_pct', v_new_fee_30,
      'old_fee_60day_pct', v_old_fee_60,
      'new_fee_60day_pct', v_new_fee_60,
      'fee_delta_pp', v_fee_delta,
      'fee_reasons', v_fee_reasons,
      'recent_defaults_30d', v_recent_default_count,
      'available_cents', v_pool.available_cents,
      'deployed_cents', v_pool.deployed_cents
    ),
    'source', 'process_liquidity_pool_health_check_v2_dynamic_fees',
    'note', 'Adjusts max_utilization_pct + is_accepting_requests + 30/60-day fees. Safety circuit at 8% default rate. Fee floor/ceiling on liquidity_pool.fee_floor_pct/fee_ceiling_pct.'
  );
END;
$function$;


-- ----------------------------------------------------------------------------
-- Step 3a: calculate_advance_fee trigger -- override NEW.fee_pct from pool
-- ----------------------------------------------------------------------------
-- The trigger fires BEFORE INSERT and BEFORE UPDATE. The transition to
-- 'approved' is the moment fees lock in -- before that the caller's
-- fee_pct is provisional (driven by the TS engine's hardcoded FEES table
-- in CrossCircleLiquidityEngine.ts). Reading from the pool here ensures
-- the actual charge tracks the dynamic fees regardless of what the
-- caller passed.
--
-- Falls back to the caller-supplied NEW.fee_pct if the pool lookup
-- fails (defensive) so the trigger can never strand a valid advance.

CREATE OR REPLACE FUNCTION public.calculate_advance_fee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_pool_fee_pct NUMERIC;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status = 'requested') THEN
    -- Step 3a: read the current dynamic fee from the pool based on
    -- fee_tier. If the pool row or fee_tier is unexpected, fall through
    -- to the caller-supplied NEW.fee_pct so we don't block approval.
    BEGIN
      SELECT CASE NEW.fee_tier
               WHEN '30_day' THEN lp.current_fee_30day_pct
               WHEN '60_day' THEN lp.current_fee_60day_pct
               ELSE NULL
             END
        INTO v_pool_fee_pct
      FROM liquidity_pool lp
      WHERE lp.pool_name = 'primary'
      LIMIT 1;

      IF v_pool_fee_pct IS NOT NULL THEN
        NEW.fee_pct := v_pool_fee_pct;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'calculate_advance_fee: pool fee lookup failed (%), '
                   'falling back to caller-supplied fee_pct=%',
                   SQLERRM, NEW.fee_pct;
    END;

    NEW.fee_amount_cents      := ROUND(NEW.approved_amount_cents * (NEW.fee_pct / 100));
    NEW.disbursed_amount_cents := NEW.approved_amount_cents;
    NEW.total_repayment_cents := NEW.approved_amount_cents + NEW.fee_amount_cents;
    NEW.advance_pct_of_payout := ROUND(
      (NEW.approved_amount_cents::NUMERIC / NULLIF(NEW.expected_payout_cents, 0)) * 100, 2);
  END IF;
  RETURN NEW;
END;
$function$;


-- ----------------------------------------------------------------------------
-- Step 3b: check_liquidity_advance_eligibility -- read dynamic fees from pool
-- ----------------------------------------------------------------------------
-- Body preserved verbatim from the live definition (which already carries
-- the Step 3 reputation premium logic) except for:
--   * v_pool SELECT now also pulls current_fee_30day_pct +
--     current_fee_60day_pct so the response carries the live values.
--   * 'fee_pct_30day' / 'fee_pct_60day' in the response read from those
--     pool columns with COALESCE to the legacy hardcoded constants if a
--     row somehow lacks them (defensive; the migration default backfills).

CREATE OR REPLACE FUNCTION public.check_liquidity_advance_eligibility(
  p_member_id UUID,
  p_circle_id UUID,
  p_requested_amount_cents BIGINT,
  p_exclude_advance_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_reasons TEXT[] := ARRAY[]::TEXT[];
  v_member_xnscore INTEGER := 0;
  v_member_tier_key TEXT;
  v_member_tier_number INTEGER := 0;
  v_completed_cycles INTEGER := 0;
  v_expected_payout_cents BIGINT;
  v_circle_amount NUMERIC;
  v_circle_member_count INTEGER;
  v_tier_max_pct INTEGER;
  v_max_amount_cents BIGINT;
  v_outstanding_debt_cents BIGINT := 0;
  v_total_payouts_cents BIGINT := 0;
  v_dcr NUMERIC;
  v_has_outstanding BOOLEAN := false;
  v_pool RECORD;
  v_is_in_circle BOOLEAN;
  v_advance_pct_of_payout NUMERIC;
  v_eligible BOOLEAN;
  v_reputation_score DECIMAL(5,2) := 0;
  v_max_advance_percent INTEGER := 80;
BEGIN
  -- 1. XnScore
  SELECT COALESCE(xn_score, 0) INTO v_member_xnscore
  FROM profiles WHERE id = p_member_id;
  v_member_xnscore := COALESCE(v_member_xnscore, 0);
  IF v_member_xnscore < 65 THEN
    v_reasons := array_append(v_reasons,
      format('XnScore %s is below minimum 65', v_member_xnscore));
  END IF;

  -- 2. Tier
  SELECT current_tier, tier_number INTO v_member_tier_key, v_member_tier_number
  FROM member_tier_status WHERE user_id = p_member_id;
  v_member_tier_number := COALESCE(v_member_tier_number, 0);
  v_member_tier_key    := COALESCE(v_member_tier_key, 'critical');
  IF v_member_tier_number < 2 THEN
    v_reasons := array_append(v_reasons,
      format('Member tier "%s" (#%s) is below minimum tier 2 (Established)',
             v_member_tier_key, v_member_tier_number));
  END IF;

  -- 3. Completed cycles
  SELECT COALESCE(circles_completed, 0) INTO v_completed_cycles
  FROM member_behavioral_profiles WHERE user_id = p_member_id;
  v_completed_cycles := COALESCE(v_completed_cycles, 0);
  IF v_completed_cycles < 2 THEN
    v_reasons := array_append(v_reasons,
      format('Only %s circles completed; minimum 2 required', v_completed_cycles));
  END IF;

  -- 4. Membership
  SELECT EXISTS (
    SELECT 1 FROM circle_members
    WHERE user_id = p_member_id AND circle_id = p_circle_id AND status = 'active'
  ) INTO v_is_in_circle;
  IF NOT v_is_in_circle THEN
    v_reasons := array_append(v_reasons, 'Member is not active in this circle');
  END IF;

  -- Reputation premium (Step 3 of feat(circle-reputation))
  SELECT COALESCE(reputation_score, 0) INTO v_reputation_score
  FROM circles WHERE id = p_circle_id;
  IF v_reputation_score >= 80 THEN
    v_max_advance_percent := 90;
  END IF;

  -- 5. Expected payout
  SELECT (expected_amount * 100)::BIGINT INTO v_expected_payout_cents
  FROM future_payouts
  WHERE user_id = p_member_id
    AND circle_id = p_circle_id
    AND is_advanceable = true
  ORDER BY expected_date ASC LIMIT 1;

  IF v_expected_payout_cents IS NULL THEN
    SELECT amount, member_count INTO v_circle_amount, v_circle_member_count
    FROM circles WHERE id = p_circle_id;
    v_expected_payout_cents :=
      (COALESCE(v_circle_amount, 0) * 100 * COALESCE(v_circle_member_count, 0))::BIGINT;
  END IF;

  -- 6. Tier max
  v_tier_max_pct := CASE v_member_tier_number
    WHEN 0 THEN 0
    WHEN 1 THEN 0
    WHEN 2 THEN 50
    WHEN 3 THEN 65
    WHEN 4 THEN 80
    WHEN 5 THEN 90
    ELSE 0
  END;

  IF v_expected_payout_cents > 0 THEN
    v_max_amount_cents :=
      (v_expected_payout_cents * LEAST(v_tier_max_pct, v_max_advance_percent) / 100)::BIGINT;
    v_advance_pct_of_payout :=
      (p_requested_amount_cents::NUMERIC / v_expected_payout_cents) * 100;

    IF v_advance_pct_of_payout > v_max_advance_percent THEN
      v_reasons := array_append(v_reasons,
        format('Requested %s%% exceeds the %s%% absolute payout cap%s',
               ROUND(v_advance_pct_of_payout),
               v_max_advance_percent,
               CASE WHEN v_reputation_score >= 80
                    THEN ' (reputation-premium tier)' ELSE '' END));
    ELSIF v_tier_max_pct > 0 AND v_advance_pct_of_payout > v_tier_max_pct THEN
      v_reasons := array_append(v_reasons,
        format('Requested %s%% exceeds tier "%s" max of %s%%',
               ROUND(v_advance_pct_of_payout), v_member_tier_key, v_tier_max_pct));
    END IF;
  ELSE
    v_reasons := array_append(v_reasons, 'No expected payout could be determined');
    v_max_amount_cents := 0;
  END IF;

  -- 7. DCR
  SELECT COALESCE(SUM(total_repayment_cents - amount_repaid_cents), 0)
    INTO v_outstanding_debt_cents
  FROM liquidity_advances
  WHERE member_id = p_member_id
    AND status IN ('approved', 'disbursed', 'repaying');

  SELECT COALESCE(SUM(c.amount * c.member_count * 100), 0)::BIGINT
    INTO v_total_payouts_cents
  FROM circle_members cm
  JOIN circles c ON c.id = cm.circle_id
  WHERE cm.user_id = p_member_id AND cm.status = 'active';

  IF v_total_payouts_cents > 0 THEN
    v_dcr := ((v_outstanding_debt_cents + p_requested_amount_cents)::NUMERIC
              / v_total_payouts_cents);
    IF v_dcr > 0.50 THEN
      v_reasons := array_append(v_reasons,
        format('Debt-to-contribution ratio %s exceeds 0.50 ceiling',
               ROUND(v_dcr, 2)));
    END IF;
  ELSE
    v_dcr := 0;
  END IF;

  -- 8. Outstanding advance
  SELECT EXISTS (
    SELECT 1 FROM liquidity_advances
    WHERE member_id = p_member_id
      AND status IN ('requested', 'approved', 'disbursed', 'repaying', 'queued')
      AND (p_exclude_advance_id IS NULL OR id <> p_exclude_advance_id)
  ) INTO v_has_outstanding;
  IF v_has_outstanding THEN
    v_reasons := array_append(v_reasons,
      'Member has an outstanding advance (must repay first)');
  END IF;

  -- 9. Pool safety -- now also pulling dynamic fees
  SELECT id, is_accepting_requests, available_cents,
         current_fee_30day_pct, current_fee_60day_pct
    INTO v_pool
  FROM liquidity_pool WHERE pool_name = 'primary' LIMIT 1;

  IF v_pool IS NULL THEN
    v_reasons := array_append(v_reasons, 'No active liquidity pool');
  ELSE
    IF NOT v_pool.is_accepting_requests THEN
      v_reasons := array_append(v_reasons, 'Pool is not accepting new requests');
    END IF;
    IF p_requested_amount_cents > v_pool.available_cents THEN
      v_reasons := array_append(v_reasons,
        format('Requested $%s exceeds pool available capital $%s',
               ROUND(p_requested_amount_cents / 100.0),
               ROUND(v_pool.available_cents / 100.0)));
    END IF;
  END IF;

  v_eligible := COALESCE(array_length(v_reasons, 1), 0) = 0;

  RETURN jsonb_build_object(
    'eligible', v_eligible,
    'max_amount_cents', v_max_amount_cents,
    'reasons', v_reasons,
    'member_xnscore', v_member_xnscore,
    'member_tier', v_member_tier_key,
    'member_tier_number', v_member_tier_number,
    'completed_cycles', v_completed_cycles,
    'has_outstanding_advance', v_has_outstanding,
    'dcr', ROUND(v_dcr, 4),
    'expected_payout_cents', v_expected_payout_cents,
    'tier_max_pct', v_tier_max_pct,
    'max_advance_percent', v_max_advance_percent,
    'circle_reputation_score', v_reputation_score,
    'reputation_premium_applied', (v_reputation_score >= 80),
    -- Step 3b: dynamic fees, default to legacy constants if pool lookup
    -- somehow returned NULL columns (shouldn't happen post-migration).
    'fee_pct_30day', COALESCE(v_pool.current_fee_30day_pct, 3.0),
    'fee_pct_60day', COALESCE(v_pool.current_fee_60day_pct, 5.0),
    'source', 'check_liquidity_advance_eligibility_v3_dynamic_fees'
  );
END;
$function$;


-- ----------------------------------------------------------------------------
-- Step 4: calculate_pool_rate -- add circle-health multiplier
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_pool_rate(p_circle_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_pool RECORD;
  v_avg_score DECIMAL(6,2);
  v_min_score DECIMAL(6,2);
  v_members_below_fair INTEGER;
  v_total_defaults INTEGER;
  v_member_count INTEGER;
  v_rate DECIMAL(5,4);
  v_previous_rate DECIMAL(5,4);
  v_reputation_score DECIMAL(5,2);
  v_reputation_discount DECIMAL(5,4) := 0;
  -- Step 4: circle-health multiplier locals
  v_health_score NUMERIC;
  v_health_adjustment DECIMAL(5,4) := 0;
BEGIN
  SELECT * INTO v_pool
  FROM circle_insurance_pools
  WHERE circle_id = p_circle_id;

  IF v_pool IS NULL THEN
    RETURN 0.0200;
  END IF;

  v_previous_rate := v_pool.current_rate;

  SELECT
    COALESCE(AVG(xs.total_score), 0),
    COALESCE(MIN(xs.total_score), 0),
    COUNT(*) FILTER (WHERE xs.score_tier IN ('critical', 'poor')),
    COUNT(*)
  INTO v_avg_score, v_min_score, v_members_below_fair, v_member_count
  FROM circle_members cm
  LEFT JOIN xn_scores xs ON xs.user_id = cm.user_id
  WHERE cm.circle_id = p_circle_id
    AND cm.status = 'active';

  SELECT COALESCE(SUM(mbp.default_count), 0)
  INTO v_total_defaults
  FROM circle_members cm
  JOIN member_behavioral_profiles mbp ON mbp.user_id = cm.user_id
  WHERE cm.circle_id = p_circle_id
    AND cm.status = 'active';

  v_rate := 0.0200;

  IF v_avg_score >= 75 THEN
    v_rate := v_rate - 0.0050;
  ELSIF v_avg_score >= 60 THEN
    v_rate := v_rate - 0.0030;
  ELSIF v_avg_score < 45 THEN
    v_rate := v_rate + 0.0030;
  END IF;

  IF v_members_below_fair > 0 AND v_member_count > 0 THEN
    v_rate := v_rate + LEAST(v_members_below_fair * 0.0020, 0.0080);
  END IF;

  IF v_total_defaults > 0 THEN
    v_rate := v_rate + LEAST(v_total_defaults * 0.0015, 0.0060);
  END IF;

  -- Reputation premium
  SELECT COALESCE(reputation_score, 0) INTO v_reputation_score
  FROM circles WHERE id = p_circle_id;

  IF v_reputation_score >= 80 THEN
    v_reputation_discount := 0.0050;
    v_rate := v_rate - v_reputation_discount;
  END IF;

  -- Step 4: circle-health multiplier
  -- Read the most recent health_score row for this circle. If none
  -- exists (the weekly recompute hasn't covered this circle yet) the
  -- adjustment stays at 0 -- absent signal, not an automatic penalty.
  SELECT chs.health_score INTO v_health_score
  FROM circle_health_scores chs
  WHERE chs.circle_id = p_circle_id
  ORDER BY chs.last_computed_at DESC NULLS LAST
  LIMIT 1;

  IF v_health_score IS NOT NULL THEN
    IF v_health_score >= 70 THEN
      v_health_adjustment := -0.0020;
    ELSIF v_health_score <= 40 THEN
      v_health_adjustment := 0.0050;
    END IF;
    v_rate := v_rate + v_health_adjustment;
  END IF;

  -- Final floor/ceiling clamp (unchanged)
  v_rate := GREATEST(v_pool.rate_floor, LEAST(v_pool.rate_ceiling, v_rate));

  UPDATE circle_insurance_pools
  SET current_rate = v_rate, updated_at = NOW()
  WHERE id = v_pool.id;

  INSERT INTO insurance_pool_rate_history (
    pool_id, circle_id, effective_rate, previous_rate, reason,
    avg_member_score, min_member_score, members_below_fair,
    default_history_factor, reputation_discount, health_adjustment
  ) VALUES (
    v_pool.id, p_circle_id, v_rate, v_previous_rate,
    CASE
      WHEN v_reputation_discount > 0 AND v_health_adjustment <> 0
        THEN format('Dynamic rate + reputation + health (%s)',
                    CASE WHEN v_health_adjustment < 0 THEN 'discount' ELSE 'penalty' END)
      WHEN v_reputation_discount > 0
        THEN 'Dynamic rate + reputation premium'
      WHEN v_health_adjustment <> 0
        THEN format('Dynamic rate + circle-health (%s)',
                    CASE WHEN v_health_adjustment < 0 THEN 'discount' ELSE 'penalty' END)
      ELSE 'Dynamic rate recalculation'
    END,
    v_avg_score, v_min_score, v_members_below_fair,
    LEAST(v_total_defaults * 0.0015, 0.0060),
    v_reputation_discount, v_health_adjustment
  );

  RETURN v_rate;
END;
$function$;


-- ----------------------------------------------------------------------------
-- Grants (preserve prior shape)
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.process_liquidity_pool_health_check()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.check_liquidity_advance_eligibility(UUID, UUID, BIGINT, UUID)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_pool_rate(UUID)
  TO authenticated, service_role;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('115', 'dynamic_fees_and_health_multiplier',
        ARRAY['-- 115: dynamic liquidity fees + circle-health multiplier for insurance rate'])
ON CONFLICT (version) DO NOTHING;
