-- ============================================================================
-- Migration 125: SyncStream -- heartbeat RPC
-- ============================================================================
-- Companion to migration 124. The SyncRoomScreen calls heartbeat_sync_room()
-- on a 30-second interval so the server can distinguish "in the room
-- right now" members from stale rows where the client crashed or the user
-- backgrounded the app. A later reaper cron can DELETE FROM
-- sync_room_members WHERE last_heartbeat < NOW() - INTERVAL '2 minutes';
-- that cron is intentionally not in this migration -- ship the screen
-- first, observe staleness in real traffic, then add the reap interval
-- that matches.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.heartbeat_sync_room(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthenticated');
  END IF;

  -- Only members can heartbeat. The UPDATE no-ops for non-members
  -- (no row matches), so the client gets a clear "not_in_room" signal
  -- via FOUND.
  UPDATE sync_room_members
  SET    last_heartbeat = NOW()
  WHERE  room_id = p_room_id
    AND  user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_in_room');
  END IF;

  -- Keep the room hot so the lobby's last_active ordering doesn't push
  -- it down while members are watching.
  UPDATE sync_rooms SET last_active = NOW() WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'room_id', p_room_id,
    'heartbeat_at', NOW(),
    'source', 'heartbeat_sync_room_v1'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.heartbeat_sync_room(UUID) TO authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('125', 'syncstream_heartbeat',
        ARRAY['-- 125: heartbeat_sync_room() RPC for presence tracking'])
ON CONFLICT (version) DO NOTHING;
