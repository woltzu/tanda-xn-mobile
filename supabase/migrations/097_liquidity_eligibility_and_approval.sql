-- ════════════════════════════════════════════════════════════════════════════
-- Migration 097: Cross-Circle Liquidity — server-side eligibility + approval
-- ════════════════════════════════════════════════════════════════════════════
-- Until this commit, eligibility gating lived only in TypeScript constants
-- (services/CrossCircleLiquidityEngine.ts ELIGIBILITY/TIER_MAP/FEES) — a
-- malicious client could bypass the check by writing to liquidity_advances
-- directly. This migration adds two server-side functions:
--
--   1. check_liquidity_advance_eligibility(member_id, circle_id, requested_cents)
--      Pure read-only function. Mirrors the TS engine's checkEligibility
--      logic exactly. Returns JSONB { eligible, reasons[], max_amount_cents,
--      member_xnscore, member_tier, completed_cycles, dcr, fee_pct_30day,
--      fee_pct_60day, expected_payout_cents, tier_max_pct, source }.
--
--   2. process_advance_request(advance_id, repayment_tier='30_day')
--      Read-write. Reads the request, calls eligibility, transitions status
--      to 'approved' (with fee_pct, fee_tier, repay_by_date set so the
--      existing calculate_advance_fee TRIGGER computes the amount fields)
--      or 'rejected' (with rejection_reason populated from the eligibility
--      reasons[]). Returns JSONB with the decision.
--
-- The TypeScript engine constants this mirrors:
--   MIN_XNSCORE = 65
--   MIN_TIER = 2  (Established or above)
--   MIN_COMPLETED_CYCLES = 2
--   MAX_PAYOUT_PCT = 80  (hard cap regardless of tier)
--   MAX_DCR = 0.50  (debt-to-contribution ratio)
--   Fees: 30_day = 3.0%, 60_day = 5.0%  (decision a: keep hardcoded)
--   Tier max %:
--     tier 0 (critical)  → 0  (locked)
--     tier 1 (newcomer)  → 0  (preview, locked from borrowing)
--     tier 2 (established) → 50
--     tier 3 (trusted)   → 65
--     tier 4 (elder)     → 80
--     tier 5 (elite)     → 90
--
-- Data sources (all already populated by other engines this sprint):
--   - profiles.xn_score    (Conflict/Composition/Match/Tier all use this)
--   - member_tier_status   (feat(tier) — populated by graduated-entry-cron)
--   - member_behavioral_profiles.circles_completed (scoring-pipeline-daily)
--   - circle_members       (membership)
--   - circles.amount, member_count (expected_payout fallback when
--                                   future_payouts is empty)
--   - liquidity_advances   (DCR + outstanding-advance check)
--   - liquidity_pool       (accepting + available_cents safety)
--
-- Note on rejection_reason: column is text. The function joins the
-- reasons array with '; ' and writes the joined string.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── A. check_liquidity_advance_eligibility ──────────────────────────────
-- p_exclude_advance_id lets process_advance_request exclude the advance
-- row currently being evaluated from the "has outstanding advance" check.
-- Without it, the function would see the just-inserted 'requested' row as
-- outstanding and reject every fresh request. Optional, defaults to NULL
-- so pre-INSERT eligibility previews (caller doesn't have an id yet) still
-- work unchanged.

DROP FUNCTION IF EXISTS check_liquidity_advance_eligibility(UUID, UUID, BIGINT);

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
AS $$
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
BEGIN
  -- 1. Member XnScore (canonical: profiles.xn_score; same source used by
  -- Conflict/Composition/Match/Tier engines this sprint)
  SELECT COALESCE(xn_score, 0) INTO v_member_xnscore
  FROM profiles WHERE id = p_member_id;
  v_member_xnscore := COALESCE(v_member_xnscore, 0);

  IF v_member_xnscore < 65 THEN
    v_reasons := array_append(v_reasons,
      format('XnScore %s is below minimum 65', v_member_xnscore));
  END IF;

  -- 2. Member tier from member_tier_status (populated by feat(tier))
  SELECT current_tier, tier_number INTO v_member_tier_key, v_member_tier_number
  FROM member_tier_status WHERE user_id = p_member_id;
  v_member_tier_number := COALESCE(v_member_tier_number, 0);
  v_member_tier_key := COALESCE(v_member_tier_key, 'critical');

  IF v_member_tier_number < 2 THEN
    v_reasons := array_append(v_reasons,
      format('Member tier "%s" (#%s) is below minimum tier 2 (Established)',
             v_member_tier_key, v_member_tier_number));
  END IF;

  -- 3. Completed cycles from member_behavioral_profiles (scoring pipeline)
  SELECT COALESCE(circles_completed, 0) INTO v_completed_cycles
  FROM member_behavioral_profiles WHERE user_id = p_member_id;
  v_completed_cycles := COALESCE(v_completed_cycles, 0);

  IF v_completed_cycles < 2 THEN
    v_reasons := array_append(v_reasons,
      format('Only %s circles completed; minimum 2 required', v_completed_cycles));
  END IF;

  -- 4. Member must be in this circle (active membership)
  SELECT EXISTS (
    SELECT 1 FROM circle_members
    WHERE user_id = p_member_id AND circle_id = p_circle_id AND status = 'active'
  ) INTO v_is_in_circle;

  IF NOT v_is_in_circle THEN
    v_reasons := array_append(v_reasons, 'Member is not active in this circle');
  END IF;

  -- 5. Expected payout. Prefer future_payouts (populated by payout scheduler);
  -- fall back to circles.amount * member_count when future_payouts is empty.
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
    WHEN 0 THEN 0    -- critical: locked
    WHEN 1 THEN 0    -- newcomer: preview (no borrowing yet)
    WHEN 2 THEN 50   -- established: basic
    WHEN 3 THEN 65   -- trusted: standard
    WHEN 4 THEN 80   -- elder: premium
    WHEN 5 THEN 90   -- elite: elite
    ELSE 0
  END;

  IF v_expected_payout_cents > 0 THEN
    -- Lower of (tier max %, hard MAX_PAYOUT_PCT 80%)
    v_max_amount_cents :=
      (v_expected_payout_cents * LEAST(v_tier_max_pct, 80) / 100)::BIGINT;
    v_advance_pct_of_payout :=
      (p_requested_amount_cents::NUMERIC / v_expected_payout_cents) * 100;

    IF v_advance_pct_of_payout > 80 THEN
      v_reasons := array_append(v_reasons,
        format('Requested %s%% exceeds the 80%% absolute payout cap',
               ROUND(v_advance_pct_of_payout)));
    ELSIF v_tier_max_pct > 0 AND v_advance_pct_of_payout > v_tier_max_pct THEN
      v_reasons := array_append(v_reasons,
        format('Requested %s%% exceeds tier "%s" max of %s%%',
               ROUND(v_advance_pct_of_payout), v_member_tier_key, v_tier_max_pct));
    END IF;
  ELSE
    v_reasons := array_append(v_reasons, 'No expected payout could be determined');
    v_max_amount_cents := 0;
  END IF;

  -- 7. DCR (debt-to-contribution ratio) — outstanding advances + this request
  --    divided by total expected payouts across all member's active circles.
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

  -- 8. Outstanding-advance check (one advance at a time per member).
  -- Exclude the advance currently being evaluated (if any) — otherwise
  -- process_advance_request would always see the just-inserted 'requested'
  -- row as outstanding and reject it.
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

  -- 9. Pool safety checks
  SELECT id, is_accepting_requests, available_cents
    INTO v_pool
  FROM liquidity_pool
  WHERE pool_name = 'primary'
  LIMIT 1;

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

  -- Eligible iff no reasons accumulated
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
    'fee_pct_30day', 3.0,
    'fee_pct_60day', 5.0,
    'source', 'check_liquidity_advance_eligibility_v1'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_liquidity_advance_eligibility(UUID, UUID, BIGINT, UUID)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.check_liquidity_advance_eligibility(UUID, UUID, BIGINT, UUID)
  FROM PUBLIC, anon;


-- ─── B. process_advance_request ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_advance_request(
  p_advance_id UUID,
  p_repayment_tier TEXT DEFAULT '30_day'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_advance RECORD;
  v_eligibility JSONB;
  v_fee_pct NUMERIC(5,2);
  v_repay_by_date DATE;
  v_rejection_text TEXT;
BEGIN
  SELECT * INTO v_advance FROM liquidity_advances WHERE id = p_advance_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Advance not found');
  END IF;

  IF v_advance.status != 'requested' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Cannot process: advance is in status "%s" (expected "requested")',
                      v_advance.status)
    );
  END IF;

  IF p_repayment_tier NOT IN ('30_day', '60_day') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid repayment_tier "%s" (expected 30_day or 60_day)',
                      p_repayment_tier)
    );
  END IF;

  -- Exclude THIS advance from the has-outstanding check (otherwise the
  -- just-inserted 'requested' row would always count as outstanding).
  v_eligibility := check_liquidity_advance_eligibility(
    v_advance.member_id,
    v_advance.circle_id,
    v_advance.requested_amount_cents,
    p_advance_id
  );

  IF NOT (v_eligibility->>'eligible')::BOOLEAN THEN
    -- Join reasons[] into a single text for the column
    SELECT string_agg(value, '; ') INTO v_rejection_text
    FROM jsonb_array_elements_text(v_eligibility->'reasons');

    UPDATE liquidity_advances
    SET status = 'rejected',
        rejection_reason = v_rejection_text,
        updated_at = NOW()
    WHERE id = p_advance_id;

    RETURN jsonb_build_object(
      'success', true,
      'decision', 'rejected',
      'advance_id', p_advance_id,
      'reason_text', v_rejection_text,
      'eligibility', v_eligibility
    );
  END IF;

  -- Approve. Set fee_tier, fee_pct, repay_by_date, approved_amount_cents.
  -- The existing calculate_advance_fee TRIGGER fires on the status flip
  -- 'requested' → 'approved' and computes:
  --   fee_amount_cents = approved_amount * fee_pct/100
  --   disbursed_amount_cents = approved_amount
  --   total_repayment_cents = approved + fee
  --   advance_pct_of_payout = approved / expected_payout * 100
  -- So we don't need to set those here.
  v_fee_pct := CASE p_repayment_tier
    WHEN '30_day' THEN 3.0
    WHEN '60_day' THEN 5.0
  END;
  v_repay_by_date := CASE p_repayment_tier
    WHEN '30_day' THEN CURRENT_DATE + INTERVAL '30 days'
    WHEN '60_day' THEN CURRENT_DATE + INTERVAL '60 days'
  END;

  UPDATE liquidity_advances
  SET status = 'approved',
      approved_amount_cents = requested_amount_cents,
      fee_tier = p_repayment_tier,
      fee_pct = v_fee_pct,
      repay_by_date = v_repay_by_date,
      updated_at = NOW()
  WHERE id = p_advance_id;

  RETURN jsonb_build_object(
    'success', true,
    'decision', 'approved',
    'advance_id', p_advance_id,
    'fee_tier', p_repayment_tier,
    'fee_pct', v_fee_pct,
    'repay_by_date', v_repay_by_date,
    'eligibility', v_eligibility
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_advance_request(UUID, TEXT)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.process_advance_request(UUID, TEXT)
  FROM PUBLIC, anon;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('097', 'liquidity_eligibility_and_approval',
        ARRAY['-- 097: check_liquidity_advance_eligibility + process_advance_request'])
ON CONFLICT (version) DO NOTHING;
