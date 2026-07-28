-- ═══════════════════════════════════════════════════════════════════════════
-- 386_admin_substitute_console.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Admin visibility layer for the substitute matching system. Ships the
-- read-only Phase 1: RLS policies + a single read RPC. No admin action
-- RPCs — every substitute-related table has 0 rows in prod, so building
-- reassign/cancel/force-match actions right now would be design-by-
-- imagination. Add them once real traffic reveals the specific override
-- needs.
--
-- Schema state (verified 2026-07-28):
--   substitute_pool                 — 17 cols, 0 rows, member-scoped RLS
--                                     (no admin read policy — this fixes)
--   circle_exit_requests            — 21 cols, 0 rows, voluntary exit path
--   substitute_needed_events        — 9 cols, 0 rows, admin RLS already
--                                     from mig 382
--   substitution_records            — 26 cols, 0 rows, involved-only RLS
--                                     (no admin read policy — this fixes)
--
-- Adds:
--   1. Admin-read RLS on substitute_pool + substitution_records.
--   2. admin_override_reason + override_by_admin_id on substitution_records
--      (pre-provisioned for Phase 2 action RPCs).
--   3. get_admin_substitute_dashboard() RPC returning four sections:
--      open_at_risk, pending_matches, pool_health, risky_matches.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Admin-read policies ──────────────────────────────────────────────
-- Mirrors the pattern from mig 382 (substitute_needed_events) and mig 384
-- (dispute admin RLS): any active admin_users row grants read across the
-- table. Write paths remain the existing SECURITY DEFINER RPCs
-- (rotate_substitute, process_substitute_match, etc.) — this is
-- read-only, no admin ALL policy.

DROP POLICY IF EXISTS substitute_pool_admin_read ON public.substitute_pool;
CREATE POLICY substitute_pool_admin_read ON public.substitute_pool
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ));

DROP POLICY IF EXISTS substitution_records_admin_read ON public.substitution_records;
CREATE POLICY substitution_records_admin_read ON public.substitution_records
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- ─── 2. Pre-provision Phase 2 override columns ───────────────────────────
-- Added now (empty, DEFAULT NULL) so a Phase 2 admin-action mig doesn't
-- need to touch schema — just adds the RPCs. Matches the pattern used by
-- mig 376 pre-provisioning payout columns for Doc 39.
ALTER TABLE public.substitution_records
  ADD COLUMN IF NOT EXISTS admin_override_reason TEXT,
  ADD COLUMN IF NOT EXISTS override_by_admin_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 3. get_admin_substitute_dashboard ────────────────────────────────────
