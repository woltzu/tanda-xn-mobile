-- ═══════════════════════════════════════════════════════════════════════════
-- 391_chat_mute_and_moderation_extensions.sql
--
-- Extends the mig-152 moderation system with chat-only mute + cross-circle
-- report history. Deliberately DOES NOT rebuild content_reports /
-- user_reports / moderation_actions / apply_moderation_action /
-- AdminModerationScreen — those already exist and this migration reuses
-- them.
--
-- Chat mute is distinct from account suspension (mig 152) — the latter
-- blocks LOGIN entirely, the former only blocks writing chat messages
-- so a user can still see their circle position and payout order while
-- being silenced. Motivating scenario: someone using chat as a coercion
-- vector ("give me my money or…") should be silenced without freezing
-- their financial standing.
--
-- Pieces:
--   1. profiles.chat_muted_until / _by / _reason columns.
--   2. is_chat_muted(user_id) helper.
--   3. mute_member_chat / unmute_member_chat direct RPCs (admin-only).
--   4. apply_moderation_action extension: add 'mute_chat' + 'unmute_chat'
--      actions. Delegates to the direct RPCs above so the canonical
--      audit path (moderation_actions row + notification) is preserved.
--   5. Extend moderation_actions.action CHECK to accept the new verbs.
--   6. RLS on circle_messages INSERT: block chat_muted users.
--   7. get_member_report_history(user_id) RPC — cross-circle aggregation
--      for the admin pattern-detection surface.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. profiles: chat-mute columns ──────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS chat_muted_until  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS chat_muted_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chat_muted_reason TEXT;

CREATE INDEX IF NOT EXISTS profiles_chat_muted_until_idx
  ON profiles (chat_muted_until) WHERE chat_muted_until IS NOT NULL;

