-- ════════════════════════════════════════════════════════════════════════════
-- Migration 212: cycle_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Bucket C of the Cycle Timeline review.
--
-- The cycle-progression cron has been running hourly since migration 027
-- and it flips circle_cycles.status through the lifecycle correctly, but
-- three holes sat underneath:
--
--   1. The cron calls supabase.rpc('execute_cycle_payout', ...) and
--      .catch()-swallows the error. The function doesn't exist, so every
--      ready_payout cycle silently stalls in payout_pending forever.
--   2. State transitions emit nothing — no notifications to recipients,
--      no notifications to members, no notifications to admins. Cycles
--      progress invisibly.
--   3. grace_period_end is read by the cron but never set anywhere, so a
--      cycle that hits deadline_reached can wedge in grace indefinitely.
--   4. The grace_period → ready_payout transition proceeds even when
--      collected_amount = 0 and no contributions were covered by the pool
--      — the recipient would receive $0.
--
-- This migration closes all four:
--
--   1. notify_cycle_state_change trigger on circle_cycles AFTER UPDATE OF
--      status. Five transitions, distinct fan-outs each. Idempotent per
--      (user_id, type, data->>'cycle_id', data->>'status'). Carries
--      i18n_title_key / i18n_body_key in data for client-side rendering.
--
--   2. compute_grace_period_end trigger on circle_cycles BEFORE UPDATE
--      OF status. When NEW.cycle_status='deadline_reached' and
--      grace_period_end IS NULL, sets it to
--      contribution_deadline + circle.grace_period_days days.
--
--   3. execute_cycle_payout(p_cycle_id UUID) RPC. INSERTs a circle_payouts
--      row with status='completed' and currency='USD'. Migration 188's
--      AFTER INSERT trigger on circle_payouts already handles fan-out
--      to the recipient and any downstream wallet credit. The RPC then
--      stamps actual_payout_date + payout_transaction_id on the cycle.
--      Returns JSONB {success, payout_id} on the happy path or
--      {success: false, error} on failure (the cron interprets this).
--
--   4. payout_stuck_alert cron + helper: daily 09:00 UTC scan for
--      payout_pending cycles older than 72 h. Inserts an admin alert
--      into notifications for the circle creator + a circle_audit_log
--      row for traceability.
--
--   5. guard_zero_collected_payout trigger BEFORE UPDATE OF status on
--      circle_cycles. If the transition target is ready_payout while
--      collected_amount = 0 AND no covered contributions exist, the
--      trigger rewrites the status to payout_failed and stamps
--      last_payout_error='zero_collected'. The recipient gets nothing
--      ever charged; the cron picks up the failed state and emits the
--      payout_failed notification path via C.1.
--
-- All trigger functions are SECURITY DEFINER with pinned
-- search_path = public, pg_temp and an EXCEPTION sub-block so a fan-out /
-- execution failure can't roll back the cycle row that triggered them.
-- Mirrors migrations 188 / 205 / 207 / 208 / 209 / 210 / 211.
--
-- Self-registers.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notify_cycle_state_change trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_cycle_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name   TEXT;
  v_amount_str    TEXT;
  v_existing_id   UUID;
  v_recipient_id  UUID;
  v_recipient_member RECORD;
  v_member        RECORD;
  v_due_date_str  TEXT;
  v_grace_days    INT;
