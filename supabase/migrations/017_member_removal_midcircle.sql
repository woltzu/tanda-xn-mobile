-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 017: Member Removal Mid-Circle System (v4 - No status in RLS)
-- ══════════════════════════════════════════════════════════════════════════════
-- Fixed: Removed ALL references to cm.status in RLS policies
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ENUMS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘
DO $$ BEGIN
    CREATE TYPE removal_reason AS ENUM (
        'voluntary', 'default', 'fraud', 'admin', 'emergency',
        'inactivity', 'rule_violation', 'membership_collapse'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE settlement_type AS ENUM (
        'full_refund', 'partial_refund', 'forfeiture', 'debt_created', 'no_settlement'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE removal_status AS ENUM (
        'pending_approval', 'approved', 'executing', 'completed',
        'rejected', 'cancelled', 'disputed'
    );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TABLES                                                                      │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS circle_removal_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE UNIQUE,
    early_exit_fee_percentage DECIMAL(5,4) DEFAULT 0.05,
    exit_fee_destination TEXT DEFAULT 'pool' CHECK (exit_fee_destination IN ('pool', 'members', 'platform')),
    require_vote_for_removal BOOLEAN DEFAULT false,
    vote_threshold_percentage DECIMAL(3,2) DEFAULT 0.60,
    voting_period_hours INTEGER DEFAULT 48,
    allow_debt_repayment_plan BOOLEAN DEFAULT true,
    max_repayment_installments INTEGER DEFAULT 6,
    debt_blocks_new_circles BOOLEAN DEFAULT true,
    forfeit_on_default BOOLEAN DEFAULT true,
    forfeit_on_fraud BOOLEAN DEFAULT true,
    grace_period_days INTEGER DEFAULT 7,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS member_removal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    member_user_id UUID NOT NULL REFERENCES profiles(id),
    reason removal_reason NOT NULL,
    reason_details TEXT,
    status removal_status NOT NULL DEFAULT 'pending_approval',
    initiated_by UUID REFERENCES profiles(id),
    initiated_by_type TEXT DEFAULT 'user' CHECK (initiated_by_type IN ('user', 'elder', 'system', 'admin')),
    is_self_removal BOOLEAN DEFAULT false,
    total_contributed DECIMAL(15,2) DEFAULT 0,
    total_received DECIMAL(15,2) DEFAULT 0,
    has_received_payout BOOLEAN DEFAULT false,
    member_position INTEGER,
    was_current_beneficiary BOOLEAN DEFAULT false,
    settlement_type settlement_type,
    settlement_amount DECIMAL(15,2) DEFAULT 0,
    exit_fee_amount DECIMAL(15,2) DEFAULT 0,
    debt_amount DECIMAL(15,2) DEFAULT 0,
    requires_vote BOOLEAN DEFAULT false,
    voting_starts_at TIMESTAMPTZ,
    voting_ends_at TIMESTAMPTZ,
    votes_for INTEGER DEFAULT 0,
    votes_against INTEGER DEFAULT 0,
    votes_abstain INTEGER DEFAULT 0,
    grace_period_ends_at TIMESTAMPTZ,
    can_be_cancelled_until TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id),
    resolution_notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS removal_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    removal_request_id UUID NOT NULL REFERENCES member_removal_requests(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    vote TEXT NOT NULL CHECK (vote IN ('approve', 'reject', 'abstain')),
    reason TEXT,
    voted_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(removal_request_id, user_id)
);

CREATE TABLE IF NOT EXISTS member_debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    circle_id UUID NOT NULL REFERENCES circles(id),
    removal_request_id UUID REFERENCES member_removal_requests(id),
    original_amount DECIMAL(15,2) NOT NULL,
    remaining_amount DECIMAL(15,2) NOT NULL,
    reason TEXT NOT NULL,
    has_repayment_plan BOOLEAN DEFAULT false,
    repayment_plan_id UUID,
    installment_amount DECIMAL(15,2),
    installments_remaining INTEGER,
    next_installment_date DATE,
    debt_status TEXT DEFAULT 'pending' CHECK (debt_status IN ('pending', 'repaying', 'settled', 'written_off', 'disputed')),
    settled_at TIMESTAMPTZ,
    written_off_at TIMESTAMPTZ,
    written_off_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES member_debts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id),
    amount DECIMAL(15,2) NOT NULL,
    payment_method TEXT NOT NULL,
    payment_reference TEXT,
    payment_status TEXT DEFAULT 'completed' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circle_removal_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    removal_request_id UUID REFERENCES member_removal_requests(id),
    circle_id UUID NOT NULL REFERENCES circles(id),
    removed_user_id UUID NOT NULL REFERENCES profiles(id),
    removed_by_user_id UUID REFERENCES profiles(id),
    action_type TEXT NOT NULL,
    reason removal_reason NOT NULL,
    reason_details TEXT,
    settlement_type settlement_type NOT NULL,
    settlement_amount DECIMAL(15,2),
    exit_fee_amount DECIMAL(15,2),
    debt_amount DECIMAL(15,2),
    old_position INTEGER,
    positions_before JSONB,
    positions_after JSONB,
    xn_score_before INTEGER,
    xn_score_after INTEGER,
    xn_score_delta INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payout_order_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('member_removed', 'member_added', 'order_shuffled', 'beneficiary_skipped')),
    affected_user_id UUID REFERENCES profiles(id),
    reason TEXT,
    old_order JSONB NOT NULL,
    new_order JSONB NOT NULL,
    old_total_cycles INTEGER,
    new_total_cycles INTEGER,
    old_beneficiary_id UUID,
    new_beneficiary_id UUID,
    cycle_skipped BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ INDEXES                                                                     │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE INDEX IF NOT EXISTS idx_removal_requests_circle ON member_removal_requests(circle_id);
