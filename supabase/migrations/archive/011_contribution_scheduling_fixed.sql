-- Migration: 011_contribution_scheduling_fixed.sql
-- Description: Contribution Scheduling Algorithm - Due dates, payments, late fees, defaults
-- Note: This handles existing contributions table by adding columns if needed
-- Author: TandaXn Development Team
-- Date: 2024

-- =====================================================
-- CONTRIBUTION SCHEDULES
-- Pre-calculated schedule for all rounds in a circle
-- =====================================================
CREATE TABLE IF NOT EXISTS contribution_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    due_date DATE NOT NULL,

    -- Payout recipient for this round
    payout_recipient_id UUID REFERENCES profiles(id),
    payout_amount DECIMAL(15, 2),

    -- Status
    status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN (
        'upcoming',     -- Future round
        'active',       -- Current round (contributions being collected)
        'completed',    -- All contributions collected, payout disbursed
        'partial',      -- Some contributions collected, payout disbursed
        'failed'        -- Round failed (too many defaults)
    )),

    -- Tracking
    expected_contributions INTEGER NOT NULL DEFAULT 0,
    received_contributions INTEGER DEFAULT 0,
    total_collected DECIMAL(15, 2) DEFAULT 0,
    total_late_fees DECIMAL(15, 2) DEFAULT 0,

    -- Payout tracking
    payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN (
        'pending', 'scheduled', 'processing', 'disbursed', 'failed'
    )),
    payout_disbursed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(circle_id, round_number)
);

-- =====================================================
-- ENHANCE EXISTING CONTRIBUTIONS TABLE
-- Add columns if they don't exist
-- =====================================================
DO $$
BEGIN
    -- round_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'round_number') THEN
        ALTER TABLE contributions ADD COLUMN round_number INTEGER DEFAULT 1;
    END IF;

    -- schedule_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'schedule_id') THEN
        ALTER TABLE contributions ADD COLUMN schedule_id UUID REFERENCES contribution_schedules(id);
    END IF;

    -- member_id (might already exist)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'member_id') THEN
        ALTER TABLE contributions ADD COLUMN member_id UUID REFERENCES circle_members(id);
    END IF;

    -- currency
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'currency') THEN
        ALTER TABLE contributions ADD COLUMN currency TEXT DEFAULT 'XAF';
    END IF;

    -- due_date
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'due_date') THEN
        ALTER TABLE contributions ADD COLUMN due_date DATE;
    END IF;

    -- paid_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'paid_at') THEN
        ALTER TABLE contributions ADD COLUMN paid_at TIMESTAMPTZ;
    END IF;

    -- is_late
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'is_late') THEN
        ALTER TABLE contributions ADD COLUMN is_late BOOLEAN DEFAULT false;
    END IF;

    -- days_late
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'days_late') THEN
        ALTER TABLE contributions ADD COLUMN days_late INTEGER DEFAULT 0;
    END IF;

    -- grace_period_used
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'grace_period_used') THEN
        ALTER TABLE contributions ADD COLUMN grace_period_used BOOLEAN DEFAULT false;
    END IF;

    -- late_fee
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'late_fee') THEN
        ALTER TABLE contributions ADD COLUMN late_fee DECIMAL(15, 2) DEFAULT 0;
    END IF;

    -- total_charged
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'total_charged') THEN
        ALTER TABLE contributions ADD COLUMN total_charged DECIMAL(15, 2);
    END IF;

    -- payment_method
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'payment_method') THEN
        ALTER TABLE contributions ADD COLUMN payment_method TEXT;
    END IF;

    -- transaction_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'transaction_id') THEN
        ALTER TABLE contributions ADD COLUMN transaction_id TEXT;
    END IF;

    -- processor_reference
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'processor_reference') THEN
        ALTER TABLE contributions ADD COLUMN processor_reference TEXT;
    END IF;

    -- default_recorded
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'default_recorded') THEN
        ALTER TABLE contributions ADD COLUMN default_recorded BOOLEAN DEFAULT false;
    END IF;

    -- security_deposit_applied
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'security_deposit_applied') THEN
        ALTER TABLE contributions ADD COLUMN security_deposit_applied DECIMAL(15, 2) DEFAULT 0;
    END IF;

    -- guarantor_covered
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'guarantor_covered') THEN
        ALTER TABLE contributions ADD COLUMN guarantor_covered BOOLEAN DEFAULT false;
    END IF;

    -- reminder_sent_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'reminder_sent_at') THEN
        ALTER TABLE contributions ADD COLUMN reminder_sent_at TIMESTAMPTZ;
    END IF;

    -- late_notice_sent_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'late_notice_sent_at') THEN
        ALTER TABLE contributions ADD COLUMN late_notice_sent_at TIMESTAMPTZ;
    END IF;

    -- default_notice_sent_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'contributions' AND column_name = 'default_notice_sent_at') THEN
        ALTER TABLE contributions ADD COLUMN default_notice_sent_at TIMESTAMPTZ;
    END IF;
