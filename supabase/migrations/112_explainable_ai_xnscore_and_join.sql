-- ════════════════════════════════════════════════════════════════════════════
-- Migration 112: ExplainableAI D3.3 + D4 — XnScore changes + circle join
-- rejection explanations
-- ════════════════════════════════════════════════════════════════════════════
-- Extends the explainability surface beyond liquidity denial + tier change
-- (wired in 111) to cover the two highest-traffic decision points the user
-- actually feels day to day:
--
--   D3.3  Every XnScore adjustment recorded via apply_xnscore_adjustment
--         emits an xnscore_increase or xnscore_decrease decision (skips
--         delta = 0 to avoid noise). Records via the central adjustment
--         function, so all callers (substitute completion, partial plan
--         activation, on-time/late contribution, queued increase flush)
--         get coverage for free.
--
--   D4    check_circle_eligibility records a circle_join_rejection
--         decision at every short-circuit RETURN before the eligible-row
--         response. Codes covered: NO_SCORE, SCORE_TOO_LOW, ACCOUNT_TOO_NEW
--         (90d + 180d), HAS_ACTIVE_DEBTS, FRAUD_REVIEW. CIRCLE_NOT_FOUND
--         intentionally skipped because the circle row itself is missing,
--         so there's nothing meaningful to record against.
--
-- Templates for both decision types were seeded earlier in 15 languages and
-- are confirmed active:
--   xnscore_increase     vars: POINTS, NEW_SCORE, FACTOR_DESCRIPTION
--   xnscore_decrease     vars: POINTS, NEW_SCORE, FACTOR_DESCRIPTION,
--                              SPECIFIC_ACTION
--   circle_join_rejection vars: CONDITION, THRESHOLD, CURRENT_VALUE,
--                              SPECIFIC_ACTION
--
-- All record_ai_decision calls are wrapped in BEGIN..EXCEPTION so a logging
-- failure (missing template, prod data quirk, etc.) never blocks the actual
-- state change or eligibility verdict the caller depends on.
--
-- One side note on check_circle_eligibility: it was previously declared
-- STABLE, which prohibits writes. To call record_ai_decision (an INSERT)
-- from inside, we must redeclare as VOLATILE. The function is meant to be
-- called once per check (not inside set-returning queries), so the planner
-- impact is nil.
-- ════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- D3.3: apply_xnscore_adjustment with decision recording
-- ════════════════════════════════════════════════════════════════════════════
-- Body preserved bit-for-bit from the live definition, with one BEGIN..EXCEPTION
-- block appended after the xnscore_history INSERT to record the decision.
-- search_path is now pinned (it wasn't before — pre-existing gap).

CREATE OR REPLACE FUNCTION public.apply_xnscore_adjustment(
  p_user_id UUID,
  p_adjustment NUMERIC,
  p_trigger_event TEXT,
  p_trigger_id UUID DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  previous_score NUMERIC,
  new_score NUMERIC,
  actual_adjustment NUMERIC,
  velocity_capped BOOLEAN,
  queued_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_score RECORD;
    v_profile RECORD;
    v_account_age_days INTEGER;
    v_age_cap INTEGER;
    v_velocity_check RECORD;
    v_actual_adjustment DECIMAL;
    v_new_raw DECIMAL;
    v_new_capped DECIMAL;
    v_queued DECIMAL := 0;
    -- D3.3 locals
    v_decision_type TEXT;
    v_factor TEXT;
    v_action TEXT;
    v_explain JSONB;
BEGIN
    -- Get current score
    SELECT * INTO v_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        -- Calculate initial score first
        PERFORM calculate_initial_xnscore(p_user_id);
        SELECT * INTO v_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;
    END IF;

    -- Check if score is frozen
    IF v_score.score_frozen THEN
        RETURN QUERY SELECT FALSE, v_score.total_score, v_score.total_score, 0::DECIMAL, FALSE, 0::DECIMAL;
        RETURN;
    END IF;

    -- Get age cap
    SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
    v_account_age_days := EXTRACT(DAY FROM (now() - v_profile.created_at))::INTEGER;
    v_age_cap := get_xnscore_age_cap(v_account_age_days);

    -- For positive adjustments, check velocity cap
    IF p_adjustment > 0 THEN
        SELECT * INTO v_velocity_check FROM check_velocity_cap(p_user_id, p_adjustment);

        IF NOT v_velocity_check.allowed THEN
            v_actual_adjustment := v_velocity_check.allowed_increase;
            v_queued := p_adjustment - v_actual_adjustment;

            -- Queue the overflow
            IF v_queued > 0 THEN
                INSERT INTO xnscore_queued_increases (
                    user_id, amount, reason, source_event, source_id, process_after
                ) VALUES (
                    p_user_id, v_queued, 'velocity_cap_overflow', p_trigger_event, p_trigger_id,
                    date_trunc('week', now() + INTERVAL '1 week')::DATE
                );
            END IF;
        ELSE
            v_actual_adjustment := p_adjustment;
        END IF;
    ELSE
        -- Negative adjustments bypass velocity (immediate)
        v_actual_adjustment := p_adjustment;
    END IF;

    -- Calculate new scores
    v_new_raw := v_score.raw_score + v_actual_adjustment;
    v_new_capped := LEAST(GREATEST(0, v_new_raw), v_age_cap);

    -- Update score
    UPDATE xn_scores SET
        previous_score = total_score,
        total_score = v_new_capped,
        raw_score = v_new_raw,
        score_tier = get_xnscore_tier(v_new_capped),
        age_cap_applied = v_new_capped < v_new_raw,
        max_allowed_score = v_age_cap,
        account_age_days = v_account_age_days,
        points_gained_this_week = CASE
            WHEN v_actual_adjustment > 0 THEN points_gained_this_week + v_actual_adjustment
            ELSE points_gained_this_week
        END,
        last_calculated_at = now(),
        calculation_trigger = p_trigger_event,
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    -- Log to history
    INSERT INTO xnscore_history (
        user_id, score, previous_score, score_change,
        trigger_event, trigger_id,
        raw_score_before_cap, age_cap_applied, age_cap_value,
        weekly_points_before, weekly_points_after,
        velocity_capped
    ) VALUES (
        p_user_id, v_new_capped, v_score.total_score, v_new_capped - v_score.total_score,
        p_trigger_event, p_trigger_id,
        v_new_raw, v_new_capped < v_new_raw, v_age_cap,
        v_score.points_gained_this_week,
        CASE WHEN v_actual_adjustment > 0 THEN v_score.points_gained_this_week + v_actual_adjustment ELSE v_score.points_gained_this_week END,
        v_queued > 0
    );

    -- ─────────────────────────────────────────────────────────────────────
    -- D3.3 (ExplainableAI #83): record the score change as an AI decision
    -- so the member sees an explanation in DecisionHistoryScreen. Only
    -- when the effective adjustment is non-zero — a zero adjustment means
    -- the score was frozen or velocity-capped to nothing, neither of which
    -- warrants a notification. Wrapped in BEGIN..EXCEPTION so any logging
    -- failure can't roll back the actual XnScore update.
    -- ─────────────────────────────────────────────────────────────────────
    IF v_actual_adjustment <> 0 THEN
        v_decision_type := CASE
            WHEN v_actual_adjustment > 0 THEN 'xnscore_increase'
            ELSE 'xnscore_decrease'
        END;

        v_factor := CASE p_trigger_event
            WHEN 'on_time_contribution'      THEN 'you made an on-time contribution'
            WHEN 'early_contribution'        THEN 'you made an early contribution'
            WHEN 'late_contribution'         THEN 'you made a late contribution'
            WHEN 'missed_contribution'       THEN 'you missed a contribution'
            WHEN 'on_time_loan_payment'      THEN 'you repaid a loan on time'
            WHEN 'early_loan_payment'        THEN 'you repaid a loan early'
            WHEN 'late_loan_payment'         THEN 'you repaid a loan late'
            WHEN 'missed_loan_payment'       THEN 'you missed a loan payment'
            WHEN 'loan_default'              THEN 'a loan default was recorded against your account'
            WHEN 'completed_cycle'           THEN 'you completed a circle cycle'
            WHEN 'first_circle_completed'    THEN 'you completed your first circle'
            WHEN 'swap_completed'            THEN 'you completed a position swap'
            WHEN 'partial_plan_activated'    THEN 'you activated a partial-contribution plan'
            WHEN 'partial_plan_completed'    THEN 'you completed a partial-contribution plan'
            WHEN 'early_exit'                THEN 'you left a circle early'
            WHEN 'group_creation'            THEN 'you created a new circle'
            WHEN 'referral_success'          THEN 'a member you referred joined'
            WHEN 'voucher_received'          THEN 'you received an elder voucher'
            WHEN 'streak_milestone'          THEN 'you hit a contribution-streak milestone'
            WHEN 'queued_increase_flushed'   THEN 'previously-queued points were applied'
            ELSE                                  format('the system recorded "%s"', p_trigger_event)
        END;

        v_explain := jsonb_build_object(
            'POINTS',             ROUND(ABS(v_actual_adjustment), 1)::TEXT,
            'NEW_SCORE',          ROUND(v_new_capped, 0)::TEXT,
            'FACTOR_DESCRIPTION', v_factor,
            'old_score',          v_score.total_score,
            'delta',              v_actual_adjustment,
            'reason',             p_trigger_event,
            'velocity_capped',    v_queued > 0,
            'queued_amount',      v_queued
        );

        -- xnscore_decrease template also requires a SPECIFIC_ACTION slot
        IF v_decision_type = 'xnscore_decrease' THEN
            v_action := CASE p_trigger_event
                WHEN 'missed_contribution'   THEN 'make your next contribution on time'
                WHEN 'late_contribution'     THEN 'make your next contribution on time'
                WHEN 'missed_loan_payment'   THEN 'catch up on the missed loan payment'
                WHEN 'late_loan_payment'     THEN 'make future loan payments on time'
                WHEN 'loan_default'          THEN 'settle the outstanding debt to start recovery'
                WHEN 'early_exit'            THEN 'complete your next circle in full'
                ELSE                              'maintain on-time payments going forward'
            END;
            v_explain := v_explain || jsonb_build_object('SPECIFIC_ACTION', v_action);
        END IF;

        BEGIN
            PERFORM record_ai_decision(
                p_member_id        := p_user_id,
                p_decision_type    := v_decision_type,
                p_decision_value   := ROUND(v_new_capped, 0)::TEXT,
                p_explanation_data := v_explain,
                p_source_event_id  := p_trigger_id,
                p_source_event_type := 'xnscore_' || p_trigger_event
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'record_ai_decision (xnscore_change) failed for user=%, trigger=%: %',
                p_user_id, p_trigger_event, SQLERRM;
        END;
    END IF;
    -- ─────────────────────────────────────────────────────────────────────

    RETURN QUERY SELECT
        TRUE,
        v_score.total_score,
        v_new_capped,
        v_actual_adjustment,
        v_queued > 0,
        v_queued;
END;
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- D4: check_circle_eligibility records circle_join_rejection at each rejection
-- ════════════════════════════════════════════════════════════════════════════
-- Was previously STABLE; redeclared VOLATILE so the function can INSERT into
-- ai_decisions via record_ai_decision. Body otherwise mirrors the live
-- definition exactly — same rejection codes, same eligible branch.

CREATE OR REPLACE FUNCTION public.check_circle_eligibility(
  p_user_id UUID,
  p_circle_id UUID
)
RETURNS TABLE(
  eligible BOOLEAN,
  reason TEXT,
  code TEXT,
  current_score NUMERIC,
  required_score INTEGER,
  position_restrictions JSONB
)
LANGUAGE plpgsql
VOLATILE                       -- was STABLE; we now write to ai_decisions
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_score RECORD;
    v_circle RECORD;
    v_contribution_amount DECIMAL;
    v_min_required INTEGER;
    v_active_defaults INTEGER;
    v_fraud_frozen BOOLEAN;
    v_position_restrictions JSONB;
    v_explain JSONB;
BEGIN
    -- Get XnScore
    SELECT * INTO v_score FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        BEGIN
            v_explain := jsonb_build_object(
                'CONDITION',       'you do not yet have a calculated XnScore',
                'THRESHOLD',       'any score',
                'CURRENT_VALUE',   'no score on file',
                'SPECIFIC_ACTION', 'complete account onboarding to generate your initial XnScore',
                'code',            'NO_SCORE'
            );
            PERFORM record_ai_decision(
                p_member_id := p_user_id,
                p_decision_type := 'circle_join_rejection',
                p_decision_value := 'NO_SCORE',
                p_explanation_data := v_explain,
                p_source_event_id := p_circle_id,
                p_source_event_type := 'circle_eligibility_check'
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'record_ai_decision (circle_join_rejection/NO_SCORE) failed: %', SQLERRM;
        END;

        RETURN QUERY SELECT
            FALSE, 'No XnScore calculated'::TEXT, 'NO_SCORE'::TEXT,
            0::DECIMAL, 0, '{}'::JSONB;
        RETURN;
    END IF;

    -- Get circle
    SELECT * INTO v_circle FROM circles WHERE id = p_circle_id;

    IF NOT FOUND THEN
        -- Intentionally NO decision recorded: the circle itself doesn't exist
        -- so there's no meaningful `source_event` to bind the explanation to,
        -- and surfacing "circle missing" in the member's decision history
        -- would be more confusing than helpful.
        RETURN QUERY SELECT
            FALSE, 'Circle not found'::TEXT, 'CIRCLE_NOT_FOUND'::TEXT,
            v_score.total_score, 0, '{}'::JSONB;
        RETURN;
    END IF;

    -- NB: the live circles table column is `amount` (not `contribution_amount`).
    -- The prior function definition referenced `contribution_amount` which
    -- would error at runtime on any caller reaching this path. Fixed in 112.
    v_contribution_amount := v_circle.amount;

    -- Determine minimum score based on contribution amount
    IF v_contribution_amount >= 1000 THEN
        v_min_required := 75;
    ELSIF v_contribution_amount >= 500 THEN
        v_min_required := 60;
    ELSIF v_contribution_amount >= 200 THEN
        v_min_required := 45;
    ELSE
        v_min_required := 25;
    END IF;

    -- Check minimum score
    IF v_score.total_score < v_min_required THEN
        BEGIN
            v_explain := jsonb_build_object(
                'CONDITION',       'your XnScore is below this circle''s minimum',
                'THRESHOLD',       v_min_required::TEXT,
                'CURRENT_VALUE',   ROUND(v_score.total_score, 0)::TEXT,
                'SPECIFIC_ACTION', format('build your XnScore to %s by making on-time contributions and completing a smaller circle first', v_min_required),
                'code',            'SCORE_TOO_LOW',
                'circle_id',       p_circle_id,
                'contribution_amount', v_contribution_amount
            );
            PERFORM record_ai_decision(
                p_member_id := p_user_id,
                p_decision_type := 'circle_join_rejection',
                p_decision_value := 'SCORE_TOO_LOW',
                p_explanation_data := v_explain,
                p_source_event_id := p_circle_id,
                p_source_event_type := 'circle_eligibility_check'
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'record_ai_decision (circle_join_rejection/SCORE_TOO_LOW) failed: %', SQLERRM;
        END;

        RETURN QUERY SELECT
            FALSE,
            format('XnScore %s below minimum %s for this circle', v_score.total_score, v_min_required),
            'SCORE_TOO_LOW'::TEXT,
            v_score.total_score, v_min_required, '{}'::JSONB;
        RETURN;
    END IF;

    -- Check account age for high-value circles (>= $500 needs 90 days)
    IF v_contribution_amount >= 500 AND v_score.account_age_days < 90 THEN
        BEGIN
            v_explain := jsonb_build_object(
                'CONDITION',       'your account is too new for high-value circles',
                'THRESHOLD',       '90 days',
                'CURRENT_VALUE',   v_score.account_age_days::TEXT || ' days',
                'SPECIFIC_ACTION', 'wait until your account reaches 90 days, or join a smaller circle in the meantime',
                'code',            'ACCOUNT_TOO_NEW',
                'minimum_days',    90,
                'circle_id',       p_circle_id
            );
            PERFORM record_ai_decision(
                p_member_id := p_user_id,
                p_decision_type := 'circle_join_rejection',
                p_decision_value := 'ACCOUNT_TOO_NEW',
                p_explanation_data := v_explain,
                p_source_event_id := p_circle_id,
                p_source_event_type := 'circle_eligibility_check'
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'record_ai_decision (circle_join_rejection/ACCOUNT_TOO_NEW 90d) failed: %', SQLERRM;
        END;

        RETURN QUERY SELECT
            FALSE,
            'Account must be at least 90 days old for circles >= $500'::TEXT,
            'ACCOUNT_TOO_NEW'::TEXT,
            v_score.total_score, v_min_required, '{}'::JSONB;
        RETURN;
    END IF;

    -- Check account age for very-high-value circles (>= $1000 needs 180 days)
    IF v_contribution_amount >= 1000 AND v_score.account_age_days < 180 THEN
        BEGIN
            v_explain := jsonb_build_object(
                'CONDITION',       'your account is too new for premium circles',
                'THRESHOLD',       '180 days',
                'CURRENT_VALUE',   v_score.account_age_days::TEXT || ' days',
                'SPECIFIC_ACTION', 'wait until your account reaches 180 days, or join a smaller circle in the meantime',
                'code',            'ACCOUNT_TOO_NEW',
                'minimum_days',    180,
                'circle_id',       p_circle_id
            );
            PERFORM record_ai_decision(
                p_member_id := p_user_id,
                p_decision_type := 'circle_join_rejection',
                p_decision_value := 'ACCOUNT_TOO_NEW',
                p_explanation_data := v_explain,
                p_source_event_id := p_circle_id,
                p_source_event_type := 'circle_eligibility_check'
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'record_ai_decision (circle_join_rejection/ACCOUNT_TOO_NEW 180d) failed: %', SQLERRM;
        END;

        RETURN QUERY SELECT
            FALSE,
            'Account must be at least 180 days old for circles >= $1000'::TEXT,
            'ACCOUNT_TOO_NEW'::TEXT,
            v_score.total_score, v_min_required, '{}'::JSONB;
        RETURN;
    END IF;

    -- Check for active defaults
    SELECT COUNT(*) INTO v_active_defaults
    FROM member_debts
    WHERE member_debts.user_id = p_user_id AND debt_status IN ('pending', 'repaying');

    IF v_active_defaults > 0 THEN
        BEGIN
            v_explain := jsonb_build_object(
                'CONDITION',       'you have unresolved debts from a previous circle',
                'THRESHOLD',       '0 active debts',
                'CURRENT_VALUE',   v_active_defaults::TEXT || ' active debts',
                'SPECIFIC_ACTION', 'settle the outstanding debt(s), then try again',
                'code',            'HAS_ACTIVE_DEBTS',
                'circle_id',       p_circle_id
            );
            PERFORM record_ai_decision(
                p_member_id := p_user_id,
                p_decision_type := 'circle_join_rejection',
                p_decision_value := 'HAS_ACTIVE_DEBTS',
                p_explanation_data := v_explain,
                p_source_event_id := p_circle_id,
                p_source_event_type := 'circle_eligibility_check'
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'record_ai_decision (circle_join_rejection/HAS_ACTIVE_DEBTS) failed: %', SQLERRM;
        END;

        RETURN QUERY SELECT
            FALSE,
            'Cannot join circles with unresolved debts'::TEXT,
            'HAS_ACTIVE_DEBTS'::TEXT,
            v_score.total_score, v_min_required, '{}'::JSONB;
        RETURN;
    END IF;

    -- Check if flagged for fraud
    SELECT score_frozen INTO v_fraud_frozen
    FROM xnscore_fraud_signals
    WHERE xnscore_fraud_signals.user_id = p_user_id;

    IF v_fraud_frozen = TRUE THEN
        BEGIN
            v_explain := jsonb_build_object(
                'CONDITION',       'your account is currently under review',
                'THRESHOLD',       'clear review status',
                'CURRENT_VALUE',   'flagged for review',
                'SPECIFIC_ACTION', 'contact support to resolve the review before joining new circles',
                'code',            'FRAUD_REVIEW',
                'circle_id',       p_circle_id
            );
            PERFORM record_ai_decision(
                p_member_id := p_user_id,
                p_decision_type := 'circle_join_rejection',
                p_decision_value := 'FRAUD_REVIEW',
                p_explanation_data := v_explain,
                p_source_event_id := p_circle_id,
                p_source_event_type := 'circle_eligibility_check'
            );
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'record_ai_decision (circle_join_rejection/FRAUD_REVIEW) failed: %', SQLERRM;
        END;

        RETURN QUERY SELECT
            FALSE,
            'Account under review'::TEXT,
            'FRAUD_REVIEW'::TEXT,
            v_score.total_score, v_min_required, '{}'::JSONB;
        RETURN;
    END IF;

    -- Calculate position restrictions
    v_position_restrictions := jsonb_build_object(
        'can_take_early_position',  v_score.total_score >= 70,
        'can_take_first_position',  v_score.total_score >= 80,
        'max_early_position', CASE
            WHEN v_score.total_score >= 80 THEN 1
            WHEN v_score.total_score >= 70 THEN 3
            ELSE CEIL(v_circle.member_count::DECIMAL / 2)
        END
    );

    -- Eligible!
    RETURN QUERY SELECT
        TRUE,
        'Eligible to join'::TEXT,
        'ELIGIBLE'::TEXT,
        v_score.total_score,
        v_min_required,
        v_position_restrictions;
END;
$function$;


-- ════════════════════════════════════════════════════════════════════════════
-- Grants (preserve prior permission shape: both functions were SECURITY DEFINER
-- and callable by authenticated users + service_role)
-- ════════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.apply_xnscore_adjustment(UUID, NUMERIC, TEXT, UUID)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.check_circle_eligibility(UUID, UUID)
  TO authenticated, service_role;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('112', 'explainable_ai_xnscore_and_join',
        ARRAY['-- 112: ExplainableAI D3.3 + D4 — wire xnscore + join eligibility decisions'])
ON CONFLICT (version) DO NOTHING;
