-- ═══════════════════════════════════════════════════════════════════════════
-- 356_advance_one_active_and_target_cycle.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 36 Phase 1 — repayment infrastructure, part 2 of 4.
--
-- Two related enforcements:
--
-- (a) Strict one-active-loan cap. mig 354's request_advance +
--     check_advance_eligibility currently reject when a member has ≥3
--     active loans. Doc 36 tightens this: only ONE active advance at a
--     time per member. The prior ≥3 gate stays as an outer safety net
--     ("belt") — the 1-cap becomes the primary check.
--     Defense-in-depth: a partial unique index enforces the same rule at
--     the DB level in case any code path ever bypasses the RPC.
--
-- (b) Bind advances to a specific payout cycle. request_advance now
--     accepts an optional p_target_cycle_id. If omitted, the server
--     defaults to the member's earliest upcoming cycle they are the
--     recipient of, ordered by expected_payout_date then id. The value
--     is written to loans.target_cycle_id (added by mig 355) so
--     execute_cycle_payout (mig 357) can find it.
--
-- Both RPCs' bodies are byte-identical to mig 354 except for:
--   * the new active_advance_exists gate inserted before the ≥3 check
--   * (request_advance only) the new p_target_cycle_id parameter,
--     resolution logic, and INSERT INTO loans (..., target_cycle_id)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Partial unique index — defense-in-depth ───────────────────────────
-- One active loan per member, regardless of source. Postgres will raise
-- 23505 (unique_violation) if any code path attempts to insert a second
-- 'active' loan for a user who already has one. RPCs catch this earlier
-- with a clean error message; this is the backstop.

CREATE UNIQUE INDEX IF NOT EXISTS one_active_loan_per_member
  ON public.loans (user_id)
  WHERE status = 'active'::loan_status;

-- ─── 2. check_advance_eligibility — add 1-active gate ─────────────────────
-- Body verbatim from mig 354 except:
--   * new v_active_count check (≥1) inserted BEFORE the existing ≥3 check
--   * new reason string 'active_advance_exists' surfaces before
--     'too_many_active_advances' (which stays as safety net)

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

  -- Mig 356 — 1-active-loan gate. Precedes the ≥3 safety net so members
  -- with 1 or 2 active loans see the tighter, more informative reason
  -- ("active_advance_exists") rather than the outer bound.
  IF v_reason IS NULL THEN
    SELECT COUNT(*) INTO v_active_count
      FROM public.loans
     WHERE user_id = v_user_id
       AND status = 'active'::loan_status;
    IF v_active_count >= 1 THEN
      v_reason := 'active_advance_exists';
    END IF;
  END IF;

  -- Legacy ≥3 safety net. Mig 354's cap. Should be unreachable with the
  -- 1-cap above active, but kept so removing the 1-cap in a future rollout
  -- doesn't silently drop the belt.
  IF v_reason IS NULL THEN
    IF v_active_count IS NULL THEN
      SELECT COUNT(*) INTO v_active_count
        FROM public.loans
       WHERE user_id = v_user_id
         AND status = 'active'::loan_status;
    END IF;
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

-- ─── 3. request_advance — add 1-active gate + p_target_cycle_id ───────────
-- Body verbatim from mig 354 except:
--   * new p_target_cycle_id parameter (appended at end so existing callers
--     using named args keep working)
--   * new v_target_cycle_id resolution block
--   * new active_advance_exists gate before the ≥3 safety net
--   * INSERT INTO loans adds target_cycle_id column

CREATE OR REPLACE FUNCTION public.request_advance(
  p_ui_code                 TEXT,
  p_requested_amount_cents  BIGINT,
  p_term_months             INT  DEFAULT NULL,
  p_repayment_preference    TEXT DEFAULT 'payout_withholding',
  p_user_id                 UUID DEFAULT NULL,
  p_target_cycle_id         UUID DEFAULT NULL
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
  v_target_cycle_id    UUID;
  v_cycle_owner        UUID;
  v_cycle_paid         DATE;
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

  -- Mig 354 — Fix A. Late-payment gate.
  IF COALESCE(v_product.min_recent_ontime_cycles, 0) > 0 THEN
    SELECT public.recent_late_contribution_count(v_user_id) INTO v_recent_late;
    IF v_recent_late > 0 THEN
      RAISE EXCEPTION 'eligibility_blocked:recent_late_contributions';
    END IF;
  END IF;

  -- Mig 356 — 1-active-loan gate (primary). Any status='active' loan
  -- blocks a new advance. Doc 36 §3 Phase 1 policy.
  SELECT COUNT(*) INTO v_active_count
  FROM public.loans
  WHERE user_id = v_user_id
    AND status = 'active'::loan_status;
  IF v_active_count >= 1 THEN
    RAISE EXCEPTION 'eligibility_blocked:active_advance_exists';
  END IF;

  -- Mig 184's ≥3 belt. Unreachable given the 1-cap above; retained so
  -- removing the 1-cap later doesn't silently drop the safety net.
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

  -- Mig 356 — resolve v_target_cycle_id. Caller-supplied wins; else
  -- default to member's earliest upcoming cycle where they are the
  -- recipient, ordered by expected_payout_date NULLS LAST, id.
  IF p_target_cycle_id IS NOT NULL THEN
    SELECT cc.recipient_user_id, cc.actual_payout_date
      INTO v_cycle_owner, v_cycle_paid
    FROM public.circle_cycles cc
    WHERE cc.id = p_target_cycle_id;
    IF v_cycle_owner IS NULL THEN
      RAISE EXCEPTION 'invalid_target_cycle:not_found';
    END IF;
    IF v_cycle_owner IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION 'invalid_target_cycle:not_recipient';
    END IF;
    IF v_cycle_paid IS NOT NULL THEN
      RAISE EXCEPTION 'invalid_target_cycle:already_paid';
    END IF;
    v_target_cycle_id := p_target_cycle_id;
  ELSE
    -- Default lookup. If the member has no upcoming payout cycle,
    -- v_target_cycle_id stays NULL and the loan falls to manual
    -- repayment — not an error, just a design choice.
    SELECT cc.id
      INTO v_target_cycle_id
    FROM public.circle_cycles cc
    WHERE cc.recipient_user_id = v_user_id
      AND cc.actual_payout_date IS NULL
    ORDER BY cc.expected_payout_date NULLS LAST, cc.id
    LIMIT 1;
  END IF;

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
    target_cycle_id,      -- Mig 356 — new column populated here
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
    v_target_cycle_id,
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
    'target_cycle_id', v_target_cycle_id,
    'repayment_schedule', v_schedule
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_advance(TEXT, BIGINT, INT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_advance(TEXT, BIGINT, INT, TEXT, UUID, UUID) TO authenticated;

-- Drop the mig 354 5-arg signature so callers can't accidentally target
-- the old shape. Signature disambiguation: keeping both would be a
-- footgun (an app that named-args `p_user_id` would resolve to the
-- 5-arg version and miss the target_cycle_id parameter entirely).
DROP FUNCTION IF EXISTS public.request_advance(TEXT, BIGINT, INT, TEXT, UUID);

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '356',
  'advance_one_active_and_target_cycle',
  ARRAY['-- 356: 1-active-loan cap + partial unique index + p_target_cycle_id parameter']
)
ON CONFLICT (version) DO NOTHING;
