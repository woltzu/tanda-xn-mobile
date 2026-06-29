-- ═══════════════════════════════════════════════════════════════════════════
-- 276_reconciliation_ledger.sql
--
-- Append-only ledger foundation for Stripe money movement (doc 34 v2).
--
-- Two new tables:
--   1. `pending_intents`   — app writes BEFORE calling Stripe so we have a
--      forensic record of EVERY money-movement attempt, including those
--      that never get a webhook (Stripe error, network drop, etc.).
--      Idempotency anchor: `client_reference_id` UNIQUE.
--   2. `ledger_events`     — immutable, append-only. Written ONLY from the
--      stripe-webhook EF after signature verification, so every row
--      represents a confirmed-by-Stripe movement.
--      Idempotency anchor: `stripe_event_id` UNIQUE.
--
-- Append-only is enforced via triggers that RAISE on UPDATE/DELETE — even
-- service_role goes through SQL, and Postgres triggers run for any role.
--
-- No backfill: ledger starts empty. Historical Stripe activity stays in
-- stripe_webhook_events + stripe_payment_intents. Reconciliation cutover
-- starts from the first ledger_event written post-deploy.
--
-- RPC `get_reconciliation_summary(start, end)` returns daily charge/transfer/
-- refund totals + net for the Admin Reconciliation view. SECURITY DEFINER
-- because the underlying table is service-role only; the admin gate is at
-- the app layer (useIsAdmin) — consistent with the rest of the admin
-- screens we shipped this week.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) pending_intents ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_reference_id TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  cycle_id UUID REFERENCES circle_cycles(id) ON DELETE SET NULL,
  intent_type TEXT NOT NULL CHECK (intent_type IN ('charge', 'transfer', 'refund')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_intents_client_reference_id ON pending_intents(client_reference_id);
CREATE INDEX IF NOT EXISTS idx_pending_intents_user_id              ON pending_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_intents_circle_id            ON pending_intents(circle_id);
CREATE INDEX IF NOT EXISTS idx_pending_intents_trip_id              ON pending_intents(trip_id);
CREATE INDEX IF NOT EXISTS idx_pending_intents_created_at           ON pending_intents(created_at);

ALTER TABLE pending_intents ENABLE ROW LEVEL SECURITY;

-- Service-role only. Admin reads go through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS pending_intents_service_all ON pending_intents;
CREATE POLICY pending_intents_service_all ON pending_intents
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2) ledger_events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ledger_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE NOT NULL,
  stripe_object_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
  trip_id UUID REFERENCES trips(id) ON DELETE SET NULL,
  cycle_id UUID REFERENCES circle_cycles(id) ON DELETE SET NULL,
  external_reference_id UUID,
  external_reference_type TEXT,
  raw_payload JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_events_stripe_object_id  ON ledger_events(stripe_object_id);
CREATE INDEX IF NOT EXISTS idx_ledger_events_user_id           ON ledger_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_events_recipient_user_id ON ledger_events(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_events_circle_id         ON ledger_events(circle_id);
CREATE INDEX IF NOT EXISTS idx_ledger_events_trip_id           ON ledger_events(trip_id);
CREATE INDEX IF NOT EXISTS idx_ledger_events_cycle_id          ON ledger_events(cycle_id);
CREATE INDEX IF NOT EXISTS idx_ledger_events_created_at        ON ledger_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_events_event_type        ON ledger_events(event_type);

ALTER TABLE ledger_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_events_service_all ON ledger_events;
CREATE POLICY ledger_events_service_all ON ledger_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3) Append-only enforcement ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION block_ledger_events_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ledger_events is append-only: UPDATE and DELETE are not allowed (attempt: %)', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS tr_ledger_events_no_update ON ledger_events;
CREATE TRIGGER tr_ledger_events_no_update
  BEFORE UPDATE ON ledger_events
  FOR EACH ROW EXECUTE FUNCTION block_ledger_events_mutation();

DROP TRIGGER IF EXISTS tr_ledger_events_no_delete ON ledger_events;
CREATE TRIGGER tr_ledger_events_no_delete
  BEFORE DELETE ON ledger_events
  FOR EACH ROW EXECUTE FUNCTION block_ledger_events_mutation();

-- 4) Reconciliation summary RPC ──────────────────────────────────────────────
-- One row per day in the window with charge / transfer / refund totals + net.
-- Used by AdminOverviewScreen's Reconciliation section. Empty days are
-- omitted (caller fills gaps in the UI if it wants a dense series).
CREATE OR REPLACE FUNCTION get_reconciliation_summary(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  day DATE,
  total_charges_cents   BIGINT,
  total_transfers_cents BIGINT,
  total_refunds_cents   BIGINT,
  net_cents             BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (created_at AT TIME ZONE 'UTC')::DATE AS day,
    COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'charge.succeeded'),   0)::BIGINT AS total_charges_cents,
    COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'transfer.paid'),      0)::BIGINT AS total_transfers_cents,
    COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'refund.succeeded'),   0)::BIGINT AS total_refunds_cents,
    (
      COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'charge.succeeded'),   0)
      - COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'transfer.paid'),    0)
      - COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'refund.succeeded'), 0)
    )::BIGINT AS net_cents
  FROM ledger_events
  WHERE (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
  GROUP BY (created_at AT TIME ZONE 'UTC')::DATE
  ORDER BY (created_at AT TIME ZONE 'UTC')::DATE DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_reconciliation_summary(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_reconciliation_summary(DATE, DATE) TO authenticated, service_role;

-- 5) Self-register ───────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '276',
  'reconciliation_ledger',
  ARRAY['-- 276: reconciliation_ledger']
)
ON CONFLICT (version) DO NOTHING;
