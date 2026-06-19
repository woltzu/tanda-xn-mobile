-- ════════════════════════════════════════════════════════════════════════════
-- Migration 208: substitute_pool_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Bucket C of the Substitute Pool review. Three pieces, all server-side:
--
--   1. notify_substitution_state_change — trigger on substitution_records
--      that fans out notifications as a record walks through its
--      9-state machine. Fires on:
--        * pending_confirmation  → 1 notif to the substitute.
--        * admin_pending          → 1 per elder/admin/creator of the circle.
--        * completed              → 1 to exiting member + 1 to substitute +
--                                   1 per elder/admin/creator (deduped).
--        * declined_substitute /
--          declined_admin /
--          expired                → 1 to the exiting member (the request
--                                   couldn't be fulfilled).
--      Idempotent via lookup on (user_id, type, data->>'record_id',
--      data->>'status').
--
--   2. reset_decline_count_90d() + nightly cron at 04:00 UTC. When a
--      substitute's last_decline_at is older than 90 days, reset
--      decline_count_90d to 0 and stamp last_decline_reset_at = NOW().
--      Spec said "subtract the number older than 90 days" but the schema
--      tracks only the most-recent decline (no per-decline ledger), so the
--      90d window naturally collapses to "if your most recent decline was
--      over 90 days ago, your counter is zero." Same logic as migration
--      100's process_substitute_lifecycle inline reset, hoisted into a
--      separately callable function so the cron can target it.
--
--   3. auto_unsuspend_substitutes() + nightly cron at 05:00 UTC. After
--      step 2 zeroes counters, this scan flips suspended substitutes
--      back to 'active' when their decline budget is fully refreshed,
--      and notifies them ("Your substitute suspension has been lifted").
--
-- Both triggers / functions use SECURITY DEFINER, search_path locked
-- to public+pg_temp, and EXCEPTION sub-blocks so a downstream failure
-- can't roll back the work that fired it. Mirrors migrations 205 / 207.
--
-- Schema: adds substitute_pool.last_decline_reset_at TIMESTAMPTZ.
-- Self-registers in supabase_migrations.schema_migrations.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Schema additions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.substitute_pool
  ADD COLUMN IF NOT EXISTS last_decline_reset_at TIMESTAMPTZ;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. notify_substitution_state_change — trigger function
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_substitution_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name      TEXT;
  v_substitute_name  TEXT;
  v_existing_id      UUID;
  v_recipient        RECORD;
BEGIN
  -- Only act on a real transition. INSERT always passes (initial state
  -- of pending_confirmation needs to notify on first sight).
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Resolve display values. Defensive fallbacks so a missing join can't
  -- swallow the notification.
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');

  SELECT full_name INTO v_substitute_name
  FROM public.profiles WHERE id = NEW.substitute_member_id;
  v_substitute_name := COALESCE(v_substitute_name, 'A substitute');

  -- ─── pending_confirmation → notify the substitute ──────────────────────
  IF NEW.status = 'pending_confirmation' THEN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.substitute_member_id
       AND type = 'substitution_offer'
       AND data->>'record_id' = NEW.id::text
       AND data->>'status' = 'pending_confirmation'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.substitute_member_id,
        'substitution_offer',
        'New substitution offer',
        'You''ve been matched to join ' || v_circle_name || ' as a substitute.',
        jsonb_build_object(
          'record_id',          NEW.id,
          'status',             NEW.status,
          'circle_id',          NEW.circle_id,
          'circle_name',        v_circle_name,
          'i18n_title_key',     'substitute.notification_offer_title',
          'i18n_body_key',      'substitute.notification_offer_body',
          'confirmation_deadline', NEW.confirmation_deadline
        ),
        FALSE
      );
    END IF;

  -- ─── admin_pending → notify each elder/admin/creator of the circle ─────
  ELSIF NEW.status = 'admin_pending' THEN
    FOR v_recipient IN
      SELECT user_id
        FROM public.circle_members
       WHERE circle_id = NEW.circle_id
         AND role IN ('elder', 'admin', 'creator')
         AND status = 'active'
    LOOP
      -- Don't tell the substitute themselves; they already got the offer.
      IF v_recipient.user_id = NEW.substitute_member_id THEN
        CONTINUE;
      END IF;
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'substitution_admin_pending'
         AND data->>'record_id' = NEW.id::text
         AND data->>'status' = 'admin_pending'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'substitution_admin_pending',
          'Substitute awaiting approval',
          'A substitute is waiting for your approval to join ' || v_circle_name || '.',
          jsonb_build_object(
            'record_id',      NEW.id,
            'status',         NEW.status,
            'circle_id',      NEW.circle_id,
            'circle_name',    v_circle_name,
            'i18n_title_key', 'substitute.notification_admin_pending_title',
            'i18n_body_key',  'substitute.notification_admin_pending_body',
            'admin_notified_at', NEW.admin_notified_at
          ),
          FALSE
        );
      END IF;
    END LOOP;

  -- ─── completed → notify exiting member + substitute + elders (deduped) ─
  ELSIF NEW.status = 'completed' THEN
    -- Exiting member
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.exiting_member_id
       AND type = 'substitution_completed'
       AND data->>'record_id' = NEW.id::text
       AND data->>'status' = 'completed'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.exiting_member_id,
        'substitution_completed',
        'Substitution complete',
        v_substitute_name || ' has joined ' || v_circle_name || '.',
        jsonb_build_object(
          'record_id',       NEW.id,
          'status',          NEW.status,
          'circle_id',       NEW.circle_id,
          'circle_name',     v_circle_name,
          'substitute_name', v_substitute_name,
          'recipient_role',  'exiting_member',
          'i18n_title_key',  'substitute.notification_completed_title',
          'i18n_body_key',   'substitute.notification_completed_body'
        ),
        FALSE
      );
    END IF;

    -- Substitute themselves
    IF NEW.substitute_member_id IS DISTINCT FROM NEW.exiting_member_id THEN
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = NEW.substitute_member_id
         AND type = 'substitution_completed'
         AND data->>'record_id' = NEW.id::text
         AND data->>'status' = 'completed'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          NEW.substitute_member_id,
          'substitution_completed',
          'Substitution complete',
          v_substitute_name || ' has joined ' || v_circle_name || '.',
          jsonb_build_object(
            'record_id',       NEW.id,
            'status',          NEW.status,
            'circle_id',       NEW.circle_id,
            'circle_name',     v_circle_name,
            'substitute_name', v_substitute_name,
            'recipient_role',  'substitute',
            'i18n_title_key',  'substitute.notification_completed_title',
            'i18n_body_key',   'substitute.notification_completed_body'
          ),
          FALSE
        );
      END IF;
    END IF;

    -- Each elder / admin / creator (skip exiting member and substitute,
    -- who already got copies above).
    FOR v_recipient IN
      SELECT user_id
        FROM public.circle_members
       WHERE circle_id = NEW.circle_id
         AND role IN ('elder', 'admin', 'creator')
         AND status = 'active'
    LOOP
      IF v_recipient.user_id IN (NEW.substitute_member_id, NEW.exiting_member_id) THEN
        CONTINUE;
      END IF;
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'substitution_completed'
         AND data->>'record_id' = NEW.id::text
         AND data->>'status' = 'completed'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'substitution_completed',
          'Substitution complete',
          v_substitute_name || ' has joined ' || v_circle_name || '.',
          jsonb_build_object(
            'record_id',       NEW.id,
            'status',          NEW.status,
            'circle_id',       NEW.circle_id,
            'circle_name',     v_circle_name,
            'substitute_name', v_substitute_name,
            'recipient_role',  'elder',
            'i18n_title_key',  'substitute.notification_completed_title',
            'i18n_body_key',   'substitute.notification_completed_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;

  -- ─── declined_substitute / declined_admin / expired → exiting member ──
  ELSIF NEW.status IN ('declined_substitute', 'declined_admin', 'expired') THEN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.exiting_member_id
       AND type = 'substitution_declined'
       AND data->>'record_id' = NEW.id::text
       AND data->>'status' = NEW.status
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.exiting_member_id,
        'substitution_declined',
        'No substitute found',
        'Your exit request for ' || v_circle_name ||
          ' could not be fulfilled. Please contact an elder.',
        jsonb_build_object(
          'record_id',      NEW.id,
          'status',         NEW.status,
          'circle_id',      NEW.circle_id,
          'circle_name',    v_circle_name,
          'i18n_title_key', 'substitute.notification_declined_title',
          'i18n_body_key',  'substitute.notification_declined_body'
        ),
        FALSE
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_substitution_state_change failed for record %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS substitution_records_state_notify ON public.substitution_records;
CREATE TRIGGER substitution_records_state_notify
  AFTER INSERT OR UPDATE OF status ON public.substitution_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_substitution_state_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. reset_decline_count_90d() — nightly counter reset
-- ─────────────────────────────────────────────────────────────────────────────
-- Returns the number of rows reset, for cron-job logging. SECURITY DEFINER
-- because pg_cron jobs run under the postgres user; this gives a single
-- chokepoint for permission audits.

CREATE OR REPLACE FUNCTION public.reset_decline_count_90d()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reset INTEGER;
BEGIN
  WITH reset AS (
    UPDATE public.substitute_pool
       SET decline_count_90d = 0,
           last_decline_reset_at = NOW()
     WHERE decline_count_90d > 0
       AND last_decline_at IS NOT NULL
       AND last_decline_at < NOW() - INTERVAL '90 days'
     RETURNING id
  )
  SELECT COUNT(*) INTO v_reset FROM reset;

  RETURN jsonb_build_object(
    'rows_reset', v_reset,
    'ran_at',     NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'reset_decline_count_90d failed: %', SQLERRM;
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_decline_count_90d() TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. auto_unsuspend_substitutes() — nightly auto-unsuspend
-- ─────────────────────────────────────────────────────────────────────────────
-- Flips substitute_pool.status from 'suspended' back to 'active' when the
-- decline budget is fresh (count_90d = 0 AND last_decline_at > 90 days
-- ago — typically reset_decline_count_90d ran 1 hour earlier). Notifies
-- each unsuspended substitute.

CREATE OR REPLACE FUNCTION public.auto_unsuspend_substitutes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_unsuspended INTEGER := 0;
  v_row RECORD;
  v_existing_id UUID;
BEGIN
  FOR v_row IN
    SELECT id, member_id
      FROM public.substitute_pool
     WHERE status = 'suspended'
       AND decline_count_90d = 0
       AND (last_decline_at IS NULL OR last_decline_at < NOW() - INTERVAL '90 days')
  LOOP
    UPDATE public.substitute_pool
       SET status = 'active',
           suspended_at = NULL
     WHERE id = v_row.id;

    -- Notification, deduped by member_id + ran_on date so a re-run on the
    -- same day can't double-notify.
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = v_row.member_id
       AND type = 'substitution_unsuspended'
       AND data->>'unsuspended_on' = (NOW()::date)::text
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_row.member_id,
        'substitution_unsuspended',
        'Substitute suspension lifted',
        'Your substitute suspension has been lifted. You''ll start receiving offers again.',
        jsonb_build_object(
          'unsuspended_on', NOW()::date,
          'i18n_title_key', 'substitute.notification_unsuspended_title',
          'i18n_body_key',  'substitute.notification_unsuspended_body'
        ),
        FALSE
      );
    END IF;

    v_unsuspended := v_unsuspended + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'unsuspended', v_unsuspended,
    'ran_at',      NOW()
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'auto_unsuspend_substitutes failed: %', SQLERRM;
  RETURN jsonb_build_object('error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_unsuspend_substitutes() TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. pg_cron schedules. Idempotent via cron.unschedule guarded by EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT cron.unschedule('substitute_reset_decline_count_90d')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'substitute_reset_decline_count_90d'
 );

SELECT cron.schedule(
  'substitute_reset_decline_count_90d',
  '0 4 * * *',
  $$SELECT public.reset_decline_count_90d();$$
);

SELECT cron.unschedule('substitute_auto_unsuspend')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'substitute_auto_unsuspend'
 );

SELECT cron.schedule(
  'substitute_auto_unsuspend',
  '0 5 * * *',
  $$SELECT public.auto_unsuspend_substitutes();$$
);


-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '208',
  'substitute_pool_automation',
  ARRAY['-- 208: substitute_pool_automation']
)
ON CONFLICT (version) DO NOTHING;
