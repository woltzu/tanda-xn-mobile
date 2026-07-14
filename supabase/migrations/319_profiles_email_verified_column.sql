-- ═══════════════════════════════════════════════════════════════════════════
-- 319_profiles_email_verified_column.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Adds the missing `email_verified` column to `public.profiles`, which
-- calculate_initial_xnscore already reads (v_profile.email_verified in
-- three places) and xnscore_initial_signals.email_verified stores. The
-- absence of this column has caused every contribution/goal/circle
-- insert path that touches update_financial_activity → calculate_
-- initial_xnscore to throw 42703 for months — mig 307 wrapped the
-- caller in EXCEPTION to keep money movement flowing, but the score
-- itself never actually updated.
--
-- Approach: add the column with default false. XnScore's per-user
-- initial calculation will now run cleanly. Backfill logic (deriving
-- true from auth.users.email_confirmed_at) is out of scope for this
-- migration — the default false keeps XnScore honest until an explicit
-- verification event flips it.
--
-- No function change needed — calculate_initial_xnscore already
-- references v_profile.email_verified, and once the column exists the
-- expression resolves correctly. The safety-net EXCEPTION in mig 307's
-- trigger_contribution_activity stays in place as belt-and-suspenders
-- for any future analytics-side drift.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '319',
  'profiles_email_verified_column',
  ARRAY['-- 319: add profiles.email_verified boolean default false — unblocks calculate_initial_xnscore']
)
ON CONFLICT (version) DO NOTHING;
