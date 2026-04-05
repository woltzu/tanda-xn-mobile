-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 049: Substitute Member System
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Maintains a verified bench of pre-vetted substitute members. When a circle
-- member exits, a substitute enters their slot — the circle continues without
-- disruption. Payout entitlement transfers at 80/10/10 split when applicable.
--
-- Tables: substitute_pool, circle_exit_requests, substitution_records
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: substitute_pool
-- Members with XnScore ≥60 (Trusted tier) and ≥1 completed circle can opt in.
-- Status: active (ready now), standby (contactable), suspended, removed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS substitute_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  member_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'standby', 'suspended', 'removed'
  )),

  -- Matching preferences
  availability_radius_miles INTEGER NOT NULL DEFAULT 50,
  max_contribution_amount_cents INTEGER NOT NULL DEFAULT 0,
  preferred_languages JSONB NOT NULL DEFAULT '["en"]',

  -- Reliability tracking (separate from XnScore)
  substitute_reliability_score NUMERIC(5,2) NOT NULL DEFAULT 100.00,
  total_substitutions INTEGER NOT NULL DEFAULT 0,
  successful_substitutions INTEGER NOT NULL DEFAULT 0,

  -- Decline tracking — 3 declines in 90 days → suspended
  decline_count_90d INTEGER NOT NULL DEFAULT 0,
  last_decline_at TIMESTAMPTZ,

  opted_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: circle_exit_requests
-- Initiated by a member who needs to leave a circle. Tracks payout
-- entitlement status and the 80/10/10 split when applicable.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS circle_exit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

  -- Reason (not required to be detailed)
  reason_category TEXT NOT NULL DEFAULT 'other' CHECK (reason_category IN (
    'financial_hardship', 'relocation', 'life_change', 'other'
  )),
  reason_details TEXT,

  -- Timing
  exit_date_requested DATE NOT NULL DEFAULT CURRENT_DATE,
  notice_days INTEGER NOT NULL DEFAULT 0,
  cycles_completed INTEGER NOT NULL DEFAULT 0,
  total_cycles INTEGER NOT NULL DEFAULT 0,

  -- Payout entitlement (80/10/10 split)
  payout_entitlement_status TEXT NOT NULL DEFAULT 'not_applicable' CHECK (payout_entitlement_status IN (
    'not_applicable',     -- member already received payout
    'pending_transfer',   -- payout not yet received, awaiting substitute match
    'transferred',        -- 80/10/10 split executed
    'forfeited'           -- no substitute found, member forfeits
  )),
  original_payout_amount_cents INTEGER NOT NULL DEFAULT 0,
  substitute_share_cents INTEGER NOT NULL DEFAULT 0,     -- 80% to substitute
  insurance_pool_share_cents INTEGER NOT NULL DEFAULT 0,  -- 10% to insurance
  original_member_settlement_cents INTEGER NOT NULL DEFAULT 0, -- 10% to exiting member

  -- Matching
  substitute_matched_id UUID REFERENCES profiles(id),

  -- XnScore impact
  xnscore_impact TEXT NOT NULL DEFAULT 'none' CHECK (xnscore_impact IN (
    'none',       -- ≥50% completed + ≥7 days notice
    'partial',    -- abrupt exit
    'full_default' -- stopped paying without formal exit
  )),
  xnscore_adjustment INTEGER NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- just submitted
    'approved',    -- exit approved, searching for substitute
    'matching',    -- actively matching substitutes
    'matched',     -- substitute found, awaiting their confirmation
    'substituted', -- substitute confirmed + admin approved
    'completed',   -- exit fully processed
    'cancelled',   -- member cancelled their exit request
    'expired'      -- no substitute found within timeframe
  )),

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: substitution_records
-- Links an exiting member to their substitute. Tracks the 48-hour
-- confirmation window and admin approval (24h, auto-approve if no response).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS substitution_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  exit_request_id UUID NOT NULL REFERENCES circle_exit_requests(id) ON DELETE CASCADE,
  exiting_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  substitute_member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Position and payout transfer
  original_payout_position INTEGER NOT NULL,
  payout_entitlement_transfer_cents INTEGER NOT NULL DEFAULT 0,

  -- Cycle context
  entry_cycle_id UUID REFERENCES circle_cycles(id),
  entry_cycle_number INTEGER NOT NULL DEFAULT 0,

  -- Substitute 48h confirmation window
  confirmation_deadline TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  confirmed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,

  -- Admin 24h approval window
  admin_notified_at TIMESTAMPTZ,
  admin_approved_at TIMESTAMPTZ,
  admin_declined_at TIMESTAMPTZ,
  auto_approved BOOLEAN NOT NULL DEFAULT false,

  status TEXT NOT NULL DEFAULT 'pending_confirmation' CHECK (status IN (
    'pending_confirmation', -- waiting for substitute to confirm (48h)
    'confirmed',           -- substitute confirmed, awaiting admin
    'admin_pending',       -- forwarded to admin (24h window)
    'approved',            -- admin approved (or auto-approved)
    'declined_substitute', -- substitute declined
    'declined_admin',      -- admin declined
    'expired',             -- confirmation window passed
    'completed',           -- fully processed, substitute is in the circle
    'cancelled'            -- exit request was cancelled
  )),

  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

