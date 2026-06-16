-- =============================================================================
-- 142: fix off-by-one collision between create/join RPCs and the
--      `on_circle_member_change` trigger that maintains circles.current_members
-- =============================================================================
-- Bug uncovered while debugging "I can't see my newly-created circle":
--
--   - Migration 141's `create_circle` INSERTed `circles.current_members = 1`
--     and THEN inserted the creator's `circle_members` row. The pre-existing
--     trigger `on_circle_member_change` (which fires AFTER INSERT on
--     circle_members and runs `update_circle_member_count()`) then bumped
--     `current_members` to 2. Result: every newly-created circle shows
--     "2 / N members" instead of "1 / N".
--
--   - Migration 141's `join_circle` UPDATEs `current_members = current_members + 1`
--     AND the trigger fires on the new `circle_members` INSERT. So every join
--     advances the counter by 2 instead of 1.
--
-- This migration:
--   1. Backfills `circles.current_members` to the actual count of active
--      members. Anything off from the COUNT(*) is treated as drift.
--   2. Replaces `create_circle` so the initial INSERT uses
--      `current_members = 0` — the trigger lands the +1 from the creator
--      row, bringing it to the correct 1.
--   3. Replaces `join_circle` so it no longer touches `current_members`
--      itself; the trigger owns that column entirely. The status-flip
--      check that lives in the UPDATE is preserved but reads the
--      post-trigger value via a re-SELECT before deciding to flip.
-- =============================================================================

-- ─── 1. Backfill ─────────────────────────────────────────────────────────────
UPDATE public.circles c
SET current_members = COALESCE((
  SELECT COUNT(*)::INT
  FROM public.circle_members cm
  WHERE cm.circle_id = c.id
    AND cm.status = 'active'
), 0)
WHERE current_members IS DISTINCT FROM COALESCE((
  SELECT COUNT(*)::INT
  FROM public.circle_members cm
  WHERE cm.circle_id = c.id
    AND cm.status = 'active'
), 0);

-- ─── 2. create_circle — initialise at 0, let the trigger increment ──────────
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
  v_creator       UUID;
  v_circle_id     UUID;
  v_invite_code   TEXT;
  v_member_id     UUID;
  v_default_emoji TEXT;
  v_phones_len    INT;
  v_display_name  TEXT;
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

  v_default_emoji := CASE p_type
    WHEN 'traditional'    THEN '🔄'
    WHEN 'goal-based'     THEN '🎯'
    WHEN 'goal'           THEN '🎯'
    WHEN 'emergency'      THEN '🛡️'
    WHEN 'family-support' THEN '👨‍👩‍👧‍👦'
    WHEN 'beneficiary'    THEN '💝'
    ELSE                       '💰'
  END;

  -- current_members = 0 here. The `on_circle_member_change` trigger
  -- increments it to 1 when the creator's circle_members row goes in below.
  INSERT INTO public.circles (
    name, type, amount, frequency, member_count, current_members,
    start_date, rotation_method, grace_period_days, status, emoji,
    description, min_score, invite_code, created_by, progress
  )
  VALUES (
    trim(p_name), p_type, p_amount, p_frequency, p_member_count, 0,
    p_start_date, p_rotation_method, p_grace_period_days, 'pending',
    COALESCE(NULLIF(trim(p_emoji),''), v_default_emoji),
    NULLIF(trim(p_description),''), COALESCE(p_min_score, 0),
    v_invite_code, v_creator, 0
  )
  RETURNING id INTO v_circle_id;

  INSERT INTO public.circle_members (
    circle_id, user_id, position, role, status, joined_at
  )
  VALUES (v_circle_id, v_creator, 1, 'creator', 'active', NOW())
  RETURNING id INTO v_member_id;

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

-- ─── 3. join_circle — don't double-count; trigger owns current_members ──────
CREATE OR REPLACE FUNCTION public.join_circle(
  p_circle_id    UUID,
  p_invite_code  TEXT DEFAULT NULL
)
RETURNS TABLE (
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
  v_post_count     INT;
BEGIN
  v_joiner := auth.uid();
  IF v_joiner IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;
  IF p_circle_id IS NULL THEN
    RAISE EXCEPTION 'invalid_circle_id';
  END IF;

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

  IF p_invite_code IS NOT NULL AND length(trim(p_invite_code)) > 0 THEN
    IF upper(trim(p_invite_code)) <> v_circle.invite_code THEN
      RAISE EXCEPTION 'invalid_invite_code';
    END IF;
  END IF;

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

  IF COALESCE(v_circle.min_score, 0) > 0 THEN
    SELECT COALESCE(xn_score, 0) INTO v_user_xn_score
    FROM public.profiles WHERE id = v_joiner;
    IF COALESCE(v_user_xn_score, 0) < v_circle.min_score THEN
      RAISE EXCEPTION 'min_score_not_met';
    END IF;
  END IF;

  -- Position is the next slot after the current members.
  v_new_position := v_circle.current_members + 1;

  -- Insert the new member. The on_circle_member_change trigger will run
  -- AFTER this and bump circles.current_members by +1. We deliberately
  -- do NOT touch current_members ourselves anymore — the prior `+ 1`
  -- collided with the trigger and double-counted every join.
  INSERT INTO public.circle_members (
    circle_id, user_id, position, role, status, joined_at
  )
  VALUES (p_circle_id, v_joiner, v_new_position, 'member', 'active', NOW())
  RETURNING id INTO v_member_id;

  -- Re-read the (now trigger-updated) count and flip status if we hit
  -- capacity. Still inside the FOR UPDATE window so this stays consistent.
  SELECT current_members INTO v_post_count
  FROM public.circles WHERE id = p_circle_id;

  IF v_post_count >= v_circle.member_count THEN
    UPDATE public.circles
       SET status = 'active', updated_at = NOW()
     WHERE id = p_circle_id AND status = 'pending';
  ELSE
    UPDATE public.circles
       SET updated_at = NOW()
     WHERE id = p_circle_id;
  END IF;

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

-- =============================================================================
-- Self-register
-- =============================================================================
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '142',
  'fix_circle_member_count_collision',
  ARRAY['-- 142: fix_circle_member_count_collision']
)
ON CONFLICT (version) DO NOTHING;
