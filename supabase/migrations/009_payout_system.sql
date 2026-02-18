-- Migration: 009_payout_system.sql
-- Description: Enhanced payout system with scheduling, rotation, and withdrawal tracking
-- Author: TandaXn Development Team
-- Date: 2024

-- =====================================================
-- PAYOUT SCHEDULES TABLE
-- Pre-generated payout order for circles
-- =====================================================
CREATE TABLE IF NOT EXISTS payout_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    cycle_number INTEGER NOT NULL,
    recipient_id UUID NOT NULL REFERENCES profiles(id),
    scheduled_date DATE NOT NULL,
    rotation_method TEXT NOT NULL CHECK (rotation_method IN ('random', 'xnscore', 'auction', 'sequential', 'need_based')),
    position_in_rotation INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'eligible', 'processing', 'completed', 'skipped', 'defaulted')),
    eligibility_checked_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(circle_id, cycle_number)
);

-- =====================================================
-- PAYOUT METHODS TABLE
-- User's withdrawal/payout method preferences
-- =====================================================
CREATE TABLE IF NOT EXISTS payout_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    method_type TEXT NOT NULL CHECK (method_type IN ('wallet', 'bank_transfer', 'mobile_money', 'card', 'cash')),
    is_default BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verification_date TIMESTAMPTZ,

    -- Bank transfer details (encrypted in production)
    bank_name TEXT,
    account_number TEXT,
    routing_number TEXT,
    account_holder_name TEXT,
    bank_country TEXT,

    -- Mobile money details
    mobile_provider TEXT,
    mobile_number TEXT,

    -- Card details (tokenized)
    card_token TEXT,
    card_last_four TEXT,
    card_brand TEXT,

    -- Metadata
    nickname TEXT,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PAYOUT REQUESTS TABLE
-- User requests for payout/withdrawal
-- =====================================================
CREATE TABLE IF NOT EXISTS payout_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    payout_id UUID REFERENCES payouts(id),
    payout_method_id UUID REFERENCES payout_methods(id),

    amount DECIMAL(15, 2) NOT NULL,
    currency TEXT DEFAULT 'XAF',

    fee_amount DECIMAL(15, 2) DEFAULT 0,
    net_amount DECIMAL(15, 2) NOT NULL,

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'approved', 'processing', 'completed', 'failed', 'cancelled', 'refunded'
    )),

    -- Processing details
    processor_reference TEXT,
    processor_response JSONB,
    processed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Failure details
    failure_reason TEXT,
    retry_count INTEGER DEFAULT 0,
    last_retry_at TIMESTAMPTZ,

    -- Approval workflow
    requires_approval BOOLEAN DEFAULT false,
    approved_by UUID REFERENCES profiles(id),
    approved_at TIMESTAMPTZ,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- PAYOUT FEES TABLE
-- Fee configuration for different payout methods
-- =====================================================
CREATE TABLE IF NOT EXISTS payout_fees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    method_type TEXT NOT NULL,
    country TEXT,
    currency TEXT DEFAULT 'XAF',

    -- Fee structure
    flat_fee DECIMAL(10, 2) DEFAULT 0,
    percentage_fee DECIMAL(5, 4) DEFAULT 0, -- e.g., 0.015 = 1.5%
    min_fee DECIMAL(10, 2) DEFAULT 0,
    max_fee DECIMAL(10, 2),

    -- Thresholds
    min_amount DECIMAL(15, 2) DEFAULT 0,
    max_amount DECIMAL(15, 2),

    -- Processing time (in hours)
    processing_time_hours INTEGER DEFAULT 24,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(method_type, country, currency)
);

-- =====================================================
-- PAYOUT BATCHES TABLE
-- For batch processing of multiple payouts
-- =====================================================
CREATE TABLE IF NOT EXISTS payout_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_reference TEXT UNIQUE NOT NULL,

    total_count INTEGER NOT NULL DEFAULT 0,
    successful_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    pending_count INTEGER DEFAULT 0,

    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    total_fees DECIMAL(15, 2) DEFAULT 0,

    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'partial', 'failed'
    )),

    processor TEXT, -- 'manual', 'flutterwave', 'paystack', etc.
    processor_batch_id TEXT,

    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link payout requests to batches
