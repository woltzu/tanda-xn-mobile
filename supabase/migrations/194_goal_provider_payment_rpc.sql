-- ════════════════════════════════════════════════════════════════════════════
-- Migration 194: goal_provider_payment_rpc
-- ════════════════════════════════════════════════════════════════════════════
-- `process_goal_provider_payment(p_goal_id, p_provider_id, p_amount_cents,
--  p_payment_method)` moves money from a user_savings_goals row to the
-- provider's user_wallets in a single transaction. Writes the audit trail
-- (savings_transactions + wallet_transactions) and fans out notifications
-- to BOTH the provider and the goal owner so the existing push system
-- picks them up.
--
-- All four steps land or none do — the function runs inside one
-- transaction by virtue of being a single PL/pgSQL call, and any RAISE
-- aborts the lot. SECURITY DEFINER lets the function touch the provider's
-- wallet and notifications rows the caller would otherwise be RLS-blocked
-- from. Authorization gate: auth.uid() MUST equal user_savings_goals.user_id
-- for p_goal_id. Validate provider is verified+active and amount is in
-- bounds before any mutation runs.
--
-- Returns JSONB so the client gets a structured result with the link_id
-- and the goal's new balance for an immediate optimistic UI refresh.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.process_goal_provider_payment(
  p_goal_id UUID,
  p_provider_id UUID,
  p_amount_cents BIGINT,
  p_payment_method TEXT DEFAULT 'wallet'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller UUID;
  v_goal RECORD;
  v_provider RECORD;
  v_provider_user UUID;
  v_provider_name TEXT;
  v_link_id UUID;
  v_savings_tx_id UUID;
  v_wallet_tx_id UUID;
  v_goal_balance_after BIGINT;
  v_provider_wallet_id UUID;
  v_provider_main_before BIGINT;
  v_provider_main_after BIGINT;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- ─── 1. Validate goal ownership and balance ───────────────────────────
  SELECT id, user_id, name, current_balance_cents, goal_status
    INTO v_goal
    FROM public.user_savings_goals
   WHERE id = p_goal_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal not found';
  END IF;
  IF v_goal.user_id <> v_caller THEN
    RAISE EXCEPTION 'You can only pay from your own goal' USING ERRCODE = '42501';
  END IF;
  IF v_goal.current_balance_cents < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient goal balance';
  END IF;

  -- ─── 2. Validate provider ─────────────────────────────────────────────
  SELECT id, user_id, business_name, verification_status, is_active
    INTO v_provider
    FROM public.providers
   WHERE id = p_provider_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Provider not found';
  END IF;
  IF v_provider.verification_status <> 'verified' OR v_provider.is_active IS FALSE THEN
    RAISE EXCEPTION 'Provider is not currently accepting payments';
  END IF;
  v_provider_user := v_provider.user_id;
  v_provider_name := v_provider.business_name;

  -- ─── 3. Debit the goal ───────────────────────────────────────────────
  v_goal_balance_after := v_goal.current_balance_cents - p_amount_cents;

  UPDATE public.user_savings_goals
     SET current_balance_cents = v_goal_balance_after,
         total_withdrawals_cents = COALESCE(total_withdrawals_cents, 0) + p_amount_cents,
         updated_at = now()
   WHERE id = p_goal_id;

  INSERT INTO public.savings_transactions (
    user_id, savings_goal_id, transaction_type, transaction_status,
    amount_cents, balance_before_cents, balance_after_cents,
    source, metadata
  ) VALUES (
    v_caller, p_goal_id, 'provider_payment', 'completed',
    p_amount_cents,
    v_goal.current_balance_cents, v_goal_balance_after,
    p_payment_method,
    jsonb_build_object(
      'provider_id', p_provider_id,
      'provider_name', v_provider_name
    )
  )
  RETURNING id INTO v_savings_tx_id;

  -- ─── 4. Credit the provider's wallet ─────────────────────────────────
  -- user_wallets is the canonical balance table. Lock the row before
  -- updating so concurrent payments to the same provider can't race.
  SELECT id, main_balance_cents
    INTO v_provider_wallet_id, v_provider_main_before
    FROM public.user_wallets
   WHERE user_id = v_provider_user
   FOR UPDATE;

  IF v_provider_wallet_id IS NULL THEN
    -- Provider hasn't initialized their wallet yet. Create an empty
    -- row so the credit lands somewhere — the wallet row creator
    -- elsewhere will re-use this on first wallet open.
    INSERT INTO public.user_wallets (user_id, main_balance_cents)
    VALUES (v_provider_user, 0)
    RETURNING id, main_balance_cents
      INTO v_provider_wallet_id, v_provider_main_before;
  END IF;

  v_provider_main_after := v_provider_main_before + p_amount_cents;

  UPDATE public.user_wallets
     SET main_balance_cents = v_provider_main_after,
         total_balance_cents = COALESCE(total_balance_cents, 0) + p_amount_cents,
         last_activity_at = now(),
         updated_at = now()
   WHERE id = v_provider_wallet_id;

  INSERT INTO public.wallet_transactions (
    user_id, wallet_id, transaction_type, transaction_status,
    amount_cents, balance_before_cents, balance_after_cents,
    balance_type, direction, description, reference_id, reference_type,
    metadata
  ) VALUES (
    v_provider_user, v_provider_wallet_id, 'provider_payment', 'completed',
    p_amount_cents, v_provider_main_before, v_provider_main_after,
    'main', 'credit',
    'Payment from ' || COALESCE(v_goal.name, 'goal'),
    p_goal_id, 'user_savings_goals',
    jsonb_build_object(
      'goal_id', p_goal_id,
      'goal_name', v_goal.name,
      'goal_owner', v_caller,
      'provider_id', p_provider_id
    )
  )
  RETURNING id INTO v_wallet_tx_id;

  -- ─── 5. goal_provider_links row ──────────────────────────────────────
  -- One link per (goal, provider). Subsequent payments roll into the
  -- existing row: paid_amount_cents accumulates, total_amount_cents
  -- tracks the running total commitment. status flips to 'completed'
  -- once paid >= total.
  INSERT INTO public.goal_provider_links (
    goal_id, provider_id, status, total_amount_cents, paid_amount_cents
  )
  VALUES (p_goal_id, p_provider_id, 'active', p_amount_cents, p_amount_cents)
  ON CONFLICT (goal_id, provider_id) DO UPDATE
    SET status = 'active',
        total_amount_cents = public.goal_provider_links.total_amount_cents + EXCLUDED.total_amount_cents,
        paid_amount_cents = public.goal_provider_links.paid_amount_cents + EXCLUDED.paid_amount_cents,
        updated_at = now()
  RETURNING id INTO v_link_id;

  -- ─── 6. Notifications (both parties) ─────────────────────────────────
  -- Body strings ship in English; the client maps i18n_key to the
  -- localized string at render time.
  INSERT INTO public.notifications (user_id, type, title, body, data, read)
  VALUES (
    v_provider_user,
    'provider_payment',
    'Payment received',
    'You received $' || trim(to_char(p_amount_cents::numeric / 100.0, 'FM999G999G990D00'))
      || ' for ' || COALESCE(v_goal.name, 'a goal') || '.',
    jsonb_build_object(
      'role', 'provider',
      'provider_id', p_provider_id,
      'goal_id', p_goal_id,
      'goal_name', v_goal.name,
      'amount_cents', p_amount_cents,
      'link_id', v_link_id,
      'i18n_key', 'provider_notification.payment_received'
    ),
    FALSE
  );

  INSERT INTO public.notifications (user_id, type, title, body, data, read)
  VALUES (
    v_caller,
    'provider_payment',
    'Payment sent',
    'You paid $' || trim(to_char(p_amount_cents::numeric / 100.0, 'FM999G999G990D00'))
      || ' to ' || v_provider_name || '.',
    jsonb_build_object(
      'role', 'payer',
      'provider_id', p_provider_id,
      'provider_name', v_provider_name,
      'goal_id', p_goal_id,
      'amount_cents', p_amount_cents,
      'link_id', v_link_id,
      'i18n_key', 'provider_notification.payment_sent'
    ),
    FALSE
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'link_id', v_link_id,
    'savings_tx_id', v_savings_tx_id,
    'wallet_tx_id', v_wallet_tx_id,
    'goal_balance_after_cents', v_goal_balance_after,
    'provider_main_balance_after_cents', v_provider_main_after
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_goal_provider_payment(UUID, UUID, BIGINT, TEXT)
  TO authenticated;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '194',
  'goal_provider_payment_rpc',
  ARRAY['-- 194: goal_provider_payment_rpc']
)
ON CONFLICT (version) DO NOTHING;
