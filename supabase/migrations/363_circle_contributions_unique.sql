-- ═══════════════════════════════════════════════════════════════════════════
-- 363_circle_contributions_unique.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Enforce one paid contribution per (circle_id, user_id, cycle_number)
-- at the DB layer. Prior to this a Stripe race or client retry could
-- create duplicate paid rows for the same member+cycle — surfaced by
-- the 2026-07-14 dedupe (12 dupe rows across 4 circles, ~$1,500 in
-- captured Stripe money that needed manual refunds).
--
-- Partial index scoped to status='paid' — pending/failed rows can
-- accumulate (a retry cycle before success), only the terminal 'paid'
-- status is uniqueness-constrained.
--
-- Prereq: no existing dupes in the paid status. Verified before apply
-- via `SELECT circle_id, user_id, cycle_number FROM circle_contributions
--       WHERE status='paid' GROUP BY 1,2,3 HAVING COUNT(*) > 1`
-- returning 0 rows on 2026-07-19.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS one_paid_contribution_per_member_cycle
  ON public.circle_contributions (circle_id, user_id, cycle_number)
  WHERE status = 'paid';

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '363',
  'circle_contributions_unique',
  ARRAY['-- 363: partial unique index preventing duplicate paid contributions']
)
ON CONFLICT (version) DO NOTHING;
