-- ════════════════════════════════════════════════════════════════════════════
-- Migration 213: xnscore_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Bucket C of the XnScore™ review.
--
-- Buckets A and B made the dashboard read real data and gave it a glossary,
-- coach mark, factor explainers, tips, and a 30-day sparkline. The score
-- itself was still drifting in three ways that this migration closes:
--
--   1. Tier flips were silent — moving from `trusted` to `elder` (or losing
--      a tier downward) emitted nothing to the user. The bucket B coach mark
--      says "tap (?) to see what each factor measures," but a user whose
--      score just slid below 60 had no signal it happened.
--
--   2. The breakdown cache (migration 021's xn_score_breakdown_cache) is
--      invalidated by a soft expires_at bump on score change. That leaves
--      get_score_breakdown returning stale per-factor numbers until the TTL
--      elapses. A user who just contributed and watched their score jump
--      saw their breakdown bar lag.
--
--   3. The recovery multiplier (migration 020's xnscore_recovery_periods)
--      was wired into apply_tenure_bonus only. apply_xnscore_adjustment —
--      the single entry point that EVERY contribution / vouch / payout
--      bonus flows through — ignored it. Users coming back from a default
--      were stuck with 1× points, defeating the whole purpose of the
--      recovery window.
--
-- This migration adds:
--
--   1. notify_xnscore_tier_change trigger on xn_scores AFTER UPDATE OF
--      score_tier. Inserts a `xnscore_tier_change` notification carrying
--      old_tier / new_tier / score / direction in data. Idempotent by
--      (user_id, type, data->>'changed_at') where changed_at is stamped
--      to second precision.
--
--   2. refresh_breakdown_on_adjustment trigger on xn_scores AFTER UPDATE
--      OF total_score. Hard-DELETEs the user's xn_score_breakdown_cache row
--      so the next get_score_breakdown call rebuilds via
--      recalculate_full_xnscore. Skipped when breakdown_cached_at was just
--      bumped in the same UPDATE (i.e., the row was rewritten by the
--      breakdown writer itself — avoids the recursive bust during refresh).
--
--   3. compute_xnscore_percentiles() RPC + daily cron at 04:00 UTC. Runs a
--      PERCENT_RANK() window over total_score for all non-frozen users and
--      upserts overall_percentile into xn_score_breakdown_cache. Returns
--      { updated_count }.
--
--   4. apply_xnscore_adjustment CREATE OR REPLACE — applies the active
--      recovery_multiplier to positive adjustments BEFORE the velocity cap
--      so the user feels the boost immediately. Logs the multiplier into
--      xnscore_history.trigger_details so the audit trail is intact.
--
-- All trigger functions are SECURITY DEFINER with pinned
-- search_path = public, pg_temp and an EXCEPTION sub-block so a fan-out /
-- execution failure can't roll back the xn_scores row that triggered them.
-- Mirrors migrations 188 / 205 / 207 / 208 / 209 / 210 / 211 / 212.
--
-- Self-registers.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notify_xnscore_tier_change trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_xnscore_tier_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_tier_str TEXT;
  v_new_tier_str TEXT;
  v_score_str    TEXT;
  v_direction    TEXT;
  v_changed_at   TEXT;
  v_existing_id  UUID;
BEGIN
  -- Short-circuit when the column did not actually change. UPDATE OF
  -- score_tier fires whenever an UPDATE statement targets the column,
  -- not just on transitions.
  IF OLD.score_tier IS NOT DISTINCT FROM NEW.score_tier THEN
    RETURN NEW;
  END IF;

  -- The xnscore_tier enum from migration 019 ordering (top → bottom):
  --   elite > excellent > good > fair > poor > critical
  -- Direction lets the client surface "tier up" vs "tier down" copy.
  v_old_tier_str := OLD.score_tier::TEXT;
  v_new_tier_str := NEW.score_tier::TEXT;
  v_score_str    := TRIM(TO_CHAR(COALESCE(NEW.total_score, 0), 'FM990D00'));

  v_direction := CASE
    WHEN CASE OLD.score_tier WHEN 'elite' THEN 6 WHEN 'excellent' THEN 5
                              WHEN 'good' THEN 4 WHEN 'fair' THEN 3
                              WHEN 'poor' THEN 2 ELSE 1 END
       < CASE NEW.score_tier WHEN 'elite' THEN 6 WHEN 'excellent' THEN 5
                              WHEN 'good' THEN 4 WHEN 'fair' THEN 3
                              WHEN 'poor' THEN 2 ELSE 1 END
    THEN 'up'
    ELSE 'down'
  END;

  -- Stamp to second precision so a near-simultaneous re-fire idempotents
  -- through the existing notification row.
  v_changed_at := TO_CHAR(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  BEGIN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.user_id
       AND type = 'xnscore_tier_change'
       AND data->>'changed_at' = v_changed_at
     LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.user_id,
        'xnscore_tier_change',
        'XnScore tier updated',
        'Your XnScore has moved from ' || v_old_tier_str || ' to ' || v_new_tier_str || '.',
        jsonb_build_object(
          'old_tier', v_old_tier_str,
          'new_tier', v_new_tier_str,
          'direction', v_direction,
          'score', NEW.total_score,
          'changed_at', v_changed_at,
          'i18n_title_key', 'xnscore.notification_tier_change_title',
          'i18n_body_key',  'xnscore.notification_tier_change_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- A fan-out failure must not roll back the xn_scores update.
    RAISE WARNING 'notify_xnscore_tier_change failed for user %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_xnscore_tier_change ON public.xn_scores;
CREATE TRIGGER tr_xnscore_tier_change
  AFTER UPDATE OF score_tier ON public.xn_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_xnscore_tier_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. refresh_breakdown_on_adjustment trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_breakdown_on_adjustment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.total_score IS NOT DISTINCT FROM OLD.total_score THEN
    RETURN NEW;
  END IF;

  -- Skip when breakdown_cached_at was just bumped in this same UPDATE —
  -- that means recalculate_full_xnscore was the writer and we'd be
  -- nuking the freshly written cache. Without this guard the breakdown
  -- writer goes total_score-update → trigger → DELETE → next read
  -- recalculates → total_score-update → trigger → ... ad infinitum.
  IF NEW.breakdown_cached_at IS DISTINCT FROM OLD.breakdown_cached_at THEN
    RETURN NEW;
  END IF;

  BEGIN
    DELETE FROM public.xn_score_breakdown_cache
     WHERE user_id = NEW.user_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'refresh_breakdown_on_adjustment failed for user %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_refresh_breakdown_on_adjustment ON public.xn_scores;
CREATE TRIGGER tr_refresh_breakdown_on_adjustment
  AFTER UPDATE OF total_score ON public.xn_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_breakdown_on_adjustment();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. compute_xnscore_percentiles() RPC + daily cron
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_xnscore_percentiles()
RETURNS TABLE (updated_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  -- PERCENT_RANK() returns 0.0 .. 1.0; multiply by 100 and round to an
  -- integer 0..100 so the column can store it as INTEGER. Frozen scores
  -- are excluded — they would drag the distribution and shouldn't see
  -- their own percentile recomputed against themselves.
  WITH ranked AS (
    SELECT
      xs.user_id,
      ROUND(PERCENT_RANK() OVER (ORDER BY xs.total_score) * 100)::INTEGER AS pct
    FROM public.xn_scores xs
    WHERE xs.score_frozen = FALSE
  ),
  upserted AS (
    INSERT INTO public.xn_score_breakdown_cache (user_id, overall_percentile, expires_at)
    SELECT r.user_id, r.pct, now() + INTERVAL '24 hours'
      FROM ranked r
    ON CONFLICT (user_id) DO UPDATE
      SET overall_percentile = EXCLUDED.overall_percentile,
          updated_at = now()
    RETURNING user_id
  )
  SELECT COUNT(*)::INTEGER INTO v_updated FROM upserted;

  RETURN QUERY SELECT v_updated;
END;
$$;

-- Wire the daily cron at 04:00 UTC. We use Supabase's pg_cron extension;
-- the call is idempotent thanks to cron.unschedule + cron.schedule.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('compute_xnscore_percentiles_daily')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'compute_xnscore_percentiles_daily'
      );
    PERFORM cron.schedule(
      'compute_xnscore_percentiles_daily',
      '0 4 * * *',
      $cron$ SELECT public.compute_xnscore_percentiles(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'compute_xnscore_percentiles_daily cron registration failed: %', SQLERRM;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. apply_xnscore_adjustment — wire recovery_multiplier on positive deltas
-- ─────────────────────────────────────────────────────────────────────────────
-- Drops the old definition by signature (CREATE OR REPLACE rejects a
-- signature change but the signature is unchanged here, so REPLACE is
-- the safe form). Body now:
--
--   1. Resolves any active recovery period for the user.
--   2. For positive p_adjustment values, multiplies by recovery_multiplier
--      BEFORE running through check_velocity_cap. The user feels the
--      bonus immediately; only the velocity cap clamps overflow into the
--      queued increases table.
--   3. Logs the multiplier and the pre/post-multiplier amount into
--      xnscore_history.trigger_details so the audit trail records what
--      really happened.
--   4. Negative adjustments are NOT multiplied (penalties stand at face
--      value during recovery).
CREATE OR REPLACE FUNCTION public.apply_xnscore_adjustment(
    p_user_id UUID,
    p_adjustment DECIMAL,
    p_trigger_event TEXT,
    p_trigger_id UUID DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    previous_score DECIMAL,
    new_score DECIMAL,
    actual_adjustment DECIMAL,
    velocity_capped BOOLEAN,
    queued_amount DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    v_requested DECIMAL;
    v_recovery_multiplier DECIMAL := 1.00;
    v_recovery_applied BOOLEAN := FALSE;
    v_trigger_details TEXT := NULL;
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

    -- Bucket C — apply recovery multiplier to positive deltas BEFORE the
    -- velocity cap so the bonus lands immediately. Penalties pass through
    -- unmultiplied.
    v_requested := p_adjustment;
    IF p_adjustment > 0
       AND COALESCE(v_score.in_recovery_period, FALSE)
       AND COALESCE(v_score.recovery_ends_at, '1970-01-01'::TIMESTAMPTZ) > now() THEN
        v_recovery_multiplier := COALESCE(v_score.recovery_multiplier, 1.50);
        v_requested := p_adjustment * v_recovery_multiplier;
        v_recovery_applied := TRUE;
        v_trigger_details := format(
            'recovery_multiplier=%sx requested=%s effective=%s',
            v_recovery_multiplier, p_adjustment, v_requested
        );
    END IF;

    -- For positive adjustments, check velocity cap (on the multiplied amount)
    IF v_requested > 0 THEN
        SELECT * INTO v_velocity_check FROM check_velocity_cap(p_user_id, v_requested);

        IF NOT v_velocity_check.allowed THEN
            v_actual_adjustment := v_velocity_check.allowed_increase;
            v_queued := v_requested - v_actual_adjustment;

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
            v_actual_adjustment := v_requested;
        END IF;
    ELSE
        -- Negative adjustments bypass velocity (immediate, unmultiplied)
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

    -- Track usage of the active recovery period (mirrors
    -- check_and_apply_recovery_multiplier so existing apply_tenure_bonus
    -- callers still see the same telemetry shape).
    IF v_recovery_applied THEN
        UPDATE xnscore_recovery_periods SET
            bonus_events_during_recovery = bonus_events_during_recovery + 1,
            total_bonus_earned_during = total_bonus_earned_during + GREATEST(0, v_actual_adjustment - p_adjustment),
            updated_at = now()
        WHERE id = v_score.recovery_period_id;
    END IF;

    -- Log to history
    INSERT INTO xnscore_history (
        user_id, score, previous_score, score_change,
        trigger_event, trigger_id, trigger_details,
        raw_score_before_cap, age_cap_applied, age_cap_value,
        weekly_points_before, weekly_points_after,
        velocity_capped
    ) VALUES (
        p_user_id, v_new_capped, v_score.total_score, v_new_capped - v_score.total_score,
        p_trigger_event, p_trigger_id, v_trigger_details,
        v_new_raw, v_new_capped < v_new_raw, v_age_cap,
        v_score.points_gained_this_week,
        CASE WHEN v_actual_adjustment > 0 THEN v_score.points_gained_this_week + v_actual_adjustment ELSE v_score.points_gained_this_week END,
        v_queued > 0
    );

    RETURN QUERY SELECT
        TRUE,
        v_score.total_score,
        v_new_capped,
        v_actual_adjustment,
        v_queued > 0,
        v_queued;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '213',
  'xnscore_automation',
  ARRAY['-- 213: xnscore_automation']
)
ON CONFLICT (version) DO NOTHING;