ALTER TABLE payout_requests
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES payout_batches(id);

-- =====================================================
-- ENHANCE EXISTING PAYOUTS TABLE
-- Add additional columns if they don't exist
-- =====================================================
DO $$
BEGIN
    -- Add payout_method column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payouts' AND column_name = 'payout_method') THEN
        ALTER TABLE payouts ADD COLUMN payout_method TEXT DEFAULT 'wallet';
    END IF;

    -- Add fee_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payouts' AND column_name = 'fee_amount') THEN
        ALTER TABLE payouts ADD COLUMN fee_amount DECIMAL(15, 2) DEFAULT 0;
    END IF;

    -- Add net_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payouts' AND column_name = 'net_amount') THEN
        ALTER TABLE payouts ADD COLUMN net_amount DECIMAL(15, 2);
    END IF;

    -- Add payout_method_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payouts' AND column_name = 'payout_method_id') THEN
        ALTER TABLE payouts ADD COLUMN payout_method_id UUID REFERENCES payout_methods(id);
    END IF;

    -- Add rotation_method column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payouts' AND column_name = 'rotation_method') THEN
        ALTER TABLE payouts ADD COLUMN rotation_method TEXT;
    END IF;

    -- Add position_in_rotation column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payouts' AND column_name = 'position_in_rotation') THEN
        ALTER TABLE payouts ADD COLUMN position_in_rotation INTEGER;
    END IF;

    -- Add scheduled_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payouts' AND column_name = 'scheduled_date') THEN
        ALTER TABLE payouts ADD COLUMN scheduled_date DATE;
    END IF;

    -- Add processed_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payouts' AND column_name = 'processed_at') THEN
        ALTER TABLE payouts ADD COLUMN processed_at TIMESTAMPTZ;
    END IF;

    -- Add processor_reference column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'payouts' AND column_name = 'processor_reference') THEN
        ALTER TABLE payouts ADD COLUMN processor_reference TEXT;
    END IF;
END $$;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_payout_schedules_circle ON payout_schedules(circle_id);
CREATE INDEX IF NOT EXISTS idx_payout_schedules_recipient ON payout_schedules(recipient_id);
CREATE INDEX IF NOT EXISTS idx_payout_schedules_date ON payout_schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_payout_schedules_status ON payout_schedules(status);

CREATE INDEX IF NOT EXISTS idx_payout_methods_user ON payout_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_methods_default ON payout_methods(user_id, is_default) WHERE is_default = true;

CREATE INDEX IF NOT EXISTS idx_payout_requests_user ON payout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_requests_status ON payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_requests_batch ON payout_requests(batch_id);

CREATE INDEX IF NOT EXISTS idx_payouts_scheduled_date ON payouts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_payouts_payout_method ON payouts(payout_method);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE payout_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_batches ENABLE ROW LEVEL SECURITY;

-- Payout Schedules Policies
DROP POLICY IF EXISTS "Users can view their circle payout schedules" ON payout_schedules;
CREATE POLICY "Users can view their circle payout schedules" ON payout_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = payout_schedules.circle_id
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Circle admins can manage payout schedules" ON payout_schedules;
CREATE POLICY "Circle admins can manage payout schedules" ON payout_schedules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = payout_schedules.circle_id
            AND user_id = auth.uid()
            AND role IN ('admin', 'organizer')
        )
    );

-- Payout Methods Policies
DROP POLICY IF EXISTS "Users can view own payout methods" ON payout_methods;
CREATE POLICY "Users can view own payout methods" ON payout_methods
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own payout methods" ON payout_methods;
CREATE POLICY "Users can manage own payout methods" ON payout_methods
    FOR ALL USING (user_id = auth.uid());

-- Payout Requests Policies
DROP POLICY IF EXISTS "Users can view own payout requests" ON payout_requests;
CREATE POLICY "Users can view own payout requests" ON payout_requests
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own payout requests" ON payout_requests;
CREATE POLICY "Users can create own payout requests" ON payout_requests
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can cancel own pending payout requests" ON payout_requests;
CREATE POLICY "Users can cancel own pending payout requests" ON payout_requests
    FOR UPDATE USING (user_id = auth.uid() AND status = 'pending');

