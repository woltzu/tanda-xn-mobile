-- ════════════════════════════════════════════════════════════════════════════
-- Migration 094: GraduatedEntryEngine — profiles.xn_score fallback
-- ════════════════════════════════════════════════════════════════════════════
-- Two-line fix to make the existing tier engine produce real data TODAY
-- without waiting for the XnScore engine to populate xn_scores. The engine
-- code, schema, RPC signature, and downstream consumers are unchanged.
--
-- The problem (from reconnaissance):
--   evaluate_member_tier reads from xn_scores.total_score and
--   xn_scores.account_age_days. xn_scores has 0 rows in prod because the
--   upstream XnScore pipeline isn't running (per audit 35, the
--   scoring-pipeline-daily cron is scheduled but its command is broken).
--   Result: every member resolves to 'critical' regardless of their
--   actual profile XnScore.
--
-- The fix:
--   When xn_scores has no row for the user, fall back to:
--     - profiles.xn_score  (canonical XnScore stored on profiles since
--                           migration 002-ish; the engine treats this as
--                           ground truth in many other places, e.g. the
--                           Conflict / Composition / Match engines we've
--                           wired in this sprint)
--     - account_age_days from profiles.created_at
--
-- Also updates evaluate_all_member_tiers() so it iterates ALL profiles
-- (not just users with an xn_scores row). Without this, the batch wrapper
-- still does 0 work against the prod data.
--
-- Engine semantics unchanged: pure XnScore range → tier mapping. The
-- multi-criteria thresholds from the spec discussion (vouches required
-- for Trusted, admin review for Elder, etc.) are intentionally NOT
-- added; that would be a behavior change requiring separate sign-off.
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION evaluate_member_tier(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_xn RECORD;
  v_profile RECORD;
  v_current RECORD;
  v_tier RECORD;
  v_new_tier_key TEXT;
  v_new_tier_number INTEGER;
  v_previous_tier TEXT;
  v_changed BOOLEAN := false;
  v_change_type TEXT;
  v_reason TEXT;
  v_next_tier RECORD;
  v_progress_pct INTEGER := 0;
  v_action_items JSONB := '[]';
  v_score INTEGER;
  v_age INTEGER;
  v_completed INTEGER;
  v_defaults INTEGER;
BEGIN
  -- ── Read XnScore from xn_scores (preferred source) ──
  SELECT total_score, account_age_days
  INTO v_xn
  FROM xn_scores
  WHERE user_id = p_user_id;

  IF v_xn IS NULL THEN
    -- ── FALLBACK: profiles.xn_score + tenure from profiles.created_at ──
    -- This branch keeps the tier engine producing data when the XnScore
    -- pipeline hasn't run. Other AI engines wired this sprint (Conflict,
    -- Composition, Match) all read profiles.xn_score directly, so using
    -- it here keeps tier consistent with what those engines see.
    SELECT
      COALESCE(xn_score, 0)::INTEGER,
      GREATEST(0, EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400)::INTEGER
    INTO v_score, v_age
    FROM profiles
    WHERE id = p_user_id;
    v_score := COALESCE(v_score, 0);
    v_age := COALESCE(v_age, 0);
  ELSE
    v_score := COALESCE(ROUND(v_xn.total_score), 0);
    v_age := COALESCE(v_xn.account_age_days, 0);
  END IF;

  -- ── Read behavioral profile (still optional, may be NULL) ──
  SELECT circles_completed, default_count
  INTO v_profile
  FROM member_behavioral_profiles
  WHERE user_id = p_user_id;

  v_completed := COALESCE(v_profile.circles_completed, 0);
  v_defaults := COALESCE(v_profile.default_count, 0);

  -- ── Determine tier from score ──
  SELECT * INTO v_tier
  FROM graduated_entry_tiers
  WHERE v_score >= xn_score_min AND v_score <= xn_score_max
  ORDER BY tier_number DESC
  LIMIT 1;

  IF v_tier IS NULL THEN
    SELECT * INTO v_tier FROM graduated_entry_tiers WHERE tier_key = 'critical';
  END IF;

  v_new_tier_key := v_tier.tier_key;
  v_new_tier_number := v_tier.tier_number;

  -- ── Get current status ──
  SELECT * INTO v_current FROM member_tier_status WHERE user_id = p_user_id;

  -- ── Determine if tier changed ──
  IF v_current IS NULL THEN
    v_changed := true;
    v_change_type := 'initial';
    v_previous_tier := NULL;
    v_reason := format('Initial tier assignment: %s (XnScore %s)', v_tier.label, v_score);
  ELSIF v_current.current_tier != v_new_tier_key THEN
    v_changed := true;
    v_previous_tier := v_current.current_tier;

    IF v_new_tier_number > v_current.tier_number THEN
      v_change_type := 'advancement';
      v_reason := format('Advanced from %s to %s (XnScore %s)',
        v_current.current_tier, v_new_tier_key, v_score);
    ELSE
      v_change_type := 'demotion';
      v_reason := format('Demoted from %s to %s (XnScore dropped to %s)',
        v_current.current_tier, v_new_tier_key, v_score);
    END IF;
  ELSE
    v_previous_tier := v_current.previous_tier;
  END IF;

  -- ── Compute progress to next tier ──
  SELECT * INTO v_next_tier
  FROM graduated_entry_tiers
  WHERE tier_number = v_new_tier_number + 1;

  IF v_next_tier IS NOT NULL THEN
    IF (v_next_tier.xn_score_min - v_tier.xn_score_min) > 0 THEN
      v_progress_pct := LEAST(100, GREATEST(0,
        ROUND(((v_score - v_tier.xn_score_min)::DECIMAL / (v_next_tier.xn_score_min - v_tier.xn_score_min)) * 100)
      ));
    END IF;

    -- Score gap
    IF v_score < v_next_tier.xn_score_min THEN
      v_action_items := v_action_items || jsonb_build_object(
        'type', 'xn_score',
        'message', format('Earn %s more XnScore points to reach %s',
          v_next_tier.xn_score_min - v_score, v_next_tier.label),
        'current', v_score,
        'required', v_next_tier.xn_score_min
      );
    END IF;

    -- Account age gap
    IF v_age < v_next_tier.min_account_age_days THEN
      v_action_items := v_action_items || jsonb_build_object(
        'type', 'account_age',
        'message', format('%s more days on platform needed for %s',
          v_next_tier.min_account_age_days - v_age, v_next_tier.label),
        'current', v_age,
        'required', v_next_tier.min_account_age_days
      );
    END IF;
  ELSE
    v_progress_pct := 100;
  END IF;

  -- ── UPSERT member_tier_status ──
  INSERT INTO member_tier_status (
    user_id, current_tier, tier_number, previous_tier, tier_achieved_at,
    is_demoted, demotion_reason, demotion_path_back,
    max_circle_size, max_contribution_cents, position_access,
    xn_score_at_eval, account_age_at_eval, circles_completed_at_eval,
    next_tier, progress_pct, action_items
  ) VALUES (
    p_user_id, v_new_tier_key, v_new_tier_number, v_previous_tier,
    CASE WHEN v_changed THEN NOW() ELSE COALESCE(v_current.tier_achieved_at, NOW()) END,
    CASE WHEN v_change_type = 'demotion' THEN true ELSE false END,
    CASE WHEN v_change_type = 'demotion' THEN v_reason ELSE NULL END,
    CASE WHEN v_change_type = 'demotion' THEN
      format('Raise your XnScore back to %s to regain %s status',
        v_tier.xn_score_min + (v_next_tier.xn_score_min - v_tier.xn_score_min),
        COALESCE(v_previous_tier, v_new_tier_key))
    ELSE NULL END,
    v_tier.max_circle_size, v_tier.max_contribution_cents, v_tier.position_access,
    v_score, v_age, v_completed,
    CASE WHEN v_next_tier IS NOT NULL THEN v_next_tier.tier_key ELSE NULL END,
    v_progress_pct, v_action_items
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_tier = EXCLUDED.current_tier,
    tier_number = EXCLUDED.tier_number,
    previous_tier = CASE WHEN v_changed THEN v_previous_tier ELSE member_tier_status.previous_tier END,
    tier_achieved_at = CASE WHEN v_changed THEN NOW() ELSE member_tier_status.tier_achieved_at END,
    is_demoted = EXCLUDED.is_demoted,
    demotion_reason = EXCLUDED.demotion_reason,
    demotion_path_back = EXCLUDED.demotion_path_back,
    max_circle_size = EXCLUDED.max_circle_size,
    max_contribution_cents = EXCLUDED.max_contribution_cents,
    position_access = EXCLUDED.position_access,
    xn_score_at_eval = EXCLUDED.xn_score_at_eval,
    account_age_at_eval = EXCLUDED.account_age_at_eval,
    circles_completed_at_eval = EXCLUDED.circles_completed_at_eval,
    next_tier = EXCLUDED.next_tier,
    progress_pct = EXCLUDED.progress_pct,
    action_items = EXCLUDED.action_items,
    updated_at = NOW();

  -- ── Record tier change in history ──
  IF v_changed THEN
    INSERT INTO member_tier_history (
      user_id, from_tier, to_tier, change_type, reason,
      xn_score, account_age_days, circles_completed
    ) VALUES (
      p_user_id, v_previous_tier, v_new_tier_key, v_change_type, v_reason,
      v_score, v_age, v_completed
    );
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'previous_tier', v_previous_tier,
    'new_tier', v_new_tier_key,
    'tier_number', v_new_tier_number,
    'changed', v_changed,
    'change_type', COALESCE(v_change_type, 'none'),
    'xn_score', v_score,
    'account_age', v_age,
    'circles_completed', v_completed,
    'progress_pct', v_progress_pct,
    'max_circle_size', v_tier.max_circle_size,
    'max_contribution_cents', v_tier.max_contribution_cents,
    'position_access', v_tier.position_access,
    'source', CASE WHEN v_xn IS NULL THEN 'profiles_fallback' ELSE 'xn_scores' END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ─── Patched batch wrapper: iterate ALL profiles (not just xn_scores) ────
-- The original wrapper iterated `SELECT DISTINCT user_id FROM xn_scores`,
-- which loops 0 times in prod. Union with profiles so members without an
-- xn_scores row still get evaluated via the fallback path above.
CREATE OR REPLACE FUNCTION evaluate_all_member_tiers()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN
    SELECT id AS user_id FROM profiles
    UNION
    SELECT user_id FROM xn_scores
  LOOP
    BEGIN
      PERFORM evaluate_member_tier(v_user.user_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'evaluate_member_tier failed for user %: %', v_user.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('094', 'tier_eval_profiles_fallback',
        ARRAY['-- 094: evaluate_member_tier profiles.xn_score fallback + batch iterates profiles'])
ON CONFLICT (version) DO NOTHING;
