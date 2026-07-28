-- ═══════════════════════════════════════════════════════════════════════════
-- 384_admin_dispute_console.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Admin visibility + control layer for the dispute resolution flow. Extends
-- the existing `disputes` table (mig 261) with escalation + override fields
-- and adds three admin RPCs that power AdminDisputeDashboardScreen.
--
-- What already exists on disputes (mig 261):
--   * assigned_to UUID              — elder handling the case
--   * escalated_to TEXT             — legacy free-text like 'platform_admin'
--   * resolved_by UUID, resolution, resolution_type, resolved_at
--   * response_text + response_at   — from the accused party
--   * priority (default 'medium'), status (default 'open', no CHECK)
--   * mediation_fee, honor_score_reward
--
-- What this migration adds:
--   * escalated_at TIMESTAMPTZ                — bump timestamp for tier changes
--   * escalated_to_admin_id UUID              — FK to the admin who now owns
--     the escalation (kept alongside legacy `escalated_to` free-text)
--   * admin_override BOOLEAN NOT NULL DEFAULT FALSE
--   * override_reason TEXT
--   * escalation_tier TEXT                    — NULL / 'elder_l2' / 'global_queue'
--     Mirrors the pattern from `dispute_cases` (which is dead — see side
--     finding in the investigation report).
--
-- SLA is computed at read time in get_admin_dispute_dashboard — not stored.
-- Stored SLA flags drift; computed ones don't.
--
-- Three admin RPCs (all SECURITY DEFINER):
--   1. admin_override_dispute  — super_admin only. Big-hammer.
--   2. admin_reassign_dispute  — super_admin OR admin.
--   3. get_admin_dispute_dashboard — any active admin (read).
--
-- Role gates use `role IN ('super_admin','admin')` — the real valid values
-- per admin_users.role CHECK. 'platform_admin' is dead code in earlier
-- migrations and is not used here.
--
-- The existing resolve_dispute(dispute_id, resolution, status) RPC (mig
-- 261) is untouched — the UI keeps calling it for normal resolution.
-- admin_override_dispute is for the exceptional case where a platform
-- admin needs to force a decision, potentially overriding an elder.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Column additions ─────────────────────────────────────────────────
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS escalated_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_to_admin_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admin_override          BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS override_reason         TEXT,
  ADD COLUMN IF NOT EXISTS escalation_tier         TEXT;

-- Optional CHECK on escalation_tier — three legal values, always
-- semantically meaningful. NULL = never escalated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
     WHERE t.relname='disputes' AND c.conname='disputes_escalation_tier_check'
  ) THEN
    ALTER TABLE public.disputes
      ADD CONSTRAINT disputes_escalation_tier_check
      CHECK (escalation_tier IS NULL OR escalation_tier IN ('elder_l2','global_queue'));
  END IF;
END $$;

-- Indexes for the dashboard queries.
CREATE INDEX IF NOT EXISTS idx_disputes_escalation_tier
  ON public.disputes(escalation_tier)
  WHERE escalation_tier IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_disputes_status_open
  ON public.disputes(status, created_at DESC)
  WHERE status IN ('open','assigned','reviewing');

CREATE INDEX IF NOT EXISTS idx_disputes_resolved_at
  ON public.disputes(resolved_at DESC)
  WHERE resolved_at IS NOT NULL;

