-- ============================================================================
-- TANDAXN COMPLETE PRODUCTION DATABASE SCHEMA
-- Version: 1.0
-- Total Tables: 42
--
-- Run this in Supabase SQL Editor to create all tables
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SECTION 1: USER MANAGEMENT (4 tables)
-- ============================================================================

-- 1. User Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    phone TEXT,
    full_name TEXT,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    country TEXT DEFAULT 'US',
    language TEXT DEFAULT 'en',
    timezone TEXT DEFAULT 'UTC',
    kyc_status TEXT DEFAULT 'none' CHECK (kyc_status IN ('none', 'pending', 'verified', 'rejected')),
    kyc_level INTEGER DEFAULT 0,
    profile_completed BOOLEAN DEFAULT FALSE,
    profile_completed_at TIMESTAMPTZ,
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. User Sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT,
    device_name TEXT,
    device_type TEXT,
    os_version TEXT,
    app_version TEXT,
    push_token TEXT,
    ip_address TEXT,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User Verification Records
CREATE TABLE IF NOT EXISTS public.user_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('email', 'phone', 'kyc', 'bank', 'address')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
    verification_data JSONB,
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    primary_currency TEXT DEFAULT 'USD',
    secondary_currencies JSONB DEFAULT '[]',
    notification_contributions BOOLEAN DEFAULT TRUE,
    notification_payouts BOOLEAN DEFAULT TRUE,
    notification_reminders BOOLEAN DEFAULT TRUE,
    notification_marketing BOOLEAN DEFAULT FALSE,
    biometric_enabled BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    privacy_show_score BOOLEAN DEFAULT TRUE,
    privacy_show_circles BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 2: CIRCLES / TANDA SYSTEM (6 tables)
-- ============================================================================

-- 5. Circles (Main table)
CREATE TABLE IF NOT EXISTS public.circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'traditional' CHECK (type IN ('traditional', 'goal-based', 'emergency', 'family-support', 'beneficiary')),
    description TEXT,
    emoji TEXT DEFAULT '💰',
    amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
    currency TEXT DEFAULT 'USD',
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'one-time')),
    member_count INTEGER NOT NULL DEFAULT 12 CHECK (member_count >= 2),
    current_members INTEGER NOT NULL DEFAULT 1,
    start_date DATE,
    end_date DATE,
    rotation_method TEXT DEFAULT 'xnscore' CHECK (rotation_method IN ('xnscore', 'random', 'manual', 'auction')),
    grace_period_days INTEGER DEFAULT 2,
    late_fee_percent DECIMAL(5,2) DEFAULT 5.00,
    status TEXT DEFAULT 'pending' CHECK (status IN ('forming', 'pending', 'active', 'paused', 'completed', 'cancelled')),
    current_cycle INTEGER DEFAULT 0,
    total_cycles INTEGER,
    location TEXT,
    verified BOOLEAN DEFAULT FALSE,
    min_score INTEGER DEFAULT 0 CHECK (min_score >= 0 AND min_score <= 100),
    max_score INTEGER DEFAULT 100,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    invite_code TEXT UNIQUE NOT NULL,
    invite_link TEXT,
    community_id UUID,
    -- Beneficiary specific
    beneficiary_name TEXT,
    beneficiary_reason TEXT,
    beneficiary_phone TEXT,
    beneficiary_country TEXT,
    is_one_time BOOLEAN DEFAULT FALSE,
    is_recurring BOOLEAN DEFAULT FALSE,
    payout_per_cycle DECIMAL(12,2),
    cycles_completed INTEGER DEFAULT 0,
    total_payout_to_date DECIMAL(12,2) DEFAULT 0,
    -- Metadata
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Circle Members
CREATE TABLE IF NOT EXISTS public.circle_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    position INTEGER,
    role TEXT DEFAULT 'member' CHECK (role IN ('creator', 'admin', 'treasurer', 'member')),
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'paused', 'exited', 'removed')),
    guarantee_status TEXT DEFAULT 'unguaranteed' CHECK (guarantee_status IN ('guaranteed', 'unguaranteed', 'vouched')),
    vouched_by UUID REFERENCES auth.users(id),
    contributions_made INTEGER DEFAULT 0,
    contributions_on_time INTEGER DEFAULT 0,
    contributions_late INTEGER DEFAULT 0,
    contributions_missed INTEGER DEFAULT 0,
    payouts_received INTEGER DEFAULT 0,
    total_contributed DECIMAL(12,2) DEFAULT 0,
    total_received DECIMAL(12,2) DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    exited_at TIMESTAMPTZ,
    exit_reason TEXT,
    UNIQUE(circle_id, user_id)
);

-- 7. Circle Contributions
CREATE TABLE IF NOT EXISTS public.circle_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    member_id UUID REFERENCES public.circle_members(id) ON DELETE SET NULL,
    cycle_number INTEGER NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    due_date DATE NOT NULL,
    paid_date TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'late', 'missed', 'waived')),
    is_on_time BOOLEAN,
    is_early BOOLEAN DEFAULT FALSE,
    days_late INTEGER DEFAULT 0,
    late_fee DECIMAL(12,2) DEFAULT 0,
    payment_method TEXT,
    transaction_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Circle Payouts
