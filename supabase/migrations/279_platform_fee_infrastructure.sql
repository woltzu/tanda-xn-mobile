-- ═══════════════════════════════════════════════════════════════════════════
-- 279_platform_fee_infrastructure.sql
--
-- Stage 2 Bucket C — platform fee + Stripe fee tracking (doc 35 v3).
--
-- Decisions (locked):
--   * Ordinary saving circles are free (platform_fee_bps = 0).
--   * Premium circles (is_premium = true) default to 2% (platform_fee_bps = 200).
--   * The platform absorbs Stripe processing fees until $200K GTV.
--   * Every ledger_events row now carries stripe_fee_cents so the Admin
--     operating-costs view can show "fees absorbed this month".
--
-- Note on circles.type:
--   The table already has a `type` text column. We are NOT deriving
--   is_premium from it now — operators flip is_premium independently so
--   the existing type values keep their current semantics. A future
--   migration can backfill is_premium from type once the type taxonomy
--   stabilises.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE circles
  ADD COLUMN IF NOT EXISTS is_premium       BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_bps INTEGER DEFAULT 0     NOT NULL
    CHECK (platform_fee_bps >= 0 AND platform_fee_bps <= 1000);

CREATE INDEX IF NOT EXISTS idx_circles_is_premium ON circles(is_premium);

-- stripe_fee_cents on the ledger. Default 0 keeps historical rows
-- well-formed; the webhook will populate this on every new event by
-- retrieving the PI with expand=['latest_charge.balance_transaction'].
ALTER TABLE ledger_events
  ADD COLUMN IF NOT EXISTS stripe_fee_cents INTEGER DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_events_stripe_fee_cents
  ON ledger_events(stripe_fee_cents) WHERE stripe_fee_cents > 0;

-- Refresh get_reconciliation_summary to include stripe_fee_cents.
-- Postgres requires DROP-before-CREATE when the OUT-row shape changes —
-- CREATE OR REPLACE refuses to alter the RETURNS TABLE signature.
DROP FUNCTION IF EXISTS get_reconciliation_summary(DATE, DATE);

CREATE OR REPLACE FUNCTION get_reconciliation_summary(
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date   DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE(
  day DATE,
  total_charges_cents     BIGINT,
  total_transfers_cents   BIGINT,
  total_refunds_cents     BIGINT,
  net_cents               BIGINT,
  total_stripe_fees_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (created_at AT TIME ZONE 'UTC')::DATE AS day,
    COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'charge.succeeded'),     0)::BIGINT AS total_charges_cents,
    COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'transfer.paid'),        0)::BIGINT AS total_transfers_cents,
    COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'refund.succeeded'),     0)::BIGINT AS total_refunds_cents,
    (
      COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'charge.succeeded'),   0)
      - COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'transfer.paid'),    0)
      - COALESCE(SUM(amount_cents) FILTER (WHERE event_type = 'refund.succeeded'), 0)
    )::BIGINT AS net_cents,
    COALESCE(SUM(stripe_fee_cents), 0)::BIGINT AS total_stripe_fees_cents
  FROM ledger_events
  WHERE (created_at AT TIME ZONE 'UTC')::DATE BETWEEN p_start_date AND p_end_date
  GROUP BY (created_at AT TIME ZONE 'UTC')::DATE
  ORDER BY (created_at AT TIME ZONE 'UTC')::DATE DESC;
END;
$$;

REVOKE ALL ON FUNCTION get_reconciliation_summary(DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_reconciliation_summary(DATE, DATE) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '279',
  'platform_fee_infrastructure',
  ARRAY['-- 279: platform_fee_infrastructure']
)
ON CONFLICT (version) DO NOTHING;
