-- ════════════════════════════════════════════════════════════════════════════
-- Migration 100: Substitute Member — lifecycle cron
-- Phase D2 of feat(substitute).
-- ════════════════════════════════════════════════════════════════════════════
-- Ports three batch operations from services/SubstituteMemberEngine.ts into
-- PL/pgSQL so they can run from pg_cron / an Edge Function:
--   * F5  processAutoApprovals      → 24h admin-pending → auto-approve + swap
--   * F6  processExpiredConfirmations → 48h substitute window expires → next match
--   * G3  resetDeclineCounters      → 90d rolling decline counter reset
--
-- The 7-step _executeSubstitution swap from TS F7 is implemented as a
-- private helper that does all 5 table mutations in one transaction. This
-- is actually more atomic than the TS path (TS uses 6+ separate Supabase
-- calls with no transaction boundary; PL/pgSQL puts everything in one).
--
-- Three TS bugs fixed during the port (documented inline below):
--   1. TS F5 sets `auto_approved=true` in DB then calls _executeSubstitution
--      with the stale in-memory record (auto_approved=false), so
--      admin_approved_at gets set to NOW() — contradicting auto_approved.
--      Fixed here: auto-approved records get admin_approved_at = NULL.
--   2. TS F7 Step 2 does a bare INSERT into circle_members which violates
--      the UNIQUE(circle_id, user_id) constraint if the substitute has any
--      prior row (active, removed, exited). Fixed via ON CONFLICT UPDATE.
--   3. The D1 process_substitute_match() had no way to exclude a specific
--      member from candidacy. The TS F6 filters the just-expired substitute
--      out via `nextMatches.filter(m => m.memberId !== record.substitute_member_id)`
--      so they don't get re-offered the same vacancy they just timed out
--      on. Fixed by adding an optional `p_exclude_member_id UUID DEFAULT
--      NULL` param to BOTH find_substitute_matches and process_substitute_match.
--      Existing callers (the auto-match trigger from 099) keep working
--      because the param has a default.
--
-- All cron runs are idempotent: each batch's filter (status + timestamp)
-- naturally excludes rows already processed.
-- ════════════════════════════════════════════════════════════════════════════


-- ── Extend find_substitute_matches + process_substitute_match with exclusion ──
-- (Replaces the D1 versions. Signature change requires DROP FUNCTION IF
-- EXISTS for the old shape.)

DROP FUNCTION IF EXISTS find_substitute_matches(UUID, INTEGER);
DROP FUNCTION IF EXISTS process_substitute_match(UUID);

CREATE OR REPLACE FUNCTION find_substitute_matches(
  p_exit_request_id UUID,
  p_limit INTEGER DEFAULT 10,
  p_exclude_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exit_request RECORD;
  v_circle_id UUID;
  v_circle_amount NUMERIC;
  v_contribution_amount_cents BIGINT;
  v_candidates JSONB;
BEGIN
  SELECT * INTO v_exit_request
  FROM circle_exit_requests
  WHERE id = p_exit_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'exit_request not found');
  END IF;

  v_circle_id := v_exit_request.circle_id;

  SELECT amount INTO v_circle_amount FROM circles WHERE id = v_circle_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'circle not found');
  END IF;

  v_contribution_amount_cents := ROUND(COALESCE(v_circle_amount, 0) * 100)::BIGINT;

  WITH active_circle_members AS (
    SELECT user_id
    FROM circle_members
    WHERE circle_id = v_circle_id
      AND status = 'active'
  ),
  scored AS (
    SELECT
      sp.id AS pool_entry_id,
      sp.member_id,
      sp.substitute_reliability_score::NUMERIC AS reliability_score,
      sp.status AS pool_status,
      sp.max_contribution_amount_cents,
      sp.preferred_languages,
      COALESCE(p.language, 'en') AS member_language,
      false AS same_city,
      false AS same_country,
      (sp.max_contribution_amount_cents = 0
        OR sp.max_contribution_amount_cents >= v_contribution_amount_cents) AS contribution_compatible
    FROM substitute_pool sp
    JOIN profiles p ON p.id = sp.member_id
    WHERE sp.status IN ('active', 'standby')
      AND sp.member_id NOT IN (SELECT user_id FROM active_circle_members)
      -- D2 addition: optional per-call exclusion (used by lifecycle batch
      -- to skip a substitute who just timed out on this same vacancy)
      AND (p_exclude_member_id IS NULL OR sp.member_id <> p_exclude_member_id)
  ),
  ranked AS (
    SELECT
      *,
      (preferred_languages ? member_language) AS language_match,
      (
        CASE WHEN same_city THEN 40 WHEN same_country THEN 20 ELSE 0 END
        + CASE WHEN contribution_compatible THEN 25 ELSE 0 END
        + CASE WHEN preferred_languages ? member_language THEN 15 ELSE 0 END
        + ROUND((reliability_score / 100.0) * 20)::INTEGER
        + CASE WHEN pool_status = 'active' THEN 5 ELSE 0 END
      )::INTEGER AS match_score
    FROM scored
    WHERE contribution_compatible
  ),
  limited AS (
    SELECT *
    FROM ranked
    ORDER BY match_score DESC, reliability_score DESC
    LIMIT p_limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'pool_entry_id', pool_entry_id,
    'member_id', member_id,
    'reliability_score', reliability_score,
    'match_score', match_score,
    'same_city', same_city,
    'same_country', same_country,
    'language_match', language_match,
    'contribution_compatible', contribution_compatible,
    'pool_status', pool_status
  ) ORDER BY match_score DESC, reliability_score DESC), '[]'::jsonb)
  INTO v_candidates
  FROM limited;

  RETURN jsonb_build_object(
    'success', true,
    'exit_request_id', p_exit_request_id,
    'circle_id', v_circle_id,
    'contribution_amount_cents', v_contribution_amount_cents,
    'candidate_count', jsonb_array_length(v_candidates),
    'candidates', v_candidates,
    'exclude_member_id', p_exclude_member_id,
    'source', 'find_substitute_matches_rpc'
  );
