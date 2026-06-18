-- ════════════════════════════════════════════════════════════════════════════
-- Migration 190: swap_notification_trigger
-- ════════════════════════════════════════════════════════════════════════════
-- `notify_swap_status_change` trigger on `position_swap_requests`. Mirrors
-- migration 188's pattern (SECURITY DEFINER, search_path locked, EXCEPTION
-- sub-block so a trigger failure can't roll back the swap-state UPDATE that
-- fired it). Inserts one notifications row per recipient per state.
--
-- Recipient map (per Bucket A spec):
--   pending_target           → NEW.target_user_id
--   pending_confirmation     → NEW.requester_user_id
--   pending_elder_approval   → each elder/admin/creator member of the circle
--   completed                → BOTH NEW.requester_user_id and NEW.target_user_id
--   rejected                 → NEW.requester_user_id
--   expired                  → NEW.requester_user_id
--
-- Idempotency: deduped per (recipient, swap_id, status). Re-applying the
-- same state transition (e.g., manual re-execution of a swap RPC) cannot
-- double-fire. The lookup is by (user_id, type, data->>'swap_id',
-- data->>'status').
--
-- Body strings ship in English at the trigger layer — the client renders
-- i18n strings keyed by `data->>'i18n_key'` (or falls back to the body)
-- so a single notification row works for both EN and FR users. Names are
-- still substituted server-side so the trigger doesn't need locale
-- awareness for the dynamic parts.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_swap_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
  v_requester_name TEXT;
  v_target_name TEXT;
  v_existing_id UUID;
  v_elder RECORD;
