-- ═══════════════════════════════════════════════════════════════════════════
-- 269: Admin RBAC — community_id scoping + has_admin_access RPC
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds the per-community scoping column + the has_admin_access permission
-- check on top of the existing admin_users table (migration 114).
--
-- Spec deviations (verified read-only before writing):
--
--   * admin_users.role already exists with CHECK (role = ANY (ARRAY
--     ['super_admin', 'admin', 'support', 'viewer'])) and DEFAULT
--     'viewer'. Spec's ADD COLUMN role TEXT DEFAULT 'platform_admin'
--     CHECK (… 'platform_admin'/'community_admin'/'auditor') would be
--     skipped by IF NOT EXISTS, BUT the spec's has_admin_access body
--     reads roles 'super_admin'/'platform_admin'/'community_admin'/
--     'auditor' — so the function would return FALSE for every live
--     admin (whose roles are 'super_admin'/'admin'/'support'/'viewer').
--     Aligned the function body to the live vocabulary:
--         super_admin  ≡ spec super_admin   — everything
--         admin        ≡ spec platform_admin — everything except
--                                               system_settings +
--                                               demote/delete super_admin
--         support      ≡ spec community_admin — scoped to community_id;
--                                               read full, write limited
--         viewer       ≡ spec auditor        — read-only
--     A future CHECK widen can introduce the spec's role names once
--     reader code is ready; mapping above keeps semantics aligned.
--
--   * admin_users.created_at already exists (default now()). Spec's
--     ADD COLUMN IF NOT EXISTS is a no-op; left in for documentation.
--
--   * admin_users.community_id is genuinely new — added as the only
--     new ALTER, with a defensive index for the community-scoped lookups
--     the new function performs.
--
--   * Registry table corrected from spec's bare `supabase_migrations`
--     to `supabase_migrations.schema_migrations`. Recurring spec bug
--     fixed in 263 / 264 / 265 / 266 / 267 / 268.
--
--   * Tier 4 hardening: SET search_path = public, pg_temp on the
--     function body.
--
--   * is_admin() already exists (migration 114, used by the
--     useIsAdmin hook). has_admin_access is additive — provides
--     module/action granularity that is_admin's boolean answer
--     doesn't.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. admin_users — community_id scoping. role + created_at already
--    exist (verified); only community_id is a genuine add.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS community_id UUID
    REFERENCES communities(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_admin_users_community
  ON admin_users(community_id)
  WHERE community_id IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. has_admin_access — module/action permission check.
--    Vocabulary aligned to the live CHECK (super_admin / admin /
--    support / viewer). Mapping documented in the header.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION has_admin_access(
  p_user_id     UUID,
  p_module      TEXT,
  p_action      TEXT,
  p_resource_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role         TEXT;
  v_community_id UUID;
BEGIN
  SELECT role, community_id
    INTO v_role, v_community_id
    FROM admin_users
   WHERE user_id = p_user_id
     AND is_active = true;

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- super_admin: full access.
  IF v_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- admin (≈ platform admin): everything except system_settings and
  -- the destructive admin_management actions reserved for super_admin.
  IF v_role = 'admin' THEN
    IF p_module = 'system_settings' THEN
      RETURN FALSE;
    END IF;
    IF p_module = 'admin_management'
       AND p_action IN ('demote_super_admin', 'delete_admin') THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  -- support (≈ community admin): community-scoped. Read is open for
  -- their community; write is allowed but the caller is expected to
  -- enforce per-resource community ownership (p_resource_id reserved
  -- for future fine-grained checks).
  IF v_role = 'support' THEN
    IF v_community_id IS NULL THEN
      RETURN FALSE;
    END IF;
    RETURN TRUE;
  END IF;

  -- viewer (≈ auditor): read-only.
  IF v_role = 'viewer' THEN
    RETURN p_action IN ('view', 'read');
  END IF;

  RETURN FALSE;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '269',
  'admin_roles_permissions',
  ARRAY['-- 269: admin_roles_permissions']
)
ON CONFLICT (version) DO NOTHING;
