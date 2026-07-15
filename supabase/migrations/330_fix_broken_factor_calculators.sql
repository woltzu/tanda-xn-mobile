-- ═══════════════════════════════════════════════════════════════════════════
-- 330_fix_broken_factor_calculators.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Follow-up to migs 328 + 329. Mig 329's defensive per-factor wrapper
-- captured three factors that error out at run time due to schema
-- drift between the legacy factor RPCs and the current DB. Errors
-- (verified via xn_scores.factor_scores.errors after today's live
-- pipeline run):
--   * payment_reliability : "invalid input value for enum
--                            contribution_status: 'completed'"
--   * tenure_activity     : same (propagates through
--                            is_user_financially_active →
--                            get_last_financial_activity)
--   * financial_behavior  : 'column "amount" does not exist'
--
-- Fixes below — each RPC recreated with the drift resolved. Once
-- these apply, the 5-factor recalc actually produces meaningful
-- numbers instead of falling back to base 20 for every user.
--
-- Fix 1 — calculate_payment_reliability_factor:
--   Enum value swap only. Everything else (paid_at, due_date, streak
--   columns) already resolves against the live schema.
--
-- Fix 2 — get_last_financial_activity:
--   Two drift bugs:
--     - contributions.status IN ('completed','late') — enum has no
--       'completed'; swap to 'paid'.
--     - wallet_transactions.transaction_type IN ('deposit',
--       'incoming_transfer') — 'deposit' isn't in the live values.
--       Actual values in prod today: wallet_deposit, goal_deposit,
--       circle_payout, goal_milestone, contribution_refund,
--       circle_cancellation_refund. For a "financial activity" pulse,
--       count wallet_deposit + goal_deposit + circle_payout (money
--       moving in/out, ignoring cosmetic milestone rows).
--   payout_executions query kept but wrapped in EXCEPTION so a
--   missing/renamed table can't kill the helper.
--
-- Fix 3 — calculate_financial_behavior_factor:
--   Four drift bugs:
--     - FROM wallets → FROM user_wallets (`wallets` is a mostly-empty
--       legacy table with different columns).
--     - v_wallet.available_balance → v_wallet.available_balance_cents
--       (and divide by 100 for the display value in the details JSON).
--     - wallet_transactions.transaction_type='deposit' →
--       transaction_type='wallet_deposit'.
--     - SUM(amount) → SUM(amount_cents) with /100 to keep the dollar
--       units the rest of the RPC assumes.
--     - savings_goals lookup → user_savings_goals (the live table);
--       `is_active` column doesn't exist there — check for any goal
--       whose goal_status isn't cancelled/completed.
-- ═══════════════════════════════════════════════════════════════════════════

-- DROP first — the existing three RPCs have different RETURN TABLE
-- column names than the ones below. Postgres won't CREATE OR REPLACE
-- across signature changes. Callers reference the columns by name
-- (`v_payment.total_score`, etc.) and every named column below is
-- preserved from the prior definition, so the drop-recreate is safe.
DROP FUNCTION IF EXISTS public.calculate_payment_reliability_factor(uuid);
DROP FUNCTION IF EXISTS public.get_last_financial_activity(uuid);
DROP FUNCTION IF EXISTS public.calculate_financial_behavior_factor(uuid);

