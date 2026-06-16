-- ════════════════════════════════════════════════════════════════════════════
-- Migration 181: goal_milestone_notification + deadline check
-- ════════════════════════════════════════════════════════════════════════════
-- Three additions:
--
-- 1. `notify_goal_milestone` trigger on `goal_milestones` — when a row is
--    inserted (the existing _record_goal_milestones helper from migration 078
--    writes one whenever the balance crosses a 10/25/50/75/90/100 threshold),
--    drop a `notifications` row of type 'goal_milestone' for the goal owner.
--
-- 2. New column `user_savings_goals.last_reminder_sent_at` (TIMESTAMPTZ) so
--    the deadline check can dedupe — at most one deadline reminder per
--    goal per 20-hour window. With a daily cron, that yields one reminder
--    per day max.
--
-- 3. `check_goal_deadlines()` function that sweeps active goals with a
--    target_date and inserts a notification when one of three thresholds
--    is crossed:
--       * T-1 day:  always (any goal below 100%)
--       * T-7 days: only if balance/target < 0.75
--       * T-30 days: only if balance/target < 0.50
--    Rules check most-urgent first; one notification per call per goal.
--    Returns jsonb with { inserted, checked_at } so the scheduler EF can
--    log throughput.
--
-- Mirrors the pattern of migration 180 (SECURITY DEFINER, search_path
-- locked, EXCEPTION sub-block so trigger failure can't roll back the
-- goal-side INSERT/UPDATE that fired it).
--
-- Notification body is plain English. A future locale-aware EF can read
-- the data jsonb to localize at delivery time.
--
-- Scheduling:
--   Run `check_goal_deadlines()` daily via pg_cron, e.g.:
--     SELECT cron.schedule(
--       'check_goal_deadlines_daily',
--       '0 9 * * *',  -- 09:00 UTC
--       $$ SELECT public.check_goal_deadlines(); $$
--     );
--   If pg_cron isn't available, an Edge Function on a Supabase Schedule
--   can wrap the call with the service-role key (the function is
--   SECURITY DEFINER so any caller works).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Milestone trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_goal_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_goal_name TEXT;
BEGIN
  SELECT user_id, name
    INTO v_user_id, v_goal_name
    FROM public.user_savings_goals
   WHERE id = NEW.goal_id;

  -- If the goal row vanished mid-trigger (very unlikely — both
  -- INSERTs land in the same transaction), bail silently.
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    body,
    data,
    read
  ) VALUES (
    v_user_id,
    'goal_milestone',
    'Milestone reached!',
    'You''ve reached ' || NEW.milestone_percent ||
      '% of your "' || COALESCE(v_goal_name, 'savings') || '" goal!',
    jsonb_build_object(
      'goal_id', NEW.goal_id,
      'milestone_percent', NEW.milestone_percent
    ),
    FALSE
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Trigger failure must NOT roll back the milestone INSERT itself.
  -- Goal balance and milestone row are intact even if the notification
  -- couldn't be queued.
  RAISE NOTICE 'notify_goal_milestone failed for milestone %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS goal_milestones_notify ON public.goal_milestones;
CREATE TRIGGER goal_milestones_notify
  AFTER INSERT ON public.goal_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_goal_milestone();

-- ─── 2. Deadline-reminder dedup column ──────────────────────────────────────

ALTER TABLE public.user_savings_goals
  ADD COLUMN IF NOT EXISTS last_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.user_savings_goals.last_reminder_sent_at IS
  'Set by check_goal_deadlines() after each notification insert. Prevents '
  'sending more than one deadline reminder per goal per ~20h window when '
  'the cron runs daily.';

-- ─── 3. Deadline check function ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_goal_deadlines()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_goal RECORD;
  v_days_until INT;
  v_balance NUMERIC;
  v_target NUMERIC;
  v_pct NUMERIC;
  v_tier INT;
  v_title TEXT;
  v_body TEXT;
  v_inserted INT := 0;
  v_scanned INT := 0;
BEGIN
  FOR v_goal IN
    SELECT
      id,
      user_id,
      name,
      target_amount_cents,
      current_balance_cents,
      target_date,
      last_reminder_sent_at
    FROM public.user_savings_goals
    WHERE goal_status = 'active'
      AND target_date IS NOT NULL
      AND target_amount_cents > 0
      AND current_balance_cents < target_amount_cents
      AND (last_reminder_sent_at IS NULL
           OR last_reminder_sent_at < NOW() - INTERVAL '20 hours')
  LOOP
    v_scanned := v_scanned + 1;
    v_days_until := (v_goal.target_date - CURRENT_DATE);
    v_target := v_goal.target_amount_cents::NUMERIC / 100;
    v_balance := v_goal.current_balance_cents::NUMERIC / 100;
    v_pct := v_balance / NULLIF(v_target, 0);
    v_tier := NULL;

    -- Most-urgent-first: T-1 wins over T-7 wins over T-30. A goal that
    -- happens to be within 7 days AND behind pace AND within 30 days
    -- fires the T-7 reminder once, then waits 20h before the function
    -- considers it again — by which point the day count has dropped.
    IF v_days_until BETWEEN 0 AND 1 THEN
      v_tier := 1;
      v_title := 'Goal deadline tomorrow';
    ELSIF v_days_until BETWEEN 2 AND 7 AND v_pct < 0.75 THEN
      v_tier := 7;
      v_title := 'Goal deadline in a week';
    ELSIF v_days_until BETWEEN 8 AND 30 AND v_pct < 0.5 THEN
      v_tier := 30;
      v_title := 'Goal deadline in a month';
    END IF;

    IF v_tier IS NOT NULL THEN
      v_body := 'Your "' || COALESCE(v_goal.name, 'savings') ||
                '" goal is due in ' || v_days_until ||
                ' day(s) — you''re at ' || ROUND(v_pct * 100) || '%.';

      BEGIN
        INSERT INTO public.notifications (
          user_id,
          type,
          title,
          body,
          data,
          read
        ) VALUES (
          v_goal.user_id,
          'goal_deadline',
          v_title,
          v_body,
          jsonb_build_object(
            'goal_id', v_goal.id,
            'days_until_target', v_days_until,
            'tier', v_tier
          ),
          FALSE
        );

        UPDATE public.user_savings_goals
           SET last_reminder_sent_at = NOW()
         WHERE id = v_goal.id;

        v_inserted := v_inserted + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Per-goal failure shouldn't kill the whole sweep.
        RAISE NOTICE 'check_goal_deadlines failed for goal %: %',
                     v_goal.id, SQLERRM;
      END;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'scanned', v_scanned,
    'inserted', v_inserted,
    'checked_at', NOW()
  );
END;
$$;

-- Allow service_role and authenticated to invoke (the function is
-- SECURITY DEFINER so the caller's RLS doesn't matter — but PostgREST
-- still gates EXECUTE access).
REVOKE EXECUTE ON FUNCTION public.check_goal_deadlines() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_goal_deadlines() TO service_role;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '181',
  'goal_milestone_notification',
  ARRAY['-- 181: goal_milestone_notification']
)
ON CONFLICT (version) DO NOTHING;