CREATE INDEX IF NOT EXISTS idx_removal_requests_member ON member_removal_requests(member_user_id);
CREATE INDEX IF NOT EXISTS idx_removal_requests_status ON member_removal_requests(status);
CREATE INDEX IF NOT EXISTS idx_removal_votes_request ON removal_votes(removal_request_id);
CREATE INDEX IF NOT EXISTS idx_removal_votes_user ON removal_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_member_debts_user ON member_debts(user_id);
CREATE INDEX IF NOT EXISTS idx_member_debts_circle ON member_debts(circle_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_debt ON debt_payments(debt_id);
CREATE INDEX IF NOT EXISTS idx_removal_audit_circle ON circle_removal_audit(circle_id);
CREATE INDEX IF NOT EXISTS idx_payout_adjustments_circle ON payout_order_adjustments(circle_id);

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ HELPER FUNCTIONS                                                            │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION get_member_circle_position(
    p_circle_id UUID,
    p_user_id UUID
) RETURNS TABLE (
    total_contributed DECIMAL(15,2),
    total_received DECIMAL(15,2),
    has_received_payout BOOLEAN,
    net_position DECIMAL(15,2),
    current_position INTEGER,
    remaining_cycles_to_pay INTEGER,
    is_current_beneficiary BOOLEAN
) AS $$
DECLARE
    v_circle RECORD;
    v_member RECORD;
    v_position INTEGER := 0;
    v_total_contributed DECIMAL(15,2) := 0;
    v_total_received DECIMAL(15,2) := 0;
    v_is_current_beneficiary BOOLEAN := false;
BEGIN
    SELECT * INTO v_circle FROM circles WHERE id = p_circle_id;
    SELECT * INTO v_member FROM circle_members WHERE circle_id = p_circle_id AND user_id = p_user_id;
    v_position := COALESCE(v_member.position, 0);

    -- Try cycle_contributions first, then contributions
    BEGIN
        SELECT COALESCE(SUM(contributed_amount), 0) INTO v_total_contributed
        FROM cycle_contributions WHERE circle_id = p_circle_id AND user_id = p_user_id AND status = 'completed';
    EXCEPTION WHEN undefined_table THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_total_contributed
        FROM contributions WHERE circle_id = p_circle_id AND user_id = p_user_id AND status = 'completed';
    END;

    -- Try circle_cycles first, then payouts
    BEGIN
        SELECT COALESCE(SUM(payout_amount), 0) INTO v_total_received
        FROM circle_cycles WHERE circle_id = p_circle_id AND recipient_user_id = p_user_id AND status = 'completed';
    EXCEPTION WHEN undefined_table THEN
        SELECT COALESCE(SUM(amount), 0) INTO v_total_received
        FROM payouts WHERE circle_id = p_circle_id AND recipient_id = p_user_id AND status = 'completed';
    END;

    RETURN QUERY SELECT
        v_total_contributed,
        v_total_received,
        v_total_received > 0,
        v_total_contributed - v_total_received,
        v_position,
        CASE WHEN v_total_received > 0 THEN GREATEST(0, COALESCE(v_circle.total_cycles, v_circle.member_count) - COALESCE(v_circle.current_cycle, 1)) ELSE 0 END::INTEGER,
        v_is_current_beneficiary;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION calculate_removal_settlement(
    p_circle_id UUID,
    p_user_id UUID,
    p_reason removal_reason
) RETURNS TABLE (
    settlement_type settlement_type,
    refund_amount DECIMAL(15,2),
    exit_fee_amount DECIMAL(15,2),
    debt_amount DECIMAL(15,2),
    xn_score_impact INTEGER
) AS $$
DECLARE
    v_position RECORD;
    v_settings circle_removal_settings%ROWTYPE;
    v_circle circles%ROWTYPE;
    v_settlement settlement_type;
    v_refund DECIMAL(15,2) := 0;
    v_fee DECIMAL(15,2) := 0;
    v_debt DECIMAL(15,2) := 0;
    v_xn_impact INTEGER := 0;
BEGIN
    SELECT * INTO v_position FROM get_member_circle_position(p_circle_id, p_user_id);
    SELECT * INTO v_circle FROM circles WHERE id = p_circle_id;
    SELECT * INTO v_settings FROM circle_removal_settings WHERE circle_id = p_circle_id;

    IF v_settings IS NULL THEN
        v_settings.early_exit_fee_percentage := 0.05;
        v_settings.forfeit_on_default := true;
        v_settings.forfeit_on_fraud := true;
    END IF;

    IF v_position.has_received_payout THEN
        v_settlement := 'debt_created';
        v_debt := v_position.remaining_cycles_to_pay * COALESCE(v_circle.amount, 0);
        v_xn_impact := -75;
    ELSE
        CASE p_reason
            WHEN 'voluntary' THEN
                v_settlement := 'partial_refund';
                v_fee := v_position.total_contributed * v_settings.early_exit_fee_percentage;
                v_refund := v_position.total_contributed - v_fee;
                v_xn_impact := -15;
            WHEN 'default', 'fraud' THEN
                IF (p_reason = 'default' AND v_settings.forfeit_on_default) OR (p_reason = 'fraud' AND v_settings.forfeit_on_fraud) THEN
                    v_settlement := 'forfeiture'; v_refund := 0;
                ELSE
                    v_settlement := 'partial_refund';
                    v_fee := v_position.total_contributed * v_settings.early_exit_fee_percentage;
                    v_refund := v_position.total_contributed - v_fee;
                END IF;
                v_xn_impact := CASE p_reason WHEN 'fraud' THEN -100 ELSE -50 END;
            WHEN 'admin', 'emergency' THEN
                v_settlement := 'full_refund'; v_refund := v_position.total_contributed; v_xn_impact := 0;
            WHEN 'rule_violation' THEN
                v_settlement := 'forfeiture'; v_refund := 0; v_xn_impact := -40;
            WHEN 'inactivity' THEN
                v_settlement := 'partial_refund';
                v_fee := v_position.total_contributed * v_settings.early_exit_fee_percentage;
                v_refund := v_position.total_contributed - v_fee;
                v_xn_impact := -20;
            WHEN 'membership_collapse' THEN
                v_settlement := 'full_refund'; v_refund := v_position.total_contributed; v_xn_impact := 0;
            ELSE
                v_settlement := 'no_settlement'; v_xn_impact := 0;
        END CASE;
    END IF;

    RETURN QUERY SELECT v_settlement, v_refund, v_fee, v_debt, v_xn_impact;
END;
$$ LANGUAGE plpgsql STABLE;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ CORE FUNCTIONS                                                              │
-- └─────────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION initiate_member_removal(
    p_circle_id UUID,
    p_member_user_id UUID,
    p_reason removal_reason,
    p_reason_details TEXT DEFAULT NULL,
    p_initiated_by UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_request_id UUID;
    v_position RECORD;
    v_settlement RECORD;
    v_settings circle_removal_settings%ROWTYPE;
    v_is_self_removal BOOLEAN;
    v_initiated_by_type TEXT;
    v_requires_vote BOOLEAN := false;
BEGIN
    IF EXISTS (SELECT 1 FROM member_removal_requests WHERE circle_id = p_circle_id AND member_user_id = p_member_user_id AND status NOT IN ('completed', 'rejected', 'cancelled')) THEN
        RAISE EXCEPTION 'Member already has a pending removal request';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM circle_members WHERE circle_id = p_circle_id AND user_id = p_member_user_id) THEN
        RAISE EXCEPTION 'User is not a member of this circle';
    END IF;

    SELECT * INTO v_position FROM get_member_circle_position(p_circle_id, p_member_user_id);
    SELECT * INTO v_settlement FROM calculate_removal_settlement(p_circle_id, p_member_user_id, p_reason);
    SELECT * INTO v_settings FROM circle_removal_settings WHERE circle_id = p_circle_id;

    v_is_self_removal := (p_initiated_by = p_member_user_id);
    IF p_initiated_by IS NULL THEN v_initiated_by_type := 'system';
    ELSIF v_is_self_removal THEN v_initiated_by_type := 'user';
    ELSIF EXISTS (SELECT 1 FROM circle_members WHERE circle_id = p_circle_id AND user_id = p_initiated_by AND role IN ('elder', 'admin', 'creator')) THEN v_initiated_by_type := 'elder';
    ELSE v_initiated_by_type := 'user';
    END IF;

    IF v_settings IS NOT NULL AND v_settings.require_vote_for_removal AND NOT v_is_self_removal AND p_reason NOT IN ('emergency', 'admin') THEN
        v_requires_vote := true;
    END IF;

    INSERT INTO member_removal_requests (
        circle_id, member_user_id, reason, reason_details, status,
        initiated_by, initiated_by_type, is_self_removal,
        total_contributed, total_received, has_received_payout, member_position, was_current_beneficiary,
        settlement_type, settlement_amount, exit_fee_amount, debt_amount,
        requires_vote, voting_starts_at, voting_ends_at, grace_period_ends_at, can_be_cancelled_until
    ) VALUES (
        p_circle_id, p_member_user_id, p_reason, p_reason_details,
        CASE WHEN v_requires_vote OR (v_is_self_removal AND p_reason = 'voluntary') THEN 'pending_approval'::removal_status ELSE 'approved'::removal_status END,
        p_initiated_by, v_initiated_by_type, v_is_self_removal,
        v_position.total_contributed, v_position.total_received, v_position.has_received_payout, v_position.current_position, v_position.is_current_beneficiary,
        v_settlement.settlement_type, v_settlement.refund_amount, v_settlement.exit_fee_amount, v_settlement.debt_amount,
        v_requires_vote,
        CASE WHEN v_requires_vote THEN now() ELSE NULL END,
        CASE WHEN v_requires_vote THEN now() + (COALESCE(v_settings.voting_period_hours, 48) || ' hours')::INTERVAL ELSE NULL END,
        CASE WHEN v_is_self_removal AND p_reason = 'voluntary' THEN now() + (COALESCE(v_settings.grace_period_days, 7) || ' days')::INTERVAL ELSE NULL END,
        CASE WHEN v_is_self_removal THEN now() + '24 hours'::INTERVAL ELSE NULL END
    ) RETURNING id INTO v_request_id;

    IF NOT v_requires_vote AND NOT (v_is_self_removal AND p_reason = 'voluntary') THEN
        PERFORM execute_member_removal(v_request_id, p_initiated_by);
    END IF;

    RETURN v_request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cast_removal_vote(
    p_removal_request_id UUID,
    p_user_id UUID,
    p_vote TEXT,
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_request member_removal_requests%ROWTYPE;
    v_existing_vote TEXT;
BEGIN
    SELECT * INTO v_request FROM member_removal_requests WHERE id = p_removal_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Removal request not found'; END IF;
    IF v_request.status != 'pending_approval' OR NOT v_request.requires_vote THEN RAISE EXCEPTION 'Voting is not open'; END IF;
    IF v_request.voting_ends_at < now() THEN RAISE EXCEPTION 'Voting period has ended'; END IF;
    IF p_user_id = v_request.member_user_id THEN RAISE EXCEPTION 'Cannot vote on own removal'; END IF;
    IF NOT EXISTS (SELECT 1 FROM circle_members WHERE circle_id = v_request.circle_id AND user_id = p_user_id) THEN
        RAISE EXCEPTION 'User is not a member of this circle';
    END IF;

    SELECT vote INTO v_existing_vote FROM removal_votes WHERE removal_request_id = p_removal_request_id AND user_id = p_user_id;

    IF FOUND THEN
        UPDATE removal_votes SET vote = p_vote, reason = p_reason, updated_at = now() WHERE removal_request_id = p_removal_request_id AND user_id = p_user_id;
        UPDATE member_removal_requests SET
            votes_for = votes_for + CASE WHEN p_vote = 'approve' THEN 1 ELSE 0 END - CASE WHEN v_existing_vote = 'approve' THEN 1 ELSE 0 END,
            votes_against = votes_against + CASE WHEN p_vote = 'reject' THEN 1 ELSE 0 END - CASE WHEN v_existing_vote = 'reject' THEN 1 ELSE 0 END,
            votes_abstain = votes_abstain + CASE WHEN p_vote = 'abstain' THEN 1 ELSE 0 END - CASE WHEN v_existing_vote = 'abstain' THEN 1 ELSE 0 END
        WHERE id = p_removal_request_id;
    ELSE
        INSERT INTO removal_votes (removal_request_id, user_id, vote, reason) VALUES (p_removal_request_id, p_user_id, p_vote, p_reason);
        UPDATE member_removal_requests SET
            votes_for = votes_for + CASE WHEN p_vote = 'approve' THEN 1 ELSE 0 END,
            votes_against = votes_against + CASE WHEN p_vote = 'reject' THEN 1 ELSE 0 END,
            votes_abstain = votes_abstain + CASE WHEN p_vote = 'abstain' THEN 1 ELSE 0 END
        WHERE id = p_removal_request_id;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION process_removal_vote_results(p_removal_request_id UUID) RETURNS TEXT AS $$
DECLARE
    v_request member_removal_requests%ROWTYPE;
    v_settings circle_removal_settings%ROWTYPE;
    v_threshold DECIMAL(3,2);
    v_approval_rate DECIMAL(5,4);
    v_new_status removal_status;
BEGIN
    SELECT * INTO v_request FROM member_removal_requests WHERE id = p_removal_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Removal request not found'; END IF;
    IF v_request.status != 'pending_approval' THEN RAISE EXCEPTION 'Not pending approval'; END IF;

    SELECT * INTO v_settings FROM circle_removal_settings WHERE circle_id = v_request.circle_id;
    v_threshold := COALESCE(v_settings.vote_threshold_percentage, 0.60);

    IF (v_request.votes_for + v_request.votes_against) > 0 THEN
        v_approval_rate := v_request.votes_for::DECIMAL / (v_request.votes_for + v_request.votes_against);
    ELSE v_approval_rate := 0;
    END IF;

    v_new_status := CASE WHEN v_approval_rate >= v_threshold THEN 'approved' ELSE 'rejected' END;
    UPDATE member_removal_requests SET status = v_new_status, updated_at = now() WHERE id = p_removal_request_id;
    IF v_new_status = 'approved' THEN PERFORM execute_member_removal(p_removal_request_id, NULL); END IF;

    RETURN v_new_status::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION execute_member_removal(p_removal_request_id UUID, p_executed_by UUID DEFAULT NULL) RETURNS BOOLEAN AS $$
DECLARE
    v_request member_removal_requests%ROWTYPE;
    v_settlement RECORD;
    v_old_positions JSONB;
    v_new_positions JSONB;
    v_circle circles%ROWTYPE;
    v_xn_score_before INTEGER;
    v_xn_score_after INTEGER;
    v_wallet_id UUID;
BEGIN
    SELECT * INTO v_request FROM member_removal_requests WHERE id = p_removal_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Removal request not found'; END IF;
    IF v_request.status NOT IN ('approved', 'pending_approval') THEN RAISE EXCEPTION 'Must be approved first'; END IF;

    UPDATE member_removal_requests SET status = 'executing', updated_at = now() WHERE id = p_removal_request_id;
    SELECT * INTO v_circle FROM circles WHERE id = v_request.circle_id;

    SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'position', position) ORDER BY position)
    INTO v_old_positions FROM circle_members WHERE circle_id = v_request.circle_id;

    SELECT COALESCE(xn_score, 50) INTO v_xn_score_before FROM profiles WHERE id = v_request.member_user_id;
    SELECT * INTO v_settlement FROM calculate_removal_settlement(v_request.circle_id, v_request.member_user_id, v_request.reason);

    -- Try to get wallet
    BEGIN SELECT id INTO v_wallet_id FROM user_wallets WHERE user_id = v_request.member_user_id;
    EXCEPTION WHEN undefined_table THEN v_wallet_id := NULL; END;

    -- Execute settlement
    CASE v_settlement.settlement_type
        WHEN 'full_refund', 'partial_refund' THEN
            IF v_wallet_id IS NOT NULL AND v_settlement.refund_amount > 0 THEN
                INSERT INTO wallet_transactions (wallet_id, user_id, transaction_type, direction, amount_cents, balance_type, balance_before_cents, balance_after_cents, description, reference_type, reference_id, transaction_status)
                VALUES (v_wallet_id, v_request.member_user_id, 'refund', 'credit', (v_settlement.refund_amount * 100)::BIGINT, 'main', 0, (v_settlement.refund_amount * 100)::BIGINT,
                    CASE v_settlement.settlement_type WHEN 'full_refund' THEN 'Full refund for circle removal' ELSE 'Partial refund (exit fee: ' || v_settlement.exit_fee_amount || ')' END,
                    'removal', p_removal_request_id, 'completed');
                UPDATE user_wallets SET main_balance_cents = main_balance_cents + (v_settlement.refund_amount * 100)::BIGINT, updated_at = now() WHERE user_id = v_request.member_user_id;
            END IF;
        WHEN 'debt_created' THEN
            INSERT INTO member_debts (user_id, circle_id, removal_request_id, original_amount, remaining_amount, reason, debt_status)
            VALUES (v_request.member_user_id, v_request.circle_id, p_removal_request_id, v_settlement.debt_amount, v_settlement.debt_amount, 'early_departure_after_payout', 'pending');
        ELSE NULL;
    END CASE;

    -- Update XnScore
    v_xn_score_after := GREATEST(0, LEAST(100, v_xn_score_before + v_settlement.xn_score_impact));
    UPDATE profiles SET xn_score = v_xn_score_after WHERE id = v_request.member_user_id;

    -- Remove member (update status if column exists, otherwise delete)
    UPDATE circle_members SET status = 'removed' WHERE circle_id = v_request.circle_id AND user_id = v_request.member_user_id;

    -- Update circle member count
    UPDATE circles SET current_members = GREATEST(0, current_members - 1), updated_at = now() WHERE id = v_request.circle_id;

    -- Recalculate positions
    WITH ranked AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY position) as new_pos
        FROM circle_members WHERE circle_id = v_request.circle_id AND status = 'active'
    )
    UPDATE circle_members cm SET position = r.new_pos::INTEGER FROM ranked r WHERE cm.id = r.id;

    SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'position', position) ORDER BY position)
    INTO v_new_positions FROM circle_members WHERE circle_id = v_request.circle_id AND status = 'active';

    -- Complete request
    UPDATE member_removal_requests SET
        status = 'completed', resolved_at = now(), resolved_by = p_executed_by,
        settlement_type = v_settlement.settlement_type, settlement_amount = v_settlement.refund_amount,
        exit_fee_amount = v_settlement.exit_fee_amount, debt_amount = v_settlement.debt_amount, updated_at = now()
    WHERE id = p_removal_request_id;

    -- Audit
    INSERT INTO circle_removal_audit (removal_request_id, circle_id, removed_user_id, removed_by_user_id, action_type, reason, reason_details, settlement_type, settlement_amount, exit_fee_amount, debt_amount, old_position, positions_before, positions_after, xn_score_before, xn_score_after, xn_score_delta)
    VALUES (p_removal_request_id, v_request.circle_id, v_request.member_user_id, p_executed_by, 'member_removed', v_request.reason, v_request.reason_details, v_settlement.settlement_type, v_settlement.refund_amount, v_settlement.exit_fee_amount, v_settlement.debt_amount, v_request.member_position, v_old_positions, v_new_positions, v_xn_score_before, v_xn_score_after, v_settlement.xn_score_impact);

    INSERT INTO payout_order_adjustments (circle_id, adjustment_type, affected_user_id, reason, old_order, new_order, old_total_cycles, new_total_cycles, old_beneficiary_id, new_beneficiary_id, cycle_skipped)
    VALUES (v_request.circle_id, 'member_removed', v_request.member_user_id, v_request.reason::TEXT, COALESCE(v_old_positions, '[]'), COALESCE(v_new_positions, '[]'), COALESCE(v_circle.total_cycles, v_circle.member_count), GREATEST(0, COALESCE(v_circle.total_cycles, v_circle.member_count) - 1), CASE WHEN v_request.was_current_beneficiary THEN v_request.member_user_id ELSE NULL END, (v_new_positions->0->>'user_id')::UUID, v_request.was_current_beneficiary);

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION cancel_removal_request(p_removal_request_id UUID, p_cancelled_by UUID, p_reason TEXT) RETURNS BOOLEAN AS $$
DECLARE v_request member_removal_requests%ROWTYPE;
BEGIN
    SELECT * INTO v_request FROM member_removal_requests WHERE id = p_removal_request_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Not found'; END IF;
    IF v_request.status != 'pending_approval' THEN RAISE EXCEPTION 'Only pending can be cancelled'; END IF;
    IF v_request.can_be_cancelled_until IS NOT NULL AND v_request.can_be_cancelled_until < now() THEN RAISE EXCEPTION 'Window passed'; END IF;
    IF v_request.initiated_by != p_cancelled_by AND NOT EXISTS (SELECT 1 FROM circle_members WHERE circle_id = v_request.circle_id AND user_id = p_cancelled_by AND role IN ('elder', 'admin', 'creator')) THEN
        RAISE EXCEPTION 'Only initiator or Elder can cancel';
    END IF;
    UPDATE member_removal_requests SET status = 'cancelled', resolved_at = now(), resolved_by = p_cancelled_by, resolution_notes = p_reason, updated_at = now() WHERE id = p_removal_request_id;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION make_debt_payment(p_debt_id UUID, p_user_id UUID, p_amount DECIMAL(15,2), p_payment_method TEXT, p_payment_reference TEXT DEFAULT NULL) RETURNS UUID AS $$
