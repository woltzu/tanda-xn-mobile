-- ═══════════════════════════════════════════════════════════════════════════
-- 380_payout_console_read_rpcs.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Doc 39 Phase 2 companion — read RPCs for AdminPayoutConsoleScreen.
-- Should have shipped with mig 379 (Phase 1 backend) but the mutation RPCs
-- crowded out the read layer. Adding here so the UI can query.
--
-- Why RPCs instead of an admin-read RLS policy on circle_payouts:
--   * circle_payouts RLS today only admits members via circle_members.
--     Admins who aren't members get zero rows.
--   * A SECURITY DEFINER RPC lets us return pre-joined data (payout +
--     circles.name + profiles.full_name) so the client makes one call per
--     pane instead of chaining SELECTs with client-side joins.
--   * Sets us up for community_admin scope narrowing later (mig 269) —
--     the RPC body can gate on admin_users.community_id without needing
--     RLS acrobatics.
--
-- Four RPCs per Doc 39 §5.5:
--   1. list_upcoming_payouts(p_days) — left column feed.
--   2. list_in_flight_payouts()      — center column feed.
--   3. list_recent_payouts(p_days)   — right column feed.
--   4. get_platform_pause_state()    — top-bar toggle + banner.
--
-- Two supporting RPCs added inline since they're read-side too:
--   5. list_closable_circles_for_invariant_strip() — powers the invariant
--      strip. Returns list of circle ids + names in ('completed',
--      'payout_complete') so the UI can fan out get_circle_invariant
--      calls in parallel (reusing the existing useCircleInvariant hook).
--
-- All RPCs: SECURITY DEFINER, gate on admin_users.is_active = TRUE. No
-- role narrowing yet — any active admin sees everything (community-admin
-- scoping is a follow-up).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. list_upcoming_payouts ─────────────────────────────────────────────
-- Returns payouts in non-terminal statuses ordered by expected_date (nulls
-- last). p_days caps the horizon at expected_date <= NOW + N days OR NULL
-- expected_date (unscheduled but pending).
CREATE OR REPLACE FUNCTION public.list_upcoming_payouts(
  p_days INT DEFAULT 7
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin UUID;
  v_rows  JSONB;
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
    ORDER BY t.expected_date NULLS LAST, t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        cp.id                            AS payout_id,
        cp.circle_id,
        c.name                           AS circle_name,
        cp.cycle_id,
        cp.cycle_number,
        cp.recipient_id,
        COALESCE(p.full_name, split_part(u.email, '@', 1), 'Member') AS recipient_name,
        cp.amount,
        cp.amount_cents,
        cp.currency,
        cp.status::TEXT                  AS status,
        cp.expected_date,
        cp.created_at,
        cp.held_at,
        cp.held_by_admin_id,
        COALESCE(hp.full_name, split_part(hu.email, '@', 1)) AS held_by_name,
        cp.hold_reason,
        cp.hold_justification
      FROM public.circle_payouts cp
      LEFT JOIN public.circles  c  ON c.id  = cp.circle_id
      LEFT JOIN public.profiles p  ON p.id  = cp.recipient_id
      LEFT JOIN auth.users      u  ON u.id  = cp.recipient_id
      LEFT JOIN public.profiles hp ON hp.id = cp.held_by_admin_id
      LEFT JOIN auth.users      hu ON hu.id = cp.held_by_admin_id
      WHERE cp.status IN ('scheduled', 'ready', 'held', 'awaiting_approval', 'pending')
        AND (cp.expected_date IS NULL
             OR cp.expected_date <= (CURRENT_DATE + (p_days || ' days')::INTERVAL))
      LIMIT 100
    ) t;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.list_upcoming_payouts(INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_upcoming_payouts(INT) TO authenticated;

-- ─── 2. list_in_flight_payouts ────────────────────────────────────────────
-- Currently-executing payouts. status = 'executing' or 'processing'.
-- Nothing writes 'executing' today; column always empty until Phase 3 EF
-- wiring lands. UI shows an empty state.
CREATE OR REPLACE FUNCTION public.list_in_flight_payouts()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin UUID;
  v_rows  JSONB;
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

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        cp.id           AS payout_id,
        cp.circle_id,
        c.name          AS circle_name,
        cp.cycle_id,
        cp.recipient_id,
        COALESCE(p.full_name, split_part(u.email, '@', 1), 'Member') AS recipient_name,
        cp.amount,
        cp.currency,
        cp.status::TEXT AS status,
        cp.transfer_id,
        cp.pending_intent_id,
        cp.ledger_event_id,
        cp.created_at
      FROM public.circle_payouts cp
      LEFT JOIN public.circles  c ON c.id = cp.circle_id
      LEFT JOIN public.profiles p ON p.id = cp.recipient_id
      LEFT JOIN auth.users      u ON u.id = cp.recipient_id
      WHERE cp.status IN ('executing', 'processing')
      LIMIT 50
    ) t;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.list_in_flight_payouts() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_in_flight_payouts() TO authenticated;

