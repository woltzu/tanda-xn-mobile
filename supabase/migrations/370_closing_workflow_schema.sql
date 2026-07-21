-- ═══════════════════════════════════════════════════════════════════════════
-- 370_closing_workflow_schema.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 38 — schema foundation for circle closing + correction workflow.
--
-- Two extensions:
--
--   1. circles.status CHECK gains 'payout_complete' and 'closed'.
--      payout_complete = all payouts done, not yet verified.
--      closed          = verified, immutable (mig 372 trigger enforces).
--      Existing values (forming/pending/active/paused/completed/cancelled)
--      preserved.
--
--   2. circles.closed_at TIMESTAMPTZ — nullable, stamped by close_circle
--      RPC (mig 371). Distinct from existing completed_at (which is set
--      when the last cycle pays out — the app's lifecycle signal).
--      closed_at is the accounting-verified signal.
--
-- No schema change on ledger_events:
--   * event_type has no CHECK constraint (verified live). New values
--     'correction', 'circle.closed', 'circle.reopened' just get
--     documented in the column comment.
--   * stripe_event_id UNIQUE NOT NULL is preserved. Correction events
--     (mig 371) use synthetic IDs of the form 'internal:correction:<uuid>'
--     to satisfy the constraint without a schema change.
--   * stripe_object_id NOT NULL is preserved. Corrections use
--     'internal:correction:<original_event_id>' for traceability
--     (not-unique so chained corrections don't conflict).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. closed_at column ─────────────────────────────────────────────────

ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.circles.closed_at IS
  'Accounting close timestamp. Set by close_circle (mig 371) when the '
  'closing invariant balances. Distinct from completed_at (which is set '
  'when the last cycle pays out). Cleared by reopen_circle.';

-- ─── 2. Extend circles.status CHECK ──────────────────────────────────────
-- DROP + ADD (Postgres has no ADD-value-to-CHECK). Constraint name is the
-- Postgres default 'circles_status_check' (verified live).

ALTER TABLE public.circles
  DROP CONSTRAINT IF EXISTS circles_status_check;

ALTER TABLE public.circles
  ADD CONSTRAINT circles_status_check
  CHECK (status IN (
    'forming',
    'pending',
    'active',
    'paused',
    'completed',
    'cancelled',
    'payout_complete',
    'closed'
  ));

COMMENT ON COLUMN public.circles.status IS
  'Circle lifecycle. Values: forming | pending | active | paused | '
  'completed | cancelled | payout_complete | closed. The last two are '
  'Doc 38 additions — payout_complete = all payouts done, awaiting '
  'accounting verification; closed = verified, immutable (mig 372 '
  'trigger blocks all ledger_events inserts).';

-- ─── 3. Document new ledger_events event_type values ────────────────────

COMMENT ON COLUMN public.ledger_events.event_type IS
  'Event type. Stripe-derived values include charge.succeeded, '
  'transfer.paid, refund.succeeded (per Doc 34). Doc 38 adds: '
  'correction (compensating entry, links to original via '
  'external_reference_id), circle.closed (accounting close snapshot), '
  'circle.reopened (rare safety-valve reopen). No CHECK constraint '
  'enforces this list — each writer is responsible for using the '
  'documented vocabulary.';

-- ─── 4. Self-register ────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '370',
  'closing_workflow_schema',
  ARRAY['-- 370: circles.closed_at + status CHECK extended + ledger_events event_type docs']
)
ON CONFLICT (version) DO NOTHING;
