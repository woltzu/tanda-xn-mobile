-- ============================================
-- Migration 030: Add FK relationships from circle tables to profiles
-- Fixes PostgREST join errors for contributions, circle_members, payouts
-- ============================================

-- contributions.user_id → profiles.id
ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_user_id_fkey;
ALTER TABLE contributions
  ADD CONSTRAINT contributions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id);

-- circle_members.user_id → profiles.id
ALTER TABLE circle_members DROP CONSTRAINT IF EXISTS circle_members_user_id_fkey;
ALTER TABLE circle_members
  ADD CONSTRAINT circle_members_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id);

-- payouts.recipient_id → profiles.id
ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_recipient_id_fkey;
ALTER TABLE payouts
  ADD CONSTRAINT payouts_recipient_id_fkey
  FOREIGN KEY (recipient_id) REFERENCES profiles(id);
