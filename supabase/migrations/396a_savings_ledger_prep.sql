-- ═══════════════════════════════════════════════════════════════════════════
-- 396a_savings_ledger_prep.sql
--
-- Prerequisite for mig 396 (savings behavior factor). Prepares
-- savings_transactions to be the reliable ledger the factor's anti-
-- gaming logic will read.
--
-- Investigation findings:
--   • transfer_from_goal ALREADY emits savings_transactions rows with
--     transaction_type='withdrawal' and correct balance_before/after
--     (verified in live RPC body). No new instrumentation needed there.
--   • savings_transactions has NO CHECK constraint on transaction_type —
--     it's free-form text today. Prod has 9 rows, all 'deposit'.
--   • wallet_transactions has NO CHECK constraint on transaction_type
--     either. Prod has 11 goal-related rows across types like
--     'goal_deposit' / 'goal_milestone', but nothing for goal-side
--     withdrawals — because transfer_from_goal credits the wallet via
--     UPDATE only, without emitting a wallet_transactions row.
--   • No goal-close / cancel / archive / delete RPC exists. If goal
--     status changes via direct table UPDATE that also moves money,
--     the ledger is bypassed. Not touching this here — status-only
--     changes without balance mutation are fine, and no such
--     balance-mutating UPDATE was found in the current codebase.
--   • create_goal_disbursement_milestones schedules milestones but
--     doesn't disburse. Execute-milestone RPC not found in this probe;
--     when built, it MUST emit both savings_transactions and
--     wallet_transactions rows for the disbursed amounts.
--
-- Scope (minimal, focused):
--   1. CHECK constraint on savings_transactions.transaction_type — lock
--      the canonical set so a rogue value doesn't silently break mig
--      396's type-filtered aggregations.
--   2. Indexes tuned for mig 396's per-user-per-window and type-filtered
--      queries.
--   3. Modify transfer_from_goal to ALSO emit a wallet_transactions row
--      of type 'savings_withdrawal' when it credits the wallet. Closes
--      the wallet-side ledger gap so the wallet UI + admin observability
--      see the credit.
--
-- Backfill posture: no backfill needed. Zero historical withdrawal rows
-- in savings_transactions and zero 'savings_withdrawal' rows in
-- wallet_transactions. The 11 goal-related wallet_transactions rows are
-- all goal_deposit / goal_milestone (inflows), so nothing to derive.
--
-- Deferrals (NOT in this migration, flagged as follow-ups):
--   • Instrument any future execute-milestone RPC to write both ledgers.
--   • Add a canonical delete_savings_goal / cancel_savings_goal RPC that
--     routes any remaining balance through transfer_from_goal before
--     status change. Direct client-side status UPDATE bypasses the
--     ledger today; if a client-side flow ever tries to move money via
--     a status change alone, that's a bug to fix at the source.
--
-- Rollout position: 2 of 4 in the XnScore savings-factor chain
--   (396c → 396a → 396 → 396b).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. CHECK constraint on savings_transactions.transaction_type ────────
-- NOT VALID / VALIDATE pattern is defensive: the ADD is instantaneous
-- and doesn't need to lock-scan the table, the VALIDATE only enforces
-- against existing rows (which are all 'deposit'). If someone slipped
-- a rogue value in between probe and apply, VALIDATE catches it.
ALTER TABLE savings_transactions
  ADD CONSTRAINT savings_transactions_transaction_type_check
  CHECK (transaction_type IN (
    'deposit',
    'withdrawal',
    'fee',
    'penalty',
    'transfer_in',
    'transfer_out'
  ))
  NOT VALID;

ALTER TABLE savings_transactions
  VALIDATE CONSTRAINT savings_transactions_transaction_type_check;

COMMENT ON CONSTRAINT savings_transactions_transaction_type_check
  ON savings_transactions IS
  'mig 396a: canonical transaction_type set. deposit/withdrawal drive '
  'the savings behavior factor (mig 396). fee/penalty/transfer_in/'
  'transfer_out are reserved for future flows but locked here so mig '
  '396''s filters don''t drift.';

