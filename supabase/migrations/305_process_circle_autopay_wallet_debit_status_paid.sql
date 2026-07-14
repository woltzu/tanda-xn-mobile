-- ═══════════════════════════════════════════════════════════════════════════
-- 305_process_circle_autopay_wallet_debit_status_paid.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bug — process_circle_autopay_wallet_debit was inserting
--   public.contributions (user_id, ..., status)
--   VALUES (..., 'completed', ...)
-- but `contributions.status` is the `contribution_status` enum whose
-- labels are ('pending','paid','late','missed','waived'). No 'completed'
-- label → every wallet-autopay attempt failed on the INSERT with
--   "invalid input value for enum contribution_status: \"completed\""
-- The failure was silent from the user's POV: the outer EF
-- (process-circle-autopay) caught the RPC error, wrote a row to
-- circle_autopay_log with status='failed', and moved on. Wallet
-- balance untouched, no contribution row created, cycle counter
-- unchanged — every attempted debit rolled back cleanly, but the
-- user's payment never landed.
--
-- Verified end-to-end today during the launch smoke test on Test
-- Circle Payout 4 cycle 2 — first autopay tick returned
-- attempted=1/succeeded=0/failed=1 with this exact error string in
-- circle_autopay_log.error_message.
--
-- Fix — change the literal to 'paid' to match the enum. Rest of the
-- RPC body is byte-identical to the prior deploy.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.process_circle_autopay_wallet_debit(
  p_user_id       uuid,
  p_circle_id     uuid,
  p_member_id     uuid,
  p_cycle_number  integer,
  p_amount_cents  integer,
  p_due_date      date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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

  -- Insert the contribution. status='paid' matches the
  -- contribution_status enum (paid is the "money landed" label —
  -- 'completed' was never a valid enum label). payment_method='wallet'
  -- tags the source.
  INSERT INTO public.contributions (
    user_id, member_id, circle_id, cycle_number,
    amount, due_date, status,
    payment_method, paid_at, paid_date,
    created_at, updated_at
  )
  VALUES (
    p_user_id, p_member_id, p_circle_id, p_cycle_number,
    p_amount_cents::numeric / 100, p_due_date, 'paid',
    'wallet', now(), now(),
    now(), now()
  )
  RETURNING id INTO v_contribution_id;

  RETURN jsonb_build_object(
    'success', true,
    'contribution_id', v_contribution_id
  );
END;
$function$;

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '305',
  'process_circle_autopay_wallet_debit_status_paid',
  ARRAY['-- 305: autopay wallet-debit RPC: contribution_status ''completed'' → ''paid''']
)
ON CONFLICT (version) DO NOTHING;
