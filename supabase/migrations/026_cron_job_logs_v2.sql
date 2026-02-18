-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 026 v2: Cron Job Logs Table (Safe Version)
-- ══════════════════════════════════════════════════════════════════════════════
-- Creates tables with conflict handling
-- ══════════════════════════════════════════════════════════════════════════════

-- Drop existing views if they exist
DROP VIEW IF EXISTS v_cron_job_stats CASCADE;
DROP VIEW IF EXISTS v_recent_cron_jobs CASCADE;

-- Drop and recreate cron_job_logs table to ensure correct schema
DROP TABLE IF EXISTS cron_job_logs CASCADE;

CREATE TABLE cron_job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'running')),
    records_processed INTEGER DEFAULT 0,
    records_succeeded INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    execution_time_ms INTEGER,
    details JSONB DEFAULT '{}',
    error_message TEXT,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_cron_job_logs_job_name ON cron_job_logs(job_name);
CREATE INDEX idx_cron_job_logs_created_at ON cron_job_logs(created_at DESC);
CREATE INDEX idx_cron_job_logs_status ON cron_job_logs(status);

-- Enable RLS
ALTER TABLE cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "cron_job_logs_service_only" ON cron_job_logs;
DROP POLICY IF EXISTS "cron_job_logs_read" ON cron_job_logs;

CREATE POLICY "cron_job_logs_service_only" ON cron_job_logs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "cron_job_logs_read" ON cron_job_logs
    FOR SELECT TO authenticated USING (true);

-- Views
CREATE VIEW v_cron_job_stats AS
SELECT
    job_name,
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE status = 'success') as successful_runs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
    COUNT(*) FILTER (WHERE status = 'partial') as partial_runs,
    AVG(execution_time_ms) as avg_execution_time_ms,
    MAX(created_at) as last_run_at
FROM cron_job_logs
GROUP BY job_name;

CREATE VIEW v_recent_cron_jobs AS
SELECT id, job_name, status, records_processed, records_succeeded,
       records_failed, execution_time_ms, error_message, created_at
FROM cron_job_logs
ORDER BY created_at DESC
LIMIT 100;

-- Notifications table
DROP TABLE IF EXISTS notifications CASCADE;

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_own_select" ON notifications;
DROP POLICY IF EXISTS "notifications_own_update" ON notifications;
DROP POLICY IF EXISTS "notifications_service_insert" ON notifications;

CREATE POLICY "notifications_own_select" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_own_update" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_service_insert" ON notifications
    FOR INSERT WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 026 v2
-- ══════════════════════════════════════════════════════════════════════════════
