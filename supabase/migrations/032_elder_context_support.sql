-- =====================================================
-- 032: ELDER CONTEXT SUPPORT
-- Adds elder-specific columns to community_memberships,
-- dispute fee/reward columns, and realtime enablement.
-- =====================================================

-- 1. Elder-specific columns on community_memberships
ALTER TABLE community_memberships
  ADD COLUMN IF NOT EXISTS honor_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS elder_tier TEXT DEFAULT 'Junior',
  ADD COLUMN IF NOT EXISTS elder_specializations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS training_credits INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS training_progress JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS elder_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_cases_resolved INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cases_success_rate DECIMAL(5,2) DEFAULT 0;

-- 2. Indexes for elder queries
CREATE INDEX IF NOT EXISTS idx_cm_elder_role
  ON community_memberships(community_id, role) WHERE role = 'elder';
CREATE INDEX IF NOT EXISTS idx_cm_honor_score
  ON community_memberships(honor_score DESC);

-- 3. Dispute fee/reward columns for elder compensation
ALTER TABLE disputes
  ADD COLUMN IF NOT EXISTS mediation_fee DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS honor_score_reward INTEGER DEFAULT 0;

-- 4. Add INSERT policy for vouch_events (may be missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'vouch_events' AND policyname = 've_insert'
  ) THEN
    CREATE POLICY "ve_insert" ON vouch_events
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM member_vouches mv
          WHERE mv.id = vouch_events.vouch_id
          AND mv.voucher_user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 5. Add UPDATE policy for disputes (for elder case assignment)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'disputes' AND policyname = 'disputes_elder_update'
  ) THEN
    CREATE POLICY "disputes_elder_update" ON disputes
      FOR UPDATE USING (
        assigned_to = auth.uid()
        OR (assigned_to IS NULL AND status = 'open')
        OR reporter_user_id = auth.uid()
      );
  END IF;
END $$;

-- 6. Ensure INSERT policy exists for elder_applications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'elder_applications' AND policyname = 'ea_insert'
  ) THEN
    CREATE POLICY "ea_insert" ON elder_applications
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 7. Ensure SELECT policy exists for disputes (elders can see open disputes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'disputes' AND policyname = 'disputes_elder_select'
  ) THEN
    CREATE POLICY "disputes_elder_select" ON disputes
      FOR SELECT USING (
        reporter_user_id = auth.uid()
        OR against_user_id = auth.uid()
        OR assigned_to = auth.uid()
        OR (status = 'open' AND assigned_to IS NULL)
      );
  END IF;
END $$;
