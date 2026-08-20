-- 398: Fix XnScore breakdown chain
--
-- Two bugs in the get_score_breakdown → calculate_score_breakdown →
-- factor-function chain, both surfaced by the runtime error
-- `column "amount_cents" does not exist` on useXnScoreBreakdown.
--
-- ── Bug 1 (currently firing) ────────────────────────────────────────────
-- calculate_payment_reliability_factor's unified CTE queries
-- `contributions.amount_cents`, but the contributions table has no
-- amount_cents column. Verified against the live schema on 2026-08-20:
--
--   contributions.amount              NUMERIC   (dollars)
--   circle_contributions.amount       NUMERIC   (dollars)
--   wallet_transactions.amount_cents  BIGINT    (cents — the ONLY table
--                                                with a cents-suffixed
--                                                column in this trio)
--
-- Mig 396b's own manual-arm SELECT on circle_contributions already
-- converts dollars → cents via ROUND(amount * 100). Apply the same
-- conversion in the contributions arm.
--
-- ── Bug 2 (latent, fires once Bug 1 lands) ──────────────────────────────
-- calculate_score_breakdown references RECORD fields that no longer
-- exist on the factor-function return signatures after mig 330 / 396b
-- reshaped them:
--
--   Referenced (broken)                    | Real return field
--   v_payment.payment_streak_score         | v_payment.streak_bonus_score
--   v_payment.component_details            | v_payment.details
--   v_financial.wallet_usage_score         | v_financial.wallet_score
--   v_financial.payout_retention_score     | v_financial.retention_score
--   v_financial.savings_engagement_score   | v_financial.savings_score
--   v_financial.component_details          | v_financial.details
--
-- (Completion / tenure / community factor return signatures still use
-- `component_details`, so those RECORD reads stay unchanged.)
--
-- The JSON OUTPUT keys (`components.payment_streak`, `components.wallet_usage`,
-- `details`, etc.) stay identical so the client's shape assumptions in
-- XnScoreDashboardScreen / ScoreBreakdownEngine do not change. Only the
-- internal RECORD-field reads are corrected.
--
-- ── Not addressed here (filed as separate follow-ups) ───────────────────
-- * `recalculate_full_xnscore` also declares v_payment / v_financial
--   RECORDs and likely has the same field-name drift. It's in a
--   different call chain (compute_xnscore path, not get_score_breakdown)
--   and isn't part of the reported failure. Its own migration.
-- * Mig 396 added `calculate_savings_behavior_factor` (10-pt savings
--   pillar) but `calculate_score_breakdown` still surfaces savings via
--   the always-zero `savings_engagement` slot inside financial_behavior.
--   Wiring the new factor in changes the client-visible JSON shape and
--   deserves its own migration.