END;
$$;


CREATE OR REPLACE FUNCTION process_substitute_match(
  p_exit_request_id UUID,
  p_exclude_member_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exit_request RECORD;
  v_matches JSONB;
  v_top_candidate JSONB;
  v_substitute_member_id UUID;
  v_position INTEGER;
  v_current_cycle_id UUID;
  v_current_cycle_number INTEGER;
  v_record_id UUID;
  v_circle_name TEXT;
BEGIN
  SELECT * INTO v_exit_request
  FROM circle_exit_requests
  WHERE id = p_exit_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'exit_request not found');
  END IF;

  IF v_exit_request.status NOT IN ('pending', 'approved', 'matching') THEN
    RETURN jsonb_build_object(
      'success', true,
      'matched', false,
      'reason', 'exit_request not in matchable state',
      'current_status', v_exit_request.status,
      'source', 'process_substitute_match_rpc'
    );
  END IF;

  v_matches := find_substitute_matches(p_exit_request_id, 1, p_exclude_member_id);

  IF (v_matches->>'success')::BOOLEAN = false THEN
    RETURN v_matches;
  END IF;

  IF (v_matches->>'candidate_count')::INTEGER = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'matched', false,
      'reason', 'no qualifying substitutes in pool',
      'source', 'process_substitute_match_rpc'
    );
  END IF;

  v_top_candidate := (v_matches->'candidates')->0;
  v_substitute_member_id := (v_top_candidate->>'member_id')::UUID;

  SELECT position INTO v_position
  FROM circle_members
  WHERE user_id = v_exit_request.member_id
    AND circle_id = v_exit_request.circle_id
  LIMIT 1;

  SELECT id, cycle_number
    INTO v_current_cycle_id, v_current_cycle_number
  FROM circle_cycles
  WHERE circle_id = v_exit_request.circle_id
    AND cycle_status IN ('collecting', 'scheduled')
  ORDER BY cycle_number ASC
  LIMIT 1;

  INSERT INTO substitution_records (
    circle_id,
    exit_request_id,
    exiting_member_id,
    substitute_member_id,
    original_payout_position,
    payout_entitlement_transfer_cents,
    entry_cycle_id,
    entry_cycle_number,
    confirmation_deadline,
    status
  ) VALUES (
    v_exit_request.circle_id,
    p_exit_request_id,
    v_exit_request.member_id,
    v_substitute_member_id,
    COALESCE(v_position, 0),
    COALESCE(v_exit_request.substitute_share_cents, 0),
    v_current_cycle_id,
    COALESCE(v_current_cycle_number, 0),
    NOW() + INTERVAL '48 hours',
    'pending_confirmation'
  )
  RETURNING id INTO v_record_id;

  UPDATE circle_exit_requests
  SET status = 'matched',
      substitute_matched_id = v_substitute_member_id
  WHERE id = p_exit_request_id;

  SELECT name INTO v_circle_name FROM circles WHERE id = v_exit_request.circle_id;

  INSERT INTO notification_queue (
    member_id, notification_type, title, body, data
  ) VALUES (
    v_substitute_member_id,
    'circle_events',
    'A circle needs a substitute — you''re the top match',
    'You''ve been matched to a vacancy in ' || COALESCE(v_circle_name, 'a circle')
      || '. You have 48 hours to review and confirm.',
    jsonb_build_object(
      'substitutionRecordId', v_record_id,
      'circleId', v_exit_request.circle_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'matched', true,
    'substitution_record_id', v_record_id,
    'substitute_member_id', v_substitute_member_id,
    'candidate', v_top_candidate,
    'source', 'process_substitute_match_rpc'
  );
END;
$$;


-- ── _execute_substitution_swap (private helper) ────────────────────────────
-- Implements TS F7 _executeSubstitution as a single-transaction PL/pgSQL
-- function. Called from BOTH the auto-approve path here and a future admin-
-- approve RPC (planned for D3). Returns NULL on success or error text.

CREATE OR REPLACE FUNCTION _execute_substitution_swap(
  p_record_id UUID,
  p_auto_approved BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record RECORD;
  v_exit_request RECORD;
  v_score_before INTEGER;
  v_score_after INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_record FROM substitution_records WHERE id = p_record_id;
  IF NOT FOUND THEN RETURN 'substitution_record not found'; END IF;

  SELECT * INTO v_exit_request FROM circle_exit_requests
    WHERE id = v_record.exit_request_id;
  IF NOT FOUND THEN RETURN 'exit_request not found'; END IF;

  -- Step 1: mark exiting member removed
  UPDATE circle_members
  SET status = 'removed'
  WHERE user_id = v_record.exiting_member_id
    AND circle_id = v_record.circle_id;

  -- Step 2: add substitute at the same position
  -- TS bug fix: bare INSERT would violate UNIQUE(circle_id, user_id) if the
  -- substitute has any prior row in this circle. Upsert instead.
  INSERT INTO circle_members (
    circle_id, user_id, position, role, status
  ) VALUES (
    v_record.circle_id,
    v_record.substitute_member_id,
    v_record.original_payout_position,
    'member',
    'active'
  )
  ON CONFLICT (circle_id, user_id) DO UPDATE
    SET position = EXCLUDED.position,
        role = EXCLUDED.role,
        status = 'active';

  -- Step 3: exit_request 'substituted' + payout entitlement state
  UPDATE circle_exit_requests
  SET status = 'substituted',
      payout_entitlement_status = CASE
        WHEN v_record.payout_entitlement_transfer_cents > 0 THEN 'transferred'
        ELSE 'not_applicable'
      END
  WHERE id = v_record.exit_request_id;

  -- Step 4: substitution_record completed
  -- TS bug fix: for auto-approved records, admin_approved_at stays NULL
  UPDATE substitution_records
  SET status = 'completed',
      admin_approved_at = CASE WHEN p_auto_approved THEN NULL ELSE v_now END,
      auto_approved = p_auto_approved OR auto_approved,
      completed_at = v_now
  WHERE id = p_record_id;

  -- Step 5: bump total_substitutions on substitute_pool
  UPDATE substitute_pool
  SET total_substitutions = total_substitutions + 1
  WHERE member_id = v_record.substitute_member_id;

  -- Step 6: apply XnScore adjustment if non-zero
  IF v_exit_request.xnscore_adjustment <> 0 THEN
    SELECT xn_score INTO v_score_before FROM profiles WHERE id = v_exit_request.member_id;
    v_score_before := COALESCE(v_score_before, 0);
    v_score_after := GREATEST(0, LEAST(1000, v_score_before + v_exit_request.xnscore_adjustment));

    UPDATE profiles SET xn_score = v_score_after WHERE id = v_exit_request.member_id;

    INSERT INTO xn_score_history (
      user_id, score_before, score_after, change, reason, metadata
    ) VALUES (
      v_exit_request.member_id, v_score_before, v_score_after,
      v_exit_request.xnscore_adjustment, 'circle_exit_substitute',
      jsonb_build_object('source', 'substitute_member_system',
                         'substitution_record_id', p_record_id)
    );
  END IF;

  -- Step 7: notify remaining circle members (excludes the new substitute)
  INSERT INTO notification_queue (member_id, notification_type, title, body, data)
  SELECT cm.user_id,
         'circle_events',
         'A new member has joined your circle',
         'Your circle timeline is not affected.',
         jsonb_build_object('circleId', v_record.circle_id,
                            'event', 'substitution_complete')
  FROM circle_members cm
  WHERE cm.circle_id = v_record.circle_id
    AND cm.status = 'active'
    AND cm.user_id <> v_record.substitute_member_id;

  -- Step 8: final exit_request flip to 'completed'
  UPDATE circle_exit_requests
  SET status = 'completed', completed_at = v_now
  WHERE id = v_record.exit_request_id;

  RETURN NULL;  -- success
END;
$$;


-- ── process_substitute_lifecycle ───────────────────────────────────────────
-- The 3-batch cron entrypoint. Returns aggregate JSONB.

DROP FUNCTION IF EXISTS process_substitute_lifecycle();

CREATE OR REPLACE FUNCTION process_substitute_lifecycle()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record RECORD;
  v_auto_approvals_processed INTEGER := 0;
  v_expired_processed INTEGER := 0;
  v_decline_counters_reset INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_swap_error TEXT;
  v_match_result JSONB;
  v_next_match_attempted INTEGER := 0;
  v_exit_expired_no_match INTEGER := 0;
BEGIN
  -- ── Batch 1: 24h admin-pending → auto-approve + execute swap (TS F5) ──
  FOR v_record IN
    SELECT id, substitute_member_id, exit_request_id, circle_id
    FROM substitution_records
    WHERE status = 'admin_pending'
      AND admin_notified_at < NOW() - INTERVAL '24 hours'
  LOOP
    BEGIN
      v_swap_error := _execute_substitution_swap(v_record.id, true);
      IF v_swap_error IS NULL THEN
        v_auto_approvals_processed := v_auto_approvals_processed + 1;
      ELSE
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'batch', 'auto_approval',
          'substitution_record_id', v_record.id,
          'error', v_swap_error
        ));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'batch', 'auto_approval',
        'substitution_record_id', v_record.id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  -- ── Batch 2: 48h pending_confirmation → expire + offer next (TS F6) ──
  FOR v_record IN
    SELECT id, substitute_member_id, exit_request_id, circle_id
    FROM substitution_records
    WHERE status = 'pending_confirmation'
      AND confirmation_deadline < NOW()
  LOOP
    BEGIN
      -- Mark expired
      UPDATE substitution_records
      SET status = 'expired'
      WHERE id = v_record.id;

      -- Track decline on the substitute (TS G1 _trackDecline)
      UPDATE substitute_pool
      SET decline_count_90d = decline_count_90d + 1,
          last_decline_at = NOW(),
          status = CASE WHEN decline_count_90d + 1 >= 3 THEN 'suspended' ELSE status END,
          suspended_at = CASE WHEN decline_count_90d + 1 >= 3 THEN NOW() ELSE suspended_at END
      WHERE member_id = v_record.substitute_member_id;

      -- Flip exit_request back to 'matching' so process_substitute_match
      -- accepts it (otherwise the idempotency guard would short-circuit).
      UPDATE circle_exit_requests
      SET status = 'matching',
          substitute_matched_id = NULL
      WHERE id = v_record.exit_request_id;

      -- Find next match EXCLUDING the just-expired substitute (matches TS
      -- F6 line ~859: nextMatches.filter(m => m.memberId !== record.substitute_member_id)).
      v_match_result := process_substitute_match(
        v_record.exit_request_id,
        v_record.substitute_member_id  -- exclude
      );
      v_next_match_attempted := v_next_match_attempted + 1;

      IF (v_match_result->>'matched')::BOOLEAN = false THEN
        UPDATE circle_exit_requests
        SET status = 'expired',
            payout_entitlement_status = 'forfeited'
        WHERE id = v_record.exit_request_id;
        v_exit_expired_no_match := v_exit_expired_no_match + 1;
      END IF;

      v_expired_processed := v_expired_processed + 1;
    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'batch', 'expired_confirmation',
        'substitution_record_id', v_record.id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  -- ── Batch 3: 90d decline counter reset (TS G3) ──
  WITH reset AS (
    UPDATE substitute_pool
    SET decline_count_90d = 0
    WHERE decline_count_90d > 0
      AND last_decline_at < NOW() - INTERVAL '90 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_decline_counters_reset FROM reset;

  RETURN jsonb_build_object(
    'success', true,
    'auto_approvals_processed', v_auto_approvals_processed,
    'expired_confirmations_processed', v_expired_processed,
    'next_match_attempts', v_next_match_attempted,
    'exit_requests_forfeited_no_candidates', v_exit_expired_no_match,
    'decline_counters_reset', v_decline_counters_reset,
    'errors', v_errors,
    'source', 'process_substitute_lifecycle_rpc',
    'note', '24h auto-approve, 48h expire+cascade with substitute exclusion, 90d decline reset.'
  );
END;
$$;


-- ── Grants ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.find_substitute_matches(UUID, INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_substitute_match(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_substitute_lifecycle() TO service_role;
GRANT EXECUTE ON FUNCTION public._execute_substitution_swap(UUID, BOOLEAN) TO service_role;
REVOKE EXECUTE ON FUNCTION public.find_substitute_matches(UUID, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_substitute_match(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_substitute_lifecycle() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._execute_substitution_swap(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('100', 'substitute_lifecycle_cron',
        ARRAY['-- 100: SubstituteMemberEngine D2 — lifecycle cron + matcher exclusion param'])
ON CONFLICT (version) DO NOTHING;
