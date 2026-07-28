-- ═══════════════════════════════════════════════════════════════════════════
-- 392_notification_health_dashboard.sql
--
-- Adds a single admin RPC that surfaces notification-delivery observability
-- from the existing tables (notifications, push_tokens, notification_
-- preferences). No new columns, no webhook, no cron — the delivery
-- pipeline still has open pieces (channel_used isn't populated, Resend
-- isn't wired, notification_queue is empty), and building extra
-- infrastructure now would create dead scaffolding. This RPC surfaces
-- what CAN be observed today so the launch team has visibility.
--
-- Deferrals (documented, out of scope):
--   • Resend webhook — no live email pipeline yet.
--   • notification_queue delivery-status view — table is empty; EFs
--     insert directly into `notifications`.
--   • channel_used backfill — column exists but no EF populates it.
--   • push_tokens.active auto-expiry — depends on capturing Expo's
--     DeviceNotRegistered errors, which we don't do yet.
--
-- When the deferrals become real (email flow ships, EFs start writing
-- to the queue), extend this RPC — don't build a second one.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_notification_health_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_push_tokens JSONB;
  v_notifications JSONB;
  v_by_type JSONB;
  v_preferences JSONB;
  v_recent JSONB;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'get_notification_health_dashboard: admin required'
      USING ERRCODE = '42501';
  END IF;

  -- ── Push tokens summary ─────────────────────────────────────────────
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE active = TRUE),
    'inactive', COUNT(*) FILTER (WHERE active = FALSE),
    'stale_30d', COUNT(*) FILTER (
      WHERE active = TRUE
        AND (last_used_at IS NULL OR last_used_at < v_now - INTERVAL '30 days')
    ),
    'by_platform', COALESCE((
      SELECT jsonb_object_agg(platform, cnt)
      FROM (
        SELECT platform::text AS platform, COUNT(*)::int AS cnt
        FROM push_tokens
        WHERE active = TRUE
        GROUP BY platform
      ) p
    ), '{}'::jsonb)
  ) INTO v_push_tokens
  FROM push_tokens;

  -- ── Notifications volume + push-sent coverage ───────────────────────
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'last_24h', COUNT(*) FILTER (WHERE created_at > v_now - INTERVAL '24 hours'),
    'last_7d', COUNT(*) FILTER (WHERE created_at > v_now - INTERVAL '7 days'),
    'last_30d', COUNT(*) FILTER (WHERE created_at > v_now - INTERVAL '30 days'),
    -- push_sent_at coverage on recent rows — a proxy for delivery activity
    -- (populated by whichever EF fires Expo push for the notification).
    'push_sent_last_7d', COUNT(*) FILTER (
      WHERE created_at > v_now - INTERVAL '7 days' AND push_sent_at IS NOT NULL
    ),
    'read_last_7d', COUNT(*) FILTER (
      WHERE created_at > v_now - INTERVAL '7 days' AND read = TRUE
    )
  ) INTO v_notifications
  FROM notifications;

  -- ── Top notification types (last 30d) ───────────────────────────────
  SELECT COALESCE(jsonb_agg(row_out ORDER BY (row_out->>'count')::INT DESC), '[]'::jsonb)
    INTO v_by_type
  FROM (
    SELECT jsonb_build_object(
      'type', type,
      'count', COUNT(*)
    ) AS row_out
    FROM notifications
    WHERE created_at > v_now - INTERVAL '30 days'
    GROUP BY type
    ORDER BY COUNT(*) DESC
    LIMIT 10
  ) top;

  -- ── Notification preferences opt-out counts ─────────────────────────
  -- Master toggles surface counts of users who've disabled a whole
  -- channel, plus quiet-hours / snooze-active status. Per-category
  -- opt-outs (push_payments etc.) omitted to keep the dashboard
  -- glanceable — add a drill-down later if we need per-category detail.
  SELECT jsonb_build_object(
    'total_users', COUNT(*),
    'push_disabled', COUNT(*) FILTER (WHERE push_enabled = FALSE),
    'email_disabled', COUNT(*) FILTER (WHERE email_enabled = FALSE),
    'sms_disabled', COUNT(*) FILTER (WHERE sms_enabled = FALSE),
    'quiet_hours_on', COUNT(*) FILTER (WHERE quiet_hours_enabled = TRUE),
    'push_snoozed', COUNT(*) FILTER (
      WHERE push_snooze_until IS NOT NULL AND push_snooze_until > v_now
    ),
    'marketing_push_off', COUNT(*) FILTER (WHERE push_marketing = FALSE),
    'marketing_email_off', COUNT(*) FILTER (WHERE email_marketing = FALSE)
  ) INTO v_preferences
  FROM notification_preferences;

  -- ── Recent notifications (last 20) — auditable log ──────────────────
  SELECT COALESCE(jsonb_agg(row_out ORDER BY (row_out->>'created_at') DESC), '[]'::jsonb)
    INTO v_recent
  FROM (
    SELECT jsonb_build_object(
      'id', n.id,
      'type', n.type,
      'title', n.title,
      'user_id', n.user_id,
      'user_name', p.full_name,
      'channel_used', n.channel_used,
      'push_sent_at', n.push_sent_at,
      'read', n.read,
      'read_at', n.read_at,
      'created_at', n.created_at
    ) AS row_out
    FROM notifications n
    LEFT JOIN profiles p ON p.id = n.user_id
    ORDER BY n.created_at DESC
    LIMIT 20
  ) recent;

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'push_tokens', v_push_tokens,
    'notifications', v_notifications,
    'by_type', v_by_type,
    'preferences', v_preferences,
    'recent', v_recent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_notification_health_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_notification_health_dashboard() TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '392',
  'notification_health_dashboard',
  ARRAY['-- 392: notification_health_dashboard']
)
ON CONFLICT (version) DO NOTHING;