CREATE TABLE IF NOT EXISTS public.circle_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    cycle_number INTEGER NOT NULL,
    position INTEGER,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    expected_date DATE,
    actual_date TIMESTAMPTZ,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'processing', 'completed', 'failed', 'cancelled')),
    payment_method TEXT,
    transaction_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Circle Invitations
CREATE TABLE IF NOT EXISTS public.circle_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    invited_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
    message TEXT,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

-- 10. Circle Activity Log
CREATE TABLE IF NOT EXISTS public.circle_activity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 3: WALLET & TRANSACTIONS (6 tables)
-- ============================================================================

-- 11. Wallets
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    total_balance_usd DECIMAL(12,2) DEFAULT 0,
    primary_currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'frozen', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Wallet Balances (Multi-currency)
CREATE TABLE IF NOT EXISTS public.wallet_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    currency_code TEXT NOT NULL,
    currency_name TEXT,
    currency_symbol TEXT,
    flag TEXT,
    balance DECIMAL(12,2) DEFAULT 0,
    usd_value DECIMAL(12,2) DEFAULT 0,
    exchange_rate DECIMAL(12,6),
    rate_change DECIMAL(5,2),
    is_active BOOLEAN DEFAULT TRUE,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_id, currency_code)
);

-- 13. Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'transfer', 'contribution', 'payout', 'conversion', 'remittance', 'fee', 'refund', 'interest', 'bonus')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'reversed')),
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    amount_usd DECIMAL(12,2),
    fee DECIMAL(12,2) DEFAULT 0,
    net_amount DECIMAL(12,2),
    description TEXT,
    reference_type TEXT,
    reference_id UUID,
    -- For transfers/remittances
    recipient_id UUID REFERENCES auth.users(id),
    recipient_name TEXT,
    recipient_details JSONB,
    -- For conversions
    from_currency TEXT,
    from_amount DECIMAL(12,2),
    to_currency TEXT,
    to_amount DECIMAL(12,2),
    exchange_rate DECIMAL(12,6),
    -- For circle transactions
    circle_id UUID REFERENCES public.circles(id) ON DELETE SET NULL,
    circle_name TEXT,
    -- Payment details
    payment_method TEXT,
    payment_provider TEXT,
    external_id TEXT,
    -- Metadata
    metadata JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 14. Payment Methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('bank_account', 'debit_card', 'credit_card', 'mobile_money', 'crypto_wallet')),
    provider TEXT,
    label TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    -- Masked details (never store full card numbers)
    last_four TEXT,
    bank_name TEXT,
    account_type TEXT,
    -- Encrypted reference to payment provider
    provider_token TEXT,
    provider_customer_id TEXT,
    -- For mobile money
    phone_number TEXT,
    network TEXT,
    -- Metadata
    billing_address JSONB,
    expires_at DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'disabled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Exchange Rates
CREATE TABLE IF NOT EXISTS public.exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate DECIMAL(12,6) NOT NULL,
    provider TEXT,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_currency, to_currency)
);

-- 16. Remittances
CREATE TABLE IF NOT EXISTS public.remittances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT,
    recipient_email TEXT,
    recipient_country TEXT NOT NULL,
    recipient_bank_details JSONB,
    recipient_mobile_money JSONB,
    from_currency TEXT NOT NULL,
    from_amount DECIMAL(12,2) NOT NULL,
    to_currency TEXT NOT NULL,
    to_amount DECIMAL(12,2) NOT NULL,
    exchange_rate DECIMAL(12,6) NOT NULL,
    fee DECIMAL(12,2) DEFAULT 0,
    total_cost DECIMAL(12,2),
    delivery_method TEXT CHECK (delivery_method IN ('bank_transfer', 'mobile_money', 'cash_pickup', 'home_delivery')),
    status TEXT DEFAULT 'initiated' CHECK (status IN ('initiated', 'processing', 'in_transit', 'delivered', 'failed', 'refunded')),
    provider TEXT,
    provider_reference TEXT,
    estimated_delivery TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 4: XNSCORE CREDIT SYSTEM (4 tables)
-- ============================================================================

-- 17. XnScores
CREATE TABLE IF NOT EXISTS public.xn_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    current_score INTEGER DEFAULT 75 CHECK (current_score >= 0 AND current_score <= 100),
    previous_score INTEGER,
    level TEXT DEFAULT 'Good',
    level_color TEXT DEFAULT '#22C55E',
    -- Score factors (weighted components)
    payment_history_score DECIMAL(5,2) DEFAULT 0,
    circle_completion_score DECIMAL(5,2) DEFAULT 0,
    account_age_score DECIMAL(5,2) DEFAULT 0,
    security_deposit_score DECIMAL(5,2) DEFAULT 0,
    circle_diversity_score DECIMAL(5,2) DEFAULT 0,
    profile_completion_score DECIMAL(5,2) DEFAULT 0,
    -- Stats
    contribution_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    total_contributions INTEGER DEFAULT 0,
    on_time_contributions INTEGER DEFAULT 0,
    late_contributions INTEGER DEFAULT 0,
    missed_contributions INTEGER DEFAULT 0,
    circles_joined INTEGER DEFAULT 0,
    circles_completed INTEGER DEFAULT 0,
    -- Timestamps
    first_contribution_at TIMESTAMPTZ,
    last_contribution_at TIMESTAMPTZ,
    last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Score Events
