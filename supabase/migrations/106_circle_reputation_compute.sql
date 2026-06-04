-- ════════════════════════════════════════════════════════════════════════════
-- Migration 106: Circle Reputation — compute on completion + inheritance lookup
-- Step 2 of feat(circle-reputation).
-- ════════════════════════════════════════════════════════════════════════════
-- Three functions + one trigger:
--
--   compute_circle_reputation(p_circle_id UUID) → JSONB
--     SECURITY DEFINER. Validates the circle is in 'completed' state.
--     Aggregates cycle_contributions, upserts circle_reputation, refreshes
--     circle_reputation_members for all active members at completion,
--     stamps circles.reputation_score with the result. Idempotent via
--     UPSERT on circle_reputation.circle_id UNIQUE.
--
--   trg_circle_completion_reputation() trigger fn → fires AFTER UPDATE on
--     circles WHEN status flips from non-completed to 'completed'. Calls
--     compute_circle_reputation(NEW.id) inside BEGIN..EXCEPTION so a
--     bad row never blocks the status change.
--
--   get_inherited_reputation_for_members(p_member_ids UUID[]) → JSONB
--     STABLE. Public RPC granted to authenticated. Given a set of
--     prospective members, looks up every circle_reputation row any of
--     them inherits (via circle_reputation_members), and returns
--     {average_reputation, reputation_count, members_with_history,
--      members_total, qualifies_for_premium, breakdown[]} so the
--     CreateCircle preview UI can display "your group's score: 85".
--
-- Algorithm (per spec, simple form):
--   avg_on_time_pct = AVG(case when paid AND was_on_time then 100 else 0)
--   default_free   = NOT EXISTS contribution_status IN ('missed','defaulted')
--   overall_score  = avg_on_time_pct * 0.7 + (default_free ? 30 : 0)
--   Max = 100. Default-free + 100% on-time → 100. Default-laden + 0% on-time → 0.
--
-- The richer four-component formula in the spec preamble (40/30/15/15) is
-- left for a refinement pass — keeping Step 2 simple per the user's
-- explicit "use a simple version for now" instruction.
-- ════════════════════════════════════════════════════════════════════════════


