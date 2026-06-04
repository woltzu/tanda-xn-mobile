-- ════════════════════════════════════════════════════════════════════════════
-- Migration 087: login_events table for Stress Signal C (login_drop)
-- ════════════════════════════════════════════════════════════════════════════
-- Captures one row per user "app open" (SIGNED_IN or INITIAL_SESSION events
-- from supabase.auth.onAuthStateChange in the mobile client). The login-drop-
-- cron (migration 088 + EF) reads this to compute rolling 7d-vs-30d login
-- frequency for each user and writes member_stress_signals rows when the
-- drop crosses the threshold.
--
-- Why client-side insert vs an auth webhook:
--   Per the agreed plan (Option A): client-side insert from AuthContext is
--   easier to ship and good enough for MVP. A future iteration could move
--   this to a Supabase Auth Hook (after_signin) so it can't be skipped by
--   a malicious client; for now the trade-off is acceptable because the
--   signal only feeds into proactive support nudges, not access control.
--
-- FK references auth.users(id) — that's where the supabase.auth user IDs
-- live. Note: member_stress_signals.member_id references profiles(id), so
-- the cron RPC needs to skip users without a profile (defense against a
-- mismatched account state). Same FK consistency guard as in Signal B.
-- ════════════════════════════════════════════════════════════════════════════


CREATE TABLE IF NOT EXISTS login_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- session_id de-dupes repeated INITIAL_SESSION fires within a single
  -- session (RN reloads, biometric unlocks, etc.). If null, treated as a
  -- distinct event.
  session_id  TEXT,
  source      TEXT NOT NULL DEFAULT 'auth_state_change'
              CHECK (source IN ('auth_state_change','signin_form','signup_form','test')),
  platform    TEXT,  -- 'ios' / 'android' / 'web' / null
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_login_events_user_recent
  ON login_events(user_id, login_at DESC);

-- Used by the cron's per-user aggregation window scan.
CREATE INDEX IF NOT EXISTS idx_login_events_login_at
  ON login_events(login_at DESC);

-- Same-session dedup (one event per session_id per user). Partial because
-- session_id is nullable for events that don't carry one.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_login_events_session
  ON login_events(user_id, session_id)
  WHERE session_id IS NOT NULL;

-- ─── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE login_events ENABLE ROW LEVEL SECURITY;

-- Users can SELECT + INSERT their own. They can't see anyone else's login
-- patterns (privacy).
DROP POLICY IF EXISTS login_events_user_select ON login_events;
CREATE POLICY login_events_user_select ON login_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS login_events_user_insert ON login_events;
CREATE POLICY login_events_user_insert ON login_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Service role has full access for the cron / future webhook.
DROP POLICY IF EXISTS login_events_service ON login_events;
CREATE POLICY login_events_service ON login_events
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('087', 'login_events',
        ARRAY['-- 087: login_events table for Stress Signal C'])
ON CONFLICT (version) DO NOTHING;
