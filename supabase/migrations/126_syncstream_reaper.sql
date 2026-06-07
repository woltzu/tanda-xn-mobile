-- ============================================================================
-- Migration 126: SyncStream -- reaper functions + hourly schedule
-- ============================================================================
-- Phase 3 of SyncStream. Two PL/pgSQL functions + an hourly cron that
-- runs both through the syncstream-reaper-cron EF.
--
--   clean_stale_room_members(p_inactive_threshold_minutes INT DEFAULT 10)
--     DELETEs sync_room_members rows whose last_heartbeat is older than
--     the threshold. SyncRoomScreen heartbeats every 30s (migration 125),
--     so a 10-minute window absorbs realistic network blips while still
--     evicting members whose client crashed, was killed, or
--     backgrounded long enough that the OS suspended the timer. Also
--     drops any orphaned skip votes for the evicted user so the
--     vote_skip threshold maths stays consistent.
--
--   deactivate_inactive_rooms(p_inactive_threshold_hours INT DEFAULT 2)
--     Flips is_active=false on rooms whose last_active is older than
--     the threshold AND that are currently active. The row stays so the
--     reaction history is preserved; the lobby's `is_active = true`
--     filter from SyncLobbyScreen hides it. A 2-hour window is
--     conservative -- it lets a room that emptied out briefly come back
--     to life if someone reopens the link.
--
-- Both functions return a JSONB summary the EF can log.
--
-- Schedule: 'syncstream-reaper-hourly' @ 30 * * * * (every hour at :30).
-- The :30 offset puts the reap halfway between the other top-of-hour
-- jobs in the cron table, spreading load.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- clean_stale_room_members
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clean_stale_room_members(
  p_inactive_threshold_minutes INT DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_removed_count INTEGER;
  v_votes_dropped INTEGER;
BEGIN
  v_cutoff := NOW() - (p_inactive_threshold_minutes || ' minutes')::INTERVAL;

  -- Drop skip votes from soon-to-be-removed members FIRST so the
  -- threshold maths inside vote_skip() (computed against live member
  -- count) stays self-consistent in the brief window between these
  -- two statements. Using a CTE wouldn't help -- the votes table
  -- doesn't carry last_heartbeat, so we have to join.
  WITH stale AS (
    SELECT room_id, user_id
    FROM sync_room_members
    WHERE last_heartbeat < v_cutoff
  )
  DELETE FROM sync_room_votes v
  USING stale s
  WHERE v.room_id = s.room_id AND v.user_id = s.user_id;
  GET DIAGNOSTICS v_votes_dropped = ROW_COUNT;

  DELETE FROM sync_room_members
  WHERE last_heartbeat < v_cutoff;
  GET DIAGNOSTICS v_removed_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'removed_count', v_removed_count,
    'votes_dropped', v_votes_dropped,
    'cutoff', v_cutoff,
    'threshold_minutes', p_inactive_threshold_minutes,
    'source', 'clean_stale_room_members_v1'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.clean_stale_room_members(INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.clean_stale_room_members(INT) TO service_role;


-- ----------------------------------------------------------------------------
-- deactivate_inactive_rooms
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deactivate_inactive_rooms(
  p_inactive_threshold_hours INT DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_deactivated_count INTEGER;
BEGIN
  v_cutoff := NOW() - (p_inactive_threshold_hours || ' hours')::INTERVAL;

  UPDATE sync_rooms
  SET    is_active = false
  WHERE  is_active = true
    AND  last_active < v_cutoff;
  GET DIAGNOSTICS v_deactivated_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'deactivated_count', v_deactivated_count,
    'cutoff', v_cutoff,
    'threshold_hours', p_inactive_threshold_hours,
    'source', 'deactivate_inactive_rooms_v1'
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.deactivate_inactive_rooms(INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.deactivate_inactive_rooms(INT) TO service_role;


-- ----------------------------------------------------------------------------
-- Schedule
-- ----------------------------------------------------------------------------
-- Same DO + cron.unschedule + cron.schedule idiom as migrations 116/118/
-- 121. Calls the syncstream-reaper-cron EF deployed in this commit.
DO $$ BEGIN PERFORM cron.unschedule('syncstream-reaper-hourly');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'syncstream-reaper-hourly',
  '30 * * * *',                       -- every hour at :30
  $$
  SELECT net.http_post(
    url := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/syncstream-reaper-cron',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('126', 'syncstream_reaper',
        ARRAY['-- 126: clean_stale_room_members + deactivate_inactive_rooms + hourly cron'])
ON CONFLICT (version) DO NOTHING;