-- ─── 2. admin_override_dispute ────────────────────────────────────────────
-- super_admin only. Flips status to 'resolved', stamps admin_override=TRUE,
-- records override_reason (min 20 chars, mirrors Doc 38 pattern). Writes
-- a private audit line to dispute_messages so elders + members see there
-- was a platform-level intervention.
CREATE OR REPLACE FUNCTION public.admin_override_dispute(
  p_dispute_id      UUID,
  p_resolution      TEXT,
  p_resolution_type TEXT,
  p_reason          TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin       UUID;
  v_admin_role  TEXT;
  v_prev        RECORD;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role <> 'super_admin' THEN
    RAISE EXCEPTION 'super_admin_required';
  END IF;

  IF p_resolution IS NULL OR length(trim(p_resolution)) < 10 THEN
    RAISE EXCEPTION 'resolution_too_short';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 20 THEN
    RAISE EXCEPTION 'reason_too_short';
  END IF;

  SELECT id, status, assigned_to, resolved_by
    INTO v_prev
    FROM public.disputes
   WHERE id = p_dispute_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dispute_not_found';
  END IF;
  IF v_prev.status = 'resolved' AND v_prev.resolved_by IS NOT NULL THEN
    RAISE EXCEPTION 'already_resolved';
  END IF;

  UPDATE public.disputes
     SET status          = 'resolved',
         resolution      = trim(p_resolution),
         resolution_type = COALESCE(NULLIF(trim(p_resolution_type), ''), 'admin_override'),
         resolved_by     = v_admin,
         resolved_at     = NOW(),
         admin_override  = TRUE,
         override_reason = trim(p_reason),
         updated_at      = NOW()
   WHERE id = p_dispute_id;

  -- Audit line in dispute_messages. is_private=TRUE so it lands in the
  -- elder-only lane (mig 261's message_type semantics). message_type
  -- 'admin_override' tags it for downstream filters.
  INSERT INTO public.dispute_messages (
    dispute_id, sender_user_id, message, message_type, is_private
  )
  VALUES (
    p_dispute_id, v_admin,
    'Admin override applied. Reason: ' || trim(p_reason),
    'admin_override', TRUE
  );

  RETURN jsonb_build_object(
    'success',       TRUE,
    'dispute_id',    p_dispute_id,
    'resolved_by',   v_admin,
    'prev_status',   v_prev.status,
    'prev_assignee', v_prev.assigned_to
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_override_dispute(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_override_dispute(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ─── 3. admin_reassign_dispute ────────────────────────────────────────────
-- super_admin OR admin. Reassigns the dispute to a different elder or
-- admin. Does not verify that new_elder_id is an elder of the circle —
-- picker in the UI filters that; server accepts any valid user_id so
-- admins can special-case reassignment.
CREATE OR REPLACE FUNCTION public.admin_reassign_dispute(
  p_dispute_id    UUID,
  p_new_elder_id  UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin       UUID;
  v_admin_role  TEXT;
  v_prev        RECORD;
  v_new_name    TEXT;
BEGIN
  v_admin := auth.uid();
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  SELECT role INTO v_admin_role
    FROM public.admin_users
   WHERE user_id = v_admin AND is_active = TRUE;
  IF v_admin_role IS NULL THEN
    RAISE EXCEPTION 'admin_required';
  END IF;
  IF v_admin_role NOT IN ('super_admin','admin') THEN
    RAISE EXCEPTION 'insufficient_role';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_new_elder_id) THEN
    RAISE EXCEPTION 'new_assignee_not_found';
  END IF;

  SELECT id, status, assigned_to
    INTO v_prev
    FROM public.disputes
   WHERE id = p_dispute_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dispute_not_found';
  END IF;
  IF v_prev.status = 'resolved' THEN
    RAISE EXCEPTION 'already_resolved';
  END IF;
  IF v_prev.assigned_to = p_new_elder_id THEN
    RAISE EXCEPTION 'already_assigned_to_target';
  END IF;

  UPDATE public.disputes
     SET assigned_to = p_new_elder_id,
         status      = CASE WHEN status = 'open' THEN 'assigned' ELSE status END,
         updated_at  = NOW()
   WHERE id = p_dispute_id;

  SELECT COALESCE(full_name, display_name, 'a moderator') INTO v_new_name
    FROM public.profiles WHERE id = p_new_elder_id;

  INSERT INTO public.dispute_messages (
    dispute_id, sender_user_id, message, message_type, is_private
  )
  VALUES (
    p_dispute_id, v_admin,
    'Reassigned by admin to ' || COALESCE(v_new_name, 'a moderator') || '.',
    'admin_reassign', TRUE
  );

  RETURN jsonb_build_object(
    'success',       TRUE,
    'dispute_id',    p_dispute_id,
    'new_assignee',  p_new_elder_id,
    'prev_assignee', v_prev.assigned_to
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reassign_dispute(UUID, UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_reassign_dispute(UUID, UUID) TO authenticated;

-- ─── 4. get_admin_dispute_dashboard ──────────────────────────────────────
-- Any active admin can read. Returns one payload with:
--   * disputes_open      — all non-resolved rows with computed age_hours +
--                          sla_status ('ok'/'warning'/'critical'). UI filters
--                          into "active" / "escalated" / "sla_breached"
--                          sub-tabs client-side.
--   * resolved_recent    — resolved in last 7 days.
--   * counts             — quick totals for the top strip.
--
-- SLA thresholds: 48h → warning, 7d → critical. Same regardless of
-- priority (matches the escalate-stale-disputes cron and mig 261 defaults).
CREATE OR REPLACE FUNCTION public.get_admin_dispute_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin  UUID;
  v_open   JSONB;
  v_recent JSONB;
  v_counts JSONB;
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

  SELECT COALESCE(jsonb_agg(row_to_json(t)
    ORDER BY CASE t.sla_status WHEN 'critical' THEN 1
                                WHEN 'warning' THEN 2
                                ELSE 3 END,
             t.created_at DESC), '[]'::jsonb)
    INTO v_open
    FROM (
      SELECT
        d.id                                          AS dispute_id,
        d.circle_id,
        c.name                                        AS circle_name,
        d.reporter_user_id,
        COALESCE(rp.full_name, rp.display_name, 'Member') AS reporter_name,
        d.against_user_id,
        COALESCE(ap.full_name, ap.display_name, NULLIF(d.against_user_id::text, '')) AS against_name,
        d.type,
        d.title,
        d.description,
        d.priority,
        d.status,
        d.assigned_to,
        COALESCE(asg.full_name, asg.display_name)     AS assignee_name,
        d.escalation_tier,
        d.escalated_at,
        d.escalated_to_admin_id,
        COALESCE(esc.full_name, esc.display_name)     AS escalated_to_name,
        d.admin_override,
        d.response_at,
        d.created_at,
        EXTRACT(EPOCH FROM (NOW() - d.created_at)) / 3600.0 AS age_hours,
        CASE
          WHEN NOW() - d.created_at > INTERVAL '7 days'  THEN 'critical'
          WHEN NOW() - d.created_at > INTERVAL '48 hours' THEN 'warning'
          ELSE 'ok'
        END                                            AS sla_status,
        (SELECT COUNT(*)::INT FROM public.dispute_messages dm
          WHERE dm.dispute_id = d.id)                  AS message_count
      FROM public.disputes d
      LEFT JOIN public.circles  c   ON c.id   = d.circle_id
      LEFT JOIN public.profiles rp  ON rp.id  = d.reporter_user_id
      LEFT JOIN public.profiles ap  ON ap.id  = d.against_user_id
      LEFT JOIN public.profiles asg ON asg.id = d.assigned_to
      LEFT JOIN public.profiles esc ON esc.id = d.escalated_to_admin_id
      WHERE d.status IN ('open','assigned','reviewing')
    ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.resolved_at DESC), '[]'::jsonb)
    INTO v_recent
    FROM (
      SELECT
        d.id                                          AS dispute_id,
        d.circle_id,
        c.name                                        AS circle_name,
        COALESCE(rp.full_name, rp.display_name, 'Member') AS reporter_name,
        COALESCE(ap.full_name, ap.display_name)       AS against_name,
        d.title,
        d.priority,
        d.status,
        d.resolution,
        d.resolution_type,
        d.resolved_by,
        COALESCE(res.full_name, res.display_name)     AS resolver_name,
        d.resolved_at,
        d.admin_override,
        d.override_reason,
        EXTRACT(EPOCH FROM (d.resolved_at - d.created_at)) / 3600.0 AS resolution_hours
      FROM public.disputes d
      LEFT JOIN public.circles  c   ON c.id   = d.circle_id
      LEFT JOIN public.profiles rp  ON rp.id  = d.reporter_user_id
      LEFT JOIN public.profiles ap  ON ap.id  = d.against_user_id
      LEFT JOIN public.profiles res ON res.id = d.resolved_by
      WHERE d.status = 'resolved'
        AND d.resolved_at >= NOW() - INTERVAL '7 days'
      LIMIT 50
    ) t;

  SELECT jsonb_build_object(
    'active',         (SELECT COUNT(*)::INT FROM public.disputes
                        WHERE status IN ('open','assigned','reviewing')),
    'escalated',      (SELECT COUNT(*)::INT FROM public.disputes
                        WHERE escalation_tier IS NOT NULL
                          AND status IN ('open','assigned','reviewing')),
    'sla_breached',   (SELECT COUNT(*)::INT FROM public.disputes
                        WHERE status IN ('open','assigned','reviewing')
                          AND NOW() - created_at > INTERVAL '48 hours'),
    'resolved_7d',    (SELECT COUNT(*)::INT FROM public.disputes
                        WHERE status = 'resolved'
                          AND resolved_at >= NOW() - INTERVAL '7 days')
  ) INTO v_counts;

  RETURN jsonb_build_object(
    'disputes_open',      v_open,
    'resolved_recent',    v_recent,
    'counts',             v_counts,
    'sla_warn_hours',     48,
    'sla_critical_hours', 168
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dispute_dashboard() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dispute_dashboard() TO authenticated;

-- ─── 5. get_admin_dispute_detail ──────────────────────────────────────────
-- Any active admin can read. Returns one dispute + its full message
-- thread (both public and private) for the detail screen.
CREATE OR REPLACE FUNCTION public.get_admin_dispute_detail(
  p_dispute_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin  UUID;
  v_row    JSONB;
  v_msgs   JSONB;
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

  SELECT to_jsonb(t)
    INTO v_row
    FROM (
      SELECT
        d.*,
        c.name                                        AS circle_name,
        COALESCE(rp.full_name, rp.display_name, 'Member') AS reporter_name,
        COALESCE(ap.full_name, ap.display_name)       AS against_name,
        COALESCE(asg.full_name, asg.display_name)     AS assignee_name,
        COALESCE(res.full_name, res.display_name)     AS resolver_name,
        COALESCE(esc.full_name, esc.display_name)     AS escalated_to_name
      FROM public.disputes d
      LEFT JOIN public.circles  c   ON c.id   = d.circle_id
      LEFT JOIN public.profiles rp  ON rp.id  = d.reporter_user_id
      LEFT JOIN public.profiles ap  ON ap.id  = d.against_user_id
      LEFT JOIN public.profiles asg ON asg.id = d.assigned_to
      LEFT JOIN public.profiles res ON res.id = d.resolved_by
      LEFT JOIN public.profiles esc ON esc.id = d.escalated_to_admin_id
      WHERE d.id = p_dispute_id
    ) t;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'dispute_not_found';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at ASC), '[]'::jsonb)
    INTO v_msgs
    FROM (
      SELECT
        dm.id,
        dm.dispute_id,
        dm.sender_user_id,
        COALESCE(sp.full_name, sp.display_name, 'Member') AS sender_name,
        dm.message,
        dm.message_type,
        dm.is_private,
        dm.created_at
      FROM public.dispute_messages dm
      LEFT JOIN public.profiles sp ON sp.id = dm.sender_user_id
      WHERE dm.dispute_id = p_dispute_id
    ) t;

  RETURN jsonb_build_object(
    'dispute',   v_row,
    'messages',  v_msgs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dispute_detail(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_dispute_detail(UUID) TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '384',
  'admin_dispute_console',
  ARRAY['-- 384: disputes escalation/override columns + admin_override_dispute (super_admin) + admin_reassign_dispute (super/admin) + get_admin_dispute_dashboard + get_admin_dispute_detail. escalate-stale-disputes EF retarget in a separate commit.']
)
ON CONFLICT (version) DO NOTHING;
