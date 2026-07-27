-- ═══════════════════════════════════════════════════════════════════════════
-- 374_circle_membership_events.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Admin visibility surface for circle joins + leaves. Every join going
-- forward (via create_circle for creators, via join_circle for joiners)
-- writes one row here so admins can audit:
--   * who joined which circle today
--   * who left mid-cycle (leave events land here too when leave flow ships)
--   * whether joins are clustering suspiciously (mig 375's cluster detector)
--   * which authored the join (invite / quick-join / admin manual)
--
-- Also carries the approval-gate lifecycle. When mig 375's
-- circles.require_admin_approval_for_joins is TRUE, join_circle writes a row
-- here with status='pending_approval' and does NOT insert circle_members.
-- approve_circle_join / reject_circle_join (also mig 375) then flip the
-- row's status and, on approval, perform the actual circle_members insert.
--
-- v1 does NOT trigger-capture direct circle_members mutations — the two
-- live client paths (create_circle, join_circle) will explicitly write log
-- rows in mig 375. Direct SQL inserts on circle_members are admin-only and
-- rare; if drift shows up we can add a fallback trigger later.
--
-- Backfill: every existing circle_members row lands here as
-- event_type='join', method='backfill', status matching (active vs left),
-- joined_at = circle_members.joined_at. This makes the audit surface
-- complete from day one and gives approve/reject something to key against
-- even for pre-existing members. The backfill is anti-join-guarded so
-- re-running the migration is safe.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.circle_membership_events (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id                   UUID NOT NULL REFERENCES public.circles(id)  ON DELETE CASCADE,
  user_id                     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type                  TEXT NOT NULL
                                CHECK (event_type IN ('join','leave','invite_sent','invite_accepted')),
  method                      TEXT NOT NULL
                                CHECK (method IN ('quick_join','invite_code','magic_link',
                                                  'admin_manual','approval_gate','backfill')),
  status                      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('pending_approval','active','rejected','left')),
  joined_at                   TIMESTAMPTZ DEFAULT NOW(),
  left_at                     TIMESTAMPTZ,
  left_reason                 TEXT,
  left_cycle_number           INT,
  left_amount_in_flight_cents INT,
  approved_by                 UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at                 TIMESTAMPTZ,
  admin_note                  TEXT,
  suspicious_flag             BOOLEAN NOT NULL DEFAULT FALSE,
  suspicious_reason           TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_membership_events_circle
  ON public.circle_membership_events(circle_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_membership_events_user
  ON public.circle_membership_events(user_id, joined_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_membership_events_pending
  ON public.circle_membership_events(circle_id)
  WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_circle_membership_events_suspicious
  ON public.circle_membership_events(circle_id, joined_at DESC)
  WHERE suspicious_flag = TRUE;

-- ─── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.circle_membership_events ENABLE ROW LEVEL SECURITY;

-- Member reads their own event history.
DROP POLICY IF EXISTS cme_read_own ON public.circle_membership_events;
CREATE POLICY cme_read_own ON public.circle_membership_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Any active admin_users row grants read across the table. Scope narrowing
-- (community-admin sees only their community's rows) is enforced at the
-- RPC read layer we add later — not at RLS — because admin_users.community_id
-- joins to circles.community_id via a code path that would make the policy
-- expression opaque and slow.
DROP POLICY IF EXISTS cme_read_admin ON public.circle_membership_events;
CREATE POLICY cme_read_admin ON public.circle_membership_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- service_role: full access (mig 375's RPCs write via SECURITY DEFINER).
DROP POLICY IF EXISTS cme_service ON public.circle_membership_events;
CREATE POLICY cme_service ON public.circle_membership_events
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── Backfill existing memberships ────────────────────────────────────────
-- One row per (circle_id, user_id) that doesn't already have a 'join' event.
-- circle_members.status in prod is uniformly 'active' (verified 2026-07-27),
-- but the CASE stays defensive in case a future 'left' value lands.
INSERT INTO public.circle_membership_events (
  circle_id, user_id, event_type, method, status, joined_at, created_at
)
SELECT
  cm.circle_id,
  cm.user_id,
  'join',
  'backfill',
  CASE WHEN cm.status = 'left' THEN 'left' ELSE 'active' END,
  cm.joined_at,
  cm.joined_at
FROM public.circle_members cm
WHERE NOT EXISTS (
  SELECT 1 FROM public.circle_membership_events cme
  WHERE cme.circle_id  = cm.circle_id
    AND cme.user_id    = cm.user_id
    AND cme.event_type = 'join'
);

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '374',
  'circle_membership_events',
  ARRAY['-- 374: circle_membership_events (log table + RLS + backfill of existing circle_members)']
)
ON CONFLICT (version) DO NOTHING;
