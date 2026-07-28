-- ═══════════════════════════════════════════════════════════════════════════
-- 393_feature_flag_console.sql
--
-- Adds an admin console layer on top of the existing feature_gates +
-- user_feature_overrides infrastructure. No new tables — reuses
-- admin_audit_log for audit trail, same pattern as mig 389 chargeback
-- and mig 391 mute audits.
--
-- Pieces:
--   1. is_feature_enabled(feature_id, user_id) — canonical evaluator.
--      Checks user_feature_overrides first (respects expires_at), then
--      falls back to feature_gates.enabled AND all attribute gates
--      against the user's profile + xn_scores + kyc_verifications.
--   2. admin_toggle_feature_gate — replaces direct UPDATE in the screen
--      so every gate flip lands in admin_audit_log.
--   3. admin_grant_feature_override / admin_revoke_feature_override —
--      cohort testing surface (assign a feature to a specific user).
--   4. get_feature_gate_history — reads admin_audit_log filtered to
--      entity_type='feature_gate' for the given gate id.
--   5. admin_toggle_platform_setting — flips platform_settings kill
--      switches (scoring_frozen / payouts_paused) via a single audited
--      RPC so the screen doesn't need to know which columns to update
--      for each kill switch name.
--
-- Attribute gate source of truth (same as check_advance_eligibility):
--   • min_xn_score          → xn_scores.total_score
--   • min_honor_score       → profiles.honor_score
--   • min_circles_completed → xn_scores.full_cycles_completed
--   • min_account_age_days  → profiles.created_at
--   • required_role         → profiles.role
--   • requires_id_verified  → kyc_verifications.status = 'approved'
--   • requires_income_verified → no source; treated as always-pass with
--     a warning so setting it doesn't silently block everyone. Address
--     when income verification actually ships.
--   • min_token_balance     → tokens system was removed (see CLAUDE.md);
--     treated as always-pass.
--
-- Deferrals (intentionally NOT in this migration):
--   • rollout_percentage — no live consumer needs it; cohort testing
--     goes via user_feature_overrides. Add if a real need emerges.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. is_feature_enabled — canonical evaluator ─────────────────────────
CREATE OR REPLACE FUNCTION public.is_feature_enabled(
  p_feature_id TEXT,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gate feature_gates%ROWTYPE;
  v_override user_feature_overrides%ROWTYPE;
  v_xn_score INT;
  v_honor_score INT;
  v_full_cycles INT;
  v_account_age_days INT;
  v_role TEXT;
  v_kyc_approved BOOLEAN;
BEGIN
  IF p_feature_id IS NULL OR p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Explicit override wins (either grant or deny), respecting expires_at.
  SELECT * INTO v_override
    FROM user_feature_overrides
    WHERE feature_gate_id = p_feature_id
      AND user_id = p_user_id
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 1;

  IF FOUND THEN
    RETURN v_override.access_granted;
  END IF;

  -- No override → fall through to the gate rules.
  SELECT * INTO v_gate FROM feature_gates WHERE id = p_feature_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Global kill switch. If enabled is explicitly FALSE, block.
  IF v_gate.enabled IS NOT TRUE THEN
    RETURN FALSE;
  END IF;

  -- Score-based gates. Pulled once each to avoid repeated joins.
  IF v_gate.min_xn_score IS NOT NULL THEN
    SELECT COALESCE(ROUND(total_score)::INT, 0)
      INTO v_xn_score
      FROM xn_scores WHERE user_id = p_user_id;
    IF COALESCE(v_xn_score, 0) < v_gate.min_xn_score THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF v_gate.min_honor_score IS NOT NULL THEN
    SELECT COALESCE(honor_score, 0) INTO v_honor_score
      FROM profiles WHERE id = p_user_id;
    IF COALESCE(v_honor_score, 0) < v_gate.min_honor_score THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF v_gate.min_circles_completed IS NOT NULL THEN
    SELECT COALESCE(full_cycles_completed, 0) INTO v_full_cycles
      FROM xn_scores WHERE user_id = p_user_id;
    IF COALESCE(v_full_cycles, 0) < v_gate.min_circles_completed THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF v_gate.min_account_age_days IS NOT NULL THEN
    SELECT EXTRACT(DAY FROM (NOW() - created_at))::INT
      INTO v_account_age_days FROM profiles WHERE id = p_user_id;
    IF COALESCE(v_account_age_days, 0) < v_gate.min_account_age_days THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF v_gate.required_role IS NOT NULL THEN
    SELECT role INTO v_role FROM profiles WHERE id = p_user_id;
    IF v_role IS DISTINCT FROM v_gate.required_role THEN
      RETURN FALSE;
    END IF;
  END IF;

  IF v_gate.requires_id_verified = TRUE THEN
    SELECT (status = 'approved') INTO v_kyc_approved
      FROM kyc_verifications
      WHERE member_id = p_user_id
      ORDER BY created_at DESC NULLS LAST LIMIT 1;
    IF v_kyc_approved IS NOT TRUE THEN
      RETURN FALSE;
    END IF;
  END IF;

  -- requires_income_verified: no data source yet. Log a warning if the
  -- gate is set to require it — we don't silently pass or fail.
  IF v_gate.requires_income_verified = TRUE THEN
    RAISE WARNING '[is_feature_enabled] gate % requires income verification but no source is wired; treating as pass',
      p_feature_id;
  END IF;

  -- min_token_balance: tokens were removed (see CLAUDE.md — TandaXn does
  -- NOT use platform tokens). Treat as always-pass.
  -- custom_rule (jsonb): reserved for future extension; not evaluated here.

  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.is_feature_enabled(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_feature_enabled(TEXT, UUID)
  TO authenticated, service_role;

-- ─── 2. admin_toggle_feature_gate ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_toggle_feature_gate(
  p_feature_id TEXT,
  p_enabled BOOLEAN,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_prev BOOLEAN;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'admin_toggle_feature_gate: admin required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'admin_toggle_feature_gate: reason required';
  END IF;

  SELECT enabled INTO v_prev FROM feature_gates WHERE id = p_feature_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_toggle_feature_gate: feature_gate % not found', p_feature_id;
  END IF;

  UPDATE feature_gates SET enabled = p_enabled, updated_at = NOW() WHERE id = p_feature_id;

  -- admin_audit_log.entity_id is UUID; feature_gates.id is TEXT.
  -- Use NULL for entity_id and stash the string id in details.
  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id, 'feature_gate.toggle', 'feature_gate', NULL,
    jsonb_build_object(
      'feature_gate_id', p_feature_id,
      'prev_enabled', v_prev,
      'new_enabled', p_enabled,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'feature_id', p_feature_id,
    'enabled', p_enabled,
    'prev_enabled', v_prev
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_toggle_feature_gate(TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_toggle_feature_gate(TEXT, BOOLEAN, TEXT) TO authenticated;

-- ─── 3. admin_grant_feature_override ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_grant_feature_override(
  p_feature_id TEXT,
  p_user_id UUID,
  p_access_granted BOOLEAN,
  p_reason TEXT,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_override_id UUID;
  v_prev_access BOOLEAN;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'admin_grant_feature_override: admin required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'admin_grant_feature_override: reason required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM feature_gates WHERE id = p_feature_id) THEN
    RAISE EXCEPTION 'admin_grant_feature_override: feature_gate % not found', p_feature_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'admin_grant_feature_override: user % not found', p_user_id;
  END IF;

  -- Read prior value (if any) for the audit row.
  SELECT id, access_granted INTO v_override_id, v_prev_access
    FROM user_feature_overrides
    WHERE feature_gate_id = p_feature_id AND user_id = p_user_id
    LIMIT 1;

  IF v_override_id IS NOT NULL THEN
    UPDATE user_feature_overrides SET
      access_granted = p_access_granted,
      reason         = p_reason,
      granted_by     = v_admin_id,
      expires_at     = p_expires_at
    WHERE id = v_override_id;
  ELSE
    INSERT INTO user_feature_overrides (
      user_id, feature_gate_id, access_granted, reason, granted_by, expires_at
    ) VALUES (
      p_user_id, p_feature_id, p_access_granted, p_reason, v_admin_id, p_expires_at
    ) RETURNING id INTO v_override_id;
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id, 'feature_override.grant', 'user_feature_override', p_user_id,
    jsonb_build_object(
      'feature_gate_id', p_feature_id,
      'target_user_id', p_user_id,
      'access_granted', p_access_granted,
      'prev_access_granted', v_prev_access,
      'expires_at', p_expires_at,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'override_id', v_override_id,
    'feature_id', p_feature_id,
    'user_id', p_user_id,
    'access_granted', p_access_granted
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_grant_feature_override(TEXT, UUID, BOOLEAN, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_grant_feature_override(TEXT, UUID, BOOLEAN, TEXT, TIMESTAMPTZ) TO authenticated;

-- ─── 4. admin_revoke_feature_override ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_revoke_feature_override(
  p_feature_id TEXT,
  p_user_id UUID,
  p_reason TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_prior_access BOOLEAN;
  v_prior_expires TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'admin_revoke_feature_override: admin required' USING ERRCODE = '42501';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'admin_revoke_feature_override: reason required';
  END IF;

  SELECT access_granted, expires_at INTO v_prior_access, v_prior_expires
    FROM user_feature_overrides
    WHERE feature_gate_id = p_feature_id AND user_id = p_user_id
    LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_revoke_feature_override: no override to revoke';
  END IF;

  DELETE FROM user_feature_overrides
    WHERE feature_gate_id = p_feature_id AND user_id = p_user_id;

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id, 'feature_override.revoke', 'user_feature_override', p_user_id,
    jsonb_build_object(
      'feature_gate_id', p_feature_id,
      'target_user_id', p_user_id,
      'prior_access_granted', v_prior_access,
      'prior_expires_at', v_prior_expires,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object('success', TRUE, 'feature_id', p_feature_id, 'user_id', p_user_id);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_revoke_feature_override(TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_feature_override(TEXT, UUID, TEXT) TO authenticated;

-- ─── 5. get_feature_gate_history ─────────────────────────────────────────
-- Admin-only. Returns the last N audit rows for a given feature_gate id
-- (both gate toggles and per-user override grants/revokes), plus the
-- current override list for the gate. Powers the "Recent changes" +
-- "Assigned users" collapsible on the admin screen.
CREATE OR REPLACE FUNCTION public.get_feature_gate_history(
  p_feature_id TEXT,
  p_limit INT DEFAULT 20
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_history JSONB;
  v_overrides JSONB;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'get_feature_gate_history: admin required' USING ERRCODE = '42501';
  END IF;

  -- Audit rows (both toggles + per-user overrides). Filter by the
  -- feature_gate_id embedded in the details JSONB — that's the pointer
  -- we use since admin_audit_log.entity_id is UUID and feature_gates.id
  -- is TEXT.
  SELECT COALESCE(jsonb_agg(row_out ORDER BY (row_out->>'created_at') DESC), '[]'::jsonb)
    INTO v_history
  FROM (
    SELECT jsonb_build_object(
      'id', a.id,
      'admin_id', a.admin_id,
      'admin_name', p.full_name,
      'action', a.action,
      'entity_type', a.entity_type,
      'details', a.details,
      'created_at', a.created_at
    ) AS row_out
    FROM admin_audit_log a
    LEFT JOIN profiles p ON p.id = a.admin_id
    WHERE a.action IN ('feature_gate.toggle','feature_override.grant','feature_override.revoke')
      AND a.details->>'feature_gate_id' = p_feature_id
    ORDER BY a.created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 100))
  ) rows;

  -- Current live overrides (bounded — the screen only needs a preview).
  SELECT COALESCE(jsonb_agg(row_out ORDER BY (row_out->>'created_at') DESC), '[]'::jsonb)
    INTO v_overrides
  FROM (
    SELECT jsonb_build_object(
      'override_id', o.id,
      'user_id', o.user_id,
      'user_name', p.full_name,
      'access_granted', o.access_granted,
      'reason', o.reason,
      'granted_by', o.granted_by,
      'granted_by_name', gp.full_name,
      'expires_at', o.expires_at,
      'created_at', o.created_at,
      'expired', (o.expires_at IS NOT NULL AND o.expires_at <= NOW())
    ) AS row_out
    FROM user_feature_overrides o
    LEFT JOIN profiles p ON p.id = o.user_id
    LEFT JOIN profiles gp ON gp.id = o.granted_by
    WHERE o.feature_gate_id = p_feature_id
    ORDER BY o.created_at DESC
    LIMIT 50
  ) rows;

  RETURN jsonb_build_object(
    'feature_id', p_feature_id,
    'history', v_history,
    'overrides', v_overrides
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_feature_gate_history(TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_feature_gate_history(TEXT, INT) TO authenticated;

-- ─── 6. admin_toggle_platform_setting — kill switches ────────────────────
-- Flips one of the platform_settings kill switches (scoring_frozen /
-- payouts_paused) via a single audited RPC. The screen doesn't need to
-- know which columns to update for each switch name.
CREATE OR REPLACE FUNCTION public.admin_toggle_platform_setting(
  p_setting TEXT,
  p_enabled BOOLEAN,
  p_reason  TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
  v_prev BOOLEAN;
BEGIN
  IF NOT public.is_admin(v_admin_id) THEN
    RAISE EXCEPTION 'admin_toggle_platform_setting: admin required' USING ERRCODE = '42501';
  END IF;
  IF p_setting NOT IN ('scoring_frozen','payouts_paused') THEN
    RAISE EXCEPTION 'admin_toggle_platform_setting: unknown setting %', p_setting;
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'admin_toggle_platform_setting: reason required';
  END IF;

  IF p_setting = 'scoring_frozen' THEN
    SELECT scoring_frozen INTO v_prev FROM platform_settings WHERE id = 1;
    UPDATE platform_settings SET
      scoring_frozen              = p_enabled,
      scoring_frozen_at           = CASE WHEN p_enabled THEN NOW() ELSE NULL END,
      scoring_frozen_by_admin_id  = CASE WHEN p_enabled THEN v_admin_id ELSE NULL END,
      scoring_frozen_reason       = CASE WHEN p_enabled THEN p_reason ELSE NULL END,
      updated_at                  = NOW()
    WHERE id = 1;
  ELSE
    SELECT payouts_paused INTO v_prev FROM platform_settings WHERE id = 1;
    UPDATE platform_settings SET
      payouts_paused              = p_enabled,
      payouts_paused_at           = CASE WHEN p_enabled THEN NOW() ELSE NULL END,
      payouts_paused_by_admin_id  = CASE WHEN p_enabled THEN v_admin_id ELSE NULL END,
      payouts_paused_reason       = CASE WHEN p_enabled THEN p_reason ELSE NULL END,
      updated_at                  = NOW()
    WHERE id = 1;
  END IF;

  INSERT INTO admin_audit_log (admin_id, action, entity_type, entity_id, details)
  VALUES (
    v_admin_id, 'platform_setting.toggle', 'platform_setting', NULL,
    jsonb_build_object(
      'setting', p_setting,
      'prev_enabled', v_prev,
      'new_enabled', p_enabled,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'setting', p_setting,
    'enabled', p_enabled,
    'prev_enabled', v_prev
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_toggle_platform_setting(TEXT, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_toggle_platform_setting(TEXT, BOOLEAN, TEXT) TO authenticated;

-- ─── 7. Self-register ────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '393',
  'feature_flag_console',
  ARRAY['-- 393: feature_flag_console']
)
ON CONFLICT (version) DO NOTHING;