CREATE TABLE IF NOT EXISTS public.score_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'contribution_made', 'contribution_on_time', 'contribution_early', 'contribution_late',
        'payout_received', 'circle_joined', 'circle_completed', 'circle_left',
        'referral_bonus', 'streak_bonus', 'funds_added', 'withdrawal',
        'send_money', 'account_verified', 'profile_completed', 'initial_score',
        'loan_repaid_on_time', 'loan_repaid_late', 'loan_defaulted',
        'vouch_successful', 'vouch_defaulted', 'security_deposit'
    )),
    points DECIMAL(5,2) NOT NULL,
    score_before INTEGER,
    score_after INTEGER,
    description TEXT,
    reference_type TEXT,
    reference_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Score History (Daily snapshots)
CREATE TABLE IF NOT EXISTS public.score_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    level TEXT,
    snapshot_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, snapshot_date)
);

-- 20. Score Benefits
CREATE TABLE IF NOT EXISTS public.score_benefits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level TEXT NOT NULL UNIQUE,
    min_score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    color TEXT,
    slot_access TEXT,
    late_bonus_percent DECIMAL(5,2),
    early_fee_percent DECIMAL(5,2),
    max_loan_amount DECIMAL(12,2),
    loan_apr DECIMAL(5,2),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 5: TRUST & VOUCHING SYSTEM (5 tables)
-- ============================================================================

-- 21. Trust Profiles
CREATE TABLE IF NOT EXISTS public.trust_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    trust_tier TEXT DEFAULT 'standard' CHECK (trust_tier IN ('restricted', 'building', 'standard', 'trusted', 'preferred', 'elder')),
    guarantee_status TEXT DEFAULT 'unguaranteed' CHECK (guarantee_status IN ('guaranteed', 'unguaranteed', 'vouched')),
    -- Security deposit
    has_security_deposit BOOLEAN DEFAULT FALSE,
    security_deposit_amount DECIMAL(12,2) DEFAULT 0,
    deposit_currency TEXT DEFAULT 'USD',
    deposit_locked_at TIMESTAMPTZ,
    deposit_locked_until TIMESTAMPTZ,
    deposit_lock_days INTEGER DEFAULT 90,
    -- Vouching stats
    can_vouch BOOLEAN DEFAULT FALSE,
    max_active_vouches INTEGER DEFAULT 0,
    active_vouches_count INTEGER DEFAULT 0,
    total_vouches_given INTEGER DEFAULT 0,
    successful_vouches INTEGER DEFAULT 0,
    defaulted_vouches INTEGER DEFAULT 0,
    vouch_success_rate DECIMAL(5,2) DEFAULT 0,
    -- Circle access
    allowed_circle_types JSONB DEFAULT '["contacts_only"]',
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. Vouch Records
CREATE TABLE IF NOT EXISTS public.vouch_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    elder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    elder_name TEXT,
    vouched_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    vouched_user_name TEXT,
    circle_id UUID REFERENCES public.circles(id) ON DELETE SET NULL,
    circle_name TEXT,
    vouch_points INTEGER DEFAULT 5,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'expired', 'revoked')),
    reason TEXT,
    expires_at TIMESTAMPTZ,
    outcome_date TIMESTAMPTZ,
    outcome_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Honor Badges
CREATE TABLE IF NOT EXISTS public.honor_badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_type TEXT NOT NULL,
    badge_name TEXT NOT NULL,
    badge_description TEXT,
    badge_icon TEXT,
    tier TEXT CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
    earned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. Security Deposits
CREATE TABLE IF NOT EXISTS public.security_deposits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'released', 'forfeited')),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    lock_duration_days INTEGER DEFAULT 90,
    unlocks_at TIMESTAMPTZ,
    released_at TIMESTAMPTZ,
    release_reason TEXT,
    transaction_id UUID REFERENCES public.transactions(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 25. Trust Tier History
CREATE TABLE IF NOT EXISTS public.trust_tier_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    previous_tier TEXT,
    new_tier TEXT NOT NULL,
    reason TEXT,
    changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 6: ADVANCES / LOANS (4 tables)
-- ============================================================================

-- 26. Loan Products
CREATE TABLE IF NOT EXISTS public.loan_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('payout_advance', 'emergency', 'education', 'medical', 'business', 'vehicle', 'home_improvement', 'mortgage', 'agriculture', 'other')),
    loan_type TEXT NOT NULL CHECK (loan_type IN ('small', 'medium', 'mortgage')),
    min_amount DECIMAL(12,2) NOT NULL,
    max_amount DECIMAL(12,2) NOT NULL,
    min_term_months INTEGER,
    max_term_months INTEGER,
    base_fee_rate DECIMAL(5,2) NOT NULL,
    min_xn_score INTEGER NOT NULL,
    description TEXT,
    features JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 27. Loan Applications
