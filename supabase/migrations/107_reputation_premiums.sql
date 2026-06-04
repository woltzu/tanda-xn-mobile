-- ════════════════════════════════════════════════════════════════════════════
-- Migration 107: Reputation Premiums — insurance discount + liquidity max bump
-- Step 3 of feat(circle-reputation).
-- ════════════════════════════════════════════════════════════════════════════
-- Two existing PL/pgSQL functions read the circle's reputation_score (added
-- in Step 1) and apply trust-premium benefits when the score qualifies
-- (≥ 80). Below that threshold, behaviour is unchanged from prior migrations.
--
--   calculate_pool_rate(circle_id) — insurance pool rate
--     If reputation_score >= 80, subtract 0.5pp (0.0050) from the computed
--     rate. The existing GREATEST(rate_floor, …) clamp prevents the rate
--     from dropping below 1%. Audit row in insurance_pool_rate_history
--     gains a new `reputation_discount` column so the discount is
--     traceable separately from the score / default / member-below-fair
--     adjustments.
--
--   check_liquidity_advance_eligibility(member_id, circle_id,
--                                       requested_amount_cents,
--                                       exclude_advance_id) — liquidity max
--     If reputation_score >= 80, raise the absolute payout cap from 80%
--     to 90% — so members in a trusted circle can borrow against more of
--     their future payout. Tier max still applies on top (LEAST(tier_max,
--     dynamic_cap)) so a tier-2 member can't suddenly borrow 90%. JSONB
--     result gains a `max_advance_percent` field exposing the cap
--     actually used.
--
-- Both updates are idempotent: CREATE OR REPLACE FUNCTION + IF NOT EXISTS
-- on the schema additions.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Audit column on rate history (additive, nullable) ──────────────────────
ALTER TABLE insurance_pool_rate_history
  ADD COLUMN IF NOT EXISTS reputation_discount NUMERIC(5,4);


-- ── calculate_pool_rate — apply reputation discount ────────────────────────

CREATE OR REPLACE FUNCTION calculate_pool_rate(p_circle_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
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
  v_reputation_score DECIMAL(5,2);  -- NEW: Step 3 of feat(circle-reputation)
  v_reputation_discount DECIMAL(5,4) := 0;
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

  -- ── NEW: reputation premium ──
  -- Circles with overall_score >= 80 (from past circle_reputation +
  -- circles.reputation_score) earn a 0.5pp discount. The floor clamp
  -- below prevents the rate going under 1%.
  SELECT COALESCE(reputation_score, 0)
    INTO v_reputation_score
  FROM circles WHERE id = p_circle_id;

  IF v_reputation_score >= 80 THEN
    v_reputation_discount := 0.0050;
    v_rate := v_rate - v_reputation_discount;
  END IF;

  v_rate := GREATEST(v_pool.rate_floor, LEAST(v_pool.rate_ceiling, v_rate));

  UPDATE circle_insurance_pools
  SET current_rate = v_rate, updated_at = NOW()
  WHERE id = v_pool.id;

  INSERT INTO insurance_pool_rate_history (
    pool_id, circle_id, effective_rate, previous_rate, reason,
    avg_member_score, min_member_score, members_below_fair,
    default_history_factor, reputation_discount
  ) VALUES (
    v_pool.id, p_circle_id, v_rate, v_previous_rate,
    CASE WHEN v_reputation_discount > 0
         THEN 'Dynamic rate recalculation + reputation premium'
         ELSE 'Dynamic rate recalculation'
    END,
    v_avg_score, v_min_score, v_members_below_fair,
    LEAST(v_total_defaults * 0.0015, 0.0060),
    v_reputation_discount
  );

  RETURN v_rate;
END;
$function$;


-- ── check_liquidity_advance_eligibility — raise cap when reputation ≥ 80 ───

CREATE OR REPLACE FUNCTION check_liquidity_advance_eligibility(
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
  -- NEW: Step 3 of feat(circle-reputation)
  v_reputation_score DECIMAL(5,2) := 0;
  v_max_advance_percent INTEGER := 80;  -- baseline absolute cap
BEGIN
  -- 1. Member XnScore
  SELECT COALESCE(xn_score, 0) INTO v_member_xnscore
  FROM profiles WHERE id = p_member_id;
  v_member_xnscore := COALESCE(v_member_xnscore, 0);

  IF v_member_xnscore < 65 THEN
    v_reasons := array_append(v_reasons,
      format('XnScore %s is below minimum 65', v_member_xnscore));
  END IF;

  -- 2. Member tier
  SELECT current_tier, tier_number INTO v_member_tier_key, v_member_tier_number
  FROM member_tier_status WHERE user_id = p_member_id;
  v_member_tier_number := COALESCE(v_member_tier_number, 0);
  v_member_tier_key := COALESCE(v_member_tier_key, 'critical');

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

  -- ── NEW: reputation premium — raise absolute cap from 80% to 90% ──
  -- Reads circles.reputation_score (stamped on completion via
  -- compute_circle_reputation, or pre-stamped at creation from
  -- get_inherited_reputation_for_members in CirclesContext).
  SELECT COALESCE(reputation_score, 0)
    INTO v_reputation_score
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

  -- 6. Tier-based max %
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
    -- FIX (Step 3): use the dynamic cap, not the hardcoded 80
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
                    THEN ' (reputation-premium tier)'
                    ELSE ''
               END));
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

  -- 8. Outstanding-advance check
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

  -- 9. Pool safety
  SELECT id, is_accepting_requests, available_cents INTO v_pool
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
    'fee_pct_30day', 3.0,
    'fee_pct_60day', 5.0,
    'source', 'check_liquidity_advance_eligibility_v2_reputation'
  );
END;
$function$;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('107', 'reputation_premiums',
        ARRAY['-- 107: CircleReputation Step 3 — insurance discount + liquidity max bump'])
ON CONFLICT (version) DO NOTHING;
