-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 055: Mock-to-Real Migration Priority Scoring (#193)
-- ══════════════════════════════════════════════════════════════════════════════
-- Tracks every UI screen's migration from mock/hardcoded data to real Supabase
-- queries. Implements the 4-dimension scoring model:
--   Revenue Impact + Member Experience + Data Collection + Backend Readiness
-- Wave assignments: 16+ = Wave 1, 12-15 = Wave 2, <12 = Wave 3
-- ══════════════════════════════════════════════════════════════════════════════

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  A. MIGRATION SCREENS MASTER TABLE                                     │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS migration_screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screen_code TEXT NOT NULL UNIQUE,               -- e.g. 'CIRC-401', 'DASH-001'
    screen_name TEXT NOT NULL,                       -- e.g. 'Make Payment', 'Home Dashboard'
    module TEXT NOT NULL,                            -- e.g. 'Circles', 'Dashboard', 'Elder', 'Community', 'Goals', 'Loans'

    -- 4-dimension scoring (1-5 each)
    revenue_impact SMALLINT NOT NULL DEFAULT 1 CHECK (revenue_impact BETWEEN 1 AND 5),
    member_experience SMALLINT NOT NULL DEFAULT 1 CHECK (member_experience BETWEEN 1 AND 5),
    data_collection SMALLINT NOT NULL DEFAULT 1 CHECK (data_collection BETWEEN 1 AND 5),
    backend_readiness SMALLINT NOT NULL DEFAULT 1 CHECK (backend_readiness BETWEEN 1 AND 5),

    -- Computed total & wave (auto-calculated by trigger)
    total_score SMALLINT GENERATED ALWAYS AS (revenue_impact + member_experience + data_collection + backend_readiness) STORED,
    wave SMALLINT GENERATED ALWAYS AS (
        CASE
            WHEN (revenue_impact + member_experience + data_collection + backend_readiness) >= 16 THEN 1
            WHEN (revenue_impact + member_experience + data_collection + backend_readiness) >= 12 THEN 2
            WHEN (revenue_impact + member_experience + data_collection + backend_readiness) >= 1 THEN 3
            ELSE 0
        END
    ) STORED,

    -- Migration status
    status TEXT NOT NULL DEFAULT 'mock' CHECK (status IN ('mock', 'in_progress', 'connected', 'verified', 'blocked')),
    blocked_reason TEXT,                             -- why it's blocked (e.g. 'table does not exist')

    -- Connection details
    connected_service TEXT,                          -- which service connects this screen
    connected_table TEXT,                            -- primary table being queried
    connected_hook TEXT,                             -- which hook bridges the data
    connection_notes TEXT,                           -- implementation notes

    -- Progress tracking
    started_at TIMESTAMPTZ,
    connected_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),

    -- Dependency tracking
    depends_on TEXT[],                               -- screen_codes this screen depends on

    -- Sort order within wave
    sort_order SMALLINT NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE migration_screens IS 'Tracks mock-to-real migration status for every UI screen (#193)';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  B. MIGRATION AUDIT LOG                                                │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS migration_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    screen_id UUID NOT NULL REFERENCES migration_screens(id) ON DELETE CASCADE,
    screen_code TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('status_change', 'score_update', 'dependency_added', 'note_added', 'verification')),
    old_value JSONB,
    new_value JSONB,
    performed_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE migration_audit_log IS 'Audit trail for migration screen status changes';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  C. WAVE COMPLETION TRACKING                                           │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS migration_wave_status (
    wave SMALLINT PRIMARY KEY CHECK (wave BETWEEN 1 AND 3),
    total_screens SMALLINT NOT NULL DEFAULT 0,
    connected_screens SMALLINT NOT NULL DEFAULT 0,
    verified_screens SMALLINT NOT NULL DEFAULT 0,
    blocked_screens SMALLINT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    target_completion DATE,
    notes TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE migration_wave_status IS 'Aggregate progress tracking per migration wave';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  D. INDEXES                                                            │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE INDEX idx_migration_screens_module ON migration_screens(module);
CREATE INDEX idx_migration_screens_status ON migration_screens(status);
CREATE INDEX idx_migration_screens_wave ON migration_screens(wave);
CREATE INDEX idx_migration_screens_total_score ON migration_screens(total_score DESC);
CREATE INDEX idx_migration_screens_module_wave ON migration_screens(module, wave);
CREATE INDEX idx_migration_audit_screen ON migration_audit_log(screen_id);
CREATE INDEX idx_migration_audit_code ON migration_audit_log(screen_code);
CREATE INDEX idx_migration_audit_created ON migration_audit_log(created_at DESC);

-- Partial indexes for active work
CREATE INDEX idx_migration_screens_in_progress ON migration_screens(wave, sort_order) WHERE status = 'in_progress';
CREATE INDEX idx_migration_screens_blocked ON migration_screens(module) WHERE status = 'blocked';
CREATE INDEX idx_migration_screens_mock ON migration_screens(wave, total_score DESC) WHERE status = 'mock';

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  E. TRIGGERS                                                           │
-- └──────────────────────────────────────────────────────────────────────────┘

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_migration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_migration_screens_updated_at
    BEFORE UPDATE ON migration_screens
    FOR EACH ROW
    EXECUTE FUNCTION update_migration_updated_at();

CREATE TRIGGER trg_migration_wave_status_updated_at
    BEFORE UPDATE ON migration_wave_status
    FOR EACH ROW
    EXECUTE FUNCTION update_migration_updated_at();

-- Auto-set timestamps on status changes
CREATE OR REPLACE FUNCTION handle_migration_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Set started_at when moving from mock to in_progress
    IF OLD.status = 'mock' AND NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
        NEW.started_at = NOW();
    END IF;

    -- Set connected_at when moving to connected
    IF NEW.status = 'connected' AND OLD.status != 'connected' AND NEW.connected_at IS NULL THEN
        NEW.connected_at = NOW();
    END IF;

    -- Set verified_at when moving to verified
    IF NEW.status = 'verified' AND OLD.status != 'verified' AND NEW.verified_at IS NULL THEN
        NEW.verified_at = NOW();
    END IF;

    -- Log the status change
    IF OLD.status != NEW.status THEN
        INSERT INTO migration_audit_log (screen_id, screen_code, action, old_value, new_value)
        VALUES (NEW.id, NEW.screen_code, 'status_change',
                jsonb_build_object('status', OLD.status),
                jsonb_build_object('status', NEW.status));
    END IF;

    -- Update wave status aggregates
    PERFORM refresh_wave_status();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_migration_status_change
    BEFORE UPDATE OF status ON migration_screens
    FOR EACH ROW
    EXECUTE FUNCTION handle_migration_status_change();

-- Function to refresh wave status aggregates
CREATE OR REPLACE FUNCTION refresh_wave_status()
RETURNS VOID AS $$
BEGIN
    INSERT INTO migration_wave_status (wave, total_screens, connected_screens, verified_screens, blocked_screens)
    SELECT
        ms.wave,
        COUNT(*)::SMALLINT,
        COUNT(*) FILTER (WHERE ms.status IN ('connected', 'verified'))::SMALLINT,
        COUNT(*) FILTER (WHERE ms.status = 'verified')::SMALLINT,
        COUNT(*) FILTER (WHERE ms.status = 'blocked')::SMALLINT
    FROM migration_screens ms
    WHERE ms.wave BETWEEN 1 AND 3
    GROUP BY ms.wave
    ON CONFLICT (wave) DO UPDATE SET
        total_screens = EXCLUDED.total_screens,
        connected_screens = EXCLUDED.connected_screens,
        verified_screens = EXCLUDED.verified_screens,
        blocked_screens = EXCLUDED.blocked_screens,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  F. ROW LEVEL SECURITY                                                 │
-- └──────────────────────────────────────────────────────────────────────────┘

ALTER TABLE migration_screens ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_screens FORCE ROW LEVEL SECURITY;
ALTER TABLE migration_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE migration_wave_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_wave_status FORCE ROW LEVEL SECURITY;

-- Authenticated users can read migration status (transparency)
CREATE POLICY migration_screens_authenticated_select ON migration_screens
    FOR SELECT TO authenticated USING (true);

CREATE POLICY migration_audit_authenticated_select ON migration_audit_log
    FOR SELECT TO authenticated USING (true);

CREATE POLICY migration_wave_authenticated_select ON migration_wave_status
    FOR SELECT TO authenticated USING (true);

-- Service role can do everything (for admin/backend)
CREATE POLICY migration_screens_service_all ON migration_screens
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY migration_audit_service_all ON migration_audit_log
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY migration_wave_service_all ON migration_wave_status
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  G. SEED DATA — MASTER PRIORITY RANKING                                │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Scores from the TandaXn Migration Priority Scoring document (April 2026)

INSERT INTO migration_screens (screen_code, screen_name, module, revenue_impact, member_experience, data_collection, backend_readiness, sort_order, status) VALUES
-- ═══ WAVE 1: Circles End-to-End (Score 16-19) ═══
('CIRC-401', 'Make Payment',            'Circles',    5, 5, 5, 4, 1,  'mock'),
('CIRC-402', 'Contribution History',    'Circles',    5, 5, 5, 4, 2,  'mock'),
('CIRC-301', 'Circle Dashboard',        'Circles',    5, 5, 5, 4, 3,  'mock'),
('CIRC-302', 'Member List',             'Circles',    5, 5, 4, 4, 4,  'mock'),
('CIRC-101', 'Browse Circles',          'Circles',    5, 5, 4, 4, 5,  'mock'),
('CIRC-201', 'Create Circle',           'Circles',    5, 5, 4, 4, 6,  'mock'),
('CIRC-403', 'Payout Schedule',         'Circles',    5, 5, 5, 3, 7,  'mock'),
('CIRC-404', 'Receive Payout',          'Circles',    5, 5, 4, 4, 8,  'mock'),
('DASH-001', 'Home Dashboard',          'Dashboard',  4, 5, 5, 3, 9,  'mock'),
('CIRC-102', 'Circle Detail',           'Circles',    4, 5, 4, 4, 10, 'mock'),
('CIRC-202', 'Set Schedule',            'Circles',    4, 5, 4, 4, 11, 'mock'),
('CIRC-405', 'Contribution Schedule',   'Circles',    4, 4, 5, 4, 12, 'mock'),
('CIRC-406', 'Payment Methods',         'Circles',    5, 4, 4, 4, 13, 'mock'),
('CIRC-303', 'Circle Chat',             'Circles',    3, 5, 4, 4, 14, 'mock'),
('CIRC-103', 'Join Circle',             'Circles',    5, 5, 3, 3, 15, 'mock'),

-- ═══ WAVE 2: Dashboard + Elder + Community (Score 12-15) ═══
('ELDER-003', 'Vouch Requests',         'Elder',      3, 5, 4, 3, 1,  'mock'),
('ELDER-002', 'Elder Dashboard',        'Elder',      3, 5, 4, 3, 2,  'mock'),
('ELDER-006', 'Mediation Cases',        'Elder',      3, 4, 4, 3, 3,  'mock'),
('CIRC-203',  'Invite Members',         'Circles',    4, 4, 3, 3, 4,  'mock'),
('CIRC-304',  'Circle Settings',        'Circles',    3, 4, 3, 4, 5,  'mock'),
('COMM-002',  'Referral Dashboard',     'Community',  4, 4, 4, 2, 6,  'mock'),
('COMM-003',  'Invite Friends',         'Community',  3, 4, 4, 3, 7,  'mock'),
('ELDER-004', 'Active Vouches',         'Elder',      3, 4, 4, 3, 8,  'mock'),
('DASH-004',  'Activity Feed',          'Dashboard',  3, 4, 4, 3, 9,  'mock'),
('ELDER-007', 'Mediation Chat',         'Elder',      3, 4, 3, 3, 10, 'mock'),
('ELDER-005', 'Apply to Vouch',         'Elder',      3, 4, 3, 3, 11, 'mock'),
('CIRC-204',  'Review and Confirm',     'Circles',    3, 4, 3, 3, 12, 'mock'),
('COMM-004',  'Share Link',             'Community',  3, 3, 4, 3, 13, 'mock'),
('COMM-007',  'Leaderboard',            'Community',  2, 4, 4, 3, 14, 'mock'),
('ELDER-008', 'Submit Ruling',          'Elder',      3, 4, 3, 3, 15, 'mock'),
('COMM-005',  'Referral Rewards',       'Community',  3, 3, 3, 3, 16, 'mock'),
('COMM-006',  'Referral History',       'Community',  2, 3, 4, 3, 17, 'mock'),

-- ═══ WAVE 3: Goals + Remaining (Score 7-11) ═══
('GOAL-001',  'Goals Dashboard',        'Goals',      2, 4, 4, 1, 1,  'mock'),
('GOAL-002',  'Goal Detail',            'Goals',      2, 4, 3, 1, 2,  'mock'),
('GOAL-003',  'Add New Goal',           'Goals',      2, 4, 3, 1, 3,  'mock'),
('COMM-008',  'Endorsements',           'Community',  2, 3, 3, 2, 4,  'mock'),
('GOAL-004',  'Edit Goal',              'Goals',      1, 3, 3, 1, 5,  'mock'),
('GOAL-005',  'Goal Progress',          'Goals',      1, 3, 3, 1, 6,  'mock'),
('GOAL-006',  'Milestones',             'Goals',      1, 3, 2, 1, 7,  'mock'),
('GOAL-T01',  'Goal Tiers',             'Goals',      2, 2, 2, 1, 8,  'mock'),
('COMM-001',  'Community Hub',          'Community',  1, 3, 2, 2, 9,  'mock'),
('COMM-009',  'Activity Feed',          'Community',  1, 2, 3, 2, 10, 'mock'),
('DASH-002',  'Notifications List',     'Dashboard',  1, 3, 3, 1, 11, 'mock')

ON CONFLICT (screen_code) DO NOTHING;

-- ═══ BLOCKED: Loans (pending table audit) ═══
INSERT INTO migration_screens (screen_code, screen_name, module, revenue_impact, member_experience, data_collection, backend_readiness, sort_order, status, blocked_reason) VALUES
('LOAN-ALL', 'All Loan Screens (20)', 'Loans', 1, 1, 1, 1, 1, 'blocked', 'Loans table audit (#196) must complete first. All 20 loan screens deferred until basic CRUD confirmed.')
ON CONFLICT (screen_code) DO NOTHING;

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  H. DEPENDENCY TRACKING                                                │
-- └──────────────────────────────────────────────────────────────────────────┘
-- Set dependencies per the spec: no lower wave starts until higher wave completes

UPDATE migration_screens SET depends_on = ARRAY['CIRC-101'] WHERE screen_code = 'CIRC-102';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-102'] WHERE screen_code = 'CIRC-103';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-103'] WHERE screen_code = 'CIRC-201';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-201'] WHERE screen_code = 'CIRC-202';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-202'] WHERE screen_code = 'CIRC-203';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-103', 'CIRC-201'] WHERE screen_code = 'CIRC-301';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-301'] WHERE screen_code = 'CIRC-302';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-301'] WHERE screen_code = 'CIRC-303';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-301'] WHERE screen_code = 'CIRC-304';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-301'] WHERE screen_code = 'CIRC-401';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-401'] WHERE screen_code = 'CIRC-402';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-301'] WHERE screen_code = 'CIRC-403';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-403'] WHERE screen_code = 'CIRC-404';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-301'] WHERE screen_code = 'CIRC-405';
UPDATE migration_screens SET depends_on = ARRAY['CIRC-401'] WHERE screen_code = 'CIRC-406';

