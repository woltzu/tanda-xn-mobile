-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 059: Cross-Circle Liquidity Pool
-- Platform-level liquidity pool that funds advances against future payouts
-- Pool ledger, advance lifecycle, utilization monitoring, concentration limits
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. LIQUIDITY POOL (Platform-Level Ledger) ─────────────────────────────

CREATE TABLE IF NOT EXISTS liquidity_pool (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_name             TEXT NOT NULL DEFAULT 'primary',

  -- Balances (all in cents)
  total_capital_cents    BIGINT NOT NULL DEFAULT 0,      -- total capital injected
  deployed_cents         BIGINT NOT NULL DEFAULT 0,      -- currently lent out
  available_cents        BIGINT NOT NULL DEFAULT 0,      -- ready to deploy
  reserved_cents         BIGINT NOT NULL DEFAULT 0,      -- held back for safety margin
  fees_earned_cents      BIGINT NOT NULL DEFAULT 0,      -- cumulative fee revenue
  losses_cents           BIGINT NOT NULL DEFAULT 0,      -- cumulative defaults written off

  -- Utilization
  utilization_pct        NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (utilization_pct BETWEEN 0 AND 100),
  max_utilization_pct    NUMERIC(5,2) NOT NULL DEFAULT 80.00,  -- AI throttle threshold
  is_accepting_requests  BOOLEAN NOT NULL DEFAULT true,

  -- Concentration limits
  max_circle_concentration_pct  NUMERIC(5,2) NOT NULL DEFAULT 20.00,  -- no single circle > 20%
  max_member_exposure_pct       NUMERIC(5,2) NOT NULL DEFAULT 80.00,  -- no member > 80% of expected payout

  -- Pool stats
  total_advances_issued  INTEGER NOT NULL DEFAULT 0,
  total_advances_repaid  INTEGER NOT NULL DEFAULT 0,
  total_advances_defaulted INTEGER NOT NULL DEFAULT 0,
  avg_advance_amount_cents BIGINT NOT NULL DEFAULT 0,
  default_rate_pct       NUMERIC(5,2) NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(pool_name)
);

-- ─── 2. LIQUIDITY ADVANCES (Individual Advance Records) ────────────────────

CREATE TABLE IF NOT EXISTS liquidity_advances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id               UUID NOT NULL REFERENCES liquidity_pool(id) ON DELETE RESTRICT,
  member_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  circle_id             UUID NOT NULL,

  -- Advance details
  requested_amount_cents BIGINT NOT NULL CHECK (requested_amount_cents > 0),
  approved_amount_cents  BIGINT,
  expected_payout_cents  BIGINT NOT NULL,               -- member's expected payout from circle
  advance_pct_of_payout  NUMERIC(5,2) NOT NULL,          -- what % of payout this represents

  -- Fee structure (flat, no compounding)
  fee_tier              TEXT NOT NULL DEFAULT '30_day' CHECK (fee_tier IN ('30_day','60_day')),
  fee_pct               NUMERIC(5,2) NOT NULL,           -- 3% or 5%
  fee_amount_cents      BIGINT NOT NULL DEFAULT 0,       -- calculated fee
  early_repay_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0.50,  -- 0.5% discount for early repay
  late_fee_cents        INTEGER NOT NULL DEFAULT 2500,    -- $25 flat late fee

  -- Net amounts
  disbursed_amount_cents BIGINT,                          -- what member actually receives
  total_repayment_cents  BIGINT,                          -- principal + fee (+ late fee if applicable)
  amount_repaid_cents    BIGINT NOT NULL DEFAULT 0,       -- how much has been repaid so far

  -- Eligibility snapshot at time of approval
  member_xnscore        NUMERIC(5,2),
  member_tier           TEXT,
  member_dcr            NUMERIC(5,2),                    -- debt-to-contribution ratio
  completed_cycles      INTEGER,

  -- Repayment
  repayment_method      TEXT NOT NULL DEFAULT 'payout_offset' CHECK (repayment_method IN ('payout_offset','manual','split')),
  repay_by_date         DATE NOT NULL,
  payout_date           DATE,                            -- when the circle payout is expected
  actual_repaid_date    DATE,
  is_early_repayment    BOOLEAN DEFAULT false,
  late_fee_applied      BOOLEAN NOT NULL DEFAULT false,

  -- Status lifecycle: requested → approved → disbursed → repaying → repaid | defaulted
  status                TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested',        -- member submitted request
    'approved',         -- eligibility passed, pool has capacity
    'disbursed',        -- funds sent to member wallet
    'repaying',         -- partial repayment received
    'repaid',           -- fully repaid
    'defaulted',        -- missed repayment deadline + grace period
    'rejected',         -- eligibility failed or pool depleted
    'cancelled',        -- member cancelled before disbursement
    'queued'            -- pool utilization too high, waiting for capacity
  )),
  rejection_reason      TEXT,
  queue_position        INTEGER,

  -- Automatic deduction reference
  payout_deduction_id   TEXT,                            -- reference to the payout that repaid this

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. POOL TRANSACTIONS (Ledger Entries) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS pool_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id               UUID NOT NULL REFERENCES liquidity_pool(id) ON DELETE RESTRICT,
  advance_id            UUID REFERENCES liquidity_advances(id) ON DELETE SET NULL,

  -- Transaction type
  type                  TEXT NOT NULL CHECK (type IN (
    'capital_injection',     -- TandaXn adds capital
    'advance_disbursement',  -- funds go to member
    'advance_repayment',     -- member repays
    'fee_earned',            -- fee portion of repayment
    'late_fee_earned',       -- late fee collected
    'early_repay_discount',  -- fee discount given
    'default_writeoff',      -- advance written off as loss
    'capital_withdrawal',    -- TandaXn withdraws capital
    'interest_earned'        -- future: institutional lending income
  )),

  amount_cents          BIGINT NOT NULL,
  direction             TEXT NOT NULL CHECK (direction IN ('inflow','outflow')),
  balance_after_cents   BIGINT NOT NULL,

  description           TEXT,
  reference_id          TEXT,                            -- external reference (stripe, etc)

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. POOL UTILIZATION SNAPSHOTS (Daily History) ──────────────────────────

