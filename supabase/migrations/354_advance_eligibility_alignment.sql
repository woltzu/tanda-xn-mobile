-- ═══════════════════════════════════════════════════════════════════════════
-- 354_advance_eligibility_alignment.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Combined Fixes A + B + C from the Task 1 audit — bring the Phase-1 advance
-- eligibility surface in line with Doc 36 (docs/design/lending_staged_v1.md).
--
-- Fix A — Late-penalty gate (new). Doc 36 §3 requires "Active member (no
--   late penalties in last 2 cycles)". Neither request_advance,
--   check_advance_eligibility, nor get_advance_dashboard enforces this.
--   Add a new column loan_products.min_recent_ontime_cycles that names
--   the number of ontime cycles required in the last N days; each RPC
--   gates on it.
--
-- Fix B — Dashboard gates 2+4 (account_age + KYC). get_advance_dashboard
--   currently only checks xnscore + completed_circles. request_advance
--   and check_advance_eligibility both enforce KYC + account age, so a
--   user without KYC can see a card marked eligible=true, tap through,
--   and only discover the block on submit. Extend the dashboard's
--   scored CTE to check both AND the new late-payment gate.
--
-- Fix C — Product-seed alignment for Phase 1. The current seed values
--   (mig 022) put Micro Emergency at min_xnscore=40 and
--   min_completed_circles=0. Doc 36 says both Phase 1 products (Circle
--   Boost + Micro Emergency) require XnScore >= 50 and >= 1 completed
--   cycle. Aligning the seed with the doc.
--
-- All four RPC bodies preserved verbatim from their live definitions
-- (mig 184 for request_advance + check_advance_eligibility, mig 350 for
-- get_advance_dashboard) — only the new gates and the min_recent_ontime
-- signal are added. Nothing else moves.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. New column ────────────────────────────────────────────────────────

ALTER TABLE public.loan_products
  ADD COLUMN IF NOT EXISTS min_recent_ontime_cycles INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.loan_products.min_recent_ontime_cycles IS
  'Number of consecutive ontime contribution cycles required in the last '
  '60 days for advance eligibility. 0 disables the gate. Doc 36 Phase 1 '
  'products set this to 2 per the "no late penalties in last 2 cycles" '
  'requirement.';

-- ─── 2. Fix C — seed alignment ────────────────────────────────────────────

UPDATE public.loan_products
   SET min_xnscore           = 50,
       min_completed_circles = 1
 WHERE code = 'micro_emergency';

UPDATE public.loan_products
   SET min_recent_ontime_cycles = 2
 WHERE code IN ('circle_boost', 'micro_emergency');

-- ─── 3. Helper — recent late-contribution count ───────────────────────────
-- Small STABLE helper so each RPC calls the same predicate. Returns the
-- number of circle_contributions rows for a user in the last 60 days with
-- status in ('late','missed'). SECURITY DEFINER so it can see the
-- caller's own contributions without depending on RLS on that surface.

