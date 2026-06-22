-- ════════════════════════════════════════════════════════════════════════════
-- Migration 233: assign_initial_positions
-- payout_position audit Bucket A
-- ════════════════════════════════════════════════════════════════════════════
--
-- Closes the gap surfaced by the read-only audit (2026-06-21):
--
--   Prior state (verified live via Management API):
--     • circle_members.payout_position INTEGER existed (since migration 011)
--       but was written by NOTHING. 0 of 17 prod rows populated.
--     • circle_members.position INTEGER exists, written by swap (migration 018)
--       and substitute lifecycle (migration 100). 14 of 17 prod rows populated.
--     • payout_orders had 0 rows ever — "Compute optimal order" was a manual
--       button that nobody had tapped.
--     • ai_decisions of decision_type 'payout_position' had 0 rows. The 15-
--       language explanation_templates entries from migration 046 were
--       orphaned.
--     • ContributionSchedulingService.find(m => m.payout_position === round)
--       was reading NULL on every cycle. No active circles in prod yet, so
--       the bug hadn't surfaced — but every cycle that ever progressed past
--       'pending' would have skipped its recipient.
--
-- Decisions locked in before this migration:
--     • CANONICAL COLUMN: `position` (the one with 14/17 rows populated).
--       `payout_position` is being deprecated — readers will switch to
--       `position` in this same commit (ContributionSchedulingService).
--       Column drop is deferred to a follow-up migration (1-2 weeks after
--       this lands so we can confirm no regressions).
--     • TRIGGER TIMING: fires when the Nth member joins (current_members
--       reaches circles.member_count). Hooked to circle_members AFTER
--       INSERT so it covers all 9 join paths — not just complete_circle_join
--       (migration 071 docstring notes that 7 of 9 paths bypass that RPC).
--     • AI ORDER WINS: a sync trigger on payout_orders parses order_data
--       JSONB and UPDATEs circle_members.position. AI computation is
--       authoritative; default join-order is just the bootstrap.
--
-- Pieces in this file:
--     1. assign_initial_positions(p_circle_id) — RPC that orders active
--        members by joined_at and writes position. Idempotent: bails if
--        any member already has a position set (so substitute paths
--        that pre-set position via migration 100 don't get overwritten).
--     2. trg_circle_members_check_full — AFTER INSERT trigger that calls
--        the RPC when the join brings current_members to the circle's
--        target member_count.
--     3. sync_positions_from_payout_orders — function that reads
--        order_data JSONB and writes circle_members.position. Includes
--        a record_ai_decision('payout_position', ...) per member so the
--        15-language template lands as an AI Insights card.
--     4. trg_payout_orders_sync_positions — AFTER INSERT OR UPDATE
--        trigger on payout_orders.
--     5. notify_payout_position_assigned — fires when circle_members.position
--        transitions from NULL to set. Inserts a notification row with
--        i18n keys.
--     6. trg_circle_members_notify_position — AFTER UPDATE trigger.
--
-- Dead-RPC note (audit bucket A.5):
--     get_circle_dashboard and get_user_dashboard reference legacy v1
--     tables (groups, group_members, users, wallets, loans, payouts)
--     that don't exist in the current schema. They're broken on any
--     real call. No TS code invokes them. They're being left alone
--     here — cleanup is a separate dead-code sweep, not part of this
--     audit.
--
-- Notification flow:
--     INSERT → trg_circle_members_check_full → assign_initial_positions
--       → UPDATE circle_members.position → trg_circle_members_notify_position
--       → INSERT notifications
--       AND record_ai_decision('payout_position', ...) called inside
--       assign_initial_positions for the AI Insights card.
--
--     payout_orders upsert → trg_payout_orders_sync_positions
--       → UPDATE circle_members.position → trg_circle_members_notify_position
--       → INSERT notifications
--       AND record_ai_decision called inside sync_positions_from_payout_orders.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── PART 1: assign_initial_positions ─────────────────────────────────────
-- Orders active members of a circle by joined_at and writes their
-- payout position. Idempotent: returns early if ANY active member
-- already has position set, so substitute pre-fill (migration 100)
-- and partial existing data aren't clobbered.

CREATE OR REPLACE FUNCTION public.assign_initial_positions(p_circle_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member        RECORD;
  v_position      INTEGER := 1;
  v_total         INTEGER;
  v_already_set   INTEGER;
  v_circle_name   TEXT;
  v_assigned      INTEGER := 0;
BEGIN
  SELECT name INTO v_circle_name FROM public.circles WHERE id = p_circle_id;
  IF v_circle_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'circle_not_found');
  END IF;

  SELECT count(*) INTO v_total
    FROM public.circle_members
   WHERE circle_id = p_circle_id AND status = 'active';

  IF v_total = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_active_members');
  END IF;

  SELECT count(*) INTO v_already_set
    FROM public.circle_members
   WHERE circle_id = p_circle_id
     AND status = 'active'
     AND position IS NOT NULL;

  IF v_already_set > 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'positions_already_assigned',
      'already_set', v_already_set,
      'total', v_total
    );
  END IF;

  -- Assign by joined_at, oldest first → position 1.
  FOR v_member IN
    SELECT id, user_id
      FROM public.circle_members
     WHERE circle_id = p_circle_id
       AND status = 'active'
     ORDER BY joined_at ASC, id ASC
  LOOP
    UPDATE public.circle_members
       SET position = v_position
     WHERE id = v_member.id;

    -- AI Insights card. Uses the 15-language templates registered in
    -- migration 046. PERCENTAGE is rounded so the template renders an
    -- integer. FACTOR_DESCRIPTION is the bootstrap reason; the AI sync
    -- trigger overrides with a richer description if/when an order is
    -- computed.
    BEGIN
      PERFORM public.record_ai_decision(
        v_member.user_id,
        'payout_position',
        v_circle_name,
        jsonb_build_object(
          'POSITION',           v_position,
          'TOTAL_MEMBERS',      v_total,
          'FACTOR_DESCRIPTION', 'join order',
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

  RETURN jsonb_build_object(
    'ok', true,
    'assigned', v_assigned,
    'total', v_total,
    'circle_id', p_circle_id
  );
END;
$$;

-- ─── PART 2: trigger on circle_members AFTER INSERT ───────────────────────
-- Fires the assignment when the join brings active member count to the
-- circle's target (circles.member_count). Covers all 9 join paths since
-- it sits on the table, not on any specific RPC.

CREATE OR REPLACE FUNCTION public.check_circle_full_assign_positions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target  INTEGER;
  v_current INTEGER;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  SELECT member_count INTO v_target FROM public.circles WHERE id = NEW.circle_id;
  IF v_target IS NULL OR v_target <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_current
    FROM public.circle_members
   WHERE circle_id = NEW.circle_id AND status = 'active';

  IF v_current >= v_target THEN
    BEGIN
      PERFORM public.assign_initial_positions(NEW.circle_id);
    EXCEPTION WHEN OTHERS THEN
      -- Non-fatal: positions can be assigned manually if this fires
      -- inside a transaction that's about to roll back.
      RAISE WARNING '[check_circle_full_assign_positions] failed for circle %: %',
        NEW.circle_id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_circle_members_check_full ON public.circle_members;
CREATE TRIGGER tr_circle_members_check_full
AFTER INSERT ON public.circle_members
FOR EACH ROW
EXECUTE FUNCTION public.check_circle_full_assign_positions();

-- ─── PART 3: sync_positions_from_payout_orders ────────────────────────────
-- AI order wins. When DynamicPayoutOrderingEngine writes payout_orders.
-- order_data, this function parses the JSONB and overwrites
-- circle_members.position for every entry. Emits a fresh
-- record_ai_decision('payout_position', ...) with the AI factor
-- description and the per-member assignedReason (if present in the
-- order entry).

CREATE OR REPLACE FUNCTION public.sync_positions_from_payout_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry         JSONB;
  v_user_id       UUID;
  v_position      INTEGER;
  v_assigned_why  TEXT;
  v_total         INTEGER;
  v_circle_name   TEXT;
BEGIN
  IF NEW.order_data IS NULL OR jsonb_typeof(NEW.order_data) <> 'array' THEN
    RETURN NEW;
  END IF;

  v_total := jsonb_array_length(NEW.order_data);
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;

  FOR v_entry IN SELECT * FROM jsonb_array_elements(NEW.order_data)
  LOOP
    v_user_id      := (v_entry->>'userId')::UUID;
    v_position     := (v_entry->>'position')::INTEGER;
    v_assigned_why := COALESCE(v_entry->>'assignedReason',
                               'AI-computed optimal order');

    UPDATE public.circle_members
       SET position = v_position
     WHERE circle_id = NEW.circle_id
       AND user_id = v_user_id;

    BEGIN
      PERFORM public.record_ai_decision(
        v_user_id,
        'payout_position',
        COALESCE(v_circle_name, 'your circle'),
        jsonb_build_object(
          'POSITION',           v_position,
          'TOTAL_MEMBERS',      v_total,
          'FACTOR_DESCRIPTION', v_assigned_why,
          'PERCENTAGE',         GREATEST(1, ROUND((v_position::numeric / v_total) * 100))::int
        ),
        NEW.circle_id,
        'circles'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[sync_positions_from_payout_orders] record_ai_decision failed for user %: %',
        v_user_id, SQLERRM;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_payout_orders_sync_positions ON public.payout_orders;
CREATE TRIGGER tr_payout_orders_sync_positions
AFTER INSERT OR UPDATE OF order_data ON public.payout_orders
FOR EACH ROW
WHEN (NEW.status = 'active' OR NEW.status = 'modified' OR NEW.status = 'recalculated')
EXECUTE FUNCTION public.sync_positions_from_payout_orders();

-- ─── PART 4: notify_payout_position_assigned ──────────────────────────────
-- Inserts a notifications row when circle_members.position transitions
-- from NULL to a value (initial assignment) or changes (re-assigned).
-- Idempotent on (user_id, type, data->>'circle_id', data->>'position')
-- so the same notification doesn't fire twice for a no-op update.

CREATE OR REPLACE FUNCTION public.notify_payout_position_assigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing    UUID;
  v_circle_name TEXT;
  v_total       INTEGER;
BEGIN
  -- Skip no-op updates and NULL transitions away from a value (which
  -- means a member is leaving — handled by other systems).
  IF NEW.position IS NULL THEN
    RETURN NEW;
  END IF;
  IF OLD.position IS NOT NULL AND OLD.position = NEW.position THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  SELECT count(*) INTO v_total
    FROM public.circle_members
   WHERE circle_id = NEW.circle_id AND status = 'active';

  SELECT id INTO v_existing
    FROM public.notifications
   WHERE user_id = NEW.user_id
     AND type = 'payout_position_assigned'
     AND data->>'circle_id' = NEW.circle_id::text
     AND data->>'position' = NEW.position::text
   LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    VALUES (
      NEW.user_id,
      'payout_position_assigned',
      'Your payout position',
      'You are #' || NEW.position || ' of ' || COALESCE(v_total, 0)
        || ' in ' || COALESCE(v_circle_name, 'your circle') || '.',
      jsonb_build_object(
        'circle_id',     NEW.circle_id,
        'circle_name',   v_circle_name,
        'position',      NEW.position,
        'total_members', v_total,
        'i18n_title_key', 'payout.notification_position_assigned_title',
        'i18n_body_key',  'payout.notification_position_assigned_body'
      ),
      FALSE
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notify_payout_position_assigned] failed for member %: %',
      NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_circle_members_notify_position ON public.circle_members;
CREATE TRIGGER tr_circle_members_notify_position
AFTER UPDATE OF position ON public.circle_members
FOR EACH ROW
EXECUTE FUNCTION public.notify_payout_position_assigned();

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '233',
  'assign_initial_positions',
  ARRAY['-- 233: assign_initial_positions']
)
ON CONFLICT (version) DO NOTHING;
