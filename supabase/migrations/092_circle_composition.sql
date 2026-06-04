-- ════════════════════════════════════════════════════════════════════════════
-- Migration 092: evaluate_circle_composition RPC
-- ════════════════════════════════════════════════════════════════════════════
-- Group-level composition evaluator. Complements ConflictPredictionEngine's
-- pairwise friction scoring (already wired into CreateCircleSuccessScreen)
-- with set-level aggregate metrics that pairwise scoring can't see:
--
--   1. XnScore homogeneity (30%) — low stddev = members at similar risk
--      levels = good. Heterogeneous groups have higher dispute potential.
--   2. Tenure diversity (20%) — high stddev = mix of new + experienced
--      members = good. (Spec's `avg_tenure < 90 ? 100 : ...` formula
--      rewarded all-newbie groups, which is backwards; using stddev.)
--   3. Vouch density (30%) — vouching edges within the proposed set,
--      normalized by directed pair count. Higher = stronger trust web.
--   4. Affordability (20%) — % of members likely to afford the proposed
--      contribution.
--
-- Real-schema fixes vs original spec:
--   - profiles.smc_cents doesn't exist. Real column is `monthly_income`
--     (numeric, dollars). Affordability uses monthly_income*100 >=
--     target_cents when present, else xn_score >= 60 as a heuristic
--     proxy for members without income on file.
--   - vouches columns are voucher_user_id / vouchee_user_id (NOT
--     voucher_id / vouchee_id). And there's no status='active' —
--     active means revoked_at IS NULL AND (expires_at IS NULL OR
--     expires_at > NOW()).
--   - Division-by-zero guard for v_total_members < 2.
--   - Tenure score measures DIVERSITY (stddev), not average.
--
-- Returns full breakdown + warnings so the UI can render explainable
-- factor cards. can_proceed flag at score >= 50 (configurable; matches
-- Conflict Prediction's "watch" cutoff intent).
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION evaluate_circle_composition(
  p_member_ids UUID[],
  p_target_amount_cents BIGINT,
  p_frequency TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_members INT := array_length(p_member_ids, 1);
  v_avg_xn NUMERIC;
  v_stddev_xn NUMERIC;
  v_avg_tenure NUMERIC;
  v_stddev_tenure NUMERIC;
  v_vouch_count INT := 0;
  v_total_possible_pairs INT := 0;
  v_vouch_density NUMERIC := 0;
  v_affordable_count INT := 0;
  v_affordability_pct NUMERIC := 0;
  v_xn_homogeneity_score NUMERIC := 0;
  v_tenure_diversity_score NUMERIC := 0;
  v_vouch_score NUMERIC := 0;
  v_affordability_score NUMERIC := 0;
  v_composition_score NUMERIC := 0;
  v_warnings JSONB := '[]'::jsonb;
BEGIN
  -- Guard
  IF v_total_members IS NULL OR v_total_members = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'no_members_provided',
      'source', 'evaluate_circle_composition_rpc'
    );
  END IF;

  -- ─── XnScore aggregates ────────────────────────────────────────────
  SELECT AVG(xn_score), STDDEV(xn_score)
    INTO v_avg_xn, v_stddev_xn
  FROM profiles WHERE id = ANY(p_member_ids);
  v_avg_xn    := COALESCE(v_avg_xn, 0);
  v_stddev_xn := COALESCE(v_stddev_xn, 0);

  -- ─── Tenure aggregates (days since profile creation) ──────────────
  SELECT AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0),
         STDDEV(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400.0)
    INTO v_avg_tenure, v_stddev_tenure
  FROM profiles WHERE id = ANY(p_member_ids);
  v_avg_tenure    := COALESCE(v_avg_tenure, 0);
  v_stddev_tenure := COALESCE(v_stddev_tenure, 0);

  -- ─── Vouch density ─────────────────────────────────────────────────
  -- Active vouch = not revoked AND not expired. Vouches are directional
  -- (voucher_user_id → vouchee_user_id), so density is normalized by
  -- directed pair count: N * (N-1).
  IF v_total_members >= 2 THEN
    SELECT COUNT(*) INTO v_vouch_count
    FROM vouches
    WHERE voucher_user_id = ANY(p_member_ids)
      AND vouchee_user_id = ANY(p_member_ids)
      AND voucher_user_id <> vouchee_user_id  -- defensive (table CHECK should already enforce)
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > NOW());
    v_total_possible_pairs := v_total_members * (v_total_members - 1);
    IF v_total_possible_pairs > 0 THEN
      v_vouch_density := LEAST(1, v_vouch_count::NUMERIC / v_total_possible_pairs);
    END IF;
  END IF;

  -- ─── Affordability ─────────────────────────────────────────────────
  -- Real path: monthly_income (dollars) × 100 >= target_amount_cents.
  -- Proxy when income unknown: xn_score >= 60.
  SELECT COUNT(*) INTO v_affordable_count
  FROM profiles
  WHERE id = ANY(p_member_ids)
    AND (
      (monthly_income IS NOT NULL AND monthly_income * 100 >= p_target_amount_cents)
      OR (monthly_income IS NULL AND xn_score >= 60)
    );
  v_affordability_pct := (v_affordable_count::NUMERIC / v_total_members) * 100;

  -- ─── Sub-scores (0-100 each) ───────────────────────────────────────

  -- XnScore homogeneity: stddev of 0 = 100 (perfectly uniform), 30+ = 0
  v_xn_homogeneity_score := GREATEST(0, 100 - LEAST(100, (v_stddev_xn / 30.0) * 100));

  -- Tenure diversity: stddev of 0 = 0 (all same tenure), 180+ days = 100
  v_tenure_diversity_score := LEAST(100, (v_stddev_tenure / 180.0) * 100);

  v_vouch_score := v_vouch_density * 100;
  v_affordability_score := v_affordability_pct;

  -- ─── Weighted composite ────────────────────────────────────────────
  v_composition_score :=
    v_xn_homogeneity_score   * 0.30 +
    v_tenure_diversity_score * 0.20 +
    v_vouch_score            * 0.30 +
    v_affordability_score    * 0.20;
  v_composition_score := GREATEST(0, LEAST(100, v_composition_score));

  -- ─── Warnings ──────────────────────────────────────────────────────
  IF v_affordability_pct < 50 THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'type', 'low_affordability',
      'severity', 'high',
      'message', format('Only %s%% of members are likely to afford the proposed contribution',
                        ROUND(v_affordability_pct))
    ));
  END IF;
  IF v_stddev_xn > 25 THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'type', 'high_xn_variance',
      'severity', 'medium',
      'message', format('XnScore variance is high (stddev %s) — members at very different risk levels',
                        ROUND(v_stddev_xn, 1))
    ));
  END IF;
  IF v_vouch_count = 0 AND v_total_members >= 3 THEN
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'type', 'no_vouches',
      'severity', 'low',
      'message', 'No vouching edges between proposed members'
    ));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'composition_score', ROUND(v_composition_score, 2),
    'tier', CASE
      WHEN v_composition_score >= 75 THEN 'strong'
      WHEN v_composition_score >= 50 THEN 'acceptable'
      WHEN v_composition_score >= 25 THEN 'weak'
      ELSE 'poor'
    END,
    'can_proceed', v_composition_score >= 50,
    'breakdown', jsonb_build_object(
      'xn_homogeneity', jsonb_build_object(
        'score', ROUND(v_xn_homogeneity_score, 2),
        'weight', 0.30,
        'detail', jsonb_build_object(
          'avg_xn', ROUND(v_avg_xn, 1),
          'stddev_xn', ROUND(v_stddev_xn, 2)
        )),
      'tenure_diversity', jsonb_build_object(
        'score', ROUND(v_tenure_diversity_score, 2),
        'weight', 0.20,
        'detail', jsonb_build_object(
          'avg_tenure_days', ROUND(v_avg_tenure, 1),
          'stddev_tenure_days', ROUND(v_stddev_tenure, 2)
        )),
      'vouch_density', jsonb_build_object(
        'score', ROUND(v_vouch_score, 2),
        'weight', 0.30,
        'detail', jsonb_build_object(
          'vouch_count', v_vouch_count,
          'directed_pairs', v_total_possible_pairs,
          'density', ROUND(v_vouch_density, 4)
        )),
      'affordability', jsonb_build_object(
        'score', ROUND(v_affordability_score, 2),
        'weight', 0.20,
        'detail', jsonb_build_object(
          'affordable_count', v_affordable_count,
          'total_members', v_total_members,
          'pct', ROUND(v_affordability_pct, 1)
        ))
    ),
    'warnings', v_warnings,
    'member_count', v_total_members,
    'target_amount_cents', p_target_amount_cents,
    'frequency', p_frequency,
    'source', 'evaluate_circle_composition_rpc',
    'note', 'Real-schema columns: vouches.voucher_user_id/vouchee_user_id (NOT voucher_id), monthly_income proxy for affordability (NOT smc_cents). Tenure score measures DIVERSITY (stddev). Sub-score weights 30/20/30/20.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.evaluate_circle_composition(UUID[], BIGINT, TEXT)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.evaluate_circle_composition(UUID[], BIGINT, TEXT)
  FROM PUBLIC, anon;

-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('092', 'circle_composition',
        ARRAY['-- 092: evaluate_circle_composition group-level scoring RPC'])
ON CONFLICT (version) DO NOTHING;