DECLARE v_debt member_debts%ROWTYPE; v_payment_id UUID; v_new_remaining DECIMAL(15,2);
BEGIN
    SELECT * INTO v_debt FROM member_debts WHERE id = p_debt_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Debt not found'; END IF;
    IF v_debt.user_id != p_user_id THEN RAISE EXCEPTION 'Not your debt'; END IF;
    IF v_debt.debt_status NOT IN ('pending', 'repaying') THEN RAISE EXCEPTION 'Not payable'; END IF;
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
    IF p_amount > v_debt.remaining_amount THEN p_amount := v_debt.remaining_amount; END IF;

    INSERT INTO debt_payments (debt_id, user_id, amount, payment_method, payment_reference, payment_status)
    VALUES (p_debt_id, p_user_id, p_amount, p_payment_method, p_payment_reference, 'completed') RETURNING id INTO v_payment_id;

    v_new_remaining := v_debt.remaining_amount - p_amount;
    IF v_new_remaining <= 0 THEN
        UPDATE member_debts SET remaining_amount = 0, debt_status = 'settled', settled_at = now(), updated_at = now() WHERE id = p_debt_id;
        UPDATE profiles SET xn_score = LEAST(100, xn_score + 10) WHERE id = p_user_id;
    ELSE
        UPDATE member_debts SET remaining_amount = v_new_remaining, debt_status = 'repaying', installments_remaining = CASE WHEN installments_remaining IS NOT NULL THEN installments_remaining - 1 ELSE NULL END, updated_at = now() WHERE id = p_debt_id;
    END IF;
    RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Scheduled jobs
