-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 043: Push Notification Priority Engine
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Intelligence layer between event producers and notification delivery:
-- 1. Scored notification queue — priority scoring before delivery
-- 2. Member notification profiles — learned channel preferences & fatigue
-- 3. Template variant system — adaptive message framing per member
--
-- Tables: notification_queue, member_notification_profiles, notification_templates
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: notification_queue
-- Every platform event writes here BEFORE entering the delivery pipeline.
-- Priority engine scores, routes, and frames each item.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop legacy notification_queue (old delivery-retry schema) if it exists
DROP TABLE IF EXISTS notification_queue CASCADE;

CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Classification
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'payment_critical', 'circle_events', 'score_changes',
    'coaching_goals', 'platform_community'
  )),

  -- Scoring results (populated by priority engine)
  priority_score INTEGER,
  channel TEXT CHECK (channel IN ('push', 'sms', 'email', 'in_app')),
  template_variant_index INTEGER,

  -- Rendered content
  title TEXT,
  body TEXT,
  data JSONB DEFAULT '{}',

  -- Scheduling
  scheduled_delivery_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'scored', 'delivering', 'delivered', 'failed', 'cancelled'
  )),

  -- Delivery tracking
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Back-reference to delivered notification
  notification_id UUID REFERENCES notifications(id),

  -- Decision audit trail
  scoring_details JSONB DEFAULT '{}',
  framing_details JSONB DEFAULT '{}',

  -- Error handling
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: member_notification_profiles
-- Per-member delivery intelligence. Learned from behavioral data,
-- updated continuously as notifications are sent/opened/clicked.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS member_notification_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,

  -- Channel open rates (learned from history, 0.0000 to 1.0000)
  push_open_rate DECIMAL(5,4) DEFAULT 0.0000,
  sms_open_rate DECIMAL(5,4) DEFAULT 0.0000,
  email_open_rate DECIMAL(5,4) DEFAULT 0.0000,
  in_app_open_rate DECIMAL(5,4) DEFAULT 0.0000,

  -- Per-channel delivery counts
  push_sent INTEGER DEFAULT 0,
  push_opened INTEGER DEFAULT 0,
  push_clicked INTEGER DEFAULT 0,
  sms_sent INTEGER DEFAULT 0,
  sms_opened INTEGER DEFAULT 0,
  email_sent INTEGER DEFAULT 0,
  email_opened INTEGER DEFAULT 0,
  email_clicked INTEGER DEFAULT 0,
  in_app_sent INTEGER DEFAULT 0,
  in_app_opened INTEGER DEFAULT 0,
  in_app_clicked INTEGER DEFAULT 0,

  -- Fatigue tracking
  fatigue_score INTEGER DEFAULT 0
    CHECK (fatigue_score >= 0 AND fatigue_score <= 100),
  last_notification_at TIMESTAMPTZ,
  notifications_last_24h INTEGER DEFAULT 0,
  notifications_last_48h INTEGER DEFAULT 0,
  opens_last_48h INTEGER DEFAULT 0,

  -- Responsive time windows (hour of day 0-23, member local time)
  best_hour_push INTEGER CHECK (best_hour_push >= 0 AND best_hour_push <= 23),
  best_hour_sms INTEGER CHECK (best_hour_sms >= 0 AND best_hour_sms <= 23),
  best_hour_email INTEGER CHECK (best_hour_email >= 0 AND best_hour_email <= 23),

  -- Communication style preference (derived from engagement patterns)
  preferred_style TEXT DEFAULT 'informational' CHECK (preferred_style IN (
    'urgent', 'supportive', 'celebratory', 'informational', 'empathetic'
  )),

  -- Timezone for quiet hours calculation
  timezone TEXT DEFAULT 'UTC',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: notification_templates
