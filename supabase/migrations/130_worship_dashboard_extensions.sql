-- ════════════════════════════════════════════════════════════════════════════
-- 130: worship_dashboard_extensions — Phase 6b host/viewer RPCs
-- ════════════════════════════════════════════════════════════════════════════
--
-- Three SECURITY DEFINER RPCs powering the new SyncRoom + HostDashboard
-- surfaces:
--
--   get_room_engagement_stats(room_id)   — group-level stats; everyone in
--                                          the room can call.
--   get_viewer_summary(user_id, room_id) — per-viewer history; HOST ONLY
--                                          (auth.uid() must match the
--                                          room's created_by).
--   set_scripture_overlay(room_id, text) — overlay text setter; HOST ONLY.
--                                          Text length capped at 280 chars
--                                          to prevent overlay abuse.
--
-- All three pin search_path to public+pg_temp per the Tier 4 hardening
-- backlog and use the standard `SECURITY DEFINER + auth.uid() check`
-- pattern used by the other SyncStream RPCs (migrations 124-129).
--
-- Donations-count caveat (per the approved scope):
--   get_room_engagement_stats.donations_cents sums sync_room_donations
--   only — NOT the donation_cents on sync_room_candle_requests /
--   sync_room_mass_intentions. The under-count is acknowledged and can be
--   fixed in a follow-up commit.
--
-- cycle_contributions caveat:
--   The viewer-summary "total circle contributions" sum reads
--   contributed_amount (DECIMAL, dollars) WHERE user_id = p_user_id.
--   The schema's `member_id` column is an FK to circle_members(id) — NOT
--   to auth.users — so filtering by viewer's auth uid requires user_id.
-- ════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════
-- 1. get_room_engagement_stats — group audience snapshot
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_room_engagement_stats(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_concurrent_count INT;
  v_reactions        JSONB;
  v_donations_cents  BIGINT;
  v_candle_count     INT;
  v_mass_count       INT;
  v_engagement_score INT;
BEGIN
  IF p_room_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_id is required');
  END IF;

  -- Concurrent viewers — members with a heartbeat in the last 5 minutes.
  -- Matches the existing reaper window in migration 126.
  SELECT COUNT(*) INTO v_concurrent_count
  FROM public.sync_room_members
  WHERE room_id = p_room_id
    AND last_heartbeat > NOW() - INTERVAL '5 minutes';

  -- Reaction counts (last 15 minutes), grouped by emoji.
  -- COALESCE to '{}' so the JSON has a usable empty object instead of null.
  SELECT COALESCE(jsonb_object_agg(emoji, cnt), '{}'::jsonb)
  INTO v_reactions
  FROM (
    SELECT emoji, COUNT(*) AS cnt
    FROM public.sync_room_donations
    WHERE room_id = p_room_id
      AND created_at > NOW() - INTERVAL '15 minutes'
    GROUP BY emoji
  ) t;

  SELECT COALESCE(SUM(amount_cents), 0) INTO v_donations_cents
  FROM public.sync_room_donations
  WHERE room_id = p_room_id
    AND created_at > NOW() - INTERVAL '15 minutes';

  SELECT COUNT(*) INTO v_candle_count
  FROM public.sync_room_candle_requests
  WHERE room_id = p_room_id
    AND created_at > NOW() - INTERVAL '15 minutes';

  SELECT COUNT(*) INTO v_mass_count
  FROM public.sync_room_mass_intentions
  WHERE room_id = p_room_id
    AND created_at > NOW() - INTERVAL '15 minutes';

  -- Synthetic engagement score, capped at 100. Formula per the spec:
  -- (concurrent * 5) + (donations_dollars) + (candles * 10) + (masses * 10).
  v_engagement_score := LEAST(100,
    (v_concurrent_count * 5)
    + (v_donations_cents / 100)::INT
    + (v_candle_count * 10)
    + (v_mass_count * 10)
  );

  RETURN jsonb_build_object(
    'success',            true,
    'concurrent_viewers', v_concurrent_count,
    'reactions',          v_reactions,
    'donations_cents',    v_donations_cents,
    'candle_requests',    v_candle_count,
    'mass_intentions',    v_mass_count,
    'engagement_score',   v_engagement_score
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_room_engagement_stats(UUID)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_room_engagement_stats(UUID)
  FROM anon, public;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. get_viewer_summary — per-viewer history, HOST ONLY
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_viewer_summary(
  p_user_id UUID,
  p_room_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller                 UUID := auth.uid();
  v_room_creator           UUID;
  v_circle_contrib_dollars NUMERIC;
  v_donations_cents        BIGINT;
  v_candle_count           INT;
  v_candle_cents           BIGINT;
  v_mass_count             INT;
  v_mass_cents             BIGINT;
  v_last_active            TIMESTAMPTZ;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_user_id IS NULL OR p_room_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_id and room_id are required');
  END IF;

  -- Host gate.
  SELECT created_by INTO v_room_creator
  FROM public.sync_rooms
  WHERE id = p_room_id;
  IF v_room_creator IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;
  IF v_room_creator <> v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the room host can view member history');
  END IF;

  -- Circle contributions (all circles, all time). cycle_contributions uses
  -- contributed_amount DECIMAL(15,2) in DOLLARS; we surface dollars.
  SELECT COALESCE(SUM(contributed_amount), 0)
  INTO v_circle_contrib_dollars
  FROM public.cycle_contributions
  WHERE user_id = p_user_id;

  -- In-room donations
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO v_donations_cents
  FROM public.sync_room_donations
  WHERE room_id = p_room_id AND user_id = p_user_id;

  -- Candle requests (count + donation total in cents)
  SELECT COUNT(*), COALESCE(SUM(donation_cents), 0)
  INTO v_candle_count, v_candle_cents
  FROM public.sync_room_candle_requests
  WHERE room_id = p_room_id AND user_id = p_user_id;

  -- Mass intentions
  SELECT COUNT(*), COALESCE(SUM(donation_cents), 0)
  INTO v_mass_count, v_mass_cents
  FROM public.sync_room_mass_intentions
  WHERE room_id = p_room_id AND user_id = p_user_id;

  -- Last active = last_heartbeat for this room. NULL if the user has never
  -- been a member of this room (e.g. the host typed a stale uid).
  SELECT last_heartbeat INTO v_last_active
  FROM public.sync_room_members
  WHERE room_id = p_room_id AND user_id = p_user_id;

  RETURN jsonb_build_object(
    'success',                     true,
    'circle_contributions_dollars', v_circle_contrib_dollars,
    'in_room_donations_cents',      v_donations_cents,
    'candle_count',                 v_candle_count,
    'candle_donations_cents',       v_candle_cents,
    'mass_count',                   v_mass_count,
    'mass_donations_cents',         v_mass_cents,
    'last_active',                  v_last_active
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_viewer_summary(UUID, UUID)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_viewer_summary(UUID, UUID)
  FROM anon, public;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. set_scripture_overlay — host-only setter, capped at 280 chars
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_scripture_overlay(
  p_room_id UUID,
  p_text    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller       UUID := auth.uid();
  v_room_creator UUID;
  v_clean_text   TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_room_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'room_id is required');
  END IF;

  -- LEFT() is safe on NULL (returns NULL) so COALESCE first. Empty string is
  -- a valid value — it clears the overlay.
  v_clean_text := LEFT(COALESCE(p_text, ''), 280);

  SELECT created_by INTO v_room_creator
  FROM public.sync_rooms
  WHERE id = p_room_id;
  IF v_room_creator IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;
  IF v_room_creator <> v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the room host can set the scripture overlay');
  END IF;

  -- Concatenation operator preserves existing keys; jsonb_build_object
  -- supplies the new value. COALESCE on room_settings defends against any
  -- legacy NULL despite the NOT NULL DEFAULT '{}' from migration 128.
  UPDATE public.sync_rooms
     SET room_settings = COALESCE(room_settings, '{}'::jsonb)
                         || jsonb_build_object('scripture_overlay_text', v_clean_text)
   WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'success',                true,
    'scripture_overlay_text', v_clean_text
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_scripture_overlay(UUID, TEXT)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_scripture_overlay(UUID, TEXT)
  FROM anon, public;

-- ════════════════════════════════════════════════════════════════════════════
-- Self-register
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '130',
  'worship_dashboard_extensions',
  ARRAY['-- 130: worship_dashboard_extensions (get_room_engagement_stats + get_viewer_summary + set_scripture_overlay)']
)
ON CONFLICT (version) DO NOTHING;
