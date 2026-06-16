-- ============================================================================
-- Migration 161: Conflict Resolution P2 (Automation & Learning)
-- ============================================================================
-- Three pieces:
--
--   1. dispute_cases.auto_created BOOLEAN, escalation_tier TEXT
--      auto_created lets the frontend render a system-generated pill;
--      escalation_tier (NULL / 'elder_l2' / 'global_queue') is the
--      priority routing field the daily escalate-stale-disputes Edge
--      Function will set. We keep `status` on the existing enum
--      (open / investigating / resolved / closed) so older readers
--      still understand the row.
--
--   2. Auto-create trigger on contributions AFTER UPDATE OF status.
--      When the row transitions into 'late' or 'missed' AND no open
--      auto-dispute already exists for the same contribution_id, we
--      insert one with dispute_type='missed_contribution',
--      auto_created=true, and a templated description.
--
--   3. Auto-resolve trigger on contributions AFTER UPDATE OF status.
--      When the row transitions into 'paid' AND an open auto missed-
--      contribution dispute exists for (circle_id, member_id), we
--      resolve it and drop a system circle_messages row so the
--      affected member sees what just happened.
--
-- DISCOVERY NOTE: the spec mentions a unified `circle_conflicts` or
-- `disputes` table. Live schema has `dispute_cases` (wired in the app)
-- and a `disputes` table (orphan from earlier work, not consumed by
-- any code). We use `dispute_cases` to match the existing surface.
--
-- complainant_id is NOT NULL on dispute_cases. For auto rows we set it
-- to the affected member (NEW.member_id) — the system file the dispute,
-- and the frontend renders auto_created=true so the UI can mask the
-- "self-complainant" weirdness.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. dispute_cases columns
-- ----------------------------------------------------------------------------
ALTER TABLE public.dispute_cases
  ADD COLUMN IF NOT EXISTS auto_created BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.dispute_cases
  ADD COLUMN IF NOT EXISTS escalation_tier TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dispute_cases_escalation_tier_chk'
  ) THEN
    ALTER TABLE public.dispute_cases
      ADD CONSTRAINT dispute_cases_escalation_tier_chk
      CHECK (escalation_tier IS NULL OR escalation_tier IN ('elder_l2','global_queue'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dispute_cases_status_updated
  ON public.dispute_cases(status, updated_at DESC);

-- Partial index can't reference `status::TEXT = 'open'` because the
-- enum cast isn't IMMUTABLE. Drop the WHERE clause; the regular two-
-- column index still narrows scans to (circle, member) lookups that
-- the auto-resolve trigger does.
CREATE INDEX IF NOT EXISTS idx_dispute_cases_auto_open
  ON public.dispute_cases(circle_id, respondent_id)
  WHERE auto_created = TRUE;

COMMENT ON COLUMN public.dispute_cases.auto_created IS
  'P2: true when the row was inserted by the contributions auto-dispute '
  'trigger rather than by a user clicking "report". UI uses it to render '
  'an "AUTO" pill and skip the "complainant" attribution.';
COMMENT ON COLUMN public.dispute_cases.escalation_tier IS
  'P2: NULL by default; set by the escalate-stale-disputes Edge Function. '
  '''elder_l2'' = bumped after 48h of no elder activity. '
  '''global_queue'' = bumped after 7d of no resolution → routed to platform '
  'admins via the is_admin() audience.';


-- ----------------------------------------------------------------------------
-- 2. Auto-create trigger on contributions
-- ----------------------------------------------------------------------------
-- Fires on status transitions into ('late','missed'). Idempotent via a
-- per-contribution lookup keyed by description (we stamp the
-- contribution_id into description for now since dispute_cases has no
-- typed FK column for it; a future column would be cleaner).
CREATE OR REPLACE FUNCTION public.contributions_auto_create_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_already BOOLEAN;
BEGIN
  -- Only react to real status changes into the "needs attention" buckets.
  IF NEW.status::TEXT NOT IN ('late','missed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status::TEXT = NEW.status::TEXT THEN
    RETURN NEW;
  END IF;

  -- Avoid duplicate rows when a contribution flips late → missed.
  SELECT EXISTS (
    SELECT 1 FROM public.dispute_cases
     WHERE auto_created = TRUE
       AND dispute_type = 'missed_contribution'
       AND respondent_id = NEW.member_id
       AND circle_id     = NEW.circle_id
       AND description LIKE '%contribution_id=' || NEW.id::TEXT || '%'
  ) INTO v_already;
  IF v_already THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.dispute_cases (
    circle_id,
    complainant_id,
    respondent_id,
    dispute_type,
    status,
    description,
    auto_created
  )
  VALUES (
    NEW.circle_id,
    NEW.member_id,                              -- system files on behalf of the member
    NEW.member_id,
    'missed_contribution',
    'open',
    'Auto: contribution due ' || COALESCE(NEW.due_date::TEXT, 'unknown')
      || ' was flagged as ' || NEW.status::TEXT
      || ' (contribution_id=' || NEW.id::TEXT || ')',
    TRUE
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS contributions_auto_create_dispute ON public.contributions;
CREATE TRIGGER contributions_auto_create_dispute
  AFTER UPDATE OF status ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.contributions_auto_create_dispute();

COMMENT ON FUNCTION public.contributions_auto_create_dispute IS
  'AFTER UPDATE OF status on contributions. On transitions into late/missed, '
  'inserts an auto-created dispute_cases row (idempotent per contribution_id).';


-- ----------------------------------------------------------------------------
-- 3. Auto-resolve trigger on contributions
-- ----------------------------------------------------------------------------
-- Mirror direction: when the contribution flips to 'paid', resolve any
-- still-open auto missed-contribution dispute for the same circle_id +
-- member_id. Drops a system row in circle_messages so the affected
-- member sees the resolution announcement (existing UX pattern from
-- Phase 2 of the circle chat).
CREATE OR REPLACE FUNCTION public.contributions_auto_resolve_dispute()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_dispute_id UUID;
BEGIN
  IF NEW.status::TEXT <> 'paid' OR OLD.status::TEXT = 'paid' THEN
    RETURN NEW;
  END IF;

  -- Pick the oldest still-open auto dispute for the same (circle, member).
  -- Limit 1 — one paid contribution closes at most one open auto-dispute.
  UPDATE public.dispute_cases
     SET status      = 'resolved',
         resolution  = COALESCE(resolution, '')
                       || CASE WHEN resolution IS NULL OR resolution = ''
                               THEN '' ELSE E'\n' END
                       || 'Auto-resolved: payment recorded ' || now()::TEXT,
         resolved_at = now(),
         updated_at  = now()
   WHERE id = (
     SELECT id FROM public.dispute_cases
      WHERE auto_created = TRUE
        AND dispute_type = 'missed_contribution'
        AND status::TEXT = 'open'
        AND circle_id    = NEW.circle_id
        AND respondent_id = NEW.member_id
      ORDER BY created_at ASC
      LIMIT 1
   )
   RETURNING id INTO v_dispute_id;

  IF v_dispute_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Best-effort circle_messages system row. Failure here mustn't roll
  -- back the dispute resolve, so wrap in EXCEPTION + log.
  BEGIN
    INSERT INTO public.circle_messages (
      circle_id, user_id, body, message_type
    )
    VALUES (
      NEW.circle_id,
      NEW.member_id,
      'Dispute resolved — payment received.',
      'system'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'auto-resolve system message insert failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS contributions_auto_resolve_dispute ON public.contributions;
CREATE TRIGGER contributions_auto_resolve_dispute
  AFTER UPDATE OF status ON public.contributions
  FOR EACH ROW EXECUTE FUNCTION public.contributions_auto_resolve_dispute();

COMMENT ON FUNCTION public.contributions_auto_resolve_dispute IS
  'AFTER UPDATE OF status on contributions. On transitions into paid, '
  'resolves the oldest open auto missed-contribution dispute for the same '
  'circle + member and drops a system circle_messages row.';


-- ----------------------------------------------------------------------------
-- 4. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '161',
  'conflict_resolution_p2',
  ARRAY['-- 161: dispute_cases.auto_created/escalation_tier + auto-create/auto-resolve triggers']
)
ON CONFLICT (version) DO NOTHING;