-- ── compute_circle_reputation ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_circle_reputation(p_circle_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status TEXT;
  v_completed_at TIMESTAMPTZ;
  v_total INTEGER := 0;
  v_on_time INTEGER := 0;
  v_defaulted INTEGER := 0;
  v_paid_cents BIGINT := 0;
  v_avg_on_time_pct NUMERIC(5,2) := 0;
  v_default_free BOOLEAN := false;
  v_overall_score NUMERIC(5,2) := 0;
  v_member_count INTEGER := 0;
  v_consistent_members INTEGER := 0;
  v_contribution_consistency NUMERIC(5,2) := 0;
  v_reputation_id UUID;
BEGIN
  -- (1) Validate circle status — only 'completed' circles get reputation
  SELECT status, completed_at INTO v_status, v_completed_at
  FROM circles WHERE id = p_circle_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'circle not found'
    );
  END IF;

  IF v_status <> 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'circle status must be completed (currently: ' || v_status || ')'
    );
  END IF;

  -- Fall back to NOW() if the circle has no completed_at stamp
  v_completed_at := COALESCE(v_completed_at, NOW());

  -- (2) Active member count
  SELECT COUNT(*) INTO v_member_count
  FROM circle_members
  WHERE circle_id = p_circle_id AND status = 'active';

  -- (3) Aggregate cycle_contributions for the circle
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE contribution_status = 'paid'
                       AND was_on_time = true),
    COUNT(*) FILTER (WHERE contribution_status IN ('missed', 'defaulted')),
    COALESCE(SUM(ROUND(contributed_amount * 100))::BIGINT, 0)
  INTO v_total, v_on_time, v_defaulted, v_paid_cents
  FROM cycle_contributions
  WHERE circle_id = p_circle_id;

  IF v_total > 0 THEN
    v_avg_on_time_pct := (v_on_time::NUMERIC / v_total) * 100;
  END IF;

  v_default_free := (v_defaulted = 0);

  -- (4) Member-level contribution consistency:
  -- count of members where every one of their contributions paid on time
  IF v_member_count > 0 AND v_total > 0 THEN
    SELECT COUNT(*) INTO v_consistent_members
    FROM (
      SELECT cc.user_id
      FROM cycle_contributions cc
      WHERE cc.circle_id = p_circle_id
      GROUP BY cc.user_id
      HAVING COUNT(*) FILTER (
               WHERE NOT (cc.contribution_status = 'paid'
                          AND cc.was_on_time = true)
             ) = 0
    ) sub;
    v_contribution_consistency :=
      (v_consistent_members::NUMERIC / v_member_count) * 100;
  END IF;

  -- (5) Composite score (simple form per spec)
  v_overall_score := LEAST(100, GREATEST(0,
    v_avg_on_time_pct * 0.7
    + CASE WHEN v_default_free THEN 30 ELSE 0 END
  ));

  -- (6) UPSERT into circle_reputation (UNIQUE(circle_id))
  INSERT INTO circle_reputation (
    circle_id, overall_score, contribution_consistency, default_free,
    avg_on_time_pct, members_count, total_contributions, total_paid_cents,
    total_defaulted, completed_at
  ) VALUES (
    p_circle_id, v_overall_score, v_contribution_consistency, v_default_free,
    v_avg_on_time_pct, v_member_count, v_total, v_paid_cents,
    v_defaulted, v_completed_at
  )
  ON CONFLICT (circle_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    contribution_consistency = EXCLUDED.contribution_consistency,
    default_free = EXCLUDED.default_free,
    avg_on_time_pct = EXCLUDED.avg_on_time_pct,
    members_count = EXCLUDED.members_count,
    total_contributions = EXCLUDED.total_contributions,
    total_paid_cents = EXCLUDED.total_paid_cents,
    total_defaulted = EXCLUDED.total_defaulted,
    completed_at = EXCLUDED.completed_at,
    updated_at = NOW()
  RETURNING id INTO v_reputation_id;

  -- (7) Refresh member links — wipe and re-insert so we always reflect
  -- the active membership at the time of computation
  DELETE FROM circle_reputation_members
  WHERE reputation_id = v_reputation_id;

  INSERT INTO circle_reputation_members (reputation_id, user_id)
  SELECT v_reputation_id, cm.user_id
  FROM circle_members cm
  WHERE cm.circle_id = p_circle_id AND cm.status = 'active';

  -- (8) Stamp the circle's own reputation_score
  UPDATE circles SET reputation_score = v_overall_score
  WHERE id = p_circle_id;

  RETURN jsonb_build_object(
    'success', true,
    'reputation_id', v_reputation_id,
    'overall_score', v_overall_score,
    'contribution_consistency', v_contribution_consistency,
    'default_free', v_default_free,
    'avg_on_time_pct', v_avg_on_time_pct,
    'members_count', v_member_count,
    'total_contributions', v_total,
    'total_defaulted', v_defaulted,
    'source', 'compute_circle_reputation_rpc'
  );
END;
$$;


-- ── Trigger on circle completion ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_circle_completion_reputation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Fire only on the transition into 'completed' (not on idempotent UPDATEs)
  BEGIN
    PERFORM compute_circle_reputation(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'circle reputation compute failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_completion_reputation ON circles;
CREATE TRIGGER circle_completion_reputation
  AFTER UPDATE OF status ON circles
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'completed'
        AND OLD.status <> 'completed')
  EXECUTE FUNCTION trg_circle_completion_reputation();


-- ── get_inherited_reputation_for_members ──────────────────────────────────
-- Read-only RPC the CreateCircle preview UI calls with a prospective member
-- list. Returns the group's averaged reputation across all past
-- circle_reputation rows any member inherits.

CREATE OR REPLACE FUNCTION get_inherited_reputation_for_members(
  p_member_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_members INTEGER;
  v_avg NUMERIC(5,2);
  v_reputation_count INTEGER;
  v_members_with_history INTEGER;
  v_breakdown JSONB;
BEGIN
  v_total_members := COALESCE(array_length(p_member_ids, 1), 0);

  IF v_total_members = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'average_reputation', 0,
      'reputation_count', 0,
      'members_with_history', 0,
      'members_total', 0,
      'qualifies_for_premium', false,
      'breakdown', '[]'::jsonb,
      'note', 'no members supplied'
    );
  END IF;

  -- Each reputation contributes its overall_score once even if multiple of
  -- the prospective members inherit it (so a co-completed circle doesn't
  -- get double-counted when 2+ of its members join a new circle together)
  WITH inherited AS (
    SELECT DISTINCT cr.id, cr.overall_score, cr.circle_id
    FROM circle_reputation cr
    JOIN circle_reputation_members crm ON crm.reputation_id = cr.id
    WHERE crm.user_id = ANY(p_member_ids)
  )
  SELECT
    COALESCE(AVG(overall_score), 0)::NUMERIC(5,2),
    COUNT(*)::INTEGER,
    COALESCE(jsonb_agg(jsonb_build_object(
      'reputation_id', id,
      'circle_id', circle_id,
      'overall_score', overall_score
    )), '[]'::jsonb)
  INTO v_avg, v_reputation_count, v_breakdown
  FROM inherited;

  SELECT COUNT(DISTINCT crm.user_id)::INTEGER INTO v_members_with_history
  FROM circle_reputation_members crm
  WHERE crm.user_id = ANY(p_member_ids);

  RETURN jsonb_build_object(
    'success', true,
    'average_reputation', v_avg,
    'reputation_count', v_reputation_count,
    'members_with_history', v_members_with_history,
    'members_total', v_total_members,
    -- Premium threshold matches the planned Step 3 cut: >80 unlocks the
    -- 0.5pp insurance discount + the 90% liquidity max
    'qualifies_for_premium', (v_avg > 80),
    'breakdown', v_breakdown,
    'source', 'get_inherited_reputation_for_members_rpc'
  );
END;
$$;


-- ── Grants ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.compute_circle_reputation(UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION public.compute_circle_reputation(UUID)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_inherited_reputation_for_members(UUID[])
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_inherited_reputation_for_members(UUID[])
  FROM PUBLIC, anon;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('106', 'circle_reputation_compute',
        ARRAY['-- 106: CircleReputation Step 2 — compute + trigger + inheritance lookup'])
ON CONFLICT (version) DO NOTHING;
