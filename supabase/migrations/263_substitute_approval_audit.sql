-- ═══════════════════════════════════════════════════════════════════════════
-- 263: Substitute approval audit logging
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Wires substitute admin actions into elder_audit_log (migration 254). The
-- substitution_records.status trigger was deferred in 254 because the table
-- had no per-action attribution column; this migration adds approved_by,
-- back-fills the two admin-facing RPCs to stamp it, and wires the trigger.
--
-- Spec deviations (verified read-only against the live schema + migrations
-- 049 / 100 / 101 / 254 before writing):
--   • Status enum mismatch. Spec's trigger predicate is
--     `NEW.status IN ('approved', 'declined')`. Actual substitution_records
--     statuses (migration 049 CHECK): 'pending_confirmation', 'confirmed',
--     'admin_pending', 'approved', 'declined_substitute', 'declined_admin',
--     'expired', 'completed', 'cancelled'.
--     • 'declined' (bare) does NOT exist.
--     • 'approved' exists but is never reached in practice —
--       _execute_substitution_swap (migration 100) jumps 'admin_pending' →
--       'completed' in a single UPDATE, bypassing 'approved' entirely.
--     Trigger predicate corrected to 'completed' (terminal after admin
--     approval OR cron auto-approval) and 'declined_admin'. The
--     'declined_substitute' branch is a substitute's own self-decline, not
--     an elder action — intentionally skipped.
--   • Auto-approval path attribution. process_substitute_lifecycle's cron
--     hits the same 'completed' state via _execute_substitution_swap(rec,
--     TRUE). There's no human elder to attribute, so approved_by stays
--     NULL. log_elder_action's NULL-elder defensive guard (migration 254
--     line 81) returns NULL early, so the row is silently NOT logged —
--     correct behaviour for the audit log's elder-action semantics. The
--     metadata.auto_approved flag still surfaces this state to anything
--     querying substitution_records directly.
--   • Action labels: 'completed' → 'substitute_approved',
--     'declined_admin' → 'substitute_declined'. Spec's literal
--     'substitute_'||NEW.status would emit 'substitute_completed' /
--     'substitute_declined_admin' which leak implementation detail.
--   • Registry table. Spec's `INSERT INTO supabase_migrations (...)` is
--     wrong (recurring bug). Corrected to
--     `supabase_migrations.schema_migrations` per the per-CLAUDE.md template.
--   • Tier 4 hardening: SET search_path = public, pg_temp added to all
--     functions per the project-wide hardening pass.
--
-- RPC updates (migration 101 originals):
--   • admin_approve_substitution — stamp approved_by = auth.uid() in a
--     separate UPDATE before calling _execute_substitution_swap, so the
--     value survives the helper's status='completed' write (the helper
--     doesn't touch approved_by). Audit trigger then picks it up on the
--     status flip.
--   • admin_decline_substitution — add approved_by = auth.uid() to the
--     existing UPDATE that flips status='declined_admin'.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Add approved_by column + index.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE substitution_records
  ADD COLUMN IF NOT EXISTS approved_by UUID
    REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_substitution_records_approved_by
  ON substitution_records(approved_by);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Audit trigger function.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION log_substitute_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action TEXT;
BEGIN
  -- Map the terminal status into an audit action label. Anything else
  -- (intermediate states, substitute-self-decline) is not an elder action
  -- and gets short-circuited here. The WHEN clause on the trigger already
  -- prevents most of these from firing the function at all; this branch
  -- is defence-in-depth for future status additions.
  IF NEW.status = 'completed' THEN
    v_action := 'substitute_approved';
  ELSIF NEW.status = 'declined_admin' THEN
    v_action := 'substitute_declined';
  ELSE
    RETURN NEW;
  END IF;

  PERFORM log_elder_action(
    NEW.approved_by,
    v_action,
    NEW.id,
    'substitution_record',
    jsonb_build_object(
      'exiting_member_id',        NEW.exiting_member_id,
      'substitute_member_id',     NEW.substitute_member_id,
      'circle_id',                NEW.circle_id,
      'original_payout_position', NEW.original_payout_position,
      'auto_approved',            NEW.auto_approved
    )
  );

  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Trigger wiring.
