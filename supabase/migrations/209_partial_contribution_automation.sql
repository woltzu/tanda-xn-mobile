-- ════════════════════════════════════════════════════════════════════════════
-- Migration 209: partial_contribution_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Bucket C of the Partial Contribution review.
--
--   1. notify_partial_plan_state_change — trigger on
--      partial_contribution_plans that fans out notifications as the
--      4-state machine moves. Fires on:
--        * active (initial INSERT, or UPDATE OF status from elsewhere)
--          → user + each elder/admin/creator of the circle
--        * completed → the user
--        * cancelled → user + each elder/admin/creator
--        * defaulted → user + each elder/admin/creator
--      Idempotent via (user_id, type, data->>'plan_id', data->>'status').
--
--   2. process_partial_catch_up_reminders() + nightly cron at 10:00 UTC.
--      Walks every active plan's catch_up_schedule JSONB and emits a
--      'partial_catch_up_reminder' notification for items where
--      due_date falls in [today, today + 3 days] and status='scheduled'.
--      item_id is plan_id + ':' + cycle_number — the natural composite
--      key for JSONB items, since the schedule has no primary key.
--      Dedupe by (user_id, type, item_id).
--
-- All SECURITY DEFINER + search_path locked + EXCEPTION sub-block so a
-- downstream failure can't roll back the work that fired it. Mirrors
-- migrations 205 / 207 / 208.
--
-- Self-registers.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notify_partial_plan_state_change — trigger function
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_partial_plan_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
  v_pay_now_str TEXT;
  v_existing_id UUID;
  v_recipient   RECORD;