-- ─── Fix 1: calculate_payment_reliability_factor ────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_payment_reliability_factor(p_user_id uuid)
RETURNS TABLE(
  total_score numeric,
  on_time_rate_score numeric,
  streak_bonus_score numeric,
  no_defaults_score numeric,
  late_recovery_score numeric,
  details jsonb
)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_count           INTEGER := 0;
    v_on_time_count         INTEGER := 0;
    v_late_count            INTEGER := 0;
    v_late_recovered_count  INTEGER := 0;
    v_total_amount_cents    BIGINT  := 0;
    v_on_time_amount_cents  BIGINT  := 0;
    v_on_time_pct_count     DECIMAL;
    v_on_time_pct_amount    DECIMAL;
    v_score_record          RECORD;

    v_on_time_rate    DECIMAL := 0;
    v_streak_bonus    DECIMAL := 0;
    v_no_defaults     DECIMAL := 0;
    v_late_recovery   DECIMAL := 0;
    v_late_recovery_computed DECIMAL := 0;
    v_details         JSONB;

    v_autopay_count INTEGER := 0;
    v_manual_count  INTEGER := 0;
    v_has_score     BOOLEAN := FALSE;
    v_locked_pts    NUMERIC := 0;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;
    v_has_score := FOUND;
    IF v_has_score THEN
        v_locked_pts := COALESCE(v_score_record.late_recovery_locked_pts, 0);
    END IF;

    -- Unified view over autopay + manual contribution rows. Now carries
    -- amount_cents alongside the on-time / late flags. V16 partial
    -- exclusion happens INSIDE each source arm.
    --
    -- mig 398: contributions.amount is NUMERIC dollars — NOT amount_cents.
    -- Convert with ROUND(amount * 100) here, mirroring the manual arm
    -- below. Previous version queried a non-existent
    -- contributions.amount_cents column and blew up the whole breakdown.
    WITH unified AS (
        -- Autopay path. V16: exclude 'partial' status (INERT today —
        -- current enum is 'paid'/'late' only, but the CHECK doesn't
        -- prohibit adding 'partial' later).
        SELECT
            status::text AS status,
            CASE
              WHEN status::text = 'paid' THEN
                (paid_at IS NULL OR paid_at::date <= due_date)
              ELSE FALSE
            END AS was_on_time,
            (status::text = 'late') AS was_late,
            (status::text = 'late' AND paid_at IS NOT NULL) AS late_recovered,
            COALESCE(ROUND(amount * 100)::BIGINT, 0) AS amount_cents
        FROM contributions
        WHERE user_id = p_user_id
          AND status::text <> 'partial'

        UNION ALL

        -- Manual path. amount is NUMERIC dollars; convert to cents.
        -- V16: exclude 'partial' status.
        SELECT
            status,
            CASE
              WHEN status = 'paid' THEN
                COALESCE(is_on_time, paid_date <= due_date::timestamptz, TRUE)
              ELSE FALSE
            END,
            (status = 'paid' AND NOT COALESCE(is_on_time, paid_date <= due_date::timestamptz, TRUE)),
            (status = 'paid' AND NOT COALESCE(is_on_time, paid_date <= due_date::timestamptz, TRUE)
                             AND paid_date IS NOT NULL),
            COALESCE(ROUND(amount * 100)::BIGINT, 0)
        FROM circle_contributions
        WHERE user_id = p_user_id
          AND status <> 'partial'
    )
    SELECT
        COUNT(*)                                                   FILTER (WHERE status IN ('paid', 'late')),
        COUNT(*)                                                   FILTER (WHERE was_on_time),
        COUNT(*)                                                   FILTER (WHERE was_late),
        COUNT(*)                                                   FILTER (WHERE late_recovered),
        COALESCE(SUM(amount_cents) FILTER (WHERE status IN ('paid', 'late')), 0),
        COALESCE(SUM(amount_cents) FILTER (WHERE was_on_time), 0)
    INTO v_total_count, v_on_time_count, v_late_count, v_late_recovered_count,
         v_total_amount_cents, v_on_time_amount_cents
    FROM unified;

    SELECT COUNT(*) INTO v_autopay_count
      FROM contributions
     WHERE user_id = p_user_id
       AND status::text IN ('paid', 'late');
    SELECT COUNT(*) INTO v_manual_count
      FROM circle_contributions
     WHERE user_id = p_user_id
       AND status IN ('paid', 'late');

    -- V5: amount-weighted on_time_rate. Falls back to count-based only
    -- if all matching contributions have zero amount (shouldn't happen
    -- in prod but keeps the function defensive).
    IF v_total_amount_cents > 0 THEN
        v_on_time_pct_amount := v_on_time_amount_cents::DECIMAL / v_total_amount_cents;
        v_on_time_rate := LEAST(20, v_on_time_pct_amount * 20);
    ELSIF v_total_count > 0 THEN
        v_on_time_pct_count := v_on_time_count::DECIMAL / v_total_count;
        v_on_time_rate := LEAST(20, v_on_time_pct_count * 20);
    END IF;

    -- Kept for details/observability
    IF v_total_count > 0 THEN
        v_on_time_pct_count := v_on_time_count::DECIMAL / v_total_count;
    END IF;

    IF v_has_score THEN
        v_streak_bonus := LEAST(8,
          (LEAST(COALESCE(v_score_record.payment_streak, 0), 20)::DECIMAL / 20) * 8);
    END IF;

    IF v_has_score
       AND NOT COALESCE(v_score_record.has_defaults, FALSE) THEN
        v_no_defaults := 5;
    END IF;

    -- V10 late-recovery. Compute would-be value, then floor at locked_pts.
    IF v_late_count > 0 AND v_late_recovered_count > 0 THEN
        v_late_recovery_computed := LEAST(2,
          (v_late_recovered_count::DECIMAL / v_late_count) * 2);
    END IF;
    v_late_recovery := GREATEST(v_locked_pts, v_late_recovery_computed);

    v_details := jsonb_build_object(
        'total_contributions',       v_total_count,
        'autopay_contributions',     v_autopay_count,
        'manual_contributions',      v_manual_count,
        'on_time_contributions',     v_on_time_count,
        'on_time_percentage',        ROUND(COALESCE(v_on_time_pct_count * 100, 0), 1),
        'on_time_amount_percentage', ROUND(COALESCE(v_on_time_pct_amount * 100, 0), 1),
        'total_amount_cents',        v_total_amount_cents,
        'on_time_amount_cents',      v_on_time_amount_cents,
        'current_streak',            COALESCE(v_score_record.payment_streak, 0),
        'best_streak',               COALESCE(v_score_record.best_payment_streak, 0),
        'has_defaults',              COALESCE(v_score_record.has_defaults, FALSE),
        'default_count',             COALESCE(v_score_record.default_count, 0),
        'late_payments',             v_late_count,
        'late_recovered',            v_late_recovered_count,
        'late_recovery_computed',    v_late_recovery_computed,
        'late_recovery_locked_pts',  v_locked_pts
    );

    RETURN QUERY SELECT
        ROUND(v_on_time_rate + v_streak_bonus + v_no_defaults + v_late_recovery, 2),
        ROUND(v_on_time_rate, 2),
        ROUND(v_streak_bonus, 2),
        ROUND(v_no_defaults, 2),
        ROUND(v_late_recovery, 2),
        v_details;
