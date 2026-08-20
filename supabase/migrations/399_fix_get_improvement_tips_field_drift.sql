-- 399: Fix RECORD-field drift in get_improvement_tips
--
-- Follow-up to mig 398. When mig 398 landed, calculate_score_breakdown
-- got past its own drift, then blew up at line 119:
--
--   PL/pgSQL function calculate_score_breakdown(uuid) line 119
--     -> SELECT get_improvement_tips(p_user_id, 5)
--     -> ERROR 42703: record "v_payment" has no field
--                     "payment_streak_score"
--
-- get_improvement_tips declares its OWN v_payment / v_financial RECORD
-- vars (populated by calling calculate_payment_reliability_factor and
-- calculate_financial_behavior_factor directly), and then the CASE
-- inside its FOR loop reads the SAME drifted field names mig 398 just
-- fixed in calculate_score_breakdown.
--
-- Same rewrite pattern: match the current factor return signatures.
-- The xn_score_improvement_tips.component_key enum values stay
-- ('payment_streak', 'wallet_usage', 'payout_retention',
-- 'savings_engagement') — only the RHS RECORD reads change.
--
--   Referenced (broken)                    | Real return field
--   v_payment.payment_streak_score         | v_payment.streak_bonus_score
--   v_financial.wallet_usage_score         | v_financial.wallet_score
--   v_financial.payout_retention_score     | v_financial.retention_score
--   v_financial.savings_engagement_score   | v_financial.savings_score
--
-- Verified via LIVE-DB sweep (2026-08-20) that these are the only
-- remaining functions with the old field names:
--   SELECT proname FROM pg_proc
--   WHERE pg_get_functiondef(oid) LIKE '%payment_streak_score%'
--      OR pg_get_functiondef(oid) LIKE '%wallet_usage_score%'
--      OR pg_get_functiondef(oid) LIKE '%payout_retention_score%'
--      OR pg_get_functiondef(oid) LIKE '%savings_engagement_score%'
-- returned only calculate_score_breakdown (fixed in mig 398, matches
-- on its own comment) and get_improvement_tips (fixed here).

CREATE OR REPLACE FUNCTION public.get_improvement_tips(
  p_user_id uuid,
  p_limit integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    v_tips JSONB := '[]';
    v_tip RECORD;
    v_score_record RECORD;
    v_payment RECORD;
    v_completion RECORD;
    v_tenure RECORD;
    v_community RECORD;
    v_financial RECORD;
BEGIN
    -- Get current scores
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;
    SELECT * INTO v_payment    FROM calculate_payment_reliability_factor(p_user_id);
    SELECT * INTO v_completion FROM calculate_circle_completion_factor(p_user_id);
    SELECT * INTO v_tenure     FROM calculate_tenure_activity_factor(p_user_id);
    SELECT * INTO v_community  FROM calculate_community_standing_factor(p_user_id);
    SELECT * INTO v_financial  FROM calculate_financial_behavior_factor(p_user_id);

    -- Get applicable tips
    FOR v_tip IN
        SELECT
            t.*,
            CASE t.factor_key
                WHEN 'payment_reliability' THEN
                    CASE t.component_key
                        WHEN 'on_time_rate'   THEN v_payment.on_time_rate_score
                        -- mig 399: was v_payment.payment_streak_score (nonexistent field)
                        WHEN 'payment_streak' THEN v_payment.streak_bonus_score
                        WHEN 'no_defaults'    THEN v_payment.no_defaults_score
                        ELSE v_payment.total_score
                    END
                WHEN 'circle_completion' THEN
                    CASE t.component_key
                        WHEN 'completion_rate'  THEN v_completion.completion_rate_score
                        WHEN 'full_cycle_bonus' THEN v_completion.full_cycle_score
                        WHEN 'no_abandonment'   THEN v_completion.no_abandonment_score
                        ELSE v_completion.total_score
                    END
                WHEN 'tenure_activity' THEN
                    CASE t.component_key
                        WHEN 'account_age'     THEN v_tenure.account_age_score
                        WHEN 'tenure_bonus'    THEN v_tenure.tenure_bonus_score
                        WHEN 'recent_activity' THEN v_tenure.recent_activity_score
                        ELSE v_tenure.total_score
                    END
                WHEN 'community_standing' THEN
                    CASE t.component_key
                        WHEN 'vouches_received'     THEN v_community.vouches_received_score
                        WHEN 'member_diversity'     THEN v_community.member_diversity_score
                        WHEN 'elder_connections'    THEN v_community.elder_connections_score
                        WHEN 'vouching_reliability' THEN v_community.vouching_reliability_score
                        ELSE v_community.total_score
                    END
                WHEN 'financial_behavior' THEN
                    CASE t.component_key
                        -- mig 399: was v_financial.wallet_usage_score (nonexistent field)
                        WHEN 'wallet_usage'       THEN v_financial.wallet_score
                        -- mig 399: was v_financial.payout_retention_score (nonexistent field)
                        WHEN 'payout_retention'   THEN v_financial.retention_score
                        -- mig 399: was v_financial.savings_engagement_score (nonexistent field —
                        -- always 0 today per financial-factor comment; see mig 398 note about
                        -- deferred calculate_savings_behavior_factor wiring)
                        WHEN 'savings_engagement' THEN v_financial.savings_score
                        ELSE v_financial.total_score
                    END
            END as current_score
        FROM xn_score_improvement_tips t
        WHERE t.is_active = TRUE
        ORDER BY t.priority, t.potential_points DESC
    LOOP
        -- Check if tip applies based on thresholds
        IF (v_tip.max_score_threshold IS NULL OR v_tip.current_score <= v_tip.max_score_threshold)
           AND (v_tip.min_score_threshold IS NULL OR v_tip.current_score >= v_tip.min_score_threshold)
        THEN
            v_tips := v_tips || jsonb_build_object(
                'id',               v_tip.id,
                'factor',           v_tip.factor_key,
                'component',        v_tip.component_key,
                'title',            v_tip.tip_title,
                'description',      v_tip.tip_description,
                'action',           v_tip.tip_action,
                'priority',         v_tip.priority,
                'potential_points', v_tip.potential_points,
                'current_score',    ROUND(v_tip.current_score, 2)
            );

            IF jsonb_array_length(v_tips) >= p_limit THEN
                EXIT;
            END IF;
        END IF;
    END LOOP;

    RETURN v_tips;
END;
$function$;

-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '399',
  'fix_get_improvement_tips_field_drift',
  ARRAY['-- 399: fix_get_improvement_tips_field_drift']
)
ON CONFLICT (version) DO NOTHING;
