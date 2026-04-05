-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 053: KYC Verification System
-- #44 — Document Verification AI (KYC Provider Integration — Persona)
-- #207 — KYC Fallback Intelligence (Risk-Based Interim Verification)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Two complementary systems:
--   1. Full KYC via Persona (document + liveness verification)
--   2. Fallback scoring for interim access while full KYC integrates
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: kyc_verifications — Master KYC record per member
-- One row per member. Tracks both fallback and full KYC status.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Overall KYC status
    kyc_type TEXT NOT NULL DEFAULT 'fallback' CHECK (kyc_type IN ('fallback', 'full', 'enhanced')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending',           -- Initial state
        'fallback_active',   -- Fallback scoring applied, limited access
        'provider_pending',  -- Full KYC submitted to Persona, awaiting result
        'provider_review',   -- Persona flagged for manual review
        'admin_review',      -- Internal admin reviewing
        'approved',          -- Fully verified
        'rejected',          -- Rejected (can re-attempt)
        'expired',           -- Verification expired (must re-verify)
        'suspended'          -- Suspended due to compliance issue
    )),

    -- KYC tier (0-4, syncs to profiles.kyc_tier)
    kyc_tier INTEGER NOT NULL DEFAULT 0 CHECK (kyc_tier BETWEEN 0 AND 4),

    -- Persona provider integration
    provider TEXT CHECK (provider IN ('persona', 'manual', 'fallback')),
    provider_inquiry_id TEXT,           -- Persona inquiry ID (VA... format)
    provider_reference_id TEXT,         -- Persona reference ID for the member
    provider_template_id TEXT,          -- Which Persona template was used (US vs intl)
    provider_status TEXT,               -- Raw status from Persona
    provider_response JSONB DEFAULT '{}', -- Full provider response (redacted PII)

    -- Verification details
    verification_method TEXT CHECK (verification_method IN (
        'ssn', 'itin', 'passport', 'national_id', 'drivers_license', 'fallback_only'
    )),
    document_country TEXT,              -- ISO 3166-1 alpha-2
    document_issuing_state TEXT,        -- For US driver's licenses
    liveness_check_passed BOOLEAN,
    document_check_passed BOOLEAN,
    selfie_match_passed BOOLEAN,

    -- Risk assessment from Persona
    risk_level TEXT DEFAULT 'unknown' CHECK (risk_level IN (
        'low', 'medium', 'high', 'critical', 'unknown'
    )),
    risk_signals JSONB DEFAULT '{}',    -- Persona risk signals (fraud score, match scores, etc.)
    -- Structure: { "id_fraud_score": 0.02, "selfie_match_score": 0.97,
    --              "document_quality_score": 0.88, "name_match_score": 0.98,
    --              "dob_match": true, "ofac_hit": false, "pep_hit": false,
    --              "adverse_media_hit": false, "watchlist_hit": false,
    --              "session_duration_seconds": 142, "attempt_number": 1,
    --              "geo_ip_country": "US", "geo_ip_matches_doc": true }

    -- KYC deadlines
    fallback_expires_at TIMESTAMPTZ,    -- When fallback access expires (30 or 60 days)
    full_kyc_deadline TIMESTAMPTZ,      -- Deadline to complete full KYC
    last_reverification_at TIMESTAMPTZ,
    next_reverification_at TIMESTAMPTZ,

    -- Rejection / suspension
    rejection_reason TEXT,
    rejection_code TEXT,                -- Persona's machine-readable decline code
    rejection_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    manual_review_reason TEXT,          -- Why it was sent to manual review

    -- Admin review
    reviewed_by_admin_id UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,

    -- A/B testing instrumentation
    experiment_group TEXT,              -- 'control', 'variant_a', 'variant_b'
    experiment_id TEXT,                 -- Identifies which experiment
    experiment_assigned_at TIMESTAMPTZ,

    -- Compliance / data retention
    consent_recorded_at TIMESTAMPTZ,    -- When member consented to identity verification
    data_retention_until TIMESTAMPTZ,   -- GDPR/CCPA: account_deletion + 5 years (FinCEN)

    -- Metadata
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT kyc_verifications_member_unique UNIQUE (member_id)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: kyc_documents — Document submissions (references, not raw PII)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL REFERENCES kyc_verifications(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Document info
    document_type TEXT NOT NULL CHECK (document_type IN (
        'passport', 'national_id', 'drivers_license', 'ssn_card',
        'itin_letter', 'selfie', 'liveness_video', 'proof_of_address',
        'utility_bill', 'bank_statement'
    )),
    document_country TEXT,              -- ISO 3166-1 alpha-2
    document_number_hash TEXT,          -- Hashed document number (never store raw)

    -- Provider references (Persona stores the actual documents)
    provider_document_id TEXT,          -- Persona document ID
    provider_file_url TEXT,             -- Persona hosted URL (temporary, expires)

    -- Verification result for this document
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'verified', 'rejected', 'expired', 'needs_review'
    )),
    rejection_reason TEXT,
    confidence_score NUMERIC(5,4),      -- 0.0000 to 1.0000
    extracted_data JSONB DEFAULT '{}',  -- Non-PII extracted info (country, doc type, expiry)

    -- Metadata
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,             -- Document expiration date
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: kyc_provider_webhooks — Persona webhook event log (immutable)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_provider_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL DEFAULT 'persona',
    event_type TEXT NOT NULL,           -- inquiry.completed, inquiry.failed, etc.
    event_id TEXT NOT NULL,             -- Persona event ID (for dedup)
    inquiry_id TEXT,                    -- Persona inquiry ID
    payload JSONB NOT NULL DEFAULT '{}',
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT kyc_webhooks_event_unique UNIQUE (event_id)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: kyc_admin_reviews — Admin review queue for flagged verifications
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_admin_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NOT NULL REFERENCES kyc_verifications(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Review details
    review_reason TEXT NOT NULL CHECK (review_reason IN (
        'provider_flagged',     -- Persona flagged for review
        'document_mismatch',    -- Document info doesn't match profile
        'liveness_failed',      -- Liveness check failed
        'duplicate_document',   -- Document already used by another member
        'sanctions_match',      -- Potential sanctions list match
        'high_risk_signals',    -- Multiple high-risk fallback signals
        'manual_escalation',    -- Agent/system escalated
        'reverification'        -- Periodic reverification flagged
    )),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'in_review', 'approved', 'rejected', 'escalated'
    )),

    -- Review decision
    reviewed_by UUID REFERENCES auth.users(id),
    review_notes TEXT,
    decision TEXT CHECK (decision IN ('approve', 'reject', 'request_resubmit', 'escalate', 'suspend')),
    decision_reason TEXT,

    -- Metadata
    assigned_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: kyc_fallback_scores — #207 Fallback risk scoring
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_fallback_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Overall score (0-100)
    score INTEGER NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    risk_tier TEXT NOT NULL DEFAULT 'high_risk' CHECK (risk_tier IN (
        'high_risk',    -- 0-40:  browse only, no transactions
        'medium_risk',  -- 41-65: circles ≤$100, no withdrawals
        'lower_risk',   -- 66-80: circles ≤$300, withdrawals ≤$200, full KYC in 30d
        'low_risk'      -- 81-100: circles ≤$500, standard withdrawals, full KYC in 60d
    )),

    -- Individual signal scores (each 0-100, weighted into overall)
    email_score INTEGER NOT NULL DEFAULT 0,
    phone_score INTEGER NOT NULL DEFAULT 0,
    device_score INTEGER NOT NULL DEFAULT 0,
    referral_score INTEGER NOT NULL DEFAULT 0,
    profile_score INTEGER NOT NULL DEFAULT 0,
    ip_geo_score INTEGER NOT NULL DEFAULT 0,
    social_score INTEGER NOT NULL DEFAULT 0,  -- Optional LinkedIn

    -- Signal breakdown (detailed per-signal data)
    signal_breakdown JSONB NOT NULL DEFAULT '{}',

    -- Signal metadata
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_domain TEXT,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_carrier_type TEXT CHECK (phone_carrier_type IN ('mobile', 'voip', 'landline', 'unknown')),
    device_fingerprint_id TEXT,
    device_stability TEXT CHECK (device_stability IN ('stable', 'moderate', 'unstable', 'vpn_detected', 'unknown')),
    referral_member_id UUID REFERENCES auth.users(id),
    referral_xn_score INTEGER,
    ip_country TEXT,
    ip_region TEXT,
    stated_country TEXT,
    stated_region TEXT,
    ip_match BOOLEAN,
    social_linkedin_verified BOOLEAN NOT NULL DEFAULT FALSE,
    profile_completeness_pct INTEGER NOT NULL DEFAULT 0,

    -- Tier limits (denormalized for fast gate checks)
    max_contribution_cents INTEGER NOT NULL DEFAULT 0,
    max_withdrawal_cents INTEGER NOT NULL DEFAULT 0,
    can_join_circles BOOLEAN NOT NULL DEFAULT FALSE,
    can_withdraw BOOLEAN NOT NULL DEFAULT FALSE,
    can_remit BOOLEAN NOT NULL DEFAULT FALSE,
    can_request_advance BOOLEAN NOT NULL DEFAULT FALSE,

    -- Expiration
    full_kyc_required_by TIMESTAMPTZ,
    score_expires_at TIMESTAMPTZ,

    -- Computation tracking
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recomputed_count INTEGER NOT NULL DEFAULT 0,
    last_signal_update TEXT,  -- Which signal triggered recomputation

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT kyc_fallback_scores_member_unique UNIQUE (member_id)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: kyc_fallback_signal_logs — Immutable log of signal evaluations
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_fallback_signal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    fallback_score_id UUID NOT NULL REFERENCES kyc_fallback_scores(id) ON DELETE CASCADE,

    signal_type TEXT NOT NULL CHECK (signal_type IN (
        'email', 'phone', 'device', 'referral', 'profile', 'ip_geo', 'social'
    )),
    signal_score INTEGER NOT NULL DEFAULT 0,
    signal_data JSONB NOT NULL DEFAULT '{}',  -- Raw signal data (redacted)
    previous_score INTEGER,
    score_delta INTEGER,

    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: kyc_escalation_triggers — Actions that force full KYC
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_escalation_triggers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'contribution_over_500',    -- Circle contribution > $500
        'withdrawal_over_500',      -- Withdrawal > $500
        'remittance_any',           -- Any remittance transaction
        'advance_request',          -- Any liquidity advance
        'tier_deadline_expired',    -- Fallback tier deadline passed
        'sanctions_flag',           -- Sanctions screening triggered
        'aml_flag',                 -- AML rule triggered
        'admin_escalation'          -- Admin manual escalation
    )),
    trigger_details JSONB DEFAULT '{}',
    action_blocked BOOLEAN NOT NULL DEFAULT TRUE,  -- Was the action blocked?
    member_notified BOOLEAN NOT NULL DEFAULT FALSE,

    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: kyc_decline_reasons — Structured decline taxonomy for ML labeling
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_decline_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kyc_verification_id UUID NOT NULL REFERENCES kyc_verifications(id) ON DELETE CASCADE,

    persona_code TEXT,                  -- Persona's raw code e.g. "id_expired"
    reason_category TEXT NOT NULL CHECK (reason_category IN (
        'document', 'identity', 'watchlist', 'technical', 'behavioral'
    )),
    reason_subcategory TEXT NOT NULL CHECK (reason_subcategory IN (
        -- Document
        'document_expired', 'document_quality', 'document_unsupported',
        'document_damaged', 'document_unreadable',
        -- Identity
        'liveness_failed', 'selfie_mismatch', 'name_mismatch',
        'dob_mismatch', 'duplicate_identity',
        -- Watchlist
        'ofac_match', 'pep_match', 'adverse_media', 'sanctions_match',
        -- Technical
        'session_timeout', 'upload_failed', 'provider_error',
        -- Behavioral
        'suspicious_speed', 'vpn_detected', 'geo_mismatch'
    )),
    is_permanent BOOLEAN NOT NULL DEFAULT FALSE, -- Can this be remediated by resubmitting?
    admin_decision TEXT CHECK (admin_decision IN (
        'approve_genuine',          -- Document authentic, verified
        'approve_alternate_doc',    -- Alternate evidence accepted
        'decline_suspected_fraud',  -- Deliberate deception
        'decline_document_quality', -- Insufficient quality, resubmit
        'decline_unsupported_doc',  -- Document type not accepted
        'decline_watchlist',        -- Sanctions/PEP confirmed
        'defer_awaiting_info'       -- Additional info requested
    )),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: kyc_experiment_metrics — A/B testing aggregation (daily cron)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kyc_experiment_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id TEXT NOT NULL,
    experiment_group TEXT NOT NULL,
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Funnel metrics
    attempts_initiated INTEGER NOT NULL DEFAULT 0,
    attempts_completed_tier2 INTEGER NOT NULL DEFAULT 0,
    attempts_completed_tier3 INTEGER NOT NULL DEFAULT 0,
    attempts_first_try_success INTEGER NOT NULL DEFAULT 0,
    attempts_manual_review INTEGER NOT NULL DEFAULT 0,
    abandonment_count INTEGER NOT NULL DEFAULT 0,

    -- Rates (computed)
    completion_rate NUMERIC(5,4) DEFAULT 0,
    first_try_success_rate NUMERIC(5,4) DEFAULT 0,
    manual_review_rate NUMERIC(5,4) DEFAULT 0,
    abandonment_rate NUMERIC(5,4) DEFAULT 0,

    -- Timing
    median_session_duration_seconds INTEGER,
    avg_session_duration_seconds INTEGER,

    -- Long-tail outcome (updated retroactively)
    verified_members_count INTEGER NOT NULL DEFAULT 0,
    members_defaulted_90d INTEGER NOT NULL DEFAULT 0,
    default_rate_90d NUMERIC(5,4),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT kyc_experiment_unique UNIQUE (experiment_id, experiment_group, metric_date)
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- kyc_verifications
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_member
    ON kyc_verifications(member_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status
    ON kyc_verifications(status)
    WHERE status NOT IN ('approved', 'rejected');
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_provider_inquiry
    ON kyc_verifications(provider_inquiry_id)
    WHERE provider_inquiry_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_deadline
    ON kyc_verifications(full_kyc_deadline)
    WHERE full_kyc_deadline IS NOT NULL AND status != 'approved';

-- kyc_documents
CREATE INDEX IF NOT EXISTS idx_kyc_documents_verification
    ON kyc_documents(verification_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_member
    ON kyc_documents(member_id);
CREATE INDEX IF NOT EXISTS idx_kyc_documents_hash
    ON kyc_documents(document_number_hash)
    WHERE document_number_hash IS NOT NULL;

-- kyc_provider_webhooks
CREATE INDEX IF NOT EXISTS idx_kyc_webhooks_inquiry
    ON kyc_provider_webhooks(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_kyc_webhooks_unprocessed
    ON kyc_provider_webhooks(received_at)
    WHERE processed = FALSE;

-- kyc_admin_reviews
CREATE INDEX IF NOT EXISTS idx_kyc_admin_reviews_verification
    ON kyc_admin_reviews(verification_id);
CREATE INDEX IF NOT EXISTS idx_kyc_admin_reviews_pending
    ON kyc_admin_reviews(priority DESC, created_at ASC)
    WHERE status IN ('pending', 'in_review');
CREATE INDEX IF NOT EXISTS idx_kyc_admin_reviews_member
    ON kyc_admin_reviews(member_id);

-- kyc_fallback_scores
CREATE INDEX IF NOT EXISTS idx_kyc_fallback_scores_member
    ON kyc_fallback_scores(member_id);
CREATE INDEX IF NOT EXISTS idx_kyc_fallback_scores_tier
    ON kyc_fallback_scores(risk_tier);
CREATE INDEX IF NOT EXISTS idx_kyc_fallback_scores_expiring
    ON kyc_fallback_scores(full_kyc_required_by)
    WHERE full_kyc_required_by IS NOT NULL;

-- kyc_fallback_signal_logs
CREATE INDEX IF NOT EXISTS idx_kyc_signal_logs_member
    ON kyc_fallback_signal_logs(member_id, evaluated_at DESC);
CREATE INDEX IF NOT EXISTS idx_kyc_signal_logs_fallback
    ON kyc_fallback_signal_logs(fallback_score_id);

-- kyc_escalation_triggers
CREATE INDEX IF NOT EXISTS idx_kyc_escalation_member
    ON kyc_escalation_triggers(member_id, triggered_at DESC);

-- kyc_decline_reasons
CREATE INDEX IF NOT EXISTS idx_kyc_decline_verification
    ON kyc_decline_reasons(kyc_verification_id);
CREATE INDEX IF NOT EXISTS idx_kyc_decline_category
    ON kyc_decline_reasons(reason_category, reason_subcategory);

-- kyc_experiment_metrics
CREATE INDEX IF NOT EXISTS idx_kyc_experiment_lookup
    ON kyc_experiment_metrics(experiment_id, experiment_group, metric_date DESC);


-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_provider_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_admin_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_fallback_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_fallback_signal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_escalation_triggers ENABLE ROW LEVEL SECURITY;

-- Members can view their own KYC status (but not raw provider data)
CREATE POLICY "kyc_verifications_member_select" ON kyc_verifications
    FOR SELECT USING (auth.uid() = member_id);

-- Members can view their own documents
CREATE POLICY "kyc_documents_member_select" ON kyc_documents
    FOR SELECT USING (auth.uid() = member_id);

-- Members can view their own fallback score
CREATE POLICY "kyc_fallback_member_select" ON kyc_fallback_scores
    FOR SELECT USING (auth.uid() = member_id);

-- Members can view their own escalation triggers
CREATE POLICY "kyc_escalation_member_select" ON kyc_escalation_triggers
    FOR SELECT USING (auth.uid() = member_id);

-- Service role: full access on all KYC tables
CREATE POLICY "kyc_verifications_service_all" ON kyc_verifications
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "kyc_documents_service_all" ON kyc_documents
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "kyc_webhooks_service_all" ON kyc_provider_webhooks
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "kyc_admin_reviews_service_all" ON kyc_admin_reviews
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "kyc_fallback_service_all" ON kyc_fallback_scores
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "kyc_signal_logs_service_all" ON kyc_fallback_signal_logs
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "kyc_escalation_service_all" ON kyc_escalation_triggers
    FOR ALL USING (auth.role() = 'service_role');

-- Decline reasons + experiment metrics: service only
ALTER TABLE kyc_decline_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_experiment_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kyc_decline_reasons_service_all" ON kyc_decline_reasons
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "kyc_experiment_metrics_service_all" ON kyc_experiment_metrics
    FOR ALL USING (auth.role() = 'service_role');

-- Admin access: circle_members with admin role can view reviews
CREATE POLICY "kyc_admin_reviews_admin_select" ON kyc_admin_reviews
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM circle_members
            WHERE circle_members.user_id = auth.uid()
            AND circle_members.role = 'admin'
        )
    );


-- ═══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE kyc_verifications;
ALTER PUBLICATION supabase_realtime ADD TABLE kyc_fallback_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE kyc_admin_reviews;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_kyc_verifications_updated_at
    BEFORE UPDATE ON kyc_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_kyc_admin_reviews_updated_at
    BEFORE UPDATE ON kyc_admin_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_kyc_fallback_scores_updated_at
    BEFORE UPDATE ON kyc_fallback_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: Sync approved KYC tier to profiles table (fast-lookup column)
-- When kyc_verifications.status → 'approved', sync kyc_tier to profiles
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION sync_kyc_tier_to_profile()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
        UPDATE profiles
        SET kyc_tier = NEW.kyc_tier,
            kyc_verified_at = NOW()
        WHERE id = NEW.member_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_kyc_tier_to_profile
    AFTER UPDATE ON kyc_verifications
    FOR EACH ROW EXECUTE FUNCTION sync_kyc_tier_to_profile();
