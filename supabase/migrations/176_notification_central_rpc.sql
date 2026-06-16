-- 176_notification_central_rpc.sql
-- =====================================================================
-- P2 of the Notification preferences review.
--
-- This migration shifts the codebase from "every EF inserts into
-- notifications directly" to "every EF gates inserts via a central
-- predicate". Pieces:
--
--   1. notification_dismissal_log(user_id, category, dismissed_at)
--      Time-windowed counter. process-dismissal-auto-mute reads
--      14-day windows from here. Pruned monthly by
--      cleanup_old_notifications (existing fn) — TBD if a new fn is
--      needed; for now we keep an explicit index on dismissed_at so
--      a future TTL job is cheap.
--
--   2. circle_notification_overrides(user_id, circle_id, muted_until)
--      Per-(user, circle) mute. muted_until is nullable — NULL = mute
--      forever. UNIQUE(user_id, circle_id) so upserts replace the
--      duration without dupes.
--
--   3. should_send_notification(user_id, category, channel, circle?)
--      Predicate every sender calls. Returns FALSE when ANY guard
--      trips: master OFF, snooze active, quiet hours, category
--      toggle OFF, per-circle mute active. Security category is the
--      one exception — always returns TRUE.
--
--   4. record_notification_dismissal(user_id, category)
--      Authenticated callers' write path into notification_dismissal_log.
--      SECURITY DEFINER so RLS doesn't get in the way.
--
-- All RLS-safe. Service-role has ALL on both tables.
-- =====================================================================

