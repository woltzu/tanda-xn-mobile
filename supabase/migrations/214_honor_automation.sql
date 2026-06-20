-- ════════════════════════════════════════════════════════════════════════════
-- Migration 214: honor_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Bucket C of the Honor Score review.
--
-- Buckets A and B made the screen read real data, render the three pillars,
-- and gave it a HelpSheet + coach mark + per-pillar explainer + sparkline.
-- The score itself was still drifting in four ways that this migration
-- closes:
--
--   1. Tier flips were silent. A user crossing from Trusted (25–49) into
--      Respected (50–74), or losing a tier downward, got nothing — no
--      notification, no audit. The Bucket B coach mark even says "tap a
--      pillar to see what's inside," but a user whose tier just slid
--      below 75 (losing Elder privileges) had no signal it happened.
--
--   2. Recompute was imperative. The old ElderContext fired
--      HonorScoreEngine.computeHonorScore(...) from two places — fragile
--      and easy to miss. A vouch, dispute resolution, or circle
--      completion could pass through the system without ever recomputing
--      the parties' scores, leaving the dashboard stale until the user
--      manually pulled to refresh.
--
--   3. No percentile. honor_scores.total_score was a raw 0–100 number;
--      the Score Hub tile and the future "you rank in the top X %"
--      surfaces had nothing to anchor against.
--
--   4. No deterministic cron. Whatever scheduled job was meant to keep
--      the percentile (and any future seasonal honor decay) fresh did
--      not exist.
--
-- This migration adds:
--
--   1. notify_honor_tier_change trigger on honor_scores AFTER UPDATE OF
--      score_tier. Inserts a `honor_tier_change` notification carrying
--      old_tier / new_tier / score / changed_at. Idempotent by
--      (user_id, type, data->>'changed_at') stamped to second precision.
--      Carries i18n_title_key / i18n_body_key in data for client
--      rendering.
--
--   2. tr_honor_recompute_on_vouch on vouches AFTER INSERT OR UPDATE.
--      Calls compute_honor_score(NEW.voucher_user_id) AND
--      compute_honor_score(NEW.vouchee_user_id) — both sides are
--      affected by the vouch event.
--
--   3. tr_honor_recompute_on_dispute on dispute_cases AFTER UPDATE OF
--      status. Only fires when the case transitions into a terminal
--      state ('resolved' / 'closed'). Recomputes for both complainant
--      and respondent.
--
--   4. tr_honor_recompute_on_circle_completion on circle_cycles AFTER
--      UPDATE OF cycle_status. Only fires on the transition into a
--      terminal cycle state ('closed' / 'payout_completed'). Walks
--      circle_members WHERE status='active' and recomputes each.
--
--   5. compute_honor_percentiles() RPC + daily cron at 05:00 UTC. Runs
--      PERCENT_RANK() over total_score for all rows and writes
--      honor_scores.percentile (new INTEGER column). Returns
--      { updated_count }.
--
-- All trigger functions are SECURITY DEFINER with pinned
-- search_path = public, pg_temp and an EXCEPTION sub-block so a fan-out
-- or recompute failure can't roll back the source-table update that
-- triggered them. Mirrors migrations 188 / 205 / 207 / 208 / 209 / 210 /
-- 211 / 212 / 213.
--
-- The recompute triggers will fan out into compute_honor_score, which
-- updates honor_scores.total_score and honor_scores.score_tier. When
-- the tier actually changes, notify_honor_tier_change fires and the
-- user gets a notification. The percentile cron uses UPDATE
-- honor_scores SET percentile = X (NOT touching score_tier), so the
-- tier-change trigger's `UPDATE OF score_tier` clause keeps it from
-- firing during the daily percentile sweep.
--
-- Self-registers.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. percentile column on honor_scores
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.honor_scores
  ADD COLUMN IF NOT EXISTS percentile INTEGER;

COMMENT ON COLUMN public.honor_scores.percentile IS
  'Daily PERCENT_RANK() of total_score across all rows, 0–100. Written by compute_honor_percentiles() at 05:00 UTC daily.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. notify_honor_tier_change trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_honor_tier_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_tier_str TEXT;
  v_new_tier_str TEXT;
  v_direction    TEXT;
  v_changed_at   TEXT;
  v_existing_id  UUID;
