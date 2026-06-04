-- ════════════════════════════════════════════════════════════════════════════
-- Migration 095: Insurance Pool — wire contribution-paid → withholding
-- ════════════════════════════════════════════════════════════════════════════
-- Wires the existing process_pool_withholding(contribution_id, amount_cents)
-- SECURITY DEFINER function to fire automatically when a cycle_contributions
-- row reaches contribution_status='paid'. Until this commit, the function
-- existed in pg_proc but nothing called it — so every circle's insurance
-- pool stayed at balance_cents=0 even after the pools themselves were
-- initialized (4 rows in circle_insurance_pools today).
--
-- Trigger contract:
--   - Fires AFTER INSERT OR UPDATE OF (contribution_status, contributed_amount)
--   - WHEN NEW.contribution_status = 'paid'
--   - Idempotent via EXISTS check on insurance_pool_transactions: if a
--     'withholding' transaction already exists for this contribution_id,
--     skip (don't double-withhold).
--   - Skips if contributed_amount <= 0 (zero-dollar paid row, partial
--     plan not yet fulfilled, etc.).
--   - Failure does NOT block contribution INSERT/UPDATE — process_pool_
--     withholding returns errors via JSONB and never raises (verified by
--     reading its source); the trigger ignores the return.
--
-- Math: contributed_amount is NUMERIC (dollars). process_pool_withholding
-- expects p_amount_cents BIGINT. Conversion: ROUND(amount * 100)::BIGINT.
--
-- What the downstream function does (already in pg_proc — no changes):
--   1. Reads circle_id + user_id from cycle_contributions
--   2. Creates pool if missing (idempotent ON CONFLICT)
--   3. Skips if pool.status != 'active'
--   4. withheld = ROUND(amount * pool.current_rate)
--   5. UPDATE circle_insurance_pools SET balance_cents += withheld,
--      total_withheld_cents += withheld
--   6. INSERT insurance_pool_transactions of type='withholding'
--   7. Returns JSONB {withheld_cents, net_amount_cents, pool_balance_cents,
--                      rate_applied}
--
-- Note: contribution_status has no CHECK enum in prod, so 'paid' is the
-- agreed-upon convention. If other code writes a different status string
-- (e.g. 'complete', 'fulfilled'), the trigger silently won't fire and
-- this commit will need a follow-up to extend the WHEN clause.
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.trg_pool_withholding_on_contribution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_amount_cents BIGINT;
BEGIN
  -- Idempotency: skip if already withheld for this contribution.
  -- Real-world cases this guards against:
  --   - INSERT row with status='paid' (fires once), later UPDATE same row
  --     to flip something else but keep status='paid' (would re-fire with
  --     UPDATE OF column list)
  --   - Manual admin re-save of a paid row
  --   - Migration replay / data backfill
  IF EXISTS (
    SELECT 1 FROM insurance_pool_transactions
    WHERE contribution_id = NEW.id
      AND transaction_type = 'withholding'
  ) THEN
    RETURN NEW;
  END IF;

  -- Convert NUMERIC dollars → BIGINT cents.
  v_amount_cents := COALESCE(ROUND(NEW.contributed_amount * 100), 0)::BIGINT;
  IF v_amount_cents <= 0 THEN
    RETURN NEW;
  END IF;

  -- Fire the withholding function. We don't capture the result — any
  -- error path inside process_pool_withholding returns a JSONB error
  -- without raising, so the trigger never blocks the contribution row.
  PERFORM process_pool_withholding(NEW.id, v_amount_cents);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_pool_withholding_on_contribution() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trg_pool_withholding_on_contribution() TO authenticated, service_role;

DROP TRIGGER IF EXISTS pool_withholding_on_paid ON cycle_contributions;
CREATE TRIGGER pool_withholding_on_paid
  AFTER INSERT OR UPDATE OF contribution_status, contributed_amount ON cycle_contributions
  FOR EACH ROW
  WHEN (NEW.contribution_status = 'paid')
  EXECUTE FUNCTION public.trg_pool_withholding_on_contribution();


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('095', 'insurance_pool_withholding_trigger',
        ARRAY['-- 095: AFTER INSERT/UPDATE cycle_contributions → process_pool_withholding'])
ON CONFLICT (version) DO NOTHING;
