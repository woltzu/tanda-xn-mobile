-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 054: Stripe Connect Payment System
-- Stripe Connect integration for TandaXn digital tontine/ROSCA platform
-- ═══════════════════════════════════════════════════════════════════════════════
-- Architecture:
--   Platform account  = TandaXn (collects all member contributions)
--   Express accounts  = Each member who receives circle payouts
--   Payment Intents   = Deposits (contributions, fees, wallet top-ups)
--   Transfers         = Payouts (circle payouts, refunds, withdrawals)
--
-- Tables:
--   1. stripe_customers            — Maps auth.users → Stripe customer IDs
--   2. stripe_connected_accounts   — Express accounts for receiving payouts
--   3. stripe_payment_methods      — Saved cards, bank accounts, etc.
--   4. stripe_payment_intents      — All inbound payment intents
--   5. stripe_transfers            — Platform-to-member transfers (payouts)
--   6. stripe_webhook_events       — Webhook event log (idempotency)
--   7. stripe_disputes             — Chargeback / dispute tracking
--   8. stripe_refunds              — Refund tracking
--   9. stripe_payout_schedules     — Connected account payout schedules
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SHARED TRIGGER FUNCTION: updated_at timestamp
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_stripe_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─────────────────────────────────────────────────────────────────────────────
-- HELPER: Check if current user is a platform admin
-- Used by RLS policies. Checks JWT app_metadata for platform-level role.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(
        (auth.jwt() -> 'app_metadata' ->> 'platform_role') IN ('admin', 'elder'),
        false
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 1: stripe_customers
-- Maps each TandaXn member to their Stripe customer object.
-- One customer per member. Used for saving payment methods and tracking charges.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    email TEXT,
    default_payment_method_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_stripe_customers_member_id UNIQUE (member_id),
    CONSTRAINT uq_stripe_customers_stripe_id UNIQUE (stripe_customer_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_customers_member_id
    ON stripe_customers (member_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id
    ON stripe_customers (stripe_customer_id);

-- RLS
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own Stripe customer"
    ON stripe_customers FOR SELECT
    USING (auth.uid() = member_id);

CREATE POLICY "Service role has full access to stripe_customers"
    ON stripe_customers FOR ALL
    USING (auth.role() = 'service_role');

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_stripe_customers_updated_at ON stripe_customers;
CREATE TRIGGER trigger_stripe_customers_updated_at
    BEFORE UPDATE ON stripe_customers
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 2: stripe_connected_accounts
-- Express connected accounts for members to receive payouts.
-- Stripe requires onboarding (identity verification, bank account linking).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_connected_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_account_id TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'express'
        CHECK (account_type IN ('express', 'custom', 'standard')),
    onboarding_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (onboarding_status IN ('pending', 'in_progress', 'complete', 'restricted', 'disabled')),
    charges_enabled BOOLEAN DEFAULT false,
    payouts_enabled BOOLEAN DEFAULT false,
    details_submitted BOOLEAN DEFAULT false,
    country TEXT DEFAULT 'US',
    default_currency TEXT DEFAULT 'usd',
    capabilities JSONB DEFAULT '{}',
    requirements JSONB DEFAULT '{}',
    tos_accepted_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_stripe_connected_member_id UNIQUE (member_id),
    CONSTRAINT uq_stripe_connected_account_id UNIQUE (stripe_account_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_connected_member_id
    ON stripe_connected_accounts (member_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connected_account_id
    ON stripe_connected_accounts (stripe_account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_connected_onboarding_active
    ON stripe_connected_accounts (onboarding_status)
    WHERE onboarding_status != 'disabled';

-- RLS
ALTER TABLE stripe_connected_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own connected account"
    ON stripe_connected_accounts FOR SELECT
    USING (auth.uid() = member_id);

CREATE POLICY "Service role has full access to stripe_connected_accounts"
    ON stripe_connected_accounts FOR ALL
    USING (auth.role() = 'service_role');

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_stripe_connected_updated_at ON stripe_connected_accounts;
CREATE TRIGGER trigger_stripe_connected_updated_at
    BEFORE UPDATE ON stripe_connected_accounts
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 3: stripe_payment_methods
-- Saved payment methods: cards, bank accounts, digital wallets.
-- Members can have multiple methods; one marked as default.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    stripe_payment_method_id TEXT NOT NULL,
    type TEXT NOT NULL
        CHECK (type IN ('card', 'us_bank_account', 'link', 'cashapp', 'apple_pay', 'google_pay')),
    is_default BOOLEAN DEFAULT false,

    -- Card details (populated when type = 'card')
    card_brand TEXT,
    card_last4 TEXT,
    card_exp_month INTEGER,
    card_exp_year INTEGER,

    -- Bank account details (populated when type = 'us_bank_account')
    bank_name TEXT,
    bank_last4 TEXT,
    bank_routing_last4 TEXT,

    -- Billing info
    billing_name TEXT,
    billing_email TEXT,
    billing_country TEXT,

    -- Duplicate detection
    fingerprint TEXT,

    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'failed', 'removed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_stripe_pm_stripe_id UNIQUE (stripe_payment_method_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_pm_member_id
    ON stripe_payment_methods (member_id);
CREATE INDEX IF NOT EXISTS idx_stripe_pm_stripe_id
    ON stripe_payment_methods (stripe_payment_method_id);
CREATE INDEX IF NOT EXISTS idx_stripe_pm_fingerprint
    ON stripe_payment_methods (fingerprint);
CREATE INDEX IF NOT EXISTS idx_stripe_pm_member_default
    ON stripe_payment_methods (member_id)
    WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_stripe_pm_active
    ON stripe_payment_methods (status)
    WHERE status = 'active';

-- RLS
ALTER TABLE stripe_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own payment methods"
    ON stripe_payment_methods FOR SELECT
    USING (auth.uid() = member_id);

CREATE POLICY "Service role has full access to stripe_payment_methods"
    ON stripe_payment_methods FOR ALL
    USING (auth.role() = 'service_role');

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_stripe_pm_updated_at ON stripe_payment_methods;
CREATE TRIGGER trigger_stripe_pm_updated_at
    BEFORE UPDATE ON stripe_payment_methods
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 4: stripe_payment_intents
-- Every inbound payment: contributions, fees, wallet deposits, etc.
-- Status mirrors Stripe's payment_intent lifecycle.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id),
    stripe_payment_intent_id TEXT NOT NULL,
    stripe_customer_id TEXT,
    payment_method_id UUID REFERENCES stripe_payment_methods(id),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL DEFAULT 'requires_payment_method'
        CHECK (status IN (
            'requires_payment_method', 'requires_confirmation', 'requires_action',
            'processing', 'requires_capture', 'canceled', 'succeeded', 'failed'
        )),
    purpose TEXT NOT NULL
        CHECK (purpose IN (
            'contribution', 'insurance_premium', 'late_fee',
            'loan_repayment', 'wallet_deposit', 'membership_fee'
        )),

    -- Circle context (populated when purpose = 'contribution')
    circle_id UUID,
    cycle_id UUID,

    description TEXT,
    receipt_email TEXT,
    receipt_url TEXT,

    -- Failure info
    failure_code TEXT,
    failure_message TEXT,

    -- Cancellation
    canceled_at TIMESTAMPTZ,
    cancellation_reason TEXT,

    -- Idempotency
    idempotency_key TEXT,

    -- Platform fee (TandaXn's cut)
    application_fee_cents INTEGER DEFAULT 0,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_stripe_pi_stripe_id UNIQUE (stripe_payment_intent_id),
    CONSTRAINT uq_stripe_pi_idempotency UNIQUE (idempotency_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_pi_member_id
    ON stripe_payment_intents (member_id);
CREATE INDEX IF NOT EXISTS idx_stripe_pi_stripe_id
    ON stripe_payment_intents (stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_stripe_pi_status_active
    ON stripe_payment_intents (status)
    WHERE status NOT IN ('succeeded', 'canceled', 'failed');
CREATE INDEX IF NOT EXISTS idx_stripe_pi_circle_status
    ON stripe_payment_intents (circle_id, status);
CREATE INDEX IF NOT EXISTS idx_stripe_pi_purpose
    ON stripe_payment_intents (purpose);
CREATE INDEX IF NOT EXISTS idx_stripe_pi_idempotency
    ON stripe_payment_intents (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_stripe_pi_created_at
    ON stripe_payment_intents (created_at);

-- RLS
ALTER TABLE stripe_payment_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own payment intents"
    ON stripe_payment_intents FOR SELECT
    USING (auth.uid() = member_id);

CREATE POLICY "Service role has full access to stripe_payment_intents"
    ON stripe_payment_intents FOR ALL
    USING (auth.role() = 'service_role');

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_stripe_pi_updated_at ON stripe_payment_intents;
CREATE TRIGGER trigger_stripe_pi_updated_at
    BEFORE UPDATE ON stripe_payment_intents
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 5: stripe_transfers
-- Platform-to-member transfers via Stripe Connect.
-- Circle payouts, insurance claims, loan disbursements, refunds, withdrawals.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id),
    stripe_transfer_id TEXT NOT NULL,
    connected_account_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'paid', 'failed', 'canceled', 'reversed')),
    purpose TEXT NOT NULL
        CHECK (purpose IN (
            'circle_payout', 'insurance_claim', 'loan_disbursement', 'refund', 'withdrawal'
        )),

    -- Circle context
    circle_id UUID,
    cycle_id UUID,

    -- Source payment (optional link to the payment that funded this)
    source_payment_intent_id UUID REFERENCES stripe_payment_intents(id),

    description TEXT,

    -- Failure info
    failure_code TEXT,
    failure_message TEXT,

    -- Reversal info
    reversed_at TIMESTAMPTZ,
    reversal_reason TEXT,

    -- When funds land in the connected account
    arrival_date TIMESTAMPTZ,

    -- Idempotency
    idempotency_key TEXT,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_stripe_transfer_stripe_id UNIQUE (stripe_transfer_id),
    CONSTRAINT uq_stripe_transfer_idempotency UNIQUE (idempotency_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_transfers_member_id
    ON stripe_transfers (member_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transfers_stripe_id
    ON stripe_transfers (stripe_transfer_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transfers_pending
    ON stripe_transfers (status)
    WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_stripe_transfers_connected_account
    ON stripe_transfers (connected_account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_transfers_circle_purpose
    ON stripe_transfers (circle_id, purpose);
CREATE INDEX IF NOT EXISTS idx_stripe_transfers_arrival
    ON stripe_transfers (arrival_date);

-- RLS
ALTER TABLE stripe_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own transfers"
    ON stripe_transfers FOR SELECT
    USING (auth.uid() = member_id);

CREATE POLICY "Service role has full access to stripe_transfers"
    ON stripe_transfers FOR ALL
    USING (auth.role() = 'service_role');

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_stripe_transfers_updated_at ON stripe_transfers;
CREATE TRIGGER trigger_stripe_transfers_updated_at
    BEFORE UPDATE ON stripe_transfers
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 6: stripe_webhook_events
-- Idempotent webhook event log. Every Stripe webhook is recorded here.
-- Prevents duplicate processing via stripe_event_id uniqueness.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    api_version TEXT,
    livemode BOOLEAN DEFAULT false,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    related_member_id UUID REFERENCES profiles(id),
    related_payment_intent_id UUID REFERENCES stripe_payment_intents(id),
    related_transfer_id UUID REFERENCES stripe_transfers(id),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_stripe_webhook_event_id UNIQUE (stripe_event_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_event_id
    ON stripe_webhook_events (stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_event_type
    ON stripe_webhook_events (event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_unprocessed
    ON stripe_webhook_events (processed)
    WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_member
    ON stripe_webhook_events (related_member_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_created_at
    ON stripe_webhook_events (created_at);

-- RLS: Only service_role and platform admins
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to stripe_webhook_events"
    ON stripe_webhook_events FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY "Platform admins can view webhook events"
    ON stripe_webhook_events FOR SELECT
    USING (is_platform_admin());


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 7: stripe_disputes
-- Chargeback and dispute tracking. Critical for fraud prevention.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id),
    stripe_dispute_id TEXT NOT NULL,
    payment_intent_id UUID REFERENCES stripe_payment_intents(id),
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'usd',
    reason TEXT NOT NULL
        CHECK (reason IN (
            'bank_cannot_process', 'check_returned', 'credit_not_processed',
            'customer_initiated', 'debit_not_authorized', 'duplicate', 'fraudulent',
            'general', 'incorrect_account_details', 'insufficient_funds',
            'product_not_received', 'product_unacceptable', 'subscription_canceled',
            'unrecognized'
        )),
    status TEXT NOT NULL DEFAULT 'needs_response'
        CHECK (status IN (
            'warning_needs_response', 'warning_under_review', 'warning_closed',
            'needs_response', 'under_review', 'won', 'lost'
        )),
    evidence_due_by TIMESTAMPTZ,
    evidence_submitted BOOLEAN DEFAULT false,
    evidence_details JSONB DEFAULT '{}',
    admin_notes TEXT,
    is_charge_refundable BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_stripe_dispute_stripe_id UNIQUE (stripe_dispute_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_disputes_member_id
    ON stripe_disputes (member_id);
CREATE INDEX IF NOT EXISTS idx_stripe_disputes_stripe_id
    ON stripe_disputes (stripe_dispute_id);
CREATE INDEX IF NOT EXISTS idx_stripe_disputes_needs_response
    ON stripe_disputes (status)
    WHERE status IN ('needs_response', 'warning_needs_response');
CREATE INDEX IF NOT EXISTS idx_stripe_disputes_evidence_due
    ON stripe_disputes (evidence_due_by)
    WHERE status NOT IN ('won', 'lost', 'warning_closed');

-- RLS
ALTER TABLE stripe_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own disputes"
    ON stripe_disputes FOR SELECT
    USING (auth.uid() = member_id);

CREATE POLICY "Platform admins can view all disputes"
    ON stripe_disputes FOR SELECT
    USING (is_platform_admin());

CREATE POLICY "Service role has full access to stripe_disputes"
    ON stripe_disputes FOR ALL
    USING (auth.role() = 'service_role');

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_stripe_disputes_updated_at ON stripe_disputes;
CREATE TRIGGER trigger_stripe_disputes_updated_at
    BEFORE UPDATE ON stripe_disputes
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 8: stripe_refunds
-- Refund tracking for all payment intents.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES profiles(id),
    stripe_refund_id TEXT NOT NULL,
    payment_intent_id UUID REFERENCES stripe_payment_intents(id),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'usd',
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')),
    reason TEXT
        CHECK (reason IN (
            'duplicate', 'fraudulent', 'requested_by_customer', 'expired_uncaptured_charge',
            'circle_dissolution', 'member_removal', 'overpayment', 'admin_initiated'
        )),
    failure_reason TEXT,
    description TEXT,
    initiated_by UUID REFERENCES profiles(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_stripe_refund_stripe_id UNIQUE (stripe_refund_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_refunds_member_id
    ON stripe_refunds (member_id);
CREATE INDEX IF NOT EXISTS idx_stripe_refunds_stripe_id
    ON stripe_refunds (stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_stripe_refunds_payment_intent
    ON stripe_refunds (payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_stripe_refunds_pending
    ON stripe_refunds (status)
    WHERE status = 'pending';

-- RLS
ALTER TABLE stripe_refunds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own refunds"
    ON stripe_refunds FOR SELECT
    USING (auth.uid() = member_id);

CREATE POLICY "Service role has full access to stripe_refunds"
    ON stripe_refunds FOR ALL
    USING (auth.role() = 'service_role');

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_stripe_refunds_updated_at ON stripe_refunds;
CREATE TRIGGER trigger_stripe_refunds_updated_at
    BEFORE UPDATE ON stripe_refunds
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 9: stripe_payout_schedules
-- Controls when Stripe pays out to connected accounts.
-- Default is manual (TandaXn triggers payouts explicitly).
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stripe_payout_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connected_account_id TEXT NOT NULL,
    member_id UUID NOT NULL REFERENCES profiles(id),
    schedule_type TEXT NOT NULL DEFAULT 'manual'
        CHECK (schedule_type IN ('manual', 'daily', 'weekly', 'monthly')),
    day_of_week TEXT
        CHECK (day_of_week IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')),
    day_of_month INTEGER
        CHECK (day_of_month BETWEEN 1 AND 31),
    delay_days INTEGER DEFAULT 2,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_payout_sched_account
    ON stripe_payout_schedules (connected_account_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payout_sched_member
    ON stripe_payout_schedules (member_id);

-- RLS
ALTER TABLE stripe_payout_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their own payout schedule"
    ON stripe_payout_schedules FOR SELECT
    USING (auth.uid() = member_id);

CREATE POLICY "Service role has full access to stripe_payout_schedules"
    ON stripe_payout_schedules FOR ALL
    USING (auth.role() = 'service_role');

-- updated_at trigger
DROP TRIGGER IF EXISTS trigger_stripe_payout_sched_updated_at ON stripe_payout_schedules;
CREATE TRIGGER trigger_stripe_payout_sched_updated_at
    BEFORE UPDATE ON stripe_payout_schedules
    FOR EACH ROW EXECUTE FUNCTION update_stripe_updated_at();


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER FUNCTION: sync_contribution_on_payment_success
-- Called when a payment_intent status transitions to 'succeeded'.
-- 1. If circle_id is set → mark the corresponding contribution as 'paid'
-- 2. If purpose = 'wallet_deposit' → credit the member's wallet
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_contribution_on_payment_success()
RETURNS TRIGGER AS $$
DECLARE
    v_amount_dollars NUMERIC;
BEGIN
    -- Only fire when status changes to 'succeeded'
    IF NEW.status != 'succeeded' OR OLD.status = 'succeeded' THEN
        RETURN NEW;
    END IF;

    -- Convert cents to dollars for legacy tables that use DECIMAL
    v_amount_dollars := NEW.amount_cents / 100.0;

    -- 1. Mark contribution as paid if this is a circle contribution
    IF NEW.circle_id IS NOT NULL AND NEW.purpose = 'contribution' THEN
        UPDATE contributions
        SET status = 'paid',
            payment_method = 'stripe',
            transaction_id = NEW.stripe_payment_intent_id
        WHERE id = (
            SELECT id FROM contributions
            WHERE circle_id = NEW.circle_id
              AND user_id = NEW.member_id
              AND status IN ('pending', 'due', 'late')
            ORDER BY created_at ASC
            LIMIT 1
        );
    END IF;

    -- 2. Credit wallet if this is a wallet deposit
    IF NEW.purpose = 'wallet_deposit' THEN
        UPDATE wallets
        SET balance = balance + v_amount_dollars,
            updated_at = NOW()
        WHERE user_id = NEW.member_id;

        -- Create wallet if it doesn't exist
        IF NOT FOUND THEN
            INSERT INTO wallets (user_id, balance, currency, created_at, updated_at)
            VALUES (NEW.member_id, v_amount_dollars, UPPER(NEW.currency), NOW(), NOW());
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fire on payment intent status change
DROP TRIGGER IF EXISTS trigger_sync_on_payment_success ON stripe_payment_intents;
CREATE TRIGGER trigger_sync_on_payment_success
    AFTER UPDATE OF status ON stripe_payment_intents
    FOR EACH ROW
    WHEN (NEW.status = 'succeeded' AND OLD.status IS DISTINCT FROM 'succeeded')
    EXECUTE FUNCTION sync_contribution_on_payment_success();


-- ═══════════════════════════════════════════════════════════════════════════════
-- REALTIME: Enable realtime subscriptions for key tables
-- Members see payment and transfer status updates in real time.
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE stripe_payment_intents;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE stripe_transfers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE stripe_connected_accounts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE stripe_disputes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- COMMENTS: Document table purposes for pg_catalog
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE stripe_customers IS 'Maps TandaXn members to Stripe customer objects for payment method storage and charge tracking';
COMMENT ON TABLE stripe_connected_accounts IS 'Stripe Express connected accounts enabling members to receive circle payouts';
COMMENT ON TABLE stripe_payment_methods IS 'Saved payment methods (cards, bank accounts, digital wallets) per member';
COMMENT ON TABLE stripe_payment_intents IS 'All inbound payments: contributions, fees, wallet deposits. Mirrors Stripe payment_intent lifecycle';
COMMENT ON TABLE stripe_transfers IS 'Platform-to-member transfers via Stripe Connect: circle payouts, refunds, withdrawals';
COMMENT ON TABLE stripe_webhook_events IS 'Idempotent Stripe webhook event log. Prevents duplicate processing';
COMMENT ON TABLE stripe_disputes IS 'Chargeback and dispute tracking for fraud prevention and resolution';
COMMENT ON TABLE stripe_refunds IS 'Refund tracking linked to original payment intents';
COMMENT ON TABLE stripe_payout_schedules IS 'Controls payout cadence for connected accounts. Default is manual (platform-triggered)';

COMMENT ON FUNCTION sync_contribution_on_payment_success IS 'SECURITY DEFINER: Syncs contribution status and wallet balance when a payment succeeds';
COMMENT ON FUNCTION is_platform_admin IS 'SECURITY DEFINER: Checks JWT app_metadata for platform admin/elder role';
