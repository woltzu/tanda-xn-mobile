-- ═══════════════════════════════════════════════════════════════════════════
-- 255: Full RLS for circles + profiles (bounded belonging, completion)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Completes the work explicitly deferred from migration 251 (feed_posts
-- community visibility scaffold). That migration scoped to feed_posts
-- only because the cascade risk on profiles (queried by ~150 screens
-- across the app) was significant and the dev DB couldn't surface real
-- breakage with only 11 profiles + 77 community memberships.
--
-- User opted to ship the full version now with eyes open to the
-- breakage risk:
--   • Marketplace provider lists may render fewer rows when the elder/
--     provider isn't a co-community member.
--   • Dream feed authors / notification senders / trip hosts who aren't
--     co-community members will appear as "Unknown member" or similar.
--   • Member search across communities won't return cross-community
--     hits.
--   • Any screen that fetches a profile by id without checking
--     community membership will get a NULL result.
--
-- Mitigation plan (post-apply):
--   • Spot-check the live app after migration applies.
--   • For each screen that depends on cross-community profile reads,
--     either (a) move the query through a SECURITY DEFINER RPC that
--     bypasses RLS for legitimate cross-community needs, or (b) accept
--     the visibility cut as the new product behavior.
--
-- Spec deviations (verified before applying):
--   • Registry insert wrong table (recurring bug). Corrected to
--     supabase_migrations.schema_migrations.
--   • `circles_browse_select` is still on circles (NOT dropped by
--     migration 251 — only feed_posts policies were touched there).
--     The DROP IF EXISTS handles it cleanly.
--   • `circle_members.status` values verified: pending/active/paused/
--     exited/removed. Spec's IN ('active','pending','paused') is the
--     right "currently a participant" filter.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Drop the existing broad SELECT policies.
--    profiles_select was USING (true) — world-readable.
--    circles_browse_select was status NOT IN ('dissolved','archived','closed')
--    — visible to all authenticated users.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS circles_browse_select ON circles;
DROP POLICY IF EXISTS profiles_select ON profiles;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. circles SELECT — visible if any of:
--      a. caller created the circle (always sees own)
--      b. caller is an active member of the circle's community
--      c. caller is a participant in the circle (active / pending / paused)
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS circles_visibility_select ON circles;
CREATE POLICY circles_visibility_select ON circles FOR SELECT
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM community_memberships cm
    WHERE cm.community_id = circles.community_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM circle_members cm
    WHERE cm.circle_id = circles.id
      AND cm.user_id = auth.uid()
      AND cm.status IN ('active', 'pending', 'paused')
  )
);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. profiles SELECT — visible if any of:
--      a. caller is the profile (always sees own)
--      b. profile owner shares an active community with the caller
--      c. profile owner shares a current circle with the caller
--    Performance note: this policy fires on EVERY profile read across
--    the app. The two EXISTS subqueries are indexed (see #4 below) but
--    still add ~2 index lookups per row. Watch p95 query latency after
--    apply; if hot enough, consider materialising into a
--    profile_visibility view or moving cross-community reads to a
--    SECURITY DEFINER RPC.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS profiles_visibility_select ON profiles;
CREATE POLICY profiles_visibility_select ON profiles FOR SELECT
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM community_memberships cm
    WHERE cm.user_id = profiles.id
      AND cm.community_id IN (
        SELECT community_id FROM community_memberships
        WHERE user_id = auth.uid() AND status = 'active'
      )
      AND cm.status = 'active'
  )
  OR EXISTS (
    SELECT 1 FROM circle_members cm1
    JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
    WHERE cm1.user_id = profiles.id
      AND cm2.user_id = auth.uid()
      AND cm1.status IN ('active', 'pending', 'paused')
      AND cm2.status IN ('active', 'pending', 'paused')
  )
);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Indexes the policies depend on. IF NOT EXISTS keeps it idempotent;
--    most already exist from prior migrations.
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_circles_community_id           ON circles (community_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user_id         ON circle_members (user_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_circle_id       ON circle_members (circle_id);
CREATE INDEX IF NOT EXISTS idx_community_memberships_user_id  ON community_memberships (user_id);
CREATE INDEX IF NOT EXISTS idx_community_memberships_community_id ON community_memberships (community_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '255',
  'full_rls_circles_profiles',
  ARRAY['-- 255: full_rls_circles_profiles']
)
ON CONFLICT (version) DO NOTHING;
