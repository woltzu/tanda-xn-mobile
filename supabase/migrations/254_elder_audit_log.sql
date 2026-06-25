-- ═══════════════════════════════════════════════════════════════════════════
-- 254: Unified elder_audit_log + cross-table triggers
-- ═══════════════════════════════════════════════════════════════════════════
--
-- One append-only log of all elder actions, fed by triggers on the
-- existing per-feature audit tables (vouch_audit_log, resolution_review_
-- requests, elder_nominations). Lets us answer "what has elder X done
-- across the platform" without scanning every per-feature log.
--
-- Spec deviations (verified via read-only audit before writing):
--   • Registry insert was wrong table (recurring bug). Corrected to
--     supabase_migrations.schema_migrations.
--   • Spec adds vouch_audit_log.action_type column but nothing populates
--     it (the existing 'action' column already carries created/revoked/
--     expired). Dropped the column add — the trigger reads 'action'.
--   • Spec's substitution trigger queries `circle_members.elder_id WHERE
--     role = 'admin'` — circle_members.elder_id does NOT exist (verified).
--     substitution_records itself has admin_approved_at / admin_declined_at
--     timestamps but no approved_by column. Without elder attribution,
--     auto-logging substitute actions would record bogus elder_ids.
--     Substitute trigger is DEFERRED — needs an approved_by column on
--     substitution_records first. Documented as Bucket follow-up.
--   • Spec's nomination trigger uses (SELECT nominator_id FROM elder_
--     nominations WHERE id = NEW.id) — redundant self-lookup. Simplified
--     to NEW.nominator_id.
--   • Spec's resolution trigger uses NEW.assigned_elder_id — confirmed
--     correct (migration 249 set this when an elder calls resolve_review
--     _request). Kept.
--   • Tier 4 hardening (SET search_path = public, pg_temp) added to all
--     RPC + trigger function bodies — spec omitted it.
--   • CREATE POLICY made idempotent via DROP POLICY IF EXISTS first.
--
-- Attribution caveats (documented honestly, not silently swallowed):
--   • elder_nominations status changes attribute to the nominator (the
--     elder who started the chain), not the vote-tipping elder. The
--     elder_nominations table tracks votes_for/votes_against as counters,
--     not per-vote attribution, so we can't identify the deciding voter.
--   • substitution_records is unlogged (see above).
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Unified elder_audit_log table.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS elder_audit_log (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  elder_id     UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type  TEXT         NOT NULL,
  target_id    UUID,
  target_type  TEXT,
  metadata     JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_elder_audit_elder
  ON elder_audit_log (elder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_elder_audit_target
  ON elder_audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_elder_audit_action
  ON elder_audit_log (action_type, created_at DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. log_elder_action — generic insert helper used by triggers.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_elder_action(
  p_elder_id    UUID,
  p_action_type TEXT,
  p_target_id   UUID  DEFAULT NULL,
  p_target_type TEXT  DEFAULT NULL,
  p_metadata    JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Defensive: skip rows with NULL elder_id rather than erroring (lets
  -- per-feature triggers continue even when attribution is incomplete).
  IF p_elder_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO elder_audit_log (elder_id, action_type, target_id, target_type, metadata)
  VALUES (p_elder_id, p_action_type, p_target_id, p_target_type, p_metadata)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. RLS — elders read all; everyone else denied.
--    Writes via SECURITY DEFINER trigger functions only — no INSERT policy.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE elder_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS elder_audit_log_select ON elder_audit_log;
CREATE POLICY elder_audit_log_select ON elder_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role LIKE 'elder%')
  );

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Trigger: vouch_audit_log INSERT → elder_audit_log. Fires on
--    created/revoked/expired (the three values vouch_audit_log.action
--    accepts per migration 252's CHECK).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_vouch_to_elder_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM log_elder_action(
    NEW.elder_id,
    'vouch_' || NEW.action,
    NEW.member_id,
    'profile',
    jsonb_build_object(
      'tier', NEW.temporary_tier,
      'backing_cents', NEW.backing_amount_cents
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_vouch_audit_to_elder_audit ON vouch_audit_log;
CREATE TRIGGER tr_vouch_audit_to_elder_audit
AFTER INSERT ON vouch_audit_log
FOR EACH ROW EXECUTE FUNCTION log_vouch_to_elder_audit();

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Trigger: resolution_review_requests status change → elder_audit_log.
--    Captures elder_comment (the elder's resolution note) in addition to
--    the member's original comment for full context in the audit row.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_resolution_review_to_elder_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM log_elder_action(
    NEW.assigned_elder_id,
    'resolution_' || NEW.status,
    NEW.id,
    'resolution_review',
    jsonb_build_object(
      'user_id', NEW.user_id,
      'member_comment', NEW.comment,
      'elder_comment', NEW.elder_comment
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_resolution_review_to_elder_audit ON resolution_review_requests;
CREATE TRIGGER tr_resolution_review_to_elder_audit
AFTER UPDATE OF status ON resolution_review_requests
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION log_resolution_review_to_elder_audit();

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Trigger: elder_nominations status change → elder_audit_log.
--    Attributes to NEW.nominator_id (the elder who initiated the chain)
--    because elder_nominations only tracks vote counters, not per-vote
--    attribution — we can't identify the elder whose vote tipped the
--    threshold. Documented above.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_nomination_to_elder_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM log_elder_action(
    NEW.nominator_id,
    'nomination_' || NEW.status,
    NEW.id,
    'elder_nomination',
    jsonb_build_object(
      'nominee_id', NEW.nominee_id,
      'reason', NEW.reason,
      'votes_for', NEW.votes_for,
      'votes_against', NEW.votes_against
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_nomination_to_elder_audit ON elder_nominations;
CREATE TRIGGER tr_nomination_to_elder_audit
AFTER UPDATE OF status ON elder_nominations
FOR EACH ROW
WHEN (NEW.status IS DISTINCT FROM OLD.status)
EXECUTE FUNCTION log_nomination_to_elder_audit();

-- ───────────────────────────────────────────────────────────────────────────
-- 7. (Skipped — see header.) substitution_records has no approved_by
--    column. Adding a trigger now would record NULL elder_id rows, which
--    log_elder_action correctly drops, so the trigger would be a no-op.
--    Better to defer until substitution_records gains attribution.
-- ───────────────────────────────────────────────────────────────────────────

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '254',
  'elder_audit_log',
  ARRAY['-- 254: elder_audit_log']
)
ON CONFLICT (version) DO NOTHING;
