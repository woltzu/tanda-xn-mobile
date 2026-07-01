-- ═══════════════════════════════════════════════════════════════════════════
-- 282_user_feedback.sql
--
-- Bucket 11 — unified feedback (bugs + ideas).
--
-- Spec deviation (also in commit body): the spec proposed a NEW
-- `user_feedback` table parallel to `bug_reports` (mig 273). We extend
-- the existing table instead. Reasons:
--   • The schema overlap is ~80% (user_id, screen_name, description,
--     screenshot_url, device_info, app_version, status, admin_notes,
--     created_at). Five new columns cover the spec's ideas-specific
--     fields (type, title, category, help_why, votes).
--   • Existing rows backfill to type='bug' — no data loss, no
--     transition period, no orphaned legacy queue.
--   • Reuses the existing `bug-screenshots` private bucket + storage RLS
--     wired in mig 273 — no parallel bucket to provision.
--   • A single `AdminBugReports*` screen pair gains a type filter chip;
--     no duplicated admin module to maintain.
-- Net diff: ~25 lines of ALTER vs. ~120 lines of CREATE + duplicated
-- policies + duplicated storage setup.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. New columns ────────────────────────────────────────────────────────
ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS type     TEXT    NOT NULL DEFAULT 'bug',
  ADD COLUMN IF NOT EXISTS title    TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS help_why TEXT,
  ADD COLUMN IF NOT EXISTS votes    INTEGER NOT NULL DEFAULT 0;

-- ─── 2. CHECK constraints ──────────────────────────────────────────────────
-- type: 'bug' | 'idea'. Drop-then-recreate so re-runs are safe.
ALTER TABLE public.bug_reports DROP CONSTRAINT IF EXISTS bug_reports_type_check;
ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_type_check
  CHECK (type IN ('bug', 'idea'));

-- category: open-ended NULL allowed (bugs don't always have one), but
-- when set must be one of the known buckets so admin filtering stays
-- enumerable.
ALTER TABLE public.bug_reports DROP CONSTRAINT IF EXISTS bug_reports_category_check;
ALTER TABLE public.bug_reports
  ADD CONSTRAINT bug_reports_category_check
  CHECK (
    category IS NULL
    OR category IN ('circle', 'trip', 'payments', 'ux', 'new_feature', 'other')
  );

-- ─── 3. Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bug_reports_type     ON public.bug_reports(type);
CREATE INDEX IF NOT EXISTS idx_bug_reports_category
  ON public.bug_reports(category) WHERE category IS NOT NULL;

-- ─── 4. Self-register ──────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '282',
  'user_feedback',
  ARRAY['-- 282: user_feedback']
)
ON CONFLICT (version) DO NOTHING;
