-- 172_circle_autopay_execution.sql
-- =====================================================================
-- Phase 1 of Circle Contribution Autopay.
--
--   1. process_circle_autopay_wallet_debit(...)
--
--      Atomically debit the user's wallet AND insert the contributions
--      row. Locks user_wallets FOR UPDATE so two concurrent cron
--      invocations (or a manual contribution racing the cron) can't
--      double-debit. SECURITY DEFINER + locked-down search_path so
--      the EF can call it via service-role.
--
--      Returns jsonb so the EF can branch on success/failure without
--      reading PG error codes.
--
--   2. circle_autopay_configs.upcoming_notified_at TIMESTAMPTZ
--
--      Idempotency stamp for the T-2 "upcoming" notification sweep
--      in the EF. NULL → eligible to notify; non-NULL → already
--      notified for the current scheduled run. The EF resets this
--      column to NULL after each execution so the next cycle's
--      window can re-fire.
--
-- Schema notes verified against live shape on 2026-06-15:
--   - user_wallets.main_balance_cents is BIGINT NOT NULL.
--   - contributions.payment_method is TEXT (free-form), distinct from
--     payment_method_id (UUID, nullable).
--   - contributions.cycle_number drives cycle-level dedup; no FK to
--     circle_cycles (the schema joins via circle_id + cycle_number).
-- =====================================================================

-- ── 1. The wallet-debit fn ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_circle_autopay_wallet_debit(
  p_user_id      UUID,
  p_circle_id    UUID,
  p_member_id    UUID,
  p_cycle_number INTEGER,
  p_amount_cents INTEGER,
  p_due_date     DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_balance BIGINT;
  v_contribution_id UUID;
BEGIN
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid amount');
  END IF;

  -- Lock the wallet row. If the user has no wallet yet, that's a
  -- failure the caller should pause autopay on.
  SELECT main_balance_cents INTO v_balance
  FROM public.user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'wallet not found');
  END IF;

  IF v_balance < p_amount_cents THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('insufficient funds: have %s cents, need %s cents',
                      v_balance, p_amount_cents)
    );
  END IF;

  -- Debit. last_activity_at + updated_at gets honest for downstream
  -- analytics + the WalletContext realtime cache.
  UPDATE public.user_wallets
    SET main_balance_cents = main_balance_cents - p_amount_cents,
        last_activity_at = now(),
        updated_at = now()
    WHERE user_id = p_user_id;

  -- Insert the contribution. status='completed' so the cycle counter
  -- advances; payment_method='wallet' tags the source.
  INSERT INTO public.contributions (
    user_id, member_id, circle_id, cycle_number,
    amount, due_date, status,
    payment_method, paid_at, paid_date,
    created_at, updated_at
  )
  VALUES (
    p_user_id, p_member_id, p_circle_id, p_cycle_number,
    p_amount_cents::numeric / 100, p_due_date, 'completed',
    'wallet', now(), now(),
    now(), now()
  )
  RETURNING id INTO v_contribution_id;

  RETURN jsonb_build_object(
    'success', true,
    'contribution_id', v_contribution_id
  );
END;
$$;

-- Service-role only — the EF is the only legitimate caller. End-users
-- contribute through WalletContext.makeContribution which has its own
-- flow.
REVOKE ALL ON FUNCTION public.process_circle_autopay_wallet_debit(
  UUID, UUID, UUID, INTEGER, INTEGER, DATE
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_circle_autopay_wallet_debit(
  UUID, UUID, UUID, INTEGER, INTEGER, DATE
) TO service_role;

-- ── 2. Upcoming-notification idempotency stamp ───────────────────────
ALTER TABLE public.circle_autopay_configs
  ADD COLUMN IF NOT EXISTS upcoming_notified_at TIMESTAMPTZ;

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '172',
  'circle_autopay_execution',
  ARRAY['-- 172: circle_autopay_execution']
)
ON CONFLICT (version) DO NOTHING;
