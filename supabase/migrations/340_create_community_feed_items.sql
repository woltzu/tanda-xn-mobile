-- ═══════════════════════════════════════════════════════════════════════════
-- 340_create_community_feed_items.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fixes Bug 1 from the community-tab audit: the trigger
-- trg_gathering_to_feed (function generate_gathering_feed_item) tried
-- to INSERT INTO public.community_feed_items but the table did not
-- exist in live prod. Every gathering INSERT from the app failed
-- silently with "relation does not exist" — the trigger was disabled
-- during the previous session's demo seed to unblock the insert.
--
-- The audit-dump snapshot from 2026-05-18 shows the table DID exist at
-- some point (see docs/audit/11_live_schema_dump.sql:1588). It appears
-- to have been dropped between then and now. This migration re-creates
-- it with the exact schema the audit dump captured, re-enables the
-- trigger, and backfills feed_items for the 2 gatherings that were
-- inserted while the trigger was off.
--
-- Schema is preserved verbatim from the audit dump so:
--   * The trigger's INSERT list matches the actual columns.
--   * CommunityFeaturesEngine (which reads from this table for the
--     community feed surface) sees the same shape it was written for.
--   * The feed_type CHECK carries the full aspirational vocabulary
--     the design allows for future feed entries (welcome,
--     circle_completion, payout_moment, elder_session, etc.), not
--     just the one type the gathering trigger inserts today.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.community_feed_items (
  id                    UUID         NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id          UUID         NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  feed_type             TEXT         NOT NULL CHECK (feed_type IN (
                          'circle_completion','payout_moment','elder_session',
                          'new_arrivals_summary','milestone_story','question',
                          'welcome','service_announcement','gathering_posted',
                          'community_milestone')),
  title                 TEXT         NOT NULL,
  body                  TEXT,
  photo_url             TEXT,
  icon_name             TEXT,
  accent_color          TEXT         DEFAULT '#00C6AE',
  attributed_user_id    UUID         REFERENCES auth.users(id)              ON DELETE SET NULL,
  attributed_name       TEXT,
  -- linked_post_id: FK to community_posts intentionally omitted —
  -- the community_posts table is not present in live prod (dropped at
  -- some point; unrelated to this migration). Column stays for
  -- forward-compat; add the FK back when community_posts is re-created.
  linked_post_id        UUID,
  linked_gathering_id   UUID         REFERENCES public.community_gatherings(id) ON DELETE SET NULL,
  linked_circle_id      UUID         REFERENCES public.circles(id)              ON DELETE SET NULL,
  metadata              JSONB        DEFAULT '{}'::jsonb,
  is_system_generated   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes — mirror the audit-dump indexes exactly.
CREATE INDEX IF NOT EXISTS idx_feed_community
  ON public.community_feed_items (community_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_type
  ON public.community_feed_items (community_id, feed_type);

-- ─── 2. RLS — feed is community-scoped, readable to any authenticated
--       caller (per audit-dump policy). Writes are trigger-only via
--       SECURITY DEFINER; no user-facing INSERT/UPDATE/DELETE surface.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.community_feed_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feed_member_select ON public.community_feed_items;
CREATE POLICY feed_member_select ON public.community_feed_items
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS feed_service_all ON public.community_feed_items;
CREATE POLICY feed_service_all ON public.community_feed_items
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ─── 3. Re-enable the trigger that was disabled to unblock last
--       session's demo seed. With the table back, the trigger now
--       has a valid target on every gathering INSERT.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.community_gatherings
  ENABLE TRIGGER trg_gathering_to_feed;

-- ─── 4. Backfill — the 2 gatherings that were inserted during last
--       session's seed missed the trigger (it was off). Create their
--       feed rows now so the demo Community tab shows both events in
--       the community_feed surface too.
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.community_feed_items
  (community_id, feed_type, title, body,
   attributed_user_id, attributed_name, linked_gathering_id,
   icon_name, is_system_generated)
SELECT
  g.community_id,
  'gathering_posted',
  g.title,
  g.description,
  g.organizer_user_id,
  g.organizer_first_name,
  g.id,
  CASE g.event_type
    WHEN 'elder_session' THEN 'school-outline'
    WHEN 'service'       THEN 'storefront-outline'
    WHEN 'circle'        THEN 'people-outline'
    ELSE                      'calendar-outline'
  END,
  TRUE
FROM public.community_gatherings g
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_feed_items f
   WHERE f.linked_gathering_id = g.id
);

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '340',
  'create_community_feed_items',
  ARRAY['-- 340: re-create community_feed_items table + re-enable trg_gathering_to_feed + backfill missing feed rows']
)
ON CONFLICT (version) DO NOTHING;