END $$;

-- =====================================================
-- MEMBER CONTRIBUTION STATS
-- Aggregated stats per member per circle
-- =====================================================
CREATE TABLE IF NOT EXISTS member_contribution_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    member_id UUID REFERENCES circle_members(id),

    -- Payment stats
    total_payments_due INTEGER DEFAULT 0,
    total_payments_made INTEGER DEFAULT 0,
    total_amount_paid DECIMAL(15, 2) DEFAULT 0,

    -- Late payment stats
    total_late_payments INTEGER DEFAULT 0,
    total_late_fees_paid DECIMAL(15, 2) DEFAULT 0,
    total_grace_periods_used INTEGER DEFAULT 0,

    -- Default stats
    total_defaults INTEGER DEFAULT 0,
    total_security_deposit_used DECIMAL(15, 2) DEFAULT 0,

    -- Streaks
    current_on_time_streak INTEGER DEFAULT 0,
    longest_on_time_streak INTEGER DEFAULT 0,

    -- Payout tracking
    payout_received BOOLEAN DEFAULT false,
    payout_position INTEGER,
    payout_date DATE,
    payout_amount DECIMAL(15, 2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, circle_id)
);

-- =====================================================
-- LATE FEE CONFIGURATION
-- Configurable per circle or platform-wide
-- =====================================================
CREATE TABLE IF NOT EXISTS late_fee_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Scope (NULL = platform default)
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,

    -- Grace period
    grace_period_days INTEGER DEFAULT 2,

    -- Late fee (5% is the reconciled decision)
    late_fee_type TEXT DEFAULT 'percentage' CHECK (late_fee_type IN ('percentage', 'flat')),
    late_fee_percentage DECIMAL(5, 4) DEFAULT 0.05,  -- 5%
    late_fee_flat DECIMAL(10, 2) DEFAULT 0,
    late_fee_min DECIMAL(10, 2) DEFAULT 0,
    late_fee_max DECIMAL(10, 2),

    -- Default threshold
    default_threshold_days INTEGER DEFAULT 8,

    -- Tier downgrade
    tier_downgrade_threshold INTEGER DEFAULT 3,  -- late payments before downgrade

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert platform default (if not exists)
INSERT INTO late_fee_config (
    grace_period_days, late_fee_type, late_fee_percentage, default_threshold_days
)
SELECT 2, 'percentage', 0.05, 8
WHERE NOT EXISTS (
    SELECT 1 FROM late_fee_config WHERE circle_id IS NULL AND community_id IS NULL
);

-- =====================================================
-- CONTRIBUTION REMINDERS
-- Scheduled reminders for upcoming/overdue contributions
-- =====================================================
CREATE TABLE IF NOT EXISTS contribution_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contribution_id UUID NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID NOT NULL REFERENCES circles(id),

    reminder_type TEXT NOT NULL CHECK (reminder_type IN (
        'upcoming_3day',    -- 3 days before due
        'upcoming_1day',    -- 1 day before due
        'due_today',        -- Due date
        'grace_period',     -- During grace period
        'late_warning',     -- After grace, before default
        'default_warning',  -- Approaching default threshold
        'defaulted'         -- Default recorded
    )),

    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,

    -- Delivery
    channels TEXT[] DEFAULT ARRAY['push', 'email'],
    delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN (
        'pending', 'sent', 'delivered', 'failed'
    )),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MEMBER EVENTS (for XnScore and tier changes)
