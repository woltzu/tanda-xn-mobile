-- ═══════════════════════════════════════════════════════════════════════════
-- 265: Full rotate_substitute RPC + restore function
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Replaces the no-op restore stub from migration 264 with the real body
-- and adds the elder-facing rotate_substitute RPC. Uses the verified
-- prod schema (wallet/cycle/position/contributions confirmed via
-- read-only diagnostic before write).
--
-- Spec deviations (verified read-only before writing):
--
--   * Registry table corrected from spec's `supabase_migrations` to
--     `supabase_migrations.schema_migrations` (recurring spec bug).
--
--   * circle_members.is_substitute_for_cycle and substituted_user_id
--     were referenced by the spec but NOT added by migration 264 (the
--     Option C scaffold omitted them). Added here via ALTER TABLE
--     BEFORE any function body references them.
--
--   * circle_cycles.end_date does not exist (verified). The restore
--     loop's spec predicate `end_date < NOW() AND cycle_status =
--     'completed'` is replaced with `cycle_status = 'completed' AND
--     actual_payout_date IS NOT NULL` — the actual terminal signal in
--     the prod schema.
--
--   * Spec's DO $$ BEGIN ... EXCEPTION WHEN OTHERS THEN -- comment END $$
--     fails to compile (a bare comment is not a statement after
--     EXCEPTION). Replaced the comment with `NULL;`.
--
--   * Tier 4 hardening (SET search_path = public, pg_temp) on both
--     function bodies. Spec had it inconsistently.
--
--   * Substitute's exit on restore stamps exited_at = NOW() in addition
--     to status='exited'. Spec only set status; exited_at gives the
--     audit trail a clean handle on when each substitute cycle ended.
--
--   * Restore loop's outer filter adds `triggered_by IS NOT NULL` so it
--     only picks up rotation-originated substitution_records — the
--     legacy substitute-pool flow (migration 100's
--     _execute_substitution_swap, which lands at 'completed' too) does
--     not have triggered_by set and should not be restored. Defensive
--     guard against unrelated row collateral.
--
--   * restore_after_substitute_cycle returns the per-run count
--     (INTEGER) rather than void, so the cron output has a meaningful
--     row for the audit log.
--
-- Known design tensions documented but not addressed here (out of
-- scope for this migration — discuss before the activation UI ships):
--
--   * The "circle is full" gate (circles.member_count = current_members)
--     and the "substitute joins as new active row" path are in tension.
--     If current_members is computed from rows-existence, the counter
--     drifts after rotation; if from status='active', it stays balanced
--     because at-risk is paused. We don't touch the counter here —
--     whatever trigger maintains it will fire on INSERT/UPDATE.
--
--   * No rotation-time notifications. Migration 264's
--     tr_substitute_rotation_notify trigger still has its no-op body —
--     so the at-risk member, substitute, and elders are NOT notified
--     when the rotation happens, only when the original member is
--     restored. The notification target (notifications vs
--     notification_queue) is settled here (notifications, matching the
--     restore path); a follow-up migration can rewrite the trigger body
--     to write rotation notifications using the same shape.
--
--   * Substitute funds gate joins profiles → user_wallets on user_id;
--     a substitute with no wallet row gets the generic "not available
--     or insufficient funds" error. Distinguishing those cases needs a
--     friendlier error message — a UI concern, not a schema one.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Backfill the circle_members columns the 264 scaffold deferred.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE circle_members
  ADD COLUMN IF NOT EXISTS is_substitute_for_cycle BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE circle_members
  ADD COLUMN IF NOT EXISTS substituted_user_id UUID
    REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_circle_members_substitute_active
  ON circle_members(circle_id, is_substitute_for_cycle)
  WHERE is_substitute_for_cycle = true;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. rotate_substitute — the elder-initiated rotation entrypoint.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION rotate_substitute(
  p_circle_id          UUID,
  p_at_risk_user_id    UUID,
  p_substitute_user_id UUID,
  p_cycle_id           UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_at_risk_member_id      UUID;
  v_substitute_member_id   UUID;
  v_substitution_record_id UUID;
  v_cycle_number           INTEGER;
  v_circle_amount_cents    BIGINT;
  v_position               INTEGER;
BEGIN
  -- Elder gate. profiles.role uses elder_i / elder_ii / elder_iii so the
  -- LIKE 'elder%' pattern covers all three tiers in one predicate.
  IF NOT EXISTS (
    SELECT 1 FROM circle_members cm
    JOIN profiles p ON p.id = cm.user_id
    WHERE cm.circle_id = p_circle_id
      AND cm.user_id = auth.uid()
      AND p.role LIKE 'elder%'
  ) THEN
    RAISE EXCEPTION 'Only elders can trigger a substitute rotation';
  END IF;

  -- Circle must be at capacity. See known-tension note in header.
  IF NOT EXISTS (
    SELECT 1 FROM circles
    WHERE id = p_circle_id
      AND member_count = current_members
  ) THEN
    RAISE EXCEPTION 'Circle is not full — substitutions are only allowed at capacity';
  END IF;

  -- At-risk validated + grab their position in a single read.
  SELECT id, position
    INTO v_at_risk_member_id, v_position
  FROM circle_members
  WHERE circle_id = p_circle_id
    AND user_id = p_at_risk_user_id
    AND status = 'active';
  IF v_at_risk_member_id IS NULL THEN
    RAISE EXCEPTION 'At-risk member is not active in this circle';
  END IF;

  -- Resolve cycle_id → cycle_number (circle_contributions has no
  -- cycle_id; the join key is cycle_number).
  SELECT cycle_number INTO v_cycle_number
  FROM circle_cycles
  WHERE id = p_cycle_id;
  IF v_cycle_number IS NULL THEN
    RAISE EXCEPTION 'Invalid cycle ID';
  END IF;

  -- Per-cycle amount in cents. circles.amount is numeric dollars.
  SELECT (amount * 100)::BIGINT INTO v_circle_amount_cents
  FROM circles WHERE id = p_circle_id;

  -- Substitute must share the circle's community.
  IF NOT EXISTS (
    SELECT 1 FROM community_memberships cm
    WHERE cm.community_id = (SELECT community_id FROM circles WHERE id = p_circle_id)
      AND cm.user_id = p_substitute_user_id
      AND cm.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Substitute must be a member of the same community';
  END IF;

  -- Substitute opted in + funded + wallet active. The join skips users
  -- with no user_wallets row → same generic error (see header note).
  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN user_wallets uw ON uw.user_id = p.id
    WHERE p.id = p_substitute_user_id
      AND p.is_substitute_available = true
      AND uw.wallet_status = 'active'
      AND uw.available_balance_cents >= v_circle_amount_cents
  ) THEN
    RAISE EXCEPTION 'Substitute is not available or does not have sufficient funds';
  END IF;

  -- Does the substitute already have a row in this circle?
  SELECT id INTO v_substitute_member_id
  FROM circle_members
  WHERE circle_id = p_circle_id
    AND user_id = p_substitute_user_id;

  IF v_substitute_member_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM circle_members
      WHERE id = v_substitute_member_id AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'Substitute is already an active member of this circle';
    END IF;
  END IF;

  -- ── Begin mutations ────────────────────────────────────────────────

  -- 1. Pause at-risk and free their position.
  UPDATE circle_members
  SET status = 'paused',
      position = NULL
  WHERE id = v_at_risk_member_id;

  -- 2. Substitution record. Migration 264 added both cycle_id and
  --    entry_cycle_id; for an elder-rotation flow the same cycle UUID
  --    is the right value for both.
  INSERT INTO substitution_records (
    circle_id, exiting_member_id, substitute_member_id,
    original_payout_position, entry_cycle_id, cycle_id,
    at_risk_user_id, triggered_by, status, created_at
  ) VALUES (
    p_circle_id, p_at_risk_user_id, p_substitute_user_id,
    v_position, p_cycle_id, p_cycle_id,
    p_at_risk_user_id, auth.uid(), 'confirmed', NOW()
  )
  RETURNING id INTO v_substitution_record_id;

  -- 3. Substitute joins as active (insert) or is reactivated (update).
  IF v_substitute_member_id IS NULL THEN
    INSERT INTO circle_members (
      circle_id, user_id, status, is_substitute_for_cycle,
      substituted_user_id, position, joined_at
    ) VALUES (
      p_circle_id, p_substitute_user_id, 'active', true,
      p_at_risk_user_id, v_position, NOW()
    )
    RETURNING id INTO v_substitute_member_id;
  ELSE
    UPDATE circle_members
    SET status = 'active',
        is_substitute_for_cycle = true,
        substituted_user_id = p_at_risk_user_id,
        position = v_position
    WHERE id = v_substitute_member_id;
  END IF;

  -- 4. Stage held contributions for the at-risk's paid cycle rows.
  INSERT INTO held_contributions (
    user_id, circle_id, amount, cycle_number, reason, status
  )
  SELECT cc.user_id, cc.circle_id, cc.amount, cc.cycle_number,
         'Substitute rotation — contributions held for cycle ' || cc.cycle_number,
         'held'
  FROM circle_contributions cc
  WHERE cc.circle_id = p_circle_id
    AND cc.user_id = p_at_risk_user_id
    AND cc.cycle_number = v_cycle_number
    AND cc.status = 'paid';

  -- 5. Audit (elder_audit_log via migration 254's helper).
  PERFORM log_elder_action(
    auth.uid(),
    'substitute_rotation',
    p_circle_id,
    'circle',
    jsonb_build_object(
      'at_risk_user_id',     p_at_risk_user_id,
      'substitute_user_id',  p_substitute_user_id,
      'cycle_id',            p_cycle_id,
      'payout_position',     v_position,
      'substitution_record', v_substitution_record_id
    )
  );

  -- 6. Record the resolution as a substitute_needed_event.
  INSERT INTO substitute_needed_events (
    circle_id, at_risk_user_id, cycle_id,
    risk_score, reason, status, resolved_at
  ) VALUES (
    p_circle_id, p_at_risk_user_id, p_cycle_id,
    100, 'Resolved by manual elder-initiated rotation', 'resolved', NOW()
  );

  RETURN v_substitution_record_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. restore_after_substitute_cycle — real body (replaces 264 stub).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION restore_after_substitute_cycle()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec   RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_rec IN
    SELECT sr.id,
           sr.at_risk_user_id,
           sr.substitute_member_id,
           sr.circle_id,
           sr.entry_cycle_id
    FROM substitution_records sr
    WHERE sr.original_member_restored = false
      AND sr.triggered_by IS NOT NULL
      AND sr.entry_cycle_id IN (
        SELECT id FROM circle_cycles
        WHERE cycle_status = 'completed'
          AND actual_payout_date IS NOT NULL
      )
  LOOP
    -- Reinstate at-risk.
    UPDATE circle_members
    SET status = 'active',
        substituted_user_id = NULL
    WHERE circle_id = v_rec.circle_id
      AND user_id = v_rec.at_risk_user_id;

    -- Retire substitute. 'exited' is the valid terminal status for
    -- circle_members (see status enum). exited_at stamped for audit.
    UPDATE circle_members
    SET status = 'exited',
        is_substitute_for_cycle = false,
        substituted_user_id = NULL,
        exited_at = NOW()
    WHERE circle_id = v_rec.circle_id
      AND user_id = v_rec.substitute_member_id;

    -- Release held contributions.
    UPDATE held_contributions
    SET status = 'returned', updated_at = NOW()
    WHERE circle_id = v_rec.circle_id
      AND user_id = v_rec.at_risk_user_id
      AND status = 'held';

    -- Mark the substitution record restored.
    UPDATE substitution_records
    SET original_member_restored = true
    WHERE id = v_rec.id;

    -- Restoration notification to the at-risk member.
    INSERT INTO notifications (user_id, type, title, body, data, created_at)
    VALUES (
      v_rec.at_risk_user_id,
      'substitute_restored',
      'You have been restored to your circle',
      'Your spot in the circle has been restored and your held contributions are now returned to your wallet.',
      jsonb_build_object('circle_id', v_rec.circle_id),
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Cron schedule. Unschedule defensively so re-applying is idempotent.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('restore-after-substitute-cycle');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'restore-after-substitute-cycle',
  '0 2 * * *',
  'SELECT restore_after_substitute_cycle();'
);

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Self-register.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '265',
  'rotate_substitute_rpc',
  ARRAY['-- 265: rotate_substitute_rpc']
)
ON CONFLICT (version) DO NOTHING;