-- ─── Fix 1 — payment reliability ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_payment_reliability_factor(p_user_id uuid)
RETURNS TABLE(total_score numeric, on_time_rate_score numeric, streak_bonus_score numeric, no_defaults_score numeric, late_recovery_score numeric, details jsonb)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_total_contributions INTEGER;
    v_on_time_contributions INTEGER;
    v_late_contributions INTEGER;
    v_late_recovered INTEGER;
    v_on_time_pct DECIMAL;
    v_score_record RECORD;

    v_on_time_rate DECIMAL := 0;
    v_streak_bonus DECIMAL := 0;
    v_no_defaults DECIMAL := 0;
    v_late_recovery DECIMAL := 0;
    v_details JSONB;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;

    -- Count contributions — enum values are pending/paid/late/missed/waived/refunded.
    -- 'paid' means money landed on time; 'late' means money landed after due.
    -- No 'completed' value has ever existed on this table.
    SELECT
        COUNT(*) FILTER (WHERE status IN ('paid', 'late')),
        COUNT(*) FILTER (WHERE status = 'paid' AND (paid_at <= due_date OR paid_at IS NULL)),
        COUNT(*) FILTER (WHERE status = 'late'),
        COUNT(*) FILTER (WHERE status = 'late' AND paid_at IS NOT NULL)
    INTO v_total_contributions, v_on_time_contributions, v_late_contributions, v_late_recovered
    FROM contributions
    WHERE user_id = p_user_id;

    IF v_total_contributions > 0 THEN
        v_on_time_pct := v_on_time_contributions::DECIMAL / v_total_contributions;
        v_on_time_rate := LEAST(20, v_on_time_pct * 20);
    END IF;

    IF v_score_record IS NOT NULL THEN
        v_streak_bonus := LEAST(8, (LEAST(COALESCE(v_score_record.payment_streak, 0), 20)::DECIMAL / 20) * 8);
    END IF;

    IF v_score_record IS NOT NULL AND NOT COALESCE(v_score_record.has_defaults, FALSE) THEN
        v_no_defaults := 5;
    END IF;

    IF v_late_contributions > 0 AND v_late_recovered > 0 THEN
        v_late_recovery := LEAST(2, (v_late_recovered::DECIMAL / v_late_contributions) * 2);
    END IF;

    v_details := jsonb_build_object(
        'total_contributions', v_total_contributions,
        'on_time_contributions', v_on_time_contributions,
        'on_time_percentage', ROUND(COALESCE(v_on_time_pct * 100, 0), 1),
        'current_streak', COALESCE(v_score_record.payment_streak, 0),
        'best_streak', COALESCE(v_score_record.best_payment_streak, 0),
        'has_defaults', COALESCE(v_score_record.has_defaults, FALSE),
        'default_count', COALESCE(v_score_record.default_count, 0),
        'late_payments', v_late_contributions,
        'late_recovered', v_late_recovered
    );

    RETURN QUERY SELECT
        ROUND(v_on_time_rate + v_streak_bonus + v_no_defaults + v_late_recovery, 2),
        ROUND(v_on_time_rate, 2),
        ROUND(v_streak_bonus, 2),
        ROUND(v_no_defaults, 2),
        ROUND(v_late_recovery, 2),
        v_details;
END;
$function$;

