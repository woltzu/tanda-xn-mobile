-- =====================================================
-- 034: EVENT LOGGING INFRASTRUCTURE
-- Captures every user action for XnScore calculation,
-- fraud detection, engagement metrics, and AI-driven
-- feature unlocking.
-- =====================================================

-- 1. User events table
CREATE TABLE IF NOT EXISTS user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Core fields
  event_type TEXT NOT NULL,                -- "screen_view", "button_tap", "login", "payment_attempt"
  event_category TEXT NOT NULL,            -- "navigation", "auth", "circle", "wallet", "loan", "elder"
  event_action TEXT NOT NULL,              -- "view", "tap", "submit", "success", "failure", "abandon"
  event_label TEXT,                        -- Context: screen name, button id, circle id, etc.
  event_value JSONB,                       -- Flexible payload: {circleId, amount, errorCode, ...}

  -- Session & device
  session_id TEXT NOT NULL,                -- UUID generated per app session
  device_type TEXT,                        -- "ios", "android", "web"
  device_info JSONB,                       -- {platform, os_version, app_version, screen_size}
  ip_address INET,                         -- For geo-lookup (not stored long-term)
  geo_city TEXT,                           -- City-level only for privacy
  geo_country TEXT,

  -- Outcome
  outcome TEXT DEFAULT 'success',          -- "success", "failure", "abandoned", "pending"
  error_code TEXT,                         -- If outcome=failure: error code
  error_message TEXT,                      -- If outcome=failure: human-readable error

  -- Timing
  duration_ms INTEGER,                     -- How long the action took (for perf tracking)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_ue_user_id ON user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ue_event_type ON user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ue_session ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_ue_created ON user_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ue_user_type_date ON user_events(user_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ue_category ON user_events(event_category);

-- 3. RLS
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;

-- Users can INSERT their own events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_events' AND policyname = 'ue_insert_own'
  ) THEN
    CREATE POLICY "ue_insert_own" ON user_events
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Users can SELECT their own events (for activity history)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_events' AND policyname = 'ue_select_own'
  ) THEN
    CREATE POLICY "ue_select_own" ON user_events
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

-- 4. Cleanup function for old events (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM user_events
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Helper view: daily event counts per user (for analytics dashboards)
CREATE OR REPLACE VIEW daily_event_summary AS
SELECT
  user_id,
  event_type,
  event_category,
  DATE(created_at) AS event_date,
  COUNT(*) AS event_count,
  COUNT(CASE WHEN outcome = 'success' THEN 1 END) AS success_count,
  COUNT(CASE WHEN outcome = 'failure' THEN 1 END) AS failure_count
FROM user_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id, event_type, event_category, DATE(created_at);

-- NOTE: Realtime is NOT enabled for user_events
-- This is a high-volume write table — no subscription needed
