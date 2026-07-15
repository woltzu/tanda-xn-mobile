-- ═══════════════════════════════════════════════════════════════════════════
-- 335_payment_streak_sync.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Gap 2 of the two remaining pre-launch XnScore gaps.
--
-- Problem: xn_scores.payment_streak and best_payment_streak are 0 for
-- every user. calculate_payment_reliability_factor reads them for the
-- +0-8 streak bonus, but no code path anywhere in the schema
-- increments them.
--
-- Grep confirms: only the two factor RPCs (mig 330, 332) read the
-- columns; the columns are declared in 019 with DEFAULT 0; no
-- migration, trigger, or Edge Function ever assigns to them.
--
-- The design intent is documented in mig 021 (factor breakdown table)
-- and services/XnScoreEngine.ts:319-327 — "consecutive on-time
-- payments" with milestone bonuses at 10, 25, 50 payments.
--
-- Fix (Option 2 per the plan): sync_payment_streak RPC that walks
-- both contribution tables chronologically and computes the trailing
-- consecutive-on-time run + all-time max. Wired into
-- recalculate_full_xnscore before the payment factor runs so the
-- factor sees fresh streak numbers each day.
--
-- Semantics:
--   * on-time paid row → increment running counter
--   * late/missed row  → reset running counter to 0
--   * refunded row     → skipped (payment happened, then reversed;
--                        neither counts as streak nor breaks it)
--   * pending row      → skipped (hasn't resolved yet)
--
-- Chronological order determined by paid_date (or paid_at for
-- autopay, with created_at as final fallback). Ties broken by
-- table-then-id for determinism.
--
-- Rationale for sync-over-trigger (mirrors mig 333's completion sync):
--   * Recomputes from full history every call — no drift risk when
--     rows arrive out of chronological order (catch-up payments,
--     Stripe webhook retries).
--   * Single ownership: one function, one place to fix.
--   * Cost amortized inside the daily pipeline instead of paid on
--     every contribution write.
--
-- A trigger for real-time streak updates could be added later if
-- product wants users to see their streak tick up immediately after
-- payment. Not blocking launch — daily sync is correct and cheap
-- (44 rows across 11 users today; sub-second even at 10k users
-- with the right indexes).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_payment_streak(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_running INTEGER := 0;
    v_best    INTEGER := 0;
    r         RECORD;
BEGIN
    FOR r IN
        WITH history AS (
            -- Manual contributions: on-time flag from trigger (mig 334)
            SELECT
                paid_date AS event_at,
                'manual'::text AS source,
                id::text AS ord_id,
                (status = 'paid' AND COALESCE(is_on_time, TRUE)) AS is_on_time_paid,
                (status IN ('late', 'missed')
                 OR (status = 'paid' AND NOT COALESCE(is_on_time, TRUE))) AS breaks_streak
              FROM public.circle_contributions
             WHERE user_id  = p_user_id
               AND paid_date IS NOT NULL
               AND status   IN ('paid', 'late', 'missed')

            UNION ALL

            -- Autopay contributions: on-time inferred from status + paid_at vs due_date
            SELECT
                COALESCE(paid_at, created_at::timestamptz) AS event_at,
                'autopay'::text,
                id::text,
                (status::text = 'paid'
                 AND (paid_at IS NULL OR paid_at::date <= due_date))
                  AS is_on_time_paid,
                (status::text IN ('late', 'missed')
                 OR (status::text = 'paid' AND paid_at IS NOT NULL
                     AND paid_at::date > due_date)) AS breaks_streak
              FROM public.contributions
             WHERE user_id = p_user_id
               AND status::text IN ('paid', 'late', 'missed')
        )
        SELECT is_on_time_paid, breaks_streak
          FROM history
         ORDER BY event_at ASC, source ASC, ord_id ASC
    LOOP
        IF r.is_on_time_paid THEN
            v_running := v_running + 1;
            IF v_running > v_best THEN
                v_best := v_running;
            END IF;
        ELSIF r.breaks_streak THEN
            v_running := 0;
        END IF;
        -- Rows that are neither on-time paid nor stream-breaking
        -- (e.g., 'refunded' — filtered upstream anyway) don't move
        -- the counter either direction.
    END LOOP;

    UPDATE public.xn_scores
       SET payment_streak      = v_running,
           -- Preserve historical max: an incoming streak lower than the
           -- previous best_payment_streak shouldn't clobber that record.
           best_payment_streak = GREATEST(v_best, COALESCE(best_payment_streak, 0)),
           updated_at          = NOW()
     WHERE user_id = p_user_id;
END;
$$;

-- ─── Rewire recalculate_full_xnscore to sync streak before payment ───────
--
-- Same defensive pattern as mig 333: PERFORM sync_payment_streak in
-- its own BEGIN…EXCEPTION block so a sync failure surfaces in
-- factor_scores.errors.payment_streak_sync without blocking the rest
-- of the recalc. Runs BEFORE calculate_payment_reliability_factor so
-- the factor reads fresh streak numbers.

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

    BEGIN
        PERFORM sync_circle_completion_counters(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('completion_sync', SQLERRM);
        RAISE NOTICE 'sync_circle_completion_counters failed for user %: %',
                     p_user_id, SQLERRM;
    END;

    -- NEW: sync payment_streak before the payment factor reads it.
    BEGIN
        PERFORM sync_payment_streak(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('payment_streak_sync', SQLERRM);
        RAISE NOTICE 'sync_payment_streak failed for user %: %',
                     p_user_id, SQLERRM;
    END;

    BEGIN
        SELECT * INTO v_payment FROM calculate_payment_reliability_factor(p_user_id);
        v_payment_score := COALESCE(v_payment.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('payment_reliability', SQLERRM);
        RAISE NOTICE 'payment_reliability factor failed for user %: %',
                     p_user_id, SQLERRM;
    END;

    BEGIN
        SELECT * INTO v_completion FROM calculate_circle_completion_factor(p_user_id);
        v_completion_score := COALESCE(v_completion.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('circle_completion', SQLERRM);
        RAISE NOTICE 'circle_completion factor failed for user %: %',
                     p_user_id, SQLERRM;
    END;

    BEGIN
        SELECT * INTO v_tenure FROM calculate_tenure_activity_factor(p_user_id);
        v_tenure_score := COALESCE(v_tenure.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('tenure_activity', SQLERRM);
        RAISE NOTICE 'tenure_activity factor failed for user %: %',
                     p_user_id, SQLERRM;
    END;

    BEGIN
        SELECT * INTO v_community FROM calculate_community_standing_factor(p_user_id);
        v_community_score := COALESCE(v_community.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('community_standing', SQLERRM);
        RAISE NOTICE 'community_standing factor failed for user %: %',
                     p_user_id, SQLERRM;
    END;

    BEGIN
        SELECT * INTO v_financial FROM calculate_financial_behavior_factor(p_user_id);
        v_financial_score := COALESCE(v_financial.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('financial_behavior', SQLERRM);
        RAISE NOTICE 'financial_behavior factor failed for user %: %',
                     p_user_id, SQLERRM;
    END;

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
  '335',
  'payment_streak_sync',
  ARRAY['-- 335: sync_payment_streak RPC + wired into recalculate_full_xnscore before payment factor']
)
ON CONFLICT (version) DO NOTHING;