-- =====================================================
CREATE TABLE IF NOT EXISTS member_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    member_id UUID REFERENCES circle_members(id),
    circle_id UUID REFERENCES circles(id),

    event_type TEXT NOT NULL CHECK (event_type IN (
        'payment_on_time',
        'payment_late',
        'payment_defaulted',
        'grace_period_used',
        'security_deposit_applied',
        'tier_downgrade_triggered',
        'streak_milestone',
        'payout_received'
    )),

    severity TEXT DEFAULT 'info' CHECK (severity IN (
        'info', 'low', 'medium', 'high', 'critical'
    )),

    details JSONB DEFAULT '{}',

    -- XnScore impact (calculated by XnScoreEngine)
    xn_score_impact INTEGER,
    xn_score_before INTEGER,
    xn_score_after INTEGER,

    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ENHANCE CIRCLES TABLE
-- Add fields for contribution tracking
-- =====================================================
DO $$
BEGIN
    -- Contribution frequency
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'contribution_frequency') THEN
        ALTER TABLE circles ADD COLUMN contribution_frequency TEXT DEFAULT 'monthly';
    END IF;

    -- Total cycles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'total_cycles') THEN
        ALTER TABLE circles ADD COLUMN total_cycles INTEGER;
    END IF;

    -- Current cycle
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'current_cycle') THEN
        ALTER TABLE circles ADD COLUMN current_cycle INTEGER DEFAULT 1;
    END IF;

    -- Collection stats
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'total_collected') THEN
        ALTER TABLE circles ADD COLUMN total_collected DECIMAL(15, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'total_late_payments') THEN
        ALTER TABLE circles ADD COLUMN total_late_payments INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'total_late_fees_collected') THEN
        ALTER TABLE circles ADD COLUMN total_late_fees_collected DECIMAL(15, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circles' AND column_name = 'total_defaults') THEN
        ALTER TABLE circles ADD COLUMN total_defaults INTEGER DEFAULT 0;
    END IF;
END $$;

-- =====================================================
-- ENHANCE CIRCLE_MEMBERS TABLE
-- Add fields for contribution stats
-- =====================================================
DO $$
BEGIN
    -- Payout position
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'payout_position') THEN
        ALTER TABLE circle_members ADD COLUMN payout_position INTEGER;
    END IF;

    -- Payout received flag
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'payout_received') THEN
        ALTER TABLE circle_members ADD COLUMN payout_received BOOLEAN DEFAULT false;
    END IF;

    -- Security deposit
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'security_deposit') THEN
        ALTER TABLE circle_members ADD COLUMN security_deposit DECIMAL(15, 2) DEFAULT 0;
    END IF;

    -- Auto-pay enabled
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'auto_pay_enabled') THEN
        ALTER TABLE circle_members ADD COLUMN auto_pay_enabled BOOLEAN DEFAULT false;
    END IF;

    -- Payment stats
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'total_payments_made') THEN
        ALTER TABLE circle_members ADD COLUMN total_payments_made INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'total_amount_paid') THEN
        ALTER TABLE circle_members ADD COLUMN total_amount_paid DECIMAL(15, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'total_late_payments') THEN
        ALTER TABLE circle_members ADD COLUMN total_late_payments INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'circle_members' AND column_name = 'total_late_fees_paid') THEN
        ALTER TABLE circle_members ADD COLUMN total_late_fees_paid DECIMAL(15, 2) DEFAULT 0;
    END IF;
END $$;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_contribution_schedules_circle ON contribution_schedules(circle_id);
CREATE INDEX IF NOT EXISTS idx_contribution_schedules_status ON contribution_schedules(status);
CREATE INDEX IF NOT EXISTS idx_contribution_schedules_due_date ON contribution_schedules(due_date);

CREATE INDEX IF NOT EXISTS idx_contributions_round ON contributions(circle_id, round_number);
CREATE INDEX IF NOT EXISTS idx_contributions_due_date ON contributions(due_date);