CREATE TABLE IF NOT EXISTS pool_utilization_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id               UUID NOT NULL REFERENCES liquidity_pool(id) ON DELETE CASCADE,

  snapshot_date         DATE NOT NULL,
  total_capital_cents   BIGINT NOT NULL,
  deployed_cents        BIGINT NOT NULL,
  available_cents       BIGINT NOT NULL,
  utilization_pct       NUMERIC(5,2) NOT NULL,

  advances_outstanding  INTEGER NOT NULL DEFAULT 0,
  advances_issued_today INTEGER NOT NULL DEFAULT 0,
  advances_repaid_today INTEGER NOT NULL DEFAULT 0,
  fees_earned_today_cents BIGINT NOT NULL DEFAULT 0,

  -- Concentration metrics
  top_circle_pct        NUMERIC(5,2),                   -- highest single circle concentration
  top_circle_id         UUID,
  unique_circles        INTEGER NOT NULL DEFAULT 0,
  unique_members        INTEGER NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pool_id, snapshot_date)
);

-- ─── 5. CIRCLE CONCENTRATION TRACKER ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pool_circle_exposure (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id               UUID NOT NULL REFERENCES liquidity_pool(id) ON DELETE CASCADE,
  circle_id             UUID NOT NULL,

  outstanding_cents     BIGINT NOT NULL DEFAULT 0,
  total_advanced_cents  BIGINT NOT NULL DEFAULT 0,
  active_advances       INTEGER NOT NULL DEFAULT 0,
  concentration_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,

  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pool_id, circle_id)
);

-- ════════════════════════════════════════════════════════════════════��═════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- liquidity_advances
CREATE INDEX idx_advances_member ON liquidity_advances(member_id, created_at DESC);
CREATE INDEX idx_advances_circle ON liquidity_advances(circle_id);
CREATE INDEX idx_advances_pool ON liquidity_advances(pool_id);
CREATE INDEX idx_advances_status ON liquidity_advances(status) WHERE status IN ('requested','approved','disbursed','repaying','queued');
CREATE INDEX idx_advances_repay_date ON liquidity_advances(repay_by_date) WHERE status IN ('disbursed','repaying');
CREATE INDEX idx_advances_payout_date ON liquidity_advances(payout_date) WHERE status IN ('disbursed','repaying');