CREATE TABLE IF NOT EXISTS public.loan_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.loan_products(id),
    loan_type TEXT NOT NULL CHECK (loan_type IN ('small', 'medium', 'mortgage')),
    category TEXT,
    purpose TEXT,
    purpose_details TEXT,
    -- Amounts
    requested_amount DECIMAL(12,2) NOT NULL,
    approved_amount DECIMAL(12,2),
    currency TEXT DEFAULT 'USD',
    fee_rate DECIMAL(5,2),
    fee_amount DECIMAL(12,2),
    total_to_repay DECIMAL(12,2),
    term_months INTEGER,
    -- Source (for payout advances)
    source_payout_id UUID REFERENCES public.circle_payouts(id),
    source_circle_id UUID REFERENCES public.circles(id),
    -- Repayment
    repayment_method TEXT CHECK (repayment_method IN ('payout_withholding', 'wallet_balance', 'hybrid', 'manual')),
    disbursement_method TEXT CHECK (disbursement_method IN ('wallet', 'bank_transfer', 'mobile_money')),
    disbursement_details JSONB,
    -- User snapshot at application
    xn_score_at_request INTEGER,
    tier_at_request TEXT,
    smc_at_request DECIMAL(12,2),
    dcr_at_request DECIMAL(5,2),
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'disbursed', 'active', 'completed', 'cancelled', 'rejected', 'defaulted', 'in_recovery')),
    -- Repayment tracking
    amount_paid DECIMAL(12,2) DEFAULT 0,
    amount_remaining DECIMAL(12,2),
    payments_made INTEGER DEFAULT 0,
    payments_remaining INTEGER,
    next_payment_date DATE,
    next_payment_amount DECIMAL(12,2),
    -- Flags
    automatic_approval BOOLEAN DEFAULT FALSE,
    risk_score DECIMAL(5,2),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    disbursed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT
);

-- 28. Loan Repayments
CREATE TABLE IF NOT EXISTS public.loan_repayments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id UUID NOT NULL REFERENCES public.loan_applications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payment_number INTEGER NOT NULL,
    due_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    principal DECIMAL(12,2),
    fee DECIMAL(12,2),
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'pending', 'paid', 'partial', 'missed', 'waived')),
    paid_amount DECIMAL(12,2) DEFAULT 0,
    paid_date TIMESTAMPTZ,
    source TEXT CHECK (source IN ('payout_withholding', 'wallet', 'manual', 'auto_debit')),
    source_reference TEXT,
    transaction_id UUID REFERENCES public.transactions(id),
    late_fee DECIMAL(12,2) DEFAULT 0,
    days_late INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 29. Future Payouts (for advance eligibility)
CREATE TABLE IF NOT EXISTS public.future_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    circle_name TEXT,
    expected_date DATE NOT NULL,
    expected_amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    member_position INTEGER,
    cycle_number INTEGER,
    is_advanceable BOOLEAN DEFAULT TRUE,
    existing_loan_id UUID REFERENCES public.loan_applications(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SECTION 7: SAVINGS GOALS (3 tables)
-- ============================================================================

-- 30. Savings Goals
CREATE TABLE IF NOT EXISTS public.savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '🎯',
    type TEXT NOT NULL CHECK (type IN ('flexible', 'emergency', 'locked')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'matured', 'closed')),
    currency TEXT DEFAULT 'USD',
    current_balance DECIMAL(12,2) DEFAULT 0,
    target_amount DECIMAL(12,2),
    -- Interest
    interest_rate DECIMAL(5,4) DEFAULT 0.02,
    interest_earned DECIMAL(12,2) DEFAULT 0,
    interest_unlocked DECIMAL(12,2) DEFAULT 0,
    last_interest_date DATE,
    -- Lock settings
    lock_duration_months INTEGER,
    maturity_date DATE,
    early_withdrawal_penalty DECIMAL(5,2) DEFAULT 0,
    -- Auto-save
    auto_save_enabled BOOLEAN DEFAULT FALSE,
    auto_save_percent DECIMAL(5,2) DEFAULT 10,
    auto_save_source TEXT CHECK (auto_save_source IN ('payout', 'deposit', 'both')),
    auto_save_priority INTEGER DEFAULT 1,
    auto_replenish BOOLEAN DEFAULT FALSE,
    auto_replenish_target DECIMAL(12,2),
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ
);

-- 31. Goal Transactions
CREATE TABLE IF NOT EXISTS public.goal_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'auto_deposit', 'withdrawal', 'interest_credit', 'transfer_in', 'transfer_out', 'bonus', 'penalty')),
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2),
    description TEXT,
    source_goal_id UUID REFERENCES public.savings_goals(id),
    destination_goal_id UUID REFERENCES public.savings_goals(id),
    transaction_id UUID REFERENCES public.transactions(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 32. Goal Milestones
CREATE TABLE IF NOT EXISTS public.goal_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
    milestone_percent INTEGER NOT NULL CHECK (milestone_percent IN (25, 50, 75, 100)),
    reached_at TIMESTAMPTZ,
    celebrated BOOLEAN DEFAULT FALSE,
    UNIQUE(goal_id, milestone_percent)
);

-- ============================================================================
-- SECTION 8: COMMUNITIES (3 tables)
-- ============================================================================

