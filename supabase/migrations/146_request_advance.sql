-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 146: request_advance — auto-approving advance request RPC
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Server-side endpoint for the SmartCalculator "Request $X Advance" button.
-- Performs the full advance lifecycle in one transaction:
--   1. Validates eligibility against the same gates as get_advance_dashboard.
--   2. If eligible: inserts a loan_applications row in status 'disbursed',
--      inserts the matching loans row in status 'active', and generates the
--      loan_payment_schedule rows for the agreed term.
--   3. Returns a JSONB payload the client can show on a confirmation sheet
--      without having to refetch the dashboard.
--
-- Auto-approval is the only mode in P0 — per product spec. If eligibility
-- fails the function raises with a structured `eligibility_blocked:<reason>`
-- error the client can map to localized copy.
--
-- The actual cash movement (credit to wallet) is NOT performed here — that
-- is the disbursement engine's job, scheduled for the P2 automation pass.
-- The loans row landing in status='active' is the system of record.
--
-- Schema note: loan_applications gains an idempotent `repayment_preference`
-- TEXT column so the user's choice (payout_withholding | manual) is recorded
-- without polluting purpose_description.

ALTER TABLE public.loan_applications
  ADD COLUMN IF NOT EXISTS repayment_preference TEXT;

CREATE OR REPLACE FUNCTION public.request_advance(
  p_ui_code                 TEXT,
  p_requested_amount_cents  BIGINT,
  p_term_months             INT  DEFAULT NULL,
  p_repayment_preference    TEXT DEFAULT 'payout_withholding',
  p_user_id                 UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id            UUID;
  v_xnscore            INT;
  v_completed_circles  INT := 0;
  v_db_code            TEXT;
  v_product            public.loan_products%ROWTYPE;
  v_active_count       INT;
  v_term               INT;
  v_apr                NUMERIC(6,3);
  v_monthly_rate       NUMERIC(20,10);
  v_compound_factor    NUMERIC(30,12);
  v_principal          BIGINT;
  v_origination_fee    BIGINT;
  v_monthly_cents      BIGINT;
  v_total_interest     BIGINT;
  v_total_repayment    BIGINT;
  v_app_id             UUID;
  v_loan_id            UUID;
  v_today              DATE := CURRENT_DATE;
  v_schedule           JSONB := '[]'::JSONB;
  i                    INT;
  v_due_date           DATE;
  v_principal_per      BIGINT;
  v_interest_per       BIGINT;
  v_remainder          BIGINT;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF p_requested_amount_cents IS NULL OR p_requested_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_repayment_preference NOT IN ('payout_withholding', 'manual') THEN
    RAISE EXCEPTION 'invalid_repayment_preference';
  END IF;

  -- 1. Map UI code → DB code (mirror of get_advance_dashboard's CTE).
  v_db_code := CASE p_ui_code
    WHEN 'contribution' THEN 'circle_boost'
    WHEN 'quick'        THEN 'micro_emergency'
    WHEN 'flex'         THEN 'education'
    WHEN 'premium'      THEN 'small_business'
    ELSE NULL
  END;
  IF v_db_code IS NULL THEN
    RAISE EXCEPTION 'unknown_product:%', p_ui_code;
  END IF;

  SELECT * INTO v_product
  FROM public.loan_products
  WHERE code = v_db_code;
  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'eligibility_blocked:product_not_configured';
  END IF;
  IF NOT v_product.is_active THEN
    RAISE EXCEPTION 'eligibility_blocked:product_inactive';
  END IF;

  -- 2. Pull user signals.
  SELECT COALESCE(ROUND(total_score)::INT, 0)
    INTO v_xnscore
  FROM public.xn_scores
  WHERE user_id = v_user_id;
  IF v_xnscore IS NULL THEN v_xnscore := 0; END IF;

  SELECT COUNT(*)::INT INTO v_completed_circles
  FROM public.circle_members cm
  WHERE cm.user_id = v_user_id
    AND cm.status = 'completed';

  -- 3. Eligibility gates.
  IF v_xnscore < v_product.min_xnscore THEN
    RAISE EXCEPTION 'eligibility_blocked:xnscore_too_low';
  END IF;
  IF v_completed_circles < COALESCE(v_product.min_completed_circles, 0) THEN
    RAISE EXCEPTION 'eligibility_blocked:not_enough_completed_circles';
  END IF;

  -- Concurrency cap — match the legacy AdvanceContext "max 3 active" rule.
  SELECT COUNT(*) INTO v_active_count
  FROM public.loans
  WHERE user_id = v_user_id
    AND status = 'active'::loan_status;
  IF v_active_count >= 3 THEN
    RAISE EXCEPTION 'eligibility_blocked:too_many_active_advances';
  END IF;

  -- 4. Amount clamp.
  IF p_requested_amount_cents < v_product.min_amount_cents THEN
    RAISE EXCEPTION 'eligibility_blocked:amount_below_min';
  END IF;
  IF p_requested_amount_cents > v_product.max_amount_cents THEN
    RAISE EXCEPTION 'eligibility_blocked:amount_above_max';
  END IF;
  v_principal := p_requested_amount_cents;

  -- 5. Term clamp + default.
  v_term := COALESCE(p_term_months, v_product.min_term_months);
  IF v_term < v_product.min_term_months THEN
    v_term := v_product.min_term_months;
  END IF;
  IF v_term > v_product.max_term_months THEN
    v_term := v_product.max_term_months;
  END IF;
  IF v_term IS NULL OR v_term < 1 THEN v_term := 1; END IF;

  -- 6. Effective APR — linear interpolation between min/max APR keyed by
  -- the user's XnScore between min_xnscore and 100.
  v_apr := CASE
    WHEN v_product.base_apr_min IS NULL OR v_product.base_apr_max IS NULL THEN 0
    WHEN v_xnscore <= v_product.min_xnscore THEN v_product.base_apr_max
    WHEN v_xnscore >= 100 THEN v_product.base_apr_min
    ELSE ROUND(
      v_product.base_apr_max
      - ((v_xnscore - v_product.min_xnscore)::NUMERIC
         / NULLIF(100 - v_product.min_xnscore, 0))
        * (v_product.base_apr_max - v_product.base_apr_min),
      3
    )
  END;

  -- 7. Origination fee + monthly payment via standard amortization.
  v_origination_fee :=
    ROUND(v_principal * COALESCE(v_product.origination_fee_percent, 0) / 100)::BIGINT;

  IF v_apr > 0 THEN
    v_monthly_rate    := v_apr / 100 / 12;
    v_compound_factor := POWER(1 + v_monthly_rate, v_term);
    v_monthly_cents   := ROUND(
      v_principal * v_monthly_rate * v_compound_factor / (v_compound_factor - 1)
    )::BIGINT;
    v_total_repayment := v_monthly_cents * v_term;
    v_total_interest  := v_total_repayment - v_principal;
  ELSE
    v_total_interest  := 0;
    v_total_repayment := v_principal;
    v_monthly_cents   := CEIL(v_principal::NUMERIC / v_term)::BIGINT;
  END IF;

  -- 8. Insert loan_applications row (auto-approved → status='disbursed').
  INSERT INTO public.loan_applications (
    user_id, loan_product_id,
    requested_amount_cents, approved_amount_cents,
    term_months, purpose, purpose_description,
    apr, origination_fee_cents,
    monthly_payment_cents, total_interest_cents, total_repayment_cents,
    status, status_reason,
    disbursement_method, disbursement_destination,
    disbursed_at, terms_accepted_at,
    repayment_preference,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_product.id,
    v_principal, v_principal,
    v_term,
    CASE p_ui_code
      WHEN 'contribution' THEN 'circle_contribution'::loan_product_purpose
      WHEN 'quick'        THEN 'emergency'::loan_product_purpose
      WHEN 'flex'         THEN 'other'::loan_product_purpose
      WHEN 'premium'      THEN 'business'::loan_product_purpose
    END,
    'Advance via ' || p_ui_code,
    v_apr, v_origination_fee,
    v_monthly_cents, v_total_interest, v_total_repayment,
    'disbursed'::loan_application_status, 'auto_approved',
    'wallet', 'wallet',
    now(), now(),
    p_repayment_preference,
    now(), now()
  )
  RETURNING id INTO v_app_id;

  -- 9. Insert the matching loans row in status='active'.
  INSERT INTO public.loans (
    user_id, application_id, loan_product_id,
    principal_cents, apr, term_months,
    origination_fee_cents,
    first_payment_date, final_payment_date,
    monthly_payment_cents,
    outstanding_principal_cents, outstanding_interest_cents,
    outstanding_fees_cents, total_outstanding_cents,
    payments_made, payments_total,
    next_payment_date, next_payment_amount_cents,
    days_past_due, is_delinquent,
    status,
    estimated_monthly_payment_cents,
    autopay_enabled,
    created_at, updated_at
  ) VALUES (
    v_user_id, v_app_id, v_product.id,
    v_principal, v_apr, v_term,
    v_origination_fee,
    (v_today + INTERVAL '1 month')::DATE,
    (v_today + (v_term || ' months')::INTERVAL)::DATE,
    v_monthly_cents,
    v_principal, v_total_interest,
    v_origination_fee, v_total_repayment + v_origination_fee,
    0, v_term,
    (v_today + INTERVAL '1 month')::DATE, v_monthly_cents,
    0, FALSE,
    'active'::loan_status,
    v_monthly_cents,
    p_repayment_preference = 'payout_withholding',
    now(), now()
  )
  RETURNING id INTO v_loan_id;

  -- 10. Generate the payment schedule. Principal/interest split is
  --     straight-line for P0 (proportional). A future migration can
  --     replace this with proper amortization tables.
  v_principal_per := v_principal / v_term;
  v_interest_per  := v_total_interest / v_term;
  v_remainder     := v_principal - (v_principal_per * v_term);

  FOR i IN 1..v_term LOOP
    v_due_date := (v_today + (i || ' months')::INTERVAL)::DATE;

    INSERT INTO public.loan_payment_schedule (
      loan_id, payment_number, due_date,
      principal_due_cents, interest_due_cents, fees_due_cents,
      total_due_cents,
      principal_paid_cents, interest_paid_cents, fees_paid_cents, total_paid_cents,
      status,
      late_fee_cents, late_fee_waived,
      late_fee_applied,
      created_at, updated_at
    ) VALUES (
      v_loan_id, i, v_due_date,
      v_principal_per + (CASE WHEN i = v_term THEN v_remainder ELSE 0 END),
      v_interest_per,
      0,
      v_principal_per + v_interest_per + (CASE WHEN i = v_term THEN v_remainder ELSE 0 END),
      0, 0, 0, 0,
      'pending'::loan_payment_status,
      0, FALSE,
      FALSE,
      now(), now()
    );

    v_schedule := v_schedule || jsonb_build_object(
      'payment_number', i,
      'due_date', v_due_date,
      'total_due_cents', v_principal_per + v_interest_per + (CASE WHEN i = v_term THEN v_remainder ELSE 0 END)
    );
  END LOOP;

  -- 11. Return the receipt.
  RETURN jsonb_build_object(
    'loan_id', v_loan_id,
    'application_id', v_app_id,
    'status', 'approved',
    'auto_approved', TRUE,
    'product_ui_code', p_ui_code,
    'product_db_code', v_db_code,
    'approved_amount_cents', v_principal,
    'apr', v_apr,
    'term_months', v_term,
    'origination_fee_cents', v_origination_fee,
    'monthly_payment_cents', v_monthly_cents,
    'total_interest_cents', v_total_interest,
    'total_repayment_cents', v_total_repayment,
    'first_payment_date', (v_today + INTERVAL '1 month')::DATE,
    'repayment_preference', p_repayment_preference,
    'repayment_schedule', v_schedule
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_advance(TEXT, BIGINT, INT, TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_advance(TEXT, BIGINT, INT, TEXT, UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.request_advance(TEXT, BIGINT, INT, TEXT, UUID) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '146',
  'request_advance',
  ARRAY['-- 146: request_advance']
)
ON CONFLICT (version) DO NOTHING;