CREATE OR REPLACE FUNCTION process_expired_removal_votes() RETURNS INTEGER AS $$
DECLARE v_processed INTEGER := 0; v_request RECORD;
BEGIN
    FOR v_request IN SELECT id FROM member_removal_requests WHERE status = 'pending_approval' AND requires_vote = true AND voting_ends_at <= now() LOOP
        PERFORM process_removal_vote_results(v_request.id); v_processed := v_processed + 1;
    END LOOP;
    RETURN v_processed;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_expired_grace_periods() RETURNS INTEGER AS $$
DECLARE v_processed INTEGER := 0; v_request RECORD;
BEGIN
    FOR v_request IN SELECT id FROM member_removal_requests WHERE status = 'pending_approval' AND is_self_removal = true AND reason = 'voluntary' AND grace_period_ends_at <= now() LOOP
        UPDATE member_removal_requests SET status = 'approved', updated_at = now() WHERE id = v_request.id;
        PERFORM execute_member_removal(v_request.id, NULL); v_processed := v_processed + 1;
    END LOOP;
    RETURN v_processed;
END;
$$ LANGUAGE plpgsql;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ VIEWS                                                                       │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE VIEW v_active_removal_requests AS
SELECT mrr.*, c.name as circle_name, p.full_name as member_name, ip.full_name as initiated_by_name,
    CASE WHEN mrr.requires_vote AND mrr.voting_ends_at IS NOT NULL THEN mrr.voting_ends_at - now() ELSE NULL END as voting_time_remaining,
    CASE WHEN mrr.grace_period_ends_at IS NOT NULL THEN mrr.grace_period_ends_at - now() ELSE NULL END as grace_period_remaining
