-- ════════════════════════════════════════════════════════════════════════════
-- Migration 206: insurance_pool_optional
-- ════════════════════════════════════════════════════════════════════════════
-- Make the insurance pool feature truly optional, at two layers:
--
--   * Circle-level (admin/creator switch). New column
--     circles.insurance_pool_enabled. When FALSE, no contribution
--     in this circle gets withheld and no claim is paid.
--
--   * Member-level (each member opts in or out for themselves). New
--     column circle_members.participates_in_pool. When FALSE, the
--     member's own contributions are not withheld; they also receive
--     no pool coverage if they default.
--
-- Both gates are honored by updating the two existing functions
-- (process_pool_withholding from migration 041 / wired by 095, and
-- process_pool_coverage from migration 041). Two new RPCs let the
-- client flip the gates:
--
--   * set_circle_pool_enabled(p_circle_id, p_enabled)
--       SECURITY DEFINER, requires caller to be admin/creator/elder
--       of the circle. Updates circles.insurance_pool_enabled.
--
--   * set_member_pool_opt_in(p_circle_id, p_user_id, p_participates)
--       SECURITY DEFINER, self-only — auth.uid() must equal
--       p_user_id. Updates circle_members.participates_in_pool.
--
-- Every config flip writes an audit row into
-- insurance_pool_transactions with the new 'config_change' type. The
-- CHECK constraint on transaction_type is rewritten to admit the new
-- value. Amount is always 0; the meaningful payload is in metadata.
--
-- Self-registers in supabase_migrations.schema_migrations.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Schema additions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS insurance_pool_enabled BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.circle_members
  ADD COLUMN IF NOT EXISTS participates_in_pool BOOLEAN NOT NULL DEFAULT TRUE;

-- Extend the transaction_type CHECK to admit 'config_change'.
ALTER TABLE public.insurance_pool_transactions
  DROP CONSTRAINT IF EXISTS insurance_pool_transactions_transaction_type_check;

