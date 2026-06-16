-- =============================================================================
-- 138: send_money_recipients
-- =============================================================================
-- Per-user history of money-send recipients, used by DomesticSendMoneyScreen
-- to surface the user's last N recipients (default 4). Rows are inserted
-- both on explicit "Add new recipient" via NewRecipientModal AND on every
-- successful send so the user's recent list stays warm without manual save.
--
-- A recipient is keyed by (user_id, identifier) so re-sending to the same
-- person bumps their last_sent_at instead of duplicating rows. The query
-- pattern is: latest N by last_sent_at DESC.
-- =============================================================================

CREATE TABLE IF NOT EXISTS send_money_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  identifier      TEXT NOT NULL,
  method          TEXT NOT NULL CHECK (method IN ('wallet', 'bank', 'mobile', 'cash')),
  contact_phone   TEXT,
  contact_email   TEXT,
  bank            TEXT,
  account_number  TEXT,
  network         TEXT,
  location        TEXT,
  verified        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, identifier)
);

CREATE INDEX IF NOT EXISTS send_money_recipients_user_recent_idx
  ON send_money_recipients (user_id, last_sent_at DESC);

ALTER TABLE send_money_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "send_money_recipients_select_own" ON send_money_recipients;
CREATE POLICY "send_money_recipients_select_own"
  ON send_money_recipients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "send_money_recipients_insert_own" ON send_money_recipients;
CREATE POLICY "send_money_recipients_insert_own"
  ON send_money_recipients FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "send_money_recipients_update_own" ON send_money_recipients;
CREATE POLICY "send_money_recipients_update_own"
  ON send_money_recipients FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "send_money_recipients_delete_own" ON send_money_recipients;
CREATE POLICY "send_money_recipients_delete_own"
  ON send_money_recipients FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================================================
-- Self-register
-- =============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '138',
  'send_money_recipients',
  ARRAY['-- 138: send_money_recipients']
)
ON CONFLICT (version) DO NOTHING;
