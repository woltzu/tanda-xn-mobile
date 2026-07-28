-- ═══════════════════════════════════════════════════════════════════════════
-- 388_profile_visibility.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 40 implementation — profile visibility toggles, access log, admin
-- privileged read, and communities category backfill.
--
-- Investigation findings (verified 2026-07-28):
--   * profiles_visibility_select RLS already gates SELECT to self OR
--     shared-community OR shared-circle. Not touched.
--   * get_profile_view(p_target_id) RPC already tiers most fields
--     (anon → auth → shared-community → elder → self). Extended below to
--     add community-list visibility with per-category toggles.
--   * XnScore stays SELF-ONLY (stricter than Doc 40 §4's "shared circle +
--     invite context" — user decision to keep the tighter setting).
--   * communities.metadata.category is NOT populated today. Backfilled
--     here for the 5 mapped community_types; 'general' left NULL for
--     manual admin classification per Doc 40 §5.3.
--   * community_type/type column duplication in communities is real tech
--     debt but deferred — not Doc 40 scope.
--
-- Additions:
--   1. profile_visibility_prefs — per-user category toggles.
--   2. profile_access_log — privileged-read audit log.
--   3. log_privileged_profile_read RPC — admin-gated, log-only.
--   4. get_admin_profile_read RPC — admin-gated combined read + log
--      (single call so a partial completion can't log-without-read or
--      read-without-log).
--   5. get_profile_view rewrite — adds visible_communities array applying
--      the target's category toggles for viewers who don't share a
--      circle/community. Self / shared-community / shared-circle viewers
--      always see the full community list (Doc 40 §5.2 rule).
--   6. Communities category backfill — deterministic mapping.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. profile_visibility_prefs ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_visibility_prefs (
  user_id                       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  communities_geographic        BOOLEAN NOT NULL DEFAULT TRUE,
  communities_professional      BOOLEAN NOT NULL DEFAULT TRUE,
  communities_life_stage        BOOLEAN NOT NULL DEFAULT FALSE,
  communities_faith_religion    BOOLEAN NOT NULL DEFAULT FALSE,
  communities_identity_health   BOOLEAN NOT NULL DEFAULT FALSE,
  show_vouches_given            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profile_visibility_prefs ENABLE ROW LEVEL SECURITY;

-- Own row: full R/W. Missing row = defaults implied by column defaults.
DROP POLICY IF EXISTS pvp_own_select ON public.profile_visibility_prefs;
CREATE POLICY pvp_own_select ON public.profile_visibility_prefs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS pvp_own_insert ON public.profile_visibility_prefs;
CREATE POLICY pvp_own_insert ON public.profile_visibility_prefs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS pvp_own_update ON public.profile_visibility_prefs;
CREATE POLICY pvp_own_update ON public.profile_visibility_prefs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS pvp_service ON public.profile_visibility_prefs;
CREATE POLICY pvp_service ON public.profile_visibility_prefs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 2. profile_access_log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_access_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  accessed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason_code    TEXT NOT NULL
                   CHECK (reason_code IN ('kyc_review','dispute_escalation','payout_investigation','admin_audit','other')),
  justification  TEXT,
  accessed_fields TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_profile_access_log_target
  ON public.profile_access_log(target_user_id, accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_access_log_viewer
  ON public.profile_access_log(viewer_id, accessed_at DESC);

ALTER TABLE public.profile_access_log ENABLE ROW LEVEL SECURITY;

-- Target sees their own access log (Doc 40 §8).
DROP POLICY IF EXISTS pal_target_read ON public.profile_access_log;
CREATE POLICY pal_target_read ON public.profile_access_log
  FOR SELECT TO authenticated
  USING (target_user_id = auth.uid());

-- Admins see everything.
DROP POLICY IF EXISTS pal_admin_read ON public.profile_access_log;
CREATE POLICY pal_admin_read ON public.profile_access_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- No client INSERT — flows through the RPCs below.
DROP POLICY IF EXISTS pal_service ON public.profile_access_log;
CREATE POLICY pal_service ON public.profile_access_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── 3. log_privileged_profile_read RPC ──────────────────────────────────
-- Log-only. For flows that read data through a different path (e.g., an
-- admin drilling in the admin dispute console reads fields the RPC
-- surfaces via `get_admin_dispute_detail`, then calls this to record
-- the access). Also usable standalone by legacy paths.
CREATE OR REPLACE FUNCTION public.log_privileged_profile_read(
  p_target_user_id UUID,
  p_reason_code    TEXT,
  p_justification  TEXT DEFAULT NULL,
  p_fields         TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin      UUID;
  v_admin_role TEXT;
  v_log_id     UUID;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role NOT IN ('super_admin','admin') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  IF p_reason_code NOT IN ('kyc_review','dispute_escalation','payout_investigation','admin_audit','other') THEN
    RAISE EXCEPTION 'invalid_reason_code';
  END IF;
  IF p_reason_code = 'other' AND (p_justification IS NULL OR length(trim(p_justification)) < 20) THEN
    RAISE EXCEPTION 'justification_required_for_other';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  INSERT INTO public.profile_access_log (
    viewer_id, target_user_id, reason_code, justification, accessed_fields
  )
  VALUES (v_admin, p_target_user_id, p_reason_code, p_justification, p_fields)
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object(
    'success',  TRUE,
    'log_id',   v_log_id,
    'viewer',   v_admin,
    'target',   p_target_user_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_privileged_profile_read(UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.log_privileged_profile_read(UUID, TEXT, TEXT, TEXT[]) TO authenticated;

-- ─── 4. get_admin_profile_read RPC ───────────────────────────────────────
-- Combined read + log. Single call so a partial completion cannot
-- log-without-read or read-without-log. Returns the sensitive fields
-- + writes the access log row atomically.
--
-- Reasonable field allowlist to prevent silly requests like
-- ['stripe_connect_account_id','password'] — validated against a
-- known-safe set. Anything outside the allowlist is silently dropped
-- from the response.
CREATE OR REPLACE FUNCTION public.get_admin_profile_read(
  p_target_user_id UUID,
  p_reason_code    TEXT,
  p_justification  TEXT DEFAULT NULL,
  p_fields         TEXT[] DEFAULT ARRAY['email','phone']::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin       UUID;
  v_admin_role  TEXT;
  v_target      RECORD;
  v_result      JSONB := '{}'::jsonb;
  v_allowlist   TEXT[] := ARRAY[
    'email','phone','date_of_birth','address','city','country',
    'country_of_origin','kyc_level','kyc_status','full_name','display_name'
  ];
  v_used_fields TEXT[];
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role NOT IN ('super_admin','admin') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;
  IF p_reason_code NOT IN ('kyc_review','dispute_escalation','payout_investigation','admin_audit','other') THEN
    RAISE EXCEPTION 'invalid_reason_code';
  END IF;
  IF p_reason_code = 'other' AND (p_justification IS NULL OR length(trim(p_justification)) < 20) THEN
    RAISE EXCEPTION 'justification_required_for_other';
  END IF;

  SELECT * INTO v_target FROM public.profiles WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  -- Intersect requested fields with allowlist. Silent drop for anything
  -- outside — admins never see an error, but the response only carries
  -- what they were allowed to ask for.
  SELECT ARRAY_AGG(f)
    INTO v_used_fields
    FROM unnest(COALESCE(p_fields, ARRAY[]::TEXT[])) AS f
   WHERE f = ANY(v_allowlist);

  -- Build the response payload. jsonb_object_agg keeps only the
  -- requested-and-allowed fields; unrequested fields never surface.
  IF 'email'              = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('email', v_target.email);              END IF;
  IF 'phone'              = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('phone', v_target.phone);              END IF;
  IF 'date_of_birth'      = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('date_of_birth', v_target.date_of_birth); END IF;
  IF 'address'            = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('address', v_target.address);          END IF;
  IF 'city'               = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('city', v_target.city);                END IF;
  IF 'country'            = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('country', v_target.country);          END IF;
  IF 'country_of_origin'  = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('country_of_origin', v_target.country_of_origin); END IF;
  IF 'kyc_level'          = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('kyc_level', v_target.kyc_level);      END IF;
  IF 'kyc_status'         = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('kyc_status', v_target.kyc_status);    END IF;
  IF 'full_name'          = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('full_name', v_target.full_name);      END IF;
  IF 'display_name'       = ANY(v_used_fields) THEN v_result := v_result || jsonb_build_object('display_name', v_target.display_name); END IF;

  -- Log the access (using the same reason + justification the caller
  -- passed) BEFORE returning the payload. If the INSERT fails, the read
  -- fails too — no log, no data.
  INSERT INTO public.profile_access_log (
    viewer_id, target_user_id, reason_code, justification, accessed_fields
  )
  VALUES (v_admin, p_target_user_id, p_reason_code, p_justification, v_used_fields);

  RETURN jsonb_build_object(
    'success',        TRUE,
    'target_user_id', p_target_user_id,
    'fields',         v_result,
    'accessed_at',    NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_profile_read(UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_profile_read(UUID, TEXT, TEXT, TEXT[]) TO authenticated;

-- ─── 5. get_profile_view rewrite — add visible_communities ───────────────
-- Byte-identical to the pre-mig-388 body EXCEPT for a new
-- visible_communities array field that applies the target's per-category
-- toggles for viewers who don't share a circle/community (Doc 40 §5.2).
--
-- Category resolution: reads communities.metadata->>'category' (backfilled
-- in step 6). Falls back to community_type-based mapping for rows that
-- somehow slipped past the backfill.
CREATE OR REPLACE FUNCTION public.get_profile_view(p_target_id uuid)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_viewer_id        UUID := auth.uid();
  v_is_self          BOOLEAN;
  v_is_elder         BOOLEAN;
  v_shares_community BOOLEAN;
  v_shares_circle    BOOLEAN;
  v_prefs            RECORD;
  v_communities      JSONB;
  v_result           JSONB;
BEGIN
  -- ANON branch — bare-minimum public info. NO communities either (a
  -- link-preview doesn't need them).
  IF v_viewer_id IS NULL THEN
    SELECT jsonb_build_object(
      'id',           p_target_id,
      'display_name', display_name,
      'avatar_url',   avatar_url
    ) INTO v_result
    FROM profiles WHERE id = p_target_id;
    RETURN COALESCE(v_result, '{}'::jsonb);
  END IF;

  v_is_self := (v_viewer_id = p_target_id);

  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_viewer_id AND role LIKE 'elder%'
  ) INTO v_is_elder;

  -- Shared community (any active membership).
  SELECT EXISTS (
    SELECT 1
    FROM community_memberships cm1
    JOIN community_memberships cm2
      ON cm1.community_id = cm2.community_id
    WHERE cm1.user_id = p_target_id
      AND cm2.user_id = v_viewer_id
      AND cm1.status  = 'active'
      AND cm2.status  = 'active'
  ) INTO v_shares_community;

  -- Shared circle (matches the existing RLS gate — active/pending/paused).
  SELECT EXISTS (
    SELECT 1
    FROM circle_members cm1
    JOIN circle_members cm2 ON cm1.circle_id = cm2.circle_id
    WHERE cm1.user_id = p_target_id
      AND cm2.user_id = v_viewer_id
      AND cm1.status = ANY(ARRAY['active','pending','paused'])
      AND cm2.status = ANY(ARRAY['active','pending','paused'])
  ) INTO v_shares_circle;

  -- Load target's visibility prefs. Missing row = column defaults imply
  -- geographic + professional + show_vouches ON, others OFF.
  SELECT * INTO v_prefs FROM profile_visibility_prefs WHERE user_id = p_target_id;

  -- Communities visible to this viewer:
  --   * Self / shared-community / shared-circle → all communities (Doc 40 §5.2).
  --   * Otherwise → only those in categories the target has toggled ON.
  SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY c.name), '[]'::jsonb)
    INTO v_communities
    FROM (
      SELECT
        co.id,
        co.name,
        co.icon,
        co.community_type,
        COALESCE(co.metadata->>'category',
          CASE co.community_type
            WHEN 'local'        THEN 'geographic'
            WHEN 'diaspora'     THEN 'geographic'
            WHEN 'professional' THEN 'professional'
            WHEN 'school'       THEN 'professional'
            WHEN 'faith'        THEN 'faith'
            WHEN 'religious'    THEN 'faith'
            ELSE NULL
          END
        ) AS category
      FROM community_memberships cm
      JOIN communities co ON co.id = cm.community_id
      WHERE cm.user_id = p_target_id
        AND cm.status  = 'active'
        AND (
          v_is_self OR v_shares_community OR v_shares_circle
          OR (
            -- Category-gated visibility for unrelated viewers.
            COALESCE(co.metadata->>'category',
              CASE co.community_type
                WHEN 'local'        THEN 'geographic'
                WHEN 'diaspora'     THEN 'geographic'
                WHEN 'professional' THEN 'professional'
                WHEN 'school'       THEN 'professional'
                WHEN 'faith'        THEN 'faith'
                WHEN 'religious'    THEN 'faith'
                ELSE NULL
              END
            ) IN (
              SELECT k FROM (VALUES
                ('geographic',      COALESCE(v_prefs.communities_geographic,      TRUE)),
                ('professional',    COALESCE(v_prefs.communities_professional,    TRUE)),
                ('life_stage',      COALESCE(v_prefs.communities_life_stage,      FALSE)),
                ('faith',           COALESCE(v_prefs.communities_faith_religion,  FALSE)),
                ('identity_health', COALESCE(v_prefs.communities_identity_health, FALSE))
              ) AS toggle(k, v)
              WHERE toggle.v = TRUE
            )
          )
        )
    ) c;

  SELECT jsonb_build_object(
    -- Always-visible (any authenticated viewer)
    'id',           p_target_id,
    'display_name', display_name,
    'full_name',    full_name,
    'avatar_url',   avatar_url,
    'role',         role,
    'tier_badge',   (SELECT current_tier FROM member_tier_status WHERE user_id = p_target_id),
    'visible_communities', v_communities,

    -- Co-community or self
    'circles_completed', CASE
      WHEN v_is_self OR v_shares_community THEN
        (SELECT COALESCE(SUM(circles_completed), 0)
         FROM community_memberships
         WHERE user_id = p_target_id AND status = 'active')
      ELSE NULL
    END,
    'honor_badge', CASE
      WHEN v_is_self OR v_shares_community THEN honor_score
      ELSE NULL
    END,

    -- Self-only (PII + financial + raw signals). XnScore stays SELF-ONLY
    -- per user's Doc 40 decision to keep stricter-than-Doc-40 defaults.
    -- Admin access to email/phone flows through get_admin_profile_read
    -- (which also writes profile_access_log).
    'email',                  CASE WHEN v_is_self THEN email ELSE NULL END,
    'phone',                  CASE WHEN v_is_self THEN phone ELSE NULL END,
    'wallet_balance_cents',   CASE WHEN v_is_self THEN
      (SELECT total_balance_cents FROM user_wallets WHERE user_id = p_target_id)
    ELSE NULL END,
    'goals_total_target_cents', CASE WHEN v_is_self THEN
      (SELECT COALESCE(SUM(target_amount_cents), 0)::bigint
       FROM user_savings_goals
       WHERE user_id = p_target_id)
    ELSE NULL END,
    'xn_score',     CASE WHEN v_is_self THEN xn_score ELSE NULL END,
    'stress_score', CASE WHEN v_is_self THEN
      (SELECT stress_score
       FROM member_stress_scores
       WHERE member_id = p_target_id
       ORDER BY score_date DESC, created_at DESC
       LIMIT 1)
    ELSE NULL END,
    'mood_score', CASE WHEN v_is_self THEN
      (SELECT composite_mood_score
       FROM member_mood_snapshots
       WHERE member_id = p_target_id
       ORDER BY snapshot_date DESC, created_at DESC
       LIMIT 1)
    ELSE NULL END,

    -- Elder + co-community (governance/exposure data)
    'max_exposure_cents', CASE WHEN v_is_elder AND v_shares_community THEN
      (SELECT max_exposure_cents FROM member_tier_status WHERE user_id = p_target_id)
    ELSE NULL END,
    'demotion_reason', CASE WHEN v_is_elder AND v_shares_community THEN
      (SELECT demotion_reason FROM member_tier_status WHERE user_id = p_target_id)
    ELSE NULL END
  ) INTO v_result
  FROM profiles
  WHERE id = p_target_id;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

-- ─── 6. Communities category backfill ────────────────────────────────────
-- Deterministic mapping per Doc 40 §5.3. 'general' left NULL — needs
-- admin classification per Doc 40 §5.3. Skips rows where metadata.category
-- was somehow already set (idempotent replay-safe).
UPDATE public.communities
   SET metadata = COALESCE(metadata, '{}'::jsonb)
                  || jsonb_build_object('category',
                       CASE community_type
                         WHEN 'local'        THEN 'geographic'
                         WHEN 'diaspora'     THEN 'geographic'
                         WHEN 'professional' THEN 'professional'
                         WHEN 'school'       THEN 'professional'
                         WHEN 'faith'        THEN 'faith'
                         WHEN 'religious'    THEN 'faith'
                         ELSE NULL
                       END)
 WHERE (metadata->>'category') IS NULL
   AND community_type IN ('local','diaspora','professional','school','faith','religious');

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '388',
  'profile_visibility',
  ARRAY['-- 388: Doc 40 — profile_visibility_prefs + profile_access_log + log_privileged_profile_read + get_admin_profile_read + get_profile_view rewrite with visible_communities + communities.metadata.category backfill.']
)
ON CONFLICT (version) DO NOTHING;