-- ───────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS tr_substitution_audit_log ON substitution_records;
CREATE TRIGGER tr_substitution_audit_log
AFTER UPDATE OF status ON substitution_records
FOR EACH ROW
WHEN (
  NEW.status IN ('completed', 'declined_admin')
  AND OLD.status IS DISTINCT FROM NEW.status
)
EXECUTE FUNCTION log_substitute_audit();

-- ───────────────────────────────────────────────────────────────────────────
-- 4a. admin_approve_substitution — pre-stamp approved_by.
--     Body identical to migration 101 except for the new UPDATE just
--     before _execute_substitution_swap is invoked.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_approve_substitution(p_record_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_record RECORD;
  v_is_admin BOOLEAN;
  v_swap_error TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'authentication required');
  END IF;

  SELECT * INTO v_record FROM substitution_records WHERE id = p_record_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'substitution_record not found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM circle_members
    WHERE circle_id = v_record.circle_id
      AND user_id = v_user_id
      AND role IN ('admin', 'creator', 'treasurer')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'caller is not an admin of this circle');
  END IF;

  IF v_record.status NOT IN ('admin_pending', 'confirmed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'record not in admin_pending or confirmed state',
      'current_status', v_record.status
    );
  END IF;

  -- 263: pre-stamp the approving admin so the audit trigger sees the
  -- right value when _execute_substitution_swap UPDATEs status='completed'
  -- below. Done as a separate UPDATE — the helper preserves approved_by
  -- because its UPDATE list doesn't reference it.
  UPDATE substitution_records
  SET approved_by = v_user_id
  WHERE id = p_record_id;

  v_swap_error := _execute_substitution_swap(p_record_id, false);

  IF v_swap_error IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_swap_error);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'record_id', p_record_id,
    'note', 'swap completed; circle_members updated, exit_request completed.'
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4b. admin_decline_substitution — set approved_by in the same UPDATE.
--     Body identical to migration 101 except for the new column write.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_decline_substitution(p_record_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_record RECORD;
  v_is_admin BOOLEAN;
  v_match_result JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'authentication required');
  END IF;

  SELECT * INTO v_record FROM substitution_records WHERE id = p_record_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'substitution_record not found');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM circle_members
    WHERE circle_id = v_record.circle_id
      AND user_id = v_user_id
      AND role IN ('admin', 'creator', 'treasurer')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'caller is not an admin of this circle');
  END IF;

  IF v_record.status <> 'admin_pending' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'record not in admin_pending state',
      'current_status', v_record.status
    );
  END IF;

  -- 263: include approved_by in the same write so the trigger picks up
  -- the declining admin on the status flip.
  UPDATE substitution_records
  SET status = 'declined_admin',
      admin_declined_at = NOW(),
      approved_by = v_user_id
  WHERE id = p_record_id;

  UPDATE circle_exit_requests
  SET status = 'matching', substitute_matched_id = NULL
  WHERE id = v_record.exit_request_id;

  v_match_result := process_substitute_match(
    v_record.exit_request_id,
    v_record.substitute_member_id
  );

  IF (v_match_result->>'matched')::BOOLEAN = false THEN
    UPDATE circle_exit_requests
    SET status = 'expired', payout_entitlement_status = 'forfeited'
    WHERE id = v_record.exit_request_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'record_id', p_record_id,
    'next_match_result', v_match_result
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Self-register. Idempotent via ON CONFLICT DO NOTHING.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '263',
  'substitute_approval_audit',
  ARRAY['-- 263: substitute_approval_audit']
)
ON CONFLICT (version) DO NOTHING;
