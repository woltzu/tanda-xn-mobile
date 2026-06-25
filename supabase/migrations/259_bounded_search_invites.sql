-- ═══════════════════════════════════════════════════════════════════════════
-- 259: Bounded search + invite gating
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Two RPCs that enforce the bounded-belonging principle for the discovery
-- and onboarding paths:
--   1. search_members(query, community_id?, limit) — only returns profiles
--      that share a community OR a current circle with the caller. Falls
--      back to NULL on unauthenticated.
--   2. can_invite(inviter, target, circle) — pre-flight that the existing
--      trigger gate (migration 257) backstops: blocks critical inviters,
--      blocks invites to non-community-member circles, blocks dupes.
--
-- Spec deviations (verified before writing):
--   • Registry insert wrong table (recurring). Corrected to
--     supabase_migrations.schema_migrations.
--   • Spec uses similarity() but pg_trgm IS NOT INSTALLED in this project
--     (verified). Added CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA
--     extensions and qualified calls as extensions.similarity() so the
--     Tier-4-hardened search_path = public, pg_temp stays narrow.
--   • Added COALESCE around display_name/full_name in similarity() calls
--     — both columns can be NULL and similarity(NULL, …) returns NULL,
--     causing the entire GREATEST() to be NULL and the row to sort to
--     the bottom (correct, but worth being explicit).
--   • Trigram GIN indexes on display_name + full_name added — without
--     them similarity() seq-scans profiles, which is fine at 11 rows but
--     would not survive at production volume.
--   • can_invite check on circle membership uses status filter to match
--     migrations 255 + 257.
--   • Tier 4 hardening (SET search_path) preserved on both functions.
--
-- Belt + suspenders: search_members is a discovery filter; the existing
-- migration 255 RLS on profiles also limits cross-community reads. The
-- RPC layers the explicit community/circle membership join on top so the
-- result set matches the user's mental model ("people I can actually
-- invite"). can_invite is mirrored by migration 257's
-- tr_block_critical_invitation trigger — this RPC is for UX preview,
-- the trigger is the enforcement.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 0. Ensure pg_trgm is available in the extensions schema.
-- ───────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- ───────────────────────────────────────────────────────────────────────────
-- 1. search_members — bounded discovery. Returns members the caller can
--    legitimately see (co-community OR co-circle). Excludes the caller.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_members(
  p_query        TEXT,
  p_community_id UUID DEFAULT NULL,
  p_limit        INT  DEFAULT 20
)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  full_name    TEXT,
  avatar_url   TEXT,
  tier_badge   TEXT,
  similarity   REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_viewer_id UUID := auth.uid();
BEGIN
  -- Anon callers get nothing. The RPC layer would also block this via
  -- standard auth, but explicit beats implicit.
  IF v_viewer_id IS NULL OR p_query IS NULL OR length(trim(p_query)) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    p.id            AS user_id,
    p.display_name,
    p.full_name,
    p.avatar_url,
    mts.current_tier AS tier_badge,
    GREATEST(
      extensions.similarity(COALESCE(p.display_name, ''), p_query),
      extensions.similarity(COALESCE(p.full_name,    ''), p_query)
    ) AS similarity
  FROM profiles p
  LEFT JOIN member_tier_status mts ON mts.user_id = p.id
  WHERE p.id <> v_viewer_id
    AND (
      -- Specific community filter: target must be an active member.
      (p_community_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM community_memberships cm
        WHERE cm.user_id      = p.id
          AND cm.community_id = p_community_id
          AND cm.status       = 'active'
      ))
      -- No filter: target shares any community with the caller (active both sides).
      OR (p_community_id IS NULL AND EXISTS (
        SELECT 1
        FROM community_memberships cm1
        JOIN community_memberships cm2
          ON cm1.community_id = cm2.community_id
        WHERE cm1.user_id = p.id
          AND cm2.user_id = v_viewer_id
          AND cm1.status  = 'active'
          AND cm2.status  = 'active'
      ))
      -- Co-circle fallback: works even when no community overlap (e.g. cross-
      -- community circles in the rare case).
      OR EXISTS (
        SELECT 1
        FROM circle_members cm1
        JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
        WHERE cm1.user_id = p.id
          AND cm2.user_id = v_viewer_id
          AND cm1.status IN ('active', 'pending', 'paused')
          AND cm2.status IN ('active', 'pending', 'paused')
      )
    )
    AND (
      p.display_name ILIKE '%' || p_query || '%'
      OR p.full_name ILIKE '%' || p_query || '%'
    )
  ORDER BY similarity DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. can_invite — pre-flight for the invite UI. Backstopped by migration
--    257's tr_block_critical_invitation trigger; this RPC is UX preview.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION can_invite(
  p_inviter_id UUID,
  p_target_id  UUID,
  p_circle_id  UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inviter_tier TEXT;
BEGIN
  IF p_inviter_id IS NULL OR p_target_id IS NULL OR p_circle_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Can't invite yourself.
  IF p_inviter_id = p_target_id THEN
    RETURN FALSE;
  END IF;

  -- Critical inviter is blocked (mirrors migration 257 trigger).
  SELECT current_tier INTO v_inviter_tier
  FROM member_tier_status
  WHERE user_id = p_inviter_id;
  IF v_inviter_tier = 'critical' THEN
    RETURN FALSE;
  END IF;

  -- Inviter must be an active member of the circle's community.
  IF NOT EXISTS (
    SELECT 1
    FROM circles c
    JOIN community_memberships cm
      ON cm.community_id = c.community_id
    WHERE c.id        = p_circle_id
      AND cm.user_id  = p_inviter_id
      AND cm.status   = 'active'
  ) THEN
    RETURN FALSE;
  END IF;

  -- Target must not already be a participant of this circle (any status).
  IF EXISTS (
    SELECT 1 FROM circle_members
    WHERE circle_id = p_circle_id AND user_id = p_target_id
  ) THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Trigram indexes for search_members. Without these, similarity()
--    sequentially scans profiles — fine at small scale, not at production.
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_display_name_trgm
  ON profiles USING gin (display_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON profiles USING gin (full_name extensions.gin_trgm_ops);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '259',
  'bounded_search_invites',
  ARRAY['-- 259: bounded_search_invites']
)
ON CONFLICT (version) DO NOTHING;
