-- ════════════════════════════════════════════════════════════════════════════
-- 074: card_deposits_for_goals — Stripe PaymentIntent flow for goal deposits
-- ════════════════════════════════════════════════════════════════════════════
--
-- Extends the existing stripe_payment_intents + stripe-webhook infrastructure
-- (Phase 1 of Stripe Connect integration, May 2026) to handle CARD deposits
-- into savings goals. ACH (us_bank_account) is intentionally out of scope —
-- that requires a separate Stripe Financial Connections / Plaid link flow.
--
-- Schema changes
--   - Extends stripe_payment_intents.purpose CHECK to include 'goal_deposit'.
--   - Adds stripe_payment_intents.goal_id (UUID FK) + partial index, mirroring
--     the existing circle_id column shape so the webhook can find the goal
--     without rummaging through metadata JSON.
--   - Adds savings_transactions.stripe_payment_intent_id (TEXT UNIQUE) +
--     partial index. The UNIQUE doubles as the idempotency anchor for the
--     credit_goal_external RPC below — a Stripe retry of the same event
--     cannot double-credit the goal.
--   - fee_cents on savings_transactions is already present from migration
--     072; ADD COLUMN IF NOT EXISTS is defensive against any environment
--     where 072 was applied with a different shape.
--
-- New RPC: credit_goal_external(goal_id, amount_cents, fee_cents,
--                               source, stripe_pi_id)
--   The external-deposit counterpart to transfer_to_goal (migration 073).
--   Whereas transfer_to_goal moves money INTERNALLY (wallet -> goal),
--   credit_goal_external credits the goal WITHOUT touching user_wallets,
--   because the funds came from outside the platform (Stripe Charge).
--
--   Idempotent:  if a savings_transactions row already exists for the same
--                stripe_payment_intent_id, returns success with
--                idempotent_replay=true and mutates nothing. The check is
--                performed both before and after the goal-row lock so the
--                race window between two concurrent webhook retries is
--                tight.
--
--   Auth model:  SECURITY DEFINER, EXECUTE granted to service_role only
--                (the webhook is the only intended caller). REVOKE from
--                authenticated/anon/public so a client cannot directly
--                credit their own goal balance.
--
--   No FOR UPDATE on a wallet row — there is no wallet involved on the
--   external-deposit path. The goal row IS locked so concurrent credits
--   serialise on the balance update.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Extend the purpose CHECK constraint ────────────────────────────────
ALTER TABLE public.stripe_payment_intents
  DROP CONSTRAINT IF EXISTS stripe_payment_intents_purpose_check;

ALTER TABLE public.stripe_payment_intents
  ADD CONSTRAINT stripe_payment_intents_purpose_check
  CHECK (purpose IN (
    'contribution',
    'insurance_premium',
    'late_fee',
    'loan_repayment',
    'wallet_deposit',
    'membership_fee',
    'goal_deposit'
  ));

-- ── 2. Add goal_id FK column + partial index ──────────────────────────────
ALTER TABLE public.stripe_payment_intents
  ADD COLUMN IF NOT EXISTS goal_id UUID
    REFERENCES public.user_savings_goals(id);

CREATE INDEX IF NOT EXISTS idx_stripe_pi_goal_id
  ON public.stripe_payment_intents(goal_id)
  WHERE goal_id IS NOT NULL;