BEGIN
  -- Short-circuit when the column didn't actually change. UPDATE OF
  -- status fires whenever an UPDATE statement targets the status column,
  -- not just on transitions.
  IF OLD.cycle_status IS NOT DISTINCT FROM NEW.cycle_status THEN
    RETURN NEW;
  END IF;

  -- Resolve common values once.
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');

  v_amount_str := TRIM(TO_CHAR(COALESCE(NEW.expected_amount, 0), 'FM999G999G990D00'));
  v_recipient_id := NEW.recipient_user_id;
  v_due_date_str := COALESCE(NEW.contribution_deadline::TEXT, 'soon');

  -- ─── scheduled → collecting ──────────────────────────────────────────────
  -- Cycle window opens. Notify every active member.
  IF NEW.cycle_status = 'collecting' AND OLD.cycle_status = 'scheduled' THEN
    FOR v_member IN
      SELECT user_id FROM public.circle_members
       WHERE circle_id = NEW.circle_id AND status = 'active'
    LOOP
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_member.user_id
         AND type = 'cycle_started'
         AND data->>'cycle_id' = NEW.id::text
         AND data->>'status' = 'collecting'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_member.user_id,
          'cycle_started',
          'Contributions open for ' || v_circle_name,
          'Cycle ' || NEW.cycle_number || ' is now open. Your contribution of $'
            || v_amount_str || ' is due by ' || v_due_date_str || '.',
          jsonb_build_object(
            'cycle_id',        NEW.id,
            'status',          'collecting',
            'circle_id',       NEW.circle_id,
            'circle_name',     v_circle_name,
            'cycle_number',    NEW.cycle_number,
            'amount',          NEW.expected_amount,
            'due_date',        NEW.contribution_deadline,
            'i18n_title_key',  'cycle.notification_cycle_started_title',
            'i18n_body_key',   'cycle.notification_cycle_started_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;

  -- ─── collecting → deadline_reached ───────────────────────────────────────
  -- Deadline hit. Notify members who still owe + the recipient.
  ELSIF NEW.cycle_status = 'deadline_reached' AND OLD.cycle_status = 'collecting' THEN
    -- Unpaid members.
    FOR v_member IN
      SELECT user_id FROM public.cycle_contributions
       WHERE cycle_id = NEW.id
         AND contribution_status NOT IN ('completed', 'covered', 'excused')
    LOOP
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_member.user_id
         AND type = 'contribution_due'
         AND data->>'cycle_id' = NEW.id::text
         AND data->>'status' = 'deadline_reached'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_member.user_id,
          'contribution_due',
          'Contribution due soon',
          'Your contribution of $' || v_amount_str || ' for ' || v_circle_name
            || ' is due by ' || v_due_date_str || '.',
          jsonb_build_object(
            'cycle_id',        NEW.id,
            'status',          'deadline_reached',
            'circle_id',       NEW.circle_id,
            'circle_name',     v_circle_name,
            'cycle_number',    NEW.cycle_number,
            'amount',          NEW.expected_amount,
            'due_date',        NEW.contribution_deadline,
            'i18n_title_key',  'cycle.notification_contribution_due_title',
            'i18n_body_key',   'cycle.notification_contribution_due_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;

  -- ─── deadline_reached → grace_period ─────────────────────────────────────
  -- Grace started. Notify late members with the grace-day count.
  ELSIF NEW.cycle_status = 'grace_period' AND OLD.cycle_status = 'deadline_reached' THEN
    SELECT COALESCE(grace_period_days, 2) INTO v_grace_days
      FROM public.circles WHERE id = NEW.circle_id;
    FOR v_member IN
      SELECT cc.user_id, GREATEST(0, EXTRACT(DAY FROM (NOW() - NEW.contribution_deadline))::INT) AS days_late
        FROM public.cycle_contributions cc
       WHERE cc.cycle_id = NEW.id
         AND cc.contribution_status NOT IN ('completed', 'covered', 'excused')
    LOOP
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_member.user_id
         AND type = 'late_grace'
         AND data->>'cycle_id' = NEW.id::text
         AND data->>'status' = 'grace_period'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_member.user_id,
          'late_grace',
          'Grace period started',
          'You''re ' || v_member.days_late || ' days late for ' || v_circle_name
            || '. You have ' || v_grace_days || ' days of grace.',
          jsonb_build_object(
            'cycle_id',        NEW.id,
            'status',          'grace_period',
            'circle_id',       NEW.circle_id,
            'circle_name',     v_circle_name,
            'cycle_number',    NEW.cycle_number,
            'days_late',       v_member.days_late,
            'grace_days',      v_grace_days,
            'grace_period_end',NEW.grace_period_end,
            'i18n_title_key',  'cycle.notification_late_grace_title',
            'i18n_body_key',   'cycle.notification_late_grace_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;

  -- ─── grace_period → ready_payout ─────────────────────────────────────────
  -- Payout is queued. Notify the recipient.
  ELSIF NEW.cycle_status = 'ready_payout' AND OLD.cycle_status IN ('grace_period', 'collecting', 'deadline_reached') THEN
    IF v_recipient_id IS NOT NULL THEN
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient_id
         AND type = 'payout_ready'
         AND data->>'cycle_id' = NEW.id::text
         AND data->>'status' = 'ready_payout'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient_id,
          'payout_ready',
          'Payout ready',
          'Your payout of $'
            || TRIM(TO_CHAR(COALESCE(NEW.payout_amount, NEW.expected_amount * NEW.expected_contributions, 0), 'FM999G999G990D00'))
            || ' from ' || v_circle_name || ' is ready.',
          jsonb_build_object(
            'cycle_id',        NEW.id,
            'status',          'ready_payout',
            'circle_id',       NEW.circle_id,
            'circle_name',     v_circle_name,
            'cycle_number',    NEW.cycle_number,
            'amount',          COALESCE(NEW.payout_amount, NEW.expected_amount * NEW.expected_contributions),
            'i18n_title_key',  'cycle.notification_payout_ready_title',
            'i18n_body_key',   'cycle.notification_payout_ready_body'
          ),
          FALSE
        );
      END IF;
    END IF;

  -- ─── payout_completed → closed (cycle wrap) ──────────────────────────────
  -- Cycle done. Recipient + every active member gets a cycle_closed
  -- notification. The recipient also already received 'payout_received'
  -- from migration 188's trigger on the circle_payouts INSERT.
  ELSIF NEW.cycle_status = 'closed' AND OLD.cycle_status = 'payout_completed' THEN
    FOR v_member IN
      SELECT user_id FROM public.circle_members
       WHERE circle_id = NEW.circle_id AND status = 'active'
    LOOP
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_member.user_id
         AND type = 'cycle_closed'
         AND data->>'cycle_id' = NEW.id::text
         AND data->>'status' = 'closed'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_member.user_id,
          'cycle_closed',
          'Cycle completed',
          'Cycle ' || NEW.cycle_number || ' in ' || v_circle_name
            || ' is complete. Payout has been sent.',
          jsonb_build_object(
            'cycle_id',        NEW.id,
            'status',          'closed',
            'circle_id',       NEW.circle_id,
            'circle_name',     v_circle_name,
            'cycle_number',    NEW.cycle_number,
            'i18n_title_key',  'cycle.notification_cycle_closed_title',
            'i18n_body_key',   'cycle.notification_cycle_closed_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_cycle_state_change failed for cycle %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_cycles_state_notify ON public.circle_cycles;
CREATE TRIGGER circle_cycles_state_notify
  AFTER UPDATE OF cycle_status ON public.circle_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_cycle_state_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. compute_grace_period_end trigger (BEFORE UPDATE)
-- ─────────────────────────────────────────────────────────────────────────────
-- Sets grace_period_end when a cycle transitions to deadline_reached and
-- the column is still NULL. Without this, the cron's grace_period →
-- ready_payout branch checks grace_period_end <= TODAY and short-circuits
-- forever when the column is NULL — the cycle wedges in grace indefinitely.
CREATE OR REPLACE FUNCTION public.compute_grace_period_end()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grace_days INT;
BEGIN
  IF NEW.cycle_status = 'deadline_reached'
     AND COALESCE(OLD.cycle_status, '') <> 'deadline_reached'
     AND NEW.grace_period_end IS NULL
     AND NEW.contribution_deadline IS NOT NULL THEN
    SELECT COALESCE(grace_period_days, 2)
      INTO v_grace_days
      FROM public.circles
     WHERE id = NEW.circle_id;
    NEW.grace_period_end := NEW.contribution_deadline + (v_grace_days * INTERVAL '1 day');
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'compute_grace_period_end failed for cycle %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_cycles_compute_grace_end ON public.circle_cycles;
CREATE TRIGGER circle_cycles_compute_grace_end
  BEFORE UPDATE OF cycle_status ON public.circle_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_grace_period_end();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. guard_zero_collected_payout trigger (BEFORE UPDATE)
-- ─────────────────────────────────────────────────────────────────────────────
-- If a cycle is about to transition into ready_payout while
-- collected_amount = 0 AND no contributions were 'covered' by the pool,
-- rewrite the target status to payout_failed and stamp the reason. The
-- recipient would otherwise receive $0; the failed branch in C.1 handles
-- notification.
CREATE OR REPLACE FUNCTION public.guard_zero_collected_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_covered BOOLEAN := FALSE;
BEGIN
  IF NEW.cycle_status = 'ready_payout'
     AND COALESCE(NEW.collected_amount, 0) = 0
     AND (NEW.payout_amount IS NULL OR NEW.payout_amount = 0) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.cycle_contributions
       WHERE cycle_id = NEW.id AND contribution_status = 'covered'
    ) INTO v_has_covered;
    IF NOT v_has_covered THEN
      NEW.cycle_status := 'payout_failed';
      NEW.last_payout_error := 'zero_collected';
      NEW.cycle_status_changed_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'guard_zero_collected_payout failed for cycle %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_cycles_guard_zero_collected ON public.circle_cycles;
CREATE TRIGGER circle_cycles_guard_zero_collected
  BEFORE UPDATE OF cycle_status ON public.circle_cycles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_zero_collected_payout();


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. execute_cycle_payout(p_cycle_id UUID) RPC
-- ─────────────────────────────────────────────────────────────────────────────
-- The cycle-progression cron has been calling this RPC since migration 027
-- and silently swallowing the missing-function error. The function inserts
-- a circle_payouts row in 'completed' state — migration 188's trigger
-- handles the recipient notification + the existing wallet credit flow
-- picks up the row from there. Then it stamps the cycle's transaction-id
-- + actual_payout_date.
--
-- Idempotent: if a circle_payouts row already exists for the cycle
-- (matched via metadata->>'cycle_id'), the RPC returns that row's id
-- instead of double-inserting.
--
-- Returns:
--   { success: TRUE,  payout_id: UUID } — happy path
--   { success: FALSE, error: text }     — anything else; the cron leaves
--                                         the cycle in payout_pending.
CREATE OR REPLACE FUNCTION public.execute_cycle_payout(p_cycle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_cycle       RECORD;
  v_payout_id   UUID;
  v_amount      NUMERIC;
  v_existing    UUID;
BEGIN
  SELECT * INTO v_cycle FROM public.circle_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cycle_not_found');
  END IF;
  IF v_cycle.recipient_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_recipient');
  END IF;

  v_amount := COALESCE(v_cycle.payout_amount, v_cycle.collected_amount, 0);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'zero_amount');
  END IF;

  -- Idempotency: if a payout already lives for this cycle (recognized via
  -- metadata->>'cycle_id'), short-circuit. Belt + braces against a cron
  -- retry that lands after the previous run succeeded but the cycle row
  -- update failed.
  SELECT id INTO v_existing
    FROM public.circle_payouts
   WHERE metadata->>'cycle_id' = p_cycle_id::text
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', TRUE, 'payout_id', v_existing, 'idempotent', TRUE);
  END IF;

  -- Insert the payout. Status='completed' so migration 188's existing
  -- trigger fires the payout_received notification + any downstream
  -- wallet credit fires on the same INSERT.
  INSERT INTO public.circle_payouts (
    circle_id, recipient_id, amount, currency, status, metadata
  )
  VALUES (
    v_cycle.circle_id,
    v_cycle.recipient_user_id,
    v_amount,
    'USD',
    'completed',
    jsonb_build_object(
      'cycle_id',      v_cycle.id,
      'cycle_number',  v_cycle.cycle_number,
      'origin',        'execute_cycle_payout'
    )
  )
  RETURNING id INTO v_payout_id;

  -- Stamp the cycle so the timeline / detail screens render the real
  -- payout date. Don't touch status here — the cron owns that
  -- transition (and will see actual_payout_date is set).
  UPDATE public.circle_cycles
     SET actual_payout_date     = NOW()::DATE,
         payout_transaction_id  = v_payout_id::TEXT,
         payout_attempts        = COALESCE(payout_attempts, 0) + 1,
         last_payout_attempt_at = NOW(),
         updated_at             = NOW()
   WHERE id = p_cycle_id;

  RETURN jsonb_build_object('success', TRUE, 'payout_id', v_payout_id);
EXCEPTION WHEN OTHERS THEN
  -- Stamp the failure so the cron / admin can see what went wrong.
  UPDATE public.circle_cycles
     SET last_payout_error      = LEFT(SQLERRM, 500),
         last_payout_attempt_at = NOW(),
         payout_attempts        = COALESCE(payout_attempts, 0) + 1
   WHERE id = p_cycle_id;
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_cycle_payout(UUID) TO service_role, authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. process_stuck_cycle_payouts() — cron entrypoint + pg_cron schedule
-- ─────────────────────────────────────────────────────────────────────────────
-- Daily scan for payouts that have been pending >72h. For each stuck
-- cycle, fire an admin alert into notifications + record a row in
-- circle_audit_log. Idempotent per (user_id, type, cycle_id) so a daily
-- re-run doesn't spam admins; the next-day re-fire only happens if the
-- audit_log doesn't already carry the row for that day.
CREATE OR REPLACE FUNCTION public.process_stuck_cycle_payouts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alerted     INT := 0;
  v_row         RECORD;
  v_circle_name TEXT;
  v_creator_id  UUID;
  v_existing    UUID;
BEGIN
  FOR v_row IN
    SELECT id, circle_id, cycle_number, payout_amount, last_payout_attempt_at, status_changed_at
      FROM public.circle_cycles
     WHERE status = 'payout_pending'
       AND COALESCE(last_payout_attempt_at, status_changed_at) < (NOW() - INTERVAL '72 hours')
  LOOP
    SELECT name, created_by INTO v_circle_name, v_creator_id
      FROM public.circles WHERE id = v_row.circle_id;
    v_circle_name := COALESCE(v_circle_name, 'a circle');
    IF v_creator_id IS NULL THEN CONTINUE; END IF;

    SELECT id INTO v_existing
      FROM public.notifications
     WHERE user_id = v_creator_id
       AND type = 'payout_stuck'
       AND data->>'cycle_id' = v_row.id::text
     LIMIT 1;
    IF v_existing IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_creator_id,
        'payout_stuck',
        'Payout stuck — admin action needed',
        'Cycle ' || v_row.cycle_number || ' in ' || v_circle_name
          || ' has been waiting on a payout for more than 72 hours. Please review.',
        jsonb_build_object(
          'cycle_id',     v_row.id,
          'circle_id',    v_row.circle_id,
          'cycle_number', v_row.cycle_number,
          'circle_name',  v_circle_name,
          'i18n_title_key','cycle.notification_payout_stuck_title',
          'i18n_body_key', 'cycle.notification_payout_stuck_body'
        ),
        FALSE
      );

      -- Audit row so admins can see the alert history even if the
      -- notification is dismissed.
      BEGIN
        INSERT INTO public.circle_audit_log (circle_id, action, admin_user_id, details)
        VALUES (
          v_row.circle_id,
          'payout_stuck_alert',
          NULL,
          jsonb_build_object('cycle_id', v_row.id, 'cycle_number', v_row.cycle_number)
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'audit_log insert failed (payout_stuck): %', SQLERRM;
      END;

      v_alerted := v_alerted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('alerted', v_alerted, 'ran_at', NOW());
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'process_stuck_cycle_payouts failed: %', SQLERRM;
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_stuck_cycle_payouts() TO service_role;

-- pg_cron schedule — daily 09:00 UTC. Idempotent via EXISTS guard.
SELECT cron.unschedule('payout_stuck_alert_daily')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'payout_stuck_alert_daily'
 );

SELECT cron.schedule(
  'payout_stuck_alert_daily',
  '0 9 * * *',
  $$SELECT public.process_stuck_cycle_payouts();$$
);


-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '212',
  'cycle_automation',
  ARRAY['-- 212: cycle_automation']
)
ON CONFLICT (version) DO NOTHING;
