-- ═══════════════════════════════════════════════════════════════════════════
-- 333_circle_completion_sync_counters.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- calculate_circle_completion_factor reads three counters from xn_scores —
-- circles_participated, circles_abandoned, full_cycles_completed — and
-- computes the whole factor from those. But NO code path anywhere in the
-- schema updates them. They sit at 0 for every user, so
-- completion_score = 0 across the board.
--
-- Source-of-truth tables:
--   * circle_members — one row per (user, circle). status='active' /
--     'left' / 'removed' / etc, plus exited_at when the user left.
--   * circle_cycles — one row per cycle. cycle_status one of
--     collecting/grace_period/closed. recipient_user_id names the
--     payout recipient for that cycle.
--
-- Approach (Option 2 from the plan): new sync_circle_completion_counters
-- RPC recomputes all three counters from source tables. Wire it into
-- recalculate_full_xnscore BEFORE the completion factor runs so the
-- factor reads fresh numbers on every daily pipeline pass.
--
-- Rationale for RPC over triggers:
--   * Simpler ownership — one function, one place to fix.
--   * Resilient to schema evolution on source tables — only this function
--     needs updating if `status` / `exited_at` semantics shift.
--   * Idempotent by construction — recomputes from scratch every call,
--     no drift.
--   * Runs inside the same daily transaction as the recalc, so cost is
--     amortized. Trigger-based sync would add per-write overhead on
--     circle_members / circle_cycles even outside of scoring.
--
-- Prod data snapshot (2026-07-15):
--   * 51 circle_members rows, all status='active', none with exited_at.
--   * 7 circle_cycles rows: 5 closed, 1 collecting, 1 grace_period.
--   * Marcus (35545a5f) is recipient on 3 closed cycles.
--   * Franck (4e4b6bc4) is recipient on 2 closed cycles.
--   * All xn_scores completion counters are currently 0.
--
-- After this migration:
--   * Users who have joined circles get circles_participated > 0.
--   * circles_abandoned stays 0 (as it should — nobody has left).
--   * Recipients of closed cycles get full_cycles_completed > 0.
--   * completion_score jumps for both Marcus and Franck.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── sync function ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_circle_completion_counters(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
    v_participated INTEGER;
    v_abandoned    INTEGER;
    v_full_cycles  INTEGER;
BEGIN
    -- circles_participated = every circle this user has been a member of,
    -- regardless of current status. The completion factor treats
    -- (participated - abandoned) as "completed", so participated must
    -- include the abandoned ones too.
    SELECT COUNT(*) INTO v_participated
      FROM circle_members
     WHERE user_id = p_user_id;

    -- circles_abandoned = user left the circle before it finished.
    -- Only 'active' shows in the wild today, but defensively match any
    -- of the exit-like status values AND any row with exited_at set —
    -- so the counter works whichever signal the exit path ends up
    -- writing.
    SELECT COUNT(*) INTO v_abandoned
      FROM circle_members
     WHERE user_id = p_user_id
       AND (
         status IN ('left', 'removed', 'exited', 'kicked')
         OR exited_at IS NOT NULL
       );

    -- full_cycles_completed = the user has been the payout recipient on
    -- N closed cycles. This is the "you got your turn and the circle
    -- honored it" milestone the RPC's cycle_bonus rewards.
    SELECT COUNT(*) INTO v_full_cycles
      FROM circle_cycles
     WHERE recipient_user_id = p_user_id
       AND cycle_status IN ('closed', 'completed');

    UPDATE xn_scores
       SET circles_participated  = v_participated,
           circles_abandoned     = v_abandoned,
           full_cycles_completed = v_full_cycles,
           completion_rate = CASE
             WHEN v_participated > 0
               THEN ROUND(((v_participated - v_abandoned)::NUMERIC
                          / v_participated) * 100, 1)
             ELSE 0
           END,
           updated_at = now()
     WHERE user_id = p_user_id;
END;
$$;

-- ─── rewire recalculate_full_xnscore to sync counters first ─────────────
--
-- DROP first because RETURN TABLE column list is unchanged from mig 329
-- but Postgres still won't CREATE OR REPLACE if we change body semantics
-- in ways that touch return-type resolution. Belt-and-suspenders —
-- signature is stable, but the DROP guarantees we always land on the
-- exact function we intend to ship.
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

    -- Sync completion counters from source-of-truth tables before the
    -- completion factor reads them. Wrapped so a sync failure doesn't
    -- block the rest of the recalc — the factor will just see stale
    -- (or zero) counters and score accordingly.
    BEGIN
        PERFORM sync_circle_completion_counters(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors
          || jsonb_build_object('completion_sync', SQLERRM);
        RAISE NOTICE 'sync_circle_completion_counters failed for user %: %',
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

    -- Defensive floor preserved from mig 329: a broken factor never
    -- decreases a user's score. Once real factor sum exceeds the
    -- previous raw, the floor becomes moot.
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
  '333',
  'circle_completion_sync_counters',
  ARRAY['-- 333: sync_circle_completion_counters + wired into recalculate_full_xnscore']
)
ON CONFLICT (version) DO NOTHING;
