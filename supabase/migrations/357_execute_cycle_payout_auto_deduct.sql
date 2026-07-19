-- ═══════════════════════════════════════════════════════════════════════════
-- 357_execute_cycle_payout_auto_deduct.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 36 Phase 1 — repayment infrastructure, part 3 of 4.
--
-- Extends execute_cycle_payout with an auto-deduct step. When the recipient
-- has an active loan bound to this cycle (loans.target_cycle_id = p_cycle_id
-- AND autopay_enabled = TRUE), some of the gross payout is redirected to
-- repay that loan before crediting the wallet.
--
-- Business rules:
--   * At most 80% of the gross payout can be diverted to repayment. This
--     preserves at least 20% of what the member expected — protects
--     against a scenario where a maxed-out advance would leave them with
--     nothing.
--   * Actual repayment = MIN(gross * 0.80, loan.total_outstanding). If
--     the loan is smaller than 80% of the payout, only the outstanding
--     balance is deducted; the member keeps the rest.
--   * Repayment allocation across principal/interest/fees is delegated
--     entirely to process_advance_repayment (mig 147), which already
--     implements the correct schedule walk + proportional split.
--   * Ledger writes:
--       - wallet_transactions row #1: credit for gross_payout
--         (unchanged from mig 310, keeps the member's audit trail intact)
--       - wallet_transactions row #2: debit for repayment_amount, with
--         reference_type='loan' + reference_id=loan_id
--       - process_advance_repayment handles the loan-side ledger
--         (loan_payments row, updated loans row, schedule rows)
--       - No pool_transactions writes — loans-based flow, not
--         liquidity_advances-based (see mig 355 header).
--   * Final wallet balance moves by gross - repayment (net).
--
-- Idempotency: the existing v_existing check at the top of the RPC guards
-- the whole flow. Repeat calls short-circuit before either credit or
-- debit runs. process_advance_repayment is itself resilient (walks
-- pending schedule rows; a no-op if the loan is fully paid).
--
-- Body is byte-identical to mig 310 EXCEPT for the new "3.5" block
-- inserted between wallet provisioning and the wallet balance update.
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
  -- Mig 357 — advance auto-deduct locals
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

  v_amount := COALESCE(v_cycle.payout_amount, v_cycle.collected_amount, 0);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'zero_amount');
  END IF;
  v_gross_cents := ROUND(v_amount * 100)::BIGINT;

  -- Idempotency: check BOTH the cycle_id column (webhook path) AND
  -- metadata->>'cycle_id' (this RPC's own historical shape).
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

  -- ── 1. Insert circle_payouts (status='completed') ─────────────────────
  -- Note: amount + amount_cents stay at the GROSS value. That row records
  -- what the payout was; the wallet_transactions rows separately record
  -- how much was auto-deducted.
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

  -- ── 2. Auto-provision recipient's wallet if missing ────────────────────
  SELECT id, main_balance_cents INTO v_wallet_id, v_balance_before
    FROM public.user_wallets
   WHERE user_id = v_cycle.recipient_user_id
   FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.user_wallets (user_id, main_balance_cents)
    VALUES (v_cycle.recipient_user_id, 0)
    RETURNING id, main_balance_cents INTO v_wallet_id, v_balance_before;
  END IF;

  -- ── 2.5 (Mig 357). Auto-deduct step — find bound loan, compute 80%
  -- cap, delegate to process_advance_repayment. This block runs BEFORE
  -- the wallet credit so the wallet balance and the two wallet_tx rows
  -- reflect gross → debit → net in the correct order.

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

  -- ── 3. Update user_wallets balance ────────────────────────────────────
  -- Move directly to the NET balance in one UPDATE. The two wallet_tx
  -- rows below narrate the movement (credit gross → debit repayment).
  v_balance_after_credit := v_balance_before + v_gross_cents;
  v_balance_after        := v_balance_before + v_net_cents;

  UPDATE public.user_wallets
     SET main_balance_cents = v_balance_after,
         total_payouts_received_cents = COALESCE(total_payouts_received_cents, 0) + v_gross_cents,
         last_activity_at = NOW()
   WHERE id = v_wallet_id;

  -- ── 4. Insert wallet_transactions ledger row (credit — gross payout) ───
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

  -- ── 4.5 (Mig 357). If we auto-deducted, insert the debit row and hand
  -- the loan-side bookkeeping to process_advance_repayment.
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

    -- Delegate the loan-side ledger + schedule updates to the existing
    -- mig 147 RPC. Passing p_user_id explicitly so the SECURITY DEFINER
    -- inheritance doesn't need auth.uid() (this runs from cron / webhook
    -- paths that have no request-level auth context).
    SELECT public.process_advance_repayment(
      v_loan_id,
      v_repayment_cents,
      'payout',
      v_wallet_tx_debit_id,
      v_payout_id::text,
      v_cycle.recipient_user_id
    ) INTO v_repay_receipt;
  END IF;

  -- ── 5. Stamp the cycle ────────────────────────────────────────────────
  UPDATE public.circle_cycles
     SET actual_payout_date     = NOW()::DATE,
         payout_transaction_id  = v_payout_id::TEXT,
         payout_attempts        = COALESCE(payout_attempts, 0) + 1,
         last_payout_attempt_at = NOW(),
         last_payout_error      = NULL,
         updated_at             = NOW()
   WHERE id = p_cycle_id;

  -- ── 6. Finalize the circle if this is the last cycle ──────────────────
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
    'amount_cents',       v_gross_cents,    -- back-compat alias
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

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '357',
  'execute_cycle_payout_auto_deduct',
  ARRAY['-- 357: execute_cycle_payout — 80% auto-deduct against target-cycle-bound loans']
)
ON CONFLICT (version) DO NOTHING;