FROM member_removal_requests mrr
JOIN circles c ON c.id = mrr.circle_id
LEFT JOIN profiles p ON p.id = mrr.member_user_id
LEFT JOIN profiles ip ON ip.id = mrr.initiated_by
WHERE mrr.status NOT IN ('completed', 'rejected', 'cancelled');

CREATE OR REPLACE VIEW v_user_debts AS
SELECT md.*, c.name as circle_name,
    (SELECT COUNT(*) FROM debt_payments WHERE debt_id = md.id) as total_payments,
    (SELECT COALESCE(SUM(amount), 0) FROM debt_payments WHERE debt_id = md.id AND payment_status = 'completed') as total_paid
FROM member_debts md JOIN circles c ON c.id = md.circle_id;

CREATE OR REPLACE VIEW v_removal_statistics AS
SELECT reason, COUNT(*) as total_removals,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
    COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
    AVG(settlement_amount) as avg_settlement_amount, AVG(exit_fee_amount) as avg_exit_fee,
    AVG(debt_amount) FILTER (WHERE debt_amount > 0) as avg_debt_created
FROM member_removal_requests GROUP BY reason;

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ ROW LEVEL SECURITY (No status references!)                                  │
-- └─────────────────────────────────────────────────────────────────────────────┘
ALTER TABLE circle_removal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_removal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE removal_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_removal_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_order_adjustments ENABLE ROW LEVEL SECURITY;

