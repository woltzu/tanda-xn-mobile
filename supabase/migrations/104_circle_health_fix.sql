-- ════════════════════════════════════════════════════════════════════════════
-- Migration 104: Circle Health — fix compute_circle_health_score + add manual RPC
-- Phase D1 of feat(circle-health).
-- ════════════════════════════════════════════════════════════════════════════
-- The PL/pgSQL function compute_circle_health_score (migration 036, ~200 LOC)
-- has been deployed and scheduled via scoring-pipeline-daily since day one,
-- but it has been silently failing for every circle on every run due to
-- two bugs in its CONTRIBUTION RELIABILITY block:
--
--   1. Wrong source table — it reads from `contributions`, but the app writes
--      to `cycle_contributions` (insurance / partial / liquidity / membership
--      flows all use cycle_contributions). The `contributions` table has 0
--      rows in prod. Even after the enum literals are fixed, reading from
--      `contributions` would always produce the 50-baseline default.
--
--   2. Wrong enum literals — references `status = 'completed'` and
--      `status = 'defaulted'`. The contribution_status enum's valid values
--      are `pending, paid, late, missed, waived`. The 'completed' literal
--      raises `ERROR 22P02: invalid input value for enum contribution_status`
--      at runtime, terminating the entire compute_circle_health_score call
--      and bubbling up to the BEGIN..EXCEPTION wrapper in
--      compute_all_circle_health_scores, which swallows it. The pipeline
--      reports overall success while the circle_health_scores table stays
--      at 0 rows day after day.
--
-- This migration drops + recreates the function with corrected references:
--   * FROM contributions                          → FROM cycle_contributions
--   * status = 'completed' AND is_late = false    → contribution_status = 'paid'
--                                                   AND (was_on_time IS NULL
--                                                        OR was_on_time = true)
--   * status = 'defaulted'                        → contribution_status IN
--                                                   ('missed', 'defaulted')
--     (the IN clause keeps backward-compat if the app ever writes the literal
--     'defaulted' text — currently only 'missed' is in the enum, but
--     cycle_contributions.contribution_status is TEXT without a CHECK
--     constraint, so both can appear depending on the writer.)
--
-- Every other block of the function (member quality, financial stability,
-- social cohesion, weighting, status thresholds, trend, upsert, history) is
-- preserved bit-for-bit. The other tables/columns it reads (xn_scores,
-- default_probability_scores, defaults, circle_members) already match prod.
--
-- Also adds a user-facing public.recompute_circle_health(p_circle_id) RPC
-- that wraps the computation. SECURITY DEFINER, GRANT to authenticated,
-- restricted to members of the circle (admins/creators not required — any
-- active member can refresh "their" circle's score). Powers the "Refresh
-- score" button on the upcoming D3 CircleDetail card.
-- ════════════════════════════════════════════════════════════════════════════


DROP FUNCTION IF EXISTS compute_circle_health_score(UUID);

CREATE OR REPLACE FUNCTION compute_circle_health_score(p_circle_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_contribution_score DECIMAL(5,2) := 50;
  v_member_quality DECIMAL(5,2) := 50;
  v_financial_stability DECIMAL(5,2) := 50;
  v_social_cohesion DECIMAL(5,2) := 50;
  v_health_score DECIMAL(5,2);
  v_health_status TEXT;
  v_on_time_pct DECIMAL(5,2) := 0;
  v_avg_xnscore DECIMAL(5,2) := 0;
  v_members_with_defaults INTEGER := 0;
  v_total_members INTEGER := 0;
  v_avg_default_prob DECIMAL(5,4) := 0;
  v_previous_score DECIMAL(5,2);
  v_trend TEXT := 'stable';
  v_total_contributions INTEGER := 0;
  v_on_time_contributions INTEGER := 0;
  v_defaulted_contributions INTEGER := 0;
  v_shared_circles_avg DECIMAL := 0;
BEGIN
  -- ── Get total active members ──
  SELECT COUNT(*) INTO v_total_members
  FROM circle_members
  WHERE circle_id = p_circle_id AND status = 'active';

  IF v_total_members = 0 THEN
    RETURN 0;
  END IF;

  -- ── CONTRIBUTION RELIABILITY SCORE (40%) ──
  -- FIX: was reading FROM contributions with status/is_late columns that
  -- caused enum errors. Now reads cycle_contributions which is what the app
  -- actually writes to.
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE contribution_status = 'paid'
        AND (was_on_time IS NULL OR was_on_time = true)
    ),
    COUNT(*) FILTER (
      WHERE contribution_status IN ('missed', 'defaulted')
    )
  INTO v_total_contributions, v_on_time_contributions, v_defaulted_contributions
  FROM cycle_contributions
  WHERE circle_id = p_circle_id;

  IF v_total_contributions > 0 THEN
    v_on_time_pct := (v_on_time_contributions::DECIMAL / v_total_contributions) * 100;
    -- Scale: 95%+ on-time = 100, linear down to 0 at 50%
    v_contribution_score := LEAST(100, GREATEST(0,
      ((v_on_time_pct - 50) / 45) * 100
    ));
    -- Penalize defaults heavily
    IF v_defaulted_contributions > 0 THEN
      v_contribution_score := GREATEST(0,
        v_contribution_score - (v_defaulted_contributions * 15)
      );
    END IF;
  END IF;

  -- ── MEMBER QUALITY SCORE (25%) ──
  SELECT COALESCE(AVG(xs.total_score), 0) INTO v_avg_xnscore
  FROM circle_members cm
  JOIN xn_scores xs ON xs.user_id = cm.user_id
  WHERE cm.circle_id = p_circle_id AND cm.status = 'active';

  v_member_quality := v_avg_xnscore;

  SELECT COUNT(*) INTO v_members_with_defaults
  FROM circle_members
  WHERE circle_id = p_circle_id
    AND status = 'active'
    AND has_active_default = true;

  IF v_members_with_defaults > 0 THEN
    v_member_quality := GREATEST(0,
      v_member_quality - (v_members_with_defaults * 20)
    );
  END IF;

  SELECT COALESCE(AVG(dps.predicted_probability), 0) INTO v_avg_default_prob
  FROM circle_members cm
  JOIN default_probability_scores dps ON dps.user_id = cm.user_id
  WHERE cm.circle_id = p_circle_id AND cm.status = 'active';

  -- ── FINANCIAL STABILITY SCORE (20%) ──
  v_financial_stability := GREATEST(0, 100 - (v_avg_default_prob * 200));

  IF EXISTS (
    SELECT 1 FROM defaults
    WHERE circle_id = p_circle_id
      AND default_status = 'unresolved'
  ) THEN
    v_financial_stability := GREATEST(0, v_financial_stability - 30);
  END IF;

  -- ── SOCIAL COHESION SCORE (15%) ──
  SELECT COALESCE(AVG(shared_count), 0) INTO v_shared_circles_avg
  FROM (
    SELECT cm1.user_id, COUNT(DISTINCT cm2.circle_id) AS shared_count
    FROM circle_members cm1
    JOIN circle_members cm2 ON cm2.user_id = cm1.user_id
      AND cm2.circle_id != p_circle_id
      AND cm2.status = 'active'
    WHERE cm1.circle_id = p_circle_id AND cm1.status = 'active'
    GROUP BY cm1.user_id
  ) sub;

  v_social_cohesion := LEAST(100, v_shared_circles_avg * 20 + 30);

  -- ── COMPOSITE HEALTH SCORE ──
  v_health_score := ROUND(
    v_contribution_score * 0.40 +
    v_member_quality * 0.25 +
    v_financial_stability * 0.20 +
    v_social_cohesion * 0.15,
    2
  );

  -- ── HEALTH STATUS ──
  v_health_status := CASE
    WHEN v_health_score >= 80 THEN 'thriving'
    WHEN v_health_score >= 60 THEN 'healthy'
    WHEN v_health_score >= 40 THEN 'at_risk'
    ELSE 'critical'
  END;

  -- ── TREND ──
  SELECT health_score INTO v_previous_score
  FROM circle_health_scores
  WHERE circle_id = p_circle_id;

  IF v_previous_score IS NOT NULL THEN
    IF v_health_score > v_previous_score + 3 THEN
      v_trend := 'improving';
    ELSIF v_health_score < v_previous_score - 3 THEN
      v_trend := 'declining';
    ELSE
      v_trend := 'stable';
    END IF;
  END IF;

  -- ── UPSERT circle_health_scores ──
  INSERT INTO circle_health_scores (
    circle_id, health_score, health_status,
    contribution_reliability_score, member_quality_score,
    financial_stability_score, social_cohesion_score,
    on_time_contribution_pct, avg_member_xnscore,
    members_with_defaults, total_members,
    avg_default_probability, previous_score, trend,
    last_computed_at, updated_at
  ) VALUES (
    p_circle_id, v_health_score, v_health_status,
    v_contribution_score, v_member_quality,
    v_financial_stability, v_social_cohesion,
    v_on_time_pct, v_avg_xnscore,
    v_members_with_defaults, v_total_members,
    v_avg_default_prob, v_previous_score, v_trend,
    NOW(), NOW()
  )
  ON CONFLICT (circle_id) DO UPDATE SET
    health_score = EXCLUDED.health_score,
    health_status = EXCLUDED.health_status,
    contribution_reliability_score = EXCLUDED.contribution_reliability_score,
    member_quality_score = EXCLUDED.member_quality_score,
    financial_stability_score = EXCLUDED.financial_stability_score,
    social_cohesion_score = EXCLUDED.social_cohesion_score,
    on_time_contribution_pct = EXCLUDED.on_time_contribution_pct,
    avg_member_xnscore = EXCLUDED.avg_member_xnscore,
    members_with_defaults = EXCLUDED.members_with_defaults,
    total_members = EXCLUDED.total_members,
    avg_default_probability = EXCLUDED.avg_default_probability,
    previous_score = circle_health_scores.health_score,
    trend = EXCLUDED.trend,
    last_computed_at = NOW(),
    updated_at = NOW();

  -- ── APPEND to history ──
  INSERT INTO circle_health_history (
    circle_id, health_score, health_status,
    component_scores, computed_at
  ) VALUES (
    p_circle_id, v_health_score, v_health_status,
    jsonb_build_object(
      'contribution_reliability', v_contribution_score,
      'member_quality', v_member_quality,
      'financial_stability', v_financial_stability,
      'social_cohesion', v_social_cohesion
    ),
    NOW()
  );

  RETURN v_health_score;
END;
$$;


-- ── recompute_circle_health (user-facing manual RPC) ─────────────────────────
-- Powers the "Refresh score" button on CircleDetail's health card (D3).
-- Restricted to active members of the circle.

CREATE OR REPLACE FUNCTION recompute_circle_health(p_circle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_member BOOLEAN;
  v_score NUMERIC;
  v_result RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'authentication required');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM circle_members
    WHERE circle_id = p_circle_id
      AND user_id = v_user_id
      AND status = 'active'
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'only active members of the circle can refresh the health score'
    );
  END IF;

  v_score := compute_circle_health_score(p_circle_id);

  SELECT * INTO v_result
  FROM circle_health_scores
  WHERE circle_id = p_circle_id;

  RETURN jsonb_build_object(
    'success', true,
    'health_score', v_score,
    'health_status', v_result.health_status,
    'trend', v_result.trend,
    'previous_score', v_result.previous_score,
    'components', jsonb_build_object(
      'contribution_reliability', v_result.contribution_reliability_score,
      'member_quality', v_result.member_quality_score,
      'financial_stability', v_result.financial_stability_score,
      'social_cohesion', v_result.social_cohesion_score
    ),
    'metrics', jsonb_build_object(
      'on_time_contribution_pct', v_result.on_time_contribution_pct,
      'avg_member_xnscore', v_result.avg_member_xnscore,
      'members_with_defaults', v_result.members_with_defaults,
      'total_members', v_result.total_members,
      'avg_default_probability', v_result.avg_default_probability
    ),
    'last_computed_at', v_result.last_computed_at,
    'source', 'recompute_circle_health_rpc'
  );
END;
$$;


-- ── Grants ─────────────────────────────────────────────────────────────────
-- compute_circle_health_score stays service-role only (the scoring pipeline
-- calls it via the batch wrapper). recompute_circle_health is user-facing.

REVOKE EXECUTE ON FUNCTION public.compute_circle_health_score(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.compute_circle_health_score(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION public.recompute_circle_health(UUID) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_circle_health(UUID) FROM PUBLIC, anon;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('104', 'circle_health_fix',
        ARRAY['-- 104: CircleHealth D1 — fix compute_circle_health_score + manual recompute RPC'])
ON CONFLICT (version) DO NOTHING;
