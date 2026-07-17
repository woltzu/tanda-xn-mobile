-- 352_auth_email_sync_to_profiles.sql
-- =====================================================================
-- Reverse-direction email sync — auth.users → public.profiles.
--
-- Mig 167 intentionally punted this direction (see its header lines
-- 24-35): "email is NOT synced; the reverse direction (auth →
-- profile) is handled by an existing on_auth_user_created trigger and
-- Supabase's email confirmation callback that fires the public.profiles
-- seeder." That's true for the SIGNUP path (on_auth_user_created is an
-- INSERT trigger).
--
-- What it doesn't cover: the EMAIL-CHANGE path. When a user updates
-- their email via supabase.auth.updateUser({ email }) and confirms via
-- the emailed link, Supabase updates auth.users.email and stamps
-- email_confirmed_at, but:
--
--   * on_auth_user_created is INSERT-only — it doesn't refire on
--     UPDATE, so profiles.email + profiles.email_verified stay stale.
--   * Mig 319 added profiles.email_verified BOOLEAN but explicitly
--     called the auth.users → profiles sync out of scope, so no code
--     currently writes to it after signup.
--
-- Result: the "Pending verification" pill in PersonalInfoScreen never
-- flips to "Verified", and profile-scoped reads of profiles.email
-- return the old address after a change.
--
-- This trigger closes the gap:
--
--   AFTER UPDATE OF email, email_confirmed_at ON auth.users
--   WHEN NEW.email IS DISTINCT FROM OLD.email
--        OR NEW.email_confirmed_at IS DISTINCT FROM OLD.email_confirmed_at
--   → UPDATE profiles
--       SET email          = NEW.email,
--           email_verified = (NEW.email_confirmed_at IS NOT NULL)
--     WHERE id = NEW.id;
--
-- Safety:
--   * SECURITY DEFINER so it can write to public.profiles.
--   * SET search_path locked to prevent shadow-schema attacks (matches
--     the pattern from mig 167 / 344 / 347).
--   * profiles.email column is expected to already exist (added way
--     back in the initial schema). If it doesn't we ADD COLUMN IF NOT
--     EXISTS defensively.
--   * Trigger DOES NOT fire on INSERT (on_auth_user_created already
--     handles that path).
--   * WHEN clause skips the write when neither field actually changed
--     — avoids trigger-loop noise on every auth.users bump.
--
-- Idempotent: DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION.
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.sync_auth_email_to_profile()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    UPDATE public.profiles
       SET email          = NEW.email,
           email_verified = (NEW.email_confirmed_at IS NOT NULL)
     WHERE id = NEW.id
       AND (
         email IS DISTINCT FROM NEW.email
         OR email_verified IS DISTINCT FROM (NEW.email_confirmed_at IS NOT NULL)
       );
  EXCEPTION WHEN OTHERS THEN
    -- Never let a profile-sync failure block the auth.users write.
    -- Log as WARNING so it shows in Supabase's postgres logs but the
    -- outer transaction commits.
    RAISE WARNING '[sync_auth_email_to_profile] failed for user %: %',
      NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_auth_email_to_profile ON auth.users;
CREATE TRIGGER trg_sync_auth_email_to_profile
AFTER UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (
  NEW.email IS DISTINCT FROM OLD.email
  OR NEW.email_confirmed_at IS DISTINCT FROM OLD.email_confirmed_at
)
EXECUTE FUNCTION public.sync_auth_email_to_profile();

-- ─── One-shot backfill ────────────────────────────────────────────────────
-- The trigger only fires on future UPDATEs. Existing rows that were
-- confirmed via the pre-mig-352 signup path have auth.users.email_confirmed_at
-- set but never got their profiles.email / profiles.email_verified
-- populated — mig 319 declared that sync out of scope. This one-shot
-- mirrors auth.users into profiles for anyone in drift. Idempotent via
-- the IS DISTINCT FROM guard, so re-running the migration is a no-op.
WITH src AS (
  SELECT id, email, email_confirmed_at IS NOT NULL AS confirmed
    FROM auth.users
)
UPDATE public.profiles p
   SET email          = src.email,
       email_verified = src.confirmed
  FROM src
 WHERE p.id = src.id
   AND (
     p.email          IS DISTINCT FROM src.email
     OR p.email_verified IS DISTINCT FROM src.confirmed
   );

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '352',
  'auth_email_sync_to_profiles',
  ARRAY['-- 352: auth.users UPDATE trigger → profiles.email + email_verified']
)
ON CONFLICT (version) DO NOTHING;