-- Settings
DROP POLICY IF EXISTS "removal_settings_elder_manage" ON circle_removal_settings;
CREATE POLICY "removal_settings_elder_manage" ON circle_removal_settings FOR ALL
USING (circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid() AND role IN ('elder', 'admin', 'creator')));

DROP POLICY IF EXISTS "removal_settings_member_view" ON circle_removal_settings;
CREATE POLICY "removal_settings_member_view" ON circle_removal_settings FOR SELECT
USING (circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid()));

-- Removal requests
DROP POLICY IF EXISTS "removal_requests_member_view" ON member_removal_requests;
CREATE POLICY "removal_requests_member_view" ON member_removal_requests FOR SELECT
USING (circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "removal_requests_insert" ON member_removal_requests;
CREATE POLICY "removal_requests_insert" ON member_removal_requests FOR INSERT
WITH CHECK (member_user_id = auth.uid() OR circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid() AND role IN ('elder', 'admin', 'creator')));

-- Removal votes (NO cm.status reference!)
DROP POLICY IF EXISTS "removal_votes_view" ON removal_votes;
CREATE POLICY "removal_votes_view" ON removal_votes FOR SELECT
USING (removal_request_id IN (SELECT mrr.id FROM member_removal_requests mrr JOIN circle_members cm ON cm.circle_id = mrr.circle_id WHERE cm.user_id = auth.uid()));