-- 33. Communities
CREATE TABLE IF NOT EXISTS public.communities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('diaspora', 'religious', 'professional', 'neighborhood', 'school', 'interest', 'family', 'other')),
    description TEXT,
    icon TEXT,
    cover_image TEXT,
    privacy TEXT DEFAULT 'public' CHECK (privacy IN ('public', 'private', 'invite_only')),
    verified BOOLEAN DEFAULT FALSE,
    -- Stats
    member_count INTEGER DEFAULT 0,
    circle_count INTEGER DEFAULT 0,
    total_saved DECIMAL(12,2) DEFAULT 0,
    active_circles INTEGER DEFAULT 0,
    completed_circles INTEGER DEFAULT 0,
    avg_xn_score DECIMAL(5,2) DEFAULT 0,
    -- Hierarchy
    parent_id UUID REFERENCES public.communities(id),
    -- Settings
    min_score_to_join INTEGER DEFAULT 0,
    requires_approval BOOLEAN DEFAULT FALSE,
    -- Metadata
    location TEXT,
    country TEXT,
    language TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 34. Community Members
CREATE TABLE IF NOT EXISTS public.community_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'elder', 'admin', 'founder')),
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended', 'left')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    UNIQUE(community_id, user_id)
);

-- 35. Community Circles (linking circles to communities)
CREATE TABLE IF NOT EXISTS public.community_circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
    circle_id UUID NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
    featured BOOLEAN DEFAULT FALSE,
    added_by UUID REFERENCES auth.users(id),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(community_id, circle_id)
);

-- ============================================================================
-- SECTION 9: ELDER SYSTEM (5 tables)
-- ============================================================================

-- 36. Elder Profiles
CREATE TABLE IF NOT EXISTS public.elder_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    status TEXT DEFAULT 'not_applied' CHECK (status IN ('not_applied', 'pending', 'approved', 'rejected', 'suspended')),
    tier TEXT DEFAULT 'Junior' CHECK (tier IN ('Junior', 'Senior', 'Grand')),
    honor_score INTEGER DEFAULT 0,
    honor_tier TEXT DEFAULT 'Bronze' CHECK (honor_tier IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
    -- Specializations
    specializations JSONB DEFAULT '[]',
    -- Stats
    vouch_strength INTEGER DEFAULT 5,
    max_concurrent_cases INTEGER DEFAULT 2,
    active_cases INTEGER DEFAULT 0,
    total_cases_assigned INTEGER DEFAULT 0,
    total_cases_resolved INTEGER DEFAULT 0,
    cases_resolved_this_month INTEGER DEFAULT 0,
    avg_resolution_time_hours DECIMAL(8,2),
    satisfaction_rate DECIMAL(5,2) DEFAULT 0,
    -- Training
    training_credits INTEGER DEFAULT 0,
    required_credits INTEGER DEFAULT 10,
    -- Timestamps
    applied_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES auth.users(id),
    last_active_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 37. Elder Stats (detailed monthly tracking)
CREATE TABLE IF NOT EXISTS public.elder_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    vouches_given INTEGER DEFAULT 0,
    vouches_successful INTEGER DEFAULT 0,
    vouches_defaulted INTEGER DEFAULT 0,
    cases_assigned INTEGER DEFAULT 0,
    cases_resolved INTEGER DEFAULT 0,
    cases_escalated INTEGER DEFAULT 0,
    avg_resolution_hours DECIMAL(8,2),
    satisfaction_score DECIMAL(5,2),
    honor_points_earned INTEGER DEFAULT 0,
    honor_points_lost INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, month)
);

-- 38. Mediation Cases
CREATE TABLE IF NOT EXISTS public.mediation_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number TEXT UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('payment', 'trust', 'financial', 'communication', 'dispute', 'fraud', 'other')),
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title TEXT NOT NULL,
    description TEXT,
    -- Related entities
    circle_id UUID REFERENCES public.circles(id) ON DELETE SET NULL,
    circle_name TEXT,
    -- Parties
    complainant_id UUID REFERENCES auth.users(id),
    respondent_id UUID REFERENCES auth.users(id),
    parties JSONB,
    -- Assignment
    assigned_elder_id UUID REFERENCES public.elder_profiles(id),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'pending_response', 'resolved', 'escalated', 'closed', 'cancelled')),
    -- Timeline
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_at TIMESTAMPTZ,
    due_date DATE,
    resolved_at TIMESTAMPTZ,
    -- Resolution
    resolution_type TEXT CHECK (resolution_type IN ('mediated', 'arbitrated', 'withdrawn', 'escalated', 'timeout')),
    resolution_summary TEXT,
    resolution_details JSONB,
    -- Rewards
    reward_honor_score INTEGER DEFAULT 5,
    reward_fee DECIMAL(12,2) DEFAULT 0,
    -- Evidence
    evidence JSONB DEFAULT '[]',
    -- Feedback
    complainant_satisfaction INTEGER CHECK (complainant_satisfaction >= 1 AND complainant_satisfaction <= 5),
    respondent_satisfaction INTEGER CHECK (respondent_satisfaction >= 1 AND respondent_satisfaction <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 39. Training Courses
CREATE TABLE IF NOT EXISTS public.training_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT CHECK (category IN ('required', 'elective', 'advanced')),
    content_type TEXT CHECK (content_type IN ('video', 'article', 'quiz', 'interactive')),
    duration_minutes INTEGER,
    credits INTEGER DEFAULT 1,
    min_tier TEXT,
    content_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 40. Training Enrollments
CREATE TABLE IF NOT EXISTS public.training_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status TEXT DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed', 'failed')),
    score INTEGER,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, course_id)
);

