-- ============================================================================
-- 008_default_cascade.sql
-- Default Cascade Handler Support Tables
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ADD RESERVE FUND TO COMMUNITIES
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'communities' AND column_name = 'reserve_fund_balance') THEN
        ALTER TABLE communities ADD COLUMN reserve_fund_balance DECIMAL(15,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'communities' AND column_name = 'reserve_fund_target') THEN
        ALTER TABLE communities ADD COLUMN reserve_fund_target DECIMAL(15,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'communities' AND column_name = 'reserve_contribution_percent') THEN
        ALTER TABLE communities ADD COLUMN reserve_contribution_percent DECIMAL(4,2) DEFAULT 2.00;
    END IF;
END $$;

-- ============================================================================
-- RESERVE FUND TRANSACTIONS TABLE
-- Track all reserve fund deposits and withdrawals
-- ============================================================================

CREATE TABLE IF NOT EXISTS reserve_fund_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,

    -- Transaction details
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'contribution',      -- Regular contribution from circle payments
        'default_coverage',  -- Used to cover a default
        'replenishment',     -- Manual replenishment
        'withdrawal',        -- Manual withdrawal
        'interest',          -- Interest earned
        'refund'            -- Refund from recovered default
    )),

    -- Amount (positive for deposits, negative for withdrawals)
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(15,2) NOT NULL,

    -- Related records
    circle_id UUID REFERENCES circles(id),
    default_id UUID REFERENCES defaults(id),
    user_id UUID REFERENCES auth.users(id), -- Who initiated (for manual transactions)

    -- Details
    description TEXT,
    metadata JSONB,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reserve_transactions_community ON reserve_fund_transactions(community_id);
CREATE INDEX IF NOT EXISTS idx_reserve_transactions_type ON reserve_fund_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_reserve_transactions_date ON reserve_fund_transactions(created_at);

-- ============================================================================
-- SHARED LOSS RECORDS TABLE
-- Track when defaults are distributed among members
-- ============================================================================

CREATE TABLE IF NOT EXISTS shared_loss_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    default_id UUID REFERENCES defaults(id) ON DELETE SET NULL,

    -- User who bears the loss
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- The defaulter
    defaulter_user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Share details
    share_amount DECIMAL(12,2) NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'waived', 'disputed')),

    -- Payment tracking
    paid_at TIMESTAMPTZ,
    waived_by UUID REFERENCES auth.users(id),
    waived_reason TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shared_loss_circle ON shared_loss_records(circle_id);
CREATE INDEX IF NOT EXISTS idx_shared_loss_user ON shared_loss_records(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_loss_defaulter ON shared_loss_records(defaulter_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_loss_status ON shared_loss_records(status);

-- ============================================================================
-- DEFAULT RECOVERY ATTEMPTS TABLE
-- Track attempts to recover defaulted amounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS default_recovery_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    default_id UUID NOT NULL REFERENCES defaults(id) ON DELETE CASCADE,

    -- Attempt details
    attempt_number INTEGER NOT NULL DEFAULT 1,
    attempt_type VARCHAR(50) NOT NULL CHECK (attempt_type IN (
        'auto_debit',        -- Automatic debit attempt
        'manual_payment',    -- User initiated payment
        'payment_plan',      -- Partial payment as part of plan
        'collection',        -- Collection agency
        'legal'             -- Legal action
    )),

    -- Amount
    amount_attempted DECIMAL(12,2) NOT NULL,
    amount_recovered DECIMAL(12,2) DEFAULT 0,

    -- Result
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'partial')),
    failure_reason TEXT,

    -- Payment method
    payment_method VARCHAR(50),
    transaction_id TEXT,

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_recovery_attempts_default ON default_recovery_attempts(default_id);
CREATE INDEX IF NOT EXISTS idx_recovery_attempts_status ON default_recovery_attempts(status);