-- ─── 2. is_chat_muted helper ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_chat_muted(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(chat_muted_until IS NOT NULL AND chat_muted_until > NOW(), FALSE)
  FROM public.profiles
  WHERE id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.is_chat_muted(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_chat_muted(UUID) TO authenticated, service_role;

-- ─── 3. moderation_actions.action CHECK — add mute_chat / unmute_chat ────
ALTER TABLE moderation_actions
  DROP CONSTRAINT IF EXISTS moderation_actions_action_check;
ALTER TABLE moderation_actions
  ADD CONSTRAINT moderation_actions_action_check CHECK (
    action = ANY (ARRAY[
      'warn','suspend','ban','delete_content','dismiss_report',
      'auto_suspend','auto_ban',
      'mute_chat','unmute_chat'
    ])
  );

-- ─── 4. mute_member_chat direct RPC ───────────────────────────────────────
-- Admin-only. Sets the chat_muted_* columns to NOW() + duration_days,
-- stamps the admin's id, logs to moderation_actions, notifies the user.
-- Idempotent: repeat calls extend the mute + refresh reason.
CREATE OR REPLACE FUNCTION public.mute_member_chat(
  p_user_id UUID,
  p_duration_days INT,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_muted_until TIMESTAMPTZ;
  v_action_id UUID;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'mute_member_chat: admin required' USING ERRCODE = '42501';
  END IF;
  IF p_duration_days IS NULL OR p_duration_days <= 0 THEN
    RAISE EXCEPTION 'mute_member_chat: duration_days must be > 0';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'mute_member_chat: reason required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'mute_member_chat: user not found' USING ERRCODE = 'P0002';
  END IF;

  v_muted_until := NOW() + (p_duration_days || ' days')::INTERVAL;

  UPDATE profiles SET
    chat_muted_until  = v_muted_until,
    chat_muted_by     = v_admin_id,
    chat_muted_reason = p_reason
  WHERE id = p_user_id;

  INSERT INTO moderation_actions (
    admin_user_id, target_type, target_id, action, reason, duration
  )
  VALUES (
    v_admin_id, 'user', p_user_id, 'mute_chat', p_reason,
    (p_duration_days || ' days')::INTERVAL
  )
  RETURNING id INTO v_action_id;

  BEGIN
    INSERT INTO notifications (user_id, type, title, body, data, read)
    VALUES (
      p_user_id,
      'chat_muted',
      'You are temporarily muted in chat',
      'You have been muted in circle chat until '
        || to_char(v_muted_until, 'YYYY-MM-DD HH24:MI TZ')
        || '. Reason: ' || p_reason
        || '. You can still access your circles and view messages; '
        || 'you just cannot send new ones. Contact support if you believe '
        || 'this was in error.',
      jsonb_build_object(
        'chat_muted_until',   v_muted_until,
        'reason',             p_reason,
        'moderation_action_id', v_action_id
      ),
      false
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[mute_member_chat] notification insert failed user=%, err=%',
      p_user_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', p_user_id,
    'chat_muted_until', v_muted_until,
    'moderation_action_id', v_action_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mute_member_chat(UUID, INT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mute_member_chat(UUID, INT, TEXT) TO authenticated;

-- ─── 5. unmute_member_chat direct RPC ─────────────────────────────────────
-- Admin-only. Clears the mute + logs + notifies.
CREATE OR REPLACE FUNCTION public.unmute_member_chat(
  p_user_id UUID,
  p_reason  TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_prior_until TIMESTAMPTZ;
  v_prior_reason TEXT;
  v_action_id UUID;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'unmute_member_chat: admin required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'unmute_member_chat: reason required';
  END IF;

  SELECT chat_muted_until, chat_muted_reason
    INTO v_prior_until, v_prior_reason
    FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unmute_member_chat: user not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_prior_until IS NULL THEN
    RAISE EXCEPTION 'unmute_member_chat: user is not chat-muted';
  END IF;

  UPDATE profiles SET
    chat_muted_until  = NULL,
    chat_muted_by     = NULL,
    chat_muted_reason = NULL
  WHERE id = p_user_id;

  INSERT INTO moderation_actions (
    admin_user_id, target_type, target_id, action, reason
  )
  VALUES (v_admin_id, 'user', p_user_id, 'unmute_chat', p_reason)
  RETURNING id INTO v_action_id;

  BEGIN
    INSERT INTO notifications (user_id, type, title, body, data, read)
    VALUES (
      p_user_id,
      'chat_unmuted',
      'You can chat again',
      'Your chat mute has been lifted. You can send messages in your circles again.',
      jsonb_build_object(
        'unmute_reason',       p_reason,
        'prior_muted_until',   v_prior_until,
        'prior_muted_reason',  v_prior_reason,
        'moderation_action_id', v_action_id
      ),
      false
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[unmute_member_chat] notification insert failed user=%, err=%',
      p_user_id, SQLERRM;
  END;

  RETURN jsonb_build_object('success', TRUE, 'user_id', p_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.unmute_member_chat(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unmute_member_chat(UUID, TEXT) TO authenticated;

-- ─── 6. apply_moderation_action: add mute_chat / unmute_chat branches ────
-- Rewrites the existing function to accept the two new actions and
-- delegate to the direct RPCs above. All other paths kept byte-identical
-- to the pre-391 body (warn / suspend / ban / delete_content /
-- dismiss_report) so no regression.
CREATE OR REPLACE FUNCTION public.apply_moderation_action(
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_duration interval DEFAULT NULL::interval,
  p_source_report_id uuid DEFAULT NULL::uuid,
  p_source_report_kind text DEFAULT NULL::text
)
RETURNS uuid
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
  v_mute_days INT;
  v_mute_result JSONB;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'apply_moderation_action: admin required'
      USING ERRCODE = '42501';
  END IF;

  IF p_action NOT IN ('warn','suspend','ban','delete_content','dismiss_report','mute_chat','unmute_chat') THEN
    RAISE EXCEPTION 'apply_moderation_action: unknown action %', p_action;
  END IF;
  IF p_target_type NOT IN ('user','content') THEN
    RAISE EXCEPTION 'apply_moderation_action: target_type must be user or content';
  END IF;
  IF p_action = 'suspend' AND p_duration IS NULL THEN
    RAISE EXCEPTION 'apply_moderation_action: suspend requires a duration';
  END IF;
  IF p_action = 'mute_chat' AND p_duration IS NULL THEN
    RAISE EXCEPTION 'apply_moderation_action: mute_chat requires a duration';
  END IF;
  IF p_action IN ('warn','suspend','ban','mute_chat','unmute_chat') AND p_target_type <> 'user' THEN
    RAISE EXCEPTION 'apply_moderation_action: % targets a user', p_action;
  END IF;
  IF p_action = 'delete_content' AND p_target_type <> 'content' THEN
    RAISE EXCEPTION 'apply_moderation_action: delete_content targets content';
  END IF;

  -- Delegate mute_chat / unmute_chat to the direct RPCs. Those RPCs
  -- write their own moderation_actions row + notification, so we return
  -- the action_id from the JSONB result rather than doing our own log.
  IF p_action = 'mute_chat' THEN
    v_mute_days := GREATEST(1, CEIL(EXTRACT(EPOCH FROM p_duration) / 86400.0)::INT);
    v_mute_result := public.mute_member_chat(p_target_id, v_mute_days, p_reason);
    RETURN (v_mute_result->>'moderation_action_id')::UUID;
  ELSIF p_action = 'unmute_chat' THEN
    v_mute_result := public.unmute_member_chat(p_target_id, p_reason);
    -- Direct RPC returns just success + user_id; the moderation_actions
    -- row was still logged inside it. Fetch the latest one for the return.
    SELECT id INTO v_action_id FROM moderation_actions
     WHERE admin_user_id = v_admin_id AND target_id = p_target_id AND action = 'unmute_chat'
     ORDER BY created_at DESC LIMIT 1;
    RETURN v_action_id;
  END IF;

  -- Legacy path (unchanged from pre-391): log first, then side-effects.
  INSERT INTO moderation_actions (
    admin_user_id, target_type, target_id, action, reason, duration,
    source_report_id, source_report_kind
  )
  VALUES (
    v_admin_id, p_target_type, p_target_id, p_action, p_reason, p_duration,
    p_source_report_id, p_source_report_kind
  )
  RETURNING id INTO v_action_id;

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

-- ─── 7. circle_messages RLS: block writes from chat-muted users ──────────
-- The existing "Members write circle messages" policy already limits
-- writes to (own uid + user-type + active member). Add NOT is_chat_muted
-- so a muted user's INSERT is refused server-side. System messages
-- (message_type != 'user') go through SECURITY DEFINER RPCs and bypass
-- RLS — the mute doesn't affect the "X joined" system posts.
DROP POLICY IF EXISTS "Members write circle messages" ON public.circle_messages;
CREATE POLICY "Members write circle messages"
  ON public.circle_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND message_type = 'user'
    AND EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_messages.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
    AND NOT public.is_chat_muted(auth.uid())
  );

-- ─── 8. get_member_report_history RPC ────────────────────────────────────
-- Cross-circle aggregation for admin pattern detection: "user X has N
-- reports across M circles in the last 90 days." Admin-only.
--
-- Combines user_reports (direct reports against the user) and
-- content_reports on circle_message content authored by the user.
-- Comment/dream/event content isn't traced back to a circle (they're
-- global feed items), so by_circle only surfaces circle_message reports.
CREATE OR REPLACE FUNCTION public.get_member_report_history(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_total_reports INT := 0;
  v_pending INT := 0;
  v_resolved INT := 0;
  v_by_circle JSONB := '[]'::JSONB;
  v_recent JSONB := '[]'::JSONB;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'get_member_report_history: admin required' USING ERRCODE = '42501';
  END IF;

  -- Totals: user_reports (direct) + content_reports where the reported
  -- content_id points at a circle_message this user authored.
  SELECT COUNT(*) INTO v_total_reports FROM (
    SELECT id FROM user_reports WHERE reported_user_id = p_user_id
    UNION ALL
    SELECT cr.id FROM content_reports cr
      JOIN circle_messages m ON m.id = cr.content_id
      WHERE cr.content_type = 'circle_message' AND m.user_id = p_user_id
  ) t;

  SELECT COUNT(*) INTO v_pending FROM (
    SELECT id FROM user_reports WHERE reported_user_id = p_user_id AND status = 'pending'
    UNION ALL
    SELECT cr.id FROM content_reports cr
      JOIN circle_messages m ON m.id = cr.content_id
      WHERE cr.content_type = 'circle_message' AND m.user_id = p_user_id AND cr.status = 'pending'
  ) t;

  v_resolved := v_total_reports - v_pending;

  -- By-circle: only content_reports on circle_message have a circle
  -- to group on.
  SELECT COALESCE(jsonb_agg(row_out ORDER BY (row_out->>'count')::INT DESC), '[]'::jsonb)
    INTO v_by_circle
    FROM (
      SELECT jsonb_build_object(
        'circle_id',   m.circle_id,
        'circle_name', c.name,
        'count',       COUNT(*)
      ) AS row_out
      FROM content_reports cr
      JOIN circle_messages m ON m.id = cr.content_id
      JOIN circles c ON c.id = m.circle_id
      WHERE cr.content_type = 'circle_message' AND m.user_id = p_user_id
      GROUP BY m.circle_id, c.name
    ) grouped;

  -- Recent: last 10 reports across both kinds. Include reporter name.
  SELECT COALESCE(jsonb_agg(row_out ORDER BY (row_out->>'created_at') DESC), '[]'::jsonb)
    INTO v_recent
    FROM (
      SELECT jsonb_build_object(
        'kind',         'user',
        'report_id',    ur.id,
        'created_at',   ur.created_at,
        'reporter_id',  ur.reporter_user_id,
        'reporter_name', rp.full_name,
        'reason',       ur.reason,
        'status',       ur.status
      ) AS row_out
      FROM user_reports ur
      LEFT JOIN profiles rp ON rp.id = ur.reporter_user_id
      WHERE ur.reported_user_id = p_user_id
      UNION ALL
      SELECT jsonb_build_object(
        'kind',         'content',
        'report_id',    cr.id,
        'created_at',   cr.created_at,
        'reporter_id',  cr.reporter_user_id,
        'reporter_name', rp.full_name,
        'reason',       cr.reason,
        'status',       cr.status,
        'content_type', cr.content_type,
        'content_id',   cr.content_id,
        'circle_id',    m.circle_id,
        'circle_name',  c.name
      ) AS row_out
      FROM content_reports cr
      JOIN circle_messages m ON m.id = cr.content_id
      JOIN circles c ON c.id = m.circle_id
      LEFT JOIN profiles rp ON rp.id = cr.reporter_user_id
      WHERE cr.content_type = 'circle_message' AND m.user_id = p_user_id
      ORDER BY 1 DESC
      LIMIT 10
    ) recent;

  RETURN jsonb_build_object(
    'user_id',       p_user_id,
    'total_reports', v_total_reports,
    'pending',       v_pending,
    'resolved',      v_resolved,
    'by_circle',     v_by_circle,
    'recent',        v_recent
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_member_report_history(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_member_report_history(UUID) TO authenticated;

-- ─── 9. Self-register ────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '391',
  'chat_mute_and_moderation_extensions',
  ARRAY['-- 391: chat_mute_and_moderation_extensions']
)
ON CONFLICT (version) DO NOTHING;