-- 3-5 framing variants per notification type. AI selects variant
-- based on member stress score and engagement history.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL CHECK (notification_type IN (
    'payment_critical', 'circle_events', 'score_changes',
    'coaching_goals', 'platform_community'
  )),
  variant_index INTEGER NOT NULL,
  variant_name TEXT NOT NULL CHECK (variant_name IN (
    'urgent', 'supportive', 'celebratory', 'informational', 'empathetic'
  )),
  title_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  data_template JSONB DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(notification_type, variant_index)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER EXISTING TABLES
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS priority_score INTEGER;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS channel_used TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS template_variant TEXT;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS queue_id UUID;


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_notif_queue_member
  ON notification_queue(member_id);

CREATE INDEX IF NOT EXISTS idx_notif_queue_status
  ON notification_queue(status)
  WHERE status IN ('pending', 'scored', 'delivering');

CREATE INDEX IF NOT EXISTS idx_notif_queue_scheduled
  ON notification_queue(scheduled_delivery_time)
  WHERE status = 'scored';

CREATE INDEX IF NOT EXISTS idx_notif_queue_type
  ON notification_queue(notification_type);

CREATE INDEX IF NOT EXISTS idx_notif_profile_user
  ON member_notification_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_notif_template_type
  ON notification_templates(notification_type);

CREATE INDEX IF NOT EXISTS idx_notif_template_type_variant
  ON notification_templates(notification_type, variant_index);


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_notification_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- notification_queue: members see own items
CREATE POLICY "notif_queue_select_own" ON notification_queue
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY "notif_queue_service_all" ON notification_queue
  FOR ALL USING (auth.role() = 'service_role');

-- member_notification_profiles: members see own profile
CREATE POLICY "notif_profile_select_own" ON member_notification_profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notif_profile_service_all" ON member_notification_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- notification_templates: all authenticated users can read (public catalog)
CREATE POLICY "notif_templates_select_auth" ON notification_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "notif_templates_service_all" ON notification_templates
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE notification_queue;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_notif_queue_updated_at
  BEFORE UPDATE ON notification_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_notif_profile_updated_at
  BEFORE UPDATE ON member_notification_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ─────────────────────────────────────────────────────────────────────────────
-- SEED DATA: Notification Template Variants
-- 5 types × 5 variants = 25 templates
-- ─────────────────────────────────────────────────────────────────────────────

-- ── payment_critical ──

INSERT INTO notification_templates (notification_type, variant_index, variant_name, title_template, body_template) VALUES
('payment_critical', 0, 'urgent',
  'Payment Due in {{hours_remaining}} Hours',
  'Your {{amount}} contribution to {{circle_name}} is due soon. Tap to pay now and keep your streak alive.'),
('payment_critical', 1, 'empathetic',
  'Friendly Reminder About Your Contribution',
  '{{member_name}}, we know things can get tight. Your {{amount}} contribution to {{circle_name}} is due {{due_date}}. Tap here to split it into smaller payments if that helps.'),
('payment_critical', 2, 'supportive',
  'Your Circle Is Counting on You',
  'Your circle is counting on you — tap here to contribute {{amount}} and protect your XnScore. Your payout is {{cycles_away}} cycles away.'),
('payment_critical', 3, 'celebratory',
  'Keep Your Perfect Streak Going!',
  'You have {{streak_count}} on-time payments in a row! Your {{amount}} contribution to {{circle_name}} is due {{due_date}}. One tap keeps the streak alive.'),
('payment_critical', 4, 'informational',
  'Contribution Due: {{circle_name}}',
  'Your {{amount}} contribution to {{circle_name}} is due on {{due_date}}. Here is exactly what happens when you pay on time: your XnScore stays strong and your payout position is protected.');

-- ── circle_events ──

INSERT INTO notification_templates (notification_type, variant_index, variant_name, title_template, body_template) VALUES
('circle_events', 0, 'urgent',
  'Action Required in {{circle_name}}',
  'Something important happened in {{circle_name}}: {{event_description}}. Tap to see details.'),
('circle_events', 1, 'empathetic',
  'Circle Update: {{circle_name}}',
  'Hi {{member_name}}, here is a quick update from {{circle_name}}: {{event_description}}.'),