CREATE INDEX IF NOT EXISTS idx_member_stats_user ON member_contribution_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_member_stats_circle ON member_contribution_stats(circle_id);

CREATE INDEX IF NOT EXISTS idx_reminders_user ON contribution_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON contribution_reminders(scheduled_for) WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_member_events_user ON member_events(user_id);
CREATE INDEX IF NOT EXISTS idx_member_events_circle ON member_events(circle_id);
CREATE INDEX IF NOT EXISTS idx_member_events_type ON member_events(event_type);
CREATE INDEX IF NOT EXISTS idx_member_events_unprocessed ON member_events(processed) WHERE processed = false;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE contribution_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_contribution_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE late_fee_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_events ENABLE ROW LEVEL SECURITY;

-- Contribution Schedules - circle members can view
DROP POLICY IF EXISTS "Circle members can view schedules" ON contribution_schedules;
CREATE POLICY "Circle members can view schedules" ON contribution_schedules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_id = contribution_schedules.circle_id
            AND user_id = auth.uid()
        )
    );

-- Member Stats - users see own
DROP POLICY IF EXISTS "Users can view own stats" ON member_contribution_stats;
CREATE POLICY "Users can view own stats" ON member_contribution_stats
    FOR SELECT USING (user_id = auth.uid());

-- Late Fee Config - read only for all
DROP POLICY IF EXISTS "Anyone can view late fee config" ON late_fee_config;
CREATE POLICY "Anyone can view late fee config" ON late_fee_config
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Reminders - users see own
DROP POLICY IF EXISTS "Users can view own reminders" ON contribution_reminders;
CREATE POLICY "Users can view own reminders" ON contribution_reminders
    FOR SELECT USING (user_id = auth.uid());

-- Member Events - users see own
DROP POLICY IF EXISTS "Users can view own events" ON member_events;
CREATE POLICY "Users can view own events" ON member_events
    FOR SELECT USING (user_id = auth.uid());

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to calculate due date with calendar month support
CREATE OR REPLACE FUNCTION calculate_round_due_date(
    p_start_date DATE,
    p_frequency TEXT,
    p_round_number INTEGER
) RETURNS DATE AS $$
DECLARE
    v_due_date DATE;
    v_original_day INTEGER;
    v_last_day_of_month INTEGER;
BEGIN
    v_due_date := p_start_date;
    v_original_day := EXTRACT(DAY FROM p_start_date);

    CASE p_frequency
        WHEN 'daily' THEN
            v_due_date := p_start_date + (p_round_number * INTERVAL '1 day');
        WHEN 'weekly' THEN
            v_due_date := p_start_date + (p_round_number * INTERVAL '7 days');
        WHEN 'biweekly' THEN
            v_due_date := p_start_date + (p_round_number * INTERVAL '14 days');
        WHEN 'monthly' THEN
            v_due_date := p_start_date + (p_round_number * INTERVAL '1 month');
            -- Clamp to valid day if needed (e.g., Jan 31 -> Feb 28)
            v_last_day_of_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_due_date) + INTERVAL '1 month' - INTERVAL '1 day'));
            IF v_original_day > v_last_day_of_month THEN
                v_due_date := DATE_TRUNC('month', v_due_date) + (v_last_day_of_month - 1) * INTERVAL '1 day';
            END IF;
        WHEN 'quarterly' THEN
            v_due_date := p_start_date + (p_round_number * INTERVAL '3 months');
            v_last_day_of_month := EXTRACT(DAY FROM (DATE_TRUNC('month', v_due_date) + INTERVAL '1 month' - INTERVAL '1 day'));
            IF v_original_day > v_last_day_of_month THEN
                v_due_date := DATE_TRUNC('month', v_due_date) + (v_last_day_of_month - 1) * INTERVAL '1 day';
            END IF;
        ELSE
            v_due_date := p_start_date + (p_round_number * INTERVAL '1 month');
    END CASE;

    RETURN v_due_date;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate late fee
