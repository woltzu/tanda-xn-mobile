-- Migration: 015_payout_execution_engine_v5.sql
-- Description: Payout Execution Engine - Credit Union Model
-- Fixed version: Fixed EXTRACT type casting in view
-- Author: TandaXn Development Team
-- Date: 2024

-- =====================================================
-- CLEANUP
-- =====================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT oid::regprocedure as func_sig
        FROM pg_proc
        WHERE proname IN (
            'calculate_wallet_totals', 'get_wallet_summary', 'process_wallet_credit',
            'process_wallet_debit', 'get_payout_distribution_options', 'update_wallet_timestamp',
            'is_savings_goal_locked'
        )
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_sig || ' CASCADE';
    END LOOP;
END $$;

DROP VIEW IF EXISTS v_wallet_overview CASCADE;
DROP VIEW IF EXISTS v_pending_reservations CASCADE;
DROP VIEW IF EXISTS v_payout_analytics CASCADE;
DROP VIEW IF EXISTS v_money_retention_stats CASCADE;

DROP INDEX IF EXISTS idx_pe_uba_user;
DROP INDEX IF EXISTS idx_pe_uba_status;
DROP INDEX IF EXISTS idx_pe_uw_user;
DROP INDEX IF EXISTS idx_pe_uw_status;
DROP INDEX IF EXISTS idx_pe_wt_wallet;
DROP INDEX IF EXISTS idx_pe_wt_user;
DROP INDEX IF EXISTS idx_pe_wt_type;
DROP INDEX IF EXISTS idx_pe_wt_created;
DROP INDEX IF EXISTS idx_pe_wt_reference;
DROP INDEX IF EXISTS idx_pe_cr_wallet;
DROP INDEX IF EXISTS idx_pe_cr_circle;
DROP INDEX IF EXISTS idx_pe_cr_status;
DROP INDEX IF EXISTS idx_pe_cr_due;
DROP INDEX IF EXISTS idx_pe_pp_user;
DROP INDEX IF EXISTS idx_pe_pex_cycle;
DROP INDEX IF EXISTS idx_pe_pex_recipient;
DROP INDEX IF EXISTS idx_pe_pex_status;
DROP INDEX IF EXISTS idx_pe_usg_user;
DROP INDEX IF EXISTS idx_pe_usg_status;
DROP INDEX IF EXISTS idx_pe_st_goal;
DROP INDEX IF EXISTS idx_pe_st_user;
DROP INDEX IF EXISTS idx_pe_mm_user;
DROP INDEX IF EXISTS idx_pe_mm_type;
DROP INDEX IF EXISTS idx_pe_mm_status;
DROP INDEX IF EXISTS idx_pe_mm_processor;
DROP INDEX IF EXISTS idx_pe_rr_user;
DROP INDEX IF EXISTS idx_pe_rr_status;

DO $$ BEGIN DROP POLICY IF EXISTS "pe_uba_select" ON user_bank_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_uba_insert" ON user_bank_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_uba_update" ON user_bank_accounts; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_uw_select" ON user_wallets; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_uw_update" ON user_wallets; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_wt_select" ON wallet_transactions; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_cr_select" ON contribution_reservations; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_pp_select" ON payout_preferences; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_pp_insert" ON payout_preferences; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_pp_update" ON payout_preferences; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_pex_select" ON payout_executions; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_usg_select" ON user_savings_goals; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_usg_insert" ON user_savings_goals; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_usg_update" ON user_savings_goals; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_st_select" ON savings_transactions; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_mm_select" ON money_movements; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "pe_rr_select" ON remittance_recipients; EXCEPTION WHEN undefined_table THEN NULL; END $$;

DROP TABLE IF EXISTS savings_transactions CASCADE;
DROP TABLE IF EXISTS user_savings_goals CASCADE;
DROP TABLE IF EXISTS savings_goal_types CASCADE;
DROP TABLE IF EXISTS payout_executions CASCADE;
DROP TABLE IF EXISTS payout_preferences CASCADE;
DROP TABLE IF EXISTS contribution_reservations CASCADE;
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS money_movements CASCADE;
DROP TABLE IF EXISTS user_wallets CASCADE;
DROP TABLE IF EXISTS remittance_recipients CASCADE;
DROP TABLE IF EXISTS user_bank_accounts CASCADE;

