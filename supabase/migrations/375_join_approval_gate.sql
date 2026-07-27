-- ═══════════════════════════════════════════════════════════════════════════
-- 375_join_approval_gate.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Approval gate + suspicious-cluster detection on top of mig 374's
-- circle_membership_events log. Adds three columns to circles:
--
--   * require_admin_approval_for_joins BOOLEAN DEFAULT FALSE
--     When TRUE, join_circle stops short of inserting circle_members and
--     writes a status='pending_approval' log row instead. Admin then
--     calls approve_circle_join / reject_circle_join.
--
--   * suspicious_join_count INT DEFAULT 0
--     Auto-incremented every time a cluster is detected at join time.
--
--   * last_join_cluster_detected_at TIMESTAMPTZ
--     Stamps the most recent detection so the admin UI can sort by it.
--
-- Cluster detection: at every join attempt (both auto-executed and
-- pending-approval), count existing 'join' events in the last 24h. If
-- the incoming join would push the 24h count to >= 50% of the circle's
-- total member_count, mark the event's suspicious_flag = TRUE with
-- suspicious_reason = 'cluster:24h_50pct' and bump the circle counter.
--
-- create_circle: also gains an explicit log-row write for the creator
-- (method='admin_manual', status='active') so the audit surface has a
-- coherent entry for every membership existence.
--
-- join_circle: signature evolves from RETURNS TABLE to RETURNS JSONB so
-- the response can carry {approval_pending, event_id, suspicious_flag}
-- alongside the existing member_id / member_position / already_member.
-- Client (CirclesContext.joinCircle) doesn't destructure the return today
-- (only reads rpcError.message) so this is safe. A new p_method TEXT
-- parameter defaults to 'invite_code' — clients passing 2 args still work.
--
-- Three new admin RPCs, all SECURITY DEFINER gated on admin_users:
--
--   * approve_circle_join(event_id, admin_note)
--   * reject_circle_join(event_id, admin_note)
--   * set_circle_admin_approval(circle_id, require_approval, reason)
--
-- Leave events land as a follow-up — the current CirclesContext.leaveCircle
-- does a direct DELETE on circle_members (no RPC). When we add a leave RPC
-- (or a DELETE trigger on circle_members), it will write a 'leave' row
-- into the log with left_at / left_reason / left_cycle_number.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Circles columns ───────────────────────────────────────────────────
ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS require_admin_approval_for_joins BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS suspicious_join_count            INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_join_cluster_detected_at    TIMESTAMPTZ;

