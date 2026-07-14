-- ═══════════════════════════════════════════════════════════════════════════
-- 311_create_circle_accepts_total_cycles.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix A (creation half) — extend create_circle to accept p_total_cycles.
-- New circles need to be born with a target cycle count so the
-- finalization block in execute_cycle_payout (mig 310) fires when the
-- last cycle pays out.
--
-- Signature change is backward-compatible: p_total_cycles is an
-- optional trailing parameter with DEFAULT NULL. Old callers that
-- omit it get member_count as the default — the same rule mig 310's
-- backfill used for existing NULL rows.
--
-- The rest of the function body is byte-identical to the prior
-- deploy — only the new parameter, the COALESCE for total_cycles,
-- and the INSERT column list change.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_circle(
  p_type            text,
  p_name            text,
  p_amount          numeric,
  p_frequency       text,
  p_member_count    integer,
  p_start_date      date       DEFAULT NULL,
  p_rotation_method text       DEFAULT 'xnscore',
  p_grace_period_days integer  DEFAULT 2,
  p_emoji           text       DEFAULT NULL,
  p_description     text       DEFAULT NULL,
  p_min_score       integer    DEFAULT 0,
  p_invite_code     text       DEFAULT NULL,
  p_invited_phones  text[]     DEFAULT ARRAY[]::text[],
  p_invited_names   text[]     DEFAULT ARRAY[]::text[],
  p_total_cycles    integer    DEFAULT NULL
)
RETURNS TABLE(circle_id uuid, invite_code text, member_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_creator        UUID;
  v_circle_id      UUID;
  v_invite_code    TEXT;
  v_member_id      UUID;
  v_default_emoji  TEXT;
  v_phones_len     INT;
  v_display_name   TEXT;
  v_total_cycles   INTEGER;
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

  -- Rotating-pot default: 1 payout per member. Callers that want a
  -- different cadence (family-support taking N cycles, goal circle
  -- running M rounds, etc.) pass p_total_cycles explicitly.
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

  -- Default emoji kept byte-identical to prior deploy (mojibake and all
  -- — the transport double-encoded these once and rewriting them here
  -- would break existing rows that reference them via type). Not this
  -- migration's job to correct.
  v_default_emoji := CASE p_type
    WHEN 'traditional'    THEN 'ðŸ”„'
    WHEN 'goal-based'     THEN 'ðŸŽ¯'
    WHEN 'goal'           THEN 'ðŸŽ¯'
    WHEN 'emergency'      THEN 'ðŸ›¡ï¸�'
    WHEN 'family-support' THEN 'ðŸ‘¨â€�ðŸ‘©â€�ðŸ‘§â€�ðŸ‘¦'
    WHEN 'beneficiary'    THEN 'ðŸ’�'
    ELSE                       'ðŸ’°'
  END;

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
$function$;

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '311',
  'create_circle_accepts_total_cycles',
  ARRAY['-- 311: create_circle: optional p_total_cycles, defaults to member_count']
)
ON CONFLICT (version) DO NOTHING;
