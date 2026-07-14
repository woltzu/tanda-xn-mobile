-- ═══════════════════════════════════════════════════════════════════════════
-- 313_execute_cycle_payout_variable_conflict_use_column.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- mig 312 tried to fix the ambiguous-column bug from mig 310 by
-- qualifying `circles.status` in the WHERE clause. That covered ONE
-- ambiguous reference but the same UPDATE's `WHERE id = v_cycle.circle_id`
-- has the same problem — `id` collides with v_cycle.id (v_cycle is
-- SELECT * FROM circle_cycles which has an id column). Direct call to
-- the RPC today after mig 312 still returned 22P02
-- "column reference 'status' is ambiguous" (Postgres reports whichever
-- name it hits first; there are multiple).
--
-- Cleaner fix — add `#variable_conflict use_column` inside the function
-- body. That directive tells plpgsql: when a name could match either a
-- column of the target table or a PL/pgSQL variable/RECORD field, prefer
-- the column. Since our variables use `v_` prefix everywhere, there's
-- no real ambiguity in intent — this just changes the parser's default
-- from `error` to `use_column`.
--
-- Same function body as mig 312 with the single directive added.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.execute_cycle_payout(p_cycle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
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

  UPDATE public.user_wallets
     SET main_balance_cents = v_balance_after,
         total_payouts_received_cents = COALESCE(total_payouts_received_cents, 0) + v_amount_cents,
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

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '313',
  'execute_cycle_payout_variable_conflict_use_column',
  ARRAY['-- 313: #variable_conflict use_column — resolves the whole class of ambiguity']
)
ON CONFLICT (version) DO NOTHING;
