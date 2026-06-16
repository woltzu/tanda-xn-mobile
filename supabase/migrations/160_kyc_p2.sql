-- ============================================================================
-- Migration 160: KYC P2 (Automation & Learning)
-- ============================================================================
-- Three pieces:
--
--   1. kyc_verifications.last_reminded_at  — anchor for a future
--      "re-upload your documents" reminder cron. The status-change
--      trigger below sets it when the row transitions to a failure
--      state so we know when the user was last nudged.
--
--   2. kyc_reason_humanize(rejection_code) — small SQL helper that
--      maps Persona-style codes to a bounded UX bucket the frontend
--      can render specific copy against ('image_quality_low' /
--      'id_expired' / 'face_mismatch' / 'other'). Used by the trigger
--      to pick the notification body and by the React screen to pick
--      the inline instruction line.
--
--   3. AFTER UPDATE OF status trigger on kyc_verifications. Fires only
--      on a real change (OLD.status IS DISTINCT FROM NEW.status) AND
--      only when the new status is one of the three terminals we
--      care about (approved / rejected / expired). Idempotent by
--      construction — every transition writes one row.
--
-- DISCOVERY NOTE: the spec called for a `failure_reason TEXT` column,
-- but `rejection_reason TEXT` and `rejection_code TEXT` already exist
-- on kyc_verifications (the Persona pipeline writes to them). We reuse
-- those instead of adding a duplicate column, and the humanize() helper
-- bridges code → UI bucket.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. kyc_verifications.last_reminded_at
-- ----------------------------------------------------------------------------
ALTER TABLE public.kyc_verifications
  ADD COLUMN IF NOT EXISTS last_reminded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.kyc_verifications.last_reminded_at IS
  'KYC P2 — last time we surfaced a "re-upload your documents" reminder '
  'to the user. Set by the rejection branch of the status-change trigger '
  'so future reminder cron knows the last nudge.';


-- ----------------------------------------------------------------------------
-- 2. kyc_reason_humanize helper
-- ----------------------------------------------------------------------------
-- Pure mapping function. STRICT IMMUTABLE so PostgreSQL can inline /
-- cache it. The bounded set keeps the FE i18n table tight.
CREATE OR REPLACE FUNCTION public.kyc_reason_humanize(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
  SELECT CASE
    WHEN p_code IS NULL                              THEN NULL
    WHEN lower(p_code) IN (
      'image_quality_low','blurry','glare','low_resolution','low_quality'
    )                                                THEN 'image_quality_low'
    WHEN lower(p_code) IN (
      'id_expired','document_expired','expired'
    )                                                THEN 'id_expired'
    WHEN lower(p_code) IN (
      'face_mismatch','selfie_mismatch','no_face_detected'
    )                                                THEN 'face_mismatch'
    ELSE 'other'
  END;
$function$;

REVOKE EXECUTE ON FUNCTION public.kyc_reason_humanize(TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.kyc_reason_humanize(TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.kyc_reason_humanize IS
  'Maps a Persona-style rejection_code to a small bounded set the UI '
  'can render specific instructions against. Returns NULL when the '
  'input is NULL; "other" when the code doesn''t match a known bucket.';


-- ----------------------------------------------------------------------------
-- 3. Status-change notification trigger
-- ----------------------------------------------------------------------------
-- AFTER UPDATE OF status. Fires once per real transition into one of
-- the three terminal states. Body content branches on the new status
-- and (for rejections) on the humanized reason.
CREATE OR REPLACE FUNCTION public.notify_kyc_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_bucket   TEXT;
  v_title    TEXT;
  v_body     TEXT;
BEGIN
  -- Defensive: skip when status didn't actually change. The UPDATE OF
  -- status guard above filters most no-op writes but not all of them
  -- (UPDATE … SET status = status still fires the trigger).
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('approved','rejected','expired') THEN
    RETURN NEW;
  END IF;

  v_bucket := public.kyc_reason_humanize(NEW.rejection_code);

  IF NEW.status = 'approved' THEN
    v_title := 'Identity verified';
    v_body  := 'Your identity has been verified. You can now send and receive money.';
  ELSIF NEW.status = 'expired' THEN
    v_title := 'Identity check expired';
    v_body  := 'Your identity check has expired. Please re-verify to keep using TandaXn.';
  ELSE
    -- rejected: pick body by humanized bucket
    v_title := 'Identity check needs another look';
    v_body  := CASE v_bucket
      WHEN 'image_quality_low' THEN
        'Your ID image was blurry. Please upload a clearer photo.'
      WHEN 'id_expired' THEN
        'Your ID document has expired. Upload a current ID to continue.'
      WHEN 'face_mismatch' THEN
        'The selfie didn''t match your ID. Try a well-lit photo facing the camera.'
      ELSE
        'We couldn''t verify your documents. Tap to see what to do next.'
    END;
    UPDATE public.kyc_verifications
       SET last_reminded_at = now()
     WHERE id = NEW.id;
  END IF;

  INSERT INTO public.notifications (
    user_id, type, title, body, data, read
  )
  VALUES (
    NEW.member_id,
    'kyc_' || NEW.status,
    v_title,
    v_body,
    jsonb_build_object(
      'kyc_id', NEW.id,
      'status', NEW.status,
      'rejection_code', NEW.rejection_code,
      'reason_bucket', v_bucket
    ),
    FALSE
  );

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS kyc_verifications_status_change ON public.kyc_verifications;
CREATE TRIGGER kyc_verifications_status_change
  AFTER UPDATE OF status ON public.kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_kyc_status_change();

COMMENT ON FUNCTION public.notify_kyc_status_change IS
  'AFTER UPDATE OF status. Drops one notifications row per real '
  'transition into approved/rejected/expired. Body branches on '
  'kyc_reason_humanize(rejection_code) so users see specific guidance '
  'rather than a generic "verification failed".';


-- ----------------------------------------------------------------------------
-- 4. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '160',
  'kyc_p2',
  ARRAY['-- 160: kyc_verifications.last_reminded_at + reason humanizer + status-change trigger']
)
ON CONFLICT (version) DO NOTHING;