-- Any active admin can read. Returns one JSONB payload with four sections
-- matching the AdminSubstituteDashboardScreen card layout:
--
--   * open_at_risk       — substitute_needed_events WHERE status='open'
--   * pending_matches    — substitution_records where the assigned
--                          substitute hasn't confirmed yet and the
--                          confirmation window is still open
--   * pool_health        — counts + averages for the substitute_pool
--   * risky_matches      — substitution_records where the substitute
--                          has zero history (never a circle_members row)
--                          in the target circle
--
-- Every section is pre-joined to profiles + circles for display so the UI
-- makes one call.
CREATE OR REPLACE FUNCTION public.get_admin_substitute_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin        UUID;
  v_at_risk      JSONB;
  v_pending      JSONB;
  v_health       JSONB;
  v_risky        JSONB;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = v_admin AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'admin_required';
  END IF;

  -- ── Section 1: open at-risk events ─────────────────────────────────
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.age_hours DESC), '[]'::jsonb)
    INTO v_at_risk
    FROM (
      SELECT
        e.id                                              AS event_id,
        e.circle_id,
        c.name                                            AS circle_name,
        e.at_risk_user_id,
        COALESCE(p.full_name, p.display_name, 'Member')   AS at_risk_name,
        e.cycle_id,
        e.risk_score,
        e.reason,
        e.status,
        e.created_at,
        EXTRACT(EPOCH FROM (NOW() - e.created_at)) / 3600.0 AS age_hours
      FROM public.substitute_needed_events e
      LEFT JOIN public.circles  c ON c.id = e.circle_id
      LEFT JOIN public.profiles p ON p.id = e.at_risk_user_id
      WHERE e.status = 'open'
      LIMIT 100
    ) t;

  -- ── Section 2: pending matches (matched, awaiting confirmation) ────
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.hours_until_deadline ASC), '[]'::jsonb)
    INTO v_pending
    FROM (
      SELECT
        r.id                                              AS record_id,
        r.circle_id,
        c.name                                            AS circle_name,
        r.exit_request_id,
        r.exiting_member_id,
        COALESCE(ep.full_name, ep.display_name)           AS exiting_name,
        r.at_risk_user_id,
        COALESCE(ap.full_name, ap.display_name)           AS at_risk_name,
        r.substitute_member_id,
        COALESCE(sp.full_name, sp.display_name)           AS substitute_name,
        r.original_payout_position,
        r.payout_entitlement_transfer_cents,
        r.confirmation_deadline,
        r.auto_approved,
        r.status,
        r.created_at,
        EXTRACT(EPOCH FROM (r.confirmation_deadline - NOW())) / 3600.0 AS hours_until_deadline
      FROM public.substitution_records r
      LEFT JOIN public.circles  c  ON c.id = r.circle_id
      LEFT JOIN public.profiles ep ON ep.id = r.exiting_member_id
      LEFT JOIN public.profiles ap ON ap.id = r.at_risk_user_id
      LEFT JOIN public.profiles sp ON sp.id = r.substitute_member_id
      WHERE r.confirmed_at IS NULL
        AND r.declined_at  IS NULL
        AND r.confirmation_deadline IS NOT NULL
        AND r.confirmation_deadline > NOW()
      LIMIT 100
    ) t;

  -- ── Section 3: pool health ─────────────────────────────────────────
  SELECT jsonb_build_object(
    'active_count',       (SELECT COUNT(*)::INT FROM public.substitute_pool
                            WHERE status = 'active' AND removed_at IS NULL),
    'suspended_count',    (SELECT COUNT(*)::INT FROM public.substitute_pool
                            WHERE suspended_at IS NOT NULL AND removed_at IS NULL),
    'removed_count',      (SELECT COUNT(*)::INT FROM public.substitute_pool
                            WHERE removed_at IS NOT NULL),
    'frequent_decliners', (SELECT COUNT(*)::INT FROM public.substitute_pool
                            WHERE decline_count_90d >= 3
                              AND removed_at IS NULL),
    'avg_reliability',    (SELECT ROUND(AVG(substitute_reliability_score)::NUMERIC, 2)
                             FROM public.substitute_pool
                            WHERE status = 'active' AND removed_at IS NULL),
    'total_substitutions_lifetime', (
      SELECT COALESCE(SUM(total_substitutions), 0)::INT FROM public.substitute_pool
    )
  ) INTO v_health;

  -- ── Section 4: risky matches — substitute has no history in circle ──
  -- Check: substitute_member_id has never appeared in circle_members for
  -- this circle_id (regardless of status). A former member returning as
  -- substitute has history; a total newcomer does not.
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_risky
    FROM (
      SELECT
        r.id                                              AS record_id,
        r.circle_id,
        c.name                                            AS circle_name,
        r.substitute_member_id,
        COALESCE(sp.full_name, sp.display_name)           AS substitute_name,
        r.exiting_member_id,
        r.at_risk_user_id,
        r.status,
        r.auto_approved,
        r.confirmation_deadline,
        r.created_at,
        (SELECT COUNT(*)::INT FROM public.substitute_pool sp2
          WHERE sp2.member_id = r.substitute_member_id) AS in_pool,
        (SELECT COALESCE(substitute_reliability_score, 0)::NUMERIC FROM public.substitute_pool sp2
          WHERE sp2.member_id = r.substitute_member_id) AS pool_reliability
      FROM public.substitution_records r
      LEFT JOIN public.circles  c  ON c.id = r.circle_id
      LEFT JOIN public.profiles sp ON sp.id = r.substitute_member_id
      WHERE r.substitute_member_id IS NOT NULL
        AND r.circle_id IS NOT NULL
        AND r.confirmed_at IS NULL
        AND r.declined_at  IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.circle_members cm
           WHERE cm.circle_id = r.circle_id
             AND cm.user_id   = r.substitute_member_id
        )
      LIMIT 100
    ) t;

  RETURN jsonb_build_object(
    'open_at_risk',    v_at_risk,
    'pending_matches', v_pending,
    'pool_health',     v_health,
    'risky_matches',   v_risky,
    'generated_at',    NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_substitute_dashboard() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_substitute_dashboard() TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '386',
  'admin_substitute_console',
  ARRAY['-- 386: admin-read RLS on substitute_pool + substitution_records; pre-provision admin_override_reason + override_by_admin_id on substitution_records; get_admin_substitute_dashboard() read RPC. Phase 2 action RPCs deferred until real traffic exists.']
)
ON CONFLICT (version) DO NOTHING;