-- =====================================================
-- USER BANK ACCOUNTS TABLE
-- =====================================================
CREATE TABLE user_bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    bank_name TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'checking',
    account_last4 TEXT NOT NULL,
    routing_number_last4 TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    verification_attempts INTEGER DEFAULT 0,
    dwolla_funding_source_id TEXT,
    dwolla_funding_source_url TEXT,
    plaid_account_id TEXT,
    plaid_access_token TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    is_primary BOOLEAN DEFAULT FALSE,
    nickname TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- REMITTANCE RECIPIENTS TABLE
-- =====================================================
CREATE TABLE remittance_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT,
    recipient_email TEXT,
    relationship TEXT,
    country TEXT NOT NULL,
    city TEXT,
    address TEXT,
    delivery_method TEXT NOT NULL DEFAULT 'mobile_money',
    mobile_money_provider TEXT,
    mobile_money_number TEXT,
    bank_name TEXT,
    bank_account_number TEXT,
    bank_code TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    total_sent_count INTEGER DEFAULT 0,
    total_sent_amount_cents BIGINT DEFAULT 0,
    last_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- MONEY MOVEMENTS TABLE
-- =====================================================
CREATE TABLE money_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    movement_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    user_id UUID REFERENCES profiles(id),
    circle_id UUID REFERENCES circles(id),
    cycle_id UUID REFERENCES circle_cycles(id),
    bank_account_id UUID REFERENCES user_bank_accounts(id),
    processor TEXT NOT NULL DEFAULT 'internal',
    processor_transaction_id TEXT,
    processor_transaction_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    failure_reason TEXT,
    failure_code TEXT,
    processor_fee_cents INTEGER DEFAULT 0,
    platform_fee_cents INTEGER DEFAULT 0,
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    correlation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- USER WALLETS TABLE
-- =====================================================
CREATE TABLE user_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id),
    main_balance_cents BIGINT NOT NULL DEFAULT 0,
    reserved_balance_cents BIGINT NOT NULL DEFAULT 0,
    committed_balance_cents BIGINT NOT NULL DEFAULT 0,
    total_balance_cents BIGINT GENERATED ALWAYS AS (
        main_balance_cents + reserved_balance_cents + committed_balance_cents
    ) STORED,
    available_balance_cents BIGINT GENERATED ALWAYS AS (main_balance_cents) STORED,
    total_interest_earned_cents BIGINT DEFAULT 0,
    wallet_status TEXT NOT NULL DEFAULT 'active',
    frozen_reason TEXT,
    frozen_at TIMESTAMPTZ,
    default_payout_destination TEXT DEFAULT 'wallet',
    auto_reserve_enabled BOOLEAN DEFAULT TRUE,
    total_payouts_received_cents BIGINT DEFAULT 0,
    total_withdrawals_cents BIGINT DEFAULT 0,
    money_retention_rate DECIMAL(5,4) DEFAULT 1.0000,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT positive_main CHECK (main_balance_cents >= 0),
    CONSTRAINT positive_reserved CHECK (reserved_balance_cents >= 0),
    CONSTRAINT positive_committed CHECK (committed_balance_cents >= 0)
);

-- =====================================================
-- WALLET TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES user_wallets(id),
    user_id UUID NOT NULL REFERENCES profiles(id),
    transaction_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    amount_cents BIGINT NOT NULL,
    balance_type TEXT NOT NULL,
    balance_before_cents BIGINT NOT NULL,
    balance_after_cents BIGINT NOT NULL,
    reference_type TEXT,
    reference_id UUID,
    money_movement_id UUID REFERENCES money_movements(id),
    description TEXT NOT NULL,
    transaction_status TEXT NOT NULL DEFAULT 'completed',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CONTRIBUTION RESERVATIONS TABLE
