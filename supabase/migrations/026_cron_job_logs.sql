-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 026: Cron Job Logs Table
-- ══════════════════════════════════════════════════════════════════════════════
-- Creates a table to track edge function/cron job executions
-- ══════════════════════════════════════════════════════════════════════════════

-- Create cron job logs table
CREATE TABLE IF NOT EXISTS cron_job_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job identification
    job_name TEXT NOT NULL,

    -- Execution status
    status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed', 'running')),

    -- Processing metrics
    records_processed INTEGER DEFAULT 0,
    records_succeeded INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    execution_time_ms INTEGER,

    -- Details (JSON for flexible storage)
    details JSONB DEFAULT '{}',
    error_message TEXT,

    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying by job name and time
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_job_name ON cron_job_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_created_at ON cron_job_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_job_logs_status ON cron_job_logs(status);

-- Enable RLS
ALTER TABLE cron_job_logs ENABLE ROW LEVEL SECURITY;

-- Only allow service role to insert/update
CREATE POLICY "cron_job_logs_service_only" ON cron_job_logs
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Allow authenticated users to read (for admin dashboards)
CREATE POLICY "cron_job_logs_read" ON cron_job_logs
    FOR SELECT
    TO authenticated
    USING (true);

-- Create a view for job statistics
CREATE OR REPLACE VIEW v_cron_job_stats AS
SELECT
    job_name,
    COUNT(*) as total_runs,
    COUNT(*) FILTER (WHERE status = 'success') as successful_runs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_runs,
    COUNT(*) FILTER (WHERE status = 'partial') as partial_runs,
    AVG(execution_time_ms) as avg_execution_time_ms,
    MAX(created_at) as last_run_at,
    MAX(CASE WHEN status = 'success' THEN created_at END) as last_success_at,
    MAX(CASE WHEN status = 'failed' THEN created_at END) as last_failure_at
FROM cron_job_logs
GROUP BY job_name;

-- Create a view for recent job runs
CREATE OR REPLACE VIEW v_recent_cron_jobs AS
SELECT
    id,
    job_name,
    status,
    records_processed,
    records_succeeded,
    records_failed,
    execution_time_ms,
    error_message,
    created_at
FROM cron_job_logs
ORDER BY created_at DESC
LIMIT 100;

-- Add notifications table if it doesn't exist (for swap request expiration notifications)
CREATE TABLE IF NOT EXISTS notifications (
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

-- Index for user notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

-- Enable RLS on notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "notifications_own_select" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_own_update" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Service role can insert notifications
CREATE POLICY "notifications_service_insert" ON notifications
    FOR INSERT WITH CHECK (auth.role() = 'service_role' OR auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- END OF MIGRATION 026
-- ══════════════════════════════════════════════════════════════════════════════