CREATE OR REPLACE FUNCTION calculate_late_fee(
    p_amount DECIMAL,
    p_days_late INTEGER,
    p_grace_period INTEGER DEFAULT 2,
    p_fee_percentage DECIMAL DEFAULT 0.05
) RETURNS DECIMAL AS $$
BEGIN
    -- No fee during grace period
    IF p_days_late <= p_grace_period THEN
        RETURN 0;
    END IF;

    -- 5% late fee after grace period
    RETURN ROUND(p_amount * p_fee_percentage, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to update stats when contribution is processed
CREATE OR REPLACE FUNCTION update_circle_contribution_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if status changed to completed or late
    IF NEW.status IN ('completed', 'late') AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
        -- Update circle totals
        UPDATE circles SET
            total_collected = COALESCE(total_collected, 0) + COALESCE(NEW.total_charged, NEW.amount),
            total_late_payments = COALESCE(total_late_payments, 0) + CASE WHEN NEW.is_late THEN 1 ELSE 0 END,
            total_late_fees_collected = COALESCE(total_late_fees_collected, 0) + COALESCE(NEW.late_fee, 0),
            updated_at = NOW()
        WHERE id = NEW.circle_id;

        -- Update member stats if member_id exists
        IF NEW.member_id IS NOT NULL THEN
            UPDATE circle_members SET
                total_payments_made = COALESCE(total_payments_made, 0) + 1,
                total_amount_paid = COALESCE(total_amount_paid, 0) + COALESCE(NEW.total_charged, NEW.amount),
                total_late_payments = COALESCE(total_late_payments, 0) + CASE WHEN NEW.is_late THEN 1 ELSE 0 END,
                total_late_fees_paid = COALESCE(total_late_fees_paid, 0) + COALESCE(NEW.late_fee, 0),
                updated_at = NOW()
            WHERE id = NEW.member_id;
        END IF;

        -- Update schedule stats if schedule_id exists
        IF NEW.schedule_id IS NOT NULL THEN
            UPDATE contribution_schedules SET
                received_contributions = COALESCE(received_contributions, 0) + 1,
                total_collected = COALESCE(total_collected, 0) + COALESCE(NEW.total_charged, NEW.amount),
                total_late_fees = COALESCE(total_late_fees, 0) + COALESCE(NEW.late_fee, 0),
                updated_at = NOW()
            WHERE id = NEW.schedule_id;
        END IF;
    END IF;

    -- Handle defaults
    IF NEW.status = 'defaulted' AND (OLD.status IS NULL OR OLD.status != 'defaulted') THEN
        UPDATE circles SET
            total_defaults = COALESCE(total_defaults, 0) + 1,
            updated_at = NOW()
        WHERE id = NEW.circle_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_circle_contribution_stats ON contributions;
CREATE TRIGGER trigger_update_circle_contribution_stats
    AFTER UPDATE ON contributions
    FOR EACH ROW
    EXECUTE FUNCTION update_circle_contribution_stats();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_contribution_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_schedules_updated_at ON contribution_schedules;
CREATE TRIGGER trigger_schedules_updated_at
    BEFORE UPDATE ON contribution_schedules
    FOR EACH ROW EXECUTE FUNCTION update_contribution_updated_at();

-- =====================================================
-- GRANTS
-- =====================================================
GRANT SELECT ON contribution_schedules TO authenticated;
GRANT SELECT, UPDATE ON contributions TO authenticated;
GRANT SELECT ON member_contribution_stats TO authenticated;
GRANT SELECT ON late_fee_config TO authenticated;
GRANT SELECT ON contribution_reminders TO authenticated;
GRANT SELECT ON member_events TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE contribution_schedules IS 'Pre-calculated schedule for all rounds in a circle';
COMMENT ON TABLE member_contribution_stats IS 'Aggregated contribution stats per member per circle';
COMMENT ON TABLE late_fee_config IS 'Configurable late fee rules (default: 2 day grace, 5% fee, 8 day default)';
COMMENT ON TABLE contribution_reminders IS 'Scheduled reminders for contributions';
COMMENT ON TABLE member_events IS 'Events for XnScore calculation and tier changes';
COMMENT ON FUNCTION calculate_round_due_date IS 'Calculate due date with calendar month support for monthly/quarterly';
COMMENT ON FUNCTION calculate_late_fee IS 'Calculate late fee with grace period (5% after grace)';