-- ─── 2. Indexes for mig 396's queries ────────────────────────────────────
-- Per-user timeline scan (used by sustained-balance calc, top-N history).
CREATE INDEX IF NOT EXISTS savings_tx_user_created_idx
  ON savings_transactions (user_id, created_at DESC);

-- Type-filtered aggregation (deposit/withdrawal in a window). Includes
-- only completed rows because the anti-gaming math ignores pending or
-- reversed transactions — matches the semantic of "money that actually
-- moved."
CREATE INDEX IF NOT EXISTS savings_tx_user_type_completed_idx
  ON savings_transactions (user_id, transaction_type, created_at DESC)
  WHERE transaction_status = 'completed';

-- ─── 3. transfer_from_goal: emit wallet_transactions on credit ───────────
-- Byte-for-byte preservation of the pre-396a body EXCEPT:
--   (a) SELECT ... INTO now also reads goal.name so the wallet-tx
--       description can reference the goal.
--   (b) After the wallet UPDATE, INSERT a wallet_transactions row of
--       type 'savings_withdrawal', direction='credit'. balance_before
--       and balance_after captured from the wallet snapshot + net.
--       reference_type='savings_goal', reference_id=p_goal_id. Metadata
--       mirrors the savings_transactions.metadata for cross-reference.
-- No behavior change for callers; the RPC still returns the same JSONB.
CREATE OR REPLACE FUNCTION public.transfer_from_goal(
  p_goal_id uuid,
  p_amount_cents bigint,
  p_penalty_amount_cents bigint DEFAULT 0,
  p_reason text DEFAULT NULL::text
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid                   UUID := auth.uid();
  v_wallet_id             UUID;
  v_wallet_balance_before BIGINT;
  v_goal_balance_before   BIGINT;
  v_goal_balance_after    BIGINT;
  v_goal_owner            UUID;
  v_goal_name             TEXT;
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
  -- Mig 396a: also read name so the wallet-tx description can reference it.
  SELECT user_id, current_balance_cents, name
    INTO v_goal_owner, v_goal_balance_before, v_goal_name
  FROM public.user_savings_goals
  WHERE id = p_goal_id
  FOR UPDATE;

  IF v_goal_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal not found');
  END IF;

  IF v_goal_owner <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goal does not belong to user');
  END IF;

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

  -- Savings-side ledger row (unchanged from pre-396a).
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

  -- Mig 396a: wallet-side ledger row so the wallet UI + admin
  -- observability see this credit as a line item, not just a balance
  -- update. Wrapped in a sub-BEGIN so a wallet_transactions failure
  -- (e.g. RLS drift, missing column) doesn't undo the transfer that
  -- already committed to user_savings_goals / user_wallets /
  -- savings_transactions above. The wallet balance is correct either
  -- way; only the audit-line row would be missing.
  BEGIN
    INSERT INTO public.wallet_transactions (
      wallet_id, user_id, transaction_type, direction,
      amount_cents, balance_type,
      balance_before_cents, balance_after_cents,
      reference_type, reference_id,
      description, transaction_status, metadata
    ) VALUES (
      v_wallet_id, v_uid, 'savings_withdrawal', 'credit',
      v_net_cents, 'main',
      v_wallet_balance_before, v_wallet_balance_before + v_net_cents,
      'savings_goal', p_goal_id,
      'Withdrawal from ' || COALESCE(v_goal_name, 'savings goal'),
      'completed',
      jsonb_build_object(
        'goal_id',       p_goal_id,
        'gross_cents',   p_amount_cents,
        'net_cents',     v_net_cents,
        'penalty_cents', p_penalty_amount_cents,
        'reason',        p_reason
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[transfer_from_goal] wallet_transactions insert failed goal=%, err=%',
      p_goal_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',                  true,
    'goal_balance_cents',       v_goal_balance_after,
    'wallet_balance_cents',     v_wallet_balance_before + v_net_cents,
    'net_received_cents',       v_net_cents,
    'penalty_retained_cents',   p_penalty_amount_cents
  );
END;
$function$;

-- ─── 4. Self-register ────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '396a',
  'savings_ledger_prep',
  ARRAY['-- 396a: savings_ledger_prep']
)
ON CONFLICT (version) DO NOTHING;
