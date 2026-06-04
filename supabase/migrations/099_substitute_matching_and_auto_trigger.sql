-- ════════════════════════════════════════════════════════════════════════════
-- Migration 099: Substitute Member — server-side matching + auto-trigger
-- Phase D1 of feat(substitute).
-- ════════════════════════════════════════════════════════════════════════════
-- Ports the AI matching algorithm from services/SubstituteMemberEngine.ts
-- (E1 findMatches and E2 _offerToTopMatch) into SECURITY DEFINER PL/pgSQL so
-- it runs reliably under RLS (the TS path reads substitute_pool across all
-- members, which a non-service-role client cannot do safely). Also fires
-- automatically on circle_exit_requests INSERT so the engine no longer
-- depends on an explicit approveExitRequest call (approved decision:
-- "Auto-match, notify admin" — admin still notified and can decline the
-- substitution_record in the 24h admin window from D2).
--
-- ── Engine ↔ schema reconciliation (important) ──────────────────────────────
-- The TS engine (services/SubstituteMemberEngine.ts line ~615) reads:
--   circle.contribution_amount, circle.city, circle.country
--   profile.city, profile.preferred_language
-- None of those four columns exist in the prod schema (verified 2026-06-04):
--   * circles has  amount, location, beneficiary_country — NOT contribution_amount/city/country
--   * profiles has country, language — NOT city, NOT preferred_language
--   * circle_cycles has cycle_status — NOT status
-- This means the engine as authored would fail at runtime against prod.
-- This PL/pgSQL port uses the actual column names:
--   * circles.amount * 100  (contribution_amount_cents)
--   * profiles.country, profiles.language
-- And degrades the geographic match gracefully — there is no profile.city,
-- so the +40 same-city bonus is permanently 0; circles has no .country
-- column matching profiles.country either, so the +20 same-country bonus
-- also degrades to 0. The remaining dimensions (contribution-compat HARD
-- filter, language, reliability, active status) still produce a meaningful
-- ranking. Future schema additions of profiles.city + circles.city/country
-- (or normalising location text → city/country) would re-enable the
-- geographic dimensions without further code changes if we add them as
-- new optional columns and switch the CASE branches below.
--
-- Algorithm parity with TS (max = 65, was 105 with geo):
--   +40  same_city                    → DORMANT (no profile.city)
--   +20  same_country                 → DORMANT (no circle.country column)
--   +25  contribution_compatible      → HARD FILTER: skip if max_contribution_amount_cents > 0 AND < amount*100
--   +15  language_match               → profile.language ∈ entry.preferred_languages
--   +0–20 reliability bonus           → ROUND((substitute_reliability_score / 100) * 20)
--   +5   active (vs standby)          → entry.status = 'active'
-- Sorted DESC by match_score, then reliability_score DESC.
-- Excludes existing active circle members AND the exiting member.
-- ════════════════════════════════════════════════════════════════════════════


-- ── check_substitute_pool_eligibility ──────────────────────────────────────
-- Mirrors C1 SubstituteMemberEngine.checkPoolEligibility(userId)
-- Returns JSONB: {eligible, reason, xn_score, completed_circles, already_in_pool}

DROP FUNCTION IF EXISTS check_substitute_pool_eligibility(UUID);

CREATE OR REPLACE FUNCTION check_substitute_pool_eligibility(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_xn_score INTEGER;
  v_completed_circles INTEGER;
  v_existing_status TEXT;
BEGIN
  SELECT xn_score INTO v_xn_score FROM profiles WHERE id = p_user_id;
  v_xn_score := COALESCE(v_xn_score, 0);

  SELECT COUNT(*) INTO v_completed_circles
  FROM circle_members
  WHERE user_id = p_user_id
    AND status = 'inactive'
    AND circle_id IS NOT NULL;

  SELECT status INTO v_existing_status
  FROM substitute_pool
  WHERE member_id = p_user_id
  LIMIT 1;

  IF v_existing_status IS NOT NULL AND v_existing_status <> 'removed' THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Already in the substitute pool',
      'xn_score', v_xn_score,
      'completed_circles', v_completed_circles,
      'already_in_pool', true,
      'source', 'check_substitute_pool_eligibility_rpc'
    );
  END IF;

  IF v_xn_score < 60 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'XnScore must be 60 or higher (Trusted tier)',
      'xn_score', v_xn_score,
      'completed_circles', v_completed_circles,
      'already_in_pool', false,
      'source', 'check_substitute_pool_eligibility_rpc'
    );
  END IF;

  IF v_completed_circles < 1 THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'reason', 'Must have completed at least one circle',
      'xn_score', v_xn_score,
      'completed_circles', v_completed_circles,
      'already_in_pool', false,
      'source', 'check_substitute_pool_eligibility_rpc'
    );
  END IF;

  RETURN jsonb_build_object(
    'eligible', true,
    'reason', NULL,
    'xn_score', v_xn_score,
    'completed_circles', v_completed_circles,
    'already_in_pool', false,
    'source', 'check_substitute_pool_eligibility_rpc'
  );
