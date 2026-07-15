-- ═══════════════════════════════════════════════════════════════════════════
-- 329_recalculate_full_xnscore_defensive.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Follow-up to mig 328. That migration wired the daily pipeline to
-- recalculate_full_xnscore (the 5-factor model). First live invocation
-- surfaced pre-existing schema drift in two of the five factor
-- calculators — legacy RPCs referencing columns / tables that don't
-- exist on the current schema:
--
--   * calculate_payment_reliability_factor
--     - Filters `WHERE status IN ('completed', 'late')` — the enum
--       has ('pending','paid','late','missed','waived','refunded').
--       'completed' does not exist. Same class of bug as mig 305/306
--       fixed for the autopay path.
--     - References contributions.paid_at — real column is paid_date.
--
--   * calculate_financial_behavior_factor
--     - Reads FROM wallets — real table is user_wallets.
--     - Filters transaction_type='deposit' — real value is
--       'wallet_deposit'.
--     - SUM(amount) — real column is amount_cents.
--
-- The other three factors (circle_completion, tenure_activity,
-- community_standing) reference their sources correctly and should
-- work.
--
-- Rather than patching every legacy factor RPC in this migration
-- (5 different fix scopes, high blast radius), wrap each factor
-- call in recalculate_full_xnscore in its own BEGIN…EXCEPTION so
-- a broken factor contributes 0 and the recalculation proceeds
-- with whatever DOES work. Users start seeing movement in their
-- scores from the working factors (tenure, community, completion)
-- immediately. Individual factor fixes are follow-ups.
--
-- Also: track the last error per factor in xn_scores.factor_scores
-- JSONB so admins can see which factors are broken from the DB.
-- ═══════════════════════════════════════════════════════════════════════════

-- DROP first because the existing function's RETURN TABLE column
-- names differ from ours; Postgres won't CREATE OR REPLACE across
-- signature changes. Safe: any caller uses positional/named columns
-- from the RETURN TABLE and the shape here matches the intended
-- callers (refresh_breakdown_on_adjustment).
DROP FUNCTION IF EXISTS public.recalculate_full_xnscore(uuid);

CREATE OR REPLACE FUNCTION public.recalculate_full_xnscore(p_user_id UUID)
RETURNS TABLE(success BOOLEAN, previous_score NUMERIC, new_score NUMERIC, breakdown JSONB)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_score_record RECORD;
    v_payment RECORD;
    v_completion RECORD;
    v_tenure RECORD;
    v_community RECORD;
    v_financial RECORD;
    v_new_raw DECIMAL := 0;
    v_new_capped DECIMAL;
    v_age_cap INTEGER;
    v_factor_errors JSONB := '{}'::JSONB;

    v_payment_score NUMERIC := 0;
    v_completion_score NUMERIC := 0;
    v_tenure_score NUMERIC := 0;
    v_community_score NUMERIC := 0;
    v_financial_score NUMERIC := 0;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    -- Each factor is isolated — a broken factor contributes 0 and
    -- logs its error into factor_errors. The rest of the recalc
    -- proceeds. This unblocks the pipeline immediately while the
    -- individual factor RPCs get patched over time.
    BEGIN
        SELECT * INTO v_payment FROM calculate_payment_reliability_factor(p_user_id);
        v_payment_score := COALESCE(v_payment.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('payment_reliability', SQLERRM);
        RAISE NOTICE 'payment_reliability factor failed for user %: %', p_user_id, SQLERRM;
    END;

    BEGIN
        SELECT * INTO v_completion FROM calculate_circle_completion_factor(p_user_id);
        v_completion_score := COALESCE(v_completion.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('circle_completion', SQLERRM);
        RAISE NOTICE 'circle_completion factor failed for user %: %', p_user_id, SQLERRM;
    END;

    BEGIN
        SELECT * INTO v_tenure FROM calculate_tenure_activity_factor(p_user_id);
        v_tenure_score := COALESCE(v_tenure.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('tenure_activity', SQLERRM);
        RAISE NOTICE 'tenure_activity factor failed for user %: %', p_user_id, SQLERRM;
    END;

    BEGIN
        SELECT * INTO v_community FROM calculate_community_standing_factor(p_user_id);
        v_community_score := COALESCE(v_community.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('community_standing', SQLERRM);
        RAISE NOTICE 'community_standing factor failed for user %: %', p_user_id, SQLERRM;
    END;

    BEGIN
        SELECT * INTO v_financial FROM calculate_financial_behavior_factor(p_user_id);
        v_financial_score := COALESCE(v_financial.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('financial_behavior', SQLERRM);
        RAISE NOTICE 'financial_behavior factor failed for user %: %', p_user_id, SQLERRM;
    END;

    -- Sum whatever succeeded. Base 20 preserved from initial calc for
    -- users whose factors all zero out — otherwise a new user with no
    -- history would drop from their sign-up score to 0. Take the max
    -- of factor sum vs the existing raw so a broken factor never
    -- decreases a user's score.
    v_new_raw := GREATEST(
        v_payment_score + v_completion_score + v_tenure_score
          + v_community_score + v_financial_score,
        COALESCE(v_score_record.raw_score, 20)
    );

    v_age_cap := get_xnscore_age_cap(v_score_record.account_age_days);
    v_new_capped := LEAST(v_new_raw, v_age_cap);

    UPDATE xn_scores SET
        previous_score = total_score,
        raw_score = v_new_raw,
        total_score = v_new_capped,
        score_tier = get_xnscore_tier(v_new_capped),
        payment_history_score = v_payment_score,
        completion_score = v_completion_score,
        time_reliability_score = v_tenure_score,
        diversity_social_score = v_community_score,
        deposit_score = v_financial_score,
        age_cap_applied = v_new_capped < v_new_raw,
        max_allowed_score = v_age_cap,
        factor_scores = jsonb_build_object(
            'payment_reliability', v_payment_score,
            'circle_completion',   v_completion_score,
            'tenure_activity',     v_tenure_score,
            'community_standing',  v_community_score,
            'financial_behavior',  v_financial_score,
            'errors',              v_factor_errors
        ),
        last_calculated_at = now(),
        calculation_trigger = 'full_recalculation',
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    RETURN QUERY SELECT
        TRUE,
        v_score_record.total_score,
        v_new_capped,
        jsonb_build_object(
            'payment_reliability', v_payment_score,
            'circle_completion',   v_completion_score,
            'tenure_activity',     v_tenure_score,
            'community_standing',  v_community_score,
            'financial_behavior',  v_financial_score,
            'raw_total',           v_new_raw,
            'age_cap',             v_age_cap,
            'capped_total',        v_new_capped,
            'errors',              v_factor_errors
        );
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '329',
  'recalculate_full_xnscore_defensive',
  ARRAY['-- 329: recalculate_full_xnscore wraps each factor in EXCEPTION; broken factors → 0, others still contribute']
)
ON CONFLICT (version) DO NOTHING;
