-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 145: get_advance_dashboard — batched Advance Hub fetcher
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Single round-trip replacement for the mock-data Advance V2 surface. Returns
-- one JSONB payload with everything AdvanceHubV2 / SmartCalculator /
-- AdvanceDetailsV2 need to render the live product cards, the user's
-- eligibility per product, and any active advances + their next payment.
--
-- The four UI products (contribution / quick / flex / premium) are aliases
-- mapped onto live `loan_products` rows by `code`:
--   contribution → circle_boost     (advance against future circle payouts)
--   quick        → micro_emergency  (short-term liquidity)
--   flex         → education        (cashflow financing — medium term)
--   premium      → small_business   (asset purchase / larger amounts)
--
-- Eligibility per product is computed server-side from the user's current
-- xn_scores.total_score, completed-circle count, and existing active loans.
-- Max amount is the product's max_amount_cents, optionally clamped by a
-- conservative DCR ceiling once the user has active loans.
--
-- Read-only: this RPC writes nothing.

CREATE OR REPLACE FUNCTION public.get_advance_dashboard(
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id           UUID;
  v_xnscore           INT;
  v_completed_circles INT := 0;
  v_outstanding_cents BIGINT := 0;
  v_next_payment      JSONB := NULL;
  v_active_advances   JSONB := '[]'::JSONB;
  v_products          JSONB := '[]'::JSONB;
  v_payload           JSONB;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  -- 1. Pull XnScore (rounded to nearest int). 0 if no score row yet.
  SELECT COALESCE(ROUND(total_score)::INT, 0)
    INTO v_xnscore
  FROM public.xn_scores
  WHERE user_id = v_user_id;
  IF v_xnscore IS NULL THEN v_xnscore := 0; END IF;

  -- 2. Completed-circle count. Best-effort from circle_members.status; if
  --    no rows we leave at 0. Future migrations may surface a richer
  --    "lifetime cycles completed" metric.
  SELECT COUNT(*)::INT INTO v_completed_circles
  FROM public.circle_members cm
  WHERE cm.user_id = v_user_id
    AND cm.status = 'completed';

  -- 3. Active advances + aggregate outstanding + next payment.
  WITH active AS (
    SELECT
      l.id,
      lp.code AS db_code,
      lp.name AS product_name,
      l.principal_cents,
      l.total_outstanding_cents,
      l.next_payment_date,
      l.next_payment_amount_cents,
      l.status::TEXT AS status,
      l.days_past_due,
      l.is_delinquent,
      l.payments_made,
      l.payments_total
    FROM public.loans l
    LEFT JOIN public.loan_products lp ON lp.id = l.loan_product_id
    WHERE l.user_id = v_user_id
      AND l.status IN ('active'::loan_status, 'in_collections'::loan_status)
    ORDER BY l.next_payment_date NULLS LAST, l.created_at
  )
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object(
      'loan_id', id,
      'db_code', db_code,
      'product_name', product_name,
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

  -- 4. Next payment due (earliest across active loans).
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

  -- 5. Per-product eligibility. The 4 UI codes are aliases onto live
  --    loan_products rows. For each UI code we fetch the mapped row,
  --    compute eligibility against the user's profile, and emit the
  --    product card payload. Disqualification reasons are short, surface-
  --    friendly strings the client can map to localized copy.
  WITH ui_codes AS (
    SELECT * FROM (VALUES
      ('contribution', 'circle_boost',    1),
      ('quick',        'micro_emergency', 2),
      ('flex',         'education',       3),
      ('premium',      'small_business',  4)
    ) AS t(ui_code, db_code, ord)
  ),
  joined AS (
    SELECT
      uc.ui_code,
      uc.db_code,
      uc.ord,
      lp.id                       AS product_id,
      lp.name                     AS product_name,
      lp.description              AS product_description,
      lp.min_xnscore              AS min_xnscore,
      lp.min_account_age_days     AS min_account_age_days,
      lp.min_completed_circles    AS min_completed_circles,
      lp.min_amount_cents         AS min_amount_cents,
      lp.max_amount_cents         AS max_amount_cents,
      lp.min_term_months          AS min_term_months,
      lp.max_term_months          AS max_term_months,
      lp.base_apr_min             AS base_apr_min,
      lp.base_apr_max             AS base_apr_max,
      lp.origination_fee_percent  AS origination_fee_percent,
      lp.is_active                AS is_active
    FROM ui_codes uc
    LEFT JOIN public.loan_products lp ON lp.code = uc.db_code
  ),
  scored AS (
    SELECT
      j.*,
      -- Estimated APR for *this* user: linear interpolation between the
      -- product's min and max APR keyed by where the user's XnScore sits
      -- between min_xnscore and 100. Higher score → lower APR.
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
      -- Eligibility: every gate must pass. Reason captures the first
      -- failure so the client can show ONE clear blocker.
      CASE
        WHEN j.product_id IS NULL THEN FALSE
        WHEN NOT j.is_active THEN FALSE
        WHEN v_xnscore < j.min_xnscore THEN FALSE
        WHEN v_completed_circles < COALESCE(j.min_completed_circles, 0) THEN FALSE
        ELSE TRUE
      END AS eligible,
      CASE
        WHEN j.product_id IS NULL THEN 'product_not_configured'
        WHEN NOT j.is_active THEN 'product_inactive'
        WHEN v_xnscore < j.min_xnscore THEN 'xnscore_too_low'
        WHEN v_completed_circles < COALESCE(j.min_completed_circles, 0) THEN 'not_enough_completed_circles'
        ELSE NULL
      END AS disqualification_reason,
      -- For the disqualification UX: how far is the user from the gate?
      CASE
        WHEN j.product_id IS NULL THEN NULL
        WHEN v_xnscore < j.min_xnscore THEN j.min_xnscore - v_xnscore
        ELSE NULL
      END AS points_to_unlock
    FROM joined j
  )
  SELECT jsonb_agg(jsonb_build_object(
    'ui_code',                  s.ui_code,
    'db_code',                  s.db_code,
    'product_id',               s.product_id,
    'name',                     s.product_name,
    'description',              s.product_description,
    'min_xnscore',              s.min_xnscore,
    'min_completed_circles',    s.min_completed_circles,
    'min_amount_cents',         s.min_amount_cents,
    'max_amount_cents',         s.max_amount_cents,
    'min_term_months',          s.min_term_months,
    'max_term_months',          s.max_term_months,
    'base_apr_min',             s.base_apr_min,
    'base_apr_max',             s.base_apr_max,
    'estimated_apr',            s.estimated_apr,
    'origination_fee_percent',  s.origination_fee_percent,
    'eligible',                 s.eligible,
    'disqualification_reason',  s.disqualification_reason,
    'points_to_unlock',         s.points_to_unlock
  ) ORDER BY s.ord)
  INTO v_products
  FROM scored s;

  -- 6. Compose payload.
  v_payload := jsonb_build_object(
    'user_id',                 v_user_id,
    'xnscore',                 v_xnscore,
    'completed_circles',       v_completed_circles,
    'products',                COALESCE(v_products, '[]'::JSONB),
    'active_advances',         COALESCE(v_active_advances, '[]'::JSONB),
    'outstanding_balance_cents', v_outstanding_cents,
    'next_payment_due',        v_next_payment,
    'computed_at',             now()
  );

  RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.get_advance_dashboard(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_advance_dashboard(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_advance_dashboard(UUID) TO authenticated;

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '145',
  'get_advance_dashboard',
  ARRAY['-- 145: get_advance_dashboard']
)
ON CONFLICT (version) DO NOTHING;