-- ============================================================================
-- SECTION 10: AUDIT & SYSTEM (2 tables)
-- ============================================================================

-- 41. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 42. Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB,
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    action_url TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- User indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_referral ON public.profiles(referral_code);

-- Circle indexes
CREATE INDEX IF NOT EXISTS idx_circles_invite_code ON public.circles(invite_code);
CREATE INDEX IF NOT EXISTS idx_circles_status ON public.circles(status);
CREATE INDEX IF NOT EXISTS idx_circles_created_by ON public.circles(created_by);
CREATE INDEX IF NOT EXISTS idx_circles_community ON public.circles(community_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON public.circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user ON public.circle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_contributions_circle ON public.circle_contributions(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_contributions_user ON public.circle_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_contributions_status ON public.circle_contributions(status);

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_balances_user ON public.wallet_balances(user_id);

-- Score indexes
CREATE INDEX IF NOT EXISTS idx_xn_scores_user ON public.xn_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_score_events_user ON public.score_events(user_id);
CREATE INDEX IF NOT EXISTS idx_score_events_created ON public.score_events(created_at);

-- Trust indexes
CREATE INDEX IF NOT EXISTS idx_vouch_records_elder ON public.vouch_records(elder_id);
CREATE INDEX IF NOT EXISTS idx_vouch_records_vouched ON public.vouch_records(vouched_user_id);
CREATE INDEX IF NOT EXISTS idx_vouch_records_status ON public.vouch_records(status);

-- Loan indexes
CREATE INDEX IF NOT EXISTS idx_loan_applications_user ON public.loan_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_applications_status ON public.loan_applications(status);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_loan ON public.loan_repayments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_repayments_due ON public.loan_repayments(due_date);

-- Community indexes
CREATE INDEX IF NOT EXISTS idx_community_members_community ON public.community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON public.community_members(user_id);

-- Elder indexes
CREATE INDEX IF NOT EXISTS idx_mediation_cases_status ON public.mediation_cases(status);
CREATE INDEX IF NOT EXISTS idx_mediation_cases_elder ON public.mediation_cases(assigned_elder_id);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xn_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_benefits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.honor_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_tier_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.future_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elder_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elder_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mediation_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- PROFILES
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can view other profiles in same circles" ON public.profiles FOR SELECT USING (
    id IN (SELECT cm2.user_id FROM public.circle_members cm1
           JOIN public.circle_members cm2 ON cm1.circle_id = cm2.circle_id
           WHERE cm1.user_id = auth.uid())
);

-- USER SESSIONS
CREATE POLICY "Users can manage own sessions" ON public.user_sessions FOR ALL USING (auth.uid() = user_id);

-- USER VERIFICATIONS
CREATE POLICY "Users can view own verifications" ON public.user_verifications FOR SELECT USING (auth.uid() = user_id);

-- USER PREFERENCES
CREATE POLICY "Users can manage own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

-- CIRCLES
CREATE POLICY "Anyone can view circles" ON public.circles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create circles" ON public.circles FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Creators can update circles" ON public.circles FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete pending circles" ON public.circles FOR DELETE USING (auth.uid() = created_by AND status = 'pending');

-- CIRCLE MEMBERS
CREATE POLICY "Anyone can view circle members" ON public.circle_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join circles" ON public.circle_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave circles" ON public.circle_members FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update members" ON public.circle_members FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.circle_members cm WHERE cm.circle_id = circle_members.circle_id
            AND cm.user_id = auth.uid() AND cm.role IN ('creator', 'admin'))
);

-- CIRCLE CONTRIBUTIONS
CREATE POLICY "Members can view contributions" ON public.circle_contributions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_contributions.circle_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create own contributions" ON public.circle_contributions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CIRCLE PAYOUTS
CREATE POLICY "Members can view payouts" ON public.circle_payouts FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_payouts.circle_id AND user_id = auth.uid())
);

-- CIRCLE INVITATIONS
CREATE POLICY "Anyone can view invitations" ON public.circle_invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create invitations" ON public.circle_invitations FOR INSERT TO authenticated WITH CHECK (auth.uid() = invited_by);

-- CIRCLE ACTIVITY
CREATE POLICY "Members can view activity" ON public.circle_activity FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.circle_members WHERE circle_id = circle_activity.circle_id AND user_id = auth.uid())
);

-- WALLETS
CREATE POLICY "Users can manage own wallet" ON public.wallets FOR ALL USING (auth.uid() = user_id);

-- WALLET BALANCES
CREATE POLICY "Users can manage own balances" ON public.wallet_balances FOR ALL USING (auth.uid() = user_id);

-- TRANSACTIONS
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own transactions" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- PAYMENT METHODS
CREATE POLICY "Users can manage own payment methods" ON public.payment_methods FOR ALL USING (auth.uid() = user_id);

