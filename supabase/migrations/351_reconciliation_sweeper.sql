-- ════════════════════════════════════════════════════════════════════════════
-- Migration 351: reconciliation_sweeper
-- ════════════════════════════════════════════════════════════════════════════
--
-- Two things in one migration:
--   1. Create reconciliation_log — append-only diagnostic surface for the
--      hourly reconciliation-sweeper Edge Function to write anomalies into.
--   2. Register the hourly cron that fires the sweeper.
--
-- The sweeper itself (supabase/functions/reconciliation-sweeper/index.ts)
-- does two passes:
--
--   A. Local cross-checks — no Stripe API calls, cheap:
--      * pending_intents older than 1h with no matching ledger_events row
--        (via external_reference_id + external_reference_type='pending_intent')
--        → discrepancy 'stale_pending_intent'.
--      * stripe_payment_intents with status='succeeded' > 1h ago that don't
--        have a corresponding ledger_events row for the PI
--        → discrepancy 'pi_ledger_missing'.
--
--   B. Stripe API pull — paranoid, catches webhook drops:
--      * Stripe PaymentIntents in last 24h with status='succeeded' that are
--        NOT in stripe_payment_intents locally
--        → discrepancy 'stripe_pi_missing_locally'.
--      * Stripe Transfers in last 24h with status='paid' that are NOT in
--        stripe_transfers locally
--        → discrepancy 'stripe_transfer_missing_locally'.
--      * PIs where Stripe's amount != stripe_payment_intents.amount_cents
--        → discrepancy 'amount_mismatch'.
--
-- Cron schedule: '0 * * * *' (every hour at :00 UTC). Aligns with the
-- 24h scan window so consecutive runs overlap by 23h — the same
-- discrepancy will surface each run until resolved, which is by design
-- (an unresolved break in the ledger should keep pinging the log until
-- someone acts on it). Row-level idempotency on the log side: each write
-- keys on (discrepancy_type, stripe_id) — new occurrences are inserted,
-- repeat occurrences get their run_at bumped by an ON CONFLICT DO UPDATE.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. reconciliation_log ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reconciliation_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  discrepancy_type  TEXT NOT NULL CHECK (discrepancy_type IN (
                      'stale_pending_intent',
                      'pi_ledger_missing',
                      'stripe_pi_missing_locally',
                      'stripe_transfer_missing_locally',
                      'amount_mismatch'
                    )),
  stripe_id         TEXT,        -- pi_… / tr_… / re_… — null for local-only kinds
  local_id          UUID,        -- id of the local record (pending_intents,
                                 --  stripe_payment_intents, etc.) if found
  severity          TEXT NOT NULL DEFAULT 'warning'
                    CHECK (severity IN ('info','warning','critical')),
  details           JSONB DEFAULT '{}',
  resolved          BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolution_note   TEXT,
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurrence_count  INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Same discrepancy seen across multiple sweeper runs collapses to one
-- row so an ops dashboard shows N=1 unresolved break, not N=24. The
-- COALESCE keeps rows for local-only kinds (stripe_id NULL) unique on
-- (discrepancy_type, local_id). Expression-based uniqueness needs a
-- separate UNIQUE INDEX — Postgres doesn't allow expressions inside a
-- table-level UNIQUE constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliation_log_dedupe
  ON public.reconciliation_log
  (discrepancy_type, COALESCE(stripe_id, local_id::text));

CREATE INDEX IF NOT EXISTS idx_reconciliation_log_run_at
  ON public.reconciliation_log (run_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_unresolved
  ON public.reconciliation_log (resolved, severity, run_at DESC)
  WHERE resolved = FALSE;

ALTER TABLE public.reconciliation_log ENABLE ROW LEVEL SECURITY;

-- Service-role only. Admin dashboards should read via a SECURITY DEFINER
-- RPC that filters by role — putting ops-facing PII (Stripe ids, user
-- ids) behind a broader RLS policy is out of scope for this migration.
DROP POLICY IF EXISTS reconciliation_log_service_all
  ON public.reconciliation_log;
CREATE POLICY reconciliation_log_service_all
  ON public.reconciliation_log
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ─── 2. Cron schedule ────────────────────────────────────────────────────
-- Mirrors mig 232 / 348 vault-secret pattern. Defensive
-- unschedule-then-schedule so the migration is re-runnable.

SELECT cron.unschedule('reconciliation_sweeper_hourly')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'reconciliation_sweeper_hourly'
 );

SELECT cron.schedule(
  'reconciliation_sweeper_hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/reconciliation-sweeper',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '351',
  'reconciliation_sweeper',
  ARRAY['-- 351: reconciliation_log table + hourly sweeper cron']
)
ON CONFLICT (version) DO NOTHING;
