-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 273: bug_reports
-- ═══════════════════════════════════════════════════════════════════════════
--
-- In-app bug reporting. Floating button (BugReportButton) opens a modal
-- that captures screen name + description + optional screenshot + device
-- info, and inserts a row here.
--
-- RLS:
--   * INSERT — must be your own row (auth.uid() = user_id)
--   * SELECT — your own rows OR admin (via admin_users)
--   * UPDATE — admin only (status / admin_notes / resolved_at)
--
-- Storage bucket `bug-screenshots` is created private. Users upload to
-- their own UID-prefixed folder; only admins (or the original
-- uploader) can read. URLs stored on the row are short-lived signed
-- URLs created at upload time (consistent with AvatarPicker).
--
-- Spec deviations (also in commit body):
--   * Registry insert targets supabase_migrations.schema_migrations
--     (per CLAUDE.md; spec used the wrong table name).
--   * Added a permissive UPDATE policy for admins so triage tooling
--     can move status from 'open' → 'in_progress' → 'resolved'
--     without a separate RPC.
--   * Added storage bucket + storage.objects RLS so the spec's
--     "upload screenshot to Supabase Storage" line is actually
--     wired end-to-end (the spec didn't enumerate this).
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Table
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  screen_name TEXT NOT NULL,
  description TEXT NOT NULL,
  screenshot_url TEXT,
  device_info JSONB,
  app_version TEXT,
  status TEXT DEFAULT 'open',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CHECK constraint via drop-then-recreate so re-runs are safe.
ALTER TABLE bug_reports DROP CONSTRAINT IF EXISTS bug_reports_status_check;
ALTER TABLE bug_reports
  ADD CONSTRAINT bug_reports_status_check
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);

-- 3. RLS
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bug_reports_insert ON bug_reports;
CREATE POLICY bug_reports_insert ON bug_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS bug_reports_select_own ON bug_reports;
CREATE POLICY bug_reports_select_own ON bug_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS bug_reports_select_admin ON bug_reports;
CREATE POLICY bug_reports_select_admin ON bug_reports
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
     WHERE user_id = auth.uid() AND is_active = true
  ));

DROP POLICY IF EXISTS bug_reports_update_admin ON bug_reports;
CREATE POLICY bug_reports_update_admin ON bug_reports
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM admin_users
     WHERE user_id = auth.uid() AND is_active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM admin_users
     WHERE user_id = auth.uid() AND is_active = true
  ));

-- 4. Storage bucket — private; signed URLs only.
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-screenshots', 'bug-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS — uploads go to <uid>/<filename> so the foldername check
-- enforces "only upload into your own folder".
DROP POLICY IF EXISTS bug_screenshots_insert ON storage.objects;
CREATE POLICY bug_screenshots_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bug-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS bug_screenshots_select_own ON storage.objects;
CREATE POLICY bug_screenshots_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bug-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS bug_screenshots_select_admin ON storage.objects;
CREATE POLICY bug_screenshots_select_admin ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bug-screenshots'
    AND EXISTS (
      SELECT 1 FROM admin_users
       WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 5. Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '273',
  'bug_reports',
  ARRAY['-- 273: bug_reports']
)
ON CONFLICT (version) DO NOTHING;