-- EXCHANGE RATES (public read)
CREATE POLICY "Anyone can view exchange rates" ON public.exchange_rates FOR SELECT TO authenticated USING (true);

-- REMITTANCES
CREATE POLICY "Users can manage own remittances" ON public.remittances FOR ALL USING (auth.uid() = sender_id);

-- XN SCORES
CREATE POLICY "Users can view own score" ON public.xn_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view scores in their circles" ON public.xn_scores FOR SELECT USING (
    user_id IN (SELECT cm2.user_id FROM public.circle_members cm1
                JOIN public.circle_members cm2 ON cm1.circle_id = cm2.circle_id
                WHERE cm1.user_id = auth.uid())
);

-- SCORE EVENTS
CREATE POLICY "Users can view own score events" ON public.score_events FOR SELECT USING (auth.uid() = user_id);

-- SCORE HISTORY
CREATE POLICY "Users can view own score history" ON public.score_history FOR SELECT USING (auth.uid() = user_id);

-- SCORE BENEFITS (public read)
CREATE POLICY "Anyone can view score benefits" ON public.score_benefits FOR SELECT TO authenticated USING (true);

-- TRUST PROFILES
CREATE POLICY "Users can view own trust profile" ON public.trust_profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view trust in their circles" ON public.trust_profiles FOR SELECT USING (
    user_id IN (SELECT cm2.user_id FROM public.circle_members cm1
                JOIN public.circle_members cm2 ON cm1.circle_id = cm2.circle_id
                WHERE cm1.user_id = auth.uid())
);

-- VOUCH RECORDS
CREATE POLICY "Users can view own vouches" ON public.vouch_records FOR SELECT USING (
    auth.uid() = elder_id OR auth.uid() = vouched_user_id
);
CREATE POLICY "Elders can create vouches" ON public.vouch_records FOR INSERT WITH CHECK (auth.uid() = elder_id);

-- HONOR BADGES
CREATE POLICY "Users can view own badges" ON public.honor_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view badges in circles" ON public.honor_badges FOR SELECT USING (
    user_id IN (SELECT cm2.user_id FROM public.circle_members cm1
                JOIN public.circle_members cm2 ON cm1.circle_id = cm2.circle_id
                WHERE cm1.user_id = auth.uid())
);

-- SECURITY DEPOSITS
CREATE POLICY "Users can manage own deposits" ON public.security_deposits FOR ALL USING (auth.uid() = user_id);

-- TRUST TIER HISTORY
CREATE POLICY "Users can view own tier history" ON public.trust_tier_history FOR SELECT USING (auth.uid() = user_id);

-- LOAN PRODUCTS (public read)
CREATE POLICY "Anyone can view loan products" ON public.loan_products FOR SELECT TO authenticated USING (true);

-- LOAN APPLICATIONS
CREATE POLICY "Users can manage own loans" ON public.loan_applications FOR ALL USING (auth.uid() = user_id);

-- LOAN REPAYMENTS
CREATE POLICY "Users can view own repayments" ON public.loan_repayments FOR SELECT USING (auth.uid() = user_id);

-- FUTURE PAYOUTS
CREATE POLICY "Users can view own future payouts" ON public.future_payouts FOR SELECT USING (auth.uid() = user_id);

-- SAVINGS GOALS
CREATE POLICY "Users can manage own goals" ON public.savings_goals FOR ALL USING (auth.uid() = user_id);

-- GOAL TRANSACTIONS
CREATE POLICY "Users can view own goal transactions" ON public.goal_transactions FOR SELECT USING (auth.uid() = user_id);

-- GOAL MILESTONES
CREATE POLICY "Users can view own milestones" ON public.goal_milestones FOR SELECT USING (
    goal_id IN (SELECT id FROM public.savings_goals WHERE user_id = auth.uid())
);

