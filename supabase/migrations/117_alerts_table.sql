-- ============================================================================
-- Migration 117: alerts table for the cron-monitor EF
-- ============================================================================
-- Step 3 of production hardening. The cron-monitor EF (added in this
-- phase) runs hourly, scans cron_job_logs, and emits one row per
-- detected condition into public.alerts. Future destinations (Slack,
-- Discord, email) will read from this table -- the table is the queue
-- + history, not the transport.
--
-- Schema:
--   id              uuid pk
--   alert_type      text   ('cron_failure' | 'cron_missed_run' |
--                           'cron_partial' | ...)
--   severity        text   ('info' | 'warning' | 'critical')
--   source          text   the job_name (or other producer key) the
--                          alert is "about" -- forms the dedup key
--                          together with alert_type + status='open'
--   title           text   short headline
--   body            text   human-readable detail
--   details         jsonb  raw context (last log id, observed window,
--                          expected interval, etc.)
--   status          text   ('open' | 'acknowledged' | 'resolved')
--   created_at      timestamptz
--   acknowledged_at timestamptz
--   acknowledged_by uuid   profiles.id of the admin who acked
--   resolved_at     timestamptz
--
-- Dedup contract: a producer should not insert a new 'open' alert if an
-- 'open' row with the same (alert_type, source) already exists. The
-- partial unique index below enforces this at the DB level so a
-- misbehaving producer can't flood the table with duplicates.
--
-- RLS:
--   service_role -> ALL (cron-monitor + any future EFs write here)
--   authenticated admins (via public.is_admin from migration 114)
--                -> SELECT + UPDATE (so admins can acknowledge/resolve
--                   from a future ops UI)
--   anon/regular users -> no access
-- ============================================================================


CREATE TABLE IF NOT EXISTS public.alerts (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type      TEXT         NOT NULL,
  severity        TEXT         NOT NULL
                               CHECK (severity IN ('info', 'warning', 'critical')),
  source          TEXT         NOT NULL,
  title           TEXT         NOT NULL,
  body            TEXT,
  details         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT         NOT NULL DEFAULT 'open'
                               CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ
);

-- Browse-recent + open-only views
CREATE INDEX IF NOT EXISTS idx_alerts_status_created
  ON public.alerts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_source_created
  ON public.alerts (source, created_at DESC);

-- Dedup: a single open alert per (alert_type, source). Subsequent
-- producer runs that observe the same condition should treat the
-- failed insert as expected and skip, rather than spamming.
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_one_open_per_source
  ON public.alerts (alert_type, source)
  WHERE status = 'open';


-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_alerts"   ON public.alerts;
CREATE POLICY "service_role_all_alerts"
  ON public.alerts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "admins_read_alerts"        ON public.alerts;
CREATE POLICY "admins_read_alerts"
  ON public.alerts
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "admins_update_alerts"      ON public.alerts;
CREATE POLICY "admins_update_alerts"
  ON public.alerts
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('117', 'alerts_table',
        ARRAY['-- 117: alerts table + RLS for cron-monitor EF'])
ON CONFLICT (version) DO NOTHING;
