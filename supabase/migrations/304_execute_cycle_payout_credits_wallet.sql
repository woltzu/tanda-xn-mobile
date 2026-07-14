-- ═══════════════════════════════════════════════════════════════════════════
-- 304_execute_cycle_payout_credits_wallet.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- execute_cycle_payout previously inserted circle_payouts (status='completed')
-- and stamped circle_cycles but did NOT credit the recipient's internal
-- wallet. The RPC's own docblock claimed a downstream trigger would "fire
-- the wallet credit on the same INSERT" — but no such trigger exists on
-- circle_payouts (the only trigger there is notify_payout_received, which
-- writes a notifications row and stops). Cycles marked payout_completed
-- landed in circle_payouts with status=completed while recipients' wallet
-- balances and Recent Activity remained unchanged.
--
-- This migration rewrites the RPC so the wallet credit + balance update
-- happen atomically inside the same function-transaction as the payout
-- insert. If the wallet write throws, the circle_payouts insert is rolled
-- back too — no orphaned "payment completed" record without an actual
-- balance change (PL/pgSQL's BEGIN...EXCEPTION acts as an implicit
-- savepoint; on error, every INSERT/UPDATE inside the block is undone
-- before the handler stamps last_payout_error).
--
-- Also fixes a latent idempotency bug: the prior check only inspected
-- metadata->>'cycle_id'. The stripe-webhook auto-payout path inserts
-- circle_payouts rows with cycle_id in the actual column, not in metadata
-- — so a webhook-created row didn't block a duplicate insert from this
-- RPC. Now the check ORs both.
--
-- Auto-provisioning: if the recipient has no user_wallets row (happens
-- for users who never opened the Wallet tab), we insert one with the
-- payout amount as the initial main_balance_cents. Same pattern as
-- migration 302's create_goal auto-provision.
--
-- Runs SECURITY DEFINER — the cycle-progression-cron and admin paths
-- both invoke it. RLS on user_wallets/wallet_transactions is bypassed
-- since we're writing the recipient's row, not the caller's.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.execute_cycle_payout(p_cycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cycle              RECORD;
  v_circle_name        TEXT;
  v_payout_id          UUID;
  v_amount             NUMERIC;      -- dollars
  v_amount_cents       BIGINT;       -- cents
  v_existing           UUID;
  v_wallet_id          UUID;
  v_balance_before     BIGINT;
  v_balance_after      BIGINT;
  v_wallet_tx_id       UUID;
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
  v_amount_cents := ROUND(v_amount * 100)::BIGINT;

  -- Idempotency: any existing circle_payouts row for this cycle short-
  -- circuits. Check BOTH the cycle_id column (webhook auto-payout path)
  -- and metadata->>'cycle_id' (this RPC's own historical shape). Without
  -- the OR, a webhook-created row wouldn't block a duplicate from here.
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

  -- Resolve circle name for the wallet transaction description. Falls
  -- back to a generic label if the row is missing (shouldn't happen —
  -- FK to circles.id — but defensive).
  SELECT name INTO v_circle_name FROM public.circles WHERE id = v_cycle.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');

  -- ── 1. Insert circle_payouts (status='completed') ─────────────────────
  -- The notify_payout_received trigger fires here and creates the
  -- notifications row. Its own EXCEPTION handler swallows any failure,
  -- so it can't roll back this INSERT.
  INSERT INTO public.circle_payouts (
    circle_id, cycle_id, cycle_number, recipient_id,
    amount, amount_cents, currency, status,
    payment_method, metadata, completed_at
  )
  VALUES (
    v_cycle.circle_id, v_cycle.id, v_cycle.cycle_number, v_cycle.recipient_user_id,
    v_amount, v_amount_cents, 'USD', 'completed',
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
  -- New sign-ups who never opened the Wallet tab don't have a
  -- user_wallets row yet. Rather than fail the whole payout, insert
  -- one with a zero balance so the balance-before / balance-after
  -- math is well-defined below. RLS is bypassed via SECURITY DEFINER.
  SELECT id, main_balance_cents INTO v_wallet_id, v_balance_before
    FROM public.user_wallets
   WHERE user_id = v_cycle.recipient_user_id
   FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.user_wallets (user_id, main_balance_cents)
    VALUES (v_cycle.recipient_user_id, 0)
    RETURNING id, main_balance_cents INTO v_wallet_id, v_balance_before;
  END IF;

  v_balance_after := v_balance_before + v_amount_cents;

  -- ── 3. Update user_wallets balance ────────────────────────────────────
  -- Also bump total_payouts_received_cents so admin dashboards can
  -- see lifetime payout activity per member without an aggregate query.
  UPDATE public.user_wallets
     SET main_balance_cents = v_balance_after,
         total_payouts_received_cents = COALESCE(total_payouts_received_cents, 0) + v_amount_cents,
         last_activity_at = NOW()
   WHERE id = v_wallet_id;

  -- ── 4. Insert wallet_transactions ledger row ──────────────────────────
  -- balance_before/balance_after are the authoritative snapshot for
  -- reconciliation — the wallet_transactions table is append-only, so
  -- this trail lets an audit reconstruct any moment's balance without
  -- summing all prior rows.
  INSERT INTO public.wallet_transactions (
    wallet_id, user_id, transaction_type, direction,
    amount_cents, balance_type,
    balance_before_cents, balance_after_cents,
    reference_type, reference_id,
    description, transaction_status, metadata
  )
  VALUES (
    v_wallet_id, v_cycle.recipient_user_id, 'circle_payout', 'credit',
    v_amount_cents, 'main',
    v_balance_before, v_balance_after,
    'circle_payout', v_payout_id,
    'Payout from ' || v_circle_name,
    'completed',
    jsonb_build_object(
      'circle_id',     v_cycle.circle_id,
      'cycle_id',      v_cycle.id,
      'cycle_number',  v_cycle.cycle_number
    )
  )
  RETURNING id INTO v_wallet_tx_id;

  -- ── 5. Stamp the cycle ────────────────────────────────────────────────
  -- Don't touch cycle_status here — the cron owns that transition and
  -- will see actual_payout_date is set and move to payout_completed.
  UPDATE public.circle_cycles
     SET actual_payout_date     = NOW()::DATE,
         payout_transaction_id  = v_payout_id::TEXT,
         payout_attempts        = COALESCE(payout_attempts, 0) + 1,
         last_payout_attempt_at = NOW(),
         last_payout_error      = NULL,
         updated_at             = NOW()
   WHERE id = p_cycle_id;

  RETURN jsonb_build_object(
    'success',            TRUE,
    'payout_id',          v_payout_id,
    'wallet_tx_id',       v_wallet_tx_id,
    'amount_cents',       v_amount_cents,
    'balance_after_cents', v_balance_after
  );

EXCEPTION WHEN OTHERS THEN
  -- Rollback subsumes everything above (circle_payouts, user_wallets
  -- update, wallet_transactions). All-or-nothing: no orphaned "paid
  -- out" record without a wallet credit. Stamp the failure so the
  -- cron / admin can see what went wrong on the next attempt.
  UPDATE public.circle_cycles
     SET last_payout_error      = LEFT(SQLERRM, 500),
         last_payout_attempt_at = NOW(),
         payout_attempts        = COALESCE(payout_attempts, 0) + 1
   WHERE id = p_cycle_id;
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$function$;

-- Grants unchanged from the prior definition (SECURITY DEFINER + no
-- REVOKE means it's callable by any role that has been granted
-- EXECUTE by the schema owner — matching the earlier deploy).

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '304',
  'execute_cycle_payout_credits_wallet',
  ARRAY['-- 304: execute_cycle_payout inserts wallet_transactions + updates user_wallets']
)
ON CONFLICT (version) DO NOTHING;