-- COMMUNITIES
CREATE POLICY "Anyone can view public communities" ON public.communities FOR SELECT TO authenticated USING (privacy = 'public' OR
    id IN (SELECT community_id FROM public.community_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can create communities" ON public.communities FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- COMMUNITY MEMBERS
CREATE POLICY "Anyone can view community members" ON public.community_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can join communities" ON public.community_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave communities" ON public.community_members FOR DELETE USING (auth.uid() = user_id);

-- COMMUNITY CIRCLES
CREATE POLICY "Anyone can view community circles" ON public.community_circles FOR SELECT TO authenticated USING (true);

-- ELDER PROFILES
CREATE POLICY "Users can view elder profiles" ON public.elder_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own elder profile" ON public.elder_profiles FOR ALL USING (auth.uid() = user_id);

-- ELDER STATS
CREATE POLICY "Users can view own stats" ON public.elder_stats FOR SELECT USING (auth.uid() = user_id);

-- MEDIATION CASES
CREATE POLICY "Involved parties can view cases" ON public.mediation_cases FOR SELECT USING (
    auth.uid() = complainant_id OR auth.uid() = respondent_id OR
    auth.uid() IN (SELECT user_id FROM public.elder_profiles WHERE id = assigned_elder_id)
);

-- TRAINING COURSES (public read)
CREATE POLICY "Anyone can view courses" ON public.training_courses FOR SELECT TO authenticated USING (true);

-- TRAINING ENROLLMENTS
CREATE POLICY "Users can manage own enrollments" ON public.training_enrollments FOR ALL USING (auth.uid() = user_id);

-- AUDIT LOGS (admin only - no user policies)
CREATE POLICY "Users can view own audit logs" ON public.audit_logs FOR SELECT USING (auth.uid() = user_id);

-- NOTIFICATIONS
CREATE POLICY "Users can manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, display_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'name', '')
    ) ON CONFLICT (id) DO NOTHING;

    -- Create wallet
    INSERT INTO public.wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

    -- Create XnScore
    INSERT INTO public.xn_scores (user_id, current_score, level)
    VALUES (NEW.id, 75, 'Good') ON CONFLICT DO NOTHING;

    -- Create trust profile
    INSERT INTO public.trust_profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

    -- Create preferences
    INSERT INTO public.user_preferences (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update circle member count
CREATE OR REPLACE FUNCTION public.update_circle_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.circles SET current_members = current_members + 1, updated_at = NOW()
        WHERE id = NEW.circle_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.circles SET current_members = GREATEST(current_members - 1, 0), updated_at = NOW()
        WHERE id = OLD.circle_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_circle_member_change ON public.circle_members;
CREATE TRIGGER on_circle_member_change
    AFTER INSERT OR DELETE ON public.circle_members
    FOR EACH ROW EXECUTE FUNCTION public.update_circle_member_count();

-- Auto-update community member count
CREATE OR REPLACE FUNCTION public.update_community_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.communities SET member_count = member_count + 1, updated_at = NOW()
        WHERE id = NEW.community_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.communities SET member_count = GREATEST(member_count - 1, 0), updated_at = NOW()
        WHERE id = OLD.community_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_community_member_change ON public.community_members;
CREATE TRIGGER on_community_member_change
    AFTER INSERT OR DELETE ON public.community_members
    FOR EACH ROW EXECUTE FUNCTION public.update_community_member_count();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['profiles', 'circles', 'wallets', 'wallet_balances', 'xn_scores',
                              'trust_profiles', 'savings_goals', 'communities', 'elder_profiles',
                              'mediation_cases', 'loan_applications', 'future_payouts']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%s
                        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()', t, t);
    END LOOP;
END $$;

-- ============================================================================
-- ENABLE REALTIME
-- ============================================================================

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.circle_contributions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- SEED DATA - Score Benefits
-- ============================================================================

INSERT INTO public.score_benefits (level, min_score, max_score, color, slot_access, late_bonus_percent, early_fee_percent, max_loan_amount, loan_apr, description)
VALUES
    ('Critical', 0, 24, '#DC2626', 'None', 0, 0, 0, 0, 'Account under review, cannot join circles'),
    ('Poor', 25, 44, '#F59E0B', 'Last 3 slots', 0, 0, 0, 0, 'Building credit, limited access'),
    ('Fair', 45, 59, '#EAB308', 'Slots 7+', 1, 0, 500, 12, 'Basic access with small loan eligibility'),
    ('Good', 60, 74, '#22C55E', 'Slots 4+', 2, 2, 1500, 10, 'Standard access with loan eligibility'),
    ('Excellent', 75, 89, '#3B82F6', 'Any slot', 2.5, 1, 3000, 8, 'Premium access with better rates'),
    ('Elite', 90, 100, '#8B5CF6', 'VIP - Any slot', 3, 0.5, 5000, 6, 'VIP status with best rates')
ON CONFLICT (level) DO NOTHING;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ============================================================================
-- COMPLETE! 42 TABLES CREATED
-- ============================================================================
--
-- Section 1: User Management (4 tables)
--   1. profiles
--   2. user_sessions
--   3. user_verifications
--   4. user_preferences
--
-- Section 2: Circles (6 tables)
--   5. circles
--   6. circle_members
--   7. circle_contributions
--   8. circle_payouts
--   9. circle_invitations
--   10. circle_activity
--
-- Section 3: Wallet & Transactions (6 tables)
--   11. wallets
--   12. wallet_balances
--   13. transactions
--   14. payment_methods
--   15. exchange_rates
--   16. remittances
--
-- Section 4: XnScore Credit System (4 tables)
--   17. xn_scores
--   18. score_events
--   19. score_history
--   20. score_benefits
--
-- Section 5: Trust & Vouching (5 tables)
--   21. trust_profiles
--   22. vouch_records
--   23. honor_badges
--   24. security_deposits
--   25. trust_tier_history
--
-- Section 6: Advances/Loans (4 tables)
--   26. loan_products
--   27. loan_applications
--   28. loan_repayments
--   29. future_payouts
--
-- Section 7: Savings Goals (3 tables)
--   30. savings_goals
--   31. goal_transactions
--   32. goal_milestones
--
-- Section 8: Communities (3 tables)
--   33. communities
--   34. community_members
--   35. community_circles
--
-- Section 9: Elder System (5 tables)
--   36. elder_profiles
--   37. elder_stats
--   38. mediation_cases
--   39. training_courses
--   40. training_enrollments
--
-- Section 10: Audit & System (2 tables)
--   41. audit_logs
--   42. notifications
--
-- ============================================================================
