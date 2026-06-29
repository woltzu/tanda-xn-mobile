-- ═══════════════════════════════════════════════════════════════════════════
-- 278_circle_payouts_ledger.sql
--
-- Stage 2 Bucket B — wire the existing circle_payouts table into the
-- reconciliation ledger (migrations 276 + 277) and add the Stripe Transfer
-- linkage columns the new process-circle-payout EF needs.
--
-- IMPORTANT: circle_payouts already exists (migration 188 created it as the
-- destination for PayoutExecutionEngine inserts). Its column shape is:
--   id, circle_id, recipient_id, cycle_number, position, amount (numeric
--   dollars), currency, expected_date, actual_date, status, payment_method,
--   transaction_id, notes, created_at
-- The status CHECK already permits 'pending'/'processing'/'completed'/etc.
-- We do NOT add 'paid' to the CHECK — the UI label "Paid" maps to the
-- canonical 'completed' status. Both tables are currently empty (0 rows in
-- prod as of 2026-06-28) so this ALTER is safe to apply without backfill.
--
-- New columns the EF / webhook need:
--   * cycle_id UUID  — FK to circle_cycles.id (the legacy table keys cycles
--                       by cycle_number alone; the ledger needs the UUID).
--   * transfer_id TEXT — Stripe Transfer id (tr_*) so the webhook can join
--                       transfer.paid back to this row.
--   * pending_intent_id UUID FK — link to the staged pending_intents row.
--   * ledger_event_id UUID FK — link to the confirmed ledger_events row.
--   * completed_at TIMESTAMPTZ — when transfer.paid landed.
--   * metadata JSONB — free-form for forensics.
--   * amount_cents INTEGER — alongside the legacy `amount` numeric column.
--     Keeps the Stripe-side integer cents authoritative without churning
--     PayoutExecutionEngine's existing writer code.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE circle_payouts
  ADD COLUMN IF NOT EXISTS cycle_id          UUID REFERENCES circle_cycles(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transfer_id       TEXT,
  ADD COLUMN IF NOT EXISTS pending_intent_id UUID REFERENCES pending_intents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ledger_event_id   UUID REFERENCES ledger_events(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata          JSONB,
  ADD COLUMN IF NOT EXISTS amount_cents      INTEGER;

-- Indexes for query-time lookups the EF + webhook do.
CREATE INDEX IF NOT EXISTS idx_circle_payouts_cycle_id           ON circle_payouts(cycle_id);
CREATE INDEX IF NOT EXISTS idx_circle_payouts_transfer_id        ON circle_payouts(transfer_id);
CREATE INDEX IF NOT EXISTS idx_circle_payouts_pending_intent_id  ON circle_payouts(pending_intent_id);
CREATE INDEX IF NOT EXISTS idx_circle_payouts_ledger_event_id    ON circle_payouts(ledger_event_id);
CREATE INDEX IF NOT EXISTS idx_circle_payouts_status             ON circle_payouts(status);

-- Function: has this cycle's payout already completed?
-- Used by process-circle-payout to bail before duplicating a Transfer.
-- SECURITY DEFINER so the admin gate at the EF layer is the only access
-- control needed; the function itself only reads count() — no PII.
CREATE OR REPLACE FUNCTION is_cycle_paid_out(p_cycle_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM circle_payouts
    WHERE cycle_id = p_cycle_id AND status = 'completed'
  );
END;
$$;

REVOKE ALL ON FUNCTION is_cycle_paid_out(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_cycle_paid_out(UUID) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '278',
  'circle_payouts_ledger',
  ARRAY['-- 278: circle_payouts_ledger']
)
ON CONFLICT (version) DO NOTHING;