BEGIN
  -- Only act on a real transition. INSERT always passes (initial state
  -- of 'active' needs notification on first sight).
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  -- Status branches we don't recognize → silently skip.
  IF NEW.status NOT IN ('active', 'completed', 'cancelled', 'defaulted') THEN
    RETURN NEW;
  END IF;

  -- Resolve circle name; defensive fallback so a join miss can't hide
  -- the notification.
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');

  -- Plain-language "pay now" amount for the activated branch.
  v_pay_now_str := ROUND(NEW.paid_amount_cents / 100.0, 2)::TEXT;

  -- ─── active (initial activation) → user + elders ────────────────────────
  IF NEW.status = 'active' THEN
    -- User
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.member_id
       AND type = 'partial_plan_activated'
       AND data->>'plan_id' = NEW.id::text
       AND data->>'status' = 'active'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.member_id,
        'partial_plan_activated',
        'Flexible payment plan activated',
        'Your flexible payment plan for ' || v_circle_name
          || ' is active. Pay $' || v_pay_now_str || ' now.',
        jsonb_build_object(
          'plan_id',        NEW.id,
          'status',         NEW.status,
          'circle_id',      NEW.circle_id,
          'circle_name',    v_circle_name,
          'pay_now_cents',  NEW.paid_amount_cents,
          'recipient_role', 'member',
          'i18n_title_key', 'partial.notification_activated_title',
          'i18n_body_key',  'partial.notification_activated_body'
        ),
        FALSE
      );
    END IF;
    -- Elders / admins / creators (skip the member who's also on this row)
    FOR v_recipient IN
      SELECT user_id
        FROM public.circle_members
       WHERE circle_id = NEW.circle_id
         AND role IN ('elder', 'admin', 'creator')
         AND status = 'active'
    LOOP
      IF v_recipient.user_id = NEW.member_id THEN
        CONTINUE;
      END IF;
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'partial_plan_activated'
         AND data->>'plan_id' = NEW.id::text
         AND data->>'status' = 'active'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'partial_plan_activated',
          'Flexible payment plan activated',
          'A flexible payment plan for ' || v_circle_name
            || ' is now active.',
          jsonb_build_object(
            'plan_id',        NEW.id,
            'status',         NEW.status,
            'circle_id',      NEW.circle_id,
            'circle_name',    v_circle_name,
            'pay_now_cents',  NEW.paid_amount_cents,
            'recipient_role', 'elder',
            'i18n_title_key', 'partial.notification_activated_title',
            'i18n_body_key',  'partial.notification_activated_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;

  -- ─── completed → user only ──────────────────────────────────────────────
  ELSIF NEW.status = 'completed' THEN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.member_id
       AND type = 'partial_plan_completed'
       AND data->>'plan_id' = NEW.id::text
       AND data->>'status' = 'completed'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.member_id,
        'partial_plan_completed',
        'Flexible plan complete',
        'All catch-ups paid. Your flexible plan for ' || v_circle_name
          || ' is complete.',
        jsonb_build_object(
          'plan_id',        NEW.id,
          'status',         NEW.status,
          'circle_id',      NEW.circle_id,
          'circle_name',    v_circle_name,
          'i18n_title_key', 'partial.notification_completed_title',
          'i18n_body_key',  'partial.notification_completed_body'
        ),
        FALSE
      );
    END IF;

  -- ─── cancelled → user + elders ──────────────────────────────────────────
  ELSIF NEW.status = 'cancelled' THEN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.member_id
       AND type = 'partial_plan_cancelled'
       AND data->>'plan_id' = NEW.id::text
       AND data->>'status' = 'cancelled'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.member_id,
        'partial_plan_cancelled',
        'Flexible plan cancelled',
        'Your flexible plan for ' || v_circle_name || ' has been cancelled.',
        jsonb_build_object(
          'plan_id',        NEW.id,
          'status',         NEW.status,
          'circle_id',      NEW.circle_id,
          'circle_name',    v_circle_name,
          'recipient_role', 'member',
          'i18n_title_key', 'partial.notification_cancelled_title',
          'i18n_body_key',  'partial.notification_cancelled_body'
        ),
        FALSE
      );
    END IF;
    FOR v_recipient IN
      SELECT user_id
        FROM public.circle_members
       WHERE circle_id = NEW.circle_id
         AND role IN ('elder', 'admin', 'creator')
         AND status = 'active'
    LOOP
      IF v_recipient.user_id = NEW.member_id THEN
        CONTINUE;
      END IF;
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'partial_plan_cancelled'
         AND data->>'plan_id' = NEW.id::text
         AND data->>'status' = 'cancelled'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'partial_plan_cancelled',
          'Flexible plan cancelled',
          'A flexible plan for ' || v_circle_name || ' has been cancelled.',
          jsonb_build_object(
            'plan_id',        NEW.id,
            'status',         NEW.status,
            'circle_id',      NEW.circle_id,
            'circle_name',    v_circle_name,
            'recipient_role', 'elder',
            'i18n_title_key', 'partial.notification_cancelled_title',
            'i18n_body_key',  'partial.notification_cancelled_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;

  -- ─── defaulted → user + elders ──────────────────────────────────────────
  ELSIF NEW.status = 'defaulted' THEN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.member_id
       AND type = 'partial_plan_defaulted'
       AND data->>'plan_id' = NEW.id::text
       AND data->>'status' = 'defaulted'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.member_id,
        'partial_plan_defaulted',
        'Catch-up payment missed',
        'A catch-up payment for ' || v_circle_name
          || ' was missed. Your XnScore may be affected.',
        jsonb_build_object(
          'plan_id',        NEW.id,
          'status',         NEW.status,
          'circle_id',      NEW.circle_id,
          'circle_name',    v_circle_name,
          'recipient_role', 'member',
          'i18n_title_key', 'partial.notification_defaulted_title',
          'i18n_body_key',  'partial.notification_defaulted_body'
        ),
        FALSE
      );
    END IF;
    FOR v_recipient IN
      SELECT user_id
        FROM public.circle_members
       WHERE circle_id = NEW.circle_id
         AND role IN ('elder', 'admin', 'creator')
         AND status = 'active'
    LOOP
      IF v_recipient.user_id = NEW.member_id THEN
        CONTINUE;
      END IF;
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'partial_plan_defaulted'
         AND data->>'plan_id' = NEW.id::text
         AND data->>'status' = 'defaulted'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'partial_plan_defaulted',
          'Catch-up payment missed',
          'A catch-up payment for ' || v_circle_name || ' was missed.',
          jsonb_build_object(
            'plan_id',        NEW.id,
            'status',         NEW.status,
            'circle_id',      NEW.circle_id,
            'circle_name',    v_circle_name,
            'recipient_role', 'elder',
            'i18n_title_key', 'partial.notification_defaulted_title',
            'i18n_body_key',  'partial.notification_defaulted_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_partial_plan_state_change failed for plan %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partial_contribution_plans_state_notify ON public.partial_contribution_plans;
CREATE TRIGGER partial_contribution_plans_state_notify
  AFTER INSERT OR UPDATE OF status ON public.partial_contribution_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_partial_plan_state_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. process_partial_catch_up_reminders() — nightly T-3 day reminder scan
-- ─────────────────────────────────────────────────────────────────────────────
-- Walks every active plan, unnests the catch_up_schedule JSONB, and emits
-- a reminder for items due within the next 3 days that haven't been paid
-- yet. item_id = plan_id + ':' + cycle_number is the dedupe key
-- (catch_up_schedule has no primary key — it's a JSONB array).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.process_partial_catch_up_reminders()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reminded     INTEGER := 0;
  v_row          RECORD;
  v_item         JSONB;
  v_item_id      TEXT;
  v_circle_name  TEXT;
  v_due_date     DATE;
  v_amount_str   TEXT;
  v_existing_id  UUID;
BEGIN
  FOR v_row IN
    SELECT p.id           AS plan_id,
           p.member_id    AS user_id,
           p.circle_id    AS circle_id,
           p.catch_up_schedule,
           c.name         AS circle_name
      FROM public.partial_contribution_plans p
      LEFT JOIN public.circles c ON c.id = p.circle_id
     WHERE p.status = 'active'
  LOOP
    v_circle_name := COALESCE(v_row.circle_name, 'your circle');

    FOR v_item IN
      SELECT * FROM jsonb_array_elements(v_row.catch_up_schedule)
    LOOP
      IF (v_item->>'status') <> 'scheduled' THEN
        CONTINUE;
      END IF;

      v_due_date := (v_item->>'due_date')::date;
      IF v_due_date IS NULL THEN
        CONTINUE;
      END IF;
      IF v_due_date < (NOW()::date)
         OR v_due_date > (NOW()::date + INTERVAL '3 days') THEN
        CONTINUE;
      END IF;

      v_item_id := v_row.plan_id::text || ':' || (v_item->>'cycle_number');
      v_amount_str := ROUND((v_item->>'amount_cents')::BIGINT / 100.0, 2)::TEXT;

      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_row.user_id
         AND type = 'partial_catch_up_reminder'
         AND data->>'item_id' = v_item_id
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_row.user_id,
          'partial_catch_up_reminder',
          'Catch-up payment due soon',
          'Catch-up payment of $' || v_amount_str
            || ' for ' || v_circle_name
            || ' is due on ' || v_due_date::text || '.',
          jsonb_build_object(
            'plan_id',        v_row.plan_id,
            'item_id',        v_item_id,
            'circle_id',      v_row.circle_id,
            'circle_name',    v_circle_name,
            'amount_cents',   (v_item->>'amount_cents')::BIGINT,
            'due_date',       v_due_date,
            'cycle_number',   (v_item->>'cycle_number')::INTEGER,
            'i18n_title_key', 'partial.notification_catch_up_reminder_title',
            'i18n_body_key',  'partial.notification_catch_up_reminder_body'
          ),
          FALSE
        );
        v_reminded := v_reminded + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('reminded', v_reminded, 'ran_at', NOW());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'process_partial_catch_up_reminders failed: %', SQLERRM;
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_partial_catch_up_reminders() TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. pg_cron schedule — daily 10:00 UTC. Idempotent via EXISTS guard.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule('partial_catch_up_reminder_daily')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'partial_catch_up_reminder_daily'
 );

SELECT cron.schedule(
  'partial_catch_up_reminder_daily',
  '0 10 * * *',
  $$SELECT public.process_partial_catch_up_reminders();$$
);


-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '209',
  'partial_contribution_automation',
  ARRAY['-- 209: partial_contribution_automation']
)
ON CONFLICT (version) DO NOTHING;
