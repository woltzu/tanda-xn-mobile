-- ═══════════════════════════════════════════════════════════════════════════
-- 310_execute_cycle_payout_finalizes_circle.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fixes A-backfill + B from the completion-loop plan.
--
-- A (backfill) — every prod circle currently has total_cycles NULL,
-- so the finalization block added below would never fire without a
-- seed value. Default rotating-pot rule: 1 payout per member, so
-- total_cycles = member_count. Same fallback used by the dead
-- ContributionSchedulingService.advanceCircle() code (see the
-- `circle.total_cycles || circle.max_members` expression at
-- services/ContributionSchedulingService.ts:783).
--
-- B — extend execute_cycle_payout (mig 304) with a finalization block:
-- when the just-paid cycle is the last cycle in the circle
-- (cycle_number >= circles.total_cycles), stamp the parent circle as
-- 'completed'. Fires exactly once because the RPC itself is
-- idempotent per cycle (short-circuits on repeat calls).
--
-- Circle creation continues to route through create_circle (mig 311
-- extends the RPC to accept p_total_cycles). Old signatures fall back
-- to member_count via COALESCE in that migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Backfill total_cycles on existing NULL rows ──────────────────────
-- Rotating-pot default: 1 payout per member.

UPDATE public.circles
   SET total_cycles = member_count,
       updated_at   = NOW()
 WHERE total_cycles IS NULL
   AND member_count IS NOT NULL
   AND member_count > 0;

-- ─── 2. Redefine execute_cycle_payout with the finalization block ────────
-- Byte-identical to mig 304 EXCEPT for the appended finalization
-- block right before the RETURN. Idempotent per cycle — the check at
-- line ~40 short-circuits before the wallet credit, so re-firing this
-- RPC on an already-paid cycle returns idempotent=TRUE and never
-- re-runs the finalization.

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
  v_amount             NUMERIC;
  v_amount_cents       BIGINT;
  v_existing           UUID;
  v_wallet_id          UUID;
  v_balance_before     BIGINT;
  v_balance_after      BIGINT;
  v_wallet_tx_id       UUID;
  v_circle_finalized   BOOLEAN := FALSE;
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

  -- Load parent circle for name + total_cycles gate (used at end).
  SELECT * INTO v_circle FROM public.circles WHERE id = v_cycle.circle_id;
  v_circle_name := COALESCE(v_circle.name, 'your circle');

  -- ── 1. Insert circle_payouts (status='completed') ─────────────────────
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
  UPDATE public.user_wallets
     SET main_balance_cents = v_balance_after,
         total_payouts_received_cents = COALESCE(total_payouts_received_cents, 0) + v_amount_cents,
         last_activity_at = NOW()
   WHERE id = v_wallet_id;

  -- ── 4. Insert wallet_transactions ledger row ──────────────────────────
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
  UPDATE public.circle_cycles
     SET actual_payout_date     = NOW()::DATE,
         payout_transaction_id  = v_payout_id::TEXT,
         payout_attempts        = COALESCE(payout_attempts, 0) + 1,
         last_payout_attempt_at = NOW(),
         last_payout_error      = NULL,
         updated_at             = NOW()
   WHERE id = p_cycle_id;

  -- ── 6. Finalize the circle if this is the last cycle ──────────────────
  -- Fires exactly once because the RPC short-circuits on re-entry via
  -- the existing v_existing idempotency check. total_cycles NULL means
  -- an unmanaged circle — we don't presume to finalize it.
  IF v_circle.total_cycles IS NOT NULL
     AND v_cycle.cycle_number >= v_circle.total_cycles THEN
    UPDATE public.circles
       SET status           = 'completed',
           completed_at     = NOW(),
           cycles_completed = v_circle.total_cycles,
           updated_at       = NOW()
     WHERE id = v_cycle.circle_id
       AND status <> 'completed';   -- belt: don't re-stamp if somehow already flipped
    v_circle_finalized := TRUE;
  END IF;

  RETURN jsonb_build_object(
    'success',            TRUE,
    'payout_id',          v_payout_id,
    'wallet_tx_id',       v_wallet_tx_id,
    'amount_cents',       v_amount_cents,
    'balance_after_cents', v_balance_after,
    'circle_finalized',   v_circle_finalized
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

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '310',
  'execute_cycle_payout_finalizes_circle',
  ARRAY['-- 310: backfill total_cycles + finalize circles.status when last cycle pays out']
)
ON CONFLICT (version) DO NOTHING;
