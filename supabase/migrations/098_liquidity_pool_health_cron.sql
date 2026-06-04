-- ════════════════════════════════════════════════════════════════════════════
-- Migration 098: Cross-Circle Liquidity — pool health check RPC
-- ════════════════════════════════════════════════════════════════════════════
-- Weekly cron RPC that adjusts the pool's safety knobs based on observed
-- default rate. Does NOT touch fees (kept hardcoded in the TS engine per
-- the approved decision); only adjusts max_utilization_pct and the
-- is_accepting_requests safety circuit.
--
-- Adjustment rules (matching the approved spec):
--   default_rate > 8%   → SAFETY CIRCUIT: is_accepting_requests = false
--   default_rate > 5%   → max_utilization_pct -= 10pp (floored at 30%)
--   default_rate = 0    AND no defaults in 30 days
--                       → max_utilization_pct += 5pp (capped at 90%)
--                       → and re-enable is_accepting_requests if previously
--                         tripped AND default rate is now 0
--
-- Returns aggregate JSONB so the EF can log meaningful metrics.
--
-- Operational note: the safety circuit auto-pauses but does NOT auto-resume
-- aggressively. Re-enabling requires (default_rate=0 AND no defaults in 30
-- days). This is the conservative side — ops can manually flip
-- is_accepting_requests back on faster if they want to.
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION process_liquidity_pool_health_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pool RECORD;
  v_old_max_util NUMERIC;
  v_new_max_util NUMERIC;
  v_old_accepting BOOLEAN;
  v_new_accepting BOOLEAN;
  v_recent_default_count INTEGER;
  v_changes JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_pool
  FROM liquidity_pool
  WHERE pool_name = 'primary'
  LIMIT 1;

  IF v_pool IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No primary pool found',
      'source', 'process_liquidity_pool_health_check_rpc'
    );
  END IF;

  v_old_max_util := v_pool.max_utilization_pct;
  v_new_max_util := v_old_max_util;
  v_old_accepting := v_pool.is_accepting_requests;
  v_new_accepting := v_old_accepting;

  -- Defaults in the last 30 days (for the resume-aggression check)
  SELECT COUNT(*) INTO v_recent_default_count
  FROM liquidity_advances
  WHERE status = 'defaulted'
    AND updated_at > NOW() - INTERVAL '30 days';

  -- Adjustment logic
  IF v_pool.default_rate_pct > 8 THEN
    -- Safety circuit: pause new requests
    v_new_accepting := false;
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'change', 'safety_circuit_tripped',
      'reason', format('default_rate %s%% exceeds 8%% threshold',
                       ROUND(v_pool.default_rate_pct, 2)),
      'previous_value', v_old_accepting,
      'new_value', false
    ));
    -- And drop utilization cap to slow exposure further
    v_new_max_util := GREATEST(30, v_old_max_util - 10);
  ELSIF v_pool.default_rate_pct > 5 THEN
    -- Elevated risk: drop utilization cap by 10pp, floor 30%
    v_new_max_util := GREATEST(30, v_old_max_util - 10);
  ELSIF v_pool.default_rate_pct = 0 AND v_recent_default_count = 0 THEN
    -- Healthy: raise cap by 5pp, ceiling 90%
    v_new_max_util := LEAST(90, v_old_max_util + 5);
    -- And re-enable accepting if previously tripped
    IF NOT v_old_accepting THEN
      v_new_accepting := true;
      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'change', 'safety_circuit_reset',
        'reason', 'default_rate=0 AND no defaults in 30 days',
        'previous_value', false,
        'new_value', true
      ));
    END IF;
  END IF;

  -- Log max_utilization change if any
  IF v_new_max_util <> v_old_max_util THEN
    v_changes := v_changes || jsonb_build_array(jsonb_build_object(
      'change', 'max_utilization_adjusted',
      'previous_value', v_old_max_util,
      'new_value', v_new_max_util,
      'reason', CASE
        WHEN v_new_max_util > v_old_max_util THEN 'pool healthy, easing cap'
        ELSE 'risk elevated, tightening cap'
      END
    ));
  END IF;

  -- Apply changes if any
  IF (v_new_max_util <> v_old_max_util) OR (v_new_accepting <> v_old_accepting) THEN
    UPDATE liquidity_pool
    SET max_utilization_pct = v_new_max_util,
        is_accepting_requests = v_new_accepting,
        updated_at = NOW()
    WHERE id = v_pool.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'changes_made', jsonb_array_length(v_changes),
    'changes', v_changes,
    'pool_state', jsonb_build_object(
      'default_rate_pct', v_pool.default_rate_pct,
      'utilization_pct', v_pool.utilization_pct,
      'old_max_utilization_pct', v_old_max_util,
      'new_max_utilization_pct', v_new_max_util,
      'old_accepting_flag', v_old_accepting,
      'new_accepting_flag', v_new_accepting,
      'recent_defaults_30d', v_recent_default_count,
      'available_cents', v_pool.available_cents,
      'deployed_cents', v_pool.deployed_cents
    ),
    'source', 'process_liquidity_pool_health_check_rpc',
    'note', 'Adjusts max_utilization_pct and is_accepting_requests only. Fees stay hardcoded in TS engine. Safety circuit at 8% default rate. Conservative resume: requires 30 days of 0 defaults.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_liquidity_pool_health_check() TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_liquidity_pool_health_check()
  FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('098', 'liquidity_pool_health_cron',
        ARRAY['-- 098: process_liquidity_pool_health_check safety-knob adjuster'])
ON CONFLICT (version) DO NOTHING;