-- ── 3. savings_transactions.stripe_payment_intent_id (UNIQUE) + index ─────
-- The UNIQUE is also the idempotency anchor used by credit_goal_external.
ALTER TABLE public.savings_transactions
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.savings_transactions'::regclass
      AND conname = 'uq_savings_transactions_stripe_intent'
  ) THEN
    ALTER TABLE public.savings_transactions
      ADD CONSTRAINT uq_savings_transactions_stripe_intent
      UNIQUE (stripe_payment_intent_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_savings_transactions_stripe_intent
  ON public.savings_transactions(stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;

-- ── 4. Defensive: fee_cents on savings_transactions (072 should have it) ──
ALTER TABLE public.savings_transactions
  ADD COLUMN IF NOT EXISTS fee_cents BIGINT DEFAULT 0;

-- ════════════════════════════════════════════════════════════════════════════
-- credit_goal_external — webhook-only RPC
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.credit_goal_external(
  p_goal_id        UUID,
  p_amount_cents   BIGINT,
  p_fee_cents      BIGINT DEFAULT 0,
  p_source         TEXT   DEFAULT 'card',
  p_stripe_pi_id   TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_goal_owner           UUID;
  v_goal_balance_before  BIGINT;
  v_goal_balance_after   BIGINT;
  v_existing_id          UUID;
BEGIN
  -- ── Input validation ────────────────────────────────────────────────────
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  IF p_fee_cents IS NULL OR p_fee_cents < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Fee must be non-negative');
  END IF;

  IF p_stripe_pi_id IS NULL OR length(p_stripe_pi_id) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stripe payment intent id is required');
  END IF;

  -- ── Idempotency pre-check (cheap exit when a retry already credited) ────
  -- If true at this point we still need to handle the unlikely race where
  -- two concurrent webhook deliveries both pass this check before either
  -- INSERTs — the post-lock re-check below closes that window.
  SELECT id INTO v_existing_id
  FROM public.savings_transactions
  WHERE stripe_payment_intent_id = p_stripe_pi_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success',          true,
      'idempotent_replay', true,
      'transaction_id',   v_existing_id
    );
  END IF;

  -- ── Lock and validate the destination goal ──────────────────────────────
  SELECT user_id, current_balance_cents
    INTO v_goal_owner, v_goal_balance_before
  FROM public.user_savings_goals
  WHERE id = p_goal_id
  FOR UPDATE;

  IF v_goal_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
  END IF;

  -- ── Post-lock idempotency re-check (closes race vs concurrent webhook) ──
  -- A second webhook delivery for the same PI that was blocked on the
  -- FOR UPDATE lock above will land here after the first delivery commits.
  -- The first one already inserted the savings_transactions row, so we
  -- return idempotent_replay and don't double-credit the goal.
  SELECT id INTO v_existing_id
  FROM public.savings_transactions
  WHERE stripe_payment_intent_id = p_stripe_pi_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success',          true,
      'idempotent_replay', true,
      'transaction_id',   v_existing_id
    );
  END IF;

  v_goal_balance_after := v_goal_balance_before + p_amount_cents;

  -- ── Atomic mutations ────────────────────────────────────────────────────
  UPDATE public.user_savings_goals
     SET current_balance_cents = v_goal_balance_after,
         total_deposits_cents  = COALESCE(total_deposits_cents, 0) + p_amount_cents,
         last_deposit_at       = NOW(),
         updated_at            = NOW()
   WHERE id = p_goal_id;

  INSERT INTO public.savings_transactions (
    savings_goal_id, user_id, transaction_type, source,
    amount_cents, fee_cents,
    balance_before_cents, balance_after_cents,
    transaction_status, stripe_payment_intent_id,
    metadata
  ) VALUES (
    p_goal_id, v_goal_owner, 'deposit', p_source,
    p_amount_cents, p_fee_cents,
    v_goal_balance_before, v_goal_balance_after,
    'completed', p_stripe_pi_id,
    jsonb_build_object(
      'payment_method',     p_source,
      'fee_cents',          p_fee_cents,
      'external_deposit',   true
    )
  );

  RETURN jsonb_build_object(
    'success',           true,
    'goal_balance_cents', v_goal_balance_after
  );
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────
-- Webhook context only. Service-role bypasses RLS but still needs EXECUTE.
GRANT EXECUTE ON FUNCTION public.credit_goal_external(UUID, BIGINT, BIGINT, TEXT, TEXT)
  TO service_role;

-- Belt-and-suspenders: explicitly remove from less-trusted roles so a
-- client cannot stuff their own goal balance by calling the RPC directly.
REVOKE EXECUTE ON FUNCTION public.credit_goal_external(UUID, BIGINT, BIGINT, TEXT, TEXT)
  FROM anon, authenticated, public;

-- ════════════════════════════════════════════════════════════════════════════
-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '074',
  'card_deposits_for_goals',
  ARRAY['-- 074: card_deposits_for_goals (stripe_payment_intents extensions + credit_goal_external RPC)']
)
ON CONFLICT (version) DO NOTHING;
