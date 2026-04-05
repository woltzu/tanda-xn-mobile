-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 042: Dynamic Payout Ordering
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Extends the existing PayoutOrderService (migration 010) with:
-- 1. Stability-optimized ordering — evaluates many candidate orderings
-- 2. Rich position explanations — privacy-preserving per-member reasoning
-- 3. Mid-cycle reordering protocol — trigger-based reordering workflow
-- 4. Cultural priority signals — elder/organizer consideration
--
-- Tables: stability_optimization_runs, payout_position_explanations,
--         midcycle_reorder_requests, cultural_priority_signals
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: stability_optimization_runs
-- Records each stability optimization run and its results.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stability_optimization_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  payout_order_id UUID REFERENCES payout_orders(id),

  -- Algorithm metadata
  algorithm_version TEXT NOT NULL DEFAULT 'stability_v1',
  candidates_evaluated INTEGER NOT NULL,

  -- Stability scores
  best_stability_score DECIMAL(8,4) NOT NULL,
  worst_stability_score DECIMAL(8,4),
  mean_stability_score DECIMAL(8,4),

  -- Results
  selected_ordering JSONB NOT NULL,
  stability_breakdown JSONB NOT NULL,    -- {collapseProb, engagementRetention, riskDistribution, contributionContinuity}
  risk_model_inputs JSONB,               -- default_probability per member snapshot

  computation_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: payout_position_explanations
-- Rich, privacy-preserving per-member explanations for position assignment.
-- Members can only see their OWN explanation (enforced via RLS).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payout_position_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_order_id UUID NOT NULL REFERENCES payout_orders(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Position details
  position INTEGER NOT NULL,
  eligible_range_min INTEGER NOT NULL,
  eligible_range_max INTEGER NOT NULL,

  -- Explanation content
  explanation_components JSONB NOT NULL DEFAULT '[]',  -- [{component, description, impact}]
  summary_text TEXT NOT NULL,                          -- privacy-safe 2-3 sentence paragraph

  privacy_redacted BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(payout_order_id, user_id)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: midcycle_reorder_requests
-- Tracks mid-cycle reorder triggers and their workflow status.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS midcycle_reorder_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

  -- Trigger info
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'emergency_need', 'risk_spike', 'member_removal',
    'democracy_vote', 'admin_override'
  )),
  triggered_by UUID REFERENCES profiles(id),
  trigger_details JSONB NOT NULL DEFAULT '{}',

  -- Democracy integration (NULL for emergency bypass)
  proposal_id UUID REFERENCES circle_proposals(id),

  -- Workflow status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'awaiting_vote', 'approved', 'executing',
    'completed', 'rejected', 'cancelled'
  )),

  -- Order snapshots
  previous_order_snapshot JSONB NOT NULL,
  new_order_data JSONB,
  affected_members UUID[],

  notification_sent BOOLEAN DEFAULT false,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: cultural_priority_signals
-- Optional social/cultural priority per member per circle.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cultural_priority_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,

  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'elder_status', 'community_leader', 'organizer_priority',
    'ceremony_host', 'custom'
  )),
  priority_weight DECIMAL(4,3) NOT NULL DEFAULT 0.000
    CHECK (priority_weight >= 0 AND priority_weight <= 0.100),

  granted_by UUID REFERENCES profiles(id),
  reason TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, circle_id, signal_type)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER EXISTING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

-- payout_orders: add stability tracking
ALTER TABLE payout_orders
  ADD COLUMN IF NOT EXISTS stability_score DECIMAL(8,4);

ALTER TABLE payout_orders
  ADD COLUMN IF NOT EXISTS optimization_run_id UUID;

ALTER TABLE payout_orders
  ADD COLUMN IF NOT EXISTS reorder_count INTEGER DEFAULT 0;

-- payout_algorithm_config: add dynamic ordering settings
ALTER TABLE payout_algorithm_config
  ADD COLUMN IF NOT EXISTS stability_weight DECIMAL(4,3) DEFAULT 0.000;

ALTER TABLE payout_algorithm_config
  ADD COLUMN IF NOT EXISTS candidate_count INTEGER DEFAULT 500;

ALTER TABLE payout_algorithm_config
  ADD COLUMN IF NOT EXISTS risk_engagement_model TEXT DEFAULT 'counterintuitive';

ALTER TABLE payout_algorithm_config
  ADD COLUMN IF NOT EXISTS cultural_priority_enabled BOOLEAN DEFAULT false;

ALTER TABLE payout_algorithm_config
  ADD COLUMN IF NOT EXISTS midcycle_reorder_enabled BOOLEAN DEFAULT false;

ALTER TABLE payout_algorithm_config
  ADD COLUMN IF NOT EXISTS midcycle_emergency_bypass BOOLEAN DEFAULT true;


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_stability_runs_circle
  ON stability_optimization_runs(circle_id);

CREATE INDEX IF NOT EXISTS idx_position_explanations_order
  ON payout_position_explanations(payout_order_id);

CREATE INDEX IF NOT EXISTS idx_position_explanations_user
  ON payout_position_explanations(user_id, circle_id);

CREATE INDEX IF NOT EXISTS idx_midcycle_reorder_circle
  ON midcycle_reorder_requests(circle_id);

CREATE INDEX IF NOT EXISTS idx_midcycle_reorder_status
  ON midcycle_reorder_requests(status)
  WHERE status IN ('pending', 'awaiting_vote', 'executing');

CREATE INDEX IF NOT EXISTS idx_cultural_priority_circle
  ON cultural_priority_signals(circle_id);

CREATE INDEX IF NOT EXISTS idx_cultural_priority_user
  ON cultural_priority_signals(user_id, circle_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE stability_optimization_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_position_explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE midcycle_reorder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cultural_priority_signals ENABLE ROW LEVEL SECURITY;

-- stability_optimization_runs: circle admins/elders can read
CREATE POLICY "stability_runs_select_admin" ON stability_optimization_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = stability_optimization_runs.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
        AND cm.role IN ('creator', 'admin', 'elder')
    )
  );

CREATE POLICY "stability_runs_service_all" ON stability_optimization_runs
  FOR ALL USING (auth.role() = 'service_role');

-- payout_position_explanations: members see ONLY their own (privacy)
CREATE POLICY "explanations_select_own" ON payout_position_explanations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "explanations_service_all" ON payout_position_explanations
  FOR ALL USING (auth.role() = 'service_role');

-- midcycle_reorder_requests: circle members can read
CREATE POLICY "reorder_select_circle_member" ON midcycle_reorder_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = midcycle_reorder_requests.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "reorder_service_all" ON midcycle_reorder_requests
  FOR ALL USING (auth.role() = 'service_role');

-- cultural_priority_signals: circle members can read
CREATE POLICY "cultural_select_circle_member" ON cultural_priority_signals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = cultural_priority_signals.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "cultural_service_all" ON cultural_priority_signals
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE midcycle_reorder_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE payout_position_explanations;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_midcycle_reorder_updated_at
  BEFORE UPDATE ON midcycle_reorder_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