-- ============================================================================
-- PAYMENT PLANS TABLE
-- For structured repayment of defaults
-- ============================================================================

CREATE TABLE IF NOT EXISTS default_payment_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    default_id UUID NOT NULL REFERENCES defaults(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),

    -- Plan details
    total_amount DECIMAL(12,2) NOT NULL,
    num_installments INTEGER NOT NULL,
    installment_amount DECIMAL(12,2) NOT NULL,
    frequency VARCHAR(20) DEFAULT 'weekly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),

    -- Progress
    installments_paid INTEGER DEFAULT 0,
    amount_paid DECIMAL(12,2) DEFAULT 0,

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),

    -- Schedule
    start_date DATE NOT NULL,
    next_payment_date DATE,

    -- Approval
    approved_by UUID REFERENCES auth.users(id),
    approved_at TIMESTAMPTZ,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_plans_default ON default_payment_plans(default_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_user ON default_payment_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_status ON default_payment_plans(status);
CREATE INDEX IF NOT EXISTS idx_payment_plans_next_payment ON default_payment_plans(next_payment_date);

-- ============================================================================
-- PAYMENT PLAN INSTALLMENTS TABLE
-- Track individual installment payments
-- ============================================================================

CREATE TABLE IF NOT EXISTS payment_plan_installments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_plan_id UUID NOT NULL REFERENCES default_payment_plans(id) ON DELETE CASCADE,

    -- Installment details
    installment_number INTEGER NOT NULL,
    amount_due DECIMAL(12,2) NOT NULL,
    due_date DATE NOT NULL,

    -- Payment
    amount_paid DECIMAL(12,2) DEFAULT 0,
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(50),
    transaction_id TEXT,

    -- Status
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'late', 'missed')),

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_installments_plan ON payment_plan_installments(payment_plan_id);
CREATE INDEX IF NOT EXISTS idx_installments_due_date ON payment_plan_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_installments_status ON payment_plan_installments(status);

-- ============================================================================
-- DEFAULT ESCALATIONS TABLE
-- Track escalation steps for unresolved defaults
-- ============================================================================

CREATE TABLE IF NOT EXISTS default_escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    default_id UUID NOT NULL REFERENCES defaults(id) ON DELETE CASCADE,

    -- Escalation details
    escalation_level INTEGER NOT NULL DEFAULT 1,
    escalation_type VARCHAR(50) NOT NULL CHECK (escalation_type IN (
        'reminder',           -- Friendly reminder
        'warning',           -- Formal warning
        'final_notice',      -- Final notice before action
        'account_restriction', -- Restrict account features
        'community_removal', -- Remove from community
        'platform_suspension', -- Suspend platform access
        'collection',        -- Send to collection
        'legal'             -- Legal proceedings
    )),

    -- Status
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'superseded')),

    -- Actions taken
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMPTZ,
    action_taken BOOLEAN DEFAULT FALSE,
    action_taken_at TIMESTAMPTZ,
    action_details TEXT,

    -- Handled by
    escalated_by UUID REFERENCES auth.users(id),
    resolved_by UUID REFERENCES auth.users(id),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_escalations_default ON default_escalations(default_id);
CREATE INDEX IF NOT EXISTS idx_escalations_level ON default_escalations(escalation_level);
CREATE INDEX IF NOT EXISTS idx_escalations_type ON default_escalations(escalation_type);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON default_escalations(status);

-- ============================================================================
-- ADD XN_SCORE TO PROFILES IF NOT EXISTS
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'profiles' AND column_name = 'xn_score') THEN
        ALTER TABLE profiles ADD COLUMN xn_score INTEGER DEFAULT 50 CHECK (xn_score >= 0 AND xn_score <= 100);
    END IF;