-- ── 1. notification_dismissal_log ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notification_dismissal_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_dismissal_log_user_cat_time
  ON public.notification_dismissal_log (user_id, category, dismissed_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_dismissal_log_time
  ON public.notification_dismissal_log (dismissed_at);

ALTER TABLE public.notification_dismissal_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_dismissal_log_owner_select
  ON public.notification_dismissal_log;
CREATE POLICY notification_dismissal_log_owner_select
  ON public.notification_dismissal_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_dismissal_log_service_all
  ON public.notification_dismissal_log;
CREATE POLICY notification_dismissal_log_service_all
  ON public.notification_dismissal_log FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ── 2. circle_notification_overrides ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.circle_notification_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  circle_id     UUID NOT NULL REFERENCES public.circles(id)  ON DELETE CASCADE,
  -- NULL = "muted forever". Future date = "muted until that point".
  muted_until   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT circle_notification_overrides_user_circle_unique
    UNIQUE (user_id, circle_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_notification_overrides_user
  ON public.circle_notification_overrides (user_id);

ALTER TABLE public.circle_notification_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS circle_notif_overrides_owner_all
  ON public.circle_notification_overrides;
CREATE POLICY circle_notif_overrides_owner_all
  ON public.circle_notification_overrides FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS circle_notif_overrides_service_all
  ON public.circle_notification_overrides;
CREATE POLICY circle_notif_overrides_service_all
  ON public.circle_notification_overrides FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_circle_notif_overrides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_circle_notif_overrides_updated_at
  ON public.circle_notification_overrides;
CREATE TRIGGER trg_circle_notif_overrides_updated_at
BEFORE UPDATE ON public.circle_notification_overrides
FOR EACH ROW
EXECUTE FUNCTION public.touch_circle_notif_overrides_updated_at();

-- ── 3. should_send_notification ──────────────────────────────────────
-- Boolean gate. Inputs:
--   p_user_id     — recipient.
--   p_category    — 'payments' / 'payouts' / 'circles' / 'loans' /
--                   'reminders' / 'security' / 'marketing' / 'system'.
--                   Mapped onto push_<cat> / email_<cat> columns.
--   p_channel     — 'push' or 'email'.
--   p_circle_id   — optional. If set, also checks circle override.
--
-- Returns FALSE when ANY of these is true:
--   - master push/email is OFF
--   - push_snooze_until is in the future (push only)
--   - per-category toggle for the channel is OFF
--   - per-(user, circle) mute is active
--   - quiet_hours_enabled is true AND now falls inside the window
--     (computed in the user's stored quiet_hours_timezone).
--
-- Security category short-circuits to TRUE regardless of any toggle —
-- "Security alerts are always sent". The notification_preferences UI
-- has a locked security row so the toggle in DB stays at its default,
-- but this fn is the actual enforcement point.
CREATE OR REPLACE FUNCTION public.should_send_notification(
  p_user_id   UUID,
  p_category  TEXT,
  p_channel   TEXT,
  p_circle_id UUID DEFAULT NULL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prefs       public.notification_preferences%ROWTYPE;
  v_local_time  TIME;
  v_start       TIME;
  v_end         TIME;
  v_col_name    TEXT;
  v_toggle_val  BOOLEAN;
BEGIN
  IF p_user_id IS NULL OR p_category IS NULL OR p_channel IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Security ALWAYS sends. Drives both push + email regardless of
  -- column values. Bypasses snooze and quiet hours too — the column
  -- has to land while the user is alerted.
  IF p_category = 'security' THEN
    RETURN TRUE;
  END IF;

  SELECT * INTO v_prefs
  FROM public.notification_preferences
  WHERE user_id = p_user_id;

  -- No prefs row yet (rare race on signup) — fall back to defaults
  -- and approve. The notification_preferences seed effect creates
  -- the row on next fetch.
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;

  -- Master toggle for the channel.
  IF p_channel = 'push' THEN
    IF v_prefs.push_enabled IS NOT TRUE THEN
      RETURN FALSE;
    END IF;
    -- Snooze (push only).
    IF v_prefs.push_snooze_until IS NOT NULL
       AND v_prefs.push_snooze_until > now() THEN
      RETURN FALSE;
    END IF;
  ELSIF p_channel = 'email' THEN
    IF v_prefs.email_enabled IS NOT TRUE THEN
      RETURN FALSE;
    END IF;
  ELSE
    -- Unknown channel — refuse to guess.
    RETURN FALSE;
  END IF;

  -- Per-category toggle. Construct the column name dynamically
  -- ('push_payments', 'email_marketing', etc.).
  v_col_name := p_channel || '_' || p_category;
  EXECUTE format(
    'SELECT ($1).%I',
    v_col_name
  ) INTO v_toggle_val USING v_prefs;
  IF v_toggle_val IS NOT TRUE THEN
    RETURN FALSE;
  END IF;

  -- Per-(user, circle) mute. Only checks when p_circle_id is given.
  IF p_circle_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.circle_notification_overrides cno
      WHERE cno.user_id = p_user_id
        AND cno.circle_id = p_circle_id
        AND (cno.muted_until IS NULL OR cno.muted_until > now())
    ) THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- Quiet hours. Wrap-around supported (22:00 → 08:00 means "muted
  -- between 22:00 and 08:00 across midnight"). Computed in the user's
  -- stored zone so the comparison is local.
  IF v_prefs.quiet_hours_enabled IS TRUE
     AND v_prefs.quiet_hours_start IS NOT NULL
     AND v_prefs.quiet_hours_end IS NOT NULL THEN
    v_local_time := (now() AT TIME ZONE COALESCE(v_prefs.quiet_hours_timezone, 'UTC'))::time;
    v_start := v_prefs.quiet_hours_start;
    v_end   := v_prefs.quiet_hours_end;
    IF v_start < v_end THEN
      IF v_local_time >= v_start AND v_local_time < v_end THEN
        RETURN FALSE;
      END IF;
    ELSE
      -- Wrap-around: silent if AFTER start OR BEFORE end.
      IF v_local_time >= v_start OR v_local_time < v_end THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.should_send_notification(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.should_send_notification(UUID, TEXT, TEXT, UUID) TO authenticated, service_role;

-- ── 4. record_notification_dismissal ─────────────────────────────────
-- Authenticated writers' helper. Bypasses RLS so the inbox can log
-- across categories without a per-row policy expansion.
CREATE OR REPLACE FUNCTION public.record_notification_dismissal(
  p_user_id  UUID,
  p_category TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL OR p_category IS NULL OR p_category = '' THEN
    RETURN;
  END IF;
  INSERT INTO public.notification_dismissal_log (user_id, category)
  VALUES (p_user_id, p_category);
END;
$$;

REVOKE ALL ON FUNCTION public.record_notification_dismissal(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_notification_dismissal(UUID, TEXT) TO authenticated, service_role;

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '176',
  'notification_central_rpc',
  ARRAY['-- 176: notification_central_rpc']
)
ON CONFLICT (version) DO NOTHING;
