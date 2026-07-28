-- ═══════════════════════════════════════════════════════════════════════════
-- 387_admin_collection_dashboard.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Admin visibility layer for contribution collection failures. Ships the
-- read-only Phase 1: schema extensions, admin-read RLS, and a read RPC.
-- No admin action RPCs (pause/resume/retry) — deferred until real failure
-- traffic exists (0 failures in prod today) + Phase 0 webhook wiring has
-- captured a few real cases so the override patterns become concrete.
--
-- Phase 0 companion (already committed as 5712dba):
--   stripe-webhook handles payment_intent.payment_failed → writes
--   ledger_events + updates circle_contributions failure columns added
--   below. Redeploy required AFTER this mig lands.
--
-- Schema additions:
--   circle_contributions.last_failure_reason TEXT
--   circle_contributions.last_failure_code   TEXT
--   circle_contributions.last_failure_at     TIMESTAMPTZ
--   circle_contributions.retry_count         INT DEFAULT 0
--   circle_contributions.stripe_pi_id        TEXT
--   profiles.collections_paused_at           TIMESTAMPTZ
--   profiles.collections_paused_by_admin_id  UUID FK auth.users
--   profiles.collections_paused_reason       TEXT
--
-- Pause scope decision: user-global (profiles) not per-circle
-- (circle_members). Struggling members typically need a break from ALL
-- circles, not one. If per-circle scoping proves needed later, add a
-- circle_members.collections_paused_at column then.
--
-- Admin RLS added on circle_contributions, circle_autopay_log,
-- stripe_payment_intents so admins can ad-hoc drill without going through
-- the RPC. All reads in the AdminCollectionDashboardScreen go through
-- get_admin_collection_dashboard() though — the RLS is future-proofing.
--
-- get_admin_collection_dashboard() returns four sections matching the
-- AdminCollectionDashboardScreen card layout:
--   recent_failures_24h   — union of circle_contributions + circle_autopay_log
--                            failures in last 24h with source tag
--   high_failure_members  — users with >= 3 total failures in last 30d
--                            (contributions + autopay), joined to profile
--   failure_trends_14d    — daily counts for a compact chart / spark
--   paused_members        — profiles.collections_paused_at IS NOT NULL
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. circle_contributions failure columns ─────────────────────────────
ALTER TABLE public.circle_contributions
  ADD COLUMN IF NOT EXISTS last_failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS last_failure_code   TEXT,
  ADD COLUMN IF NOT EXISTS last_failure_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count         INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_pi_id        TEXT;

-- Partial index for the recent-failures pane query.
CREATE INDEX IF NOT EXISTS idx_circle_contributions_last_failure_at
  ON public.circle_contributions(last_failure_at DESC)
  WHERE last_failure_at IS NOT NULL;

-- ─── 2. profiles.collections_paused_* ────────────────────────────────────
-- Pre-provisioned for Phase 2 admin actions. Empty (DEFAULT NULL) so the
-- get_admin_collection_dashboard paused_members section reads cleanly
-- against a "not-yet-used" state.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS collections_paused_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collections_paused_by_admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collections_paused_reason      TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_collections_paused
  ON public.profiles(collections_paused_at DESC)
  WHERE collections_paused_at IS NOT NULL;

-- ─── 3. Admin-read RLS ────────────────────────────────────────────────────
-- Same pattern as mig 382 / 384 / 386: any active admin_users row grants
-- read across the table. Doesn't override existing member-scoped policies
-- (they still apply for non-admin queries).

DROP POLICY IF EXISTS circle_contributions_admin_read ON public.circle_contributions;
CREATE POLICY circle_contributions_admin_read ON public.circle_contributions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ));

DROP POLICY IF EXISTS circle_autopay_log_admin_read ON public.circle_autopay_log;
CREATE POLICY circle_autopay_log_admin_read ON public.circle_autopay_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ));

DROP POLICY IF EXISTS stripe_payment_intents_admin_read ON public.stripe_payment_intents;
CREATE POLICY stripe_payment_intents_admin_read ON public.stripe_payment_intents
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.admin_users
     WHERE user_id = auth.uid() AND is_active = TRUE
  ));

