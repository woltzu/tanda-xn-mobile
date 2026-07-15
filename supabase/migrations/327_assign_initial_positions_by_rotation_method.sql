-- ═══════════════════════════════════════════════════════════════════════════
-- 327_assign_initial_positions_by_rotation_method.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Wire the wizard's rotation_method choice into position assignment. Prior
-- to this migration, the "By XnScore (recommended)" option in the create-
-- circle flow was cosmetic — the value was stored in circles.rotation_method
-- but no code path read it. Every circle was ordered by join_at ASC
-- regardless of what the user selected. Investigation trail:
--   * DB-wide grep: no RPC combined rotation_method + xn_score.
--   * assign_initial_positions used ORDER BY joined_at ASC unconditionally.
--   * DynamicPayoutOrderingEngine (client, Monte Carlo) doesn't read
--     xn_score either — it's a different feature entirely.
--
-- Design fixes here:
--
--   1. Extend assign_initial_positions to branch on circles.rotation_method
--      before the ORDER BY:
--        'xnscore'     → highest XnScore first, join order as tiebreak
--        'random'      → random(), join order as tiebreak
--        'manual'      → skip auto-assign (creator sets positions later)
--        'beneficiary' → join order (positions matter less — recipient is
--                        fixed via circles.beneficiary_*)
--        anything else → join order (current default)
--      The XnScore snapshot is taken at the moment this function fires
--      (typically when the last member joins, per the check_circle_full_
--      assign_positions trigger). It's persisted to circle_members.position
--      and never re-read from live xn_scores again — matches the design
--      intent "fixed at creation, doesn't drift with live score changes."
--
--   2. Replace the ad-hoc "any position is set" idempotency guard with a
--      dedicated positions_finalized_at TIMESTAMPTZ column on circles.
--      The prior guard was confused by the fact that join_circle pre-sets
--      a provisional position on every join (v_new_position :=
--      current_members + 1). With the old logic, that pre-set caused
--      assign_initial_positions to short-circuit and never actually
--      re-order by rotation_method. New logic: check positions_finalized_at.
--      If NULL, run once and stamp; if NOT NULL, skip forever.
--
--   3. Backfill positions_finalized_at for existing circles that already
--      have members with positions set — so this migration doesn't
--      re-shuffle any live circle. Only new circles get the rotation-
--      method-driven behavior.
--
-- join_circle stays as-is — it keeps setting the provisional position (used
-- as the client-side "you joined as member N" return value). Those
-- provisional positions get overwritten by assign_initial_positions when
-- the circle fills.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Idempotency column ───────────────────────────────────────────────

ALTER TABLE public.circles
  ADD COLUMN IF NOT EXISTS positions_finalized_at TIMESTAMPTZ;

-- Backfill: any circle that has at least one member with a set position
-- is considered "already finalized" — the new logic won't touch it.
-- Keeps prod circles stable while making the new rotation logic apply
-- only to future circles.
UPDATE public.circles c
   SET positions_finalized_at = NOW()
 WHERE positions_finalized_at IS NULL
   AND EXISTS (
     SELECT 1 FROM public.circle_members cm
      WHERE cm.circle_id = c.id AND cm.position IS NOT NULL
   );

-- ─── 2. Rewritten assign_initial_positions ──────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_initial_positions(p_circle_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
#variable_conflict use_column
DECLARE
  v_circle_name     TEXT;
  v_rotation_method TEXT;
  v_finalized_at    TIMESTAMPTZ;
  v_target          INT;
  v_position        INT := 1;
  v_total           INT;
  v_member          RECORD;
  v_assigned        INT := 0;
  v_factor_desc     TEXT;
BEGIN
  SELECT name, rotation_method, positions_finalized_at, member_count
    INTO v_circle_name, v_rotation_method, v_finalized_at, v_target
    FROM public.circles WHERE id = p_circle_id;
  IF v_circle_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'circle_not_found');
  END IF;

  -- Explicit finalization guard — skip if already run.
  IF v_finalized_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true, 'skipped', true,
      'reason', 'positions_already_finalized',
      'finalized_at', v_finalized_at
    );
  END IF;

  -- Manual rotation: creator will assign positions individually via
  -- the UI. Don't auto-assign, don't stamp — waits indefinitely for
  -- manual finalization.
  IF v_rotation_method = 'manual' THEN
    RETURN jsonb_build_object(
      'ok', true, 'skipped', true,
      'reason', 'manual_rotation_deferred'
    );
  END IF;

  SELECT count(*) INTO v_total
    FROM public.circle_members
   WHERE circle_id = p_circle_id AND status = 'active';

  IF v_total = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_members');
  END IF;

  v_factor_desc := CASE v_rotation_method
    WHEN 'xnscore'     THEN 'XnScore (higher first)'
    WHEN 'random'      THEN 'random draw'
    WHEN 'beneficiary' THEN 'join order (beneficiary rotation)'
    ELSE                    'join order'
  END;

  -- Order per rotation_method. Each branch uses a CASE that returns
  -- non-NULL only when its branch is active; other branches fall
  -- through to the joined_at tiebreak. Deterministic under equal
  -- keys.
  FOR v_member IN
    SELECT cm.id, cm.user_id
      FROM public.circle_members cm
      LEFT JOIN public.profiles p ON p.id = cm.user_id
     WHERE cm.circle_id = p_circle_id
       AND cm.status = 'active'
     ORDER BY
       CASE WHEN v_rotation_method = 'xnscore'
            THEN COALESCE(p.xn_score, 0) END DESC NULLS LAST,
       CASE WHEN v_rotation_method = 'random'
            THEN random() END,
       cm.joined_at ASC,
       cm.id ASC
  LOOP
    UPDATE public.circle_members
       SET position = v_position
     WHERE id = v_member.id;

    BEGIN
      PERFORM public.record_ai_decision(
        v_member.user_id,
        'payout_position',
        v_circle_name,
        jsonb_build_object(
          'POSITION',           v_position,
          'TOTAL_MEMBERS',      v_total,
          'FACTOR_DESCRIPTION', v_factor_desc,
          'PERCENTAGE',         GREATEST(1, ROUND((v_position::numeric / v_total) * 100))::int
        ),
        p_circle_id,
        'circles'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[assign_initial_positions] record_ai_decision failed for user %: %',
        v_member.user_id, SQLERRM;
    END;

    v_assigned := v_assigned + 1;
    v_position := v_position + 1;
  END LOOP;

  -- Freeze — future calls short-circuit on positions_finalized_at.
  UPDATE public.circles
     SET positions_finalized_at = NOW(),
         updated_at             = NOW()
   WHERE id = p_circle_id;

  RETURN jsonb_build_object(
    'ok',              true,
    'assigned',        v_assigned,
    'total',           v_total,
    'circle_id',       p_circle_id,
    'rotation_method', v_rotation_method
  );
END;
$function$;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '327',
  'assign_initial_positions_by_rotation_method',
  ARRAY['-- 327: honor circles.rotation_method + positions_finalized_at idempotency']
)
ON CONFLICT (version) DO NOTHING;
