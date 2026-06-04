-- ════════════════════════════════════════════════════════════════════════════
-- Migration 111: Wire record_ai_decision into liquidity + tier flows
-- D2 of feat(explainable-ai) #83.
-- ════════════════════════════════════════════════════════════════════════════
-- Adds explainable-AI logging to two high-value decision points:
--
--   process_advance_request (migration 097, modified here)
--     Records a 'liquidity_denial' decision whenever an advance request
--     transitions from 'requested' → 'rejected'. The rendered explanation
--     uses the FIRST reason from check_liquidity_advance_eligibility as
--     CONDITION and structured fields from the eligibility JSONB as
--     CURRENT_VALUE. Decision is recorded ONCE per rejection event (since
--     process_advance_request is the state-transition gate, called once
--     per advance — not per eligibility re-check).
--
--   evaluate_member_tier (migration 040, modified here)
--     Records a 'tier_advancement' or 'tier_demotion' decision whenever
--     the member's tier actually changes. Skips 'initial' tier assignments
--     (no explanation needed when there's no previous tier). The scoring
--     pipeline calls evaluate_all_member_tiers daily, so this fires
--     organically as tiers shift.
--
-- Both functions preserve every existing behaviour bit-for-bit; the only
-- additions are the PERFORM record_ai_decision(...) calls at the
-- appropriate state-transition points. Idempotency: if the same advance
-- is processed twice (the first call would have flipped status away from
-- 'requested', so the second call exits early with "Cannot process") or
-- evaluate_member_tier is called twice with no tier change, no duplicate
-- decisions are recorded.
--
-- record_ai_decision (migration 110) handles language resolution +
-- template lookup + rendering automatically. If a template is missing
-- for the user's language it silently falls back to English.
-- ════════════════════════════════════════════════════════════════════════════


-- ── process_advance_request — record liquidity_denial on rejection ─────────

CREATE OR REPLACE FUNCTION public.process_advance_request(
  p_advance_id UUID,
  p_repayment_tier TEXT DEFAULT '30_day'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_advance RECORD;
  v_eligibility JSONB;
  v_fee_pct NUMERIC(5,2);
  v_repay_by_date DATE;
  v_rejection_text TEXT;
  v_first_reason TEXT;
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

  v_eligibility := check_liquidity_advance_eligibility(
    v_advance.member_id,
    v_advance.circle_id,
    v_advance.requested_amount_cents,
    p_advance_id
  );

  IF NOT (v_eligibility->>'eligible')::BOOLEAN THEN
    SELECT string_agg(value, '; ') INTO v_rejection_text
    FROM jsonb_array_elements_text(v_eligibility->'reasons');

    UPDATE liquidity_advances
    SET status = 'rejected',
        rejection_reason = v_rejection_text,
        updated_at = NOW()
    WHERE id = p_advance_id;

    -- NEW (D2 of feat(explainable-ai)): record the liquidity_denial.
    -- CONDITION = first reason from check_liquidity_advance_eligibility.
    -- THRESHOLD describes the minimums that any approval must meet.
    -- CURRENT_VALUE summarizes the member's current values for the
    -- three primary thresholds. SPECIFIC_ACTION is generic but
    -- actionable. record_ai_decision handles language + template
    -- selection; failure is non-fatal (we wrap in EXCEPTION so a
    -- record_ai_decision bug never blocks the rejection).
    v_first_reason := v_eligibility->'reasons'->>0;
    BEGIN
      PERFORM record_ai_decision(
        v_advance.member_id,
        'liquidity_denial',
        v_advance.requested_amount_cents::TEXT,
        jsonb_build_object(
          'CONDITION', COALESCE(v_first_reason, v_rejection_text),
          'THRESHOLD', 'XnScore 65, Tier 2 (Established), 2 completed circles',
          'CURRENT_VALUE', format(
            'XnScore %s, Tier %s, %s completed circles',
            COALESCE(v_eligibility->>'member_xnscore', '?'),
            COALESCE(v_eligibility->>'member_tier', '?'),
            COALESCE(v_eligibility->>'completed_cycles', '?')
          ),
          'SPECIFIC_ACTION', 'maintain on-time contributions, complete circles, and avoid defaults'
        ),
        p_advance_id,
        'liquidity_advance_request'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'record_ai_decision failed for advance %: %', p_advance_id, SQLERRM;
    END;

    RETURN jsonb_build_object(
      'success', true,
      'decision', 'rejected',
      'advance_id', p_advance_id,
      'reason_text', v_rejection_text,
      'eligibility', v_eligibility
    );
  END IF;

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
$function$;


-- ── evaluate_member_tier — record tier_advancement / tier_demotion ─────────

CREATE OR REPLACE FUNCTION public.evaluate_member_tier(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_xn RECORD;
  v_profile RECORD;
  v_current RECORD;
  v_tier RECORD;
  v_new_tier_key TEXT;
  v_new_tier_number INTEGER;
  v_previous_tier TEXT;
  v_changed BOOLEAN := false;
  v_change_type TEXT;
  v_reason TEXT;
  v_next_tier RECORD;
  v_progress_pct INTEGER := 0;
  v_action_items JSONB := '[]';
  v_score INTEGER;
  v_age INTEGER;
  v_completed INTEGER;
  v_defaults INTEGER;
  v_prev_tier_record RECORD;  -- NEW: for label lookup
BEGIN
  SELECT total_score, account_age_days
  INTO v_xn
  FROM xn_scores
  WHERE user_id = p_user_id;

  IF v_xn IS NULL THEN
    SELECT
      COALESCE(xn_score, 0)::INTEGER,
      GREATEST(0, EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)::INTEGER
    INTO v_score, v_age
    FROM profiles
    WHERE id = p_user_id;
    v_score := COALESCE(v_score, 0);
    v_age := COALESCE(v_age, 0);
  ELSE
    v_score := COALESCE(ROUND(v_xn.total_score), 0);
    v_age := COALESCE(v_xn.account_age_days, 0);
  END IF;

  SELECT circles_completed, default_count
  INTO v_profile
  FROM member_behavioral_profiles
  WHERE user_id = p_user_id;

  v_completed := COALESCE(v_profile.circles_completed, 0);
  v_defaults := COALESCE(v_profile.default_count, 0);

  SELECT * INTO v_tier
  FROM graduated_entry_tiers
  WHERE v_score >= xn_score_min AND v_score <= xn_score_max
  ORDER BY tier_number DESC
  LIMIT 1;

  IF v_tier IS NULL THEN
    SELECT * INTO v_tier FROM graduated_entry_tiers WHERE tier_key = 'critical';
  END IF;

  v_new_tier_key := v_tier.tier_key;
  v_new_tier_number := v_tier.tier_number;

  SELECT * INTO v_current FROM member_tier_status WHERE user_id = p_user_id;

  IF v_current IS NULL THEN
    v_changed := true;
    v_change_type := 'initial';
    v_previous_tier := NULL;
    v_reason := format('Initial tier assignment: %s (XnScore %s)', v_tier.label, v_score);
  ELSIF v_current.current_tier != v_new_tier_key THEN
    v_changed := true;
    v_previous_tier := v_current.current_tier;

    IF v_new_tier_number > v_current.tier_number THEN
      v_change_type := 'advancement';
      v_reason := format('Advanced from %s to %s (XnScore %s)',
        v_current.current_tier, v_new_tier_key, v_score);
    ELSE
      v_change_type := 'demotion';
      v_reason := format('Demoted from %s to %s (XnScore dropped to %s)',
        v_current.current_tier, v_new_tier_key, v_score);
    END IF;
  ELSE
    v_previous_tier := v_current.previous_tier;
  END IF;

  SELECT * INTO v_next_tier
  FROM graduated_entry_tiers
  WHERE tier_number = v_new_tier_number + 1;

  IF v_next_tier IS NOT NULL THEN
    IF (v_next_tier.xn_score_min - v_tier.xn_score_min) > 0 THEN
      v_progress_pct := LEAST(100, GREATEST(0,
        ROUND(((v_score - v_tier.xn_score_min)::DECIMAL / (v_next_tier.xn_score_min - v_tier.xn_score_min)) * 100)
      ));
    END IF;

    IF v_score < v_next_tier.xn_score_min THEN
      v_action_items := v_action_items || jsonb_build_object(
        'type', 'xn_score',
        'message', format('Earn %s more XnScore points to reach %s',
          v_next_tier.xn_score_min - v_score, v_next_tier.label),
        'current', v_score,
        'required', v_next_tier.xn_score_min
      );
    END IF;

    IF v_age < v_next_tier.min_account_age_days THEN
      v_action_items := v_action_items || jsonb_build_object(
        'type', 'account_age',
        'message', format('%s more days on platform needed for %s',
          v_next_tier.min_account_age_days - v_age, v_next_tier.label),
        'current', v_age,
        'required', v_next_tier.min_account_age_days
      );
    END IF;
  ELSE
    v_progress_pct := 100;
  END IF;

  INSERT INTO member_tier_status (
    user_id, current_tier, tier_number, previous_tier, tier_achieved_at,
    is_demoted, demotion_reason, demotion_path_back,
    max_circle_size, max_contribution_cents, position_access,
    xn_score_at_eval, account_age_at_eval, circles_completed_at_eval,
    next_tier, progress_pct, action_items
  ) VALUES (
    p_user_id, v_new_tier_key, v_new_tier_number, v_previous_tier,
    CASE WHEN v_changed THEN NOW() ELSE COALESCE(v_current.tier_achieved_at, NOW()) END,
    CASE WHEN v_change_type = 'demotion' THEN true ELSE false END,
    CASE WHEN v_change_type = 'demotion' THEN v_reason ELSE NULL END,
    CASE WHEN v_change_type = 'demotion' THEN
      format('Raise your XnScore back to %s to regain %s status',
        v_tier.xn_score_min + (v_next_tier.xn_score_min - v_tier.xn_score_min),
        COALESCE(v_previous_tier, v_new_tier_key))
    ELSE NULL END,
    v_tier.max_circle_size, v_tier.max_contribution_cents, v_tier.position_access,
    v_score, v_age, v_completed,
    CASE WHEN v_next_tier IS NOT NULL THEN v_next_tier.tier_key ELSE NULL END,
    v_progress_pct, v_action_items
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_tier = EXCLUDED.current_tier,
    tier_number = EXCLUDED.tier_number,
    previous_tier = CASE WHEN v_changed THEN v_previous_tier ELSE member_tier_status.previous_tier END,
    tier_achieved_at = CASE WHEN v_changed THEN NOW() ELSE member_tier_status.tier_achieved_at END,
    is_demoted = EXCLUDED.is_demoted,
    demotion_reason = EXCLUDED.demotion_reason,
    demotion_path_back = EXCLUDED.demotion_path_back,
    max_circle_size = EXCLUDED.max_circle_size,
    max_contribution_cents = EXCLUDED.max_contribution_cents,
    position_access = EXCLUDED.position_access,
    xn_score_at_eval = EXCLUDED.xn_score_at_eval,
    account_age_at_eval = EXCLUDED.account_age_at_eval,
    circles_completed_at_eval = EXCLUDED.circles_completed_at_eval,
    next_tier = EXCLUDED.next_tier,
    progress_pct = EXCLUDED.progress_pct,
    action_items = EXCLUDED.action_items,
    updated_at = NOW();

  IF v_changed THEN
    INSERT INTO member_tier_history (
      user_id, from_tier, to_tier, change_type, reason,
      xn_score, account_age_days, circles_completed
    ) VALUES (
      p_user_id, v_previous_tier, v_new_tier_key, v_change_type, v_reason,
      v_score, v_age, v_completed
    );

    -- NEW (D2 of feat(explainable-ai)): record explainable AI decision for
    -- real tier changes. Skip 'initial' (no previous tier to compare).
    IF v_change_type IN ('advancement', 'demotion') THEN
      -- Look up previous tier's label for human-readable output
      SELECT label INTO v_prev_tier_record
      FROM graduated_entry_tiers WHERE tier_key = v_previous_tier;

      BEGIN
        IF v_change_type = 'advancement' THEN
          PERFORM record_ai_decision(
            p_user_id,
            'tier_advancement',
            v_new_tier_key,
            jsonb_build_object(
              'PREVIOUS_TIER', COALESCE(v_prev_tier_record.label, v_previous_tier),
              'TIER_NAME', v_tier.label,
              'FEATURE_UNLOCKED', format(
                'circles up to %s members, contributions up to $%s, %s position access',
                v_tier.max_circle_size,
                ROUND(v_tier.max_contribution_cents / 100.0),
                v_tier.position_access
              )
            ),
            p_user_id,
            'member_tier_change'
          );
        ELSE  -- demotion
          PERFORM record_ai_decision(
            p_user_id,
            'tier_demotion',
            v_new_tier_key,
            jsonb_build_object(
              'PREVIOUS_TIER', COALESCE(v_prev_tier_record.label, v_previous_tier),
              'TIER_NAME', v_tier.label,
              'FACTOR_DESCRIPTION', format('your XnScore moved to %s', v_score),
              'SPECIFIC_ACTION', 'make on-time contributions, complete circles, and avoid defaults to recover'
            ),
            p_user_id,
            'member_tier_change'
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'record_ai_decision failed for tier change of %: %', p_user_id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'previous_tier', v_previous_tier,
    'new_tier', v_new_tier_key,
    'tier_number', v_new_tier_number,
    'changed', v_changed,
    'change_type', COALESCE(v_change_type, 'none'),
    'xn_score', v_score,
    'account_age', v_age,
    'circles_completed', v_completed,
    'progress_pct', v_progress_pct,
    'max_circle_size', v_tier.max_circle_size,
    'max_contribution_cents', v_tier.max_contribution_cents,
    'position_access', v_tier.position_access,
    'source', CASE WHEN v_xn IS NULL THEN 'profiles_fallback' ELSE 'xn_scores' END
  );
END;
$function$;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('111', 'wire_explainable_ai',
        ARRAY['-- 111: ExplainableAI D2 — wire record_ai_decision into process_advance_request + evaluate_member_tier'])
ON CONFLICT (version) DO NOTHING;
