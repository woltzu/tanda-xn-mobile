-- ════════════════════════════════════════════════════════════════════════════
-- Migration 195: provider_verification_progression
-- ════════════════════════════════════════════════════════════════════════════
-- Maintains providers.verification_level + verification_status
-- automatically based on the completed step rows in
-- provider_verification_steps. Phase 1C.
--
-- Rules — verification_level = the highest level whose required steps are
-- all 'completed':
--   Level 1 (Basic)     — elder_endorsement completed
--   Level 2 (Standard)  — elder + document_upload completed
--   Level 3 (Premium)   — elder + document_upload + admin_site_visit completed
--
-- verification_status is set to 'verified' the first time the provider
-- reaches level >= 1. It is NEVER demoted by this trigger — verified
-- providers stay verified even if a step row is deleted, because they've
-- already been seen by users in the public list. The verification_status
-- can only flip back to 'rejected' by an explicit admin UPDATE.
--
-- Notifications:
--   INSERT of step with status in ('pending','in_progress'):
--     - document_upload  → notify every active admin (provider_document_upload)
--     - admin_site_visit → notify every active admin (provider_site_visit_request)
--   UPDATE of step.status (any → completed/rejected): notify the provider
--     (provider_verification_update). If the UPDATE also bumps the
--     verification_level, an additional notification fires
--     (provider_verification_upgraded).
--
-- All notifications swallow on failure via the EXCEPTION sub-block so a
-- step UPDATE can't be rolled back by a notification write failure.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.recompute_provider_verification_level(
  p_provider_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_elder BOOLEAN;
  v_has_docs BOOLEAN;
  v_has_visit BOOLEAN;
  v_old_level INT;
  v_new_level INT;
  v_old_status public.provider_verification_status_enum;
BEGIN
  SELECT verification_level, verification_status
    INTO v_old_level, v_old_status
    FROM public.providers
   WHERE id = p_provider_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT
    bool_or(step_type = 'elder_endorsement' AND status = 'completed'),
    bool_or(step_type = 'document_upload'    AND status = 'completed'),
    bool_or(step_type = 'admin_site_visit'   AND status = 'completed')
    INTO v_has_elder, v_has_docs, v_has_visit
    FROM public.provider_verification_steps
   WHERE provider_id = p_provider_id;

  v_has_elder := COALESCE(v_has_elder, FALSE);
  v_has_docs  := COALESCE(v_has_docs, FALSE);
  v_has_visit := COALESCE(v_has_visit, FALSE);

  v_new_level := CASE
    WHEN v_has_elder AND v_has_docs AND v_has_visit THEN 3
    WHEN v_has_elder AND v_has_docs THEN 2
    WHEN v_has_elder THEN 1
    ELSE COALESCE(v_old_level, 1)
  END;

  -- Promote-only — never demote a previously verified provider just because
  -- a row was deleted. Status flips to 'verified' as soon as any level is
  -- reached, but a rejected provider remains rejected until an admin
  -- intervenes manually.
  IF v_new_level > COALESCE(v_old_level, 0) OR v_old_status = 'pending' THEN
    UPDATE public.providers
       SET verification_level = GREATEST(v_new_level, COALESCE(verification_level, 1)),
           verification_status = CASE
             WHEN v_old_status = 'rejected' THEN 'rejected'::public.provider_verification_status_enum
             WHEN v_has_elder THEN 'verified'::public.provider_verification_status_enum
             ELSE verification_status
           END,
           verified_at = CASE
             WHEN v_old_status <> 'verified' AND v_has_elder THEN now()
             ELSE verified_at
           END,
           updated_at = now()
     WHERE id = p_provider_id;
  END IF;

  RETURN v_new_level;
END;
$$;


CREATE OR REPLACE FUNCTION public.notify_provider_verification_step()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider RECORD;
  v_admin RECORD;
  v_step_label TEXT;
  v_new_level INT;
  v_prev_level INT;