-- pool_transactions
CREATE INDEX idx_pool_tx_pool ON pool_transactions(pool_id, created_at DESC);
CREATE INDEX idx_pool_tx_advance ON pool_transactions(advance_id) WHERE advance_id IS NOT NULL;
CREATE INDEX idx_pool_tx_type ON pool_transactions(type);

-- pool_utilization_snapshots
CREATE INDEX idx_pool_snapshots ON pool_utilization_snapshots(pool_id, snapshot_date DESC);

-- pool_circle_exposure
CREATE INDEX idx_circle_exposure ON pool_circle_exposure(pool_id, concentration_pct DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_liquidity_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pool_updated_at BEFORE UPDATE ON liquidity_pool
  FOR EACH ROW EXECUTE FUNCTION set_liquidity_updated_at();
CREATE TRIGGER trg_advances_updated_at BEFORE UPDATE ON liquidity_advances
  FOR EACH ROW EXECUTE FUNCTION set_liquidity_updated_at();
CREATE TRIGGER trg_circle_exposure_updated_at BEFORE UPDATE ON pool_circle_exposure
  FOR EACH ROW EXECUTE FUNCTION set_liquidity_updated_at();

-- Auto-calculate fee on advance approval
CREATE OR REPLACE FUNCTION calculate_advance_fee()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status = 'requested') THEN
    -- Calculate fee based on tier
    NEW.fee_amount_cents = ROUND(NEW.approved_amount_cents * (NEW.fee_pct / 100));
    NEW.disbursed_amount_cents = NEW.approved_amount_cents;
    NEW.total_repayment_cents = NEW.approved_amount_cents + NEW.fee_amount_cents;
    NEW.advance_pct_of_payout = ROUND((NEW.approved_amount_cents::NUMERIC / NULLIF(NEW.expected_payout_cents, 0)) * 100, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_advance_fee_calc BEFORE UPDATE ON liquidity_advances
  FOR EACH ROW EXECUTE FUNCTION calculate_advance_fee();

-- Also on insert if status is already 'approved'
CREATE TRIGGER trg_advance_fee_calc_insert BEFORE INSERT ON liquidity_advances
  FOR EACH ROW EXECUTE FUNCTION calculate_advance_fee();

-- Auto-update pool balances on advance status change
CREATE OR REPLACE FUNCTION update_pool_on_advance_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Disbursement: move from available to deployed
  IF NEW.status = 'disbursed' AND (OLD IS NULL OR OLD.status != 'disbursed') THEN
    UPDATE liquidity_pool SET
      deployed_cents = deployed_cents + NEW.disbursed_amount_cents,
      available_cents = available_cents - NEW.disbursed_amount_cents,
      total_advances_issued = total_advances_issued + 1,
      utilization_pct = ROUND(((deployed_cents + NEW.disbursed_amount_cents)::NUMERIC / NULLIF(total_capital_cents, 0)) * 100, 2)
    WHERE id = NEW.pool_id;
  END IF;

  -- Repaid: move from deployed back to available + add fee
  IF NEW.status = 'repaid' AND OLD.status != 'repaid' THEN
    UPDATE liquidity_pool SET
      deployed_cents = deployed_cents - COALESCE(NEW.disbursed_amount_cents, 0),
      available_cents = available_cents + COALESCE(NEW.disbursed_amount_cents, 0) + COALESCE(NEW.fee_amount_cents, 0),
      fees_earned_cents = fees_earned_cents + COALESCE(NEW.fee_amount_cents, 0),
      total_advances_repaid = total_advances_repaid + 1,
      utilization_pct = ROUND(((deployed_cents - COALESCE(NEW.disbursed_amount_cents, 0))::NUMERIC / NULLIF(total_capital_cents, 0)) * 100, 2)
    WHERE id = NEW.pool_id;
  END IF;

  -- Defaulted: move from deployed to losses
  IF NEW.status = 'defaulted' AND OLD.status != 'defaulted' THEN
    UPDATE liquidity_pool SET
      deployed_cents = deployed_cents - COALESCE(NEW.disbursed_amount_cents, 0) + COALESCE(NEW.amount_repaid_cents, 0),
      losses_cents = losses_cents + COALESCE(NEW.disbursed_amount_cents, 0) - COALESCE(NEW.amount_repaid_cents, 0),
      total_advances_defaulted = total_advances_defaulted + 1,
      utilization_pct = ROUND(((deployed_cents - COALESCE(NEW.disbursed_amount_cents, 0) + COALESCE(NEW.amount_repaid_cents, 0))::NUMERIC / NULLIF(total_capital_cents, 0)) * 100, 2)
    WHERE id = NEW.pool_id;
  END IF;

  -- Update pool is_accepting_requests based on utilization
  UPDATE liquidity_pool SET
    is_accepting_requests = (utilization_pct < max_utilization_pct)
  WHERE id = NEW.pool_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pool_advance_sync AFTER UPDATE ON liquidity_advances
  FOR EACH ROW EXECUTE FUNCTION update_pool_on_advance_change();

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE liquidity_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_pool FORCE ROW LEVEL SECURITY;
ALTER TABLE liquidity_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE liquidity_advances FORCE ROW LEVEL SECURITY;
ALTER TABLE pool_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE pool_utilization_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_utilization_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE pool_circle_exposure ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_circle_exposure FORCE ROW LEVEL SECURITY;

-- Pool: public read (utilization info)
CREATE POLICY pool_public_read ON liquidity_pool FOR SELECT USING (true);

-- Advances: member sees own
CREATE POLICY advances_member_select ON liquidity_advances FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY advances_member_insert ON liquidity_advances FOR INSERT WITH CHECK (auth.uid() = member_id);

-- Transactions: member sees own advances' transactions
CREATE POLICY pool_tx_member_select ON pool_transactions FOR SELECT USING (
  advance_id IS NULL OR EXISTS (
    SELECT 1 FROM liquidity_advances WHERE id = pool_transactions.advance_id AND member_id = auth.uid()
  )
);

-- Snapshots: public read
CREATE POLICY snapshots_public_read ON pool_utilization_snapshots FOR SELECT USING (true);

-- Circle exposure: public read
CREATE POLICY exposure_public_read ON pool_circle_exposure FOR SELECT USING (true);

-- Service role full access
CREATE POLICY pool_service ON liquidity_pool FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY advances_service ON liquidity_advances FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY pool_tx_service ON pool_transactions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY snapshots_service ON pool_utilization_snapshots FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY exposure_service ON pool_circle_exposure FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE liquidity_advances;

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED: Primary Liquidity Pool
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO liquidity_pool (pool_name, total_capital_cents, available_cents, reserved_cents, max_utilization_pct, max_circle_concentration_pct, max_member_exposure_pct)
VALUES ('primary', 5000000, 4500000, 500000, 80.00, 20.00, 80.00)  -- $50,000 initial capital, $5,000 reserve
ON CONFLICT (pool_name) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- VIEW: Pool Health Dashboard
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW pool_health_dashboard AS
SELECT
  p.pool_name,
  p.total_capital_cents,
  p.deployed_cents,
  p.available_cents,
  p.reserved_cents,
  p.utilization_pct,
  p.is_accepting_requests,
  p.fees_earned_cents,
  p.losses_cents,
  p.total_advances_issued,
  p.total_advances_repaid,
  p.total_advances_defaulted,
  p.default_rate_pct,
  -- Active advances
  (SELECT COUNT(*) FROM liquidity_advances la WHERE la.pool_id = p.id AND la.status IN ('disbursed','repaying')) as active_advances,
  (SELECT SUM(disbursed_amount_cents) FROM liquidity_advances la WHERE la.pool_id = p.id AND la.status IN ('disbursed','repaying')) as active_deployed_cents,
  -- Queued
  (SELECT COUNT(*) FROM liquidity_advances la WHERE la.pool_id = p.id AND la.status = 'queued') as queued_count,
  -- Revenue metrics
  CASE WHEN p.total_advances_issued > 0
    THEN ROUND(p.fees_earned_cents::NUMERIC / p.total_advances_issued, 0)
    ELSE 0
  END as avg_fee_per_advance_cents,
  CASE WHEN p.total_capital_cents > 0
    THEN ROUND((p.fees_earned_cents::NUMERIC / p.total_capital_cents) * 100, 2)
    ELSE 0
  END as return_on_capital_pct
FROM liquidity_pool p;

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE — 5 tables, 11 indexes, 5 triggers, 10 RLS policies, 1 view, 1 realtime
-- Liquidity pool seeded with $50,000 initial capital
-- ══════════════════════════════════════════════════════════════════════════════