CREATE OR REPLACE FUNCTION public.recent_late_contribution_count(
  p_user_id UUID,
  p_window_days INT DEFAULT 60
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(COUNT(*), 0)::INT
    FROM public.circle_contributions
   WHERE user_id = p_user_id
     AND status IN ('late', 'missed')
     AND (paid_date IS NULL OR paid_date >= NOW() - (p_window_days || ' days')::INTERVAL)
$$;

REVOKE ALL ON FUNCTION public.recent_late_contribution_count(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recent_late_contribution_count(UUID, INT)
  TO authenticated, service_role;

-- ─── 4. request_advance — add late-payment gate ───────────────────────────
-- Body is byte-identical to mig 184 except for the new IF block below the
-- completed-circles check. Comment inline so a future diff reader can
-- spot the delta.

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
  v_kyc_status         TEXT;
  v_account_age_days   INT;
  v_xnscore            INT;
  v_completed_circles  INT := 0;
  v_recent_late        INT := 0;
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

  SELECT status
    INTO v_kyc_status
    FROM public.kyc_verifications
   WHERE member_id = v_user_id
   ORDER BY created_at DESC NULLS LAST
   LIMIT 1;
  IF v_kyc_status IS NULL OR v_kyc_status <> 'approved' THEN
    RAISE EXCEPTION 'eligibility_blocked:kyc_required';
  END IF;

  IF p_requested_amount_cents IS NULL OR p_requested_amount_cents <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  IF p_repayment_preference NOT IN ('payout_withholding', 'manual') THEN
    RAISE EXCEPTION 'invalid_repayment_preference';
  END IF;

  v_db_code := CASE p_ui_code
    WHEN 'contribution' THEN 'circle_boost'
    WHEN 'quick'        THEN 'micro_emergency'
    WHEN 'flex'         THEN 'education'
    WHEN 'premium'      THEN 'small_business'
    WHEN 'mortgage'     THEN 'home_country_mortgage'
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

  IF COALESCE(v_product.min_account_age_days, 0) > 0 THEN
    SELECT EXTRACT(DAY FROM (now() - p.created_at))::INT
      INTO v_account_age_days
      FROM public.profiles p
     WHERE p.id = v_user_id;
    IF v_account_age_days IS NULL OR v_account_age_days < v_product.min_account_age_days THEN
      RAISE EXCEPTION 'eligibility_blocked:account_age_too_low';
    END IF;
  END IF;

  SELECT COALESCE(ROUND(total_score)::INT, 0)
    INTO v_xnscore
  FROM public.xn_scores
  WHERE user_id = v_user_id;
  IF v_xnscore IS NULL THEN v_xnscore := 0; END IF;

  SELECT COUNT(*)::INT INTO v_completed_circles
  FROM public.circle_members cm
  WHERE cm.user_id = v_user_id
    AND cm.status = 'completed';

  IF v_xnscore < v_product.min_xnscore THEN
    RAISE EXCEPTION 'eligibility_blocked:xnscore_too_low';
  END IF;
  IF v_completed_circles < COALESCE(v_product.min_completed_circles, 0) THEN
    RAISE EXCEPTION 'eligibility_blocked:not_enough_completed_circles';
  END IF;

  -- Mig 354 — Fix A. Late-payment gate. Product carries the required
  -- ontime-cycles count in min_recent_ontime_cycles; 0 disables. Any
  -- late/missed contribution in the last 60 days blocks the advance
  -- (mirrors "no late penalties in last 2 cycles" from Doc 36 §3).
  IF COALESCE(v_product.min_recent_ontime_cycles, 0) > 0 THEN
    SELECT public.recent_late_contribution_count(v_user_id) INTO v_recent_late;
    IF v_recent_late > 0 THEN
      RAISE EXCEPTION 'eligibility_blocked:recent_late_contributions';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_active_count
  FROM public.loans
  WHERE user_id = v_user_id
    AND status = 'active'::loan_status;
  IF v_active_count >= 3 THEN
    RAISE EXCEPTION 'eligibility_blocked:too_many_active_advances';
  END IF;

  IF p_requested_amount_cents < v_product.min_amount_cents THEN
    RAISE EXCEPTION 'eligibility_blocked:amount_below_min';
  END IF;
  IF p_requested_amount_cents > v_product.max_amount_cents THEN
    RAISE EXCEPTION 'eligibility_blocked:amount_above_max';
  END IF;
  v_principal := p_requested_amount_cents;

  v_term := COALESCE(p_term_months, v_product.min_term_months);
  IF v_term < v_product.min_term_months THEN
    v_term := v_product.min_term_months;
  END IF;
  IF v_term > v_product.max_term_months THEN
    v_term := v_product.max_term_months;
  END IF;
  IF v_term IS NULL OR v_term < 1 THEN v_term := 1; END IF;

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
      WHEN 'mortgage'     THEN 'other'::loan_product_purpose
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

REVOKE ALL ON FUNCTION public.request_advance(TEXT, BIGINT, INT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_advance(TEXT, BIGINT, INT, TEXT, UUID) TO authenticated;

-- ─── 5. check_advance_eligibility — add late-payment gate ─────────────────
-- Body verbatim from mig 184 with the new IF block after completed-circles.

CREATE OR REPLACE FUNCTION public.check_advance_eligibility(
  p_ui_code      TEXT,
  p_amount_cents BIGINT DEFAULT NULL,
  p_user_id      UUID   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id            UUID;
  v_kyc_status         TEXT;
  v_account_age_days   INT;
  v_xnscore            INT;
  v_completed_circles  INT := 0;
  v_recent_late        INT := 0;
  v_db_code            TEXT;
  v_product            public.loan_products%ROWTYPE;
  v_active_count       INT;
  v_reason             TEXT := NULL;
  v_recommended_cents  BIGINT;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('eligible', FALSE, 'reason', 'auth_required');
  END IF;

  v_db_code := CASE p_ui_code
    WHEN 'contribution' THEN 'circle_boost'
    WHEN 'quick'        THEN 'micro_emergency'
    WHEN 'flex'         THEN 'education'
    WHEN 'premium'      THEN 'small_business'
    WHEN 'mortgage'     THEN 'home_country_mortgage'
    ELSE NULL
  END;
  IF v_db_code IS NULL THEN
    RETURN jsonb_build_object('eligible', FALSE, 'reason', 'unknown_product');
  END IF;

  SELECT * INTO v_product
  FROM public.loan_products
  WHERE code = v_db_code;
  IF v_product.id IS NULL THEN
    RETURN jsonb_build_object('eligible', FALSE, 'reason', 'product_not_configured');
  END IF;
  IF NOT v_product.is_active THEN
    RETURN jsonb_build_object('eligible', FALSE, 'reason', 'product_inactive');
  END IF;

  -- KYC
  SELECT status
    INTO v_kyc_status
    FROM public.kyc_verifications
   WHERE member_id = v_user_id
   ORDER BY created_at DESC NULLS LAST
   LIMIT 1;
  IF v_kyc_status IS NULL OR v_kyc_status <> 'approved' THEN
    v_reason := 'kyc_required';
  END IF;

  -- Account age
  IF v_reason IS NULL AND COALESCE(v_product.min_account_age_days, 0) > 0 THEN
    SELECT EXTRACT(DAY FROM (now() - p.created_at))::INT
      INTO v_account_age_days
      FROM public.profiles p
     WHERE p.id = v_user_id;
    IF v_account_age_days IS NULL OR v_account_age_days < v_product.min_account_age_days THEN
      v_reason := 'account_age_too_low';
    END IF;
  END IF;

  -- XnScore
  IF v_reason IS NULL THEN
    SELECT COALESCE(ROUND(total_score)::INT, 0)
      INTO v_xnscore
      FROM public.xn_scores
     WHERE user_id = v_user_id;
    IF v_xnscore IS NULL THEN v_xnscore := 0; END IF;
    IF v_xnscore < v_product.min_xnscore THEN
      v_reason := 'xnscore_too_low';
    END IF;
  END IF;

  -- Completed circles
  IF v_reason IS NULL THEN
    SELECT COUNT(*)::INT INTO v_completed_circles
      FROM public.circle_members cm
     WHERE cm.user_id = v_user_id
       AND cm.status = 'completed';
    IF v_completed_circles < COALESCE(v_product.min_completed_circles, 0) THEN
      v_reason := 'not_enough_completed_circles';
    END IF;
  END IF;

  -- Mig 354 — Fix A. Late-payment gate.
  IF v_reason IS NULL AND COALESCE(v_product.min_recent_ontime_cycles, 0) > 0 THEN
    SELECT public.recent_late_contribution_count(v_user_id) INTO v_recent_late;
    IF v_recent_late > 0 THEN
      v_reason := 'recent_late_contributions';
    END IF;
  END IF;

  -- Concurrency cap
  IF v_reason IS NULL THEN
    SELECT COUNT(*) INTO v_active_count
      FROM public.loans
     WHERE user_id = v_user_id
       AND status = 'active'::loan_status;
    IF v_active_count >= 3 THEN
      v_reason := 'too_many_active_advances';
    END IF;
  END IF;

  IF v_reason IS NULL AND p_amount_cents IS NOT NULL THEN
    IF p_amount_cents < v_product.min_amount_cents THEN
      v_reason := 'amount_below_min';
    ELSIF p_amount_cents > v_product.max_amount_cents THEN
      v_reason := 'amount_above_max';
    END IF;
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN jsonb_build_object(
      'eligible', FALSE,
      'reason',   v_reason,
      'product_ui_code', p_ui_code,
      'product_db_code', v_db_code
    );
  END IF;

  v_recommended_cents := GREATEST(
    v_product.min_amount_cents,
    LEAST(v_product.max_amount_cents,
          FLOOR(v_product.max_amount_cents * 0.6)::BIGINT)
  );

  RETURN jsonb_build_object(
    'eligible', TRUE,
    'reason', NULL,
    'product_ui_code', p_ui_code,
    'product_db_code', v_db_code,
    'min_amount_cents', v_product.min_amount_cents,
    'max_amount_cents', v_product.max_amount_cents,
    'recommended_amount_cents', v_recommended_cents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_advance_eligibility(TEXT, BIGINT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_advance_eligibility(TEXT, BIGINT, UUID) TO authenticated;

-- ─── 6. get_advance_dashboard — add account-age + KYC + late gates ────────
-- Body verbatim from mig 350 except:
--   * Precompute account_age_days + kyc_status + recent_late once at top
--     of the function so the scored CTE can reference them without a
--     per-row join.
--   * scored CTE's eligible + disqualification_reason expressions grow
--     three new WHEN branches ordered by ergonomics (KYC last because
--     it's an admin-side blocker the user can't fix themselves).
--   * ui_codes CTE keeps mig 350's 5-row shape.

CREATE OR REPLACE FUNCTION public.get_advance_dashboard(p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_id           UUID;
  v_xnscore           INT;
  v_completed_circles INT := 0;
  v_account_age_days  INT := 0;    -- Mig 354
  v_kyc_ok            BOOLEAN := FALSE; -- Mig 354
  v_recent_late       INT := 0;    -- Mig 354
  v_outstanding_cents BIGINT := 0;
  v_next_payment      JSONB := NULL;
  v_active_advances   JSONB := '[]'::JSONB;
  v_past_advances     JSONB := '[]'::JSONB;
  v_products          JSONB := '[]'::JSONB;
  v_payload           JSONB;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT COALESCE(ROUND(total_score)::INT, 0) INTO v_xnscore
  FROM public.xn_scores
  WHERE user_id = v_user_id;
  IF v_xnscore IS NULL THEN v_xnscore := 0; END IF;

  SELECT COUNT(*)::INT INTO v_completed_circles
  FROM public.circle_members cm
  WHERE cm.user_id = v_user_id AND cm.status = 'completed';

  -- Mig 354 — account age (Fix B) once, so the scored CTE reads it.
  SELECT EXTRACT(DAY FROM (now() - p.created_at))::INT
    INTO v_account_age_days
    FROM public.profiles p
   WHERE p.id = v_user_id;
  IF v_account_age_days IS NULL THEN v_account_age_days := 0; END IF;

  -- Mig 354 — KYC (Fix B). Most-recent verification row wins; any status
  -- other than 'approved' is a block.
  SELECT (kv.status = 'approved') INTO v_kyc_ok
    FROM public.kyc_verifications kv
   WHERE kv.member_id = v_user_id
   ORDER BY kv.created_at DESC NULLS LAST
   LIMIT 1;
  IF v_kyc_ok IS NULL THEN v_kyc_ok := FALSE; END IF;

  -- Mig 354 — late-payment count (Fix A). Only consulted for products
  -- whose min_recent_ontime_cycles > 0; the count itself is cheap.
  SELECT public.recent_late_contribution_count(v_user_id) INTO v_recent_late;

  WITH active AS (
    SELECT
      l.id, lp.code AS db_code, lp.name AS product_name,
      l.principal_cents, l.total_outstanding_cents,
      l.next_payment_date, l.next_payment_amount_cents,
      l.status::TEXT AS status,
      l.days_past_due, l.is_delinquent,
      l.payments_made, l.payments_total
    FROM public.loans l
    LEFT JOIN public.loan_products lp ON lp.id = l.loan_product_id
    WHERE l.user_id = v_user_id
      AND l.status IN ('active'::loan_status, 'in_collections'::loan_status)
    ORDER BY l.next_payment_date NULLS LAST, l.created_at
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'loan_id', id, 'db_code', db_code, 'product_name', product_name,
      'principal_cents', principal_cents,
      'outstanding_cents', total_outstanding_cents,
      'next_payment_date', next_payment_date,
      'next_payment_cents', next_payment_amount_cents,
      'status', status,
      'days_past_due', days_past_due,
      'is_delinquent', is_delinquent,
      'payments_made', payments_made,
      'payments_total', payments_total
    )), '[]'::JSONB),
    COALESCE(SUM(total_outstanding_cents), 0)
  INTO v_active_advances, v_outstanding_cents
  FROM active;

  SELECT jsonb_build_object(
    'loan_id', l.id,
    'date', l.next_payment_date,
    'amount_cents', l.next_payment_amount_cents
  )
  INTO v_next_payment
  FROM public.loans l
  WHERE l.user_id = v_user_id
    AND l.status = 'active'::loan_status
    AND l.next_payment_date IS NOT NULL
  ORDER BY l.next_payment_date
  LIMIT 1;

  WITH closed_loans AS (
    SELECT
      l.id                       AS entry_id,
      'loan'                     AS source,
      lp.code                    AS db_code,
      lp.name                    AS product_name,
      l.principal_cents,
      COALESCE(l.closed_at, l.updated_at) AS closed_at,
      l.status::TEXT             AS status,
      l.closed_reason            AS reason
    FROM public.loans l
    LEFT JOIN public.loan_products lp ON lp.id = l.loan_product_id
    WHERE l.user_id = v_user_id
      AND l.status IN ('paid_off'::loan_status,
                       'defaulted'::loan_status,
                       'written_off'::loan_status)
  ),
  rejected_apps AS (
    SELECT
      la.id                       AS entry_id,
      'application'               AS source,
      lp.code                     AS db_code,
      lp.name                     AS product_name,
      la.requested_amount_cents   AS principal_cents,
      la.updated_at               AS closed_at,
      la.status::TEXT             AS status,
      la.status_reason            AS reason
    FROM public.loan_applications la
    LEFT JOIN public.loan_products lp ON lp.id = la.loan_product_id
    WHERE la.user_id = v_user_id
      AND la.status IN ('rejected'::loan_application_status,
                        'cancelled'::loan_application_status,
                        'expired'::loan_application_status)
  ),
  combined AS (
    SELECT * FROM closed_loans
    UNION ALL
    SELECT * FROM rejected_apps
    ORDER BY closed_at DESC NULLS LAST
    LIMIT 50
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'entry_id', entry_id,
    'source', source,
    'db_code', db_code,
    'product_name', product_name,
    'principal_cents', principal_cents,
    'closed_at', closed_at,
    'status', status,
    'reason', reason
  )), '[]'::JSONB)
  INTO v_past_advances
  FROM combined;

  WITH ui_codes AS (
    SELECT * FROM (VALUES
      ('contribution', 'circle_boost',          1),
      ('quick',        'micro_emergency',       2),
      ('flex',         'education',             3),
      ('premium',      'small_business',        4),
      ('mortgage',     'home_country_mortgage', 5)
    ) AS t(ui_code, db_code, ord)
  ),
  joined AS (
    SELECT
      uc.ui_code, uc.db_code, uc.ord,
      lp.id AS product_id, lp.name AS product_name,
      lp.description AS product_description,
      lp.min_xnscore, lp.min_account_age_days, lp.min_completed_circles,
      lp.min_recent_ontime_cycles, -- mig 354
      lp.min_amount_cents, lp.max_amount_cents,
      lp.min_term_months, lp.max_term_months,
      lp.base_apr_min, lp.base_apr_max,
      lp.origination_fee_percent,
      lp.is_active
    FROM ui_codes uc
    LEFT JOIN public.loan_products lp ON lp.code = uc.db_code
  ),
  scored AS (
    SELECT j.*,
      CASE
        WHEN j.base_apr_min IS NULL OR j.base_apr_max IS NULL THEN NULL
        WHEN v_xnscore <= j.min_xnscore THEN j.base_apr_max
        WHEN v_xnscore >= 100 THEN j.base_apr_min
        ELSE ROUND(
          j.base_apr_max
          - ((v_xnscore - j.min_xnscore)::NUMERIC
             / NULLIF(100 - j.min_xnscore, 0))
            * (j.base_apr_max - j.base_apr_min),
          2
        )
      END AS estimated_apr,
      CASE
        WHEN j.max_amount_cents IS NULL THEN NULL
        ELSE GREATEST(
          COALESCE(j.min_amount_cents, 0),
          (j.max_amount_cents * 60 / 100)
        )
      END AS recommended_amount_cents,
      CASE
        WHEN j.product_id IS NULL THEN FALSE
        WHEN NOT j.is_active THEN FALSE
        WHEN v_xnscore < j.min_xnscore THEN FALSE
        WHEN v_completed_circles < COALESCE(j.min_completed_circles, 0) THEN FALSE
        WHEN COALESCE(j.min_account_age_days, 0) > 0 AND v_account_age_days < j.min_account_age_days THEN FALSE -- mig 354
        WHEN COALESCE(j.min_recent_ontime_cycles, 0) > 0 AND v_recent_late > 0 THEN FALSE -- mig 354
        WHEN NOT v_kyc_ok THEN FALSE -- mig 354 — KYC last so higher-priority reasons surface first
        ELSE TRUE
      END AS eligible,
      CASE
        WHEN j.product_id IS NULL THEN 'product_not_configured'
        WHEN NOT j.is_active THEN 'product_inactive'
        WHEN v_xnscore < j.min_xnscore THEN 'xnscore_too_low'
        WHEN v_completed_circles < COALESCE(j.min_completed_circles, 0) THEN 'not_enough_completed_circles'
        WHEN COALESCE(j.min_account_age_days, 0) > 0 AND v_account_age_days < j.min_account_age_days THEN 'account_age_too_low' -- mig 354
        WHEN COALESCE(j.min_recent_ontime_cycles, 0) > 0 AND v_recent_late > 0 THEN 'recent_late_contributions' -- mig 354
        WHEN NOT v_kyc_ok THEN 'kyc_required' -- mig 354
        ELSE NULL
      END AS disqualification_reason,
      CASE
        WHEN j.product_id IS NULL THEN NULL
        WHEN v_xnscore < j.min_xnscore THEN j.min_xnscore - v_xnscore
        ELSE NULL
      END AS points_to_unlock
    FROM joined j
  )
  SELECT jsonb_agg(jsonb_build_object(
    'ui_code',                    s.ui_code,
    'db_code',                    s.db_code,
    'product_id',                 s.product_id,
    'name',                       s.product_name,
    'description',                s.product_description,
    'min_xnscore',                s.min_xnscore,
    'min_completed_circles',      s.min_completed_circles,
    'min_amount_cents',           s.min_amount_cents,
    'max_amount_cents',           s.max_amount_cents,
    'recommended_amount_cents',   s.recommended_amount_cents,
    'min_term_months',            s.min_term_months,
    'max_term_months',            s.max_term_months,
    'base_apr_min',               s.base_apr_min,
    'base_apr_max',               s.base_apr_max,
    'estimated_apr',              s.estimated_apr,
    'origination_fee_percent',    s.origination_fee_percent,
    'eligible',                   s.eligible,
    'disqualification_reason',    s.disqualification_reason,
    'points_to_unlock',           s.points_to_unlock
  ) ORDER BY s.ord)
  INTO v_products
  FROM scored s;

  v_payload := jsonb_build_object(
    'user_id', v_user_id,
    'xnscore', v_xnscore,
    'completed_circles', v_completed_circles,
    'account_age_days', v_account_age_days,  -- mig 354 diagnostic
    'kyc_ok', v_kyc_ok,                       -- mig 354 diagnostic
    'recent_late_contributions', v_recent_late, -- mig 354 diagnostic
    'products', COALESCE(v_products, '[]'::JSONB),
    'active_advances', COALESCE(v_active_advances, '[]'::JSONB),
    'past_advances', COALESCE(v_past_advances, '[]'::JSONB),
    'outstanding_balance_cents', v_outstanding_cents,
    'next_payment_due', v_next_payment,
    'computed_at', now()
  );

  RETURN v_payload;
END;
$function$;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '354',
  'advance_eligibility_alignment',
  ARRAY[
    '-- 354: Fix A (late-payment gate) + Fix B (dashboard KYC/age/late) + Fix C (seed alignment)'
  ]
)
ON CONFLICT (version) DO NOTHING;
