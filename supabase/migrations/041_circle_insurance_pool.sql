-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 041: Circle Insurance Pool
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Per-circle reserve fund funded by automatic withholding from contributions.
-- Covers up to 80% of default shortfalls. Dynamic rates (1-3%) based on
-- member risk profiles. Unspent reserves distributed back or rolled forward
-- at cycle end via Circle Democracy vote.
--
-- Tables: circle_insurance_pools, insurance_pool_transactions,
--         insurance_pool_rate_history, insurance_coverage_claims
-- Functions: calculate_pool_rate, process_pool_withholding,
--            process_pool_coverage, distribute_pool_balance
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: circle_insurance_pools (one row per circle)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS circle_insurance_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL UNIQUE REFERENCES circles(id) ON DELETE CASCADE,

  -- Balance tracking (all in cents)
  balance_cents BIGINT NOT NULL DEFAULT 0,
  total_withheld_cents BIGINT NOT NULL DEFAULT 0,
  total_paid_out_cents BIGINT NOT NULL DEFAULT 0,
  total_distributed_cents BIGINT NOT NULL DEFAULT 0,
  total_rolled_over_cents BIGINT NOT NULL DEFAULT 0,

  -- Current rate configuration
  current_rate DECIMAL(5,4) NOT NULL DEFAULT 0.0200,   -- 2% base
  rate_floor DECIMAL(5,4) NOT NULL DEFAULT 0.0100,      -- 1% minimum
  rate_ceiling DECIMAL(5,4) NOT NULL DEFAULT 0.0300,    -- 3% maximum

  -- Pool status
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'depleted', 'closed', 'distributing')),

  -- Claims tracking
  total_claims INTEGER NOT NULL DEFAULT 0,
  approved_claims INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: insurance_pool_transactions (append-only ledger)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_pool_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES circle_insurance_pools(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

  -- Transaction details
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'withholding', 'coverage_payout', 'distribution', 'rollover'
  )),
  amount_cents BIGINT NOT NULL,
  running_balance_cents BIGINT NOT NULL,

  -- References (nullable — depends on transaction type)
  contribution_id UUID,            -- for withholding (cycle_contributions.id)
  default_id UUID,                 -- for coverage_payout (defaults.id)
  claim_id UUID,                   -- for coverage_payout (insurance_coverage_claims.id)
  cycle_id UUID,                   -- for distribution/rollover (circle_cycles.id)
  user_id UUID,                    -- member involved

  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: insurance_pool_rate_history (rate change audit trail)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_pool_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES circle_insurance_pools(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

  effective_rate DECIMAL(5,4) NOT NULL,
  previous_rate DECIMAL(5,4) NOT NULL,
  reason TEXT NOT NULL,

  -- XnScore factors that drove the calculation
  avg_member_score DECIMAL(6,2),
  min_member_score DECIMAL(6,2),
  members_below_fair INTEGER DEFAULT 0,
  default_history_factor DECIMAL(5,4),

  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: insurance_coverage_claims (default coverage claims)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insurance_coverage_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_id UUID NOT NULL REFERENCES circle_insurance_pools(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  default_id UUID NOT NULL REFERENCES defaults(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES circle_cycles(id),
  defaulter_user_id UUID NOT NULL REFERENCES profiles(id),

  -- Claim amounts (all in cents)
  shortfall_amount_cents BIGINT NOT NULL,
  max_coverage_cents BIGINT NOT NULL,              -- 80% of shortfall
  approved_amount_cents BIGINT NOT NULL DEFAULT 0,
  coverage_pct DECIMAL(5,4) NOT NULL DEFAULT 0,

  -- Pool state snapshot
  pool_balance_before_cents BIGINT NOT NULL,
  pool_balance_after_cents BIGINT NOT NULL DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'partial', 'denied', 'void')),
  denial_reason TEXT,

  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ins_pool_circle
  ON circle_insurance_pools(circle_id);

CREATE INDEX IF NOT EXISTS idx_pool_txns_pool
  ON insurance_pool_transactions(pool_id);

CREATE INDEX IF NOT EXISTS idx_pool_txns_circle
  ON insurance_pool_transactions(circle_id);

CREATE INDEX IF NOT EXISTS idx_pool_txns_type
  ON insurance_pool_transactions(transaction_type);

CREATE INDEX IF NOT EXISTS idx_pool_txns_created
  ON insurance_pool_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pool_rate_pool
  ON insurance_pool_rate_history(pool_id);

CREATE INDEX IF NOT EXISTS idx_pool_claims_default
  ON insurance_coverage_claims(default_id);

CREATE INDEX IF NOT EXISTS idx_pool_claims_circle
  ON insurance_coverage_claims(circle_id);

CREATE INDEX IF NOT EXISTS idx_pool_claims_status
  ON insurance_coverage_claims(status);


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE circle_insurance_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_pool_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_pool_rate_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_coverage_claims ENABLE ROW LEVEL SECURITY;

-- circle_insurance_pools: circle members can read
CREATE POLICY "pool_select_circle_member" ON circle_insurance_pools
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_insurance_pools.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "pool_service_all" ON circle_insurance_pools
  FOR ALL USING (auth.role() = 'service_role');

-- insurance_pool_transactions: circle members can read
CREATE POLICY "pool_txns_select_circle_member" ON insurance_pool_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = insurance_pool_transactions.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "pool_txns_service_all" ON insurance_pool_transactions
  FOR ALL USING (auth.role() = 'service_role');

-- insurance_pool_rate_history: circle members can read
CREATE POLICY "pool_rate_select_circle_member" ON insurance_pool_rate_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = insurance_pool_rate_history.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "pool_rate_service_all" ON insurance_pool_rate_history
  FOR ALL USING (auth.role() = 'service_role');

-- insurance_coverage_claims: circle members can read
CREATE POLICY "pool_claims_select_circle_member" ON insurance_coverage_claims
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = insurance_coverage_claims.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "pool_claims_service_all" ON insurance_coverage_claims
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE circle_insurance_pools;
ALTER PUBLICATION supabase_realtime ADD TABLE insurance_pool_transactions;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-create insurance pool when a circle is created
CREATE OR REPLACE FUNCTION create_insurance_pool_for_circle()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO circle_insurance_pools (circle_id)
  VALUES (NEW.id)
  ON CONFLICT (circle_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_insurance_pool
  AFTER INSERT ON circles
  FOR EACH ROW
  EXECUTE FUNCTION create_insurance_pool_for_circle();

-- updated_at trigger on circle_insurance_pools
CREATE TRIGGER trg_insurance_pool_updated_at
  BEFORE UPDATE ON circle_insurance_pools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER EXISTING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- Add 'pool_rollover' to circle_proposals proposal_type constraint
ALTER TABLE circle_proposals
  DROP CONSTRAINT IF EXISTS circle_proposals_proposal_type_check;

ALTER TABLE circle_proposals
  ADD CONSTRAINT circle_proposals_proposal_type_check
  CHECK (proposal_type IN (
    'admit_member', 'remove_member', 'change_payout_order',
    'change_rules', 'resolve_dispute', 'dissolve_circle', 'custom',
    'pool_rollover'
  ));

-- Add insurance pool columns to circle_default_resolutions
ALTER TABLE circle_default_resolutions
  ADD COLUMN IF NOT EXISTS amount_from_insurance_pool DECIMAL(12,2) DEFAULT 0;

ALTER TABLE circle_default_resolutions
  ADD COLUMN IF NOT EXISTS insurance_claim_id UUID;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SQL FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: calculate_pool_rate
-- Reads member XnScores and default history to compute dynamic insurance rate.
-- Returns DECIMAL(5,4) between rate_floor and rate_ceiling (typically 0.01-0.03).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION calculate_pool_rate(p_circle_id UUID)
RETURNS DECIMAL(5,4)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pool RECORD;
  v_avg_score DECIMAL(6,2);
  v_min_score DECIMAL(6,2);
  v_members_below_fair INTEGER;
  v_total_defaults INTEGER;
  v_member_count INTEGER;
  v_rate DECIMAL(5,4);
  v_previous_rate DECIMAL(5,4);
BEGIN
  -- Get pool configuration
  SELECT * INTO v_pool
  FROM circle_insurance_pools
  WHERE circle_id = p_circle_id;

  IF v_pool IS NULL THEN
    RETURN 0.0200; -- default 2%
  END IF;

  v_previous_rate := v_pool.current_rate;

  -- Get member XnScore stats
  SELECT
    COALESCE(AVG(xs.total_score), 0),
    COALESCE(MIN(xs.total_score), 0),
    COUNT(*) FILTER (WHERE xs.score_tier IN ('critical', 'poor')),
    COUNT(*)
  INTO v_avg_score, v_min_score, v_members_below_fair, v_member_count
  FROM circle_members cm
  LEFT JOIN xn_scores xs ON xs.user_id = cm.user_id
  WHERE cm.circle_id = p_circle_id
    AND cm.status = 'active';

  -- Get total defaults across circle members
  SELECT COALESCE(SUM(mbp.default_count), 0)
  INTO v_total_defaults
  FROM circle_members cm
  JOIN member_behavioral_profiles mbp ON mbp.user_id = cm.user_id
  WHERE cm.circle_id = p_circle_id
    AND cm.status = 'active';

  -- Start with base rate of 2%
  v_rate := 0.0200;

  -- Adjust based on average score
  IF v_avg_score >= 75 THEN
    -- High-quality circle: reduce rate
    v_rate := v_rate - 0.0050;
  ELSIF v_avg_score >= 60 THEN
    -- Good circle: slight reduction
    v_rate := v_rate - 0.0030;
  ELSIF v_avg_score < 45 THEN
    -- Below-fair average: increase rate
    v_rate := v_rate + 0.0030;
  END IF;

  -- Adjust for risky members
  IF v_members_below_fair > 0 AND v_member_count > 0 THEN
    -- Add 0.2% per risky member (capped at 0.8%)
    v_rate := v_rate + LEAST(v_members_below_fair * 0.0020, 0.0080);
  END IF;

  -- Adjust for default history
  IF v_total_defaults > 0 THEN
    -- Add 0.15% per historical default (capped at 0.6%)
    v_rate := v_rate + LEAST(v_total_defaults * 0.0015, 0.0060);
  END IF;

  -- Clamp between floor and ceiling
  v_rate := GREATEST(v_pool.rate_floor, LEAST(v_pool.rate_ceiling, v_rate));

  -- Update the pool with the new rate
  UPDATE circle_insurance_pools
  SET current_rate = v_rate, updated_at = NOW()
  WHERE id = v_pool.id;

  -- Record rate change in history
  INSERT INTO insurance_pool_rate_history (
    pool_id, circle_id, effective_rate, previous_rate, reason,
    avg_member_score, min_member_score, members_below_fair,
    default_history_factor
  ) VALUES (
    v_pool.id, p_circle_id, v_rate, v_previous_rate,
    'Dynamic rate recalculation',
    v_avg_score, v_min_score, v_members_below_fair,
    LEAST(v_total_defaults * 0.0015, 0.0060)
  );

  RETURN v_rate;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: process_pool_withholding
-- Called at contribution time. Withholds pool % and credits the insurance pool.
-- Returns JSONB: {withheld_cents, net_amount_cents, pool_balance_cents}
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_pool_withholding(
  p_contribution_id UUID,
  p_amount_cents BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_circle_id UUID;
  v_user_id UUID;
  v_pool RECORD;
  v_withheld BIGINT;
  v_new_balance BIGINT;
BEGIN
  -- Look up circle_id and user_id from the contribution
  SELECT circle_id, user_id
  INTO v_circle_id, v_user_id
  FROM cycle_contributions
  WHERE id = p_contribution_id;

  IF v_circle_id IS NULL THEN
    RETURN jsonb_build_object(
      'error', 'Contribution not found',
      'withheld_cents', 0,
      'net_amount_cents', p_amount_cents,
      'pool_balance_cents', 0
    );
  END IF;

  -- Get or verify the pool exists
  SELECT * INTO v_pool
  FROM circle_insurance_pools
  WHERE circle_id = v_circle_id;

  IF v_pool IS NULL THEN
    -- Auto-create pool if it doesn't exist (belt and suspenders with trigger)
    INSERT INTO circle_insurance_pools (circle_id)
    VALUES (v_circle_id)
    ON CONFLICT (circle_id) DO NOTHING
    RETURNING * INTO v_pool;

    -- Re-fetch if RETURNING didn't work (conflict path)
    IF v_pool IS NULL THEN
      SELECT * INTO v_pool
      FROM circle_insurance_pools
      WHERE circle_id = v_circle_id;
    END IF;
  END IF;

  -- Skip if pool is not active
  IF v_pool.status != 'active' THEN
    RETURN jsonb_build_object(
      'withheld_cents', 0,
      'net_amount_cents', p_amount_cents,
      'pool_balance_cents', v_pool.balance_cents,
      'pool_status', v_pool.status
    );
  END IF;

  -- Calculate withholding
  v_withheld := ROUND(p_amount_cents * v_pool.current_rate);
  v_new_balance := v_pool.balance_cents + v_withheld;

  -- Update pool balance
  UPDATE circle_insurance_pools
  SET
    balance_cents = v_new_balance,
    total_withheld_cents = total_withheld_cents + v_withheld,
    updated_at = NOW()
  WHERE id = v_pool.id;

  -- Record transaction
  INSERT INTO insurance_pool_transactions (
    pool_id, circle_id, transaction_type, amount_cents,
    running_balance_cents, contribution_id, user_id, description
  ) VALUES (
    v_pool.id, v_circle_id, 'withholding', v_withheld,
    v_new_balance, p_contribution_id, v_user_id,
    'Insurance pool withholding at ' || (v_pool.current_rate * 100)::TEXT || '% rate'
  );

  RETURN jsonb_build_object(
    'withheld_cents', v_withheld,
    'net_amount_cents', p_amount_cents - v_withheld,
    'pool_balance_cents', v_new_balance,
    'rate_applied', v_pool.current_rate
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: process_pool_coverage
-- Called during default cascade. Calculates and applies insurance pool coverage
-- (up to 80% of shortfall). Returns JSONB with claim details.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_pool_coverage(p_default_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_default RECORD;
  v_pool RECORD;
  v_shortfall_cents BIGINT;
  v_max_coverage_cents BIGINT;
  v_approved_cents BIGINT;
  v_coverage_pct DECIMAL(5,4);
  v_claim_id UUID;
  v_new_balance BIGINT;
  v_claim_status TEXT;
BEGIN
  -- Read the default record
  SELECT * INTO v_default
  FROM defaults
  WHERE id = p_default_id;

  IF v_default IS NULL THEN
    RETURN jsonb_build_object('error', 'Default not found', 'approved_cents', 0);
  END IF;

  -- Get the pool for this circle
  SELECT * INTO v_pool
  FROM circle_insurance_pools
  WHERE circle_id = v_default.circle_id;

  -- No pool or empty pool
  IF v_pool IS NULL OR v_pool.balance_cents <= 0 OR v_pool.status != 'active' THEN
    RETURN jsonb_build_object(
      'approved_cents', 0,
      'coverage_pct', 0,
      'reason', CASE
        WHEN v_pool IS NULL THEN 'No insurance pool for this circle'
        WHEN v_pool.balance_cents <= 0 THEN 'Insurance pool depleted'
        ELSE 'Insurance pool not active (status: ' || v_pool.status || ')'
      END
    );
  END IF;

  -- Calculate amounts (convert total_owed from DECIMAL dollars to BIGINT cents)
  v_shortfall_cents := ROUND(v_default.total_owed * 100);
  v_max_coverage_cents := ROUND(v_shortfall_cents * 0.80);  -- 80% max coverage
  v_approved_cents := LEAST(v_max_coverage_cents, v_pool.balance_cents);

  -- Determine claim status
  IF v_approved_cents >= v_max_coverage_cents THEN
    v_claim_status := 'approved';       -- Full 80% covered
  ELSIF v_approved_cents > 0 THEN
    v_claim_status := 'partial';        -- Some coverage but pool ran low
  ELSE
    v_claim_status := 'denied';
  END IF;

  -- Calculate coverage percentage
  IF v_shortfall_cents > 0 THEN
    v_coverage_pct := v_approved_cents::DECIMAL / v_shortfall_cents;
  ELSE
    v_coverage_pct := 0;
  END IF;

  v_new_balance := v_pool.balance_cents - v_approved_cents;

  -- Create the claim record
  INSERT INTO insurance_coverage_claims (
    pool_id, circle_id, default_id, cycle_id, defaulter_user_id,
    shortfall_amount_cents, max_coverage_cents, approved_amount_cents,
    coverage_pct, pool_balance_before_cents, pool_balance_after_cents,
    status, processed_at
  ) VALUES (
    v_pool.id, v_default.circle_id, p_default_id, v_default.cycle_id,
    v_default.user_id,
    v_shortfall_cents, v_max_coverage_cents, v_approved_cents,
    v_coverage_pct, v_pool.balance_cents, v_new_balance,
    v_claim_status, NOW()
  )
  RETURNING id INTO v_claim_id;

  -- Update pool balance and counters
  UPDATE circle_insurance_pools
  SET
    balance_cents = v_new_balance,
    total_paid_out_cents = total_paid_out_cents + v_approved_cents,
    total_claims = total_claims + 1,
    approved_claims = CASE WHEN v_approved_cents > 0
      THEN approved_claims + 1 ELSE approved_claims END,
    status = CASE WHEN v_new_balance <= 0 THEN 'depleted' ELSE status END,
    updated_at = NOW()
  WHERE id = v_pool.id;

  -- Record transaction (only if coverage > 0)
  IF v_approved_cents > 0 THEN
    INSERT INTO insurance_pool_transactions (
      pool_id, circle_id, transaction_type, amount_cents,
      running_balance_cents, default_id, claim_id,
      user_id, description
    ) VALUES (
      v_pool.id, v_default.circle_id, 'coverage_payout',
      -v_approved_cents,  -- negative = debit
      v_new_balance, p_default_id, v_claim_id,
      v_default.user_id,
      'Default coverage: ' || v_claim_status || ' (' ||
        ROUND(v_coverage_pct * 100, 1) || '% of shortfall)'
    );
  END IF;

  RETURN jsonb_build_object(
    'claim_id', v_claim_id,
    'approved_cents', v_approved_cents,
    'coverage_pct', v_coverage_pct,
    'claim_status', v_claim_status,
    'pool_balance_before', v_pool.balance_cents,
    'pool_balance_after', v_new_balance,
    'shortfall_cents', v_shortfall_cents,
    'max_coverage_cents', v_max_coverage_cents
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: distribute_pool_balance
-- Called at cycle end. Either distributes unspent reserves to members
-- proportionally or rolls them forward for the next cycle.
-- Returns JSONB summary of the operation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION distribute_pool_balance(
  p_circle_id UUID,
  p_action TEXT  -- 'distribute' or 'rollover'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pool RECORD;
  v_member RECORD;
  v_member_count INTEGER;
  v_per_member_cents BIGINT;
  v_remainder_cents BIGINT;
  v_distributed_total BIGINT := 0;
  v_distributions JSONB := '[]'::JSONB;
  v_cycle_id UUID;
BEGIN
  -- Get pool
  SELECT * INTO v_pool
  FROM circle_insurance_pools
  WHERE circle_id = p_circle_id;

  IF v_pool IS NULL OR v_pool.balance_cents <= 0 THEN
    RETURN jsonb_build_object(
      'action', p_action,
      'amount_cents', 0,
      'reason', 'No pool balance to process'
    );
  END IF;

  -- Get the current cycle for reference
  SELECT id INTO v_cycle_id
  FROM circle_cycles
  WHERE circle_id = p_circle_id
  ORDER BY cycle_number DESC
  LIMIT 1;

  -- ── ROLLOVER ──
  IF p_action = 'rollover' THEN
    -- Just record the rollover — balance stays
    UPDATE circle_insurance_pools
    SET
      total_rolled_over_cents = total_rolled_over_cents + v_pool.balance_cents,
      updated_at = NOW()
    WHERE id = v_pool.id;

    INSERT INTO insurance_pool_transactions (
      pool_id, circle_id, transaction_type, amount_cents,
      running_balance_cents, cycle_id, description
    ) VALUES (
      v_pool.id, p_circle_id, 'rollover', v_pool.balance_cents,
      v_pool.balance_cents, v_cycle_id,
      'Pool balance rolled over to next cycle'
    );

    RETURN jsonb_build_object(
      'action', 'rollover',
      'amount_cents', v_pool.balance_cents,
      'pool_balance_cents', v_pool.balance_cents,
      'message', 'Balance rolled over successfully'
    );
  END IF;

  -- ── DISTRIBUTE ──
  IF p_action = 'distribute' THEN
    -- Set pool status to distributing
    UPDATE circle_insurance_pools
    SET status = 'distributing', updated_at = NOW()
    WHERE id = v_pool.id;

    -- Count active members
    SELECT COUNT(*) INTO v_member_count
    FROM circle_members
    WHERE circle_id = p_circle_id AND status = 'active';

    IF v_member_count = 0 THEN
      RETURN jsonb_build_object(
        'action', 'distribute',
        'error', 'No active members to distribute to'
      );
    END IF;

    -- Calculate per-member amount (floor to avoid overspending)
    v_per_member_cents := FLOOR(v_pool.balance_cents / v_member_count);
    v_remainder_cents := v_pool.balance_cents - (v_per_member_cents * v_member_count);

    -- Distribute to each member
    FOR v_member IN
      SELECT cm.user_id
      FROM circle_members cm
      WHERE cm.circle_id = p_circle_id AND cm.status = 'active'
      ORDER BY cm.position ASC
    LOOP
      v_distributed_total := v_distributed_total + v_per_member_cents;

      INSERT INTO insurance_pool_transactions (
        pool_id, circle_id, transaction_type, amount_cents,
        running_balance_cents, cycle_id, user_id, description
      ) VALUES (
        v_pool.id, p_circle_id, 'distribution',
        -v_per_member_cents,  -- negative = leaving pool
        v_pool.balance_cents - v_distributed_total,
        v_cycle_id, v_member.user_id,
        'Insurance pool distribution: $' ||
          ROUND(v_per_member_cents / 100.0, 2)::TEXT || ' per member'
      );

      v_distributions := v_distributions || jsonb_build_object(
        'user_id', v_member.user_id,
        'amount_cents', v_per_member_cents
      );
    END LOOP;

    -- Update pool balances
    UPDATE circle_insurance_pools
    SET
      balance_cents = v_remainder_cents,
      total_distributed_cents = total_distributed_cents + v_distributed_total,
      status = CASE WHEN v_remainder_cents <= 0 THEN 'closed' ELSE 'active' END,
      updated_at = NOW()
    WHERE id = v_pool.id;

    RETURN jsonb_build_object(
      'action', 'distribute',
      'total_distributed_cents', v_distributed_total,
      'per_member_cents', v_per_member_cents,
      'member_count', v_member_count,
      'remainder_cents', v_remainder_cents,
      'distributions', v_distributions
    );
  END IF;

  -- Invalid action
  RETURN jsonb_build_object('error', 'Invalid action: ' || p_action);
END;
$$;
