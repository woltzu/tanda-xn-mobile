-- ═══════════════════════════════════════════════════════════════════════════
-- 396b_scoring_engine_hardening.sql
--
-- Fourth and final migration in the XnScore savings-factor chain. Closes
-- five gaming vectors identified in the anti-gaming review:
--
--   • V5 — small-circle farming for payment reliability
--          Weight on_time_rate by contribution AMOUNT (not count) so a
--          perfect record in a $5 friends-circle scores fractionally
--          vs a $100 stranger-circle.
--
--   • V6 — short-cycle circle farming for completion
--          Normalize completion_rate by scheduled CYCLES (SUM of
--          circles.member_count), not circle count. A 12-cycle
--          completion scores more than a 4-cycle.
--
--   • V10 — late-recovery lifetime lock
--          Once late_recovery earns its max, lock the value on xn_scores.
--          Future recomputations use MAX(computed, locked) — bonus can
--          rise but never re-decay-then-refarm.
--
--   • V13 — rolling-average scoring for critical gates
--          Add xn_scores.rolling_avg_60d_score column. Daily cron EF
--          (built separately) calls refresh_all_xnscore_rolling_averages
--          to keep it fresh. Helper get_effective_xn_score(user_id)
--          returns COALESCE(rolling_avg_60d_score, total_score) —
--          callers (advance eligibility, circle tier gates) migrate at
--          their own pace. Non-breaking; no existing caller changed.
--
--   • V16 — partial-payment defensive filter
--          Exclude rows with status='partial' from the payment
--          reliability calc. INERT today (0 'partial' rows in either
--          contributions or circle_contributions), activates
--          automatically when the partial-contribution feature ships.
--
-- Also carries forward the 60-day grandfathering window from mig 396:
--   • Snapshot pre-396b state per user.
--   • Extend grandfather_expires_at to NOW()+60d for any user with an
--     existing floor (from mig 396). Users get one continuous protection
--     period covering both mig score changes.
--   • Install NEW floor for users who lose points ONLY due to 396b
--     (weren't floored by 396). Floor = pre-396b baseline.
--   • Users who GAIN from 396b get the gain immediately (no floor set).
--
-- Order of operations INSIDE this migration:
--   1. Add xn_scores.late_recovery_locked_pts + rolling_avg_60d_score.
--   2. Create xnscore_pre_396b_snapshot; insert current baseline.
--   3. Rewrite factor RPCs (payment reliability, circle completion).
--   4. Rewrite recalculate_full_xnscore to persist late_recovery_locked_pts.
--   5. First recompute — new factor logic applies.
--   6. Populate grandfathering (new floors + extend all existing expiries).
--   7. Second recompute — floors take effect.
--   8. Create get_effective_xn_score helper + refresh_all_xnscore_
--      rolling_averages bulk RPC.
--   9. Initial rolling-avg populate.
--  10. Self-register.
--
-- Deferrals (documented, NOT in this migration):
--   • Daily cron EF refresh-xnscore-rolling-averages — built separately
--     after this lands. Without it, rolling_avg_60d_score is fresh only
--     at mig-apply time then goes stale.
--   • Caller migrations to get_effective_xn_score — advance eligibility,
--     circle tier gates, etc. Non-breaking; each caller migrates when
--     touched.
--   • Partial-contribution linkage on the autopay path — if partial
--     feature ever supports autopay contributions, need a filter for
--     that too. V16 defensive filter here only covers the manual path.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. xn_scores columns for V10 + V13 ──────────────────────────────────
ALTER TABLE xn_scores
  ADD COLUMN IF NOT EXISTS late_recovery_locked_pts NUMERIC(4,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rolling_avg_60d_score    NUMERIC;

COMMENT ON COLUMN xn_scores.late_recovery_locked_pts IS
  'mig 396b V10: highest late_recovery bonus this user has ever earned. '
  'calculate_payment_reliability_factor emits GREATEST(computed, locked) '
  'so once earned, the bonus persists and can only rise. Prevents '
  'default-then-recover cycling from re-farming the bonus.';
COMMENT ON COLUMN xn_scores.rolling_avg_60d_score IS
  'mig 396b V13: time-weighted average total_score over last 60 days. '
  'Populated by refresh_all_xnscore_rolling_averages (daily cron EF). '
  'Read via get_effective_xn_score helper for critical gates so point-'
  'in-time score gaming does not unlock advances/tiers.';

-- ─── 2. Pre-396b snapshot table + baseline capture ───────────────────────
CREATE TABLE IF NOT EXISTS xnscore_pre_396b_snapshot (
  user_id           UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  pre_total_score   NUMERIC NOT NULL,
  pre_factor_scores JSONB   NOT NULL,
  snapshot_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE xnscore_pre_396b_snapshot IS
  'mig 396b: one row per user snapshotting total_score + factor_scores '
  'JUST BEFORE the scoring-engine hardening recalc ran. Compared to '
  'post-recalc total_score to decide who needs a new grandfather floor. '
  'Distinct from xnscore_pre_savings_snapshot (mig 396) so both '
  'baselines are auditable independently.';

INSERT INTO xnscore_pre_396b_snapshot (user_id, pre_total_score, pre_factor_scores)
SELECT user_id, total_score, COALESCE(factor_scores, '{}'::jsonb)
  FROM xn_scores
ON CONFLICT (user_id) DO NOTHING;

-- ─── 3a. calculate_payment_reliability_factor — V5, V10, V16 ─────────────
-- V5: on_time_rate is now amount-weighted (SUM(amt WHERE on_time) /
--     SUM(amt)) instead of count-weighted. Existing details fields
--     preserved (on_time_percentage stays count-based for observability)
--     but a new on_time_amount_pct is added so admins can see both.
-- V10: read late_recovery_locked_pts and emit GREATEST(computed, locked).
--      The lock itself is written by recalculate_full_xnscore below.
-- V16: EXCLUDE rows where status='partial' in both source tables. INERT
--      today (0 partial rows), activates when the partial feature ships.
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
            COALESCE(amount_cents, 0)::BIGINT AS amount_cents
        FROM contributions
        WHERE user_id = p_user_id
          AND status::text <> 'partial'   -- V16 defensive filter

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
          AND status <> 'partial'         -- V16 defensive filter
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

-- ─── 3b. calculate_circle_completion_factor — V6 ─────────────────────────
-- Normalize completion_rate by scheduled CYCLES (SUM of circles.member_
-- count across circles the user joined) instead of circle count. A user
-- who completes one 12-member circle contributed to 12 scheduled cycles
-- and gets credit accordingly.
CREATE OR REPLACE FUNCTION public.calculate_circle_completion_factor(p_user_id uuid)
RETURNS TABLE(
  total_score numeric,
  completion_rate_score numeric,
  full_cycle_score numeric,
  no_abandonment_score numeric,
  component_details jsonb
)
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    v_score_record RECORD;
    v_circles_joined INTEGER;
    v_circles_completed INTEGER;
    v_circles_abandoned INTEGER;
    v_full_cycles INTEGER;
    v_scheduled_cycles INTEGER := 0;
    v_completion_pct_cycles DECIMAL := 0;
    v_completion_pct_circles DECIMAL := 0;

    v_completion_rate DECIMAL := 0;
    v_cycle_bonus DECIMAL := 0;
    v_no_abandon DECIMAL := 0;
    v_details JSONB;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;

    IF v_score_record IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    v_circles_joined := COALESCE(v_score_record.circles_participated, 0);
    v_circles_abandoned := COALESCE(v_score_record.circles_abandoned, 0);
    v_full_cycles := COALESCE(v_score_record.full_cycles_completed, 0);
    v_circles_completed := v_circles_joined - v_circles_abandoned;

    -- V6: sum of scheduled cycles across every circle the user joined
    -- (active OR historical). Uses circles.member_count as the scheduled-
    -- cycles proxy — a Susu-style circle of N members runs N cycles.
    SELECT COALESCE(SUM(c.member_count), 0)::INT
      INTO v_scheduled_cycles
      FROM circle_members cm
      JOIN circles c ON c.id = cm.circle_id
     WHERE cm.user_id = p_user_id;

    -- V6: cycle-normalized completion percentage.
    IF v_scheduled_cycles > 0 THEN
        v_completion_pct_cycles := LEAST(1.0, v_full_cycles::DECIMAL / v_scheduled_cycles);
        v_completion_rate := LEAST(12, v_completion_pct_cycles * 12);
    ELSIF v_circles_joined > 0 THEN
        -- Fallback: if no cycle schedule data (e.g., legacy circles
        -- with NULL member_count), use the old circle-count ratio so
        -- the factor doesn't regress to 0 for those users.
        v_completion_pct_circles := v_circles_completed::DECIMAL / v_circles_joined;
        v_completion_rate := LEAST(12, v_completion_pct_circles * 12);
    END IF;

    -- Unchanged: full-cycle bonus (5 pts, count-based, already meaningful).
    v_cycle_bonus := LEAST(5, (LEAST(v_full_cycles, 10)::DECIMAL / 10) * 5);

    IF v_circles_abandoned = 0 AND v_circles_joined > 0 THEN
        v_no_abandon := 3;
    END IF;

    -- Kept for observability
    IF v_circles_joined > 0 THEN
        v_completion_pct_circles := v_circles_completed::DECIMAL / v_circles_joined;
    END IF;

    v_details := jsonb_build_object(
        'circles_joined',              v_circles_joined,
        'circles_completed',           v_circles_completed,
        'circles_abandoned',           v_circles_abandoned,
        'completion_percentage',       ROUND(v_completion_pct_circles * 100, 1),
        'scheduled_cycles',            v_scheduled_cycles,
        'cycles_completion_percentage',ROUND(v_completion_pct_cycles * 100, 1),
        'full_cycles_completed',       v_full_cycles,
        'completion_rate',             ROUND(COALESCE(v_score_record.completion_rate, 0), 1)
    );

    RETURN QUERY SELECT
        ROUND(v_completion_rate + v_cycle_bonus + v_no_abandon, 2),
        ROUND(v_completion_rate, 2),
        ROUND(v_cycle_bonus, 2),
        ROUND(v_no_abandon, 2),
        v_details;
END;
$function$;

-- ─── 4. recalculate_full_xnscore — persist late_recovery_locked_pts ──────
-- Everything else preserved byte-for-byte from mig 396's body. Only
-- change: after the payment_reliability factor call, UPDATE
-- xn_scores.late_recovery_locked_pts = GREATEST(current, awarded) so the
-- lock never decays.
CREATE OR REPLACE FUNCTION public.recalculate_full_xnscore(p_user_id uuid)
RETURNS TABLE(success boolean, previous_score numeric, new_score numeric, breakdown jsonb)
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
    v_savings RECORD;
    v_new_raw DECIMAL := 0;
    v_new_capped DECIMAL;
    v_new_final DECIMAL;
    v_age_cap INTEGER;
    v_factor_errors JSONB := '{}'::JSONB;
    v_grandfather_applied BOOLEAN := FALSE;

    v_payment_score NUMERIC := 0;
    v_completion_score NUMERIC := 0;
    v_tenure_score NUMERIC := 0;
    v_community_score NUMERIC := 0;
    v_financial_score NUMERIC := 0;
    v_savings_score NUMERIC := 0;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE xn_scores.user_id = p_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    BEGIN PERFORM sync_circle_completion_counters(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('completion_sync', SQLERRM);
    END;

    BEGIN PERFORM sync_payment_streak(p_user_id);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('payment_streak_sync', SQLERRM);
    END;

    BEGIN
        SELECT * INTO v_payment FROM calculate_payment_reliability_factor(p_user_id);
        v_payment_score := COALESCE(v_payment.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('payment_reliability', SQLERRM);
    END;

    -- V10: persist the highest late_recovery ever awarded. Safe even on
    -- failure — v_payment is a RECORD; if the factor call raised, the
    -- late_recovery_score field is NULL and GREATEST ignores it.
    UPDATE xn_scores SET
      late_recovery_locked_pts = GREATEST(
        COALESCE(late_recovery_locked_pts, 0),
        COALESCE((v_payment).late_recovery_score, 0)
      )
    WHERE user_id = p_user_id;

    BEGIN
        SELECT * INTO v_completion FROM calculate_circle_completion_factor(p_user_id);
        v_completion_score := COALESCE(v_completion.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('circle_completion', SQLERRM);
    END;

    BEGIN
        SELECT * INTO v_tenure FROM calculate_tenure_activity_factor(p_user_id);
        v_tenure_score := COALESCE(v_tenure.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('tenure_activity', SQLERRM);
    END;

    BEGIN
        SELECT * INTO v_community FROM calculate_community_standing_factor(p_user_id);
        v_community_score := COALESCE(v_community.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('community_standing', SQLERRM);
    END;

    BEGIN
        SELECT * INTO v_financial FROM calculate_financial_behavior_factor(p_user_id);
        v_financial_score := COALESCE(v_financial.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('financial_behavior', SQLERRM);
    END;

    BEGIN
        SELECT * INTO v_savings FROM calculate_savings_behavior_factor(p_user_id);
        v_savings_score := COALESCE(v_savings.total_score, 0);
    EXCEPTION WHEN OTHERS THEN
        v_factor_errors := v_factor_errors || jsonb_build_object('savings_behavior', SQLERRM);
    END;

    v_new_raw := GREATEST(
        v_payment_score + v_completion_score + v_tenure_score
          + v_community_score + v_financial_score + v_savings_score,
        COALESCE(v_score_record.raw_score, 20)
    );

    v_age_cap := get_xnscore_age_cap(v_score_record.account_age_days);
    v_new_capped := LEAST(v_new_raw, v_age_cap);

    -- Grandfather floor (unchanged from mig 396).
    v_new_final := v_new_capped;
    IF v_score_record.grandfather_expires_at IS NOT NULL
       AND v_score_record.grandfather_expires_at > NOW()
       AND v_score_record.grandfathered_score IS NOT NULL
       AND v_score_record.grandfathered_score > v_new_capped THEN
        v_new_final := v_score_record.grandfathered_score;
        v_grandfather_applied := TRUE;
    END IF;

    UPDATE xn_scores SET
        previous_score = total_score,
        raw_score = v_new_raw,
        total_score = v_new_final,
        score_tier = get_xnscore_tier(v_new_final),
        payment_history_score = v_payment_score,
        completion_score = v_completion_score,
        time_reliability_score = v_tenure_score,
        diversity_social_score = v_community_score,
        deposit_score = v_financial_score,
        savings_score = v_savings_score,
        age_cap_applied = v_new_capped < v_new_raw,
        max_allowed_score = v_age_cap,
        factor_scores = jsonb_build_object(
            'payment_reliability', v_payment_score,
            'circle_completion',   v_completion_score,
            'tenure_activity',     v_tenure_score,
            'community_standing',  v_community_score,
            'financial_behavior',  v_financial_score,
            'savings_behavior',    v_savings_score,
            'errors',              v_factor_errors,
            'grandfather_applied', v_grandfather_applied
        ),
        last_calculated_at = now(),
        calculation_trigger = 'full_recalculation',
        updated_at = now()
    WHERE xn_scores.user_id = p_user_id;

    RETURN QUERY SELECT
        TRUE,
        v_score_record.total_score,
        v_new_final,
        jsonb_build_object(
            'payment_reliability', v_payment_score,
            'circle_completion',   v_completion_score,
            'tenure_activity',     v_tenure_score,
            'community_standing',  v_community_score,
            'financial_behavior',  v_financial_score,
            'savings_behavior',    v_savings_score,
            'raw_total',           v_new_raw,
            'age_cap',             v_age_cap,
            'capped_total',        v_new_capped,
            'final_total',         v_new_final,
            'grandfather_applied', v_grandfather_applied,
            'errors',              v_factor_errors
        );
END;
$function$;

-- ─── 5. First recompute — factor changes now apply ───────────────────────
DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT public.recalculate_all_xn_scores() INTO v_count;
  RAISE NOTICE 'mig 396b: first-pass recalculated % xn_scores rows', v_count;
END $$;

-- ─── 6. Grandfathering — install new floors + extend all expiries ────────
-- Two UPDATEs:
--   (a) For users whose new score is LOWER than their pre-396b baseline,
--       install/raise the floor to MAX(existing floor, pre-396b). Reset
--       expiry to NOW() + 60d.
--   (b) For users who already had a floor from mig 396 but weren't lost
--       by 396b, extend expiry to NOW() + 60d so their protection
--       window covers the full mig 396b transition.
UPDATE xn_scores xs
   SET grandfathered_score = GREATEST(
         COALESCE(xs.grandfathered_score, 0),
         pre.pre_total_score
       ),
       grandfather_expires_at = NOW() + INTERVAL '60 days'
  FROM xnscore_pre_396b_snapshot pre
 WHERE xs.user_id = pre.user_id
   AND pre.pre_total_score > xs.total_score;

UPDATE xn_scores
   SET grandfather_expires_at = NOW() + INTERVAL '60 days'
 WHERE grandfather_expires_at IS NOT NULL
   AND grandfather_expires_at < NOW() + INTERVAL '60 days';

-- ─── 7. Second recompute — floors take effect ────────────────────────────
DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT public.recalculate_all_xn_scores() INTO v_count;
  RAISE NOTICE 'mig 396b: post-grandfather recalc touched % rows', v_count;
END $$;

-- ─── 8a. get_effective_xn_score helper ───────────────────────────────────
-- Callers migrate to this at their own pace. Falls back to total_score
-- if rolling_avg_60d_score isn't populated (e.g., before first cron run).
CREATE OR REPLACE FUNCTION public.get_effective_xn_score(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(rolling_avg_60d_score, total_score, 0)
    FROM xn_scores
   WHERE user_id = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.get_effective_xn_score(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_xn_score(UUID)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.get_effective_xn_score(UUID) IS
  'mig 396b V13: canonical read for critical gating decisions. Returns '
  'rolling_avg_60d_score if populated, else falls back to total_score. '
  'Callers (advance eligibility, circle tier gates) should migrate to '
  'this from raw total_score reads at their own pace — non-breaking.';

-- ─── 8b. refresh_all_xnscore_rolling_averages bulk RPC ───────────────────
-- Called by the daily cron EF refresh-xnscore-rolling-averages (built
-- separately after this mig lands). Time-weighted average from
-- xnscore_history: seed with carry-in (last change before window) so a
-- user whose score sat flat all 60 days still averages to that value.
CREATE OR REPLACE FUNCTION public.refresh_all_xnscore_rolling_averages(
  p_days INT DEFAULT 60
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INT := 0;
  v_window_start TIMESTAMPTZ := NOW() - (p_days || ' days')::INTERVAL;
BEGIN
  WITH carry_ins AS (
    SELECT DISTINCT ON (user_id)
           user_id, score, v_window_start AS event_at
      FROM xnscore_history
     WHERE created_at <= v_window_start
     ORDER BY user_id, created_at DESC
  ),
  in_window AS (
    SELECT user_id, score, created_at AS event_at
      FROM xnscore_history
     WHERE created_at >  v_window_start
       AND created_at <= NOW()
  ),
  all_events AS (
    SELECT * FROM carry_ins
    UNION ALL
    SELECT * FROM in_window
  ),
  windowed AS (
    SELECT user_id,
           score,
           event_at,
           COALESCE(
             LEAD(event_at) OVER (PARTITION BY user_id ORDER BY event_at),
             NOW()
           ) AS next_at
      FROM all_events
  ),
  weighted AS (
    SELECT user_id,
           score * EXTRACT(EPOCH FROM (next_at - event_at)) AS s_secs,
           EXTRACT(EPOCH FROM (next_at - event_at)) AS secs
      FROM windowed
     WHERE next_at > event_at
  ),
  per_user_avg AS (
    SELECT user_id,
           COALESCE(SUM(s_secs) / NULLIF(SUM(secs), 0), 0) AS avg_score
      FROM weighted
     GROUP BY user_id
  )
  UPDATE xn_scores xs
     SET rolling_avg_60d_score = ROUND(pua.avg_score, 2)
    FROM per_user_avg pua
   WHERE xs.user_id = pua.user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- For users with NO xnscore_history rows at all (edge case: brand-new
  -- accounts before their first score event), fall back to their
  -- current total_score so get_effective_xn_score returns something
  -- meaningful on day one.
  UPDATE xn_scores xs
     SET rolling_avg_60d_score = xs.total_score
   WHERE xs.rolling_avg_60d_score IS NULL;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_all_xnscore_rolling_averages(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_all_xnscore_rolling_averages(INT)
  TO service_role;

-- ─── 9. Initial rolling-avg populate ─────────────────────────────────────
DO $$
DECLARE v_count INT;
BEGIN
  SELECT public.refresh_all_xnscore_rolling_averages(60) INTO v_count;
  RAISE NOTICE 'mig 396b: initial rolling-avg populate touched % rows', v_count;
END $$;

-- ─── 10. Self-register ──────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '396b',
  'scoring_engine_hardening',
  ARRAY['-- 396b: scoring_engine_hardening']
)
ON CONFLICT (version) DO NOTHING;
