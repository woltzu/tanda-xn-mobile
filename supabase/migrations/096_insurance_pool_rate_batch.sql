-- ════════════════════════════════════════════════════════════════════════════
-- Migration 096: Insurance Pool — batch rate recalculation RPC
-- ════════════════════════════════════════════════════════════════════════════
-- The per-circle calculate_pool_rate(circle_id) function already implements
-- the full AI rate adjustment algorithm (verified during reconnaissance):
--   - Reads circle_members + xn_scores + member_behavioral_profiles
--   - Tunes from base 2% based on avg score, count-below-fair, default count
--   - Clamps to pool's [rate_floor, rate_ceiling]
--   - UPDATEs circle_insurance_pools.current_rate
--   - INSERTs insurance_pool_rate_history row with breakdown
--   - Returns the new rate
--
-- This migration adds process_pool_rate_recalculation() — a batch wrapper
-- that iterates active pools and calls calculate_pool_rate for each.
-- Returns aggregate counts so the EF can log meaningful metrics.
--
-- "Rate changed" detection: calculate_pool_rate ALWAYS writes to
-- insurance_pool_rate_history, even when the resulting rate equals the
-- previous one. The batch counts a rate as "changed" only when the new
-- value differs from the old — useful operational signal.
--
-- Failure handling: per-circle BEGIN..EXCEPTION so one broken pool
-- doesn't kill the whole batch. Mirrors the run_scoring_pipeline pattern.
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION process_pool_rate_recalculation()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pool RECORD;
  v_previous_rate NUMERIC(5,4);
  v_new_rate NUMERIC(5,4);
  v_evaluated INTEGER := 0;
  v_changed INTEGER := 0;
  v_increased INTEGER := 0;
  v_decreased INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR v_pool IN
    SELECT circle_id, current_rate
    FROM circle_insurance_pools
    WHERE status = 'active'
  LOOP
    BEGIN
      v_previous_rate := v_pool.current_rate;
      v_new_rate := calculate_pool_rate(v_pool.circle_id);
      v_evaluated := v_evaluated + 1;

      IF v_new_rate <> v_previous_rate THEN
        v_changed := v_changed + 1;
        IF v_new_rate > v_previous_rate THEN
          v_increased := v_increased + 1;
        ELSE
          v_decreased := v_decreased + 1;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors,
        format('pool %s: %s', v_pool.circle_id, SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'pools_evaluated', v_evaluated,
    'rates_changed', v_changed,
    'rates_increased', v_increased,
    'rates_decreased', v_decreased,
    'errors', v_errors,
    'source', 'process_pool_rate_recalculation_rpc',
    'note', 'Iterates active circle_insurance_pools, calls calculate_pool_rate per circle. AI logic (avg score, count-below-fair, default count) is in calculate_pool_rate; this wrapper just orchestrates and aggregates.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_pool_rate_recalculation() TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_pool_rate_recalculation() FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('096', 'insurance_pool_rate_batch',
        ARRAY['-- 096: process_pool_rate_recalculation batch wrapper'])
ON CONFLICT (version) DO NOTHING;
