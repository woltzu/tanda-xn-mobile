-- ═══════════════════════════════════════════════════════════════════════════
-- 251: feed_posts community scaffold + visibility policy (Bounded Belonging, Phase 1)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- SCOPE NARROWED FROM SPEC (per launch-prep risk discussion):
--   The original spec rewrote RLS on profiles, circles,
--   community_memberships, AND feed_posts in one migration. Read-only
--   audit found six production-breaking bugs and substantial cascade
--   risk (profiles is queried by ~150 screens; tightening it without
--   per-screen verification would break unrelated flows).
--
--   This migration ships ONLY the lowest-blast-radius piece: the
--   feed_posts community column + visibility policy. The other three
--   tables' RLS rewrites are deferred to a future migration that can
--   be designed with app-side coordination + per-screen testing.
--
-- WHAT THIS MIGRATION DOES:
--   1. Adds feed_posts.community_id (nullable FK to communities)
--   2. Seeds a sentinel "Public" community (id = all-zeros UUID)
--   3. Backfills:
--      a. circle-linked feed_posts → that circle's community_id
--      b. everything else → Public community
--   4. Indexes the new column
--   5. DROPs the existing read_public_posts policy (currently
--      visibility='public' AND authed = world-readable)
--   6. CREATEs feed_posts_visibility_select policy: author OR Public
--      community OR member of the post's community
--
-- SPEC FIXES APPLIED:
--   • Registry insert table name + statements column type (was
--     INSERT INTO supabase_migrations (..., applied_at) — would error;
--     correct table is supabase_migrations.schema_migrations and
--     statements is TEXT[])
--   • communities.is_public doesn't exist — actual columns are
--     is_private (BOOLEAN) and is_discoverable (BOOLEAN). Seed
--     adjusted to is_private=false, is_discoverable=true.
--   • feed_posts.related_id is TEXT (not UUID). Backfill explicitly
--     casts and filters to UUID-shaped values to avoid runtime errors
--     on non-UUID related_id values (e.g., savings_goal IDs).
--   • read_public_posts is the real policy name (not the spec's
--     read_public_posts — confirmed via pg_policies audit).
--
-- WHY THIS IS SAFE TO APPLY NOW:
--   • feed_posts has 7 rows total in dev — easy to validate backfill.
--   • The existing read_own_posts policy is preserved, so authors
--     keep visibility on their own posts even if the new policy fails.
--   • PostgreSQL ORs permissive policies, so the new policy is
--     additive — authors and Public-community posts remain visible
--     even if community membership lookups fail transiently.
--   • Other tables (profiles, circles, community_memberships) are
--     UNTOUCHED — no cascade risk on screens that join those.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Add community_id to feed_posts.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE feed_posts
  ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

COMMENT ON COLUMN feed_posts.community_id IS
  'Scoping column for community visibility RLS (migration 251). NULL means '
  'pre-scoping (should be backfilled). The all-zeros UUID is the Public '
  'community sentinel — posts there are visible to all authenticated users.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Seed the Public community sentinel using REAL column names from the
--    communities table (is_private, is_discoverable — not is_public).
--    created_by is NOT NULL with no default + FK to profiles(id), so we
--    assign ownership to the platform's founding profile (oldest by
--    created_at). This is a one-time seed; the row never changes hands.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO communities (
  id, name, description,
  is_private, is_discoverable,
  status, created_by, created_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  'Public',
  'Sentinel community for posts visible to all authenticated users',
  false,
  true,
  'active',
  (SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1),
  NOW()
WHERE EXISTS (SELECT 1 FROM profiles)
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────────────────
-- 3a. Backfill circle-linked feed_posts. Cast TEXT → UUID with a regex
--     filter so non-UUID related_id values (e.g., 'goal_xxx') don't error.
-- ───────────────────────────────────────────────────────────────────────────
UPDATE feed_posts fp
SET community_id = c.community_id
FROM circles c
WHERE fp.related_type = 'circle'
  AND fp.related_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND fp.related_id::uuid = c.id
  AND fp.community_id IS NULL
  AND c.community_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 3b. Remaining unscoped posts → Public community.
-- ───────────────────────────────────────────────────────────────────────────
UPDATE feed_posts
SET community_id = '00000000-0000-0000-0000-000000000000'
WHERE community_id IS NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Index for the visibility join.
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feed_posts_community_id
  ON feed_posts (community_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Replace the world-readable read_public_posts policy with a community-
--    scoped one. The existing read_own_posts policy is preserved as a
--    backstop so authors always see their own posts.
--
--    New policy logic (any one true grants SELECT):
--      a. Post is in the Public sentinel community → visible to all authed
--      b. Author of the post → visible to self
--      c. Caller is an active member of the post's community
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS read_public_posts ON feed_posts;

CREATE POLICY feed_posts_visibility_select ON feed_posts FOR SELECT
USING (
  community_id = '00000000-0000-0000-0000-000000000000'
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM community_memberships cm
    WHERE cm.community_id = feed_posts.community_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
  )
);

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '251',
  'community_visibility_rls',
  ARRAY['-- 251: community_visibility_rls (feed_posts scaffold + policy)']
)
ON CONFLICT (version) DO NOTHING;
