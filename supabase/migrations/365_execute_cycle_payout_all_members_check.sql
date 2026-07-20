-- ═══════════════════════════════════════════════════════════════════════════
-- 365_execute_cycle_payout_all_members_check.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Tightens execute_cycle_payout's guard: refuse to pay out unless every
-- expected member has a paid contribution row for the cycle. Closes the
-- manual-override path (fictional collected_amount, direct DB nudges
-- that skip the contribution write) that mig 361's phantom-payout
-- guard didn't cover.
--
-- History:
--   Mig 361 rejected `collected_amount <= 0`. Passes any cycle with a
--   nonzero amount, even if only one of N expected members paid.
--   Surfaced by the 2026-07-20 TCP2/TCP3 cycle-2 manual insertions:
--   collected_amount was set to $400 by hand, RPC paid out with zero
--   real contributions on record.
--
-- Design — counter-based guard (v_cycle.received_contributions) was
-- rejected in favor of counting from source at guard time. mig 308's
-- counter goes stale when a circle_cycles row is created AFTER
-- contributions have already been inserted (trigger fires on the
-- contribution insert but has no cycle row to update yet), and doesn't
-- handle DELETEs. Counting from source is one extra SELECT per payout
-- but bulletproof. Both source tables are consulted:
--   * circle_contributions (manual Stripe path)
--   * contributions (autopay path)
-- Deduplicated by user_id — a member with rows in both tables counts
-- once. Same UNION shape as mig 308's backfill.
--
-- Backfill:
--   Also recomputes received_contributions across all cycles so UI
--   progress displays reconcile with the source-of-truth count. Two
--   passes: one for cycles that have paid rows, one to zero out
--   cycles whose stored counter is a stale non-zero with no matching
--   paid rows. Idempotent — safe to re-run.
--
-- Body byte-identical to mig 361 except for the new IF block right
-- after the mig 361 guard.
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
  v_actual_paid        INT;
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

  -- Mig 365 — all-members-paid guard. Counts distinct paying user_ids
  -- from both source tables at guard time to avoid trusting the
  -- potentially-stale stored counter. Reject when fewer than
  -- expected_contributions members have paid.
  SELECT COUNT(DISTINCT user_id) INTO v_actual_paid
    FROM (
      SELECT user_id
        FROM public.circle_contributions
       WHERE circle_id = v_cycle.circle_id
         AND cycle_number = v_cycle.cycle_number
         AND status = 'paid'
      UNION
      SELECT user_id
        FROM public.contributions
       WHERE circle_id = v_cycle.circle_id
         AND cycle_number = v_cycle.cycle_number
         AND status = 'paid'
    ) paid_users;
  IF COALESCE(v_actual_paid, 0) < COALESCE(v_cycle.expected_contributions, 0) THEN
    RETURN jsonb_build_object(
      'success',  FALSE,
      'error',    'payout_blocked: not_all_members_contributed',
      'received', COALESCE(v_actual_paid, 0),
      'expected', COALESCE(v_cycle.expected_contributions, 0)
    );
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Backfill received_contributions across all cycles.
--   Pass 1 — bump every cycle that has paid rows to the accurate
--   distinct-user count.
--   Pass 2 — zero out any cycle whose stored counter is a stale
--   non-zero value but source tables show zero paid rows.
-- Both passes gate on IS DISTINCT FROM so a re-run is a no-op.
-- ═══════════════════════════════════════════════════════════════════════════

WITH counts AS (
  SELECT circle_id, cycle_number, COUNT(DISTINCT user_id) AS n
    FROM (
      SELECT circle_id, cycle_number, user_id
        FROM public.circle_contributions
       WHERE status = 'paid'
      UNION
      SELECT circle_id, cycle_number, user_id
        FROM public.contributions
       WHERE status = 'paid'
    ) src
   GROUP BY circle_id, cycle_number
)
UPDATE public.circle_cycles cc
   SET received_contributions = counts.n,
       updated_at             = NOW()
  FROM counts
 WHERE cc.circle_id    = counts.circle_id
   AND cc.cycle_number = counts.cycle_number
   AND cc.received_contributions IS DISTINCT FROM counts.n;

UPDATE public.circle_cycles cc
   SET received_contributions = 0,
       updated_at             = NOW()
 WHERE cc.received_contributions > 0
   AND NOT EXISTS (
     SELECT 1 FROM public.circle_contributions
      WHERE circle_id = cc.circle_id
        AND cycle_number = cc.cycle_number
        AND status = 'paid'
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.contributions
      WHERE circle_id = cc.circle_id
        AND cycle_number = cc.cycle_number
        AND status = 'paid'
   );

-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '365',
  'execute_cycle_payout_all_members_check',
  ARRAY['-- 365: all-members-paid guard on execute_cycle_payout + received_contributions recompute']
)
ON CONFLICT (version) DO NOTHING;
