-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 028: Token Incentives System
-- ══════════════════════════════════════════════════════════════════════════════
-- Creates token economy for Elder rewards:
--   • token_balances      — per-user balance tracking
--   • token_transactions  — immutable ledger of all token movements
--   • token_rates         — configurable token-to-USD conversion
--   • token_award_rules   — admin-tunable reward amounts per event
--   • PL/pgSQL functions  — award_tokens, spend_tokens, get_token_balance
--   • Triggers            — auto-award on vouch success & mediation resolved
-- ══════════════════════════════════════════════════════════════════════════════

-- ============================================================================
-- STEP 1: Create TOKEN_BALANCES table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.token_balances (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0,
    lifetime_earned INTEGER NOT NULL DEFAULT 0,
    lifetime_spent INTEGER NOT NULL DEFAULT 0,
    last_earned_at TIMESTAMPTZ,
    last_spent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.token_balances IS 'Per-user token balance. One row per user, upserted on earn/spend.';
COMMENT ON COLUMN public.token_balances.balance IS 'Current spendable token balance';
COMMENT ON COLUMN public.token_balances.lifetime_earned IS 'Total tokens ever earned (for analytics/leaderboards)';
COMMENT ON COLUMN public.token_balances.lifetime_spent IS 'Total tokens ever spent';

-- ============================================================================
-- STEP 2: Create TOKEN_TRANSACTIONS table (immutable ledger)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,             -- positive = earn, negative = spend
    type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'transfer_in', 'transfer_out', 'admin_adjustment')),
    category TEXT NOT NULL,              -- e.g. 'vouch_success', 'mediation_resolved', 'fee_discount'
    reference_type TEXT,                 -- e.g. 'member_vouches', 'disputes', 'training_course'
    reference_id UUID,                   -- FK to the source entity
    description TEXT NOT NULL,
    balance_after INTEGER NOT NULL,      -- snapshot of balance after this transaction
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.token_transactions IS 'Immutable ledger of all token movements. Never updated or deleted.';
COMMENT ON COLUMN public.token_transactions.category IS 'Earning: vouch_success, mediation_resolved, appeal_upheld, training_completed, elder_endorsed, oversight_panel, council_monthly. Spending: fee_discount, priority_placement, merchandise, withdrawal';

-- ============================================================================
-- STEP 3: Create TOKEN_RATES table (conversion rate)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.token_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_value_usd DECIMAL(10, 4) NOT NULL DEFAULT 0.10,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,         -- NULL = currently active
    set_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.token_rates IS 'Token-to-USD conversion rate history. Only one row should have effective_until IS NULL (current rate).';

-- Seed initial rate: 1 token = $0.10
INSERT INTO public.token_rates (token_value_usd, effective_from)
VALUES (0.10, NOW());

