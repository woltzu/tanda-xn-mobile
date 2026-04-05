-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 048: Partial Contribution Mode
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Instead of binary pay-or-default, members can contribute 50% now with the
-- remaining 50% split 25/25 across the next two cycles. Insurance pool covers
-- the shortfall temporarily. No XnScore penalty if catch-up payments are on time.
--
-- Changes: ALTER cycle_contributions (3 new columns)
-- Tables: partial_contribution_plans
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER cycle_contributions — add partial contribution columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE cycle_contributions
  ADD COLUMN IF NOT EXISTS is_partial BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE cycle_contributions
  ADD COLUMN IF NOT EXISTS partial_plan_id UUID;

ALTER TABLE cycle_contributions
  ADD COLUMN IF NOT EXISTS contribution_type TEXT NOT NULL DEFAULT 'regular'
    CHECK (contribution_type IN ('regular', 'partial', 'catch_up'));


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: partial_contribution_plans
-- Tracks each partial contribution plan lifecycle.
-- 50/25/25 split with catch-up schedule across next two cycles.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS partial_contribution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  cycle_id UUID NOT NULL REFERENCES circle_cycles(id) ON DELETE CASCADE,

  -- Amounts in cents for precision
  original_amount_cents INTEGER NOT NULL,
  paid_amount_cents INTEGER NOT NULL,
  remaining_amount_cents INTEGER NOT NULL,

  -- Catch-up schedule: array of {cycle_number, amount_cents, due_date, contribution_id, status}
  -- status per item: 'scheduled', 'paid', 'late', 'defaulted'
  catch_up_schedule JSONB NOT NULL DEFAULT '[]',

  -- Fee: $0 first use per year, $10 (1000 cents) second use
  fee_cents INTEGER NOT NULL DEFAULT 0,
  uses_this_year INTEGER NOT NULL DEFAULT 1,

  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'active', 'completed', 'defaulted', 'cancelled'
  )),

  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- Add FK from cycle_contributions to partial_contribution_plans
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE cycle_contributions
  ADD CONSTRAINT fk_cycle_contributions_partial_plan
  FOREIGN KEY (partial_plan_id)
  REFERENCES partial_contribution_plans(id)
  ON DELETE SET NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_partial_plans_member
  ON partial_contribution_plans(member_id, activated_at DESC);

CREATE INDEX IF NOT EXISTS idx_partial_plans_circle
  ON partial_contribution_plans(circle_id, status);

CREATE INDEX IF NOT EXISTS idx_partial_plans_status
  ON partial_contribution_plans(status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_cycle_contributions_partial
  ON cycle_contributions(partial_plan_id)
  WHERE partial_plan_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE partial_contribution_plans ENABLE ROW LEVEL SECURITY;

-- Members can see their own plans
CREATE POLICY "partial_plans_select_own" ON partial_contribution_plans
  FOR SELECT USING (member_id = auth.uid());

-- Service role manages all operations
CREATE POLICY "partial_plans_service_all" ON partial_contribution_plans
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE partial_contribution_plans;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_partial_plans_updated_at
  BEFORE UPDATE ON partial_contribution_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
