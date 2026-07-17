-- 353_sms_consent_granted_at.sql
-- =====================================================================
-- Twilio A2P 10DLC compliance — capture the exact moment each user
-- grants SMS consent during signup so we have an auditable trail if a
-- carrier ever asks "prove this number opted in".
--
-- One nullable column on profiles. NULL until the user checks the
-- mandatory SMS-consent checkbox on SignupScreen; stamped to NOW()
-- inside recordSignupAcceptances (context/AuthContext.tsx) as part of
-- the same post-SIGNED_IN pass that records the legal-doc acceptances.
--
-- Deliberately NOT adding profiles.sms_opt_out — the master opt-out
-- lives on notification_preferences.sms_enabled (single source of
-- truth, inverse polarity). Adding a second column would duplicate
-- state.
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_consent_granted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.sms_consent_granted_at IS
  'Timestamp of the user''s SMS-consent checkbox tick on SignupScreen. '
  'Twilio A2P 10DLC audit surface. NULL for pre-launch users; '
  'stamped to NOW() by recordSignupAcceptances on first successful signup.';

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '353',
  'sms_consent_granted_at',
  ARRAY['-- 353: profiles.sms_consent_granted_at column for Twilio A2P audit trail']
)
ON CONFLICT (version) DO NOTHING;
