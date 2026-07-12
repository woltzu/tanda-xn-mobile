-- ═══════════════════════════════════════════════════════════════════════════
-- 291_schedule_underfilled_check.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Wires migration 290's check_underfilled_circles() into pg_cron so
-- underfilled circles get their vote proposal without any manual
-- invocation.
--
-- Schedule: 02:00 UTC daily. Sits between the payout-reminder job
-- (09:00 UTC, migration 189) and the inactive-user cleanup job
-- (monthly, migration 119); nothing else runs at 02:00 UTC in the
-- project's job map, so we avoid piling three cron-owned txns on
-- top of each other.
--
-- Idempotent same way migrations 116 and 119 do it: an
-- unschedule() wrapped in a DO/EXCEPTION so a re-run is a no-op
-- when the job already exists, then a fresh cron.schedule().
--
-- Difference from migrations 189 / 119: those crons fire an EF via
-- net.http_post(). This one runs the RPC directly — it's plain SQL
-- (a scan + a few inserts) with no external side effects, so the
-- extra EF hop and vault lookup buys nothing.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$ BEGIN PERFORM cron.unschedule('check-underfilled-circles');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'check-underfilled-circles',
  '0 2 * * *',                        -- daily at 02:00 UTC
  'SELECT public.check_underfilled_circles();'
);

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '291',
  'schedule_underfilled_check',
  ARRAY['-- 291: schedule_underfilled_check']
)
ON CONFLICT (version) DO NOTHING;
