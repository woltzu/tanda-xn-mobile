-- ════════════════════════════════════════════════════════════════════════════
-- 224_event_view_tracking.sql
-- Browse-events Bucket C.1 — view counting & engagement-ordered teaser
-- ════════════════════════════════════════════════════════════════════════════
--
-- Closes the TODO in CommunityTabScreen.tsx that flagged the lack of any
-- engagement signal on community_events:
--
--   1. Two new columns on community_events:
--      - view_count       INTEGER NOT NULL DEFAULT 0
--      - last_viewed_at   TIMESTAMPTZ
--      Existing rows pick up 0 / NULL via the DEFAULT.
--
--   2. record_event_view(p_event_id UUID) SECURITY DEFINER RPC.
--      Atomically increments view_count and stamps last_viewed_at.
--      Called fire-and-forget from EventsScreen whenever the detail
--      bottom-sheet opens. SECURITY DEFINER so authenticated callers
--      can write without RLS giving them broader UPDATE rights on the
--      table.
--
--   3. Btree index on (view_count DESC). The teaser sort that picks
--      the next event lives client-side today, but the index is in
--      place for future server-side ranking (e.g. an admin dashboard
--      or a future "trending events" query) without a follow-up
--      migration.
--
-- The RPC is null-safe: a stale id from the client returns FOUND=false
-- and the function still returns success. The caller can't observe
-- the difference and shouldn't care — view counts are aggregate, not
-- individual.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.community_events
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.community_events
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_community_events_view_count
  ON public.community_events (view_count DESC);

CREATE OR REPLACE FUNCTION public.record_event_view(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'null_id');
  END IF;
  UPDATE public.community_events
     SET view_count     = view_count + 1,
         last_viewed_at = now()
   WHERE id = p_event_id;
  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  -- View counts are non-critical; never raise to the client.
  RAISE WARNING '[record_event_view] failed for %: %', p_event_id, SQLERRM;
  RETURN jsonb_build_object('success', false, 'reason', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_event_view(UUID) TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '224',
  'event_view_tracking',
  ARRAY['-- 224: event_view_tracking']
)
ON CONFLICT (version) DO NOTHING;