END;
$function$;

-- ─── Fix 2: calculate_score_breakdown ────────────────────────────────────
-- Correct 6 RECORD-field references to match the current factor return
-- signatures. JSON output keys unchanged (client contract preserved).
CREATE OR REPLACE FUNCTION public.calculate_score_breakdown(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    v_score_record   RECORD;
    v_payment        RECORD;
    v_completion     RECORD;
    v_tenure         RECORD;
    v_community      RECORD;
    v_financial      RECORD;
    v_previous_cache RECORD;

    v_total_calculated DECIMAL;
    v_breakdown        JSONB;
    v_tips             JSONB;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'User score not found');
    END IF;

    SELECT * INTO v_previous_cache FROM xn_score_breakdown_cache WHERE user_id = p_user_id;

    SELECT * INTO v_payment    FROM calculate_payment_reliability_factor(p_user_id);
    SELECT * INTO v_completion FROM calculate_circle_completion_factor(p_user_id);
    SELECT * INTO v_tenure     FROM calculate_tenure_activity_factor(p_user_id);
    SELECT * INTO v_community  FROM calculate_community_standing_factor(p_user_id);
    SELECT * INTO v_financial  FROM calculate_financial_behavior_factor(p_user_id);

    v_total_calculated := COALESCE(v_payment.total_score,    0) +
                          COALESCE(v_completion.total_score, 0) +
                          COALESCE(v_tenure.total_score,     0) +
                          COALESCE(v_community.total_score,  0) +
                          COALESCE(v_financial.total_score,  0);

    v_breakdown := jsonb_build_object(
        'payment_reliability', jsonb_build_object(
            'score',     COALESCE(v_payment.total_score, 0),
            'max_score', 35,
            'weight',    35,
            'status',    get_factor_status(COALESCE(v_payment.total_score, 0), 35)::TEXT,
            'trend',     get_factor_trend(COALESCE(v_payment.total_score, 0),
                                          v_previous_cache.payment_reliability_score)::TEXT,
            'components', jsonb_build_object(
                'on_time_rate',   jsonb_build_object('score', v_payment.on_time_rate_score,  'max', 20),
                -- mig 398: was v_payment.payment_streak_score (nonexistent field)
                'payment_streak', jsonb_build_object('score', v_payment.streak_bonus_score,  'max', 8),
                'no_defaults',    jsonb_build_object('score', v_payment.no_defaults_score,   'max', 5),
                'late_recovery',  jsonb_build_object('score', v_payment.late_recovery_score, 'max', 2)
            ),
            -- mig 398: was v_payment.component_details (nonexistent field)
            'details', v_payment.details
        ),
        'circle_completion', jsonb_build_object(
            'score',     COALESCE(v_completion.total_score, 0),
            'max_score', 20,
            'weight',    20,
            'status',    get_factor_status(COALESCE(v_completion.total_score, 0), 20)::TEXT,
            'trend',     get_factor_trend(COALESCE(v_completion.total_score, 0),
                                          v_previous_cache.circle_completion_score)::TEXT,
            'components', jsonb_build_object(
                'completion_rate', jsonb_build_object('score', v_completion.completion_rate_score, 'max', 12),
                'full_cycle',      jsonb_build_object('score', v_completion.full_cycle_score,      'max', 5),
                'no_abandonment',  jsonb_build_object('score', v_completion.no_abandonment_score,  'max', 3)
            ),
            'details', v_completion.component_details
        ),
        'tenure_activity', jsonb_build_object(
            'score',     COALESCE(v_tenure.total_score, 0),
            'max_score', 15,
            'weight',    15,
            'status',    get_factor_status(COALESCE(v_tenure.total_score, 0), 15)::TEXT,
            'trend',     get_factor_trend(COALESCE(v_tenure.total_score, 0),
                                          v_previous_cache.tenure_activity_score)::TEXT,
            'components', jsonb_build_object(
                'account_age',     jsonb_build_object('score', v_tenure.account_age_score,     'max', 5),
                'tenure_bonus',    jsonb_build_object('score', v_tenure.tenure_bonus_score,    'max', 7),
                'recent_activity', jsonb_build_object('score', v_tenure.recent_activity_score, 'max', 3)
            ),
            'details', v_tenure.component_details
        ),
        'community_standing', jsonb_build_object(
            'score',     COALESCE(v_community.total_score, 0),
            'max_score', 15,
            'weight',    15,
            'status',    get_factor_status(COALESCE(v_community.total_score, 0), 15)::TEXT,
            'trend',     get_factor_trend(COALESCE(v_community.total_score, 0),
                                          v_previous_cache.community_standing_score)::TEXT,
            'components', jsonb_build_object(
                'vouches_received',     jsonb_build_object('score', v_community.vouches_received_score,     'max', 5),
                'member_diversity',     jsonb_build_object('score', v_community.member_diversity_score,     'max', 4),
                'elder_connections',    jsonb_build_object('score', v_community.elder_connections_score,    'max', 3),
                'vouching_reliability', jsonb_build_object('score', v_community.vouching_reliability_score, 'max', 3)
            ),
            'details', v_community.component_details
        ),
        'financial_behavior', jsonb_build_object(
            'score',     COALESCE(v_financial.total_score, 0),
            'max_score', 15,
            'weight',    15,
            'status',    get_factor_status(COALESCE(v_financial.total_score, 0), 15)::TEXT,
            'trend',     get_factor_trend(COALESCE(v_financial.total_score, 0),
                                          v_previous_cache.financial_behavior_score)::TEXT,
            'components', jsonb_build_object(
                -- mig 398: was v_financial.wallet_usage_score (nonexistent field)
                'wallet_usage',       jsonb_build_object('score', v_financial.wallet_score,    'max', 6),
                -- mig 398: was v_financial.payout_retention_score (nonexistent field)
                'payout_retention',   jsonb_build_object('score', v_financial.retention_score, 'max', 5),
                -- mig 398: was v_financial.savings_engagement_score (nonexistent field —
                -- always 0 today per financial-factor comment; mig 396 relocated the
                -- real savings signal to calculate_savings_behavior_factor which is
                -- NOT yet wired into this breakdown. Own follow-up migration.)
                'savings_engagement', jsonb_build_object('score', v_financial.savings_score,   'max', 4)
            ),
            -- mig 398: was v_financial.component_details (nonexistent field)
            'details', v_financial.details
        )
    );

    SELECT get_improvement_tips(p_user_id, 5) INTO v_tips;

    RETURN jsonb_build_object(
        'user_id',          p_user_id,
        'total_score',      v_score_record.total_score,
        'calculated_total', ROUND(v_total_calculated, 2),
        'tier',             v_score_record.score_tier,
        'factors',          v_breakdown,
        'improvement_tips', v_tips,
        'calculated_at',    now()
    );
END;
$function$;

-- ─── Fix 3: bust the breakdown cache ────────────────────────────────────
-- The RPC has been throwing since mig 396b landed, so cache rows are
-- either absent or stale. Clear them so users see the fix on next fetch
-- without waiting for the 1-hour cache to expire. Zero data loss —
-- cache regenerates on demand from the (now-working) function chain.
TRUNCATE TABLE public.xn_score_breakdown_cache;

-- ─── Self-register ──────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '398',
  'fix_xnscore_breakdown_chain',
  ARRAY['-- 398: fix_xnscore_breakdown_chain']
)
ON CONFLICT (version) DO NOTHING;