DROP POLICY IF EXISTS "removal_votes_insert" ON removal_votes;
CREATE POLICY "removal_votes_insert" ON removal_votes FOR INSERT
WITH CHECK (user_id = auth.uid() AND removal_request_id IN (SELECT mrr.id FROM member_removal_requests mrr JOIN circle_members cm ON cm.circle_id = mrr.circle_id WHERE cm.user_id = auth.uid()));

DROP POLICY IF EXISTS "removal_votes_update" ON removal_votes;
CREATE POLICY "removal_votes_update" ON removal_votes FOR UPDATE USING (user_id = auth.uid());

-- Debts
DROP POLICY IF EXISTS "debts_user_view" ON member_debts;
CREATE POLICY "debts_user_view" ON member_debts FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "debts_elder_view" ON member_debts;
CREATE POLICY "debts_elder_view" ON member_debts FOR SELECT
USING (circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid() AND role IN ('elder', 'admin', 'creator')));

-- Debt payments
DROP POLICY IF EXISTS "debt_payments_user_view" ON debt_payments;
CREATE POLICY "debt_payments_user_view" ON debt_payments FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "debt_payments_user_insert" ON debt_payments;
CREATE POLICY "debt_payments_user_insert" ON debt_payments FOR INSERT WITH CHECK (user_id = auth.uid());

