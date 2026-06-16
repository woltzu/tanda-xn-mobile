-- =============================================================================
-- 141: atomic create_circle + join_circle RPCs
-- =============================================================================
-- Replaces the unbatched client-side INSERT chains in CirclesContext with two
-- SECURITY DEFINER RPCs that do the entire create/join in a single
-- transaction. Fixes three bugs flagged in the Create/Join Circle audit:
--
--   1. Orphan circles — the prior createCircle path did INSERT circles →
--      INSERT circle_members (creator) → INSERT invited_members as three
--      separate round-trips. If the circle_members insert failed after
--      circles landed, you got a circle with no creator member row.
--
--   2. Race on join position — joinCircle did SELECT current_members,
--      computed position = current_members + 1 on the client, then INSERT.
--      Two concurrent joiners would both compute position N+1 and both
--      take it. The new RPC takes a FOR UPDATE lock on the circles row,
--      so position is monotonic under concurrency.
--
--   3. Silent join (no chat) — Phase 2 (April 29) shipped system messages
--      on join via `complete_circle_join`. The current
--      CirclesContext.joinCircle bypasses that RPC entirely, so the group
--      chat never gets the "X joined the circle" line. The join_circle
--      RPC restores that, inline and bypass-RLS via DEFINER, with the
--      same EXCEPTION block pattern complete_circle_join uses so a
--      chat-write hiccup never rolls back the join itself.
--
-- Helpers introduced here are intentionally private to this migration's
-- scope — gen_invite_code is callable by authenticated users so the client
-- can pre-flight uniqueness, but the create_circle RPC also calls it
-- internally if no code is supplied.
-- =============================================================================

-- ─── gen_invite_code ─────────────────────────────────────────────────────────
-- 8-char alphanumeric (uppercase). Excludes 0/O/1/I to avoid copy-paste
-- ambiguity in shared invite codes. Retries until it finds an unused code;
-- the keyspace is 32^8 ≈ 1.1T so collisions are vanishingly rare even
-- across millions of circles.
CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code     TEXT;
  v_idx      INT;
  v_exists   BOOLEAN;
BEGIN
  LOOP
    v_code := '';
    FOR v_idx IN 1..8 LOOP
      v_code := v_code || substr(v_alphabet, (floor(random() * length(v_alphabet)) + 1)::INT, 1);
    END LOOP;
    SELECT EXISTS (SELECT 1 FROM public.circles WHERE invite_code = v_code)
      INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.gen_invite_code() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gen_invite_code() FROM anon;
GRANT  EXECUTE ON FUNCTION public.gen_invite_code() TO authenticated;

-- ─── resolve_display_name ────────────────────────────────────────────────────
-- Internal helper used by both RPCs to format the system-message subject
-- (e.g., "Mariam joined the circle"). Prefers profiles.full_name, falls
-- back to the email local-part, then a generic string.
CREATE OR REPLACE FUNCTION public.resolve_display_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name  TEXT;
  v_email TEXT;