END $$;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate total uncovered defaults for a user
CREATE OR REPLACE FUNCTION get_user_uncovered_defaults(p_user_id UUID)
RETURNS TABLE (
    total_count INTEGER,
    total_amount DECIMAL(12,2),
    oldest_default_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER as total_count,
        COALESCE(SUM(amount - COALESCE(covered_amount, 0) - COALESCE(recovered_amount, 0)), 0) as total_amount,
        MIN(created_at) as oldest_default_date
    FROM defaults
    WHERE user_id = p_user_id
      AND status IN ('unresolved', 'grace_period');
END;
$$ LANGUAGE plpgsql;

-- Function to process a default payment
CREATE OR REPLACE FUNCTION process_default_payment(
    p_default_id UUID,
    p_amount DECIMAL(12,2),
    p_payment_method VARCHAR(50),
    p_transaction_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    remaining_amount DECIMAL(12,2),
    is_fully_resolved BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_default RECORD;
    v_new_recovered DECIMAL(12,2);
    v_remaining DECIMAL(12,2);
BEGIN
    -- Get default
    SELECT * INTO v_default FROM defaults WHERE id = p_default_id;

    IF v_default IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::DECIMAL, FALSE, 'Default not found'::TEXT;
        RETURN;
    END IF;

    -- Calculate new recovered amount
    v_new_recovered := COALESCE(v_default.recovered_amount, 0) + p_amount;
    v_remaining := v_default.amount - COALESCE(v_default.covered_amount, 0) - v_new_recovered;

    -- Update default
    UPDATE defaults
    SET
        recovered_amount = v_new_recovered,
        status = CASE WHEN v_remaining <= 0 THEN 'resolved' ELSE status END,
        resolved_at = CASE WHEN v_remaining <= 0 THEN NOW() ELSE resolved_at END,
        resolution_method = CASE WHEN v_remaining <= 0 THEN 'full_payment' ELSE resolution_method END
    WHERE id = p_default_id;

    -- Record recovery attempt
    INSERT INTO default_recovery_attempts (
        default_id, attempt_type, amount_attempted, amount_recovered, status, payment_method, transaction_id, completed_at
    ) VALUES (
        p_default_id, 'manual_payment', p_amount, p_amount, 'success', p_payment_method, p_transaction_id, NOW()
    );

    RETURN QUERY SELECT TRUE, GREATEST(0, v_remaining), v_remaining <= 0, 'Payment processed successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-escalate defaults
CREATE OR REPLACE FUNCTION auto_escalate_defaults()
RETURNS INTEGER AS $$
DECLARE
    v_escalated INTEGER := 0;
    v_default RECORD;
    v_current_level INTEGER;
    v_days_since_default INTEGER;
BEGIN
    FOR v_default IN
        SELECT d.*, gp.expires_at as grace_expires
        FROM defaults d
        LEFT JOIN default_grace_periods gp ON gp.default_id = d.id AND gp.status = 'active'
        WHERE d.status IN ('unresolved', 'grace_period')
    LOOP
        -- Calculate days since default
        v_days_since_default := EXTRACT(DAY FROM NOW() - v_default.created_at);

        -- Get current escalation level
        SELECT COALESCE(MAX(escalation_level), 0) INTO v_current_level
        FROM default_escalations
        WHERE default_id = v_default.id AND status = 'active';

        -- Determine if escalation is needed
        IF v_days_since_default >= 7 AND v_current_level < 1 THEN
            INSERT INTO default_escalations (default_id, escalation_level, escalation_type)
            VALUES (v_default.id, 1, 'warning');
            v_escalated := v_escalated + 1;
        ELSIF v_days_since_default >= 14 AND v_current_level < 2 THEN
            UPDATE default_escalations SET status = 'superseded' WHERE default_id = v_default.id AND status = 'active';
            INSERT INTO default_escalations (default_id, escalation_level, escalation_type)
            VALUES (v_default.id, 2, 'final_notice');
            v_escalated := v_escalated + 1;
        ELSIF v_days_since_default >= 30 AND v_current_level < 3 THEN
            UPDATE default_escalations SET status = 'superseded' WHERE default_id = v_default.id AND status = 'active';
            INSERT INTO default_escalations (default_id, escalation_level, escalation_type)
            VALUES (v_default.id, 3, 'account_restriction');
            v_escalated := v_escalated + 1;
        END IF;
    END LOOP;

    RETURN v_escalated;
END;
$$ LANGUAGE plpgsql;

-- Function to contribute to reserve fund from circle payment
CREATE OR REPLACE FUNCTION contribute_to_reserve_fund()
RETURNS TRIGGER AS $$
DECLARE
    v_community_id UUID;
    v_contribution_percent DECIMAL(4,2);
    v_contribution_amount DECIMAL(12,2);
    v_current_balance DECIMAL(15,2);
BEGIN
    -- Only process for successful payments
    IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
        -- Get community ID and contribution percent
        SELECT c.community_id, com.reserve_contribution_percent
        INTO v_community_id, v_contribution_percent
        FROM circles c
        LEFT JOIN communities com ON com.id = c.community_id
        WHERE c.id = NEW.circle_id;

        IF v_community_id IS NOT NULL AND v_contribution_percent > 0 THEN
            v_contribution_amount := NEW.amount * (v_contribution_percent / 100);

            -- Update community reserve
            UPDATE communities
            SET reserve_fund_balance = COALESCE(reserve_fund_balance, 0) + v_contribution_amount
            WHERE id = v_community_id
            RETURNING reserve_fund_balance INTO v_current_balance;

            -- Log transaction
            INSERT INTO reserve_fund_transactions (
                community_id, transaction_type, amount, balance_after, circle_id, description
            ) VALUES (
                v_community_id, 'contribution', v_contribution_amount, v_current_balance,
                NEW.circle_id, 'Auto-contribution from circle payment'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger would be applied to a payments table if it exists
-- DROP TRIGGER IF EXISTS trigger_reserve_contribution ON payments;
-- CREATE TRIGGER trigger_reserve_contribution
--     AFTER INSERT OR UPDATE ON payments
--     FOR EACH ROW
--     EXECUTE FUNCTION contribute_to_reserve_fund();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE reserve_fund_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_loss_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_recovery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plan_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE default_escalations ENABLE ROW LEVEL SECURITY;

-- Reserve fund transactions - community members can view
CREATE POLICY "Community members can view reserve transactions" ON reserve_fund_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM community_memberships cm
            WHERE cm.community_id = reserve_fund_transactions.community_id
              AND cm.user_id = auth.uid()
              AND cm.status = 'active'
        )
    );

-- Shared loss records - users can view their own
CREATE POLICY "Users can view own shared loss" ON shared_loss_records
    FOR SELECT USING (auth.uid() = user_id);

-- Recovery attempts - users can view their own defaults' attempts
CREATE POLICY "Users can view own recovery attempts" ON default_recovery_attempts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM defaults d
            WHERE d.id = default_recovery_attempts.default_id
              AND d.user_id = auth.uid()
        )
    );

-- Payment plans - users can view and manage their own
CREATE POLICY "Users can view own payment plans" ON default_payment_plans
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own payment plans" ON default_payment_plans
    FOR UPDATE USING (auth.uid() = user_id);

-- Installments - users can view their own plan's installments
CREATE POLICY "Users can view own installments" ON payment_plan_installments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM default_payment_plans pp
            WHERE pp.id = payment_plan_installments.payment_plan_id
              AND pp.user_id = auth.uid()
        )
    );

-- Escalations - users can view their own defaults' escalations
CREATE POLICY "Users can view own escalations" ON default_escalations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM defaults d
            WHERE d.id = default_escalations.default_id
              AND d.user_id = auth.uid()
        )
    );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT EXECUTE ON FUNCTION get_user_uncovered_defaults(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION process_default_payment(UUID, DECIMAL, VARCHAR, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_escalate_defaults() TO authenticated;
