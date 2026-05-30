-- ════════════════════════════════════════════════════════════════════════════
-- 073: transfer_to_goal / transfer_from_goal — atomic wallet ↔ goal transfer
-- ════════════════════════════════════════════════════════════════════════════
--
-- Replaces the prior client-side two-step deposit/withdraw flow (insert a
-- savings_transactions row, then UPDATE the goal balance) with a single
-- plpgsql function that mutates user_wallets + user_savings_goals +
-- savings_transactions atomically. A failure at any step rolls everything
-- back, so a wallet debit can never appear without the matching goal
-- credit (and vice versa).
--
-- Auth model
--   SECURITY DEFINER + an explicit `auth.uid()` check inside the body. The
--   client does NOT pass a user_id parameter; this prevents a caller from
--   asking to debit another user's wallet. SECURITY DEFINER is used (rather
--   than INVOKER) because the financial guarantees are clearer when the
--   authorization predicate is visible in the function body rather than
--   distributed across RLS policies, and because we want to GRANT EXECUTE
--   to authenticated without granting broad table privileges.
--
-- Concurrency
--   `SELECT … FOR UPDATE` on the wallet row (and, for withdrawals, the goal
--   row) locks them for the duration of the transaction. Without this,
--   two concurrent transfers could each pass the balance pre-check at T0
--   and then both UPDATE at T1, leaving the wallet briefly below the
--   CHECK constraint (which would error one of them mid-flight). The
--   FOR UPDATE serialises them so the second transfer reads the post-T1
--   balance.
--
-- Defence in depth
--   user_wallets already carries CHECK (main_balance_cents >= 0). The
--   in-function pre-check returns a friendly error instead of letting
--   the constraint fire as a Postgres 23514. The CHECK remains a backstop
--   so even if a future code path forgets to validate, the wallet cannot
--   go negative.
--
-- search_path
--   Pinned to public + pg_temp per the Tier 4 hardening backlog so a
--   schema-shadowing attack cannot redirect our calls to a malicious
--   public.user_wallets in a search_path-controlled schema.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.transfer_to_goal(
  p_goal_id      UUID,
  p_amount_cents BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid                   UUID := auth.uid();
  v_wallet_id             UUID;
  v_wallet_balance_before BIGINT;
  v_goal_balance_before   BIGINT;
  v_goal_balance_after    BIGINT;
  v_goal_owner            UUID;
BEGIN
  -- ── Authentication ──────────────────────────────────────────────────────
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- ── Lock and validate the caller's wallet ───────────────────────────────
  -- LIMIT 1 + FOR UPDATE because the schema permits multiple wallet rows
  -- per user even though today every user has exactly one (verified live
  -- via pre-flight diagnostic).
  SELECT id, main_balance_cents
    INTO v_wallet_id, v_wallet_balance_before
  FROM public.user_wallets
  WHERE user_id = v_uid
  LIMIT 1
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No wallet found for user');
  END IF;

  IF v_wallet_balance_before < p_amount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance');
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

  IF v_goal_owner <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal does not belong to user');
  END IF;

  v_goal_balance_after := v_goal_balance_before + p_amount_cents;

  -- ── Mutations (all inside the implicit txn that wraps this function) ───
  UPDATE public.user_wallets
     SET main_balance_cents = main_balance_cents - p_amount_cents,
         updated_at         = NOW()
   WHERE id = v_wallet_id;

  UPDATE public.user_savings_goals
     SET current_balance_cents = v_goal_balance_after,
         total_deposits_cents  = COALESCE(total_deposits_cents, 0) + p_amount_cents,
         last_deposit_at       = NOW(),
         updated_at            = NOW()
   WHERE id = p_goal_id;

  INSERT INTO public.savings_transactions (
    savings_goal_id, user_id, transaction_type, source,
    amount_cents, balance_before_cents, balance_after_cents,
    transaction_status
  ) VALUES (
    p_goal_id, v_uid, 'deposit', 'wallet',
    p_amount_cents, v_goal_balance_before, v_goal_balance_after,
    'completed'
  );

  RETURN jsonb_build_object(
    'success',                 true,
    'goal_balance_cents',      v_goal_balance_after,
    'wallet_balance_cents',    v_wallet_balance_before - p_amount_cents
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- transfer_from_goal — withdraw from goal, credit wallet, retain penalty
-- ════════════════════════════════════════════════════════════════════════════
--
-- Penalty semantics
--   The caller computes the penalty (the screen already does this for
--   flexible / emergency / locked rules) and passes the absolute cents
--   amount. The goal is debited by the full gross amount; the wallet is
--   credited by net = gross − penalty. The penalty is retained by the
--   platform (recorded in savings_transactions.penalty_amount_cents +
--   metadata for audit) — there is no fees ledger yet.
--
--   p_reason is optional free-form text (e.g. emergency-reason label or
--   the user's "Other" description).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.transfer_from_goal(
  p_goal_id              UUID,
  p_amount_cents         BIGINT,
  p_penalty_amount_cents BIGINT DEFAULT 0,
  p_reason               TEXT   DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid                   UUID := auth.uid();
  v_wallet_id             UUID;
  v_wallet_balance_before BIGINT;
  v_goal_balance_before   BIGINT;
  v_goal_balance_after    BIGINT;
  v_goal_owner            UUID;
  v_net_cents             BIGINT;
BEGIN
  -- ── Authentication / input validation ───────────────────────────────────
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  IF p_penalty_amount_cents IS NULL OR p_penalty_amount_cents < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Penalty must be non-negative');
  END IF;

  IF p_penalty_amount_cents > p_amount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'Penalty cannot exceed withdrawal amount');
  END IF;

  v_net_cents := p_amount_cents - p_penalty_amount_cents;

  -- ── Lock and validate the source goal ───────────────────────────────────
  SELECT user_id, current_balance_cents
    INTO v_goal_owner, v_goal_balance_before
  FROM public.user_savings_goals
  WHERE id = p_goal_id
  FOR UPDATE;

  IF v_goal_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
  END IF;

  IF v_goal_owner <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal does not belong to user');
  END IF;

  -- Goal has no CHECK on current_balance_cents so we MUST validate here.
  IF v_goal_balance_before < p_amount_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount exceeds available balance');
  END IF;

  v_goal_balance_after := v_goal_balance_before - p_amount_cents;

  -- ── Lock the destination wallet ─────────────────────────────────────────
  SELECT id, main_balance_cents
    INTO v_wallet_id, v_wallet_balance_before
  FROM public.user_wallets
  WHERE user_id = v_uid
  LIMIT 1
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No wallet found for user');
  END IF;

  -- ── Mutations (atomic) ──────────────────────────────────────────────────
  UPDATE public.user_savings_goals
     SET current_balance_cents    = v_goal_balance_after,
         total_withdrawals_cents  = COALESCE(total_withdrawals_cents, 0) + p_amount_cents,
         updated_at               = NOW()
   WHERE id = p_goal_id;

  UPDATE public.user_wallets
     SET main_balance_cents = main_balance_cents + v_net_cents,
         updated_at         = NOW()
   WHERE id = v_wallet_id;

  INSERT INTO public.savings_transactions (
    savings_goal_id, user_id, transaction_type, source,
    amount_cents, fee_cents, penalty_amount_cents,
    balance_before_cents, balance_after_cents,
    transaction_status, metadata
  ) VALUES (
    p_goal_id, v_uid, 'withdrawal', 'wallet',
    p_amount_cents, 0, p_penalty_amount_cents,
    v_goal_balance_before, v_goal_balance_after,
    'completed',
    jsonb_build_object(
      'reason',             p_reason,
      'net_received_cents', v_net_cents,
      'destination',        'wallet'
    )
  );

  RETURN jsonb_build_object(
    'success',                  true,
    'goal_balance_cents',       v_goal_balance_after,
    'wallet_balance_cents',     v_wallet_balance_before + v_net_cents,
    'net_received_cents',       v_net_cents,
    'penalty_retained_cents',   p_penalty_amount_cents
  );
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- Grants — make both RPCs callable from the client via supabase-js
-- ════════════════════════════════════════════════════════════════════════════
GRANT EXECUTE ON FUNCTION public.transfer_to_goal(UUID, BIGINT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_from_goal(UUID, BIGINT, BIGINT, TEXT)
  TO authenticated;

-- Anon callers can never reach these (no JWT → auth.uid() is null →
-- function returns "Not authenticated") but make the absence of EXECUTE
-- explicit for the advisor.
REVOKE EXECUTE ON FUNCTION public.transfer_to_goal(UUID, BIGINT) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.transfer_from_goal(UUID, BIGINT, BIGINT, TEXT) FROM anon, public;

-- ════════════════════════════════════════════════════════════════════════════
-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '073',
  'transfer_to_goal_function',
  ARRAY['-- 073: transfer_to_goal_function (transfer_to_goal + transfer_from_goal RPCs)']
)
ON CONFLICT (version) DO NOTHING;