-- Initialize wave status
SELECT refresh_wave_status();

-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │  I. HELPER VIEWS                                                       │
-- └──────────────────────────────────────────────────────────────────────────┘

CREATE OR REPLACE VIEW migration_dashboard AS
SELECT
    wave,
    module,
    screen_code,
    screen_name,
    total_score,
    status,
    sort_order,
    connected_service,
    connected_table,
    CASE
        WHEN status = 'verified' THEN '100%'
        WHEN status = 'connected' THEN '75%'
        WHEN status = 'in_progress' THEN '25%'
        WHEN status = 'blocked' THEN 'BLOCKED'
        ELSE '0%'
    END AS progress,
    started_at,
    connected_at,
    verified_at,
    depends_on,
    blocked_reason
FROM migration_screens
ORDER BY wave ASC, sort_order ASC;

CREATE OR REPLACE VIEW migration_summary AS
SELECT
    wave,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE status = 'mock') AS mock,
    COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
    COUNT(*) FILTER (WHERE status = 'connected') AS connected,
    COUNT(*) FILTER (WHERE status = 'verified') AS verified,
    COUNT(*) FILTER (WHERE status = 'blocked') AS blocked,
    ROUND(
        COUNT(*) FILTER (WHERE status IN ('connected', 'verified'))::NUMERIC / NULLIF(COUNT(*), 0) * 100, 1
    ) AS completion_pct
FROM migration_screens
GROUP BY wave
ORDER BY wave;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE migration_screens;