-- ============================================================================
-- STEP 4: Create TOKEN_AWARD_RULES table (admin-tunable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.token_award_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL UNIQUE,
    token_amount INTEGER NOT NULL,
    description TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    max_per_day INTEGER,                 -- optional daily cap per user
    max_per_month INTEGER,               -- optional monthly cap per user
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.token_award_rules IS 'Configurable token reward amounts per event type. Admin can adjust without code changes.';

-- Seed default award rates
INSERT INTO public.token_award_rules (event_type, token_amount, description) VALUES
    ('vouch_success',       10,  'Successful vouch completion'),
    ('mediation_resolved',  20,  'Mediation case resolved without appeal'),
    ('appeal_upheld',       50,  'Appeal ruling upheld by council'),
    ('training_completed',   5,  'Training course completed'),
    ('elder_endorsed',      15,  'Endorsing a new Elder'),
    ('oversight_panel',     30,  'Oversight panel member per milestone approved'),
    ('council_monthly',    100,  'Monthly council participation');

-- ============================================================================
-- STEP 5: Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_token_transactions_user
    ON public.token_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_token_transactions_type
    ON public.token_transactions(type);

CREATE INDEX IF NOT EXISTS idx_token_transactions_category
    ON public.token_transactions(category);

CREATE INDEX IF NOT EXISTS idx_token_transactions_created
    ON public.token_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_transactions_reference
    ON public.token_transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_token_rates_effective
    ON public.token_rates(effective_from DESC);

-- ============================================================================
-- STEP 6: Row Level Security
-- ============================================================================
ALTER TABLE public.token_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.token_award_rules ENABLE ROW LEVEL SECURITY;

-- token_balances: users can view their own balance
CREATE POLICY "token_balances_select_own"
    ON public.token_balances FOR SELECT
    USING (user_id = auth.uid());

-- token_transactions: users can view their own transactions
CREATE POLICY "token_transactions_select_own"
    ON public.token_transactions FOR SELECT
    USING (user_id = auth.uid());

-- token_rates: everyone can read current rate
CREATE POLICY "token_rates_select_all"
    ON public.token_rates FOR SELECT
    USING (true);

-- token_award_rules: everyone can read active rules
CREATE POLICY "token_award_rules_select_all"
    ON public.token_award_rules FOR SELECT
    USING (true);

-- ============================================================================
-- STEP 7: PL/pgSQL Functions
-- ============================================================================

-- 7a. award_tokens — Atomic: upsert balance + insert transaction
CREATE OR REPLACE FUNCTION award_tokens(
    p_user_id UUID,
    p_amount INTEGER,
    p_category TEXT,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT ''
) RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_new_balance INTEGER;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Award amount must be positive. Got: %', p_amount;
    END IF;

    -- Upsert token_balances (creates row if first-time earn)
    INSERT INTO public.token_balances (user_id, balance, lifetime_earned, last_earned_at, updated_at)
    VALUES (p_user_id, p_amount, p_amount, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        balance = token_balances.balance + p_amount,
        lifetime_earned = token_balances.lifetime_earned + p_amount,
        last_earned_at = NOW(),
        updated_at = NOW()
    RETURNING balance INTO v_new_balance;

    -- Insert immutable transaction record
    INSERT INTO public.token_transactions (
        user_id, amount, type, category,
        reference_type, reference_id,
        description, balance_after
    ) VALUES (
        p_user_id, p_amount, 'earn', p_category,
        p_reference_type, p_reference_id,
        p_description, v_new_balance
    ) RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION award_tokens IS 'Atomically awards tokens to a user. Upserts balance and creates ledger entry.';

-- 7b. spend_tokens — Atomic: check balance, deduct, insert transaction
CREATE OR REPLACE FUNCTION spend_tokens(
    p_user_id UUID,
    p_amount INTEGER,
    p_category TEXT,
    p_reference_type TEXT DEFAULT NULL,
    p_reference_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT ''
) RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Spend amount must be positive. Got: %', p_amount;
    END IF;

    -- Get current balance with row-level lock to prevent race conditions
    SELECT balance INTO v_current_balance
    FROM public.token_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'No token balance found for user %', p_user_id;
    END IF;

    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient token balance. Have: %, Need: %',
            v_current_balance, p_amount;
    END IF;

    -- Deduct from balance
    UPDATE public.token_balances
    SET balance = balance - p_amount,
        lifetime_spent = lifetime_spent + p_amount,
        last_spent_at = NOW(),
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING balance INTO v_new_balance;

    -- Insert transaction (negative amount for spends)
    INSERT INTO public.token_transactions (
        user_id, amount, type, category,
        reference_type, reference_id,
        description, balance_after
    ) VALUES (
        p_user_id, -p_amount, 'spend', p_category,
        p_reference_type, p_reference_id,
        p_description, v_new_balance
    ) RETURNING id INTO v_transaction_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION spend_tokens IS 'Atomically spends tokens. Uses FOR UPDATE row lock to prevent double-spending.';

-- 7c. get_token_balance — Convenience function
CREATE OR REPLACE FUNCTION get_token_balance(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT balance FROM public.token_balances WHERE user_id = p_user_id),
        0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- STEP 8: Auto-Award Triggers
-- ============================================================================

-- 8a. Award tokens when a vouch completes successfully
CREATE OR REPLACE FUNCTION trigger_award_tokens_on_vouch_success()
RETURNS TRIGGER AS $$
DECLARE
    v_token_amount INTEGER;
BEGIN
    -- Only fire when status transitions to 'completed' or 'successful'
    IF NEW.status IN ('completed', 'successful')
       AND (OLD.status IS NULL OR OLD.status NOT IN ('completed', 'successful')) THEN

        SELECT token_amount INTO v_token_amount
        FROM public.token_award_rules
        WHERE event_type = 'vouch_success' AND is_active = TRUE;

        IF v_token_amount IS NOT NULL AND v_token_amount > 0 THEN
            PERFORM award_tokens(
                NEW.voucher_user_id,
                v_token_amount,
                'vouch_success',
                'member_vouches',
                NEW.id,
                'Tokens awarded: successful vouch'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_token_vouch_success ON public.member_vouches;
CREATE TRIGGER trigger_token_vouch_success
    AFTER UPDATE ON public.member_vouches
    FOR EACH ROW EXECUTE FUNCTION trigger_award_tokens_on_vouch_success();

-- 8b. Award tokens when a dispute/mediation case is resolved
CREATE OR REPLACE FUNCTION trigger_award_tokens_on_mediation_resolved()
RETURNS TRIGGER AS $$
DECLARE
    v_token_amount INTEGER;
BEGIN
    -- Only fire when status transitions to 'resolved'
    IF NEW.status = 'resolved'
       AND (OLD.status IS NULL OR OLD.status != 'resolved')
       AND NEW.assigned_to IS NOT NULL THEN

        SELECT token_amount INTO v_token_amount
        FROM public.token_award_rules
        WHERE event_type = 'mediation_resolved' AND is_active = TRUE;

        IF v_token_amount IS NOT NULL AND v_token_amount > 0 THEN
            PERFORM award_tokens(
                NEW.assigned_to,
                v_token_amount,
                'mediation_resolved',
                'disputes',
                NEW.id,
                'Tokens awarded: mediation case resolved'
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_token_mediation_resolved ON public.disputes;
CREATE TRIGGER trigger_token_mediation_resolved
    AFTER UPDATE ON public.disputes
    FOR EACH ROW EXECUTE FUNCTION trigger_award_tokens_on_mediation_resolved();

-- 8c. Auto-create token_balances row for new users
CREATE OR REPLACE FUNCTION handle_new_profile_tokens()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.token_balances (user_id, balance)
    VALUES (NEW.id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_tokens ON profiles;
CREATE TRIGGER on_profile_created_tokens
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION handle_new_profile_tokens();

-- ============================================================================
-- STEP 9: Enable Realtime
-- ============================================================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE token_balances;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE token_transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 028
-- ══════════════════════════════════════════════════════════════════════════════
