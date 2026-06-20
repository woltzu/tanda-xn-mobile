-- ════════════════════════════════════════════════════════════════════════════
-- Migration 211: voting_automation
-- ════════════════════════════════════════════════════════════════════════════
-- Bucket C of the Voting (circle governance) review.
--
--   1. require_member_approval column on circle_governance_settings.
--   2. circle_audit_log table — created here because it didn't exist in prod
--      despite being referenced by Bucket C. RLS makes rows visible to every
--      member of the circle so the audit trail builds trust.
--   3. notify_proposal_state_change trigger on circle_proposals:
--        * INSERT with status='open' OR UPDATE OF status to 'open' from
--          'draft' → fan out 'proposal_open' to all active circle members.
--        * UPDATE OF status to 'closed' → fan out 'proposal_resolved' to
--          the proposer + every voter, carrying result and executed_at in
--          the data payload.
--      Idempotent via (user_id, type, data->>'proposal_id', data->>'status').
--   4. execute_approved_proposal trigger on circle_proposals AFTER UPDATE
--      OF status when NEW.status='closed' AND NEW.result='approved' AND
--      governance.auto_execute_approved=true. Dispatched per proposal_type:
--        * admit_member        → flip circle_members.status to 'active'
--                                (auto-flow path with circle_member_id) OR
--                                INSERT a new row (manual path).
--        * remove_member       → set circle_members.status='removed' +
--                                stamp exited_at.
--        * change_rules        → UPDATE circles per {rule, value}.
--        * change_payout_order → stamp executed_at only; the live engine
--                                callback already mutates the order on
--                                early-close. Cron-closed proposals will
--                                surface in audit; no DB-side reorder yet.
--        * dissolve_circle     → guard against in-flight funds; if safe,
--                                flip circles.status='dissolved'. If
--                                unsafe, stamp result_reason and skip
--                                executed_at so the UI shows
--                                "pending execution".
--        * custom              → no-op, stamps executed_at.
--      Stamps executed_at + status='executed' and logs to circle_audit_log.
--      Idempotent: skips when executed_at IS NOT NULL.
--   5. auto_create_admit_member_proposal trigger on circle_members AFTER
--      INSERT when status='pending' AND governance.require_member_approval=
--      true. Inserts a circle_proposals row with status='open',
--      voting_ends_at=NOW()+72h, payload {circle_member_id, member_id}.
--   6. pg_cron: close_expired_proposals_every_2h calls the existing
--      close_expired_proposals() function every 2 hours.
--   7. RLS on circle_audit_log: every active member of the circle can read.
--
-- All trigger functions are SECURITY DEFINER with pinned search_path +
-- EXCEPTION sub-block so a fan-out / execution failure can't roll back the
-- proposal row that triggered them. Mirrors migrations 205 / 207 / 208 /
-- 209 / 210.
--
-- Self-registers.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. require_member_approval on circle_governance_settings
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.circle_governance_settings
  ADD COLUMN IF NOT EXISTS require_member_approval BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.circle_governance_settings.require_member_approval IS
  'Bucket C: when true, joining the circle creates the row with status=pending '
  'and auto_create_admit_member_proposal trigger opens an admit_member proposal. '
  'When the proposal passes, execute_approved_proposal flips the row to active.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. circle_audit_log table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.circle_audit_log (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id       UUID         NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  proposal_id     UUID         REFERENCES public.circle_proposals(id) ON DELETE SET NULL,
  action          TEXT         NOT NULL,
  admin_user_id   UUID         REFERENCES public.profiles(id) ON DELETE SET NULL,
  details         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circle_audit_log_circle
  ON public.circle_audit_log(circle_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_circle_audit_log_proposal
  ON public.circle_audit_log(proposal_id)
  WHERE proposal_id IS NOT NULL;

ALTER TABLE public.circle_audit_log ENABLE ROW LEVEL SECURITY;

-- Members can SELECT rows for circles they belong to. Writes are
-- service-role only (no INSERT/UPDATE/DELETE policies).
DROP POLICY IF EXISTS "Members can view audit log of their circle" ON public.circle_audit_log;
CREATE POLICY "Members can view audit log of their circle"
  ON public.circle_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
        FROM public.circle_members
       WHERE circle_id = circle_audit_log.circle_id
         AND user_id = auth.uid()
         AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "Service role full access" ON public.circle_audit_log;
CREATE POLICY "Service role full access"
  ON public.circle_audit_log
  FOR ALL
  USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. notify_proposal_state_change trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_proposal_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
  v_existing_id UUID;
  v_recipient   RECORD;
  v_fire_open   BOOLEAN := FALSE;
  v_fire_close  BOOLEAN := FALSE;
  v_result_label TEXT;
BEGIN
  -- Decide which fan-out to run.
  --   * INSERT with status='open' (e.g. C.4 auto-create path) → open.
  --   * UPDATE OF status transitioning to 'open' from anything else → open.
  --   * UPDATE OF status transitioning to 'closed' → resolved.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'open' THEN
      v_fire_open := TRUE;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status = 'open' AND COALESCE(OLD.status, '') <> 'open' THEN
      v_fire_open := TRUE;
    ELSIF NEW.status = 'closed' AND COALESCE(OLD.status, '') <> 'closed' THEN
      v_fire_close := TRUE;
    END IF;
  END IF;

  IF NOT v_fire_open AND NOT v_fire_close THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');

  -- ─── proposal_open → every active circle member ─────────────────────────
  IF v_fire_open THEN
    FOR v_recipient IN
      SELECT user_id
        FROM public.circle_members
       WHERE circle_id = NEW.circle_id
         AND status = 'active'
    LOOP
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'proposal_open'
         AND data->>'proposal_id' = NEW.id::text
         AND data->>'status' = 'open'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'proposal_open',
          'New proposal: ' || COALESCE(NEW.title, 'Untitled'),
          'A new proposal "' || COALESCE(NEW.title, 'Untitled')
            || '" is open for voting in ' || v_circle_name || '.',
          jsonb_build_object(
            'proposal_id',     NEW.id,
            'status',          'open',
            'circle_id',       NEW.circle_id,
            'circle_name',     v_circle_name,
            'proposal_title',  NEW.title,
            'proposal_type',   NEW.proposal_type,
            'voting_ends_at',  NEW.voting_ends_at,
            'i18n_title_key',  'voting.notification_proposal_open_title',
            'i18n_body_key',   'voting.notification_proposal_open_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;
  END IF;

  -- ─── proposal_resolved → proposer + voters ──────────────────────────────
  IF v_fire_close THEN
    -- Map engine result enum to a sentence-cased label for the notification.
    v_result_label := CASE NEW.result
      WHEN 'approved'  THEN 'approved'
      WHEN 'rejected'  THEN 'rejected'
      WHEN 'no_quorum' THEN 'closed without quorum'
      ELSE COALESCE(NEW.result, 'closed')
    END;

    -- Proposer first.
    IF NEW.proposer_id IS NOT NULL THEN
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = NEW.proposer_id
         AND type = 'proposal_resolved'
         AND data->>'proposal_id' = NEW.id::text
         AND data->>'status' = 'closed'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          NEW.proposer_id,
          'proposal_resolved',
          'Proposal ' || v_result_label || ': ' || COALESCE(NEW.title, 'Untitled'),
          'The proposal "' || COALESCE(NEW.title, 'Untitled')
            || '" in ' || v_circle_name || ' was ' || v_result_label || '.',
          jsonb_build_object(
            'proposal_id',     NEW.id,
            'status',          'closed',
            'result',          NEW.result,
            'executed_at',     NEW.executed_at,
            'circle_id',       NEW.circle_id,
            'circle_name',     v_circle_name,
            'proposal_title',  NEW.title,
            'proposal_type',   NEW.proposal_type,
            'recipient_role',  'proposer',
            'i18n_title_key',  'voting.notification_proposal_resolved_title',
            'i18n_body_key',   'voting.notification_proposal_resolved_body'
          ),
          FALSE
        );
      END IF;
    END IF;

    -- Voters (skip the proposer to avoid a double-notify).
    FOR v_recipient IN
      SELECT DISTINCT voter_id AS user_id
        FROM public.circle_proposal_votes
       WHERE proposal_id = NEW.id
    LOOP
      IF v_recipient.user_id = NEW.proposer_id THEN
        CONTINUE;
      END IF;
      SELECT id INTO v_existing_id
        FROM public.notifications
       WHERE user_id = v_recipient.user_id
         AND type = 'proposal_resolved'
         AND data->>'proposal_id' = NEW.id::text
         AND data->>'status' = 'closed'
       LIMIT 1;
      IF v_existing_id IS NULL THEN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_recipient.user_id,
          'proposal_resolved',
          'Proposal ' || v_result_label || ': ' || COALESCE(NEW.title, 'Untitled'),
          'The proposal "' || COALESCE(NEW.title, 'Untitled')
            || '" in ' || v_circle_name || ' was ' || v_result_label || '.',
          jsonb_build_object(
            'proposal_id',     NEW.id,
            'status',          'closed',
            'result',          NEW.result,
            'executed_at',     NEW.executed_at,
            'circle_id',       NEW.circle_id,
            'circle_name',     v_circle_name,
            'proposal_title',  NEW.title,
            'proposal_type',   NEW.proposal_type,
            'recipient_role',  'voter',
            'i18n_title_key',  'voting.notification_proposal_resolved_title',
            'i18n_body_key',   'voting.notification_proposal_resolved_body'
          ),
          FALSE
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'notify_proposal_state_change failed for proposal %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_proposals_state_notify ON public.circle_proposals;
CREATE TRIGGER circle_proposals_state_notify
  AFTER INSERT OR UPDATE OF status ON public.circle_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_proposal_state_change();


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. execute_approved_proposal trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.execute_approved_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_auto         BOOLEAN := FALSE;
  v_payload      JSONB;
  v_rule         TEXT;
  v_value        TEXT;
  v_cm_id        UUID;
  v_member_id    UUID;
  v_in_flight    BOOLEAN := FALSE;
  v_audit_action TEXT := 'proposal_executed';
BEGIN
  -- Only act on transitions into closed+approved.
  IF NEW.status <> 'closed' THEN RETURN NEW; END IF;
  IF NEW.result <> 'approved' THEN RETURN NEW; END IF;
  IF NEW.executed_at IS NOT NULL THEN RETURN NEW; END IF; -- idempotent
  IF OLD.status = 'closed' AND OLD.result = 'approved' THEN RETURN NEW; END IF;

  -- Governance gate.
  SELECT COALESCE(auto_execute_approved, FALSE)
    INTO v_auto
    FROM public.circle_governance_settings
   WHERE circle_id = NEW.circle_id;
  v_auto := COALESCE(v_auto, FALSE);
  IF NOT v_auto THEN
    RETURN NEW;
  END IF;

  v_payload := COALESCE(NEW.proposal_payload, '{}'::jsonb);

  -- ─── admit_member ────────────────────────────────────────────────────────
  IF NEW.proposal_type = 'admit_member' THEN
    v_cm_id := NULLIF(v_payload->>'circle_member_id', '')::UUID;
    v_member_id := NULLIF(v_payload->>'member_id', '')::UUID;
    IF v_cm_id IS NOT NULL THEN
      UPDATE public.circle_members
         SET status = 'active'
       WHERE id = v_cm_id
         AND status = 'pending';
    ELSIF v_member_id IS NOT NULL THEN
      -- Manual path: caller stamped a profiles.id. Insert if not already
      -- a member; otherwise flip pending → active.
      INSERT INTO public.circle_members (circle_id, user_id, role, status, joined_at)
      VALUES (NEW.circle_id, v_member_id, 'member', 'active', NOW())
      ON CONFLICT (circle_id, user_id) DO UPDATE
        SET status   = 'active',
            joined_at = COALESCE(public.circle_members.joined_at, NOW());
    ELSE
      v_audit_action := 'proposal_execution_skipped';
    END IF;

  -- ─── remove_member ───────────────────────────────────────────────────────
  ELSIF NEW.proposal_type = 'remove_member' THEN
    v_cm_id := NULLIF(v_payload->>'circle_member_id', '')::UUID;
    v_member_id := NULLIF(v_payload->>'member_id', '')::UUID;
    IF v_cm_id IS NOT NULL THEN
      UPDATE public.circle_members
         SET status     = 'removed',
             exited_at  = NOW(),
             exit_reason = COALESCE(v_payload->>'reason', 'Removed via proposal')
       WHERE id = v_cm_id;
    ELSIF v_member_id IS NOT NULL THEN
      UPDATE public.circle_members
         SET status     = 'removed',
             exited_at  = NOW(),
             exit_reason = COALESCE(v_payload->>'reason', 'Removed via proposal')
       WHERE circle_id = NEW.circle_id
         AND user_id   = v_member_id;
    ELSE
      v_audit_action := 'proposal_execution_skipped';
    END IF;

  -- ─── change_rules ────────────────────────────────────────────────────────
  ELSIF NEW.proposal_type = 'change_rules' THEN
    v_rule  := v_payload->>'rule';
    v_value := v_payload->>'value';
    IF v_rule = 'contribution' AND v_value IS NOT NULL THEN
      UPDATE public.circles
         SET amount     = v_value::NUMERIC,
             updated_at = NOW()
       WHERE id = NEW.circle_id;
    ELSIF v_rule = 'grace_period' AND v_value IS NOT NULL THEN
      UPDATE public.circles
         SET grace_period_days = v_value::INTEGER,
             updated_at        = NOW()
       WHERE id = NEW.circle_id;
    ELSIF v_rule = 'frequency' AND v_value IS NOT NULL THEN
      UPDATE public.circles
         SET frequency              = v_value,
             contribution_frequency = v_value,
             updated_at             = NOW()
       WHERE id = NEW.circle_id;
    ELSE
      v_audit_action := 'proposal_execution_skipped';
    END IF;

  -- ─── change_payout_order ─────────────────────────────────────────────────
  -- The DynamicPayoutOrderingEngine callback already mutates the order on
  -- early close from the engine path. Cron-closed proposals just stamp
  -- executed_at; a future bucket can add a DB-side reorder. We still
  -- record the audit row so members can see the approval landed.
  ELSIF NEW.proposal_type = 'change_payout_order' THEN
    v_audit_action := 'proposal_executed_pending_order_update';

  -- ─── dissolve_circle ─────────────────────────────────────────────────────
  -- Defensive guard: if any funds are still in play, do NOT flip the
  -- circle status. Stamp result_reason for the UI and SKIP executed_at so
  -- the result chip renders "Pending execution" instead of "Executed".
  ELSIF NEW.proposal_type = 'dissolve_circle' THEN
    -- Pool balance > 0?
    SELECT EXISTS (
      SELECT 1 FROM public.insurance_pool
       WHERE circle_id = NEW.circle_id AND COALESCE(balance_cents, 0) > 0
    ) INTO v_in_flight;
    IF NOT v_in_flight THEN
      SELECT EXISTS (
        SELECT 1 FROM public.contributions
         WHERE circle_id = NEW.circle_id
           AND COALESCE(status::text, '') NOT IN ('paid', 'reversed', 'cancelled', 'refunded')
      ) INTO v_in_flight;
    END IF;
    IF v_in_flight THEN
      UPDATE public.circle_proposals
         SET result_reason = COALESCE(result_reason, '')
                             || CASE WHEN result_reason IS NULL OR result_reason = ''
                                     THEN '' ELSE E'\n' END
                             || 'Cannot dissolve while funds are in play — full dissolution flow coming in Bucket D.'
       WHERE id = NEW.id;
      -- Audit + early return so we don't stamp executed_at below.
      BEGIN
        INSERT INTO public.circle_audit_log (circle_id, proposal_id, action, admin_user_id, details)
        VALUES (NEW.circle_id, NEW.id, 'proposal_execution_blocked', NULL,
                jsonb_build_object('reason', 'dissolve_funds_in_flight', 'proposal_type', NEW.proposal_type));
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'audit log insert failed (blocked): %', SQLERRM;
      END;
      RETURN NEW;
    END IF;
    UPDATE public.circles
       SET status     = 'dissolved',
           updated_at = NOW()
     WHERE id = NEW.circle_id;

  -- ─── custom — no side effects, just stamp ─────────────────────────────
  ELSIF NEW.proposal_type = 'custom' THEN
    v_audit_action := 'proposal_executed_noop';
  END IF;

  -- Stamp execution + flip status to executed.
  UPDATE public.circle_proposals
     SET executed_at = NOW(),
         status      = 'executed'
   WHERE id = NEW.id;

  -- Audit row.
  BEGIN
    INSERT INTO public.circle_audit_log (circle_id, proposal_id, action, admin_user_id, details)
    VALUES (
      NEW.circle_id,
      NEW.id,
      v_audit_action,
      NULL,
      jsonb_build_object('proposal_type', NEW.proposal_type, 'payload', v_payload)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'audit log insert failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'execute_approved_proposal failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_proposals_auto_execute ON public.circle_proposals;
CREATE TRIGGER circle_proposals_auto_execute
  AFTER UPDATE OF status ON public.circle_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.execute_approved_proposal();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. auto_create_admit_member_proposal trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_create_admit_member_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_require   BOOLEAN := FALSE;
  v_quorum    NUMERIC;
  v_threshold NUMERIC;
  v_voting_h  INTEGER;
  v_eligible  INTEGER;
  v_name      TEXT;
BEGIN
  -- Only react to fresh pending rows; ignore status flips into pending
  -- on existing rows so a removed-and-re-added member doesn't churn.
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- Governance gate.
  SELECT COALESCE(require_member_approval, FALSE),
         COALESCE(default_quorum_pct,     0.50),
         COALESCE(default_threshold_pct,  0.60),
         COALESCE(default_voting_hours,   72)
    INTO v_require, v_quorum, v_threshold, v_voting_h
    FROM public.circle_governance_settings
   WHERE circle_id = NEW.circle_id;
  IF NOT v_require THEN
    RETURN NEW;
  END IF;

  -- Don't double-create: if there's already an open admit_member proposal
  -- for this circle_member, skip.
  IF EXISTS (
    SELECT 1 FROM public.circle_proposals
     WHERE circle_id = NEW.circle_id
       AND proposal_type = 'admit_member'
       AND status IN ('draft', 'open')
       AND proposal_payload->>'circle_member_id' = NEW.id::text
  ) THEN
    RETURN NEW;
  END IF;

  -- Eligible voters = active members at proposal-open time.
  SELECT COUNT(*) INTO v_eligible
    FROM public.circle_members
   WHERE circle_id = NEW.circle_id AND status = 'active';

  -- Display name for the title.
  SELECT COALESCE(full_name, 'a new member') INTO v_name
    FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.circle_proposals (
    circle_id, proposer_id, proposal_type, title, description,
    proposal_payload, status, voting_starts_at, voting_ends_at,
    quorum_pct, threshold_pct, eligible_voters
  )
  VALUES (
    NEW.circle_id,
    NEW.user_id,                            -- self-proposed
    'admit_member',
    'Admit ' || v_name || ' to the circle',
    NULL,
    jsonb_build_object(
      'circle_member_id', NEW.id,
      'member_id',        NEW.user_id,
      'auto_created',     TRUE
    ),
    'open',
    NOW(),
    NOW() + (v_voting_h || ' hours')::INTERVAL,
    v_quorum,
    v_threshold,
    v_eligible
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'auto_create_admit_member_proposal failed for member %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_members_auto_admit_proposal ON public.circle_members;
CREATE TRIGGER circle_members_auto_admit_proposal
  AFTER INSERT OR UPDATE OF status ON public.circle_members
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_admit_member_proposal();


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. pg_cron — close_expired_proposals every 2 hours
-- ─────────────────────────────────────────────────────────────────────────────
SELECT cron.unschedule('close_expired_proposals_every_2h')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'close_expired_proposals_every_2h'
 );

SELECT cron.schedule(
  'close_expired_proposals_every_2h',
  '0 */2 * * *',
  $$SELECT public.close_expired_proposals();$$
);


-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '211',
  'voting_automation',
  ARRAY['-- 211: voting_automation']
)
ON CONFLICT (version) DO NOTHING;