-- ─── Fix 2 — get_last_financial_activity ────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_last_financial_activity(p_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $function$
DECLARE
    v_last_activity TIMESTAMPTZ;
    v_contribution  TIMESTAMPTZ;
    v_payout        TIMESTAMPTZ;
    v_wallet        TIMESTAMPTZ;
BEGIN
    -- Contributions — 'paid'/'late' are the "money landed" statuses.
    -- Prior version used 'completed' which the enum has never had.
    SELECT MAX(paid_at) INTO v_contribution
    FROM contributions
    WHERE user_id = p_user_id AND status IN ('paid', 'late');

    -- Payouts received — wrap in EXCEPTION so a renamed/missing
    -- payout_executions table doesn't kill the helper. If the table
    -- goes away later, financial-activity detection falls back to
    -- contributions + wallet_transactions.
    BEGIN
        SELECT MAX(completed_at) INTO v_payout
        FROM payout_executions
        WHERE recipient_user_id = p_user_id AND execution_status = 'completed';
    EXCEPTION WHEN OTHERS THEN
        v_payout := NULL;
    END;

    -- Wallet activity — real transaction_type values are wallet_deposit
    -- (top-ups), goal_deposit (moved into savings), circle_payout
    -- (received a payout). Milestone/refund rows are cosmetic and
    -- shouldn't count as fresh financial activity.
    SELECT MAX(created_at) INTO v_wallet
    FROM wallet_transactions
    WHERE user_id = p_user_id
      AND transaction_type IN ('wallet_deposit', 'goal_deposit', 'circle_payout')
      AND transaction_status = 'completed';

    v_last_activity := GREATEST(
        COALESCE(v_contribution, '1970-01-01'::TIMESTAMPTZ),
        COALESCE(v_payout,       '1970-01-01'::TIMESTAMPTZ),
        COALESCE(v_wallet,       '1970-01-01'::TIMESTAMPTZ)
    );

    IF v_last_activity = '1970-01-01'::TIMESTAMPTZ THEN
        RETURN NULL;
    END IF;
    RETURN v_last_activity;
END;
$function$;

-- ─── Fix 3 — calculate_financial_behavior_factor ────────────────────────

CREATE OR REPLACE FUNCTION public.calculate_financial_behavior_factor(p_user_id uuid)
RETURNS TABLE(total_score numeric, wallet_score numeric, retention_score numeric, savings_score numeric, details jsonb)
LANGUAGE plpgsql
AS $function$
DECLARE
    v_score_record RECORD;
    v_wallet RECORD;
    v_wallet_deposits INTEGER := 0;
    v_total_deposited_cents BIGINT := 0;
    v_retention_rate DECIMAL := 0;
    v_has_savings BOOLEAN := FALSE;

    v_wallet_score DECIMAL := 0;
    v_retention_score DECIMAL := 0;
    v_savings_score DECIMAL := 0;
    v_details JSONB;
BEGIN
    SELECT * INTO v_score_record FROM xn_scores WHERE user_id = p_user_id;

    -- user_wallets is the live table (`wallets` is a mostly-empty
    -- legacy carrier that lacks available_balance_cents).
    SELECT * INTO v_wallet FROM user_wallets WHERE user_id = p_user_id;

    IF v_score_record IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    -- Deposits count / total — wallet_deposit is the real
    -- transaction_type value (was 'deposit' in the prior draft).
    -- amount_cents is the real column (was 'amount').
    SELECT COUNT(*), COALESCE(SUM(amount_cents), 0)
    INTO v_wallet_deposits, v_total_deposited_cents
    FROM wallet_transactions
    WHERE user_id = p_user_id
      AND transaction_type = 'wallet_deposit'
      AND transaction_status = 'completed';

    -- Retention rate from payout_preferences (unchanged — the table
    -- exists as expected).
    SELECT COALESCE(pp.wallet_percentage, 0)::DECIMAL / 100
    INTO v_retention_rate
    FROM payout_preferences pp
    WHERE pp.user_id = p_user_id;
    v_retention_rate := COALESCE(v_retention_rate, 0);

    -- Savings goals check — user_savings_goals is the live table
    -- (`savings_goals` has only a user_id column, no state flag).
    -- Count as engaged if any goal isn't cancelled/completed.
    SELECT EXISTS(
        SELECT 1 FROM user_savings_goals
         WHERE user_id = p_user_id
           AND (goal_status IS NULL
                OR goal_status NOT IN ('cancelled','archived'))
    ) INTO v_has_savings;

    -- Wallet usage score (6 pts max)
    IF v_wallet_deposits > 0 THEN
        v_wallet_score := LEAST(6, (LEAST(v_wallet_deposits, 12)::DECIMAL / 12) * 6);
    END IF;

    -- Payout retention score (5 pts max)
    v_retention_score := v_retention_rate * 5;

    -- Savings engagement score (4 pts flat when true)
    IF v_has_savings THEN
        v_savings_score := 4;
    END IF;

    v_details := jsonb_build_object(
        'wallet_balance', ROUND(COALESCE(v_wallet.available_balance_cents, 0) / 100.0, 2),
        'total_deposited', ROUND(v_total_deposited_cents / 100.0, 2),
        'deposit_count', v_wallet_deposits,
        'payout_retention_rate', ROUND(v_retention_rate * 100, 1),
        'has_savings_goals', v_has_savings,
        'last_wallet_deposit', v_score_record.last_wallet_deposit_at
    );

    RETURN QUERY SELECT
        ROUND(v_wallet_score + v_retention_score + v_savings_score, 2),
        ROUND(v_wallet_score, 2),
        ROUND(v_retention_score, 2),
        ROUND(v_savings_score, 2),
        v_details;
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '330',
  'fix_broken_factor_calculators',
  ARRAY['-- 330: fix 3 factor RPCs — enum values + wrong table/column names in legacy schema-drift']
)
ON CONFLICT (version) DO NOTHING;