BEGIN
  SELECT full_name INTO v_name FROM public.profiles WHERE id = p_user_id;
  IF v_name IS NOT NULL AND TRIM(v_name) <> '' THEN
    RETURN v_name;
  END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NOT NULL AND v_email <> '' THEN
    RETURN split_part(v_email, '@', 1);
  END IF;
  RETURN 'A member';
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_display_name(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_display_name(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.resolve_display_name(UUID) TO authenticated;

-- =============================================================================
-- create_circle
-- =============================================================================
-- Atomic create path. Returns the new circle's id, invite_code, and the
-- creator's circle_members row id.
--
-- Parallel arrays p_invited_phones / p_invited_names: each invitee gets
-- (phone, name) at the same index. Pass empty arrays to skip. Validation
-- caps the array length at 100 so a runaway client can't bulk-insert.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_circle(
  p_type                 TEXT,
  p_name                 TEXT,
  p_amount               NUMERIC,
  p_frequency            TEXT,
  p_member_count         INT,
  p_start_date           DATE          DEFAULT NULL,
  p_rotation_method      TEXT          DEFAULT 'xnscore',
  p_grace_period_days    INT           DEFAULT 2,
  p_emoji                TEXT          DEFAULT NULL,
  p_description          TEXT          DEFAULT NULL,
  p_min_score            INT           DEFAULT 0,
  p_invite_code          TEXT          DEFAULT NULL,
  p_invited_phones       TEXT[]        DEFAULT ARRAY[]::TEXT[],
  p_invited_names        TEXT[]        DEFAULT ARRAY[]::TEXT[]
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
  v_creator      UUID;
  v_circle_id    UUID;
  v_invite_code  TEXT;
  v_member_id    UUID;
  v_default_emoji TEXT;
  v_phones_len   INT;
  v_display_name TEXT;
BEGIN
  -- ── Auth + input validation ───────────────────────────────────────────────
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

  v_phones_len := COALESCE(array_length(p_invited_phones, 1), 0);
  IF v_phones_len > 100 THEN
    RAISE EXCEPTION 'too_many_invites';
  END IF;
  IF v_phones_len <> COALESCE(array_length(p_invited_names, 1), 0) THEN
    RAISE EXCEPTION 'invite_array_mismatch';
  END IF;

  -- ── Invite code: use caller-supplied if unique, otherwise generate ────────
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

  -- ── Default emoji by type — keeps the JS-side helper from leaking into
  --    every UI render. Caller may override with p_emoji.
  v_default_emoji := CASE p_type
    WHEN 'traditional'    THEN '🔄'
    WHEN 'goal-based'     THEN '🎯'
    WHEN 'goal'           THEN '🎯'
    WHEN 'emergency'      THEN '🛡️'
    WHEN 'family-support' THEN '👨‍👩‍👧‍👦'
    WHEN 'beneficiary'    THEN '💝'
    ELSE                       '💰'
  END;

  -- ── INSERT circles ────────────────────────────────────────────────────────
  INSERT INTO public.circles (
    name, type, amount, frequency, member_count, current_members,
    start_date, rotation_method, grace_period_days, status, emoji,
    description, min_score, invite_code, created_by, progress
  )
  VALUES (
    trim(p_name), p_type, p_amount, p_frequency, p_member_count, 1,
    p_start_date, p_rotation_method, p_grace_period_days, 'pending',
    COALESCE(NULLIF(trim(p_emoji),''), v_default_emoji),
    NULLIF(trim(p_description),''), COALESCE(p_min_score, 0),
    v_invite_code, v_creator, 0
  )
  RETURNING id INTO v_circle_id;

  -- ── INSERT creator as first member ────────────────────────────────────────
  INSERT INTO public.circle_members (
    circle_id, user_id, position, role, status, joined_at
  )
  VALUES (v_circle_id, v_creator, 1, 'creator', 'active', NOW())
  RETURNING id INTO v_member_id;

  -- ── Bulk INSERT invited_members (if any). Empty rows are filtered. ────────
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

  -- ── Post system chat message — best-effort, never blocks the create. ──────
  --    Mirrors the EXCEPTION block pattern in complete_circle_join so a
  --    circle_messages-side hiccup can't roll back the entire transaction.
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
  TEXT, TEXT, NUMERIC, TEXT, INT, DATE, TEXT, INT, TEXT, TEXT, INT, TEXT, TEXT[], TEXT[]
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_circle(
  TEXT, TEXT, NUMERIC, TEXT, INT, DATE, TEXT, INT, TEXT, TEXT, INT, TEXT, TEXT[], TEXT[]
) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_circle(
  TEXT, TEXT, NUMERIC, TEXT, INT, DATE, TEXT, INT, TEXT, TEXT, INT, TEXT, TEXT[], TEXT[]
) TO authenticated;

-- =============================================================================
-- join_circle
-- =============================================================================
-- Locks the circles row FOR UPDATE so concurrent joiners can't both compute
-- the same position. Validates:
--   - circle exists, status IN ('pending','active')
--   - capacity remaining (current_members < member_count)
--   - caller meets min_score
--   - caller isn't already a member (idempotent — returns existing row)
--   - if p_invite_code is non-null, it must match (defense-in-depth)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.join_circle(
  p_circle_id    UUID,
  p_invite_code  TEXT DEFAULT NULL
)
RETURNS TABLE (
  -- Renamed from `position` — collides with the SQL reserved word
  -- POSITION used by string functions, which Postgres won't accept as an
  -- unquoted TABLE-column name. The underlying `circle_members.position`
  -- column is untouched.
  member_id        UUID,
  member_position  INT,
  already_member   BOOLEAN
)
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
BEGIN
  v_joiner := auth.uid();
  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF p_circle_id IS NULL THEN
    RAISE EXCEPTION 'invalid_circle_id';
  END IF;

  -- ── Lock the circle row for the duration of the transaction ──────────────
  SELECT id, name, status, member_count, current_members, min_score, invite_code
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

  -- Optional invite-code check. Caller can pass NULL when they're joining
  -- via a discover-listing tap (already authorized by RLS-readable browse).
  IF p_invite_code IS NOT NULL AND length(trim(p_invite_code)) > 0 THEN
    IF upper(trim(p_invite_code)) <> v_circle.invite_code THEN
      RAISE EXCEPTION 'invalid_invite_code';
    END IF;
  END IF;

  -- ── Idempotency: if already a member, return their existing row ──────────
  SELECT id INTO v_existing
  FROM public.circle_members
  WHERE circle_id = p_circle_id AND user_id = v_joiner;
  IF v_existing IS NOT NULL THEN
    RETURN QUERY
      SELECT v_existing,
             (SELECT cm.position FROM public.circle_members cm WHERE cm.id = v_existing),
             TRUE;
    RETURN;
  END IF;

  IF v_circle.current_members >= v_circle.member_count THEN
    RAISE EXCEPTION 'circle_full';
  END IF;

  -- ── Min-score gate (skip when min_score = 0). ────────────────────────────
  IF COALESCE(v_circle.min_score, 0) > 0 THEN
    SELECT COALESCE(xn_score, 0) INTO v_user_xn_score
    FROM public.profiles WHERE id = v_joiner;
    IF COALESCE(v_user_xn_score, 0) < v_circle.min_score THEN
      RAISE EXCEPTION 'min_score_not_met';
    END IF;
  END IF;

  -- ── Insert + increment, both inside the FOR UPDATE window ────────────────
  v_new_position := v_circle.current_members + 1;
  INSERT INTO public.circle_members (
    circle_id, user_id, position, role, status, joined_at
  )
  VALUES (p_circle_id, v_joiner, v_new_position, 'member', 'active', NOW())
  RETURNING id INTO v_member_id;

  UPDATE public.circles
     SET current_members = current_members + 1,
         updated_at      = NOW(),
         -- Flip pending → active once the circle reaches its target size.
         status = CASE
           WHEN current_members + 1 >= member_count THEN 'active'
           ELSE status
         END
   WHERE id = p_circle_id;

  -- ── Post system chat message — same pattern as create_circle. ────────────
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

  RETURN QUERY SELECT v_member_id, v_new_position, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.join_circle(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_circle(UUID, TEXT) FROM anon;
GRANT  EXECUTE ON FUNCTION public.join_circle(UUID, TEXT) TO authenticated;

-- =============================================================================
-- Self-register
-- =============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '141',
  'circle_create_join_rpcs',
  ARRAY['-- 141: circle_create_join_rpcs']
)
ON CONFLICT (version) DO NOTHING;