-- =====================================================
CREATE TABLE contribution_reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES user_wallets(id),
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID NOT NULL REFERENCES circles(id),
    cycle_id UUID REFERENCES circle_cycles(id),
    cycle_number INTEGER,
    amount_cents BIGINT NOT NULL,
    due_date DATE NOT NULL,
    reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reservation_status TEXT NOT NULL DEFAULT 'reserved',
    used_at TIMESTAMPTZ,
    used_for_transaction_id UUID REFERENCES wallet_transactions(id),
    released_at TIMESTAMPTZ,
    release_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- PAYOUT PREFERENCES TABLE
-- =====================================================
CREATE TABLE payout_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    preference_scope TEXT NOT NULL DEFAULT 'default',
    circle_id UUID REFERENCES circles(id),
    destination TEXT NOT NULL DEFAULT 'wallet',
    bank_account_id UUID REFERENCES user_bank_accounts(id),
    savings_goal_id UUID,
    split_config JSONB,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, preference_scope, circle_id)
);

-- =====================================================
-- PAYOUT EXECUTIONS TABLE
-- =====================================================
CREATE TABLE payout_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id),
    cycle_id UUID NOT NULL REFERENCES circle_cycles(id),
    cycle_number INTEGER NOT NULL,
    recipient_user_id UUID NOT NULL REFERENCES profiles(id),
    recipient_wallet_id UUID NOT NULL REFERENCES user_wallets(id),
    gross_amount_cents BIGINT NOT NULL,
    platform_fee_cents BIGINT NOT NULL,
    net_amount_cents BIGINT NOT NULL,
    distribution JSONB NOT NULL,
    verification_checks JSONB NOT NULL DEFAULT '{}',
    all_checks_passed BOOLEAN NOT NULL DEFAULT FALSE,
    execution_status TEXT NOT NULL DEFAULT 'pending',
    wallet_credit_transaction_id UUID REFERENCES wallet_transactions(id),
    savings_transfer_transaction_ids UUID[],
    bank_transfer_movement_id UUID REFERENCES money_movements(id),
    verified_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    suggestions_shown JSONB,
    suggestion_accepted TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SAVINGS GOAL TYPES TABLE
-- =====================================================
CREATE TABLE savings_goal_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    interest_rate DECIMAL(5,4) NOT NULL,
    interest_frequency TEXT DEFAULT 'monthly',
    minimum_balance_cents BIGINT DEFAULT 0,
    lock_period_days INTEGER DEFAULT 0,
    early_withdrawal_penalty_percent DECIMAL(5,2) DEFAULT 0,
    icon TEXT,
    color TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- USER SAVINGS GOALS TABLE
-- =====================================================
CREATE TABLE user_savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    wallet_id UUID NOT NULL REFERENCES user_wallets(id),
    savings_goal_type_id UUID NOT NULL REFERENCES savings_goal_types(id),
    name TEXT NOT NULL,
    target_amount_cents BIGINT,
    target_date DATE,
    current_balance_cents BIGINT NOT NULL DEFAULT 0,
    total_deposits_cents BIGINT DEFAULT 0,
    total_withdrawals_cents BIGINT DEFAULT 0,
    total_interest_earned_cents BIGINT DEFAULT 0,
    last_interest_accrual_at TIMESTAMPTZ,
    accrued_interest_cents BIGINT DEFAULT 0,
    locked_until DATE,
    goal_status TEXT NOT NULL DEFAULT 'active',
    last_deposit_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SAVINGS TRANSACTIONS TABLE
-- =====================================================
CREATE TABLE savings_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    savings_goal_id UUID NOT NULL REFERENCES user_savings_goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    transaction_type TEXT NOT NULL,
    source TEXT,
    amount_cents BIGINT NOT NULL,
    balance_before_cents BIGINT NOT NULL,
    balance_after_cents BIGINT NOT NULL,
    wallet_transaction_id UUID REFERENCES wallet_transactions(id),
    transaction_status TEXT NOT NULL DEFAULT 'completed',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ENHANCE EXISTING TABLES
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_cycles' AND column_name = 'payout_execution_id') THEN
        ALTER TABLE circle_cycles ADD COLUMN payout_execution_id UUID;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'money_retention_rate') THEN
        ALTER TABLE profiles ADD COLUMN money_retention_rate DECIMAL(5,4) DEFAULT 1.0000;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'total_platform_payouts_cents') THEN
        ALTER TABLE profiles ADD COLUMN total_platform_payouts_cents BIGINT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'total_external_withdrawals_cents') THEN
        ALTER TABLE profiles ADD COLUMN total_external_withdrawals_cents BIGINT DEFAULT 0;
    END IF;
