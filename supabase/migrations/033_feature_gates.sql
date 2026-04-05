-- =====================================================
-- 033: FEATURE GATE ARCHITECTURE
-- Central permissions system: "Can member X access feature Y?"
-- Returns yes/no with reason codes that power unlock UI.
-- =====================================================

-- 1. Feature gate definitions table
CREATE TABLE IF NOT EXISTS feature_gates (
  id TEXT PRIMARY KEY,                          -- e.g. "circles.join_public", "loans.mortgage"
  name TEXT NOT NULL,                           -- Human-readable: "Join Public Circles"
  description TEXT,                             -- Longer explanation
  category TEXT NOT NULL,                       -- "circles", "loans", "elder", "goals", "wallet", etc.

  -- Gate conditions (NULL = no requirement for that dimension)
  min_xn_score INTEGER,                         -- Minimum XnScore (0-100)
  min_honor_score INTEGER,                      -- Minimum honor score
  min_circles_completed INTEGER,                -- Minimum circles completed
  min_account_age_days INTEGER,                 -- Minimum account age in days
  required_role TEXT,                           -- Minimum community role: elder, moderator, admin, owner
  requires_id_verified BOOLEAN DEFAULT FALSE,
  requires_income_verified BOOLEAN DEFAULT FALSE,
  min_token_balance INTEGER,                    -- Minimum token balance
  custom_rule JSONB,                            -- Extensible: {"max_defaults": 0, "min_on_time_pct": 80}

  -- Reason & unlock messaging
  reason_code TEXT NOT NULL,                    -- Primary reason: "score_too_low", "needs_verification"
  blocked_title TEXT NOT NULL,                  -- "Score Too Low"
  blocked_message TEXT NOT NULL,                -- "You need XnScore 45+ to access this feature"
  unlock_hint TEXT NOT NULL,                    -- "Keep making on-time payments to improve your score"

  -- Display
  icon TEXT DEFAULT 'lock-closed',              -- Ionicons name for blocked state
  color TEXT DEFAULT '#F59E0B',                 -- Accent color for blocked UI

  -- Admin controls
  enabled BOOLEAN DEFAULT TRUE,                 -- Master kill switch per feature
  is_premium BOOLEAN DEFAULT FALSE,             -- Future: paid tier features
  display_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Per-user overrides (admin grants/blocks)
CREATE TABLE IF NOT EXISTS user_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature_gate_id TEXT NOT NULL REFERENCES feature_gates(id) ON DELETE CASCADE,
  access_granted BOOLEAN NOT NULL,              -- TRUE = force allow, FALSE = force block
  reason TEXT,                                  -- "Manually granted by admin", "Beta tester"
  granted_by UUID REFERENCES profiles(id),
  expires_at TIMESTAMPTZ,                       -- NULL = permanent
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_gate_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_fg_category ON feature_gates(category);
CREATE INDEX IF NOT EXISTS idx_fg_enabled ON feature_gates(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_ufo_user ON user_feature_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_ufo_user_feature ON user_feature_overrides(user_id, feature_gate_id);
CREATE INDEX IF NOT EXISTS idx_ufo_expires ON user_feature_overrides(expires_at) WHERE expires_at IS NOT NULL;

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION update_feature_gates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_feature_gates_updated_at ON feature_gates;
CREATE TRIGGER trg_feature_gates_updated_at
  BEFORE UPDATE ON feature_gates
  FOR EACH ROW EXECUTE FUNCTION update_feature_gates_updated_at();

-- 5. RLS
ALTER TABLE feature_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_overrides ENABLE ROW LEVEL SECURITY;

-- feature_gates: readable by all authenticated users (reference table)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'feature_gates' AND policyname = 'fg_select_authenticated'
  ) THEN
    CREATE POLICY "fg_select_authenticated" ON feature_gates
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- user_feature_overrides: users can only see their own overrides
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_feature_overrides' AND policyname = 'ufo_select_own'
  ) THEN
    CREATE POLICY "ufo_select_own" ON user_feature_overrides
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- 6. Enable realtime for both tables
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE feature_gates;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already added
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_feature_overrides;
  EXCEPTION WHEN duplicate_object THEN
    NULL; -- already added
  END;
END $$;

-- =====================================================
-- 7. SEED DATA — Initial feature gates
-- =====================================================