-- Payout Fees Policies (read-only for all authenticated users)
DROP POLICY IF EXISTS "Anyone can view payout fees" ON payout_fees;
CREATE POLICY "Anyone can view payout fees" ON payout_fees
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Payout Batches Policies
DROP POLICY IF EXISTS "Admins can manage payout batches" ON payout_batches;
CREATE POLICY "Admins can manage payout batches" ON payout_batches
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE user_id = auth.uid()
            AND is_active = true
        )
    );

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payout_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS trigger_payout_schedules_updated_at ON payout_schedules;
CREATE TRIGGER trigger_payout_schedules_updated_at
    BEFORE UPDATE ON payout_schedules
    FOR EACH ROW EXECUTE FUNCTION update_payout_updated_at();

DROP TRIGGER IF EXISTS trigger_payout_methods_updated_at ON payout_methods;
CREATE TRIGGER trigger_payout_methods_updated_at
    BEFORE UPDATE ON payout_methods
    FOR EACH ROW EXECUTE FUNCTION update_payout_updated_at();

DROP TRIGGER IF EXISTS trigger_payout_requests_updated_at ON payout_requests;
CREATE TRIGGER trigger_payout_requests_updated_at
    BEFORE UPDATE ON payout_requests
    FOR EACH ROW EXECUTE FUNCTION update_payout_updated_at();

DROP TRIGGER IF EXISTS trigger_payout_batches_updated_at ON payout_batches;
CREATE TRIGGER trigger_payout_batches_updated_at
    BEFORE UPDATE ON payout_batches
    FOR EACH ROW EXECUTE FUNCTION update_payout_updated_at();

-- Function to ensure only one default payout method per user
CREATE OR REPLACE FUNCTION ensure_single_default_payout_method()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE payout_methods
        SET is_default = false
        WHERE user_id = NEW.user_id
        AND id != NEW.id
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_single_default_payout_method ON payout_methods;
CREATE TRIGGER trigger_single_default_payout_method
    BEFORE INSERT OR UPDATE ON payout_methods
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_payout_method();

-- Function to calculate net amount on payout request
CREATE OR REPLACE FUNCTION calculate_payout_net_amount()
RETURNS TRIGGER AS $$
BEGIN
    NEW.net_amount = NEW.amount - COALESCE(NEW.fee_amount, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_payout_net_amount ON payout_requests;
CREATE TRIGGER trigger_calculate_payout_net_amount
    BEFORE INSERT OR UPDATE ON payout_requests
    FOR EACH ROW EXECUTE FUNCTION calculate_payout_net_amount();

-- =====================================================
-- DEFAULT FEE CONFIGURATION
-- =====================================================
INSERT INTO payout_fees (method_type, country, currency, flat_fee, percentage_fee, min_fee, max_fee, processing_time_hours)
VALUES
    ('wallet', NULL, 'XAF', 0, 0, 0, NULL, 0),
    ('bank_transfer', 'CM', 'XAF', 500, 0.01, 500, 5000, 24),
    ('mobile_money', 'CM', 'XAF', 100, 0.015, 100, 2000, 1),
    ('card', NULL, 'XAF', 200, 0.025, 200, 10000, 48)
ON CONFLICT (method_type, country, currency) DO NOTHING;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON payout_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON payout_methods TO authenticated;
GRANT SELECT, INSERT, UPDATE ON payout_requests TO authenticated;
GRANT SELECT ON payout_fees TO authenticated;
GRANT ALL ON payout_batches TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE payout_schedules IS 'Pre-generated payout rotation schedule for circles';
COMMENT ON TABLE payout_methods IS 'User withdrawal/payout method preferences and details';
COMMENT ON TABLE payout_requests IS 'Individual payout/withdrawal requests from users';
COMMENT ON TABLE payout_fees IS 'Fee configuration for different payout methods';
COMMENT ON TABLE payout_batches IS 'Batch processing for bulk payouts';
