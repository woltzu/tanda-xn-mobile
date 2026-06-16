-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 147: process_advance_repayment — apply repayment to advance
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Called when a user pays (or has payment auto-deducted) toward an advance.
-- One unified RPC for all sources so the client and the future payout-
-- withholding worker speak the same language.
--
-- Behavior:
--   1. Verify the user owns the loan AND the loan is still serviceable
--      (status = 'active' or 'in_collections').
--   2. Walk the pending/partial loan_payment_schedule rows in due-date
--      order; apply amount_cents to each, splitting principal/interest/
--      fees proportional to what each row owes. Mark rows fully paid
--      when their balance hits zero.
--   3. Record a loan_payments row with the full breakdown.
--   4. Recompute aggregates on the loans row (outstanding_*, payments_made,
--      next_payment_*, last_payment_*, status). If the loan is fully
--      repaid, status = 'paid_off' and closed_at = now().
--   5. Return a JSONB payload with the new loan state.
--
-- Idempotency: the same external_transfer_id (or wallet_transaction_id when
-- provided) is recorded on loan_payments; the caller should not retry on
-- success. P0 leaves cross-call idempotency to the wallet/payout worker.

CREATE OR REPLACE FUNCTION public.process_advance_repayment(
  p_loan_id                UUID,
  p_amount_cents           BIGINT,
  p_source                 TEXT DEFAULT 'wallet',
  p_wallet_transaction_id  UUID DEFAULT NULL,
  p_external_transfer_id   TEXT DEFAULT NULL,
  p_user_id                UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id            UUID;
  v_loan               public.loans%ROWTYPE;
  v_remaining          BIGINT;
  v_alloc_principal    BIGINT := 0;
  v_alloc_interest     BIGINT := 0;
  v_alloc_fees         BIGINT := 0;
  v_row                public.loan_payment_schedule%ROWTYPE;
  v_row_balance        BIGINT;
  v_pay                BIGINT;
  v_split_principal    BIGINT;
  v_split_interest     BIGINT;
  v_split_fees         BIGINT;
  v_payment_id         UUID;
  v_was_on_time        BOOLEAN := TRUE;
  v_days_late          INT := 0;
  v_paid_schedule_ids  UUID[] := ARRAY[]::UUID[];
  v_partial_id         UUID := NULL;
  v_next_pending       public.loan_payment_schedule%ROWTYPE;
  v_payments_made      INT;
  v_new_status         loan_status;
  v_closed_at          TIMESTAMPTZ := NULL;
  v_closed_reason      TEXT := NULL;
  v_applied            JSONB := '[]'::JSONB;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF p_loan_id IS NULL THEN
    RAISE EXCEPTION 'loan_id_required';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF p_source NOT IN ('wallet', 'payout', 'manual') THEN
    RAISE EXCEPTION 'invalid_source:%', p_source;
  END IF;

  -- 1. Load + ownership check + status check. FOR UPDATE serializes
  --    concurrent repayments to the same loan.
  SELECT * INTO v_loan
  FROM public.loans
  WHERE id = p_loan_id
  FOR UPDATE;

  IF v_loan.id IS NULL THEN
    RAISE EXCEPTION 'loan_not_found';
  END IF;
  IF v_loan.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'not_loan_owner';
  END IF;
  IF v_loan.status NOT IN ('active'::loan_status, 'in_collections'::loan_status) THEN
    RAISE EXCEPTION 'loan_not_serviceable:%', v_loan.status::TEXT;
  END IF;

  v_remaining := LEAST(p_amount_cents, v_loan.total_outstanding_cents);
  IF v_remaining <= 0 THEN
    -- Nothing to apply; treat as a no-op success so the caller can be
    -- safely idempotent.
    RETURN jsonb_build_object(
      'loan_id', p_loan_id,
      'amount_applied_cents', 0,
      'status', v_loan.status::TEXT,
      'total_outstanding_cents', v_loan.total_outstanding_cents,
      'message', 'loan_already_paid_off'
    );
  END IF;

  -- 2. Walk schedule rows oldest-first; apply v_remaining.
  FOR v_row IN
    SELECT * FROM public.loan_payment_schedule
    WHERE loan_id = p_loan_id
      AND status IN ('pending'::loan_payment_status, 'processing'::loan_payment_status)
    ORDER BY due_date, payment_number
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_row_balance := v_row.total_due_cents - v_row.total_paid_cents;
    IF v_row_balance <= 0 THEN CONTINUE; END IF;

    v_pay := LEAST(v_remaining, v_row_balance);

    -- Proportional split of this payment across the row's remaining
    -- principal / interest / fees. Falls back to all-principal if the
    -- row has no breakdown (shouldn't happen with v146 schedules).
    IF v_row_balance > 0 THEN
      v_split_principal := ROUND(
        (v_row.principal_due_cents - v_row.principal_paid_cents)::NUMERIC
        / v_row_balance
        * v_pay
      )::BIGINT;
      v_split_interest := ROUND(
        (v_row.interest_due_cents - v_row.interest_paid_cents)::NUMERIC
        / v_row_balance
        * v_pay
      )::BIGINT;
      v_split_fees := v_pay - v_split_principal - v_split_interest;
      IF v_split_fees < 0 THEN v_split_fees := 0; END IF;
    ELSE
      v_split_principal := v_pay;
      v_split_interest  := 0;
      v_split_fees      := 0;
    END IF;

    v_alloc_principal := v_alloc_principal + v_split_principal;
    v_alloc_interest  := v_alloc_interest  + v_split_interest;
    v_alloc_fees      := v_alloc_fees      + v_split_fees;

    UPDATE public.loan_payment_schedule
       SET principal_paid_cents = principal_paid_cents + v_split_principal,
           interest_paid_cents  = interest_paid_cents  + v_split_interest,
           fees_paid_cents      = fees_paid_cents      + v_split_fees,
           total_paid_cents     = total_paid_cents     + v_pay,
           status = CASE
             WHEN total_paid_cents + v_pay >= total_due_cents
                  THEN 'completed'::loan_payment_status
             ELSE 'processing'::loan_payment_status
           END,
           paid_at = CASE
             WHEN total_paid_cents + v_pay >= total_due_cents
                  THEN now()
             ELSE paid_at
           END,
           updated_at = now()
     WHERE id = v_row.id;

    IF (v_row.total_paid_cents + v_pay) >= v_row.total_due_cents THEN
      v_paid_schedule_ids := array_append(v_paid_schedule_ids, v_row.id);
      IF v_row.due_date < CURRENT_DATE THEN
        v_was_on_time := FALSE;
        v_days_late := GREATEST(v_days_late, (CURRENT_DATE - v_row.due_date));
      END IF;
    ELSE
      v_partial_id := v_row.id;
    END IF;

    v_applied := v_applied || jsonb_build_object(
      'schedule_id', v_row.id,
      'payment_number', v_row.payment_number,
      'applied_cents', v_pay,
      'fully_paid', (v_row.total_paid_cents + v_pay) >= v_row.total_due_cents
    );

    v_remaining := v_remaining - v_pay;
  END LOOP;

  -- 3. Insert loan_payments record (single row per call regardless of how
  --    many schedule rows it touched). schedule_id points at the partially
  --    applied row if any, else the last fully paid row.
  INSERT INTO public.loan_payments (
    loan_id, user_id, schedule_id,
    amount_cents, principal_cents, interest_cents, fees_cents,
    payment_method, payment_source_id,
    was_on_time, days_late,
    status, processed_at,
    wallet_transaction_id, external_transfer_id,
    created_at
  ) VALUES (
    p_loan_id, v_user_id,
    COALESCE(v_partial_id, v_paid_schedule_ids[array_length(v_paid_schedule_ids, 1)]),
    p_amount_cents - v_remaining,
    v_alloc_principal, v_alloc_interest, v_alloc_fees,
    p_source, p_external_transfer_id,
    v_was_on_time, v_days_late,
    'completed'::loan_payment_status, now(),
    p_wallet_transaction_id, p_external_transfer_id,
    now()
  )
  RETURNING id INTO v_payment_id;

  -- 4. Recompute loan aggregates.
  SELECT COUNT(*) INTO v_payments_made
  FROM public.loan_payment_schedule
  WHERE loan_id = p_loan_id
    AND status = 'completed'::loan_payment_status;

  SELECT * INTO v_next_pending
  FROM public.loan_payment_schedule
  WHERE loan_id = p_loan_id
    AND status IN ('pending'::loan_payment_status, 'processing'::loan_payment_status)
  ORDER BY due_date, payment_number
  LIMIT 1;

  IF v_next_pending.id IS NULL THEN
    v_new_status     := 'paid_off'::loan_status;
    v_closed_at      := now();
    v_closed_reason  := 'fully_repaid';
  ELSE
    v_new_status := v_loan.status; -- stay active / in_collections
  END IF;

  UPDATE public.loans
     SET outstanding_principal_cents = GREATEST(0, outstanding_principal_cents - v_alloc_principal),
         outstanding_interest_cents  = GREATEST(0, outstanding_interest_cents  - v_alloc_interest),
         outstanding_fees_cents      = GREATEST(0, outstanding_fees_cents      - v_alloc_fees),
         total_outstanding_cents     = GREATEST(0, total_outstanding_cents - (p_amount_cents - v_remaining)),
         payments_made = v_payments_made,
         next_payment_date   = v_next_pending.due_date,
         next_payment_amount_cents = CASE
           WHEN v_next_pending.id IS NULL THEN NULL
           ELSE GREATEST(0, v_next_pending.total_due_cents - v_next_pending.total_paid_cents)
         END,
         last_payment_date         = CURRENT_DATE,
         last_payment_amount_cents = p_amount_cents - v_remaining,
         total_interest_paid_cents = total_interest_paid_cents + v_alloc_interest,
         total_fees_paid_cents     = total_fees_paid_cents + v_alloc_fees,
         status                    = v_new_status,
         closed_at                 = v_closed_at,
         closed_reason             = v_closed_reason,
         days_past_due             = CASE
           WHEN v_next_pending.id IS NULL THEN 0
           WHEN v_next_pending.due_date < CURRENT_DATE
                THEN CURRENT_DATE - v_next_pending.due_date
           ELSE 0
         END,
         is_delinquent = CASE
           WHEN v_next_pending.id IS NULL THEN FALSE
           WHEN v_next_pending.due_date < CURRENT_DATE THEN TRUE
           ELSE FALSE
         END,
         updated_at = now()
   WHERE id = p_loan_id;

  -- 5. Return receipt.
  RETURN jsonb_build_object(
    'loan_id', p_loan_id,
    'payment_id', v_payment_id,
    'amount_requested_cents', p_amount_cents,
    'amount_applied_cents', p_amount_cents - v_remaining,
    'amount_unapplied_cents', v_remaining,
    'principal_applied_cents', v_alloc_principal,
    'interest_applied_cents', v_alloc_interest,
    'fees_applied_cents', v_alloc_fees,
    'payments_made', v_payments_made,
    'status', v_new_status::TEXT,
    'next_payment_date', v_next_pending.due_date,
    'next_payment_amount_cents', CASE
      WHEN v_next_pending.id IS NULL THEN NULL
      ELSE GREATEST(0, v_next_pending.total_due_cents - v_next_pending.total_paid_cents)
    END,
    'fully_repaid', v_next_pending.id IS NULL,
    'applied_to_schedule', v_applied
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_advance_repayment(UUID, BIGINT, TEXT, UUID, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_advance_repayment(UUID, BIGINT, TEXT, UUID, TEXT, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.process_advance_repayment(UUID, BIGINT, TEXT, UUID, TEXT, UUID) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '147',
  'process_advance_repayment',
  ARRAY['-- 147: process_advance_repayment']
)
ON CONFLICT (version) DO NOTHING;
