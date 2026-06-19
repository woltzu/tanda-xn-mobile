-- ════════════════════════════════════════════════════════════════════════════
-- Migration 210: conflict_alert_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Bucket C of the Conflict Alerts review. Two triggers, both AFTER UPDATE,
-- both SECURITY DEFINER + pinned search_path + EXCEPTION sub-block so a
-- notification fan-out failure can't roll back the row that triggered it.
--
--   1. notify_monitor_escalation — on post_formation_monitor when
--      escalated flips FALSE → TRUE. Notifies every elder / admin /
--      creator of the circle (circle_members.role IN (...)) so they can
--      review the escalated pair in the Live signals tab.
--      Idempotent via (user_id, type='monitor_escalated',
--                      data->>'monitor_id').
--
--   2. notify_dispute_tier_change — on dispute_cases when escalation_tier
--      transitions. Two distinct fan-outs, gated by the destination tier:
--        * NULL → 'elder_l2'        → elders/admins/creators of the circle
--          (same audience as monitor_escalated)
--        * 'elder_l2' → 'global_queue' → platform admins
--          (admin_users.is_active = true; same set used by public.is_admin()).
--      Idempotent via (user_id, type, data->>'dispute_id', data->>'tier').
--
-- The i18n_title_key / i18n_body_key payload keys ride alongside the
-- English strings so the mobile client can show a localized notification
-- without round-tripping the DB on locale switch.
--
-- Self-registers via the standard schema_migrations INSERT at the end.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notify_monitor_escalation — trigger function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_monitor_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
  v_existing_id UUID;
  v_recipient   RECORD;
BEGIN
  -- Only act on a real false → true flip. INSERTs with escalated=true
  -- aren't expected (monitors are created with escalated=false and only
  -- flipped later), but we still guard against the NULL case so a stray
  -- INSERT can't fan out spam.
  IF TG_OP = 'UPDATE' THEN
    IF OLD.escalated IS NOT DISTINCT FROM NEW.escalated THEN
      RETURN NEW;
    END IF;
    IF COALESCE(OLD.escalated, FALSE) = TRUE OR COALESCE(NEW.escalated, FALSE) = FALSE THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Resolve circle name; defensive fallback so a join miss can't hide
  -- the notification.
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');

  FOR v_recipient IN
    SELECT user_id
      FROM public.circle_members
     WHERE circle_id = NEW.circle_id
       AND role IN ('elder', 'admin', 'creator')
       AND status = 'active'
  LOOP
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = v_recipient.user_id
       AND type = 'monitor_escalated'
       AND data->>'monitor_id' = NEW.id::text
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_recipient.user_id,
        'monitor_escalated',
        'Conflict monitor escalated',
        'A conflict monitor in ' || v_circle_name
          || ' has escalated. Please review.',
        jsonb_build_object(
          'monitor_id',    NEW.id,
          'circle_id',     NEW.circle_id,
          'circle_name',   v_circle_name,
          'i18n_title_key','conflict.notification_monitor_escalated_title',
          'i18n_body_key', 'conflict.notification_monitor_escalated_body'
        ),
        FALSE
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_monitor_escalation failed for monitor %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_formation_monitor_escalation_notify ON public.post_formation_monitor;
CREATE TRIGGER post_formation_monitor_escalation_notify
  AFTER UPDATE OF escalated ON public.post_formation_monitor
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_monitor_escalation();

COMMENT ON FUNCTION public.notify_monitor_escalation IS
  'AFTER UPDATE OF escalated on post_formation_monitor. Fans out a '
  'monitor_escalated notification to every elder/admin/creator of the circle '
  'when the flag flips false → true. Idempotent per (user_id, monitor_id).';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. notify_dispute_tier_change — trigger function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_dispute_tier_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
  v_existing_id UUID;
  v_recipient   RECORD;
  v_old_tier    TEXT;
  v_new_tier    TEXT;
BEGIN
  v_old_tier := OLD.escalation_tier;
  v_new_tier := NEW.escalation_tier;

  -- Only act on a real transition; equal values short-circuit.
  IF v_old_tier IS NOT DISTINCT FROM v_new_tier THEN
    RETURN NEW;
  END IF;

  -- Resolve circle name once.
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');

  -- ─── NULL → 'elder_l2' → elders / admins / creators ────────────────────────
  IF v_old_tier IS NULL AND v_new_tier = 'elder_l2' THEN
    FOR v_recipient IN
      SELECT user_id
        FROM public.circle_members
       WHERE circle_id = NEW.circle_id
         AND role IN ('elder', 'admin', 'creator')
         AND status = 'active'
    LOOP
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'dispute_escalated_elder'
         AND data->>'dispute_id' = NEW.id::text
         AND data->>'tier' = 'elder_l2'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'dispute_escalated_elder',
          'Dispute escalated to elders',
          'A dispute in ' || v_circle_name
            || ' has been escalated to elders.',
          jsonb_build_object(
            'dispute_id',    NEW.id,
            'tier',          'elder_l2',
            'circle_id',     NEW.circle_id,
            'circle_name',   v_circle_name,
            'i18n_title_key','conflict.notification_dispute_escalated_elder_title',
            'i18n_body_key', 'conflict.notification_dispute_escalated_elder_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;

  -- ─── 'elder_l2' → 'global_queue' → platform admins ─────────────────────────
  ELSIF v_old_tier = 'elder_l2' AND v_new_tier = 'global_queue' THEN
    FOR v_recipient IN
      SELECT user_id
        FROM public.admin_users
       WHERE is_active = TRUE
    LOOP
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'dispute_escalated_global'
         AND data->>'dispute_id' = NEW.id::text
         AND data->>'tier' = 'global_queue'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'dispute_escalated_global',
          'Dispute escalated to global queue',
          'A dispute in ' || v_circle_name
            || ' has been escalated to the global queue.',
          jsonb_build_object(
            'dispute_id',    NEW.id,
            'tier',          'global_queue',
            'circle_id',     NEW.circle_id,
            'circle_name',   v_circle_name,
            'i18n_title_key','conflict.notification_dispute_escalated_global_title',
            'i18n_body_key', 'conflict.notification_dispute_escalated_global_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_dispute_tier_change failed for dispute %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dispute_cases_tier_change_notify ON public.dispute_cases;
CREATE TRIGGER dispute_cases_tier_change_notify
  AFTER UPDATE OF escalation_tier ON public.dispute_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_dispute_tier_change();

COMMENT ON FUNCTION public.notify_dispute_tier_change IS
  'AFTER UPDATE OF escalation_tier on dispute_cases. On NULL → elder_l2 fans '
  'out to elders/admins/creators of the circle; on elder_l2 → global_queue '
  'fans out to platform admins (admin_users.is_active = true). Idempotent '
  'per (user_id, dispute_id, tier).';


-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '210',
  'conflict_alert_automation',
  ARRAY['-- 210: conflict_alert_automation']
)
ON CONFLICT (version) DO NOTHING;
