-- ═══════════════════════════════════════════════════════════════════════════
-- 296_kyc_verifications_member_write_policies.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix: KYCDocumentScreen's manual-upload submit path fired
--    supabase.from("kyc_verifications").upsert({ member_id: user.id, … })
-- and always got "Couldn't submit — We couldn't save your submission" back.
-- The error was hidden by the client (see the sibling console.error added
-- alongside this migration). Root cause: `kyc_verifications` had only
-- two RLS policies —
--     kyc_verifications_member_select   (auth.uid() = member_id, SELECT)
--     kyc_verifications_service_all     (auth.role() = service_role, ALL)
-- — with no INSERT or UPDATE grant for authenticated. Every member-side
-- upsert was silently RLS-denied.
--
-- This migration adds two policies that let a member write only their own
-- row. Scope is deliberately narrow — WITH CHECK on both policies means
-- callers can't spoof member_id, and everything admins do (rejection,
-- provider status, reviewed_by_admin_id, etc.) still runs via service_role
-- so those columns can't be tampered with through the client path.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE, so a re-apply is safe.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS kyc_verifications_member_insert ON public.kyc_verifications;
CREATE POLICY kyc_verifications_member_insert
  ON public.kyc_verifications
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = member_id);

DROP POLICY IF EXISTS kyc_verifications_member_update ON public.kyc_verifications;
CREATE POLICY kyc_verifications_member_update
  ON public.kyc_verifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '296',
  'kyc_verifications_member_write_policies',
  ARRAY['-- 296: allow authenticated to INSERT/UPDATE their own kyc_verifications row']
)
ON CONFLICT (version) DO NOTHING;
