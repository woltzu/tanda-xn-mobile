-- ═══════════════════════════════════════════════════════════════════════════
-- 361_execute_cycle_payout_reject_zero_collected.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phantom-payout guard. Root cause: mig 357's execute_cycle_payout uses
--   v_amount := COALESCE(v_cycle.payout_amount, v_cycle.collected_amount, 0);
-- If payout_amount is populated but collected_amount is 0, the RPC pays
-- out the payout_amount anyway — money-out with no money-in.
--
-- Surfaced by the 2026-07-14 TCP 4 cycle 3 incident: a rogue cycle row
-- was created (root cause of the extra cycle itself is deferred to
-- mig 362), its collected_amount was $0 while payout_amount was $450,
-- and execute_cycle_payout paid Franck $450 anyway. Cleaned up manually
-- on 2026-07-19; the guard here prevents recurrence at the RPC layer.
--
-- Mig 212 already has a `guard_zero_collected_payout` BEFORE-UPDATE-OF
-- trigger on circle_cycles that rewrites `ready_payout` transitions
-- with zero collected to `payout_failed`. That trigger only fires on
-- status transitions, so a direct call to execute_cycle_payout on a
-- cycle already in ready_payout (or any status) bypasses it. This
-- guard closes that gap at the RPC entry.
--
-- Body byte-identical to mig 357 except for the new IF block right
-- after the existing recipient check.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.execute_cycle_payout(p_cycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cycle              RECORD;
  v_circle             RECORD;
  v_circle_name        TEXT;
  v_payout_id          UUID;
  v_gross_cents        BIGINT;
  v_repayment_cents    BIGINT := 0;
  v_net_cents          BIGINT;
  v_amount             NUMERIC;
  v_existing           UUID;
  v_wallet_id          UUID;
  v_balance_before     BIGINT;
  v_balance_after_credit BIGINT;
  v_balance_after      BIGINT;
  v_wallet_tx_id       UUID;
  v_wallet_tx_debit_id UUID;
  v_circle_finalized   BOOLEAN := FALSE;
  v_loan_id            UUID;
  v_loan_outstanding   BIGINT;
  v_repay_receipt      JSONB;
BEGIN
  SELECT * INTO v_cycle FROM public.circle_cycles WHERE id = p_cycle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'cycle_not_found');
  END IF;
  IF v_cycle.recipient_user_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_recipient');
  END IF;

  -- Mig 361 — phantom-payout guard. Refuse to pay out on a cycle whose
  -- collected_amount is zero or NULL, regardless of what payout_amount
  -- says. Prevents the money-out-without-money-in class of bug.
  IF COALESCE(v_cycle.collected_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'no_contributions_collected');
  END IF;

  v_amount := COALESCE(v_cycle.payout_amount, v_cycle.collected_amount, 0);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'zero_amount');
  END IF;
  v_gross_cents := ROUND(v_amount * 100)::BIGINT;

  SELECT id INTO v_existing
    FROM public.circle_payouts
   WHERE cycle_id = p_cycle_id
      OR metadata->>'cycle_id' = p_cycle_id::text
   LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'payout_id', v_existing,
      'idempotent', TRUE
    );
  END IF;

  SELECT * INTO v_circle FROM public.circles WHERE id = v_cycle.circle_id;
  v_circle_name := COALESCE(v_circle.name, 'your circle');

  INSERT INTO public.circle_payouts (
    circle_id, cycle_id, cycle_number, recipient_id,
    amount, amount_cents, currency, status,
    payment_method, metadata, completed_at
  )
  VALUES (
    v_cycle.circle_id, v_cycle.id, v_cycle.cycle_number, v_cycle.recipient_user_id,
    v_amount, v_gross_cents, 'USD', 'completed',
    'internal_wallet',
    jsonb_build_object(
      'cycle_id',      v_cycle.id,
      'cycle_number',  v_cycle.cycle_number,
      'origin',        'execute_cycle_payout'
    ),
    NOW()
  )
  RETURNING id INTO v_payout_id;

  SELECT id, main_balance_cents INTO v_wallet_id, v_balance_before
    FROM public.user_wallets
   WHERE user_id = v_cycle.recipient_user_id
   FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.user_wallets (user_id, main_balance_cents)
    VALUES (v_cycle.recipient_user_id, 0)
    RETURNING id, main_balance_cents INTO v_wallet_id, v_balance_before;
  END IF;

  SELECT id, total_outstanding_cents
    INTO v_loan_id, v_loan_outstanding
  FROM public.loans
  WHERE user_id = v_cycle.recipient_user_id
    AND target_cycle_id = p_cycle_id
    AND status = 'active'::loan_status
    AND autopay_enabled = TRUE
  FOR UPDATE;

  IF v_loan_id IS NOT NULL AND COALESCE(v_loan_outstanding, 0) > 0 THEN
    v_repayment_cents := LEAST(
      FLOOR(v_gross_cents::NUMERIC * 0.80)::BIGINT,
      v_loan_outstanding
    );
  END IF;

  v_net_cents := v_gross_cents - v_repayment_cents;

  v_balance_after_credit := v_balance_before + v_gross_cents;
  v_balance_after        := v_balance_before + v_net_cents;

  UPDATE public.user_wallets
     SET main_balance_cents = v_balance_after,
         total_payouts_received_cents = COALESCE(total_payouts_received_cents, 0) + v_gross_cents,
         last_activity_at = NOW()
   WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, direction,
    amount_cents, balance_type,
    balance_before_cents, balance_after_cents,
    reference_type, reference_id,
    description, transaction_status, metadata
  )
  VALUES (
    v_wallet_id, v_cycle.recipient_user_id, 'circle_payout', 'credit',
    v_gross_cents, 'main',
    v_balance_before, v_balance_after_credit,
    'circle_payout', v_payout_id,
    'Payout from ' || v_circle_name,
    'completed',
    jsonb_build_object(
      'circle_id',     v_cycle.circle_id,
      'cycle_id',      v_cycle.id,
      'cycle_number',  v_cycle.cycle_number,
      'gross_cents',   v_gross_cents,
      'repayment_cents', v_repayment_cents,
      'net_cents',     v_net_cents
    )
  )
  RETURNING id INTO v_wallet_tx_id;

  IF v_repayment_cents > 0 THEN
    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, transaction_type, direction,
      amount_cents, balance_type,
      balance_before_cents, balance_after_cents,
      reference_type, reference_id,
      description, transaction_status, metadata
    )
    VALUES (
      v_wallet_id, v_cycle.recipient_user_id, 'advance_repayment', 'debit',
      v_repayment_cents, 'main',
      v_balance_after_credit, v_balance_after,
      'loan', v_loan_id,
      'Advance auto-repayment from ' || v_circle_name || ' payout',
      'completed',
      jsonb_build_object(
        'cycle_id',   v_cycle.id,
        'payout_id',  v_payout_id,
        'loan_id',    v_loan_id,
        'source',     'execute_cycle_payout',
        'cap_pct',    80,
        'gross_cents', v_gross_cents
      )
    )
    RETURNING id INTO v_wallet_tx_debit_id;

    SELECT public.process_advance_repayment(
      v_loan_id,
      v_repayment_cents,
      'payout',
      v_wallet_tx_debit_id,
      v_payout_id::text,
      v_cycle.recipient_user_id
    ) INTO v_repay_receipt;
  END IF;

  UPDATE public.circle_cycles
     SET actual_payout_date     = NOW()::DATE,
         payout_transaction_id  = v_payout_id::TEXT,
         payout_attempts        = COALESCE(payout_attempts, 0) + 1,
         last_payout_attempt_at = NOW(),
         last_payout_error      = NULL,
         updated_at             = NOW()
   WHERE id = p_cycle_id;

  IF v_circle.total_cycles IS NOT NULL
     AND v_cycle.cycle_number >= v_circle.total_cycles THEN
    UPDATE public.circles
       SET status           = 'completed',
           completed_at     = NOW(),
           cycles_completed = v_circle.total_cycles,
           updated_at       = NOW()
     WHERE id = v_cycle.circle_id
       AND status <> 'completed';
    v_circle_finalized := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success',            TRUE,
    'payout_id',          v_payout_id,
    'wallet_tx_id',       v_wallet_tx_id,
    'gross_cents',        v_gross_cents,
    'repayment_cents',    v_repayment_cents,
    'net_cents',          v_net_cents,
    'amount_cents',       v_gross_cents,
    'balance_after_cents', v_balance_after,
    'circle_finalized',   v_circle_finalized,
    'advance_repayment',  CASE
      WHEN v_repayment_cents > 0 THEN jsonb_build_object(
        'loan_id',           v_loan_id,
        'wallet_tx_debit_id', v_wallet_tx_debit_id,
        'receipt',           v_repay_receipt
      )
      ELSE NULL
    END
  );

EXCEPTION WHEN OTHERS THEN
  UPDATE public.circle_cycles
     SET last_payout_error      = LEFT(SQLERRM, 500),
         last_payout_attempt_at = NOW(),
         payout_attempts        = COALESCE(payout_attempts, 0) + 1
   WHERE id = p_cycle_id;
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '361',
  'execute_cycle_payout_reject_zero_collected',
  ARRAY['-- 361: phantom-payout guard on execute_cycle_payout']
)
ON CONFLICT (version) DO NOTHING;