END;
$$;


-- ── find_substitute_matches ────────────────────────────────────────────────
-- Mirrors E1 SubstituteMemberEngine.findMatches(circleId, exitRequestId).
-- Returns JSONB {success, candidate_count, candidates[]} sorted DESC by score.

DROP FUNCTION IF EXISTS find_substitute_matches(UUID, INTEGER);

CREATE OR REPLACE FUNCTION find_substitute_matches(
  p_exit_request_id UUID,
  p_limit INTEGER DEFAULT 10
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
      -- Geographic dimensions DORMANT: profiles.city does not exist;
      -- circles has no .country column matching profiles.country
      false AS same_city,
      false AS same_country,
      -- Contribution compatibility (HARD filter — see WHERE below)
      (sp.max_contribution_amount_cents = 0
        OR sp.max_contribution_amount_cents >= v_contribution_amount_cents) AS contribution_compatible
    FROM substitute_pool sp
    JOIN profiles p ON p.id = sp.member_id
    WHERE sp.status IN ('active', 'standby')
      -- Exclude all current active circle members (TS engine's intent;
      -- the TS-line-649 delete-from-set quirk would allow self-substitution
      -- by the exiting member, which is nonsensical — we exclude them.)
      AND sp.member_id NOT IN (SELECT user_id FROM active_circle_members)
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
    WHERE contribution_compatible  -- HARD filter: drop if can't afford
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
    'source', 'find_substitute_matches_rpc'
  );
END;
$$;


-- ── process_substitute_match ───────────────────────────────────────────────
-- Mirrors E2 SubstituteMemberEngine._offerToTopMatch. Picks the top match,
-- inserts substitution_record + flips exit_request to 'matched', notifies
-- the substitute via notification_queue.
-- Idempotent: if exit_request is already past 'matching' (matched/substituted/
-- completed/cancelled/expired), returns early without side effects.

DROP FUNCTION IF EXISTS process_substitute_match(UUID);

CREATE OR REPLACE FUNCTION process_substitute_match(p_exit_request_id UUID)
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

  -- Idempotency
  IF v_exit_request.status NOT IN ('pending', 'approved', 'matching') THEN
    RETURN jsonb_build_object(
      'success', true,
      'matched', false,
      'reason', 'exit_request not in matchable state',
      'current_status', v_exit_request.status,
      'source', 'process_substitute_match_rpc'
    );
  END IF;

  v_matches := find_substitute_matches(p_exit_request_id, 1);

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

  -- Use circle_cycles.cycle_status (NOT .status — engine bug)
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

  -- Notify substitute (mirrors I2 _notifySubstitute)
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


-- ── trg_auto_match_on_exit_submit ──────────────────────────────────────────
-- AFTER INSERT trigger that:
--   1. Flips status to 'matching'
--   2. Notifies the circle admin (mirrors I1 _notifyCircleAdmin)
--   3. Calls process_substitute_match — failure non-fatal (status stays
--      'matching' for the D2 cron to pick up).

CREATE OR REPLACE FUNCTION trg_auto_match_on_exit_submit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id UUID;
  v_match_result JSONB;
BEGIN
  -- 1. Flip status to 'matching'
  UPDATE circle_exit_requests
  SET status = 'matching'
  WHERE id = NEW.id;

  -- 2. Notify circle admin (matches I1, preferring creator if both exist)
  SELECT user_id INTO v_admin_id
  FROM circle_members
  WHERE circle_id = NEW.circle_id
    AND role IN ('admin', 'creator')
  ORDER BY (role = 'creator') DESC
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO notification_queue (
      member_id, notification_type, title, body, data
    ) VALUES (
      v_admin_id,
      'circle_events',
      'A member has requested to exit your circle',
      'Review the exit request and the system will begin searching for a qualified substitute.',
      jsonb_build_object(
        'exitRequestId', NEW.id,
        'memberId', NEW.member_id,
        'circleId', NEW.circle_id,
        'eventType', 'exit_request'
      )
    );
  END IF;

  -- 3. Call process_substitute_match — failure non-fatal
  BEGIN
    v_match_result := process_substitute_match(NEW.id);
    RAISE NOTICE 'auto-match result for exit_request %: %', NEW.id, v_match_result;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'auto-match failed for exit_request %: % (status stays matching for cron retry)',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_match_on_exit_submit ON circle_exit_requests;
CREATE TRIGGER auto_match_on_exit_submit
  AFTER INSERT ON circle_exit_requests
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION trg_auto_match_on_exit_submit();


-- ── Grants ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.check_substitute_pool_eligibility(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.find_substitute_matches(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_substitute_match(UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION public.check_substitute_pool_eligibility(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.find_substitute_matches(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_substitute_match(UUID) FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('099', 'substitute_matching_and_auto_trigger',
        ARRAY['-- 099: SubstituteMemberEngine D1 — matching RPCs + auto-trigger'])
ON CONFLICT (version) DO NOTHING;