-- ─── 3. list_recent_payouts ───────────────────────────────────────────────
-- Terminal-state payouts within the last p_days. Uses completed_at when
-- present, falling back to created_at for rows that never got a
-- completed_at (e.g., failed / cancelled).
CREATE OR REPLACE FUNCTION public.list_recent_payouts(
  p_days INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin UUID;
  v_rows  JSONB;
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
    ORDER BY COALESCE(t.completed_at, t.created_at) DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        cp.id           AS payout_id,
        cp.circle_id,
        c.name          AS circle_name,
        cp.cycle_id,
        cp.cycle_number,
        cp.recipient_id,
        COALESCE(p.full_name, split_part(u.email, '@', 1), 'Member') AS recipient_name,
        cp.amount,
        cp.amount_cents,
        cp.currency,
        cp.status::TEXT AS status,
        cp.transfer_id,
        cp.completed_at,
        cp.actual_date,
        cp.created_at,
        cp.notes
      FROM public.circle_payouts cp
      LEFT JOIN public.circles  c ON c.id = cp.circle_id
      LEFT JOIN public.profiles p ON p.id = cp.recipient_id
      LEFT JOIN auth.users      u ON u.id = cp.recipient_id
      WHERE cp.status IN ('completed', 'failed', 'reversed', 'cancelled')
        AND COALESCE(cp.completed_at, cp.created_at)
            >= NOW() - (p_days || ' days')::INTERVAL
      LIMIT 50
    ) t;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.list_recent_payouts(INT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_recent_payouts(INT) TO authenticated;

-- ─── 4. get_platform_pause_state ──────────────────────────────────────────
-- Top-bar toggle + banner. Any active admin can read (community_admin
-- visibility per Doc 39 §3.3.2).
CREATE OR REPLACE FUNCTION public.get_platform_pause_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin UUID;
  v_row   RECORD;
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

  SELECT payouts_paused,
         payouts_paused_at,
         payouts_paused_by_admin_id,
         payouts_paused_reason
    INTO v_row
    FROM public.platform_settings WHERE id = 1;

  RETURN jsonb_build_object(
    'paused',      COALESCE(v_row.payouts_paused, FALSE),
    'paused_at',   v_row.payouts_paused_at,
    'paused_by',   v_row.payouts_paused_by_admin_id,
    'paused_by_name', (
      SELECT COALESCE(p.full_name, split_part(u.email, '@', 1))
        FROM auth.users u
   LEFT JOIN public.profiles p ON p.id = u.id
       WHERE u.id = v_row.payouts_paused_by_admin_id
    ),
    'reason',      v_row.payouts_paused_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_platform_pause_state() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_platform_pause_state() TO authenticated;

-- ─── 5. list_closable_circles_for_invariant_strip ─────────────────────────
-- Small helper for the invariant strip. Returns the id + name of circles
-- in payout_complete / completed status so the UI can fan out
-- get_circle_invariant calls in parallel (reusing useCircleInvariant hook).
-- Limited to 12 to keep the strip visually manageable.
CREATE OR REPLACE FUNCTION public.list_closable_circles_for_invariant_strip()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin UUID;
  v_rows  JSONB;
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

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.completed_at DESC NULLS LAST), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT id, name, status, completed_at
        FROM public.circles
       WHERE status IN ('completed', 'payout_complete')
       ORDER BY completed_at DESC NULLS LAST
       LIMIT 12
    ) t;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.list_closable_circles_for_invariant_strip() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.list_closable_circles_for_invariant_strip() TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '380',
  'payout_console_read_rpcs',
  ARRAY['-- 380: Doc 39 §5.5 admin read RPCs — list_upcoming_payouts, list_in_flight_payouts, list_recent_payouts, get_platform_pause_state, list_closable_circles_for_invariant_strip. All SECURITY DEFINER, admin-gated.']
)
ON CONFLICT (version) DO NOTHING;
