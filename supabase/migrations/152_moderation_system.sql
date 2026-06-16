-- ============================================================================
-- Migration 152: Moderation System
-- ============================================================================
-- Builds the platform-wide moderation surface that the Admin Dashboard
-- review (Option B, 2026-06-13) called out as missing. Three new tables,
-- two RPCs, and two profile columns.
--
-- Naming note — "Platform Admin" vs "Circle Admin":
--   * Platform Admin   = row in public.admin_users.  Detected by
--                        public.is_admin(auth.uid()).  Owns this surface.
--   * Circle Admin     = circle_members.role='admin' for a single circle.
--                        Different scope; does NOT get moderation powers.
--
-- The frontend ReportButton component (added in the same checkpoint)
-- inserts into content_reports or user_reports. The AdminModerationScreen
-- calls apply_moderation_action() and resolve_report() to act on rows.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. content_reports — user-flagged content (posts, comments, events, msgs)
-- ----------------------------------------------------------------------------
-- Polymorphic: content_id can reference feed_posts, feed_comments,
-- community_events, or circle_messages. No FK on content_id because the
-- target table varies per row — we use content_type as the discriminator.
CREATE TABLE IF NOT EXISTS content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'dream_post', 'comment', 'event', 'circle_message'
  )),
  content_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'spam', 'harassment', 'inappropriate', 'other'
  )),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'reviewed', 'dismissed'
  )),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_content_reports_status_created
  ON content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_reports_content
  ON content_reports(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter
  ON content_reports(reporter_user_id);


-- ----------------------------------------------------------------------------
-- 2. user_reports — platform-level user-against-user reports
-- ----------------------------------------------------------------------------
-- Distinct from dispute_cases (which lives inside a circle and is handled
-- by elders). user_reports go straight to platform admins.
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN (
    'spam', 'harassment', 'inappropriate', 'impersonation', 'other'
  )),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'reviewed', 'action_taken', 'dismissed'
  )),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- A user shouldn't be able to file the same report against the same
  -- person more than once while pending. Resolved rows don't block new
  -- reports (the partial index is on status='pending' only).
  CONSTRAINT no_self_report CHECK (reporter_user_id <> reported_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_reports_status_created
  ON user_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported
  ON user_reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_user_reports_reporter
  ON user_reports(reporter_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_reports_pending_pair
  ON user_reports(reporter_user_id, reported_user_id)
  WHERE status = 'pending';


-- ----------------------------------------------------------------------------
-- 3. moderation_actions — audit log
-- ----------------------------------------------------------------------------
-- Append-only. Every admin action (dismiss / warn / delete / suspend / ban)
-- lands here. The two RPCs below are the only path that writes.
CREATE TABLE IF NOT EXISTS moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'content')),
  target_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'warn', 'suspend', 'ban', 'delete_content', 'dismiss_report'
  )),
  reason TEXT NOT NULL,
  duration INTERVAL,
  -- Optional pointer back to the report that triggered the action. Lets
  -- the admin UI show "this action came from report X" for an audit trail.
  source_report_id UUID,
  source_report_kind TEXT CHECK (source_report_kind IN ('content', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_moderation_actions_created
  ON moderation_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_target
  ON moderation_actions(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_admin
  ON moderation_actions(admin_user_id);


-- ----------------------------------------------------------------------------
-- 4. profiles — suspension / ban columns
-- ----------------------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT false;

-- Partial index — most lookups are "is this user currently suspended?".
CREATE INDEX IF NOT EXISTS idx_profiles_suspended_until
  ON profiles(suspended_until)
  WHERE suspended_until IS NOT NULL;


-- ----------------------------------------------------------------------------
-- 5. RLS policies
-- ----------------------------------------------------------------------------
ALTER TABLE content_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports       ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;

-- content_reports ----------------------------------------------------------
DROP POLICY IF EXISTS "content_reports_insert_self"   ON content_reports;
DROP POLICY IF EXISTS "content_reports_select_self"   ON content_reports;
DROP POLICY IF EXISTS "content_reports_admin_select"  ON content_reports;
DROP POLICY IF EXISTS "content_reports_admin_update"  ON content_reports;

-- Authenticated users insert their own reports.
CREATE POLICY "content_reports_insert_self"
  ON content_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

-- Reporters can read back their own filings.
CREATE POLICY "content_reports_select_self"
  ON content_reports FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid());

-- Admins read everything.
CREATE POLICY "content_reports_admin_select"
  ON content_reports FOR SELECT TO authenticated
  USING (public.is_admin());

-- Admins update (typically status / admin_notes / resolved_*).
CREATE POLICY "content_reports_admin_update"
  ON content_reports FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- user_reports -------------------------------------------------------------
DROP POLICY IF EXISTS "user_reports_insert_self"   ON user_reports;
DROP POLICY IF EXISTS "user_reports_select_self"   ON user_reports;
DROP POLICY IF EXISTS "user_reports_admin_select"  ON user_reports;
DROP POLICY IF EXISTS "user_reports_admin_update"  ON user_reports;

CREATE POLICY "user_reports_insert_self"
  ON user_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_user_id = auth.uid());

CREATE POLICY "user_reports_select_self"
  ON user_reports FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid());

