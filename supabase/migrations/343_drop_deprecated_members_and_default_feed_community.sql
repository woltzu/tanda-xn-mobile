-- ═══════════════════════════════════════════════════════════════════════════
-- 343_drop_deprecated_members_and_default_feed_community.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Closes the two follow-ups mig 342 documented:
--
-- 1. Drop community_members_deprecated_v342.
--    Mig 342 renamed community_members (no S) to
--    community_members_deprecated_v342 rather than dropping it, so any
--    surviving reference would error loudly instead of silently writing
--    to the dead-end table. One deployment cycle later with zero
--    production log noise: safe to drop.
--
-- 2. ALTER feed_posts.community_id SET DEFAULT 00000000-…-000.
--    Mig 342 backfilled 23 orphan posts (community_id IS NULL) to the
--    Public sentinel. Root cause was that some insert paths — notably
--    lib/autoPost.ts::createAutoPost and mig 231's
--    cross_post_gathering_to_community — do not specify community_id
--    on INSERT, and the column had no DEFAULT, so they landed NULL
--    and became invisible to everyone but the author (per mig 251's
--    RLS). Setting the sentinel as the column default fixes every
--    non-community-scoped insert path in one shot without editing the
--    dozen individual call sites.
--
--    Community-scoped inserts (e.g. lib/autoPost.ts's mirror row with
--    type='community', or PostToCommunity flow) already pass an
--    explicit community_id and are unaffected by the default.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1a. Retarget the reserve_funds SELECT policy ──────────────────────
-- The reserve_select policy on public.reserve_funds still points at the
-- deprecated community_members_deprecated_v342 table for its membership
-- check. Blocking the DROP. Rewrite it to use community_memberships
-- (with the status='active' filter that the parallel-tables fix
-- established as canonical) before dropping the deprecated table.
--
-- The other policy on the deprecated table
-- (community_members_member_select) doesn't need retargeting — it
-- lives ON the deprecated table itself and dies with it.

DROP POLICY IF EXISTS reserve_select ON public.reserve_funds;

CREATE POLICY reserve_select ON public.reserve_funds
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.community_memberships cm
     WHERE cm.community_id = reserve_funds.community_id
       AND cm.user_id      = auth.uid()
       AND cm.status       = 'active'
  )
);

-- ─── 1b. Drop the deprecated parallel-tables residue ───────────────────

DROP TABLE IF EXISTS public.community_members_deprecated_v342;

-- ─── 2. Set the Public-community default on feed_posts.community_id ────
-- Existing NULL rows were already backfilled by mig 342; every future
-- insert that omits community_id will fall through to the sentinel.

ALTER TABLE public.feed_posts
  ALTER COLUMN community_id
  SET DEFAULT '00000000-0000-0000-0000-000000000000'::uuid;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '343',
  'drop_deprecated_members_and_default_feed_community',
  ARRAY['-- 343: DROP TABLE community_members_deprecated_v342 + ALTER feed_posts.community_id SET DEFAULT Public sentinel']
)
ON CONFLICT (version) DO NOTHING;
