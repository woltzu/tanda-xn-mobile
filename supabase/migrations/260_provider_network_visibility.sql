-- ═══════════════════════════════════════════════════════════════════════════
-- 260: Provider network visibility — community-scoped marketplace
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bounds provider visibility to the user's communities. Pieces:
--   1. providers.community_id + providers.is_platform_wide columns
--   2. Backfill community_id from the owner's oldest active membership
--   3. providers_visibility_select policy (replaces providers_public_select)
--   4. get_community_providers(community_id, query?, limit) RPC
--   5. is_provider_accessible(provider_id) RPC
--
-- Spec deviations (verified before writing):
--   • Registry insert wrong table (recurring). Corrected.
--   • Spec assumes a column named `created_by` — the real column is
--     `user_id` (verified via information_schema). Backfill + ownership
--     checks updated accordingly.
--   • Spec's RPC references columns that DO NOT EXIST:
--       - name          → real column is `business_name`
--       - review_count  → real column is `rating_count`
--       - avatar_url    → NOT IN providers TABLE
--       - tags          → NOT IN providers TABLE
--     RPC signature updated: business_name TEXT, rating_count INT;
--     avatar_url + tags dropped entirely. Avatar would have to come
--     from a join to profiles(user_id).avatar_url — deferred.
--   • Spec drops `providers_select_all` policy. The actual current
--     policy is `providers_public_select` (verified via pg_policy):
--       (verified_status = 'verified' AND is_active = true)
--       OR user_id = auth.uid()
--       OR admin
--     The replacement preserves SELF + ADMIN coverage so providers
--     can still see/edit their own row and admins can still moderate.
--   • Spec's RPC body doesn't filter is_active=true or verification_
--     status. Added — the marketplace shouldn't surface unverified or
--     disabled providers regardless of community scope.
--   • Tier 4 hardening (SET search_path) preserved on both RPCs.
--   • get_community_providers handles NULL/blank queries by skipping
--     similarity scoring (avoids extensions.similarity(x, NULL) → NULL).
--
-- marketplace_providers (capital v0-era table) is intentionally NOT
-- touched. It is a separate legacy table with minimal use (verified to
-- have no real schema beyond `id`). The live marketplace surface uses
-- `providers`.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Columns. IF NOT EXISTS keeps re-apply safe.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE providers
  ADD COLUMN IF NOT EXISTS community_id     UUID REFERENCES communities(id),
  ADD COLUMN IF NOT EXISTS is_platform_wide BOOLEAN NOT NULL DEFAULT false;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Backfill. Owner's oldest active community membership.
--    Spec used providers.created_by — the real column is user_id.
-- ───────────────────────────────────────────────────────────────────────────
UPDATE providers p
SET community_id = (
  SELECT cm.community_id
  FROM community_memberships cm
  WHERE cm.user_id = p.user_id AND cm.status = 'active'
  ORDER BY cm.created_at ASC NULLS LAST
  LIMIT 1
)
WHERE p.community_id IS NULL
  AND p.is_platform_wide = false;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Indexes. is_platform_wide gets a partial index (most rows = false).
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_providers_community_id
  ON providers (community_id);
CREATE INDEX IF NOT EXISTS idx_providers_is_platform_wide
  ON providers (is_platform_wide) WHERE is_platform_wide = true;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Replace the SELECT policy. Preserves self + admin coverage so
--    providers can read their own row and admins keep moderation reach.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS providers_public_select   ON providers;
DROP POLICY IF EXISTS providers_select_all      ON providers;  -- spec name (no-op if absent)
DROP POLICY IF EXISTS providers_visibility_select ON providers;

CREATE POLICY providers_visibility_select ON providers FOR SELECT
USING (
  -- Self: a provider can always see their own row.
  user_id = auth.uid()
  -- Admin: keeps moderation reach.
  OR EXISTS (
    SELECT 1 FROM admin_users a
    WHERE a.user_id = auth.uid() AND a.is_active = true
  )
  -- Platform-wide providers are visible to everyone.
  OR is_platform_wide = true
  -- Legacy fallback for rows missing community_id post-backfill.
  -- Most should land in either community or platform-wide; this is
  -- the safety net so a NULL doesn't black-hole a provider.
  OR community_id IS NULL
  -- Bounded discovery: caller must be active in the provider's community.
  OR EXISTS (
    SELECT 1 FROM community_memberships cm
    WHERE cm.community_id = providers.community_id
      AND cm.user_id      = auth.uid()
      AND cm.status       = 'active'
  )
);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. get_community_providers(community_id, query?, limit) — marketplace
--    listing. Returns verified + active providers either platform-wide
--    or in the requested community. Optional trigram search.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_community_providers(
  p_community_id UUID,
  p_query        TEXT DEFAULT NULL,
  p_limit        INT  DEFAULT 20
)
RETURNS TABLE (
  provider_id   UUID,
  business_name TEXT,
  description   TEXT,
  rating_avg    NUMERIC,
  rating_count  INTEGER,
  similarity    REAL
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_query TEXT := NULLIF(trim(COALESCE(p_query, '')), '');
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.business_name,
    p.description,
    p.rating_avg,
    p.rating_count,
    CASE
      WHEN v_query IS NOT NULL THEN
        GREATEST(
          extensions.similarity(COALESCE(p.business_name, ''), v_query),
          extensions.similarity(COALESCE(p.description,   ''), v_query)
        )
      ELSE 1.0::real
    END AS similarity
  FROM providers p
  WHERE p.is_active = true
    AND p.verification_status = 'verified'
    AND (
      p.is_platform_wide = true
      OR p.community_id  = p_community_id
    )
    AND (
      v_query IS NULL
      OR p.business_name ILIKE '%' || v_query || '%'
      OR p.description   ILIKE '%' || v_query || '%'
    )
  ORDER BY similarity DESC NULLS LAST, p.rating_avg DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. is_provider_accessible(provider_id) — used by ProviderDetailScreen
--    to gate booking/contact actions before showing them.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_provider_accessible(p_provider_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_provider_id IS NULL OR auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM providers p
    WHERE p.id = p_provider_id
      AND (
        p.user_id = auth.uid()
        OR p.is_platform_wide = true
        OR EXISTS (
          SELECT 1 FROM community_memberships cm
          WHERE cm.community_id = p.community_id
            AND cm.user_id      = auth.uid()
            AND cm.status       = 'active'
        )
      )
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '260',
  'provider_network_visibility',
  ARRAY['-- 260: provider_network_visibility']
)
ON CONFLICT (version) DO NOTHING;