END $$;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_pe_uba_user ON user_bank_accounts(user_id);
CREATE INDEX idx_pe_uba_status ON user_bank_accounts(status);
CREATE INDEX idx_pe_rr_user ON remittance_recipients(user_id);
CREATE INDEX idx_pe_rr_status ON remittance_recipients(status);
CREATE INDEX idx_pe_mm_user ON money_movements(user_id);
CREATE INDEX idx_pe_mm_type ON money_movements(movement_type);
CREATE INDEX idx_pe_mm_status ON money_movements(status);
CREATE INDEX idx_pe_uw_user ON user_wallets(user_id);
CREATE INDEX idx_pe_uw_status ON user_wallets(wallet_status);
CREATE INDEX idx_pe_wt_wallet ON wallet_transactions(wallet_id);
CREATE INDEX idx_pe_wt_user ON wallet_transactions(user_id);
CREATE INDEX idx_pe_wt_type ON wallet_transactions(transaction_type);
CREATE INDEX idx_pe_wt_created ON wallet_transactions(created_at);
CREATE INDEX idx_pe_cr_wallet ON contribution_reservations(wallet_id);
CREATE INDEX idx_pe_cr_circle ON contribution_reservations(circle_id);
CREATE INDEX idx_pe_cr_status ON contribution_reservations(reservation_status);
CREATE INDEX idx_pe_pp_user ON payout_preferences(user_id);
CREATE INDEX idx_pe_pex_cycle ON payout_executions(cycle_id);
CREATE INDEX idx_pe_pex_recipient ON payout_executions(recipient_user_id);
CREATE INDEX idx_pe_pex_status ON payout_executions(execution_status);
CREATE INDEX idx_pe_usg_user ON user_savings_goals(user_id);
CREATE INDEX idx_pe_usg_status ON user_savings_goals(goal_status);
CREATE INDEX idx_pe_st_goal ON savings_transactions(savings_goal_id);
CREATE INDEX idx_pe_st_user ON savings_transactions(user_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE user_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE remittance_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE money_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pe_uba_select" ON user_bank_accounts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pe_uba_insert" ON user_bank_accounts FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "pe_uba_update" ON user_bank_accounts FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pe_rr_select" ON remittance_recipients FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pe_mm_select" ON money_movements FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pe_uw_select" ON user_wallets FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pe_uw_update" ON user_wallets FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pe_wt_select" ON wallet_transactions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pe_cr_select" ON contribution_reservations FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pe_pp_select" ON payout_preferences FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pe_pp_insert" ON payout_preferences FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "pe_pp_update" ON payout_preferences FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pe_pex_select" ON payout_executions FOR SELECT USING (
    recipient_user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM circle_members WHERE circle_id = payout_executions.circle_id AND user_id = auth.uid() AND role IN ('leader', 'admin'))
);
CREATE POLICY "pe_usg_select" ON user_savings_goals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pe_usg_insert" ON user_savings_goals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "pe_usg_update" ON user_savings_goals FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pe_st_select" ON savings_transactions FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- SEED DATA
-- =====================================================
INSERT INTO savings_goal_types (code, name, description, interest_rate, lock_period_days, icon, color, display_order) VALUES
('emergency', 'Emergency Fund', 'For unexpected expenses - always accessible', 0.0300, 0, 'shield', '#10B981', 1),
('education', 'Education', 'School fees and educational expenses', 0.0500, 90, 'graduation-cap', '#3B82F6', 2),
('housing', 'Housing', 'Down payment or rent savings', 0.0350, 180, 'home', '#8B5CF6', 3),
('business', 'Business', 'Start or grow your business', 0.0400, 90, 'briefcase', '#F59E0B', 4),
('family', 'Family Support', 'Remittances and family obligations', 0.0250, 0, 'users', '#EC4899', 5),
('general', 'General Savings', 'Flexible savings for any purpose', 0.0200, 0, 'piggy-bank', '#6B7280', 6),
('locked', 'Fixed Deposit', 'Higher interest for longer commitment', 0.0600, 365, 'lock', '#1F2937', 7)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, interest_rate = EXCLUDED.interest_rate;

