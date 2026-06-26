-- ═══════════════════════════════════════════════════════════════════════════
-- 264: Substitute rotation — scaffold only
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Lays down the schema pieces for elder-triggered substitute rotation
-- WITHOUT touching the destructive logic (no rotate_substitute RPC, no
-- restore cron body, no real notification writes). Allows the UI to wire
-- the substitute-availability toggle and a read-only dashboard while the
-- data-model fit for the full rotation flow is locked down separately.
--
-- The original migration 264 spec assumed prod schema that doesn't match
-- (cycle_participants table, profiles.wallet_balance, contributions.cycle_id
-- — all absent in prod). Diagnostic findings were surfaced before write;
-- this scaffold is the agreed safe subset.
--
-- Spec deviations (verified read-only before writing):
--   • Registry table corrected from spec's bare `supabase_migrations` to
--     `supabase_migrations.schema_migrations` (recurring bug — see
--     migrations 254 / 257 / 263).
--   • Notification trigger body is a no-op stub. Spec writes to a
--     `notifications` table whose column shape we haven't validated
--     against the actual usage pattern; the existing substitute flow
--     (migration 100) uses `notification_queue` with a different column
--     shape. Deferring the write target choice until the real rollout
--     keeps this migration clean. The trigger function exists and is
--     wired, so the contract is in place — future migration just rewrites
--     the body.
--   • Restore function body is a RAISE NOTICE stub. Real logic depends
--     on the still-unconfirmed wallet / payout-position / cycle linkage.
--   • substitution_records.cycle_id is added per spec even though the
--     table already has entry_cycle_id with the same semantic. Kept both
--     so the future RPC can carry the spec's intended split (cycle_id
--     for the active substitute cycle, entry_cycle_id for the substitute's
--     join cycle) without another ALTER. Documented redundancy.
--   • held_contributions.amount uses DECIMAL(10,2) per spec rather than
--     the project's _cents integer convention. Acceptable while the table
--     has no writers; will be converted before any RPC populates it.
--   • Tier 4 hardening: SET search_path = public, pg_temp on both stub
--     functions.
--
-- Out of scope (deferred to follow-up migration):
--   • rotate_substitute RPC
--   • restore_after_substitute_cycle() real body + cron schedule
--   • substitute-needed event automation (default-prediction integration)
--   • Notification write target + columns
--   • Wallet-balance, cycle-link, payout-position schema fit
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. profiles — substitute availability + monthly cap.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_substitute_available BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS max_substitute_cycles_per_month INTEGER NOT NULL DEFAULT 2;

CREATE INDEX IF NOT EXISTS idx_profiles_is_substitute_available
  ON profiles(is_substitute_available)
  WHERE is_substitute_available = true;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. substitution_records — rotation columns.
--    cycle_id is intentionally distinct from the existing entry_cycle_id;
--    the future RPC will use cycle_id for the active substitute cycle and
--    keep entry_cycle_id pointing at the substitute's original join cycle.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE substitution_records
  ADD COLUMN IF NOT EXISTS cycle_id UUID
    REFERENCES circle_cycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS at_risk_user_id UUID
    REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS triggered_by UUID
    REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substitute_active_cycle_id UUID
    REFERENCES circle_cycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS original_member_restored BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_substitution_records_triggered_by
  ON substitution_records(triggered_by);
CREATE INDEX IF NOT EXISTS idx_substitution_records_at_risk_user
  ON substitution_records(at_risk_user_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. substitute_needed_events — default-prediction output queue.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS substitute_needed_events (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id       UUID         NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  at_risk_user_id UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cycle_id        UUID         NOT NULL REFERENCES circle_cycles(id) ON DELETE CASCADE,
  risk_score      INTEGER      NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  reason          TEXT,
  status          TEXT         NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored')),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_substitute_needed_events_circle_open
  ON substitute_needed_events(circle_id, status)
  WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_substitute_needed_events_user
  ON substitute_needed_events(at_risk_user_id, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. held_contributions — staging for contributions held during a
--    substitute cycle. DECIMAL(10,2) per spec (project convention is
--    _cents int; will be normalised before the first writer ships).
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS held_contributions (
  id            UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID           NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id     UUID           NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  amount        DECIMAL(10, 2) NOT NULL,
  cycle_number  INTEGER,
  reason        TEXT,
  status        TEXT           NOT NULL DEFAULT 'held'
                                CHECK (status IN ('held', 'returned', 'applied')),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_held_contributions_user_status
  ON held_contributions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_held_contributions_circle
  ON held_contributions(circle_id, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Notification trigger stub.
--    Wired on substitution_records INSERT when triggered_by IS NOT NULL
--    (i.e. an elder-initiated rotation). Body is currently a no-op; the
--    follow-up migration will fill in the notification write once the
--    target table + column shape is locked down.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_substitute_rotation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- TODO(264-followup): write to notification_queue (or notifications)
  -- once the target is decided. For now this trigger is a no-op contract
  -- so the wiring exists when the RPC ships.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_substitute_rotation_notify ON substitution_records;
CREATE TRIGGER tr_substitute_rotation_notify
AFTER INSERT ON substitution_records
FOR EACH ROW
WHEN (NEW.triggered_by IS NOT NULL)
EXECUTE FUNCTION notify_substitute_rotation();

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Restore function stub.
--    Will be called by a cron job (not scheduled here — deferred until the
--    body is real). The stub returns 0 and logs a notice so accidental
--    direct calls are visible in DB logs without mutating state.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION restore_after_substitute_cycle()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE NOTICE 'restore_after_substitute_cycle: stub (migration 264). Real body in follow-up migration once cycle/wallet shape confirmed.';
  RETURN 0;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '264',
  'substitute_rotation_scaffold',
  ARRAY['-- 264: substitute_rotation_scaffold']
)
ON CONFLICT (version) DO NOTHING;
