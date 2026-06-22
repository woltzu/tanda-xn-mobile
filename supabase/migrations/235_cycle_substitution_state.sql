-- ════════════════════════════════════════════════════════════════════════════
-- Migration 235: cycle_substitution_state
-- Substitution Visibility — Bucket A
-- ════════════════════════════════════════════════════════════════════════════
--
-- New read-side RPC that exposes active substitution_records rows for a
-- given cycle so the cycle timeline screens can surface substitution
-- context inline with the per-member contribution rows. Audit (2026-06-22)
-- showed:
--   • substitution_records carries a rich 9-state lifecycle + 2 timestamp
--     windows (48 h substitute confirmation, 24 h admin approval).
--   • The existing get_cycle_status_summary RPC only returns aggregate
--     counts — no per-member or substitution context.
--   • CycleDetailScreen + CycleTimelineScreen have zero "substitut" refs.
--   • Live state: 0 substitution_records rows in prod. Gap is pre-impact.
--
-- This RPC is read-only and returns only non-terminal statuses
-- (pending_confirmation, confirmed, admin_pending) — terminal rows
-- (approved/completed/declined/expired/cancelled) are not relevant for an
-- "in-flight" overlay on the live cycle view.
--
-- Schema verification before authoring (2026-06-22, live):
--   • substitution_records.entry_cycle_id (NOT `cycle_id` — the spec's
--     proposed column name; corrected here).
--   • profiles has both `display_name` AND `full_name`; we COALESCE to
--     fall back when display_name is null, mirroring the convention used
--     by notify_event_created in migration 223.
--   • admin_pending's effective deadline is admin_notified_at + 24 h
--     (NOT sr.confirmation_deadline, which is the substitute's 48 h
--     window). The spec had this collapsed onto a single deadline; this
--     migration computes the two distinct windows correctly.
--
-- Idempotent via CREATE OR REPLACE and ON CONFLICT.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_cycle_substitution_state(
  p_cycle_id UUID
)
RETURNS TABLE (
  substitution_id          UUID,
  circle_id                UUID,
  exiting_member_id        UUID,
  exiting_member_name      TEXT,
  substitute_member_id     UUID,
  substitute_member_name   TEXT,
  original_payout_position INTEGER,
  status                   TEXT,
  confirmation_deadline    TIMESTAMPTZ,
  admin_notified_at        TIMESTAMPTZ,
  hours_remaining_for_actor INTEGER,
  actor_role               TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id                                                          AS substitution_id,
    sr.circle_id                                                   AS circle_id,
    sr.exiting_member_id                                           AS exiting_member_id,
    COALESCE(p_exit.display_name, p_exit.full_name, 'A member')    AS exiting_member_name,
    sr.substitute_member_id                                        AS substitute_member_id,
    COALESCE(p_sub.display_name, p_sub.full_name, 'A member')      AS substitute_member_name,
    sr.original_payout_position                                    AS original_payout_position,
    sr.status                                                      AS status,
    sr.confirmation_deadline                                       AS confirmation_deadline,
    sr.admin_notified_at                                           AS admin_notified_at,
    -- Effective hours-remaining for whichever actor's clock is running:
    --   pending_confirmation → substitute's 48 h window
    --   confirmed            → no clock (waiting for trigger to flip to
    --                          admin_pending; engine populates
    --                          admin_notified_at at that flip)
    --   admin_pending        → admin's 24 h from admin_notified_at
    -- Floor at 0 so negative drift (clock just elapsed) doesn't render
    -- as "-1 h" before the auto-expire trigger catches up.
    CASE
      WHEN sr.status = 'pending_confirmation' THEN
        GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (sr.confirmation_deadline - NOW())) / 3600)::INTEGER
        )
      WHEN sr.status = 'admin_pending' AND sr.admin_notified_at IS NOT NULL THEN
        GREATEST(
          0,
          FLOOR(EXTRACT(EPOCH FROM (sr.admin_notified_at + INTERVAL '24 hours' - NOW())) / 3600)::INTEGER
        )
      ELSE NULL
    END                                                            AS hours_remaining_for_actor,
    -- Which actor's input is currently required, for UI banners:
    CASE
      WHEN sr.status = 'pending_confirmation' THEN 'substitute'
      WHEN sr.status = 'admin_pending'        THEN 'admin'
      ELSE NULL
    END                                                            AS actor_role
  FROM public.substitution_records sr
  LEFT JOIN public.profiles p_exit ON p_exit.id = sr.exiting_member_id
  LEFT JOIN public.profiles p_sub  ON p_sub.id  = sr.substitute_member_id
  WHERE sr.entry_cycle_id = p_cycle_id
    AND sr.status IN ('pending_confirmation', 'confirmed', 'admin_pending')
  ORDER BY sr.original_payout_position ASC NULLS LAST,
           sr.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cycle_substitution_state(UUID) TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────
-- Uses the canonical schema_migrations table + (version, name, statements)
-- shape per CLAUDE.md migration conventions, not the alternate shape the
-- handover spec proposed.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '235',
  'cycle_substitution_state',
  ARRAY['-- 235: cycle_substitution_state']
)
ON CONFLICT (version) DO NOTHING;
