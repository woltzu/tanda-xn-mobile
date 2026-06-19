-- ════════════════════════════════════════════════════════════════════════════
-- Migration 198: elder_compensation_payout
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2C — moves the elder $5 sign-off fee from "earned" audit row to
-- "paid" actual wallet credit. The Phase 2B audit row (verification_
-- compensation) is created at sign-off time; this migration adds the
-- payout machinery + extends process_disbursement_milestone_payment to
-- run it inline when the milestone releases.
--
-- Funding: the fee comes out of the provider's release amount on
-- elder/admin-verified milestones. The goal owner still pays the full
-- milestone amount (less retention); the provider receives
-- (release_amount − elder_fee) and the elder receives the fee. Goal
-- balance accounting stays balanced.
--
-- Standalone RPC `process_elder_compensation(p_compensation_id)` is also
-- exposed so an admin can manually replay if the inline call fails for
-- any reason (audit trail keeps `status='earned'` until paid).
--
-- New notification type: `compensation_received`. The status-change
-- trigger from migration 196 already fires `milestone_released` for the
-- provider and goal owner; this migration adds an explicit notify for
-- the elder when their compensation lands.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── process_elder_compensation — standalone payout ─────────────────────
-- Idempotent: if the comp row is already 'paid' we return success without
-- crediting again. Eligibility: status='earned' AND associated milestone
-- is released (or being released within the same transaction).
CREATE OR REPLACE FUNCTION public.process_elder_compensation(
  p_compensation_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_comp RECORD;
  v_ms RECORD;
  v_wallet_id UUID;
  v_wallet_main_before BIGINT;
  v_wallet_main_after BIGINT;
BEGIN
  SELECT * INTO v_comp FROM public.verification_compensation
   WHERE id = p_compensation_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compensation row not found';
  END IF;
  IF v_comp.status = 'paid' THEN
    RETURN jsonb_build_object('success', TRUE, 'already_paid', TRUE);
  END IF;
  IF v_comp.status <> 'earned' THEN
    RAISE EXCEPTION 'Compensation row is %, cannot pay', v_comp.status;
  END IF;

  SELECT * INTO v_ms FROM public.goal_disbursement_milestones
   WHERE id = v_comp.milestone_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone not found';
  END IF;
  -- Allow when milestone is verified (about to release inline) OR already
  -- released (manual replay path).
  IF v_ms.status NOT IN ('verified', 'released') THEN
    RAISE EXCEPTION 'Milestone is %, cannot pay compensation yet', v_ms.status;
  END IF;

  -- Lock the elder's wallet
  SELECT id, main_balance_cents INTO v_wallet_id, v_wallet_main_before
    FROM public.user_wallets
   WHERE user_id = v_comp.responder_user_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.user_wallets (user_id, main_balance_cents)
    VALUES (v_comp.responder_user_id, 0)
    RETURNING id, main_balance_cents INTO v_wallet_id, v_wallet_main_before;
  END IF;
  v_wallet_main_after := v_wallet_main_before + v_comp.amount_cents;

  UPDATE public.user_wallets
     SET main_balance_cents = v_wallet_main_after,
         total_balance_cents = COALESCE(total_balance_cents, 0) + v_comp.amount_cents,
         last_activity_at = now(),
         updated_at = now()
   WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    user_id, wallet_id, transaction_type, transaction_status,
    amount_cents, balance_before_cents, balance_after_cents,
    balance_type, direction, description, reference_id, reference_type,
    metadata
  ) VALUES (
    v_comp.responder_user_id, v_wallet_id,
    'elder_compensation', 'completed',
    v_comp.amount_cents, v_wallet_main_before, v_wallet_main_after,
    'main', 'credit',
    'Verification sign-off compensation',
    v_comp.id, 'verification_compensation',
    jsonb_build_object(
      'milestone_id', v_comp.milestone_id,
      'verification_id', v_comp.verification_id
    )
  );

  UPDATE public.verification_compensation
     SET status = 'paid', paid_at = now()
   WHERE id = p_compensation_id;

  -- Notify the elder.
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      v_comp.responder_user_id,
      'compensation_received',
      'Verification fee credited',
      'Your $' || trim(to_char(v_comp.amount_cents::numeric / 100.0, 'FM999G999G990D00'))
        || ' verification fee was credited to your wallet.',
      jsonb_build_object(
        'compensation_id', v_comp.id,
        'milestone_id', v_comp.milestone_id,
        'amount_cents', v_comp.amount_cents
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'amount_cents', v_comp.amount_cents,
    'elder_user_id', v_comp.responder_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_elder_compensation(UUID) TO authenticated;

-- ─── process_disbursement_milestone_payment — wire in elder fee deduction ──
-- Re-CREATE OR REPLACE the Phase 2A function with the same body PLUS the
-- elder-fee handling. The provider receives (release_amount − elder_fee);
-- the elder receives the fee. Goal accounting unchanged.
CREATE OR REPLACE FUNCTION public.process_disbursement_milestone_payment(
  p_milestone_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ms RECORD;
  v_goal RECORD;
  v_provider RECORD;
  v_wallet_id UUID;
  v_wallet_main_before BIGINT;
  v_wallet_main_after BIGINT;
  v_goal_balance_after BIGINT;
  v_release_amount BIGINT;          -- total released from goal
  v_retention_amount BIGINT;
  v_is_final BOOLEAN;
  v_retention_accumulated BIGINT := 0;
  v_comp RECORD;                    -- unpaid elder comp row (if any)
  v_provider_amount BIGINT;         -- what the provider actually gets
BEGIN
  SELECT * INTO v_ms FROM public.goal_disbursement_milestones
   WHERE id = p_milestone_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Milestone not found';
  END IF;
  IF v_ms.status <> 'verified' THEN
    RAISE EXCEPTION 'Milestone not in verified state';
  END IF;

  SELECT * INTO v_goal FROM public.user_savings_goals
   WHERE id = v_ms.goal_id FOR UPDATE;
  SELECT id, user_id, business_name INTO v_provider
    FROM public.providers WHERE id = v_ms.provider_id;

  v_retention_amount := (v_ms.amount_cents * v_ms.retention_percent) / 100;
  v_release_amount := v_ms.amount_cents - v_retention_amount;

  SELECT NOT EXISTS (
    SELECT 1 FROM public.goal_disbursement_milestones m2
     WHERE m2.goal_id = v_ms.goal_id
       AND m2.order_index > v_ms.order_index
  ) INTO v_is_final;

  IF v_is_final THEN
    SELECT COALESCE(SUM((m.amount_cents * m.retention_percent) / 100), 0)
      INTO v_retention_accumulated
      FROM public.goal_disbursement_milestones m
     WHERE m.goal_id = v_ms.goal_id
       AND m.order_index < v_ms.order_index
       AND m.status = 'released';
    v_release_amount := v_release_amount + v_retention_amount + v_retention_accumulated;
    v_retention_amount := 0;
  END IF;

  IF v_goal.current_balance_cents < v_release_amount THEN
    RAISE EXCEPTION 'Goal balance is insufficient for the release';
  END IF;

  v_goal_balance_after := v_goal.current_balance_cents - v_release_amount;

  -- ─── 1. Debit goal ──────────────────────────────────────────────────
  UPDATE public.user_savings_goals
     SET current_balance_cents = v_goal_balance_after,
         total_withdrawals_cents = COALESCE(total_withdrawals_cents, 0) + v_release_amount,
         updated_at = now()
   WHERE id = v_goal.id;

  INSERT INTO public.savings_transactions (
    user_id, savings_goal_id, transaction_type, transaction_status,
    amount_cents, balance_before_cents, balance_after_cents,
    source, metadata
  ) VALUES (
    v_goal.user_id, v_goal.id, 'milestone_release', 'completed',
    v_release_amount,
    v_goal.current_balance_cents, v_goal_balance_after,
    'goal_disbursement',
    jsonb_build_object(
      'milestone_id', v_ms.id,
      'provider_id', v_ms.provider_id,
      'retention_held_cents', v_retention_amount,
      'final', v_is_final
    )
  );

  -- ─── 2. Resolve elder compensation, if any ─────────────────────────
  -- Earned, unpaid compensation belongs to this milestone's last verified
  -- approval. Deduct from provider's share. The amount stays as-is even
  -- if the milestone is the final one (retention release doesn't affect
  -- the elder's fee structure).
  SELECT * INTO v_comp
    FROM public.verification_compensation
   WHERE milestone_id = v_ms.id AND status = 'earned'
   ORDER BY created_at DESC
   LIMIT 1;

  v_provider_amount := v_release_amount;
  IF v_comp IS NOT NULL THEN
    v_provider_amount := GREATEST(v_release_amount - v_comp.amount_cents, 0);
  END IF;

  -- ─── 3. Credit provider ────────────────────────────────────────────
  SELECT id, main_balance_cents
    INTO v_wallet_id, v_wallet_main_before
    FROM public.user_wallets
   WHERE user_id = v_provider.user_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.user_wallets (user_id, main_balance_cents)
    VALUES (v_provider.user_id, 0)
    RETURNING id, main_balance_cents INTO v_wallet_id, v_wallet_main_before;
  END IF;
  v_wallet_main_after := v_wallet_main_before + v_provider_amount;

  UPDATE public.user_wallets
     SET main_balance_cents = v_wallet_main_after,
         total_balance_cents = COALESCE(total_balance_cents, 0) + v_provider_amount,
         last_activity_at = now(),
         updated_at = now()
   WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    user_id, wallet_id, transaction_type, transaction_status,
    amount_cents, balance_before_cents, balance_after_cents,
    balance_type, direction, description, reference_id, reference_type,
    metadata
  ) VALUES (
    v_provider.user_id, v_wallet_id, 'milestone_release', 'completed',
    v_provider_amount, v_wallet_main_before, v_wallet_main_after,
    'main', 'credit',
    'Milestone release: ' || COALESCE(v_ms.name, 'milestone'),
    v_ms.id, 'goal_disbursement_milestones',
    jsonb_build_object(
      'goal_id', v_goal.id,
      'goal_name', v_goal.name,
      'milestone_id', v_ms.id,
      'final', v_is_final,
      'elder_fee_deducted_cents',
        CASE WHEN v_comp IS NOT NULL THEN v_comp.amount_cents ELSE 0 END
    )
  );

  -- ─── 4. Pay the elder (inline) ──────────────────────────────────────
  IF v_comp IS NOT NULL THEN
    BEGIN
      PERFORM public.process_elder_compensation(v_comp.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'process_elder_compensation failed inline for %: %',
        v_comp.id, SQLERRM;
    END;
  END IF;

  -- ─── 5. Mark milestone released ─────────────────────────────────────
  UPDATE public.goal_disbursement_milestones
     SET status = 'released',
         escrow_status = 'released',
         released_at = now(),
         released_amount_cents = v_provider_amount,
         updated_at = now()
   WHERE id = v_ms.id;

  INSERT INTO public.goal_provider_links (
    goal_id, provider_id, status, total_amount_cents, paid_amount_cents
  ) VALUES (
    v_goal.id, v_ms.provider_id, 'active', v_ms.amount_cents, v_provider_amount
  )
  ON CONFLICT (goal_id, provider_id) DO UPDATE
    SET status = 'active',
        total_amount_cents = public.goal_provider_links.total_amount_cents + EXCLUDED.total_amount_cents,
        paid_amount_cents = public.goal_provider_links.paid_amount_cents + EXCLUDED.paid_amount_cents,
        updated_at = now();

  RETURN jsonb_build_object(
    'success', TRUE,
    'release_amount_cents', v_release_amount,
    'provider_amount_cents', v_provider_amount,
    'elder_fee_cents', CASE WHEN v_comp IS NOT NULL THEN v_comp.amount_cents ELSE 0 END,
    'goal_balance_after_cents', v_goal_balance_after,
    'final', v_is_final
  );
END;
$$;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '198',
  'elder_compensation_payout',
  ARRAY['-- 198: elder_compensation_payout']
)
ON CONFLICT (version) DO NOTHING;