-- CIRCLES
INSERT INTO feature_gates (id, name, description, category, min_xn_score, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('circles.browse_public', 'Browse Public Circles', 'View and search public circles available to join', 'circles', 45, 'score_too_low', 'Score Too Low', 'You need XnScore 45+ to browse public circles. Currently you can only join circles with people from your contacts.', 'Complete your current circles on time to boost your score', 'search', '#3B82F6', 1),
('circles.join_public', 'Join Public Circles', 'Join any public circle without an invitation', 'circles', 45, 'score_too_low', 'Score Too Low', 'You need XnScore 45+ to join public circles. Ask a trusted member to invite you instead.', 'Keep making on-time contributions to improve your score', 'people', '#3B82F6', 2),
('circles.join_invitation', 'Join via Invitation', 'Accept circle invitations from other members', 'circles', 25, 'score_too_low', 'Score Too Low', 'You need XnScore 25+ to accept circle invitations.', 'Complete your profile and verify your phone number to build initial trust', 'mail', '#3B82F6', 3),
('circles.vouch', 'Vouch for Members', 'Vouch for other members to help them join circles', 'circles', 75, 'score_too_low', 'Cannot Vouch Yet', 'You need XnScore 75+ to vouch for other members. Vouching puts your reputation on the line.', 'Maintain perfect payment history to reach Preferred trust tier', 'hand-right', '#8B5CF6', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_gates (id, name, description, category, min_xn_score, min_circles_completed, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('circles.create', 'Create a Circle', 'Start your own savings circle and invite members', 'circles', 60, 1, 'score_too_low', 'Not Yet Eligible', 'You need XnScore 60+ and at least 1 completed circle to create your own circle.', 'Join and complete your first circle to prove reliability', 'add-circle', '#3B82F6', 4)
ON CONFLICT (id) DO NOTHING;

-- LOANS
INSERT INTO feature_gates (id, name, description, category, min_xn_score, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('loans.small_advance', 'Quick Advance', 'Get a small advance ($50-$1,000) on your upcoming payout', 'loans', 45, 'score_too_low', 'Score Too Low', 'You need XnScore 45+ to apply for a Quick Advance.', 'Complete circles and maintain on-time payments to unlock lending', 'flash', '#10B981', 10)
ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_gates (id, name, description, category, min_xn_score, requires_income_verified, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('loans.medium', 'Medium Loan', 'Apply for loans $1,000-$10,000 for education, business, or medical needs', 'loans', 60, TRUE, 'score_too_low', 'Not Yet Eligible', 'Medium loans require XnScore 60+ and verified income. Build your score and verify your income to unlock.', 'Link your bank account or upload income proof in Settings', 'cash', '#10B981', 11)
ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_gates (id, name, description, category, min_xn_score, requires_income_verified, requires_id_verified, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('loans.mortgage', 'Mortgage / Large Loan', 'Apply for home loans and large purchases ($10,000-$100,000)', 'loans', 75, TRUE, TRUE, 'score_too_low', 'Premium Feature', 'Mortgages require XnScore 75+, verified income, and verified ID. This is the highest trust tier.', 'Reach Preferred trust level with verified income and ID', 'home', '#8B5CF6', 12)
ON CONFLICT (id) DO NOTHING;

-- ELDER
INSERT INTO feature_gates (id, name, description, category, min_xn_score, min_circles_completed, min_account_age_days, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('elder.apply', 'Apply to Become Elder', 'Submit an application to become a community elder and mediator', 'elder', 60, 3, 90, 'score_too_low', 'Not Yet Eligible', 'Elder applications require XnScore 60+, 3+ completed circles, and 90+ days membership.', 'Build your track record: complete more circles and maintain your score', 'shield-checkmark', '#F59E0B', 20)
ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_gates (id, name, description, category, min_xn_score, required_role, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('elder.vouch_others', 'Elder Vouching', 'Vouch for new members as an elder with enhanced vouch weight', 'elder', 75, 'elder', 'not_elder', 'Elder Access Only', 'Only approved elders with XnScore 75+ can provide elder-level vouches.', 'Apply to become an elder first, then build your honor score', 'ribbon', '#F59E0B', 21),
('elder.mediate', 'Mediate Disputes', 'Accept and resolve community disputes as a mediator', 'elder', 60, 'elder', 'not_elder', 'Elder Access Only', 'Only approved elders can mediate disputes. Apply to become an elder first.', 'Complete your elder application and training to start mediating', 'gavel', '#F59E0B', 22)
ON CONFLICT (id) DO NOTHING;

-- GOALS / SAVINGS
INSERT INTO feature_gates (id, name, description, category, min_xn_score, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('goals.create', 'Create Savings Goal', 'Set up a new personal savings goal', 'goals', 0, 'score_too_low', 'Feature Unavailable', 'This feature is currently unavailable.', 'Contact support for help', 'flag', '#10B981', 30),
('goals.locked_savings', 'Locked Savings', 'Create fixed-deposit locked savings goals with the highest interest rate (6%)', 'goals', 45, 'score_too_low', 'Score Too Low', 'Locked savings require XnScore 45+. Higher trust means access to better interest rates.', 'Build your score to unlock locked savings with 6% interest', 'lock-closed', '#10B981', 31)
ON CONFLICT (id) DO NOTHING;

-- WALLET
INSERT INTO feature_gates (id, name, description, category, min_xn_score, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('wallet.send', 'Send Money', 'Send money to other TandaXn members', 'wallet', 25, 'score_too_low', 'Score Too Low', 'You need XnScore 25+ to send money. Complete your profile to get started.', 'Verify your phone and email to build initial trust', 'send', '#3B82F6', 40)
ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_gates (id, name, description, category, min_xn_score, requires_id_verified, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('wallet.withdraw', 'Withdraw to Bank', 'Withdraw funds from your wallet to a linked bank account', 'wallet', 25, TRUE, 'needs_verification', 'ID Verification Required', 'Bank withdrawals require ID verification for security. Verify your identity in Settings.', 'Complete ID verification in Settings > Identity to unlock withdrawals', 'download', '#3B82F6', 41)
ON CONFLICT (id) DO NOTHING;

-- CROSS-BORDER
INSERT INTO feature_gates (id, name, description, category, min_xn_score, requires_id_verified, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('cross_border.send', 'International Transfer', 'Send money internationally to family and friends', 'cross-border', 45, TRUE, 'score_too_low', 'Not Yet Eligible', 'International transfers require XnScore 45+ and verified ID for compliance.', 'Build your score and verify your ID to send money abroad', 'globe', '#6366F1', 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_gates (id, name, description, category, min_xn_score, requires_id_verified, requires_income_verified, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('cross_border.large_transfer', 'Large International Transfer', 'Send large amounts ($5,000+) internationally', 'cross-border', 60, TRUE, TRUE, 'needs_verification', 'Additional Verification Required', 'Large transfers require XnScore 60+, verified ID, and verified income for regulatory compliance.', 'Verify your income source in Settings to unlock large transfers', 'globe', '#6366F1', 51)
ON CONFLICT (id) DO NOTHING;

-- COMMUNITY
INSERT INTO feature_gates (id, name, description, category, min_xn_score, min_circles_completed, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('community.create', 'Create Community', 'Start your own TandaXn community', 'community', 75, 5, 'score_too_low', 'Not Yet Eligible', 'Creating a community requires XnScore 75+ and 5+ completed circles. Prove leadership through participation.', 'Complete more circles and maintain high trust to unlock community creation', 'planet', '#8B5CF6', 60)
ON CONFLICT (id) DO NOTHING;

INSERT INTO feature_gates (id, name, description, category, min_xn_score, required_role, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('community.moderate', 'Moderate Community', 'Access moderation tools for community management', 'community', 60, 'moderator', 'insufficient_role', 'Moderator Access Required', 'Moderation tools are only available to community moderators, admins, and owners.', 'Ask a community admin to promote you to moderator', 'settings', '#8B5CF6', 61)
ON CONFLICT (id) DO NOTHING;

-- TOKENS
INSERT INTO feature_gates (id, name, description, category, min_xn_score, min_token_balance, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('tokens.redeem', 'Redeem Tokens', 'Convert earned tokens to wallet balance or rewards', 'tokens', 25, 100, 'insufficient_tokens', 'Insufficient Tokens', 'You need at least 100 tokens to redeem. Earn tokens by completing circles, vouching, and mediating.', 'Participate actively in circles and community to earn more tokens', 'gift', '#F59E0B', 70)
ON CONFLICT (id) DO NOTHING;

-- UNIVERSAL ACCESS (score 0 = everyone)
INSERT INTO feature_gates (id, name, description, category, min_xn_score, reason_code, blocked_title, blocked_message, unlock_hint, icon, color, display_order) VALUES
('score.view_detailed', 'View XnScore Details', 'Access detailed XnScore breakdown and history', 'score', 0, 'feature_disabled', 'Feature Unavailable', 'This feature is currently unavailable.', 'Contact support', 'analytics', '#3B82F6', 80),
('settings.export_data', 'Export Your Data', 'Download a copy of all your TandaXn data', 'settings', 0, 'feature_disabled', 'Feature Unavailable', 'This feature is currently unavailable.', 'Contact support', 'download', '#6B7280', 81),
('dashboard.full', 'Full Dashboard', 'Access the complete dashboard with all widgets', 'dashboard', 0, 'feature_disabled', 'Feature Unavailable', 'This feature is currently unavailable.', 'Contact support', 'grid', '#3B82F6', 82)
ON CONFLICT (id) DO NOTHING;