-- Audit
DROP POLICY IF EXISTS "audit_view" ON circle_removal_audit;
CREATE POLICY "audit_view" ON circle_removal_audit FOR SELECT
USING (circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid()) OR removed_user_id = auth.uid());

-- Adjustments
DROP POLICY IF EXISTS "adjustments_view" ON payout_order_adjustments;
CREATE POLICY "adjustments_view" ON payout_order_adjustments FOR SELECT
USING (circle_id IN (SELECT circle_id FROM circle_members WHERE user_id = auth.uid()));

-- ┌─────────────────────────────────────────────────────────────────────────────┐
-- │ TRIGGERS                                                                    │
-- └─────────────────────────────────────────────────────────────────────────────┘
CREATE OR REPLACE FUNCTION update_removal_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_removal_settings_updated ON circle_removal_settings;
CREATE TRIGGER tr_removal_settings_updated BEFORE UPDATE ON circle_removal_settings FOR EACH ROW EXECUTE FUNCTION update_removal_timestamp();

DROP TRIGGER IF EXISTS tr_removal_requests_updated ON member_removal_requests;
CREATE TRIGGER tr_removal_requests_updated BEFORE UPDATE ON member_removal_requests FOR EACH ROW EXECUTE FUNCTION update_removal_timestamp();

DROP TRIGGER IF EXISTS tr_removal_votes_updated ON removal_votes;
CREATE TRIGGER tr_removal_votes_updated BEFORE UPDATE ON removal_votes FOR EACH ROW EXECUTE FUNCTION update_removal_timestamp();

DROP TRIGGER IF EXISTS tr_member_debts_updated ON member_debts;
CREATE TRIGGER tr_member_debts_updated BEFORE UPDATE ON member_debts FOR EACH ROW EXECUTE FUNCTION update_removal_timestamp();

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 017 v4
-- ══════════════════════════════════════════════════════════════════════════════