-- =====================================================
-- FUNCTIONS
-- =====================================================
CREATE FUNCTION get_wallet_summary(p_user_id UUID)
RETURNS TABLE (
    wallet_id UUID, main_balance DECIMAL, reserved_balance DECIMAL, committed_balance DECIMAL,
    total_balance DECIMAL, available_balance DECIMAL, total_savings DECIMAL,
    savings_goals_count INTEGER, upcoming_contributions DECIMAL, money_retention_rate DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT w.id, w.main_balance_cents / 100.0, w.reserved_balance_cents / 100.0,
        w.committed_balance_cents / 100.0, w.total_balance_cents / 100.0,
        w.available_balance_cents / 100.0, COALESCE(sg.total_savings, 0) / 100.0,
        COALESCE(sg.goals_count, 0)::INTEGER, COALESCE(cr.upcoming_total, 0) / 100.0,
        w.money_retention_rate
    FROM user_wallets w
    LEFT JOIN (
        SELECT usg.wallet_id, SUM(usg.current_balance_cents) as total_savings, COUNT(*) as goals_count
        FROM user_savings_goals usg WHERE usg.goal_status = 'active' GROUP BY usg.wallet_id
    ) sg ON w.id = sg.wallet_id
    LEFT JOIN (
        SELECT cres.wallet_id, SUM(cres.amount_cents) as upcoming_total
        FROM contribution_reservations cres
        WHERE cres.reservation_status = 'reserved' AND cres.due_date <= CURRENT_DATE + INTERVAL '30 days'
        GROUP BY cres.wallet_id
    ) cr ON w.id = cr.wallet_id
    WHERE w.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION process_wallet_credit(
    p_wallet_id UUID, p_amount_cents BIGINT, p_transaction_type TEXT,
    p_reference_type TEXT, p_reference_id UUID, p_description TEXT, p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_wallet user_wallets%ROWTYPE;
    v_transaction_id UUID;
BEGIN
    SELECT * INTO v_wallet FROM user_wallets WHERE id = p_wallet_id FOR UPDATE;
    IF v_wallet IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    IF v_wallet.wallet_status != 'active' THEN RAISE EXCEPTION 'Wallet is not active'; END IF;

    INSERT INTO wallet_transactions (wallet_id, user_id, transaction_type, direction, amount_cents,
        balance_type, balance_before_cents, balance_after_cents, reference_type, reference_id,
        description, transaction_status, metadata)
    VALUES (p_wallet_id, v_wallet.user_id, p_transaction_type, 'credit', p_amount_cents, 'main',
        v_wallet.main_balance_cents, v_wallet.main_balance_cents + p_amount_cents,
        p_reference_type, p_reference_id, p_description, 'completed', p_metadata)
    RETURNING id INTO v_transaction_id;

    UPDATE user_wallets SET main_balance_cents = main_balance_cents + p_amount_cents,
        last_activity_at = NOW(), updated_at = NOW() WHERE id = p_wallet_id;

    IF p_transaction_type = 'circle_payout' THEN
        UPDATE user_wallets SET total_payouts_received_cents = total_payouts_received_cents + p_amount_cents
        WHERE id = p_wallet_id;
    END IF;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION process_wallet_debit(
    p_wallet_id UUID, p_amount_cents BIGINT, p_transaction_type TEXT,
    p_reference_type TEXT, p_reference_id UUID, p_description TEXT, p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_wallet user_wallets%ROWTYPE;
    v_transaction_id UUID;
BEGIN
    SELECT * INTO v_wallet FROM user_wallets WHERE id = p_wallet_id FOR UPDATE;
    IF v_wallet IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
    IF v_wallet.wallet_status != 'active' THEN RAISE EXCEPTION 'Wallet is not active'; END IF;
    IF v_wallet.main_balance_cents < p_amount_cents THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    INSERT INTO wallet_transactions (wallet_id, user_id, transaction_type, direction, amount_cents,
        balance_type, balance_before_cents, balance_after_cents, reference_type, reference_id,
        description, transaction_status, metadata)
    VALUES (p_wallet_id, v_wallet.user_id, p_transaction_type, 'debit', p_amount_cents, 'main',
        v_wallet.main_balance_cents, v_wallet.main_balance_cents - p_amount_cents,
        p_reference_type, p_reference_id, p_description, 'completed', p_metadata)
    RETURNING id INTO v_transaction_id;

    UPDATE user_wallets SET main_balance_cents = main_balance_cents - p_amount_cents,
        last_activity_at = NOW(), updated_at = NOW() WHERE id = p_wallet_id;

    IF p_transaction_type = 'withdrawal' THEN
        UPDATE user_wallets SET total_withdrawals_cents = total_withdrawals_cents + p_amount_cents,
            money_retention_rate = CASE WHEN total_payouts_received_cents > 0
                THEN GREATEST(0, (total_payouts_received_cents - total_withdrawals_cents - p_amount_cents)::DECIMAL / total_payouts_received_cents)
                ELSE 1.0 END
        WHERE id = p_wallet_id;
    END IF;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION update_wallet_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION is_savings_goal_locked(p_locked_until DATE) RETURNS BOOLEAN AS $$
BEGIN
    RETURN p_locked_until IS NOT NULL AND p_locked_until > CURRENT_DATE;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE TRIGGER trg_user_wallets_updated BEFORE UPDATE ON user_wallets FOR EACH ROW EXECUTE FUNCTION update_wallet_timestamp();
CREATE TRIGGER trg_payout_preferences_updated BEFORE UPDATE ON payout_preferences FOR EACH ROW EXECUTE FUNCTION update_wallet_timestamp();
CREATE TRIGGER trg_payout_executions_updated BEFORE UPDATE ON payout_executions FOR EACH ROW EXECUTE FUNCTION update_wallet_timestamp();
CREATE TRIGGER trg_user_savings_goals_updated BEFORE UPDATE ON user_savings_goals FOR EACH ROW EXECUTE FUNCTION update_wallet_timestamp();
CREATE TRIGGER trg_money_movements_updated BEFORE UPDATE ON money_movements FOR EACH ROW EXECUTE FUNCTION update_wallet_timestamp();
CREATE TRIGGER trg_user_bank_accounts_updated BEFORE UPDATE ON user_bank_accounts FOR EACH ROW EXECUTE FUNCTION update_wallet_timestamp();
CREATE TRIGGER trg_remittance_recipients_updated BEFORE UPDATE ON remittance_recipients FOR EACH ROW EXECUTE FUNCTION update_wallet_timestamp();

-- =====================================================
-- VIEWS (Fixed EXTRACT syntax)
-- =====================================================
CREATE VIEW v_wallet_overview AS
SELECT w.user_id, w.id as wallet_id,
    w.main_balance_cents / 100.0 as main_balance,
    w.reserved_balance_cents / 100.0 as reserved_balance,
    w.committed_balance_cents / 100.0 as committed_balance,
    w.total_balance_cents / 100.0 as total_balance,
    w.available_balance_cents / 100.0 as available_balance,
    w.wallet_status, w.default_payout_destination, w.auto_reserve_enabled,
    w.total_payouts_received_cents / 100.0 as total_payouts_received,
    w.total_withdrawals_cents / 100.0 as total_withdrawals,
    w.money_retention_rate, w.total_interest_earned_cents / 100.0 as total_interest_earned,
    w.last_activity_at,
    COALESCE(sg.savings_total, 0) / 100.0 as total_in_savings,
    COALESCE(sg.savings_count, 0) as savings_goals_count
FROM user_wallets w
LEFT JOIN (
    SELECT usg.wallet_id, SUM(usg.current_balance_cents) as savings_total, COUNT(*) as savings_count
    FROM user_savings_goals usg WHERE usg.goal_status = 'active' GROUP BY usg.wallet_id
) sg ON w.id = sg.wallet_id;

-- Fixed: Use date subtraction directly instead of EXTRACT
CREATE VIEW v_pending_reservations AS
SELECT cr.id, cr.user_id, cr.circle_id, c.name as circle_name, cr.cycle_number,
    cr.amount_cents / 100.0 as amount, cr.due_date, cr.reservation_status, cr.reserved_at,
    (cr.due_date - CURRENT_DATE) as days_until_due
FROM contribution_reservations cr
JOIN circles c ON cr.circle_id = c.id
WHERE cr.reservation_status = 'reserved'
ORDER BY cr.due_date ASC;

CREATE VIEW v_payout_analytics AS
SELECT DATE_TRUNC('week', pe.created_at) as week, COUNT(*) as total_payouts,
    SUM(pe.net_amount_cents) / 100.0 as total_amount,
    SUM(pe.platform_fee_cents) / 100.0 as total_fees,
    SUM(COALESCE((pe.distribution->>'to_wallet')::BIGINT, 0)) / 100.0 as amount_to_wallets,
    SUM(COALESCE((pe.distribution->'to_bank'->>'amount_cents')::BIGINT, 0)) / 100.0 as amount_to_banks,
    COUNT(*) FILTER (WHERE pe.distribution->>'to_bank' IS NULL OR pe.distribution->'to_bank' IS NULL) as wallet_only_payouts,
    COUNT(*) FILTER (WHERE pe.distribution->>'to_bank' IS NOT NULL AND pe.distribution->'to_bank' IS NOT NULL) as external_payouts
FROM payout_executions pe
WHERE pe.execution_status = 'completed' AND pe.created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('week', pe.created_at) ORDER BY week DESC;

CREATE VIEW v_money_retention_stats AS
SELECT 'platform' as scope, COUNT(DISTINCT w.user_id) as total_users,
    SUM(w.total_payouts_received_cents) / 100.0 as total_payouts,
    SUM(w.total_withdrawals_cents) / 100.0 as total_withdrawals,
    SUM(w.total_balance_cents) / 100.0 as current_balances,
    ROUND(AVG(w.money_retention_rate) * 100, 2) as avg_retention_rate
FROM user_wallets w WHERE w.total_payouts_received_cents > 0;

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT, INSERT, UPDATE ON user_bank_accounts TO authenticated;
GRANT SELECT ON remittance_recipients TO authenticated;
GRANT SELECT ON money_movements TO authenticated;
GRANT SELECT ON user_wallets TO authenticated;
GRANT UPDATE (default_payout_destination, auto_reserve_enabled) ON user_wallets TO authenticated;
GRANT SELECT ON wallet_transactions TO authenticated;
GRANT SELECT ON contribution_reservations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON payout_preferences TO authenticated;
GRANT SELECT ON payout_executions TO authenticated;
GRANT SELECT ON savings_goal_types TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_savings_goals TO authenticated;
GRANT SELECT ON savings_transactions TO authenticated;
GRANT SELECT ON v_wallet_overview TO authenticated;
GRANT SELECT ON v_pending_reservations TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE user_bank_accounts IS 'External bank account connections for deposits and withdrawals';
COMMENT ON TABLE remittance_recipients IS 'Recipients for sending remittances abroad';
COMMENT ON TABLE money_movements IS 'Track all external money flows (ACH, Dwolla transfers)';
COMMENT ON TABLE user_wallets IS 'Main wallet for each user - the heart of the credit union model';
COMMENT ON TABLE wallet_transactions IS 'Internal ledger tracking all wallet movements';
COMMENT ON TABLE contribution_reservations IS 'Auto-reservations for upcoming circle contributions';
COMMENT ON TABLE payout_preferences IS 'User preferences for how payouts should be distributed';
COMMENT ON TABLE payout_executions IS 'Complete record of each payout execution with verification and distribution';
COMMENT ON TABLE savings_goal_types IS 'Types of savings goals with different interest rates and rules';
COMMENT ON TABLE user_savings_goals IS 'Individual user savings buckets within their wallet';
COMMENT ON TABLE savings_transactions IS 'Transaction history for savings goals';