-- ─── 2. Private cluster-detection helper ──────────────────────────────────
-- Returns TRUE if the incoming join would push the 24h join count to
-- >= 50% of the circle's target member_count.
CREATE OR REPLACE FUNCTION public._detect_join_cluster(
  p_circle_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member_count INT;
  v_recent_joins INT;
  v_threshold    INT;
BEGIN
  SELECT member_count INTO v_member_count
    FROM public.circles WHERE id = p_circle_id;
  IF v_member_count IS NULL OR v_member_count < 2 THEN
    RETURN FALSE;
  END IF;

  SELECT COUNT(*) INTO v_recent_joins
    FROM public.circle_membership_events
   WHERE circle_id  = p_circle_id
     AND event_type = 'join'
     AND status     = 'active'
     AND joined_at  > NOW() - INTERVAL '24 hours';

  -- CEIL for the 50% threshold so odd member counts round up. Example:
  --   member_count=6 → threshold=3. 2 existing + this one = 3 → flagged.
  --   member_count=5 → threshold=3. 2 existing + this one = 3 → flagged.
  v_threshold := CEIL(0.5 * v_member_count);
  RETURN (v_recent_joins + 1) >= v_threshold;
END;
$$;

REVOKE ALL ON FUNCTION public._detect_join_cluster(UUID) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public._detect_join_cluster(UUID) TO service_role;

-- ─── 3. create_circle rewrite — log the creator's join ────────────────────
-- Two overloads exist in prod: the 14-arg from mig 141, and the 15-arg
-- from mig 311 (adds p_total_cycles DEFAULT NULL). Client calls the
-- 15-arg by argument name — the 14-arg is dead code that would only
-- confuse PostgREST resolution. Drop the 14-arg outright, then patch the
-- 15-arg with the log-row write.

DROP FUNCTION IF EXISTS public.create_circle(
  TEXT, TEXT, NUMERIC, TEXT, INT, DATE, TEXT, INT, TEXT, TEXT, INT, TEXT, TEXT[], TEXT[]
);

CREATE OR REPLACE FUNCTION public.create_circle(
  p_type              TEXT,
  p_name              TEXT,
  p_amount            NUMERIC,
  p_frequency         TEXT,
  p_member_count      INT,
  p_start_date        DATE       DEFAULT NULL,
  p_rotation_method   TEXT       DEFAULT 'xnscore',
  p_grace_period_days INT        DEFAULT 2,
  p_emoji             TEXT       DEFAULT NULL,
  p_description       TEXT       DEFAULT NULL,
  p_min_score         INT        DEFAULT 0,
  p_invite_code       TEXT       DEFAULT NULL,
  p_invited_phones    TEXT[]     DEFAULT ARRAY[]::TEXT[],
  p_invited_names     TEXT[]     DEFAULT ARRAY[]::TEXT[],
  p_total_cycles      INT        DEFAULT NULL
)
RETURNS TABLE (
  circle_id   UUID,
  invite_code TEXT,
  member_id   UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_creator       UUID;
  v_circle_id     UUID;
  v_invite_code   TEXT;
  v_member_id     UUID;
  v_default_emoji TEXT;
  v_phones_len    INT;
  v_display_name  TEXT;
  v_total_cycles  INT;
BEGIN
  v_creator := auth.uid();
  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;
  IF p_member_count IS NULL OR p_member_count < 2 THEN
    RAISE EXCEPTION 'invalid_member_count';
  END IF;
  IF p_frequency NOT IN ('one-time','daily','weekly','biweekly','monthly') THEN
    RAISE EXCEPTION 'invalid_frequency';
  END IF;

  v_total_cycles := COALESCE(p_total_cycles, p_member_count);
  IF v_total_cycles < 1 THEN
    RAISE EXCEPTION 'invalid_total_cycles';
  END IF;

  v_phones_len := COALESCE(array_length(p_invited_phones, 1), 0);
  IF v_phones_len > 100 THEN
    RAISE EXCEPTION 'too_many_invites';
  END IF;
  IF v_phones_len <> COALESCE(array_length(p_invited_names, 1), 0) THEN
    RAISE EXCEPTION 'invite_array_mismatch';
  END IF;

  IF p_invite_code IS NOT NULL AND length(trim(p_invite_code)) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.circles WHERE invite_code = upper(trim(p_invite_code))
    ) THEN
      v_invite_code := public.gen_invite_code();
    ELSE
      v_invite_code := upper(trim(p_invite_code));
    END IF;
  ELSE
    v_invite_code := public.gen_invite_code();
  END IF;

  -- Emoji defaults preserved byte-for-byte from mig 311 (existing rows
  -- reference these strings — the mojibake is intentional/legacy).
  v_default_emoji := CASE p_type
    WHEN 'traditional'    THEN 'ðŸ”„'
    WHEN 'goal-based'     THEN 'ðŸŽ¯'
    WHEN 'goal'           THEN 'ðŸŽ¯'
    WHEN 'emergency'      THEN 'ðŸ›¡ï¸�'
    WHEN 'family-support' THEN 'ðŸ‘¨â€�ðŸ‘©â€�ðŸ‘§â€�ðŸ‘¦'
    WHEN 'beneficiary'    THEN 'ðŸ’�'
    ELSE                       'ðŸ’°'
  END;

  -- current_members = 0 matches mig 311. The creator row is inserted
  -- immediately below; the increment happens via join_circle for
  -- subsequent joiners.
  INSERT INTO public.circles (
    name, type, amount, frequency, member_count, current_members,
    start_date, rotation_method, grace_period_days, status, emoji,
    description, min_score, invite_code, created_by, progress,
    total_cycles
  )
  VALUES (
    trim(p_name), p_type, p_amount, p_frequency, p_member_count, 0,
    p_start_date, p_rotation_method, p_grace_period_days, 'pending',
    COALESCE(NULLIF(trim(p_emoji),''), v_default_emoji),
    NULLIF(trim(p_description),''), COALESCE(p_min_score, 0),
    v_invite_code, v_creator, 0,
    v_total_cycles
  )
  RETURNING id INTO v_circle_id;

  INSERT INTO public.circle_members (
    circle_id, user_id, position, role, status, joined_at
  )
  VALUES (v_circle_id, v_creator, 1, 'creator', 'active', NOW())
  RETURNING id INTO v_member_id;

  -- NEW in mig 375: log the creator's join. method='admin_manual' because
  -- the creator isn't going through invite / quick-join / magic-link —
  -- they're establishing the circle. status='active' from the jump.
  INSERT INTO public.circle_membership_events (
    circle_id, user_id, event_type, method, status, joined_at
  )
  VALUES (v_circle_id, v_creator, 'join', 'admin_manual', 'active', NOW());

  IF v_phones_len > 0 THEN
    INSERT INTO public.invited_members (circle_id, invited_by, name, phone, status)
    SELECT
      v_circle_id,
      v_creator,
      COALESCE(NULLIF(trim(name_val), ''), 'Invitee'),
      trim(phone_val),
      'pending'
    FROM unnest(p_invited_phones, p_invited_names) AS u(phone_val, name_val)
    WHERE phone_val IS NOT NULL AND length(trim(phone_val)) > 0;
  END IF;

  BEGIN
    v_display_name := public.resolve_display_name(v_creator);
    INSERT INTO public.circle_messages (circle_id, user_id, message_type, body)
    VALUES (
      v_circle_id, v_creator, 'system',
      v_display_name || ' created the circle'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[create_circle] system message insert failed circle=%, err=%',
      v_circle_id, SQLERRM;
  END;

  RETURN QUERY SELECT v_circle_id, v_invite_code, v_member_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_circle(
  TEXT, TEXT, NUMERIC, TEXT, INT, DATE, TEXT, INT, TEXT, TEXT, INT, TEXT, TEXT[], TEXT[], INT
) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_circle(
  TEXT, TEXT, NUMERIC, TEXT, INT, DATE, TEXT, INT, TEXT, TEXT, INT, TEXT, TEXT[], TEXT[], INT
) TO authenticated;

-- ─── 4. join_circle rewrite — approval gate + cluster detection ───────────
-- Signature: 3-arg with p_method DEFAULT — 2-arg callers still work.
-- Return: JSONB with success + event_id + member_id + member_position +
-- already_member + approval_pending + suspicious_flag. Client
-- (CirclesContext.joinCircle line 800) only reads rpcError.message, so
-- swapping RETURNS TABLE → RETURNS JSONB is safe.

-- Drop the mig 141 2-arg signature explicitly. The 3-arg with DEFAULT below
-- covers all callers, and function overloading would otherwise leave the
-- stale 2-arg body still resolvable.
DROP FUNCTION IF EXISTS public.join_circle(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.join_circle(
  p_circle_id    UUID,
  p_invite_code  TEXT DEFAULT NULL,
  p_method       TEXT DEFAULT 'invite_code'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_joiner         UUID;
  v_circle         RECORD;
  v_existing       UUID;
  v_member_id      UUID;
  v_new_position   INT;
  v_user_xn_score  INT;
  v_display_name   TEXT;
  v_event_id       UUID;
  v_suspicious     BOOLEAN;
  v_gated          BOOLEAN;
BEGIN
  v_joiner := auth.uid();
  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF p_circle_id IS NULL THEN
    RAISE EXCEPTION 'invalid_circle_id';
  END IF;
  IF p_method NOT IN ('quick_join','invite_code','magic_link','admin_manual') THEN
    RAISE EXCEPTION 'invalid_method';
  END IF;

  SELECT id, name, status, member_count, current_members, min_score,
         invite_code, require_admin_approval_for_joins
    INTO v_circle
  FROM public.circles
  WHERE id = p_circle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'circle_not_found';
  END IF;
  IF v_circle.status NOT IN ('pending','active') THEN
    RAISE EXCEPTION 'circle_not_joinable';
  END IF;

  IF p_invite_code IS NOT NULL AND length(trim(p_invite_code)) > 0 THEN
    IF upper(trim(p_invite_code)) <> v_circle.invite_code THEN
      RAISE EXCEPTION 'invalid_invite_code';
    END IF;
  END IF;

  -- Idempotency: existing member → return their row.
  SELECT id INTO v_existing
  FROM public.circle_members
  WHERE circle_id = p_circle_id AND user_id = v_joiner;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success',          true,
      'already_member',   true,
      'member_id',        v_existing,
      'member_position',  (SELECT cm.position FROM public.circle_members cm WHERE cm.id = v_existing),
      'approval_pending', false,
      'suspicious_flag',  false
    );
  END IF;

  IF v_circle.current_members >= v_circle.member_count THEN
    RAISE EXCEPTION 'circle_full';
  END IF;

  IF COALESCE(v_circle.min_score, 0) > 0 THEN
    SELECT COALESCE(xn_score, 0) INTO v_user_xn_score
    FROM public.profiles WHERE id = v_joiner;
    IF COALESCE(v_user_xn_score, 0) < v_circle.min_score THEN
      RAISE EXCEPTION 'min_score_not_met';
    END IF;
  END IF;

  -- Cluster check + gate check — both computed against the same lock window.
  v_suspicious := public._detect_join_cluster(p_circle_id);
  v_gated      := v_circle.require_admin_approval_for_joins;

  IF v_suspicious THEN
    UPDATE public.circles
       SET suspicious_join_count         = suspicious_join_count + 1,
           last_join_cluster_detected_at = NOW(),
           updated_at                    = NOW()
     WHERE id = p_circle_id;
  END IF;

  -- Gated path: write a pending log row, DO NOT insert circle_members.
  IF v_gated THEN
    INSERT INTO public.circle_membership_events (
      circle_id, user_id, event_type, method, status,
      suspicious_flag, suspicious_reason
    )
    VALUES (
      p_circle_id, v_joiner, 'join', p_method, 'pending_approval',
      v_suspicious, CASE WHEN v_suspicious THEN 'cluster:24h_50pct' ELSE NULL END
    )
    RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
      'success',          true,
      'already_member',   false,
      'member_id',        NULL,
      'member_position',  NULL,
      'approval_pending', true,
      'event_id',         v_event_id,
      'suspicious_flag',  v_suspicious
    );
  END IF;

  -- Un-gated path: same shape as mig 141, plus the log row.
  v_new_position := v_circle.current_members + 1;
  INSERT INTO public.circle_members (
    circle_id, user_id, position, role, status, joined_at
  )
  VALUES (p_circle_id, v_joiner, v_new_position, 'member', 'active', NOW())
  RETURNING id INTO v_member_id;

  UPDATE public.circles
     SET current_members = current_members + 1,
         updated_at      = NOW(),
         status = CASE
           WHEN current_members + 1 >= member_count THEN 'active'
           ELSE status
         END
   WHERE id = p_circle_id;

  INSERT INTO public.circle_membership_events (
    circle_id, user_id, event_type, method, status,
    suspicious_flag, suspicious_reason
  )
  VALUES (
    p_circle_id, v_joiner, 'join', p_method, 'active',
    v_suspicious, CASE WHEN v_suspicious THEN 'cluster:24h_50pct' ELSE NULL END
  )
  RETURNING id INTO v_event_id;

  BEGIN
    v_display_name := public.resolve_display_name(v_joiner);
    INSERT INTO public.circle_messages (circle_id, user_id, message_type, body)
    VALUES (
      p_circle_id, v_joiner, 'system',
      v_display_name || ' joined the circle'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[join_circle] system message insert failed circle=%, user=%, err=%',
      p_circle_id, v_joiner, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',          true,
    'already_member',   false,
    'member_id',        v_member_id,
    'member_position',  v_new_position,
    'approval_pending', false,
    'event_id',         v_event_id,
    'suspicious_flag',  v_suspicious
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_circle(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.join_circle(UUID, TEXT, TEXT) TO authenticated;

-- ─── 5. approve_circle_join ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_circle_join(
  p_event_id   UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin        UUID;
  v_event        RECORD;
  v_circle       RECORD;
  v_member_id    UUID;
  v_new_position INT;
  v_display_name TEXT;
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

  SELECT id, circle_id, user_id, method, status
    INTO v_event
  FROM public.circle_membership_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;
  IF v_event.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'event_not_pending';
  END IF;

  SELECT id, status, member_count, current_members
    INTO v_circle
  FROM public.circles
  WHERE id = v_event.circle_id
  FOR UPDATE;

  IF v_circle.status NOT IN ('pending','active') THEN
    RAISE EXCEPTION 'circle_not_joinable';
  END IF;
  IF v_circle.current_members >= v_circle.member_count THEN
    RAISE EXCEPTION 'circle_full';
  END IF;

  -- Idempotency: if the member somehow got inserted between pending + now,
  -- reuse the existing row instead of double-inserting.
  SELECT id INTO v_member_id
  FROM public.circle_members
  WHERE circle_id = v_event.circle_id AND user_id = v_event.user_id;

  IF v_member_id IS NULL THEN
    v_new_position := v_circle.current_members + 1;
    INSERT INTO public.circle_members (
      circle_id, user_id, position, role, status, joined_at
    )
    VALUES (v_event.circle_id, v_event.user_id, v_new_position, 'member', 'active', NOW())
    RETURNING id INTO v_member_id;

    UPDATE public.circles
       SET current_members = current_members + 1,
           updated_at      = NOW(),
           status = CASE
             WHEN current_members + 1 >= member_count THEN 'active'
             ELSE status
           END
     WHERE id = v_event.circle_id;
  ELSE
    v_new_position := (SELECT cm.position FROM public.circle_members cm WHERE cm.id = v_member_id);
  END IF;

  UPDATE public.circle_membership_events
     SET status      = 'active',
         approved_by = v_admin,
         approved_at = NOW(),
         admin_note  = p_admin_note,
         joined_at   = NOW()
   WHERE id = p_event_id;

  BEGIN
    v_display_name := public.resolve_display_name(v_event.user_id);
    INSERT INTO public.circle_messages (circle_id, user_id, message_type, body)
    VALUES (
      v_event.circle_id, v_event.user_id, 'system',
      v_display_name || ' joined the circle'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[approve_circle_join] system message insert failed event=%, err=%',
      p_event_id, SQLERRM;
  END;

  RETURN jsonb_build_object(
    'success',         true,
    'event_id',        p_event_id,
    'member_id',       v_member_id,
    'member_position', v_new_position
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_circle_join(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.approve_circle_join(UUID, TEXT) TO authenticated;

-- ─── 6. reject_circle_join ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reject_circle_join(
  p_event_id   UUID,
  p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin  UUID;
  v_event  RECORD;
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

  SELECT id, status, circle_id, user_id
    INTO v_event
  FROM public.circle_membership_events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;
  IF v_event.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'event_not_pending';
  END IF;

  UPDATE public.circle_membership_events
     SET status      = 'rejected',
         approved_by = v_admin,
         approved_at = NOW(),
         admin_note  = p_admin_note
   WHERE id = p_event_id;

  RETURN jsonb_build_object(
    'success',  true,
    'event_id', p_event_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_circle_join(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.reject_circle_join(UUID, TEXT) TO authenticated;

-- ─── 7. set_circle_admin_approval ────────────────────────────────────────
-- Toggle the require_admin_approval_for_joins flag on a circle.
-- Admin-gated. Does NOT retroactively re-gate existing memberships.
CREATE OR REPLACE FUNCTION public.set_circle_admin_approval(
  p_circle_id       UUID,
  p_require_approval BOOLEAN,
  p_reason          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin UUID;
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

  IF NOT EXISTS (SELECT 1 FROM public.circles WHERE id = p_circle_id) THEN
    RAISE EXCEPTION 'circle_not_found';
  END IF;

  UPDATE public.circles
     SET require_admin_approval_for_joins = p_require_approval,
         updated_at                       = NOW()
   WHERE id = p_circle_id;

  RETURN jsonb_build_object(
    'success',          true,
    'circle_id',        p_circle_id,
    'require_approval', p_require_approval,
    'reason',           p_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_circle_admin_approval(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_circle_admin_approval(UUID, BOOLEAN, TEXT) TO authenticated;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '375',
  'join_approval_gate',
  ARRAY['-- 375: join_approval_gate (circles cols + join_circle rewrite + approve/reject/set_admin_approval RPCs + _detect_join_cluster)']
)
ON CONFLICT (version) DO NOTHING;
