-- ═══════════════════════════════════════════════════════════════════════════
-- 350_advance_dashboard_add_mortgage.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Companion to mig 349. The home_country_mortgage row landed in
-- loan_products but AdvanceHubV2Screen didn't render it because
-- get_advance_dashboard uses a hardcoded 4-tuple ui_codes CTE
-- (contribution / quick / flex / premium — mig 145:121-127) rather
-- than a generic SELECT from loan_products.
--
-- This migration reproduces the live get_advance_dashboard function
-- body VERBATIM (captured via pg_get_functiondef on 2026-07-16),
-- adding one new row to the ui_codes CTE:
--
--   ('mortgage', 'home_country_mortgage', 5)
--
-- Nothing else changes. Existing 4 UI slots return exactly the same
-- shape as before. The new tuple flows through the existing joined /
-- scored / final jsonb_agg paths unchanged — mortgage becomes the
-- 5th entry in the products array, ordered after premium.
--
-- Risk: this RPC is read by every AdvanceHub / AdvanceDashboard
-- consumer. Additive-only edit + verbatim body preservation keeps
-- the blast radius to "one extra product card appears." Verified
-- post-apply by re-running the RPC and confirming all 5 cards come
-- back with their pre-mig fields intact.
--
-- Follow-up (Option B): add min_total_payouts_cents and
-- min_active_community_memberships columns to loan_products, extend
-- the `scored` CTE below with the extra gate conditions, populate
-- them on the mortgage row.
-- ═══════════════════════════════════════════════════════════════════════════

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

  -- 1. XnScore.
  SELECT COALESCE(ROUND(total_score)::INT, 0) INTO v_xnscore
  FROM public.xn_scores
  WHERE user_id = v_user_id;
  IF v_xnscore IS NULL THEN v_xnscore := 0; END IF;

  -- 2. Completed circles.
  SELECT COUNT(*)::INT INTO v_completed_circles
  FROM public.circle_members cm
  WHERE cm.user_id = v_user_id AND cm.status = 'completed';

  -- 3. Active advances (active + in_collections).
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

  -- 4. Next payment.
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

  -- 5. Past advances. UNION of (a) closed loans and (b) rejected
  --    applications that never landed a loans row.
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

  -- 6. Per-product cards (with recommended_amount_cents added).
  -- Migration 350: added ('mortgage', 'home_country_mortgage', 5)
  -- to the CTE. Everything downstream (`joined`, `scored`, final
  -- jsonb_agg) picks up the new row without further edits.
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
      -- Recommended amount: 60% of max, clamped to >= min. Null when the
      -- product isn't configured.
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
        ELSE TRUE
      END AS eligible,
      CASE
        WHEN j.product_id IS NULL THEN 'product_not_configured'
        WHEN NOT j.is_active THEN 'product_inactive'
        WHEN v_xnscore < j.min_xnscore THEN 'xnscore_too_low'
        WHEN v_completed_circles < COALESCE(j.min_completed_circles, 0) THEN 'not_enough_completed_circles'
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
  '350',
  'advance_dashboard_add_mortgage',
  ARRAY['-- 350: CREATE OR REPLACE get_advance_dashboard — add mortgage ui_code slot']
)
ON CONFLICT (version) DO NOTHING;