BEGIN
  -- Skip if nothing relevant changed on UPDATE.
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT id, user_id, business_name, verification_level
    INTO v_provider
    FROM public.providers
   WHERE id = NEW.provider_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_step_label := CASE NEW.step_type::text
    WHEN 'document_upload' THEN 'document upload'
    WHEN 'admin_site_visit' THEN 'site visit'
    WHEN 'elder_endorsement' THEN 'elder endorsement'
    ELSE 'verification step'
  END;

  -- ─── Admin fan-out on new pending/in-progress request ─────────────
  IF TG_OP = 'INSERT'
     AND NEW.status IN ('pending', 'in_progress')
     AND NEW.step_type IN ('document_upload', 'admin_site_visit') THEN
    FOR v_admin IN
      SELECT user_id FROM public.admin_users WHERE is_active = TRUE
    LOOP
      BEGIN
        INSERT INTO public.notifications (user_id, type, title, body, data, read)
        VALUES (
          v_admin.user_id,
          CASE NEW.step_type::text
            WHEN 'document_upload' THEN 'provider_document_upload'
            ELSE 'provider_site_visit_request'
          END,
          'Provider verification step pending',
          v_provider.business_name || ' is awaiting ' || v_step_label || ' review.',
          jsonb_build_object(
            'provider_id', v_provider.id,
            'step_id', NEW.id,
            'step_type', NEW.step_type::text
          ),
          FALSE
        );
      EXCEPTION WHEN OTHERS THEN
        -- Per-admin failure is non-fatal — the rest of the fan-out
        -- continues so a stuck row doesn't block the whole notification.
        NULL;
      END;
    END LOOP;
  END IF;

  -- ─── Provider notification on completion / rejection ──────────────
  IF TG_OP = 'UPDATE' AND NEW.status IN ('completed', 'rejected') THEN
    v_prev_level := v_provider.verification_level;

    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_provider.user_id,
        'provider_verification_update',
        CASE WHEN NEW.status = 'completed'
             THEN 'Verification step approved'
             ELSE 'Verification step rejected'
        END,
        CASE WHEN NEW.status = 'completed'
             THEN 'Your ' || v_step_label || ' has been approved.'
             ELSE 'Your ' || v_step_label || ' was not approved. ' || COALESCE(NEW.notes, 'Reach out to support for details.')
        END,
        jsonb_build_object(
          'provider_id', v_provider.id,
          'step_id', NEW.id,
          'step_type', NEW.step_type::text,
          'status', NEW.status::text
        ),
        FALSE
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- Run the recompute. If it bumps the level, fire a second notification.
    IF NEW.status = 'completed' THEN
      v_new_level := public.recompute_provider_verification_level(NEW.provider_id);
      IF v_new_level IS NOT NULL AND v_new_level > COALESCE(v_prev_level, 0) THEN
        BEGIN
          INSERT INTO public.notifications (user_id, type, title, body, data, read)
          VALUES (
            v_provider.user_id,
            'provider_verification_upgraded',
            'You reached Level ' || v_new_level::text,
            'Congratulations — your provider listing is now at verification Level ' || v_new_level::text || '.',
            jsonb_build_object(
              'provider_id', v_provider.id,
              'old_level', v_prev_level,
              'new_level', v_new_level
            ),
            FALSE
          );
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS provider_verification_steps_notify
  ON public.provider_verification_steps;
CREATE TRIGGER provider_verification_steps_notify
  AFTER INSERT OR UPDATE OF status ON public.provider_verification_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_verification_step();


-- ─── Backfill verification_status for existing rows ────────────────────────
-- The Phase 1A trigger that created the elder_endorsement step doesn't
-- bump verification_status — apply now ran on a Cron-completed step
-- only. Make sure any existing rows that already cleared elder are
-- promoted now.
UPDATE public.providers p
   SET verification_status = 'verified',
       verified_at = COALESCE(p.verified_at, now()),
       updated_at = now()
  WHERE p.verification_status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.provider_verification_steps s
       WHERE s.provider_id = p.id
         AND s.step_type = 'elder_endorsement'
         AND s.status = 'completed'
    );

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '195',
  'provider_verification_progression',
  ARRAY['-- 195: provider_verification_progression']
)
ON CONFLICT (version) DO NOTHING;