BEGIN
  -- UPDATE OF score_tier fires whenever the column appears in SET,
  -- not just on transitions. Short-circuit when the value didn't move.
  IF OLD.score_tier IS NOT DISTINCT FROM NEW.score_tier THEN
    RETURN NEW;
  END IF;

  v_old_tier_str := OLD.score_tier::TEXT;
  v_new_tier_str := NEW.score_tier::TEXT;

  -- Honor tier order (top → bottom):
  --   Grand Elder > Elder > Respected > Trusted > Novice
  -- Direction lets the client pick "tier up" vs "tier down" copy.
  v_direction := CASE
    WHEN CASE OLD.score_tier::TEXT
            WHEN 'Grand Elder' THEN 5 WHEN 'Elder' THEN 4
            WHEN 'Respected'  THEN 3 WHEN 'Trusted' THEN 2
            ELSE 1 END
       < CASE NEW.score_tier::TEXT
            WHEN 'Grand Elder' THEN 5 WHEN 'Elder' THEN 4
            WHEN 'Respected'  THEN 3 WHEN 'Trusted' THEN 2
            ELSE 1 END
    THEN 'up'
    ELSE 'down'
  END;

  v_changed_at := TO_CHAR(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');

  BEGIN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.user_id
       AND type = 'honor_tier_change'
       AND data->>'changed_at' = v_changed_at
     LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.user_id,
        'honor_tier_change',
        'Honor Score tier updated',
        'Your Honor Score has moved from ' || v_old_tier_str || ' to ' || v_new_tier_str || '.',
        jsonb_build_object(
          'old_tier', v_old_tier_str,
          'new_tier', v_new_tier_str,
          'direction', v_direction,
          'score', NEW.total_score,
          'changed_at', v_changed_at,
          'i18n_title_key', 'honor.notification_tier_change_title',
          'i18n_body_key',  'honor.notification_tier_change_body'
        ),
        FALSE
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- A fan-out failure must not roll back the honor_scores update.
    RAISE WARNING 'notify_honor_tier_change failed for user %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_honor_tier_change ON public.honor_scores;
CREATE TRIGGER tr_honor_tier_change
  AFTER UPDATE OF score_tier ON public.honor_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_honor_tier_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. tr_honor_recompute_on_vouch
-- ─────────────────────────────────────────────────────────────────────────────
-- Both sides of a vouch are affected: the voucher's Character pillar
-- moves on creation and defaults, and the vouchee's Community pillar
-- benefits from a received vouch. Fires on INSERT (new vouch) and on
-- UPDATE (status changes, e.g. vouchee_has_defaulted flip).
CREATE OR REPLACE FUNCTION public.honor_recompute_on_vouch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    IF NEW.voucher_user_id IS NOT NULL THEN
      PERFORM public.compute_honor_score(NEW.voucher_user_id);
    END IF;
    IF NEW.vouchee_user_id IS NOT NULL THEN
      PERFORM public.compute_honor_score(NEW.vouchee_user_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'honor_recompute_on_vouch failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_honor_recompute_on_vouch ON public.vouches;
CREATE TRIGGER tr_honor_recompute_on_vouch
  AFTER INSERT OR UPDATE ON public.vouches
  FOR EACH ROW
  EXECUTE FUNCTION public.honor_recompute_on_vouch();


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. tr_honor_recompute_on_dispute
-- ─────────────────────────────────────────────────────────────────────────────
-- Only fires when the case transitions INTO a terminal state. Both
-- complainant and respondent's Character pillar move on resolution.
CREATE OR REPLACE FUNCTION public.honor_recompute_on_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status::TEXT = NEW.status::TEXT THEN
    RETURN NEW;
  END IF;
  IF NEW.status::TEXT NOT IN ('resolved', 'closed') THEN
    RETURN NEW;
  END IF;

  BEGIN
    IF NEW.complainant_id IS NOT NULL THEN
      PERFORM public.compute_honor_score(NEW.complainant_id);
    END IF;
    IF NEW.respondent_id IS NOT NULL THEN
      PERFORM public.compute_honor_score(NEW.respondent_id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'honor_recompute_on_dispute failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_honor_recompute_on_dispute ON public.dispute_cases;
CREATE TRIGGER tr_honor_recompute_on_dispute
  AFTER UPDATE OF status ON public.dispute_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.honor_recompute_on_dispute();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. tr_honor_recompute_on_circle_completion
-- ─────────────────────────────────────────────────────────────────────────────
-- Only fires when the cycle transitions INTO a terminal state. Walks
-- the circle's active members and recomputes each.
CREATE OR REPLACE FUNCTION public.honor_recompute_on_circle_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member RECORD;
BEGIN
  IF OLD.cycle_status::TEXT = NEW.cycle_status::TEXT THEN
    RETURN NEW;
  END IF;
  IF NEW.cycle_status::TEXT NOT IN ('closed', 'payout_completed') THEN
    RETURN NEW;
  END IF;

  BEGIN
    FOR v_member IN
      SELECT user_id
        FROM public.circle_members
       WHERE circle_id = NEW.circle_id
         AND status = 'active'
    LOOP
      PERFORM public.compute_honor_score(v_member.user_id);
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'honor_recompute_on_circle_completion failed for circle %: %', NEW.circle_id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_honor_recompute_on_circle_completion ON public.circle_cycles;
CREATE TRIGGER tr_honor_recompute_on_circle_completion
  AFTER UPDATE OF cycle_status ON public.circle_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.honor_recompute_on_circle_completion();


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. compute_honor_percentiles() RPC + daily cron at 05:00 UTC
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_honor_percentiles()
RETURNS TABLE (updated_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  -- PERCENT_RANK() returns 0.0 .. 1.0; multiply by 100 and round to an
  -- INTEGER so the column stays compact. Skips rows whose pct didn't
  -- actually change so we only count real writes.
  WITH ranked AS (
    SELECT
      user_id,
      ROUND(PERCENT_RANK() OVER (ORDER BY total_score) * 100)::INTEGER AS pct
    FROM public.honor_scores
  ),
  upd AS (
    UPDATE public.honor_scores hs
       SET percentile = r.pct
      FROM ranked r
     WHERE hs.user_id = r.user_id
       AND hs.percentile IS DISTINCT FROM r.pct
   RETURNING hs.user_id
  )
  SELECT COUNT(*)::INTEGER INTO v_updated FROM upd;

  RETURN QUERY SELECT v_updated;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('compute_honor_percentiles_daily')
      WHERE EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'compute_honor_percentiles_daily'
      );
    PERFORM cron.schedule(
      'compute_honor_percentiles_daily',
      '0 5 * * *',
      $cron$ SELECT public.compute_honor_percentiles(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'compute_honor_percentiles_daily cron registration failed: %', SQLERRM;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '214',
  'honor_automation',
  ARRAY['-- 214: honor_automation']
)
ON CONFLICT (version) DO NOTHING;