-- substitute_pool
CREATE INDEX IF NOT EXISTS idx_substitute_pool_member
  ON substitute_pool(member_id);

CREATE INDEX IF NOT EXISTS idx_substitute_pool_status
  ON substitute_pool(status)
  WHERE status IN ('active', 'standby');

CREATE INDEX IF NOT EXISTS idx_substitute_pool_reliability
  ON substitute_pool(substitute_reliability_score DESC)
  WHERE status = 'active';

-- circle_exit_requests
CREATE INDEX IF NOT EXISTS idx_exit_requests_member
  ON circle_exit_requests(member_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exit_requests_circle
  ON circle_exit_requests(circle_id, status);

CREATE INDEX IF NOT EXISTS idx_exit_requests_status
  ON circle_exit_requests(status)
  WHERE status IN ('pending', 'matching', 'matched');

-- substitution_records
CREATE INDEX IF NOT EXISTS idx_substitution_records_circle
  ON substitution_records(circle_id, status);

CREATE INDEX IF NOT EXISTS idx_substitution_records_substitute
  ON substitution_records(substitute_member_id, status);

CREATE INDEX IF NOT EXISTS idx_substitution_records_exit_request
  ON substitution_records(exit_request_id);

CREATE INDEX IF NOT EXISTS idx_substitution_records_deadline
  ON substitution_records(confirmation_deadline)
  WHERE status = 'pending_confirmation';


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE substitute_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_exit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitution_records ENABLE ROW LEVEL SECURITY;

-- substitute_pool: members see their own entry
CREATE POLICY "substitute_pool_select_own" ON substitute_pool
  FOR SELECT USING (member_id = auth.uid());

-- substitute_pool: members can insert their own opt-in
CREATE POLICY "substitute_pool_insert_own" ON substitute_pool
  FOR INSERT WITH CHECK (member_id = auth.uid());

-- substitute_pool: members can update their own preferences
CREATE POLICY "substitute_pool_update_own" ON substitute_pool
  FOR UPDATE USING (member_id = auth.uid());

-- substitute_pool: service role for matching queries across all members
CREATE POLICY "substitute_pool_service_all" ON substitute_pool
  FOR ALL USING (auth.role() = 'service_role');

-- circle_exit_requests: members see their own requests
CREATE POLICY "exit_requests_select_own" ON circle_exit_requests
  FOR SELECT USING (member_id = auth.uid());

-- circle_exit_requests: circle admins see requests for their circles
CREATE POLICY "exit_requests_select_admin" ON circle_exit_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_exit_requests.circle_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'creator', 'elder')
    )
  );

-- circle_exit_requests: members can insert their own
CREATE POLICY "exit_requests_insert_own" ON circle_exit_requests
  FOR INSERT WITH CHECK (member_id = auth.uid());

-- circle_exit_requests: service role for full management
CREATE POLICY "exit_requests_service_all" ON circle_exit_requests
  FOR ALL USING (auth.role() = 'service_role');

-- substitution_records: involved parties can see
CREATE POLICY "substitution_records_select_involved" ON substitution_records
  FOR SELECT USING (
    exiting_member_id = auth.uid()
    OR substitute_member_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = substitution_records.circle_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('admin', 'creator', 'elder')
    )
  );

-- substitution_records: service role for full management
CREATE POLICY "substitution_records_service_all" ON substitution_records
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE substitute_pool;
ALTER PUBLICATION supabase_realtime ADD TABLE circle_exit_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE substitution_records;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_substitute_pool_updated_at
  BEFORE UPDATE ON substitute_pool
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_exit_requests_updated_at
  BEFORE UPDATE ON circle_exit_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_substitution_records_updated_at
  BEFORE UPDATE ON substitution_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
