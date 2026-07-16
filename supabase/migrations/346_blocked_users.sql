-- ═══════════════════════════════════════════════════════════════════════════
-- 346_blocked_users.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phase 3 of the Community redesign: silent mutual blocking.
--
-- Design:
--   * User A blocks user B → neither sees the other's content anywhere
--     (feed posts, feed comments).
--   * The blocked user is not notified (silent).
--   * Reversible via DELETE own row.
--
-- Enforcement strategy: server-side via RLS on the tables that surface
-- other users' content. Adding one AND NOT EXISTS clause to
-- feed_posts_visibility_select (mig 251) and rewriting the
-- feed_comments read policy filters every existing and future SELECT
-- from the app without touching a single client query. Client-side
-- filters would need to remember to apply the check on every new
-- feed surface — server-side is the right choice.
--
-- Not in scope for this migration:
--   * Blocking direct messages (community_direct_messages) — will
--     apply the same NOT EXISTS pattern in a future migration once
--     the DM surface ships user-visibility (right now the DM RLS is
--     recipient/sender-only, which is already private enough).
--   * Muting (weaker than blocking; user keeps seeing muted user's
--     content but doesn't get notifications). Separate feature.
--   * Community member lists / circle member lists — those tables
--     are join-heavy and RLS-filtering member visibility would be a
--     larger refactor. For MVP, blocking hides content; the blocked
--     user still appears in the raw member roster (would be a
--     visible-but-content-hidden state, matching Twitter's early
--     behavior).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.blocked_users (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id  UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id  UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason      TEXT,        -- optional; user can jot a note to themselves
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)  -- can't block yourself
);

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker
  ON public.blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked
  ON public.blocked_users (blocked_id);

-- ─── 2. RLS on blocked_users itself ────────────────────────────────────

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- Only the blocker can SEE their own block rows. The blocked user
-- does not know they've been blocked (silent).
DROP POLICY IF EXISTS blocked_users_select_own ON public.blocked_users;
CREATE POLICY blocked_users_select_own ON public.blocked_users
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS blocked_users_insert_own ON public.blocked_users;
CREATE POLICY blocked_users_insert_own ON public.blocked_users
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid());

DROP POLICY IF EXISTS blocked_users_delete_own ON public.blocked_users;
CREATE POLICY blocked_users_delete_own ON public.blocked_users
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

DROP POLICY IF EXISTS blocked_users_service_all ON public.blocked_users;
CREATE POLICY blocked_users_service_all ON public.blocked_users
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ─── 3. Helper — is_user_blocked(a, b) ────────────────────────────────
-- Symmetric block check: TRUE if EITHER party has blocked the other.
-- SECURITY DEFINER + STABLE (no side effects, same output for same
-- inputs within a statement) so the query planner can inline.

CREATE OR REPLACE FUNCTION public.is_user_blocked(
  p_user_id   UUID,
  p_target_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
     WHERE (blocker_id = p_user_id AND blocked_id = p_target_id)
        OR (blocker_id = p_target_id AND blocked_id = p_user_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_user_blocked(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_user_blocked(UUID, UUID) TO authenticated;

-- ─── 4. Extend feed_posts_visibility_select ────────────────────────────
-- Prior policy (mig 251):
--   community_id = Public sentinel
--   OR user_id = auth.uid()
--   OR EXISTS(community_memberships row matching)
--
-- New policy: same three clauses AND a "not blocked in either direction"
-- clause via the SECURITY DEFINER helper. The helper is required — an
-- inline EXISTS against blocked_users runs under the caller's RLS, and
-- blocked_users_select_own only lets the caller see rows where they are
-- the blocker. That means Franck's authenticated session cannot see the
-- row where Marcus blocked Franck, so the inline check would falsely
-- return "not blocked" and Marcus's posts would leak through to Franck.
-- is_user_blocked() bypasses RLS on blocked_users so the check is
-- symmetric.

DROP POLICY IF EXISTS feed_posts_visibility_select ON public.feed_posts;
CREATE POLICY feed_posts_visibility_select ON public.feed_posts
  FOR SELECT USING (
    (
      community_id = '00000000-0000-0000-0000-000000000000'::uuid
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.community_memberships cm
         WHERE cm.community_id = feed_posts.community_id
           AND cm.user_id      = auth.uid()
           AND cm.status       = 'active'
      )
    )
    AND NOT public.is_user_blocked(auth.uid(), feed_posts.user_id)
  );

-- ─── 5. Rewrite feed_comments read policy ──────────────────────────────
-- Prior policy: auth.role() = 'authenticated' — every authenticated
-- caller sees every comment. New: same, minus comments from a user
-- with a block-either-way relationship (helper for the same reason as
-- above).

DROP POLICY IF EXISTS read_comments ON public.feed_comments;
CREATE POLICY read_comments ON public.feed_comments
  FOR SELECT TO authenticated USING (
    NOT public.is_user_blocked(auth.uid(), feed_comments.user_id)
  );

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '346',
  'blocked_users',
  ARRAY['-- 346: blocked_users table + RLS + is_user_blocked helper + extended feed_posts/feed_comments RLS to filter blocks']
)
ON CONFLICT (version) DO NOTHING;