ALTER TABLE public.insurance_pool_transactions
  ADD CONSTRAINT insurance_pool_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'withholding', 'coverage_payout', 'distribution', 'rollover',
    'config_change'
  ));


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Rewrite process_pool_withholding to honor the two new flags.
-- ─────────────────────────────────────────────────────────────────────────────
-- Net behavior change: returns withheld_cents=0 with a reason field
-- when withholding is skipped. Existing callers (trigger 095) ignore
-- the return JSON other than for logging, so this is backward-safe.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.process_pool_withholding(
  p_contribution_id UUID,
  p_amount_cents BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_id UUID;
  v_user_id UUID;
  v_pool RECORD;
  v_withheld BIGINT;
  v_new_balance BIGINT;
  v_circle_enabled BOOLEAN;
  v_member_opted_in BOOLEAN;
BEGIN
  SELECT circle_id, user_id
  INTO v_circle_id, v_user_id
  FROM public.cycle_contributions
  WHERE id = p_contribution_id;

  IF v_circle_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Contribution not found',
      'withheld_cents', 0,
      'net_amount_cents', p_amount_cents,
      'pool_balance_cents', 0
    );
  END IF;

  -- Circle-level gate.
  SELECT insurance_pool_enabled INTO v_circle_enabled
  FROM public.circles
  WHERE id = v_circle_id;
  IF v_circle_enabled = FALSE THEN
    RETURN jsonb_build_object(
      'withheld_cents', 0,
      'net_amount_cents', p_amount_cents,
      'pool_balance_cents', 0,
      'reason', 'circle_pool_disabled'
    );
  END IF;

  -- Member-level gate.
  SELECT participates_in_pool INTO v_member_opted_in
  FROM public.circle_members
  WHERE circle_id = v_circle_id AND user_id = v_user_id;
  IF v_member_opted_in = FALSE THEN
    RETURN jsonb_build_object(
      'withheld_cents', 0,
      'net_amount_cents', p_amount_cents,
      'pool_balance_cents', 0,
      'reason', 'member_opted_out'
    );
  END IF;

  -- Get or create the pool (preserves migration 041's belt-and-suspenders).
  SELECT * INTO v_pool
  FROM public.circle_insurance_pools
  WHERE circle_id = v_circle_id;

  IF v_pool IS NULL THEN
    INSERT INTO public.circle_insurance_pools (circle_id)
    VALUES (v_circle_id)
    ON CONFLICT (circle_id) DO NOTHING
    RETURNING * INTO v_pool;

    IF v_pool IS NULL THEN
      SELECT * INTO v_pool
      FROM public.circle_insurance_pools
      WHERE circle_id = v_circle_id;
    END IF;
  END IF;

  IF v_pool.status != 'active' THEN
    RETURN jsonb_build_object(
      'withheld_cents', 0,
      'net_amount_cents', p_amount_cents,
      'pool_balance_cents', v_pool.balance_cents,
      'pool_status', v_pool.status
    );
  END IF;

  v_withheld := ROUND(p_amount_cents * v_pool.current_rate);
  v_new_balance := v_pool.balance_cents + v_withheld;

  UPDATE public.circle_insurance_pools
  SET
    balance_cents = v_new_balance,
    total_withheld_cents = total_withheld_cents + v_withheld,
    updated_at = NOW()
  WHERE id = v_pool.id;

  INSERT INTO public.insurance_pool_transactions (
    pool_id, circle_id, transaction_type, amount_cents,
    running_balance_cents, contribution_id, user_id, description
  ) VALUES (
    v_pool.id, v_circle_id, 'withholding', v_withheld,
    v_new_balance, p_contribution_id, v_user_id,
    'Insurance pool withholding at ' || (v_pool.current_rate * 100)::TEXT || '% rate'
  );

  RETURN jsonb_build_object(
    'withheld_cents', v_withheld,
    'net_amount_cents', p_amount_cents - v_withheld,
    'pool_balance_cents', v_new_balance,
    'rate_applied', v_pool.current_rate
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Rewrite process_pool_coverage to deny claims for opted-out members.
-- ─────────────────────────────────────────────────────────────────────────────
-- A defaulter who opted out of the pool cannot benefit from its
-- coverage. The function returns approved_cents=0 with reason
-- 'defaulter_opted_out' so the default-cascade can flow into
-- elder vouching or whatever the next step is.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.process_pool_coverage(p_default_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_default RECORD;
  v_pool RECORD;
  v_shortfall_cents BIGINT;
  v_max_coverage_cents BIGINT;
  v_approved_cents BIGINT;
  v_coverage_pct DECIMAL(5,4);
  v_claim_id UUID;
  v_new_balance BIGINT;
  v_claim_status TEXT;
  v_circle_enabled BOOLEAN;
  v_member_opted_in BOOLEAN;
BEGIN
  SELECT * INTO v_default
  FROM public.defaults
  WHERE id = p_default_id;

  IF v_default IS NULL THEN
    RETURN jsonb_build_object('error', 'Default not found', 'approved_cents', 0);
  END IF;

  -- Circle-level gate.
  SELECT insurance_pool_enabled INTO v_circle_enabled
  FROM public.circles WHERE id = v_default.circle_id;
  IF v_circle_enabled = FALSE THEN
    RETURN jsonb_build_object(
      'approved_cents', 0,
      'coverage_pct', 0,
      'claim_status', 'denied',
      'reason', 'circle_pool_disabled'
    );
  END IF;

  -- Member-level gate.
  SELECT participates_in_pool INTO v_member_opted_in
  FROM public.circle_members
  WHERE circle_id = v_default.circle_id AND user_id = v_default.user_id;
  IF v_member_opted_in = FALSE THEN
    RETURN jsonb_build_object(
      'approved_cents', 0,
      'coverage_pct', 0,
      'claim_status', 'denied',
      'reason', 'defaulter_opted_out'
    );
  END IF;

  SELECT * INTO v_pool
  FROM public.circle_insurance_pools
  WHERE circle_id = v_default.circle_id;

  IF v_pool IS NULL OR v_pool.balance_cents <= 0 OR v_pool.status != 'active' THEN
    RETURN jsonb_build_object(
      'approved_cents', 0,
      'coverage_pct', 0,
      'reason', CASE
        WHEN v_pool IS NULL THEN 'No insurance pool for this circle'
        WHEN v_pool.balance_cents <= 0 THEN 'Insurance pool depleted'
        ELSE 'Insurance pool not active (status: ' || v_pool.status || ')'
      END
    );
  END IF;

  v_shortfall_cents := ROUND(v_default.total_owed * 100);
  v_max_coverage_cents := ROUND(v_shortfall_cents * 0.80);
  v_approved_cents := LEAST(v_max_coverage_cents, v_pool.balance_cents);

  IF v_approved_cents >= v_max_coverage_cents THEN
    v_claim_status := 'approved';
  ELSIF v_approved_cents > 0 THEN
    v_claim_status := 'partial';
  ELSE
    v_claim_status := 'denied';
  END IF;

  IF v_shortfall_cents > 0 THEN
    v_coverage_pct := v_approved_cents::DECIMAL / v_shortfall_cents;
  ELSE
    v_coverage_pct := 0;
  END IF;

  v_new_balance := v_pool.balance_cents - v_approved_cents;

  INSERT INTO public.insurance_coverage_claims (
    pool_id, circle_id, default_id, cycle_id, defaulter_user_id,
    shortfall_amount_cents, max_coverage_cents, approved_amount_cents,
    coverage_pct, pool_balance_before_cents, pool_balance_after_cents,
    status, processed_at
  ) VALUES (
    v_pool.id, v_default.circle_id, p_default_id, v_default.cycle_id,
    v_default.user_id,
    v_shortfall_cents, v_max_coverage_cents, v_approved_cents,
    v_coverage_pct, v_pool.balance_cents, v_new_balance,
    v_claim_status, NOW()
  )
  RETURNING id INTO v_claim_id;

  UPDATE public.circle_insurance_pools
  SET
    balance_cents = v_new_balance,
    total_paid_out_cents = total_paid_out_cents + v_approved_cents,
    total_claims = total_claims + 1,
    approved_claims = CASE WHEN v_approved_cents > 0
      THEN approved_claims + 1 ELSE approved_claims END,
    status = CASE WHEN v_new_balance <= 0 THEN 'depleted' ELSE status END,
    updated_at = NOW()
  WHERE id = v_pool.id;

  IF v_approved_cents > 0 THEN
    INSERT INTO public.insurance_pool_transactions (
      pool_id, circle_id, transaction_type, amount_cents,
      running_balance_cents, default_id, claim_id,
      user_id, description
    ) VALUES (
      v_pool.id, v_default.circle_id, 'coverage_payout',
      -v_approved_cents,
      v_new_balance, p_default_id, v_claim_id,
      v_default.user_id,
      'Default coverage: ' || v_claim_status || ' (' ||
        ROUND(v_coverage_pct * 100, 1) || '% of shortfall)'
    );
  END IF;

  RETURN jsonb_build_object(
    'claim_id', v_claim_id,
    'approved_cents', v_approved_cents,
    'coverage_pct', v_coverage_pct,
    'claim_status', v_claim_status,
    'pool_balance_before', v_pool.balance_cents,
    'pool_balance_after', v_new_balance,
    'shortfall_cents', v_shortfall_cents,
    'max_coverage_cents', v_max_coverage_cents
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. set_circle_pool_enabled — admin/creator/elder toggle.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_circle_pool_enabled(
  p_circle_id UUID,
  p_enabled   BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_old_value   BOOLEAN;
  v_pool        RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  SELECT role INTO v_caller_role
  FROM public.circle_members
  WHERE circle_id = p_circle_id
    AND user_id = auth.uid()
    AND status = 'active';

  IF v_caller_role IS NULL OR v_caller_role NOT IN ('admin', 'creator', 'elder') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'not_authorized');
  END IF;

  SELECT insurance_pool_enabled INTO v_old_value
  FROM public.circles WHERE id = p_circle_id;

  IF v_old_value IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'circle_not_found');
  END IF;

  IF v_old_value = p_enabled THEN
    RETURN jsonb_build_object('success', TRUE, 'no_op', TRUE, 'enabled', p_enabled);
  END IF;

  UPDATE public.circles
  SET insurance_pool_enabled = p_enabled, updated_at = NOW()
  WHERE id = p_circle_id;

  -- Audit row. Best-effort: a missing pool shouldn't block the toggle.
  BEGIN
    SELECT * INTO v_pool FROM public.circle_insurance_pools WHERE circle_id = p_circle_id;
    IF v_pool IS NOT NULL THEN
      INSERT INTO public.insurance_pool_transactions (
        pool_id, circle_id, transaction_type, amount_cents,
        running_balance_cents, user_id, description, metadata
      ) VALUES (
        v_pool.id, p_circle_id, 'config_change', 0,
        v_pool.balance_cents, auth.uid(),
        CASE WHEN p_enabled THEN 'Pool enabled by admin' ELSE 'Pool disabled by admin' END,
        jsonb_build_object(
          'action', 'circle_toggle',
          'new_value', p_enabled,
          'old_value', v_old_value,
          'actor_role', v_caller_role
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'audit write failed for set_circle_pool_enabled %: %', p_circle_id, SQLERRM;
  END;

  RETURN jsonb_build_object('success', TRUE, 'enabled', p_enabled);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. set_member_pool_opt_in — self-only opt-in/out.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_member_pool_opt_in(
  p_circle_id   UUID,
  p_user_id     UUID,
  p_participates BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_old_value BOOLEAN;
  v_pool      RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'unauthenticated');
  END IF;

  -- Self-only.
  IF auth.uid() != p_user_id THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'self_only');
  END IF;

  SELECT participates_in_pool INTO v_old_value
  FROM public.circle_members
  WHERE circle_id = p_circle_id AND user_id = p_user_id;

  IF v_old_value IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'membership_not_found');
  END IF;

  IF v_old_value = p_participates THEN
    RETURN jsonb_build_object(
      'success', TRUE, 'no_op', TRUE, 'participates', p_participates
    );
  END IF;

  UPDATE public.circle_members
  SET participates_in_pool = p_participates
  WHERE circle_id = p_circle_id AND user_id = p_user_id;

  BEGIN
    SELECT * INTO v_pool FROM public.circle_insurance_pools WHERE circle_id = p_circle_id;
    IF v_pool IS NOT NULL THEN
      INSERT INTO public.insurance_pool_transactions (
        pool_id, circle_id, transaction_type, amount_cents,
        running_balance_cents, user_id, description, metadata
      ) VALUES (
        v_pool.id, p_circle_id, 'config_change', 0,
        v_pool.balance_cents, p_user_id,
        CASE WHEN p_participates THEN 'Member opted in' ELSE 'Member opted out' END,
        jsonb_build_object(
          'action', 'member_toggle',
          'new_value', p_participates,
          'old_value', v_old_value,
          'target_user_id', p_user_id
        )
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'audit write failed for set_member_pool_opt_in (%, %): %', p_circle_id, p_user_id, SQLERRM;
  END;

  RETURN jsonb_build_object('success', TRUE, 'participates', p_participates);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Grant execute to authenticated. SECURITY DEFINER does the role gating.
-- ─────────────────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.set_circle_pool_enabled(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_pool_opt_in(UUID, UUID, BOOLEAN) TO authenticated;


-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '206',
  'insurance_pool_optional',
  ARRAY['-- 206: insurance_pool_optional']
)
ON CONFLICT (version) DO NOTHING;
