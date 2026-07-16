-- ═══════════════════════════════════════════════════════════════════════════
-- 342_merge_community_members_into_memberships.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Resolves the parallel-tables drift surfaced during the Dream Feed
-- audit: two membership tables coexisted in prod —
--
--   community_memberships (with S) — 79 rows, referenced by:
--       * feed_posts RLS (mig 251) — the community-scoped feed
--         visibility check
--       * ElderContext, FeatureGateContext — real reads/writes
--       * CommunityContext — all real reads/writes go here today
--       * trigger_update_community_member_count — keeps
--         communities.member_count in sync (INSERT/UPDATE/DELETE)
--
--   community_members (no S) — 4 rows, populated ONLY by:
--       * a manual seed from a prior session (Marcus + Franck)
--       * the auto-arrival trigger added in mig 341, which fires on
--         community_members INSERT (wrong target — should have been
--         community_memberships)
--
-- Net effect of the drift: joining a community via the code path that
-- writes to community_members created an arrival card (mig 341
-- trigger) but did NOT grant feed access (RLS reads community_
-- memberships). The trigger was pointing at the wrong table.
--
-- This migration fixes it:
--
--   1. Move any community_members rows that aren't already in
--      community_memberships over. Idempotent — the NOT EXISTS
--      guard skips duplicates.
--   2. Drop the mig 341 arrival trigger from community_members and
--      recreate it on community_memberships. The trigger function
--      (auto_arrival_from_membership) reads NEW.user_id + NEW.
--      community_id, both present on both tables — no function
--      change needed.
--   3. Backfill arrivals for every active community_memberships row
--      that doesn't already have one. Preserves the "arrival window
--      = 30 days from join" semantic by dating expires_at to
--      joined_at + 30 days (backfilled rows for older members will
--      already be expired and won't render).
--   4. Rename community_members → community_members_deprecated_v342
--      so any surviving reference fails loudly instead of silently
--      writing to the dead-end table. Actual DROP TABLE deferred to
--      a follow-up migration after one deployment cycle of watching
--      logs for the errors.
--   5. Backfill feed_posts with community_id IS NULL → the Public
--      sentinel so those posts become visible to authenticated
--      users. Mig 251 was supposed to do this at deploy time but
--      23 posts still have NULL — either late arrivers or a
--      re-insertion path that skipped the sentinel default.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Copy over any orphan community_members rows ────────────────────

INSERT INTO public.community_memberships
  (user_id, community_id, role, status, joined_at, left_at)
SELECT
  cm.user_id,
  cm.community_id,
  COALESCE(cm.role,   'member'),
  COALESCE(cm.status, 'active'),
  cm.joined_at,
  cm.left_at
FROM public.community_members cm
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_memberships m
   WHERE m.user_id = cm.user_id
     AND m.community_id = cm.community_id
);

-- ─── 2. Move the auto-arrival trigger to community_memberships ─────────

DROP TRIGGER IF EXISTS tr_auto_arrival_from_membership
  ON public.community_members;

DROP TRIGGER IF EXISTS tr_auto_arrival_from_membership
  ON public.community_memberships;

CREATE TRIGGER tr_auto_arrival_from_membership
  AFTER INSERT ON public.community_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_arrival_from_membership();

-- ─── 3. Backfill arrivals for existing memberships without one ─────────

INSERT INTO public.community_arrivals
  (user_id, community_id, first_name, origin_country, current_city,
   created_at, expires_at)
SELECT
  cm.user_id,
  cm.community_id,
  COALESCE(NULLIF(split_part(COALESCE(p.full_name, ''), ' ', 1), ''),
           'New member'),
  p.country_of_origin,
  p.city,
  COALESCE(cm.joined_at, NOW()),
  COALESCE(cm.joined_at, NOW()) + INTERVAL '30 days'
FROM public.community_memberships cm
LEFT JOIN public.profiles p ON p.id = cm.user_id
WHERE cm.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.community_arrivals ca
     WHERE ca.user_id = cm.user_id
       AND ca.community_id = cm.community_id
  );

-- ─── 4. Rename the deprecated table so surviving references error ──────
-- IF EXISTS so the migration is idempotent if re-applied.
ALTER TABLE IF EXISTS public.community_members
  RENAME TO community_members_deprecated_v342;

COMMENT ON TABLE public.community_members_deprecated_v342 IS
  'DEPRECATED. Superseded by community_memberships via mig 342. '
  'Kept renamed for one deployment cycle so any surviving reference '
  'errors loudly instead of silently writing to a dead-end table. '
  'DROP TABLE in a follow-up migration once logs are clean.';

-- ─── 5. Backfill orphan feed_posts to the Public sentinel ──────────────
-- Mig 251 established that community_id NULL means "visible to no one
-- but the author" (the RLS third condition never matches). Backfilling
-- to the Public sentinel makes these posts visible to any authenticated
-- caller — matching the feed's original always-see-everyone shape.

UPDATE public.feed_posts
   SET community_id = '00000000-0000-0000-0000-000000000000'::uuid
 WHERE community_id IS NULL;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '342',
  'merge_community_members_into_memberships',
  ARRAY['-- 342: merge parallel membership tables + move arrival trigger + backfill arrivals + backfill orphan feed_posts']
)
ON CONFLICT (version) DO NOTHING;