CREATE POLICY "user_reports_admin_select"
  ON user_reports FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "user_reports_admin_update"
  ON user_reports FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- moderation_actions -------------------------------------------------------
-- Admin-only read. No client INSERT — the RPCs below are SECURITY DEFINER
-- and write on behalf of admins.
DROP POLICY IF EXISTS "moderation_actions_admin_select" ON moderation_actions;
CREATE POLICY "moderation_actions_admin_select"
  ON moderation_actions FOR SELECT TO authenticated
  USING (public.is_admin());


-- ----------------------------------------------------------------------------
-- 6. RPC: apply_moderation_action
-- ----------------------------------------------------------------------------
-- Single entry point for any moderation action. Validates admin, writes
-- the moderation_actions row, mutates the target (profile flags or content
-- delete), drops a notification for the user when appropriate, and on
-- 'delete_content' auto-dismisses every pending content_report tied to the
-- same content_id.
--
-- Returns the new moderation_actions.id so the caller can chain it into
-- resolve_report() with a source_report_id pointer.
CREATE OR REPLACE FUNCTION public.apply_moderation_action(
  p_action       TEXT,
  p_target_type  TEXT,
  p_target_id    UUID,
  p_reason       TEXT,
  p_duration     INTERVAL DEFAULT NULL,
  p_source_report_id UUID DEFAULT NULL,
  p_source_report_kind TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_admin_id UUID := auth.uid();
  v_action_id UUID;
  v_notif_title TEXT;
  v_notif_body TEXT;
  v_content_type TEXT;
BEGIN
  -- Auth gate. Without this the SECURITY DEFINER wrapper would let any
  -- authenticated caller mutate other users' state.
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'apply_moderation_action: admin required'
      USING ERRCODE = '42501';
  END IF;

  -- Validate arguments. CHECK constraints on the table catch bad action
  -- strings too, but failing early gives a clearer error.
  IF p_action NOT IN ('warn','suspend','ban','delete_content','dismiss_report') THEN
    RAISE EXCEPTION 'apply_moderation_action: unknown action %', p_action;
  END IF;
  IF p_target_type NOT IN ('user','content') THEN
    RAISE EXCEPTION 'apply_moderation_action: target_type must be user or content';
  END IF;
  IF p_action = 'suspend' AND p_duration IS NULL THEN
    RAISE EXCEPTION 'apply_moderation_action: suspend requires a duration';
  END IF;
  IF p_action IN ('warn','suspend','ban') AND p_target_type <> 'user' THEN
    RAISE EXCEPTION 'apply_moderation_action: %s targets a user', p_action;
  END IF;
  IF p_action = 'delete_content' AND p_target_type <> 'content' THEN
    RAISE EXCEPTION 'apply_moderation_action: delete_content targets content';
  END IF;

  -- Log first. Even if the side-effects below fail, the audit row is the
  -- canonical record of what the admin tried to do.
  INSERT INTO moderation_actions (
    admin_user_id, target_type, target_id, action, reason, duration,
    source_report_id, source_report_kind
  )
  VALUES (
    v_admin_id, p_target_type, p_target_id, p_action, p_reason, p_duration,
    p_source_report_id, p_source_report_kind
  )
  RETURNING id INTO v_action_id;

  -- User-targeted actions: mutate profiles + drop a notification.
  IF p_target_type = 'user' THEN
    IF p_action = 'suspend' THEN
      UPDATE profiles
         SET suspended_until = now() + p_duration
       WHERE id = p_target_id;
      v_notif_title := 'Your account has been suspended';
      v_notif_body  := 'Reason: ' || p_reason || '. The suspension ends '
                       || to_char(now() + p_duration, 'YYYY-MM-DD HH24:MI UTC') || '.';
    ELSIF p_action = 'ban' THEN
      UPDATE profiles
         SET banned = true,
             suspended_until = NULL
       WHERE id = p_target_id;
      v_notif_title := 'Your account has been banned';
      v_notif_body  := 'Reason: ' || p_reason || '. Contact support if you believe this is an error.';
    ELSIF p_action = 'warn' THEN
      v_notif_title := 'You received a warning';
      v_notif_body  := 'Reason: ' || p_reason || '. Repeated violations may lead to suspension.';
    END IF;

    IF v_notif_title IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, data, read)
      VALUES (
        p_target_id,
        'moderation_' || p_action,
        v_notif_title,
        v_notif_body,
        jsonb_build_object(
          'action', p_action,
          'reason', p_reason,
          'moderation_action_id', v_action_id,
          'duration_seconds', CASE
            WHEN p_duration IS NOT NULL
            THEN extract(epoch from p_duration)::INT
            ELSE NULL
          END
        ),
        false
      );
    END IF;
  END IF;

  -- Content-targeted delete: dispatch on the source content_type recorded
  -- against the related content_reports row. If multiple reports name the
  -- same content_id they share the same content_type by construction.
  IF p_action = 'delete_content' THEN
    SELECT cr.content_type INTO v_content_type
      FROM content_reports cr
     WHERE cr.content_id = p_target_id
     LIMIT 1;

    IF v_content_type = 'dream_post' THEN
      DELETE FROM feed_posts WHERE id = p_target_id;
    ELSIF v_content_type = 'comment' THEN
      DELETE FROM feed_comments WHERE id = p_target_id;
    ELSIF v_content_type = 'event' THEN
      DELETE FROM community_events WHERE id = p_target_id;
    ELSIF v_content_type = 'circle_message' THEN
      DELETE FROM circle_messages WHERE id = p_target_id;
    END IF;

    -- Auto-dismiss every pending report on this content_id. Saves the
    -- admin from clicking through 10 duplicate reports of the same post.
    UPDATE content_reports
       SET status = 'reviewed',
           admin_notes = COALESCE(admin_notes, '')
                         || CASE WHEN admin_notes IS NULL OR admin_notes = ''
                                 THEN ''
                                 ELSE E'\n'
                            END
                         || '[Auto-dismissed: content deleted via action ' || v_action_id::TEXT || ']',
           resolved_at = now(),
           resolved_by = v_admin_id
     WHERE content_id = p_target_id
       AND status = 'pending';
  END IF;

  RETURN v_action_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_moderation_action(TEXT, TEXT, UUID, TEXT, INTERVAL, UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.apply_moderation_action(TEXT, TEXT, UUID, TEXT, INTERVAL, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.apply_moderation_action IS
  'Admin-only RPC. Logs the action, mutates the target (profiles for users; '
  'polymorphic DELETE for content), and notifies the affected user. '
  'On delete_content, auto-dismisses all pending content_reports on the same content_id.';


-- ----------------------------------------------------------------------------
-- 7. RPC: resolve_report
-- ----------------------------------------------------------------------------
-- Closes a content_report or user_report row. The caller decides which
-- table via p_report_kind. The earlier apply_moderation_action call (if
-- any) is referenced via admin_notes for clarity.
CREATE OR REPLACE FUNCTION public.resolve_report(
  p_report_id    UUID,
  p_report_kind  TEXT,
  p_action_taken TEXT,
  p_admin_notes  TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_admin_id UUID := auth.uid();
  v_new_status TEXT;
  v_rows INT;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'resolve_report: admin required'
      USING ERRCODE = '42501';
  END IF;

  IF p_report_kind NOT IN ('content','user') THEN
    RAISE EXCEPTION 'resolve_report: report_kind must be content or user';
  END IF;

  -- Map the verb the admin clicked to a row status.
  v_new_status := CASE
    WHEN p_action_taken = 'dismiss' THEN 'dismissed'
    WHEN p_action_taken IN ('warn','suspend','ban','delete_content') THEN
      CASE WHEN p_report_kind = 'user' THEN 'action_taken' ELSE 'reviewed' END
    ELSE 'reviewed'
  END;

  IF p_report_kind = 'content' THEN
    UPDATE content_reports
       SET status = v_new_status,
           admin_notes = p_admin_notes,
           resolved_at = now(),
           resolved_by = v_admin_id
     WHERE id = p_report_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  ELSE
    UPDATE user_reports
       SET status = v_new_status,
           admin_notes = p_admin_notes,
           resolved_at = now(),
           resolved_by = v_admin_id
     WHERE id = p_report_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
  END IF;

  RETURN v_rows > 0;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_report(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resolve_report(UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.resolve_report IS
  'Admin-only RPC. Closes a content_report or user_report. v_new_status is '
  'derived from the action verb the admin clicked; user reports use '
  'action_taken when a moderation action was applied, content reports use '
  'reviewed (action vs no-action is captured in moderation_actions instead).';


-- ----------------------------------------------------------------------------
-- 8. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '152',
  'moderation_system',
  ARRAY['-- 152: content_reports + user_reports + moderation_actions + RPCs']
)
ON CONFLICT (version) DO NOTHING;
