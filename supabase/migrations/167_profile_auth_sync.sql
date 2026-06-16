-- 167_profile_auth_sync.sql
-- =====================================================================
-- P2 of the View / edit profile review.
--
-- Two changes:
--
--   1. ADD COLUMN profiles.phone_verified BOOLEAN DEFAULT FALSE.
--      Set true after the OTP success on a phone change initiated from
--      the profile screen. Drives the "Verified" badge in the UI.
--
--   2. CREATE FUNCTION + TRIGGER trg_sync_profile_to_auth.
--      With P2 we collapse the writer surface: PersonalInfoScreen,
--      ProfileScreen and AuthContext.updateProfile all write to
--      `profiles` and nothing else. The trigger keeps auth.users in
--      sync so callers that read user_metadata (RPCs, Edge Functions,
--      anything still using auth.users.phone) don't break.
--
--      What is synced:
--        full_name  →  auth.users.raw_user_meta_data->>'name'
--                   (and also 'full_name' inside the same JSONB to
--                   match what the existing app code already wrote.)
--        phone      →  auth.users.phone
--
--      What is NOT synced (intentionally):
--        email      →  email changes belong to
--                      supabase.auth.updateUser({ email }), which
--                      triggers Supabase's own confirmation flow.
--                      Updating auth.users.email directly here would
--                      bypass that and create a "verified" address
--                      the user never clicked a link for. So we leave
--                      it alone; the reverse direction (auth → profile)
--                      is handled by an existing on_auth_user_created
--                      trigger and Supabase's email confirmation
--                      callback that fires the public.profiles
--                      seeder.
--
-- Idempotent: every DDL guarded with IF NOT EXISTS / OR REPLACE.
-- Self-registers at the bottom.
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_existing_meta JSONB;
  v_new_meta JSONB;
  v_should_update_meta BOOLEAN := FALSE;
  v_should_update_phone BOOLEAN := FALSE;
BEGIN
  -- Fast bail-out: nothing relevant changed.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.full_name IS NOT DISTINCT FROM OLD.full_name
       AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN
      RETURN NEW;
    END IF;
  END IF;

  -- full_name → auth.users.raw_user_meta_data
  -- Merge into the existing JSONB rather than overwriting, so other
  -- metadata the app writes (xn_score, kyc_level, etc.) survives.
  IF NEW.full_name IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.full_name IS DISTINCT FROM OLD.full_name) THEN
    SELECT COALESCE(raw_user_meta_data, '{}'::jsonb)
      INTO v_existing_meta
      FROM auth.users
      WHERE id = NEW.id;
    v_new_meta := v_existing_meta
      || jsonb_build_object('name', NEW.full_name, 'full_name', NEW.full_name);
    v_should_update_meta := TRUE;
  END IF;

  -- phone → auth.users.phone
  IF (TG_OP = 'INSERT' OR NEW.phone IS DISTINCT FROM OLD.phone) THEN
    v_should_update_phone := TRUE;
  END IF;

  IF v_should_update_meta AND v_should_update_phone THEN
    UPDATE auth.users
       SET raw_user_meta_data = v_new_meta,
           phone = NEW.phone
     WHERE id = NEW.id;
  ELSIF v_should_update_meta THEN
    UPDATE auth.users
       SET raw_user_meta_data = v_new_meta
     WHERE id = NEW.id;
  ELSIF v_should_update_phone THEN
    UPDATE auth.users
       SET phone = NEW.phone
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_to_auth ON public.profiles;
CREATE TRIGGER trg_sync_profile_to_auth
AFTER INSERT OR UPDATE OF full_name, phone ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_auth();

-- Self-register. Idempotent via ON CONFLICT.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '167',
  'profile_auth_sync',
  ARRAY['-- 167: profile_auth_sync']
)
ON CONFLICT (version) DO NOTHING;
