-- ═══════════════════════════════════════════════════════════════════════════
-- 331_financial_factor_use_wallet_retention.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Follow-up to mig 330. That migration fixed 3 legacy drift bugs in
-- calculate_financial_behavior_factor. First live run surfaced a 4th:
-- the retention-rate lookup queried `payout_preferences.wallet_percentage`
-- but that column doesn't exist on the table (payout_preferences has
-- destination / split_config / bank_account_id / savings_goal_id — no
-- percentage columns at all).
--
-- The retention rate the factor wants actually lives on
-- user_wallets.money_retention_rate (0.0000–1.0000, default 1.0000).
-- We already load v_wallet in this RPC, so use it directly — drop the
-- payout_preferences query entirely.
-- ═══════════════════════════════════════════════════════════════════════════

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
    SELECT * INTO v_wallet FROM user_wallets WHERE user_id = p_user_id;

    IF v_score_record IS NULL THEN
        RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, 0::DECIMAL, '{}'::JSONB;
        RETURN;
    END IF;

    SELECT COUNT(*), COALESCE(SUM(amount_cents), 0)
    INTO v_wallet_deposits, v_total_deposited_cents
    FROM wallet_transactions
    WHERE user_id = p_user_id
      AND transaction_type = 'wallet_deposit'
      AND transaction_status = 'completed';

    -- Retention rate from user_wallets (was: payout_preferences.
    -- wallet_percentage, which doesn't exist on that table).
    -- money_retention_rate is already 0-1 scaled, no /100 needed.
    v_retention_rate := COALESCE(v_wallet.money_retention_rate, 0);

    SELECT EXISTS(
        SELECT 1 FROM user_savings_goals
         WHERE user_id = p_user_id
           AND (goal_status IS NULL
                OR goal_status NOT IN ('cancelled','archived'))
    ) INTO v_has_savings;

    IF v_wallet_deposits > 0 THEN
        v_wallet_score := LEAST(6, (LEAST(v_wallet_deposits, 12)::DECIMAL / 12) * 6);
    END IF;

    v_retention_score := v_retention_rate * 5;

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
  '331',
  'financial_factor_use_wallet_retention',
  ARRAY['-- 331: retention rate from user_wallets.money_retention_rate (payout_preferences has no percentage col)']
)
ON CONFLICT (version) DO NOTHING;
