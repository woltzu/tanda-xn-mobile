-- ═══════════════════════════════════════════════════════════════════════════
-- 290_underfilled_vote.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bucket B of the underfilled-circle work. When a `pending` circle has
-- not filled by its start_date, existing members should be able to vote
-- either to start with the reduced pot or to dissolve and refund.
--
-- Design constraints inferred from the live schema (not the user's
-- speculative SQL — the columns and enum names differ):
--
--   circles.status CHECK allows: forming, pending, active, paused,
--     completed, cancelled. NOT `awaiting_vote`; the state we want to
--     represent lives in the proposal itself (status='open') so we
--     leave circles.status='pending' during the vote — one less state
--     to migrate and no CHECK constraint churn.
--   circle_proposals.proposal_type CHECK does NOT allow
--     `start_underfilled`. Add it.
--   circle_proposals uses circle_id (not target_id), proposer_id (not
--     proposer_user_id), and proposal_payload jsonb is NOT NULL.
--   circle_proposal_votes rows carry vote (text) + vote_weight (numeric).
--   Existing execute_approved_proposal trigger is opt-in per circle
--     (circle_governance_settings.auto_execute_approved). Rather than
--     modifying that critical trigger, add a dedicated trigger that
--     fires only for our proposal_type — reduces blast radius if this
--     migration ever needs to be rolled back.
--   notifications table has no type CHECK, so we can freely use
--     `circle.vote_needed` and `circle.dissolution_pending`.
--
-- What this migration adds:
--
--   1. Widen circle_proposals.proposal_type CHECK to include
--      `start_underfilled`.
--   2. RPC public.check_underfilled_circles() — scans `pending` circles
--      whose start_date has passed and current_members < member_count,
--      creates a `start_underfilled` open proposal for each, fans out
--      one notification per joined member. Idempotent: skips circles
--      that already have an open/closed proposal of this type.
--   3. Trigger handle_start_underfilled_outcome on circle_proposals
--      that fires when a `start_underfilled` proposal moves to
--      status='closed' with a resolved result:
--        - approved → flip circles.status to 'active'. First cycle
--          creation is left to the existing cycle-progression cron
--          which now picks the circle up on its next tick.
--        - rejected / no_quorum → call initiate_dissolution
--          (existing RPC from migration 016) with trigger
--          `membership_collapse`. The dissolution engine handles the
--          refund path; for a circle that never collected
--          contributions the refund set is trivially empty.
--
-- Not in this migration (documented; separate bucket):
--   - Scheduling the RPC. pg_cron is per-project config; wiring the
--     schedule belongs in the same PR that verifies pg_cron is
--     enabled and matches the project's other daily jobs. For now
--     invoke check_underfilled_circles() manually or via a follow-up
--     migration.
--   - Client-side voting UI. The existing CircleVoting screen already
--     lists open proposals for a circle — a shallow wiring change on
--     the pending banner (link to CircleVoting) is all the client
--     needs.
--
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 1. Widen circle_proposals.proposal_type CHECK ─────────────────────────

ALTER TABLE public.circle_proposals
  DROP CONSTRAINT IF EXISTS circle_proposals_proposal_type_check;

ALTER TABLE public.circle_proposals
  ADD CONSTRAINT circle_proposals_proposal_type_check
  CHECK (proposal_type = ANY (ARRAY[
    'admit_member',
    'remove_member',
    'change_payout_order',
    'change_rules',
    'resolve_dispute',
    'dissolve_circle',
    'custom',
    'pool_rollover',
    'start_underfilled'
  ]));