('circle_events', 2, 'supportive',
  'Great News from {{circle_name}}',
  'Your circle {{circle_name}} just hit a milestone: {{event_description}}. You are part of something great.'),
('circle_events', 3, 'celebratory',
  '{{circle_name}} Is Thriving!',
  'Celebration time! {{event_description}} in {{circle_name}}. Your circle community is growing stronger.'),
('circle_events', 4, 'informational',
  '{{circle_name}} Activity Update',
  'New activity in {{circle_name}}: {{event_description}}. Tap to view full details.');

-- ── score_changes ──

INSERT INTO notification_templates (notification_type, variant_index, variant_name, title_template, body_template) VALUES
('score_changes', 0, 'urgent',
  'XnScore Alert: Action Needed',
  'Your XnScore dropped {{score_change}} points to {{new_score}}. This may affect your circle eligibility. Tap to see what you can do.'),
('score_changes', 1, 'empathetic',
  'Your XnScore Changed',
  '{{member_name}}, your XnScore moved to {{new_score}} ({{score_direction}}{{score_change}}). Here is what influenced the change and how you can improve.'),
('score_changes', 2, 'supportive',
  'Your Score Is Moving in the Right Direction',
  'Your XnScore improved by {{score_change}} points to {{new_score}}. Keep up the great financial habits!'),
('score_changes', 3, 'celebratory',
  'XnScore Milestone Reached!',
  'Congratulations! Your XnScore reached {{new_score}} — that puts you in the {{score_tier}} tier. New opportunities are unlocked.'),
('score_changes', 4, 'informational',
  'XnScore Update: {{new_score}}',
  'Your XnScore is now {{new_score}} ({{score_direction}}{{score_change}}). Factors: {{change_factors}}. Tap for full breakdown.');

-- ── coaching_goals ──

INSERT INTO notification_templates (notification_type, variant_index, variant_name, title_template, body_template) VALUES
('coaching_goals', 0, 'urgent',
  'Savings Goal Deadline Approaching',
  'Your savings goal "{{goal_name}}" deadline is {{days_remaining}} days away. You are {{progress_pct}}% there — tap to make a deposit.'),
('coaching_goals', 1, 'empathetic',
  'A Gentle Nudge on Your Goal',
  '{{member_name}}, your "{{goal_name}}" goal is {{progress_pct}}% complete. Every small step counts — even a tiny deposit today keeps momentum.'),
('coaching_goals', 2, 'supportive',
  'You Are Making Great Progress',
  'Your savings goal "{{goal_name}}" is {{progress_pct}}% funded. You are on track! Just {{remaining_amount}} to go.'),
('coaching_goals', 3, 'celebratory',
  'Goal Progress Milestone!',
  'You just passed {{progress_pct}}% on your "{{goal_name}}" goal! At this rate you will reach it {{days_estimate}} days early.'),
('coaching_goals', 4, 'informational',
  'Goal Update: {{goal_name}}',
  'Progress on "{{goal_name}}": {{progress_pct}}% complete, {{remaining_amount}} remaining. Target date: {{target_date}}.');

-- ── platform_community ──

INSERT INTO notification_templates (notification_type, variant_index, variant_name, title_template, body_template) VALUES
('platform_community', 0, 'urgent',
  'Important Platform Update',
  'A critical update is available: {{update_description}}. Please review to ensure uninterrupted service.'),
('platform_community', 1, 'empathetic',
  'Something New for You',
  '{{member_name}}, we built something you might find useful: {{feature_description}}. Take a look when you have a moment.'),
('platform_community', 2, 'supportive',
  'Your Community Is Growing',
  '{{community_achievement}}. You are part of a community of {{total_members}} members building financial futures together.'),
('platform_community', 3, 'celebratory',
  'Community Milestone!',
  'The TandaXn community just reached {{milestone_description}}! Thank you for being part of this journey.'),
('platform_community', 4, 'informational',
  'Platform Update',
  '{{update_description}}. Tap to learn more about what is new.');