-- ─── 4. get_admin_collection_dashboard ────────────────────────────────────
-- Any active admin can read. One JSONB payload with four sections.
CREATE OR REPLACE FUNCTION public.get_admin_collection_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin    UUID;
  v_recent   JSONB;
  v_high     JSONB;
  v_trends   JSONB;
  v_paused   JSONB;
  v_counts   JSONB;
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

  -- ── Section 1: recent failures (last 24h), union of both sources ─────
  WITH src_contributions AS (
    SELECT
      'contribution'::TEXT                              AS source,
      cc.id::TEXT                                       AS row_id,
      cc.circle_id,
      c.name                                            AS circle_name,
      cc.user_id,
      COALESCE(p.full_name, p.display_name, 'Member')   AS member_name,
      (cc.amount)::NUMERIC                              AS amount,
      cc.cycle_number,
      cc.last_failure_reason                            AS failure_reason,
      cc.last_failure_code                              AS failure_code,
      cc.retry_count,
      cc.stripe_pi_id,
      cc.last_failure_at                                AS failed_at
    FROM public.circle_contributions cc
    LEFT JOIN public.circles  c ON c.id = cc.circle_id
    LEFT JOIN public.profiles p ON p.id = cc.user_id
    WHERE cc.status = 'failed'
      AND cc.last_failure_at >= NOW() - INTERVAL '24 hours'
  ),
  src_autopay AS (
    SELECT
      'autopay'::TEXT                                   AS source,
      cal.id::TEXT                                      AS row_id,
      cac.circle_id,
      c.name                                            AS circle_name,
      cac.user_id,
      COALESCE(p.full_name, p.display_name, 'Member')   AS member_name,
      (cal.amount_cents::NUMERIC / 100.0)               AS amount,
      NULL::INT                                         AS cycle_number,
      cal.error_message                                 AS failure_reason,
      NULL::TEXT                                        AS failure_code,
      0                                                 AS retry_count,
      NULL::TEXT                                        AS stripe_pi_id,
      COALESCE(cal.executed_at, cal.created_at)         AS failed_at
    FROM public.circle_autopay_log cal
    JOIN public.circle_autopay_configs cac ON cac.id = cal.config_id
    LEFT JOIN public.circles  c ON c.id = cac.circle_id
    LEFT JOIN public.profiles p ON p.id = cac.user_id
    WHERE cal.status = 'failed'
      AND COALESCE(cal.executed_at, cal.created_at) >= NOW() - INTERVAL '24 hours'
  )
  SELECT COALESCE(jsonb_agg(row_to_json(u) ORDER BY u.failed_at DESC), '[]'::jsonb)
    INTO v_recent
    FROM (SELECT * FROM src_contributions
          UNION ALL
          SELECT * FROM src_autopay
          LIMIT 200) u;

  -- ── Section 2: high-failure members (>= 3 in last 30d) ───────────────
  WITH per_user AS (
    SELECT user_id, COUNT(*)::INT AS failures_30d
      FROM (
        SELECT user_id
          FROM public.circle_contributions
         WHERE status = 'failed'
           AND last_failure_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT cac.user_id
          FROM public.circle_autopay_log cal
          JOIN public.circle_autopay_configs cac ON cac.id = cal.config_id
         WHERE cal.status = 'failed'
           AND COALESCE(cal.executed_at, cal.created_at) >= NOW() - INTERVAL '30 days'
      ) all_failures
     GROUP BY user_id
    HAVING COUNT(*) >= 3
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.failures_30d DESC), '[]'::jsonb)
    INTO v_high
    FROM (
      SELECT
        pu.user_id,
        COALESCE(p.full_name, p.display_name, 'Member') AS member_name,
        p.email,
        pu.failures_30d,
        p.collections_paused_at,
        (SELECT MAX(cc.last_failure_at)
           FROM public.circle_contributions cc
          WHERE cc.user_id = pu.user_id
            AND cc.status = 'failed') AS latest_failure_at,
        (SELECT cc.last_failure_reason
           FROM public.circle_contributions cc
          WHERE cc.user_id = pu.user_id
            AND cc.status = 'failed'
          ORDER BY cc.last_failure_at DESC NULLS LAST
          LIMIT 1) AS latest_failure_reason
      FROM per_user pu
      LEFT JOIN public.profiles p ON p.id = pu.user_id
    ) t;

  -- ── Section 3: failure trends (last 14 days, one row per day) ────────
  WITH days AS (
    SELECT generate_series(
      (NOW() - INTERVAL '13 days')::DATE,
      NOW()::DATE,
      INTERVAL '1 day'
    )::DATE AS day
  ),
  failures AS (
    SELECT last_failure_at::DATE AS day, 1 AS n
      FROM public.circle_contributions
     WHERE last_failure_at >= NOW() - INTERVAL '14 days'
       AND status = 'failed'
    UNION ALL
    SELECT COALESCE(executed_at, created_at)::DATE AS day, 1 AS n
      FROM public.circle_autopay_log
     WHERE COALESCE(executed_at, created_at) >= NOW() - INTERVAL '14 days'
       AND status = 'failed'
  )
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.day ASC), '[]'::jsonb)
    INTO v_trends
    FROM (
      SELECT d.day, COALESCE(SUM(f.n), 0)::INT AS n
        FROM days d
        LEFT JOIN failures f ON f.day = d.day
        GROUP BY d.day
    ) t;

  -- ── Section 4: currently paused members ──────────────────────────────
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.collections_paused_at DESC), '[]'::jsonb)
    INTO v_paused
    FROM (
      SELECT
        p.id                                            AS user_id,
        COALESCE(p.full_name, p.display_name, 'Member') AS member_name,
        p.email,
        p.collections_paused_at,
        p.collections_paused_by_admin_id,
        COALESCE(ap.full_name, ap.display_name)         AS paused_by_name,
        p.collections_paused_reason
      FROM public.profiles p
      LEFT JOIN public.profiles ap ON ap.id = p.collections_paused_by_admin_id
      WHERE p.collections_paused_at IS NOT NULL
    ) t;

  -- ── Top-strip counts ─────────────────────────────────────────────────
  SELECT jsonb_build_object(
    'failures_24h', (
      SELECT COUNT(*)::INT FROM (
        SELECT 1 FROM public.circle_contributions
         WHERE status = 'failed'
           AND last_failure_at >= NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT 1 FROM public.circle_autopay_log
         WHERE status = 'failed'
           AND COALESCE(executed_at, created_at) >= NOW() - INTERVAL '24 hours'
      ) u
    ),
    'failures_7d', (
      SELECT COUNT(*)::INT FROM (
        SELECT 1 FROM public.circle_contributions
         WHERE status = 'failed'
           AND last_failure_at >= NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT 1 FROM public.circle_autopay_log
         WHERE status = 'failed'
           AND COALESCE(executed_at, created_at) >= NOW() - INTERVAL '7 days'
      ) u
    ),
    'high_failure_members_30d', (
      SELECT COUNT(*)::INT FROM (
        SELECT user_id FROM public.circle_contributions
         WHERE status = 'failed'
           AND last_failure_at >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT cac.user_id FROM public.circle_autopay_log cal
         JOIN public.circle_autopay_configs cac ON cac.id = cal.config_id
         WHERE cal.status = 'failed'
           AND COALESCE(cal.executed_at, cal.created_at) >= NOW() - INTERVAL '30 days'
      ) all_failures
      GROUP BY user_id
      HAVING COUNT(*) >= 3
    ),
    'paused_count', (
      SELECT COUNT(*)::INT FROM public.profiles WHERE collections_paused_at IS NOT NULL
    )
  ) INTO v_counts;

  RETURN jsonb_build_object(
    'recent_failures_24h',  v_recent,
    'high_failure_members', v_high,
    'failure_trends_14d',   v_trends,
    'paused_members',       v_paused,
    'counts',               v_counts,
    'generated_at',         NOW()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_collection_dashboard() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_admin_collection_dashboard() TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '387',
  'admin_collection_dashboard',
  ARRAY['-- 387: circle_contributions failure columns + profiles.collections_paused_* pre-provisioned + admin-read RLS on circle_contributions/circle_autopay_log/stripe_payment_intents + get_admin_collection_dashboard read RPC. Phase 2 actions (pause/resume/retry) deferred until real failures land.']
)
ON CONFLICT (version) DO NOTHING;