BEGIN
  -- Skip if swap_status didn't change (UPDATE OF status fires for any
  -- UPDATE that touches the column even if the value is the same — and
  -- belt-and-braces for re-INSERT scenarios we don't expect to see).
  IF TG_OP = 'UPDATE' AND OLD.swap_status = NEW.swap_status THEN
    RETURN NEW;
  END IF;

  -- Only the six terminal/actionable states notify. The transient states
  -- (approved, executing) intentionally don't fire a notification — the
  -- 'completed' transition that follows them does.
  IF NEW.swap_status NOT IN (
    'pending_target', 'pending_confirmation', 'pending_elder_approval',
    'completed', 'rejected', 'expired'
  ) THEN
    RETURN NEW;
  END IF;

  -- Resolve display values. Falls back to "your circle" / "A member" if
  -- the joined row is gone — defensive, both joins should always succeed.
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  SELECT full_name INTO v_requester_name FROM public.profiles WHERE id = NEW.requester_user_id;
  SELECT full_name INTO v_target_name   FROM public.profiles WHERE id = NEW.target_user_id;

  v_circle_name    := COALESCE(v_circle_name, 'your circle');
  v_requester_name := COALESCE(v_requester_name, 'A member');
  v_target_name    := COALESCE(v_target_name,    'a member');

  -- ─── pending_target → notify target ────────────────────────────────────
  IF NEW.swap_status = 'pending_target' THEN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.target_user_id
       AND type = 'swap_status'
       AND data->>'swap_id' = NEW.id::text
       AND data->>'status' = 'pending_target'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.target_user_id,
        'swap_status',
        'New swap request',
        v_requester_name || ' wants to swap positions with you in ' || v_circle_name || '.',
        jsonb_build_object(
          'swap_id', NEW.id,
          'status', 'pending_target',
          'circle_id', NEW.circle_id,
          'i18n_key', 'swap.notification_pending_target'
        ),
        FALSE
      );
    END IF;
    RETURN NEW;
  END IF;

  -- ─── pending_confirmation → notify requester ───────────────────────────
  IF NEW.swap_status = 'pending_confirmation' THEN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.requester_user_id
       AND type = 'swap_status'
       AND data->>'swap_id' = NEW.id::text
       AND data->>'status' = 'pending_confirmation'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.requester_user_id,
        'swap_status',
        'Swap ready to confirm',
        'Your swap with ' || v_target_name || ' is ready to confirm.',
        jsonb_build_object(
          'swap_id', NEW.id,
          'status', 'pending_confirmation',
          'circle_id', NEW.circle_id,
          'cooling_off_ends_at', NEW.cooling_off_ends_at,
          'i18n_key', 'swap.notification_pending_confirmation'
        ),
        FALSE
      );
    END IF;
    RETURN NEW;
  END IF;

  -- ─── pending_elder_approval → notify every elder/admin/creator ─────────
  IF NEW.swap_status = 'pending_elder_approval' THEN
    FOR v_elder IN
      SELECT user_id
        FROM public.circle_members
       WHERE circle_id = NEW.circle_id
         AND role IN ('elder', 'admin', 'creator')
    LOOP
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_elder.user_id
         AND type = 'swap_status'
         AND data->>'swap_id' = NEW.id::text
         AND data->>'status' = 'pending_elder_approval'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_elder.user_id,
          'swap_status',
          'Swap awaiting Elder approval',
          v_requester_name || ' ↔ ' || v_target_name || ' swap in ' || v_circle_name || ' is awaiting your approval.',
          jsonb_build_object(
            'swap_id', NEW.id,
            'status', 'pending_elder_approval',
            'circle_id', NEW.circle_id,
            'i18n_key', 'swap.notification_pending_elder_approval'
          ),
          FALSE
        );
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  -- ─── completed → notify both parties ───────────────────────────────────
  IF NEW.swap_status = 'completed' THEN
    -- Requester
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.requester_user_id
       AND type = 'swap_status'
       AND data->>'swap_id' = NEW.id::text
       AND data->>'status' = 'completed'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.requester_user_id,
        'swap_status',
        'Swap completed',
        'Your position swap in ' || v_circle_name || ' is complete. You are now in Position ' || NEW.target_position || '.',
        jsonb_build_object(
          'swap_id', NEW.id,
          'status', 'completed',
          'circle_id', NEW.circle_id,
          'new_position', NEW.target_position,
          'i18n_key', 'swap.notification_completed'
        ),
        FALSE
      );
    END IF;

    -- Target
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.target_user_id
       AND type = 'swap_status'
       AND data->>'swap_id' = NEW.id::text
       AND data->>'status' = 'completed'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.target_user_id,
        'swap_status',
        'Swap completed',
        'Your position swap in ' || v_circle_name || ' is complete. You are now in Position ' || NEW.requester_position || '.',
        jsonb_build_object(
          'swap_id', NEW.id,
          'status', 'completed',
          'circle_id', NEW.circle_id,
          'new_position', NEW.requester_position,
          'i18n_key', 'swap.notification_completed'
        ),
        FALSE
      );
    END IF;
    RETURN NEW;
  END IF;

  -- ─── rejected → notify requester ───────────────────────────────────────
  IF NEW.swap_status = 'rejected' THEN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.requester_user_id
       AND type = 'swap_status'
       AND data->>'swap_id' = NEW.id::text
       AND data->>'status' = 'rejected'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.requester_user_id,
        'swap_status',
        'Swap request declined',
        v_target_name || ' declined your swap request in ' || v_circle_name || '.',
        jsonb_build_object(
          'swap_id', NEW.id,
          'status', 'rejected',
          'circle_id', NEW.circle_id,
          'i18n_key', 'swap.notification_rejected'
        ),
        FALSE
      );
    END IF;
    RETURN NEW;
  END IF;

  -- ─── expired → notify requester ────────────────────────────────────────
  IF NEW.swap_status = 'expired' THEN
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = NEW.requester_user_id
       AND type = 'swap_status'
       AND data->>'swap_id' = NEW.id::text
       AND data->>'status' = 'expired'
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        NEW.requester_user_id,
        'swap_status',
        'Swap request expired',
        'Your swap request in ' || v_circle_name || ' expired without a response.',
        jsonb_build_object(
          'swap_id', NEW.id,
          'status', 'expired',
          'circle_id', NEW.circle_id,
          'i18n_key', 'swap.notification_expired'
        ),
        FALSE
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A trigger failure must NOT roll back the swap_status transition that
  -- fired it. The state-machine RPC has already done its work; losing a
  -- notification is recoverable (the dashboard reflects the new state on
  -- next refresh) — losing the swap state would be much worse.
  RAISE NOTICE 'notify_swap_status_change failed for swap %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS position_swap_requests_notify ON public.position_swap_requests;
CREATE TRIGGER position_swap_requests_notify
  AFTER INSERT OR UPDATE OF swap_status ON public.position_swap_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_swap_status_change();

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '190',
  'swap_notification_trigger',
  ARRAY['-- 190: swap_notification_trigger']
)
ON CONFLICT (version) DO NOTHING;