-- ─── 2. Detection RPC ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_underfilled_circles()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row              RECORD;
  v_proposal_id      UUID;
  v_eligible_voters  INTEGER;
  v_voting_hours     INTEGER;
  v_quorum_pct       NUMERIC;
  v_threshold_pct    NUMERIC;
  v_created_count    INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT c.id, c.name, c.start_date, c.current_members, c.member_count,
           c.created_by, c.amount, c.currency
      FROM public.circles c
     WHERE c.status = 'pending'
       AND c.start_date <= CURRENT_DATE
       AND c.current_members < c.member_count
       AND NOT EXISTS (
         SELECT 1 FROM public.circle_proposals p
          WHERE p.circle_id = c.id
            AND p.proposal_type = 'start_underfilled'
            AND p.status IN ('draft', 'open', 'closed')
       )
  LOOP
    -- Count members eligible to vote. Only active members participate.
    SELECT COUNT(*) INTO v_eligible_voters
      FROM public.circle_members
     WHERE circle_id = v_row.id AND status = 'active';

    -- Governance defaults with sensible fallbacks. Ordinary circles
    -- don't have a governance_settings row; use platform defaults
    -- (60% quorum, 60% threshold, 72h voting window). Members can
    -- vote as soon as the notification lands.
    SELECT COALESCE(default_voting_hours, 72),
           COALESCE(default_quorum_pct, 60),
           COALESCE(default_threshold_pct, 60)
      INTO v_voting_hours, v_quorum_pct, v_threshold_pct
      FROM public.circle_governance_settings
     WHERE circle_id = v_row.id;

    v_voting_hours  := COALESCE(v_voting_hours, 72);
    v_quorum_pct    := COALESCE(v_quorum_pct, 60);
    v_threshold_pct := COALESCE(v_threshold_pct, 60);

    INSERT INTO public.circle_proposals (
      circle_id,
      proposer_id,
      proposal_type,
      title,
      description,
      proposal_payload,
      status,
      voting_starts_at,
      voting_ends_at,
      quorum_pct,
      threshold_pct,
      eligible_voters,
      votes_for,
      votes_against,
      votes_abstain,
      total_vote_weight,
      weight_for,
      weight_against
    ) VALUES (
      v_row.id,
      v_row.created_by,
      'start_underfilled',
      'Start ' || v_row.name || ' with reduced members?',
      'Only ' || v_row.current_members || ' of '
        || v_row.member_count || ' members joined by the start date. '
        || 'Approve to start now (pot = amount × current members). '
        || 'Reject to dissolve — any refunds run through the standard '
        || 'dissolution flow.',
      jsonb_build_object(
        'circle_id',        v_row.id,
        'current_members',  v_row.current_members,
        'member_count',     v_row.member_count,
        'reduced_pot_dollars', v_row.amount * v_row.current_members,
        'currency',         v_row.currency,
        'start_date',       v_row.start_date
      ),
      'open',
      NOW(),
      NOW() + (v_voting_hours || ' hours')::INTERVAL,
      v_quorum_pct,
      v_threshold_pct,
      v_eligible_voters,
      0, 0, 0, 0, 0, 0
    )
    RETURNING id INTO v_proposal_id;

    -- Fan out one notification per joined member. Skips inactive rows.
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT
      cm.user_id,
      'circle.vote_needed',
      'Vote needed: ' || v_row.name,
      'Only ' || v_row.current_members || ' of '
        || v_row.member_count || ' members joined by the start date. '
        || 'Please vote to start or dissolve.',
      jsonb_build_object(
        'circle_id',    v_row.id,
        'proposal_id',  v_proposal_id,
        'proposal_type','start_underfilled'
      )
    FROM public.circle_members cm
    WHERE cm.circle_id = v_row.id
      AND cm.status = 'active';

    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN v_created_count;
END;
$$;


-- ─── 3. Resolution trigger ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_start_underfilled_outcome()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only for our proposal type + closed transitions with a resolved
  -- result. Idempotent-ish: guarded by executed_at.
  IF NEW.proposal_type <> 'start_underfilled' THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;
  IF NEW.executed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.result NOT IN ('approved', 'rejected', 'no_quorum') THEN
    RETURN NEW;
  END IF;

  IF NEW.result = 'approved' THEN
    -- Flip circle to active. cycle-progression-cron will pick it up
    -- on its next tick and start the first cycle.
    UPDATE public.circles
       SET status = 'active',
           updated_at = NOW()
     WHERE id = NEW.circle_id
       AND status = 'pending';

    -- Notify all joined members that voting closed in favour of
    -- starting.
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT
      cm.user_id,
      'circle.vote_result_approved',
      'Circle starting with reduced members',
      'Vote passed. The circle is now active with '
        || (SELECT current_members FROM public.circles WHERE id = NEW.circle_id)
        || ' members.',
      jsonb_build_object(
        'circle_id',   NEW.circle_id,
        'proposal_id', NEW.id
      )
    FROM public.circle_members cm
    WHERE cm.circle_id = NEW.circle_id
      AND cm.status = 'active';

  ELSE
    -- rejected OR no_quorum → dissolve via the existing engine. The
    -- dissolution flow (migration 016) handles the refund calc; a
    -- circle that never collected contributions ends up with an
    -- empty refund set, which the engine tolerates.
    BEGIN
      PERFORM public.initiate_dissolution(
        NEW.circle_id,
        'membership_collapse'::dissolution_trigger,
        CASE WHEN NEW.result = 'no_quorum'
             THEN 'Underfilled-start vote failed to reach quorum'
             ELSE 'Underfilled-start vote rejected by members'
        END,
        NEW.proposer_id,
        NULL
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[handle_start_underfilled_outcome] initiate_dissolution failed for circle %: %',
        NEW.circle_id, SQLERRM;
    END;

    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT
      cm.user_id,
      'circle.dissolution_pending',
      'Circle scheduled to dissolve',
      'The vote to start with reduced members did not pass. '
        || 'Any contributions will be refunded through the dissolution flow.',
      jsonb_build_object(
        'circle_id',   NEW.circle_id,
        'proposal_id', NEW.id,
        'result',      NEW.result
      )
    FROM public.circle_members cm
    WHERE cm.circle_id = NEW.circle_id
      AND cm.status = 'active';
  END IF;

  -- Stamp executed_at so this trigger is a one-shot per proposal.
  NEW.executed_at := NOW();
  NEW.executed_by := NEW.proposer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_handle_start_underfilled_outcome ON public.circle_proposals;

CREATE TRIGGER tr_handle_start_underfilled_outcome
  BEFORE UPDATE OF status ON public.circle_proposals
  FOR EACH ROW
  WHEN (NEW.proposal_type = 'start_underfilled'
        AND NEW.status = 'closed')
  EXECUTE FUNCTION public.handle_start_underfilled_outcome();


-- ─── 4. Self-registration ──────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '290',
  'underfilled_vote',
  ARRAY['-- 290: underfilled_vote']
)
ON CONFLICT (version) DO NOTHING;

COMMIT;
