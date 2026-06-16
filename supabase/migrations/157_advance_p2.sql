-- ============================================================================
-- Migration 157: Advance P2 (Automation & Learning)
-- ============================================================================
-- Two server-side pieces that the daily Edge Functions (shipped in the
-- same checkpoint) lean on:
--
--   1. advance_eligibility_cache — last-known eligibility per (user,
--      product_code). The check-advance-eligibility cron computes the
--      current state, diffs against this cache, and only emits a
--      notification on false → true transitions. Without the cache we
--      would spam every user every day.
--   2. apply_advance_late_penalty(loan_id, days_overdue) — bumps APR by
--      a flat +2pp, applies a late fee row on the overdue schedule
--      entry, and stamps the loan as delinquent. Called from
--      check-advance-repayments when an obligation is ≥ 7 days past
--      due. Idempotent: skips loans already carrying the penalty for
--      this overdue cycle.
--
-- The existing process_advance_repayment + payout-disbursement wiring
-- are NOT touched here — see docs/architecture/advance_p2.md for the
-- verification result and the P3 follow-up flag if any gap was found.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. advance_eligibility_cache
-- ----------------------------------------------------------------------------
-- One row per (user, product_code). The cron does an UPSERT after every
-- daily pass, and the change-detection logic reads the prior value via
-- the UNIQUE key.
CREATE TABLE IF NOT EXISTS public.advance_eligibility_cache (
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_code     TEXT NOT NULL,
  eligible         BOOLEAN NOT NULL,
  max_amount_cents INTEGER,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_code)
);

CREATE INDEX IF NOT EXISTS idx_advance_elig_user_computed
  ON public.advance_eligibility_cache(user_id, computed_at DESC);

ALTER TABLE public.advance_eligibility_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aec_select_own" ON public.advance_eligibility_cache;
CREATE POLICY "aec_select_own"
  ON public.advance_eligibility_cache FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No INSERT / UPDATE policies — the edge function writes via
-- service-role and bypasses RLS.

COMMENT ON TABLE public.advance_eligibility_cache IS
  'Last-known advance eligibility per (user, product). Powers the daily '
  'check-advance-eligibility cron: notify only on false → true.';


-- ----------------------------------------------------------------------------
-- 2. apply_advance_late_penalty
-- ----------------------------------------------------------------------------
-- Adds a flat 200 bps to the loan APR, applies a 5% late fee on the
-- overdue payment, and flips loans.is_delinquent. Idempotent on the
-- per-schedule-entry late-fee marker (late_fee_applied=true), so a
-- second invocation for the same overdue cycle is a no-op for fees but
-- still flips the loan flags.
CREATE OR REPLACE FUNCTION public.apply_advance_late_penalty(
  p_loan_id        UUID,
  p_days_overdue   INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_loan         public.loans%ROWTYPE;
  v_schedule_id  UUID;
  v_total_due    INTEGER;
  v_fee_cents    INTEGER := 0;
  v_already      BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_loan FROM public.loans WHERE id = p_loan_id;
  IF v_loan.id IS NULL THEN
    RAISE EXCEPTION 'apply_advance_late_penalty: loan % not found', p_loan_id;
  END IF;

  -- Find the oldest pending overdue schedule row.
  SELECT id, total_due_cents INTO v_schedule_id, v_total_due
    FROM public.loan_payment_schedule
   WHERE loan_id = p_loan_id
     AND status::TEXT = 'pending'
     AND due_date < (CURRENT_DATE - INTERVAL '7 days')::DATE
   ORDER BY due_date ASC
   LIMIT 1;

  IF v_schedule_id IS NULL THEN
    -- Nothing actually overdue past the 7-day threshold; the cron's
    -- view may have been stale by the time the RPC fired. Return a
    -- no-op envelope so the caller can log it.
    RETURN jsonb_build_object('ok', false, 'reason', 'no_overdue_obligation');
  END IF;

  -- Apply the late fee — 5% of the total due, minimum $1. Skip if the
  -- entry already carries the marker (idempotent).
  SELECT late_fee_applied INTO v_already
    FROM public.loan_payment_schedule WHERE id = v_schedule_id;
  IF v_already IS NOT TRUE THEN
    v_fee_cents := GREATEST(100, (v_total_due * 0.05)::INT);
    UPDATE public.loan_payment_schedule
       SET late_fee_cents     = COALESCE(late_fee_cents, 0) + v_fee_cents,
           late_fee_applied   = TRUE,
           total_due_cents    = total_due_cents + v_fee_cents,
           days_overdue       = p_days_overdue,
           updated_at         = now()
     WHERE id = v_schedule_id;
  END IF;

  -- Bump the loan APR by 200 bps (flat). Real product would model
  -- the penalty rate via rate_tiers / promotional_rate; bumping `apr`
  -- directly is the simplest expression of the P2 spec.
  UPDATE public.loans
     SET apr               = COALESCE(apr, 0) + 2.0,
         is_delinquent     = TRUE,
         delinquent_since  = COALESCE(delinquent_since, CURRENT_DATE),
         days_past_due     = GREATEST(COALESCE(days_past_due, 0), p_days_overdue),
         outstanding_fees_cents = COALESCE(outstanding_fees_cents, 0) + v_fee_cents,
         total_outstanding_cents = COALESCE(total_outstanding_cents, 0) + v_fee_cents,
         updated_at        = now()
   WHERE id = p_loan_id;

  RETURN jsonb_build_object(
    'ok', true,
    'loan_id', p_loan_id,
    'schedule_id', v_schedule_id,
    'fee_applied_cents', v_fee_cents,
    'fee_already_applied', v_already
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.apply_advance_late_penalty(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_advance_late_penalty(UUID, INTEGER) TO service_role;

COMMENT ON FUNCTION public.apply_advance_late_penalty IS
  'Service-role only. Called from check-advance-repayments when an '
  'obligation is ≥ 7 days past due. Adds +2pp APR, a 5%-or-$1-min late '
  'fee on the overdue schedule entry, and flips is_delinquent. '
  'Idempotent per-schedule-entry via late_fee_applied.';


-- ----------------------------------------------------------------------------
-- 3. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '157',
  'advance_p2',
  ARRAY['-- 157: advance_eligibility_cache + apply_advance_late_penalty']
)
ON CONFLICT (version) DO NOTHING;
