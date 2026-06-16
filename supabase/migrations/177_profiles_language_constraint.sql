-- 177_profiles_language_constraint.sql
-- =====================================================================
-- P2 of the Language switcher review.
--
-- profiles.language already exists (per the profile schema probe) but
-- carried no validation — it could be NULL or any random text. With
-- the picker now constrained to en + fr, we tighten the column to
-- match.
--
-- 1. Backfill any NULL rows to 'en' (the default).
-- 2. Add a CHECK constraint so future writes must be a supported
--    language code. Mirror the source-of-truth list in
--    i18n/index.ts's SUPPORTED_LANGUAGES.
--
-- No DB trigger to mirror AsyncStorage `app-language` — that key
-- only exists client-side, so the sync runs from PreferencesContext
-- as a best-effort write after every setAppLanguage call.
--
-- Idempotent.
-- =====================================================================

-- 1. Backfill
UPDATE public.profiles
   SET language = 'en'
 WHERE language IS NULL;

-- 2. CHECK constraint — keep this list aligned with i18n/index.ts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname  = 'profiles_language_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_language_check
      CHECK (language IS NULL OR language IN ('en', 'fr'));
  END IF;
END $$;

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '177',
  'profiles_language_constraint',
  ARRAY['-- 177: profiles_language_constraint']
)
ON CONFLICT (version) DO NOTHING;
