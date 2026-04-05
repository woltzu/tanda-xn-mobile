-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 039: Circle Democracy Engine
-- ═══════════════════════════════════════════════════════════════════════════════
-- Structured collective decision-making for circles.
-- When a circle needs to admit a member, change payout order, handle a dispute,
-- or any other decision — AI facilitates a structured digital vote.
-- Tallies results, enforces quorum, documents the decision immutably.
--
-- Tables:
--   1. circle_governance_settings  — Per-circle governance config
--   2. circle_proposals            — Proposals with vote tallies
--   3. circle_proposal_votes       — Individual votes (one per member per proposal)
--
-- Functions:
--   1. cast_proposal_vote()        — Atomic vote + tally update
--   2. tally_proposal()            — Compute result (approved/rejected/no_quorum)
--   3. close_expired_proposals()   — Batch close overdue proposals
--
-- Pattern follows migration 017 (circle_removal_settings + removal_votes).
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: circle_governance_settings (one row per circle)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS circle_governance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL UNIQUE REFERENCES circles(id) ON DELETE CASCADE,

  -- Who can create proposals
  proposal_permission TEXT NOT NULL DEFAULT 'any_member'
    CHECK (proposal_permission IN ('creator_only', 'admins_only', 'any_member')),

  -- Voting rules
  default_quorum_pct DECIMAL(3,2) NOT NULL DEFAULT 0.50,     -- 50% of members must vote
  default_threshold_pct DECIMAL(3,2) NOT NULL DEFAULT 0.60,   -- 60% YES to pass
  critical_threshold_pct DECIMAL(3,2) NOT NULL DEFAULT 0.75,  -- 75% for dissolve/remove
  default_voting_hours INTEGER NOT NULL DEFAULT 48,            -- 48h voting window

  -- Weighted voting (optional)
  enable_weighted_voting BOOLEAN NOT NULL DEFAULT false,
  creator_vote_weight DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  admin_vote_weight DECIMAL(3,2) NOT NULL DEFAULT 1.00,

  -- Behavior
  allow_vote_change BOOLEAN NOT NULL DEFAULT false,    -- Can members change vote?
  close_on_all_voted BOOLEAN NOT NULL DEFAULT true,    -- Close early if everyone voted?
  auto_execute_approved BOOLEAN NOT NULL DEFAULT false, -- Auto-execute passed proposals?

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: circle_proposals (one row per proposal)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS circle_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES profiles(id),

  -- Proposal content
  proposal_type TEXT NOT NULL CHECK (proposal_type IN (
    'admit_member', 'remove_member', 'change_payout_order',
    'change_rules', 'resolve_dispute', 'dissolve_circle', 'custom'
  )),
  title TEXT NOT NULL,
  description TEXT,
  proposal_payload JSONB NOT NULL DEFAULT '{}',
  -- Examples:
  --   admit_member:       { "target_user_id": "uuid", "target_name": "Name" }
  --   remove_member:      { "target_user_id": "uuid", "reason": "..." }
  --   change_payout_order:{ "new_order": [{"user_id":"...", "position": 1}, ...] }
  --   change_rules:       { "changes": {"frequency": "weekly", "amount": 500} }
  --   resolve_dispute:    { "dispute_id": "uuid", "proposed_resolution": "..." }
  --   dissolve_circle:    { "reason": "...", "settlement_method": "refund_all" }
  --   custom:             { "details": "..." }

  -- Status lifecycle: draft → open → closed (or cancelled)
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'open', 'closed', 'cancelled', 'executed'
  )),

  -- Voting window
  voting_starts_at TIMESTAMPTZ,
  voting_ends_at TIMESTAMPTZ,

  -- Voting rules (snapshot from governance settings at proposal creation)
  quorum_pct DECIMAL(3,2) NOT NULL DEFAULT 0.50,
  threshold_pct DECIMAL(3,2) NOT NULL DEFAULT 0.60,
  eligible_voters INTEGER NOT NULL DEFAULT 0,

  -- Vote tallies (updated atomically by cast_proposal_vote function)
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  votes_abstain INTEGER NOT NULL DEFAULT 0,
  total_vote_weight DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  weight_for DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  weight_against DECIMAL(5,2) NOT NULL DEFAULT 0.00,

  -- Result (set when status → 'closed')
  result TEXT CHECK (result IN ('approved', 'rejected', 'no_quorum')),
  result_reason TEXT,
  closed_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  executed_by UUID REFERENCES profiles(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE: circle_proposal_votes (one vote per member per proposal)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS circle_proposal_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES circle_proposals(id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES profiles(id),

  vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
  vote_weight DECIMAL(3,2) NOT NULL DEFAULT 1.00,
  reasoning TEXT,

  voted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One vote per member per proposal
  UNIQUE(proposal_id, voter_id)
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

-- circle_governance_settings
CREATE INDEX IF NOT EXISTS idx_governance_circle ON circle_governance_settings(circle_id);

-- circle_proposals
CREATE INDEX IF NOT EXISTS idx_proposals_circle ON circle_proposals(circle_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON circle_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_type ON circle_proposals(proposal_type);
CREATE INDEX IF NOT EXISTS idx_proposals_circle_status ON circle_proposals(circle_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_voting_ends ON circle_proposals(voting_ends_at)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_proposals_proposer ON circle_proposals(proposer_id);

-- circle_proposal_votes
CREATE INDEX IF NOT EXISTS idx_proposal_votes_proposal ON circle_proposal_votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_votes_voter ON circle_proposal_votes(voter_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE circle_governance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_proposal_votes ENABLE ROW LEVEL SECURITY;

-- circle_governance_settings: circle members can read, service role can do all
CREATE POLICY "governance_select_circle_member" ON circle_governance_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_governance_settings.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "governance_service_all" ON circle_governance_settings
  FOR ALL USING (auth.role() = 'service_role');

-- circle_proposals: circle members can read, active members can insert
CREATE POLICY "proposals_select_circle_member" ON circle_proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_proposals.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "proposals_insert_circle_member" ON circle_proposals
  FOR INSERT WITH CHECK (
    proposer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM circle_members cm
      WHERE cm.circle_id = circle_proposals.circle_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "proposals_service_all" ON circle_proposals
  FOR ALL USING (auth.role() = 'service_role');

-- circle_proposal_votes: circle members can read, own vote insert/update
CREATE POLICY "votes_select_circle_member" ON circle_proposal_votes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM circle_proposals p
      JOIN circle_members cm ON cm.circle_id = p.circle_id
      WHERE p.id = circle_proposal_votes.proposal_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

CREATE POLICY "votes_insert_own" ON circle_proposal_votes
  FOR INSERT WITH CHECK (voter_id = auth.uid());

CREATE POLICY "votes_update_own" ON circle_proposal_votes
  FOR UPDATE USING (voter_id = auth.uid());

CREATE POLICY "votes_service_all" ON circle_proposal_votes
  FOR ALL USING (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE circle_proposals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS: updated_at
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER circle_governance_settings_updated_at
  BEFORE UPDATE ON circle_governance_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER circle_proposals_updated_at
  BEFORE UPDATE ON circle_proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER circle_proposal_votes_updated_at
  BEFORE UPDATE ON circle_proposal_votes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: tally_proposal(p_proposal_id UUID)
-- Computes voting result: approved, rejected, or no_quorum.
-- Called when voting window closes or all members have voted.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION tally_proposal(p_proposal_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_proposal RECORD;
  v_total_votes INTEGER;
  v_quorum_needed INTEGER;
  v_result TEXT;
  v_reason TEXT;
  v_weight_ratio DECIMAL;
BEGIN
  -- Get proposal
  SELECT * INTO v_proposal FROM circle_proposals WHERE id = p_proposal_id;

  IF v_proposal IS NULL THEN
    RAISE EXCEPTION 'Proposal not found: %', p_proposal_id;
  END IF;

  -- Skip if already closed
  IF v_proposal.status = 'closed' THEN
    RETURN v_proposal.result;
  END IF;

  -- Calculate totals
  v_total_votes := v_proposal.votes_for + v_proposal.votes_against + v_proposal.votes_abstain;
  v_quorum_needed := CEIL(v_proposal.eligible_voters * v_proposal.quorum_pct);

  -- Check quorum
  IF v_total_votes < v_quorum_needed THEN
    v_result := 'no_quorum';
    v_reason := format('Quorum not met: %s of %s required votes (%s eligible)',
      v_total_votes, v_quorum_needed, v_proposal.eligible_voters);
  ELSE
    -- Check threshold (using weighted votes if available, else simple count)
    IF v_proposal.total_vote_weight > 0 THEN
      -- Weighted: weight_for / (weight_for + weight_against)
      IF (v_proposal.weight_for + v_proposal.weight_against) > 0 THEN
        v_weight_ratio := v_proposal.weight_for / (v_proposal.weight_for + v_proposal.weight_against);
      ELSE
        v_weight_ratio := 0;
      END IF;
    ELSE
      -- Simple: votes_for / (votes_for + votes_against)
      IF (v_proposal.votes_for + v_proposal.votes_against) > 0 THEN
        v_weight_ratio := v_proposal.votes_for::DECIMAL / (v_proposal.votes_for + v_proposal.votes_against);
      ELSE
        v_weight_ratio := 0;
      END IF;
    END IF;

    IF v_weight_ratio >= v_proposal.threshold_pct THEN
      v_result := 'approved';
      v_reason := format('Approved: %.0f%% in favor (%s needed)',
        v_weight_ratio * 100, v_proposal.threshold_pct * 100);
    ELSE
      v_result := 'rejected';
      v_reason := format('Rejected: %.0f%% in favor (%s%% needed)',
        v_weight_ratio * 100, v_proposal.threshold_pct * 100);
    END IF;
  END IF;

  -- Update proposal
  UPDATE circle_proposals SET
    status = 'closed',
    result = v_result,
    result_reason = v_reason,
    closed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_proposal_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: cast_proposal_vote(p_proposal_id, p_voter_id, p_vote, p_reasoning)
-- Atomic vote casting + tally update.
-- Validates proposal is open, voter is eligible, handles vote changes.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION cast_proposal_vote(
  p_proposal_id UUID,
  p_voter_id UUID,
  p_vote TEXT,
  p_reasoning TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_proposal RECORD;
  v_settings RECORD;
  v_member RECORD;
  v_existing_vote RECORD;
  v_vote_weight DECIMAL(3,2) := 1.00;
  v_total_voted INTEGER;
  v_result TEXT;
BEGIN
  -- Validate vote value
  IF p_vote NOT IN ('yes', 'no', 'abstain') THEN
    RAISE EXCEPTION 'Invalid vote: %. Must be yes, no, or abstain.', p_vote;
  END IF;

  -- Get proposal (must be open)
  SELECT * INTO v_proposal FROM circle_proposals WHERE id = p_proposal_id;
  IF v_proposal IS NULL THEN
    RAISE EXCEPTION 'Proposal not found';
  END IF;
  IF v_proposal.status != 'open' THEN
    RAISE EXCEPTION 'Proposal is not open for voting (status: %)', v_proposal.status;
  END IF;
  IF v_proposal.voting_ends_at IS NOT NULL AND v_proposal.voting_ends_at <= NOW() THEN
    RAISE EXCEPTION 'Voting period has ended';
  END IF;

  -- Check voter is active circle member
  SELECT * INTO v_member FROM circle_members
  WHERE circle_id = v_proposal.circle_id AND user_id = p_voter_id AND status = 'active';
  IF v_member IS NULL THEN
    RAISE EXCEPTION 'Voter is not an active circle member';
  END IF;

  -- Get governance settings for weighted voting
  SELECT * INTO v_settings FROM circle_governance_settings
  WHERE circle_id = v_proposal.circle_id;

  IF v_settings IS NOT NULL AND v_settings.enable_weighted_voting THEN
    IF v_member.role = 'creator' THEN
      v_vote_weight := v_settings.creator_vote_weight;
    ELSIF v_member.role = 'admin' THEN
      v_vote_weight := v_settings.admin_vote_weight;
    END IF;
  END IF;

  -- Check for existing vote
  SELECT * INTO v_existing_vote FROM circle_proposal_votes
  WHERE proposal_id = p_proposal_id AND voter_id = p_voter_id;

  IF v_existing_vote IS NOT NULL THEN
    -- Vote exists — check if changes allowed
    IF v_settings IS NOT NULL AND NOT v_settings.allow_vote_change THEN
      RAISE EXCEPTION 'Vote changes are not allowed for this circle';
    END IF;

    -- Decrement old vote tallies
    UPDATE circle_proposals SET
      votes_for = votes_for - CASE WHEN v_existing_vote.vote = 'yes' THEN 1 ELSE 0 END,
      votes_against = votes_against - CASE WHEN v_existing_vote.vote = 'no' THEN 1 ELSE 0 END,
      votes_abstain = votes_abstain - CASE WHEN v_existing_vote.vote = 'abstain' THEN 1 ELSE 0 END,
      total_vote_weight = total_vote_weight - v_existing_vote.vote_weight,
      weight_for = weight_for - CASE WHEN v_existing_vote.vote = 'yes' THEN v_existing_vote.vote_weight ELSE 0 END,
      weight_against = weight_against - CASE WHEN v_existing_vote.vote = 'no' THEN v_existing_vote.vote_weight ELSE 0 END
    WHERE id = p_proposal_id;

    -- Update the vote
    UPDATE circle_proposal_votes SET
      vote = p_vote,
      vote_weight = v_vote_weight,
      reasoning = COALESCE(p_reasoning, reasoning),
      updated_at = NOW()
    WHERE id = v_existing_vote.id;
  ELSE
    -- Insert new vote
    INSERT INTO circle_proposal_votes (proposal_id, voter_id, vote, vote_weight, reasoning)
    VALUES (p_proposal_id, p_voter_id, p_vote, v_vote_weight, p_reasoning);
  END IF;

  -- Increment new vote tallies
  UPDATE circle_proposals SET
    votes_for = votes_for + CASE WHEN p_vote = 'yes' THEN 1 ELSE 0 END,
    votes_against = votes_against + CASE WHEN p_vote = 'no' THEN 1 ELSE 0 END,
    votes_abstain = votes_abstain + CASE WHEN p_vote = 'abstain' THEN 1 ELSE 0 END,
    total_vote_weight = total_vote_weight + v_vote_weight,
    weight_for = weight_for + CASE WHEN p_vote = 'yes' THEN v_vote_weight ELSE 0 END,
    weight_against = weight_against + CASE WHEN p_vote = 'no' THEN v_vote_weight ELSE 0 END,
    updated_at = NOW()
  WHERE id = p_proposal_id;

  -- Check if all eligible members have voted → early close
  IF v_settings IS NOT NULL AND v_settings.close_on_all_voted THEN
    SELECT COUNT(*) INTO v_total_voted FROM circle_proposal_votes
    WHERE proposal_id = p_proposal_id;

    -- Re-read proposal for updated counts
    SELECT * INTO v_proposal FROM circle_proposals WHERE id = p_proposal_id;

    IF v_total_voted >= v_proposal.eligible_voters THEN
      v_result := tally_proposal(p_proposal_id);
      RETURN jsonb_build_object(
        'success', true, 'vote', p_vote, 'weight', v_vote_weight,
        'early_close', true, 'result', v_result
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'vote', p_vote, 'weight', v_vote_weight,
    'early_close', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ═══════════════════════════════════════════════════════════════════════════════
-- FUNCTION: close_expired_proposals()
-- Batch closes all proposals past their voting deadline.
-- Called by cron or manually.
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION close_expired_proposals()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_proposal RECORD;
BEGIN
  FOR v_proposal IN
    SELECT id FROM circle_proposals
    WHERE status = 'open'
      AND voting_ends_at IS NOT NULL
      AND voting_ends_at <= NOW()
  LOOP
    BEGIN
      PERFORM tally_proposal(v_proposal.id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'tally_proposal failed for %: %', v_proposal.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
