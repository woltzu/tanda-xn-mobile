-- ═══════════════════════════════════════════════════════════════════════════
-- 347_community_notifications.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Community-notification wiring — closes the gap the audit surfaced:
-- notifications for the join-request / approval / rejection loop and
-- the new-arrival fan-out. Existing gathering + community-post
-- triggers (migs 231 + 221) already cover their side.
--
-- Three producer triggers, one preference column pair, no new tables.
-- The existing notifications table (mig 026 + 043 + 182 + 288) is
-- the sink. Preference gating is a straight join on the new
-- notification_preferences.push_community column — DEFAULT TRUE so
-- users who never touched prefs still get the mails, but a flip to
-- FALSE stops the fan-out at the trigger level (cheaper than
-- inserting and having the dispatcher swallow the row later).
--
-- Notes on style — every existing producer trigger in this repo
-- INSERTs directly into public.notifications and wraps the fan-out
-- in a defensive BEGIN…EXCEPTION WHEN OTHERS THEN RAISE WARNING so
-- a notification failure never rolls back the parent transaction.
-- No generic create_notification() helper exists (see mig 231's
-- notify_gathering_created for the canonical example). Mirroring
-- that shape here — a new helper would be nice cleanup but is out
-- of scope for this migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. notification_preferences: add community columns ───────────────

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_community  BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email_community BOOLEAN NOT NULL DEFAULT TRUE;

-- ─── 2. Helper: prefs gate ────────────────────────────────────────────
-- Small SQL function so each trigger reads the same rule.
-- Rows may not exist yet for a given user (NotificationContext lazy-
-- creates them on first open); default-TRUE via COALESCE covers that
-- window. STABLE + no side effects → the planner can inline it.

CREATE OR REPLACE FUNCTION public.wants_community_push(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(
    (SELECT push_community
       FROM public.notification_preferences
      WHERE user_id = p_user_id),
    TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.wants_community_push(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wants_community_push(UUID)
  TO authenticated, service_role;

-- ─── 3. Trigger: community_join_requests INSERT → notify elders ───────

CREATE OR REPLACE FUNCTION public.notify_community_join_request_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_community_name TEXT;
  v_requester_name TEXT;
  v_recipient      RECORD;
  v_existing       UUID;
BEGIN
  SELECT name INTO v_community_name
    FROM public.communities
   WHERE id = NEW.community_id;

  SELECT full_name INTO v_requester_name
    FROM public.profiles
   WHERE id = NEW.user_id;
  v_requester_name := COALESCE(NULLIF(TRIM(v_requester_name), ''), 'Someone');
  v_community_name := COALESCE(v_community_name, 'a community');

  BEGIN
    FOR v_recipient IN
      SELECT cm.user_id
        FROM public.community_memberships cm
       WHERE cm.community_id = NEW.community_id
         AND cm.role IN ('elder', 'owner')
         AND cm.status = 'active'
         AND public.wants_community_push(cm.user_id)
    LOOP
      -- Idempotency: one notification per (recipient, request).
      SELECT id INTO v_existing
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'community_join_request'
         AND data->>'request_id' = NEW.id::text
       LIMIT 1;
      IF v_existing IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'community_join_request',
          'New join request',
          v_requester_name || ' wants to join ' || v_community_name || '.',
          jsonb_build_object(
            'community_id', NEW.community_id,
            'request_id',   NEW.id,
            'user_id',      NEW.user_id,
            'community_name', v_community_name,
            'requester_name', v_requester_name
          ),
          FALSE
        );
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_community_join_request_created] failed for request %: %',
      NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_community_join_request_notify
  ON public.community_join_requests;
CREATE TRIGGER tr_community_join_request_notify
AFTER INSERT ON public.community_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_community_join_request_created();

-- ─── 4. Trigger: community_join_requests UPDATE → notify requester ────
-- Only fires when status transitions to 'approved' or 'rejected' —
-- other UPDATEs (reviewer_note edits, etc.) don't wake the requester.

CREATE OR REPLACE FUNCTION public.notify_community_join_request_reviewed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_community_name TEXT;
  v_type           TEXT;
  v_title          TEXT;
  v_body           TEXT;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('approved', 'rejected') THEN
    RETURN NEW;
  END IF;
  IF NOT public.wants_community_push(NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_community_name
    FROM public.communities
   WHERE id = NEW.community_id;
  v_community_name := COALESCE(v_community_name, 'a community');

  IF NEW.status = 'approved' THEN
    v_type  := 'community_join_approved';
    v_title := 'Request approved';
    v_body  := 'You''ve been approved to join ' || v_community_name || '.';
  ELSE
    v_type  := 'community_join_rejected';
    v_title := 'Request declined';
    v_body  := 'Your request to join ' || v_community_name || ' was declined.';
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      NEW.user_id,
      v_type,
      v_title,
      v_body,
      jsonb_build_object(
        'community_id',   NEW.community_id,
        'community_name', v_community_name,
        'request_id',     NEW.id,
        'reviewer_id',    NEW.reviewed_by
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_community_join_request_reviewed] failed for request %: %',
      NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_community_join_request_reviewed_notify
  ON public.community_join_requests;
CREATE TRIGGER tr_community_join_request_reviewed_notify
AFTER UPDATE ON public.community_join_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_community_join_request_reviewed();

-- ─── 5. Trigger: community_memberships INSERT → notify existing members
-- Complements mig 342's tr_auto_arrival_from_membership (which only
-- writes community_arrivals cards). Skips the new member themselves,
-- gates on prefs, idempotency-keyed on (recipient, membership row).

CREATE OR REPLACE FUNCTION public.notify_community_new_arrival()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_community_name TEXT;
  v_arrival_name   TEXT;
  v_recipient      RECORD;
  v_existing       UUID;
BEGIN
  -- Only fan out for active memberships (status may land as
  -- 'pending' first for some flows; we notify on activation only).
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_community_name
    FROM public.communities
   WHERE id = NEW.community_id;
  v_community_name := COALESCE(v_community_name, 'the community');

  SELECT full_name INTO v_arrival_name
    FROM public.profiles
   WHERE id = NEW.user_id;
  v_arrival_name := COALESCE(NULLIF(TRIM(v_arrival_name), ''), 'A new member');

  BEGIN
    FOR v_recipient IN
      SELECT cm.user_id
        FROM public.community_memberships cm
       WHERE cm.community_id = NEW.community_id
         AND cm.status = 'active'
         AND cm.user_id <> NEW.user_id
         AND public.wants_community_push(cm.user_id)
    LOOP
      SELECT id INTO v_existing
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'community_new_arrival'
         AND data->>'membership_id' = NEW.id::text
       LIMIT 1;
      IF v_existing IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'community_new_arrival',
          'New member',
          v_arrival_name || ' has joined ' || v_community_name || '.',
          jsonb_build_object(
            'community_id',   NEW.community_id,
            'community_name', v_community_name,
            'membership_id',  NEW.id,
            'user_id',        NEW.user_id,
            'arrival_name',   v_arrival_name
          ),
          FALSE
        );
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_community_new_arrival] failed for membership %: %',
      NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_community_new_arrival_notify
  ON public.community_memberships;
CREATE TRIGGER tr_community_new_arrival_notify
AFTER INSERT ON public.community_memberships
FOR EACH ROW
EXECUTE FUNCTION public.notify_community_new_arrival();

-- ─── Self-register in migration registry ──────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '347',
  'community_notifications',
  ARRAY['-- 347: community notification triggers + push_community/email_community prefs']
)
ON CONFLICT (version) DO NOTHING;
