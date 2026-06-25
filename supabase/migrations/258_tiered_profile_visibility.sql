-- ═══════════════════════════════════════════════════════════════════════════
-- 258: Tiered profile visibility — get_profile_view RPC
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Returns a per-viewer projection of a profile, hiding wallet/goal/raw-score
-- data from anyone except the user themselves. Three visibility scopes:
--   • SELF              — full PII + financial data
--   • CO-COMMUNITY      — public badge data (display_name, role, tier_badge,
--                         circles_completed, honor_badge)
--   • ELDER + CO-COMMUNITY — adds max_exposure_cents + demotion_reason
--   • ANON              — bare minimum (id, display_name, avatar_url) so
--                         public link previews still resolve, but no PII.
--
-- Spec deviations (verified before writing):
--   • Registry insert wrong table (recurring). Corrected.
--   • Spec references 4 columns that DO NOT EXIST on profiles:
--       - wallet_balance       → sourced from user_wallets.total_balance_cents
--       - goal_amount          → sourced from SUM(user_savings_goals.target_amount_cents)
--       - stress_score         → sourced from latest member_stress_scores.stress_score
--       - mood_score           → sourced from latest member_mood_snapshots.composite_mood_score
--     The Phase 2 architecture intentionally splits these out of profiles
--     (wallets, goals, stress, mood each have their own tables). Aggregating
--     here keeps the spec's one-call ergonomics without re-introducing the
--     dead columns.
--   • Spec's anon branch returned full_name + role — both are PII / sensitive.
--     Migration 255's profiles RLS would have blocked this entirely from a
--     direct query. Tightened the anon branch to id + display_name +
--     avatar_url only (no full_name, no role).
--   • Co-community check now requires status='active' on BOTH sides
--     (matches migration 255's profile-visibility policy). Spec omitted this
--     so a removed member would still be considered "shares community".
--   • Tier 4 hardening (SET search_path) — spec included it; preserved.
--   • Field names use *_cents suffix where the underlying column is in cents
--     (wallet_balance_cents, goals_total_target_cents) so the client doesn't
--     accidentally render cents as dollars.
--
-- Note on stress/mood: migration 256 hid these scores from elders via
-- projection. This RPC returns them ONLY for self-view (CASE WHEN v_is_self).
-- An elder viewing another profile sees NULL for these — consistent with the
-- "even elders never see the raw numbers" governance principle.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_profile_view(p_target_id UUID)
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
  v_result           JSONB;
BEGIN
  -- ANON branch — bare-minimum public info. NO full_name, NO role,
  -- NO email/phone/wallet/scores. Just enough for link-preview UX.
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

  -- status='active' on BOTH sides — matches migration 255's policy.
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

  SELECT jsonb_build_object(
    -- Always-visible (any authenticated viewer)
    'id',           p_target_id,
    'display_name', display_name,
    'full_name',    full_name,
    'avatar_url',   avatar_url,
    'role',         role,
    'tier_badge',   (SELECT current_tier FROM member_tier_status WHERE user_id = p_target_id),

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

    -- Self-only (PII + financial + raw signals)
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

-- ───────────────────────────────────────────────────────────────────────────
-- Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '258',
  'tiered_profile_visibility',
  ARRAY['-- 258: tiered_profile_visibility']
)
ON CONFLICT (version) DO NOTHING;
