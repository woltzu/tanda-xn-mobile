-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 151: kyc_verifications — fields the user-flow KYC needs
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- KYC P0 wires the user-flow screens directly onto `kyc_verifications` (the
-- engine table that trigger `trg_sync_kyc_tier_to_profile` already watches),
-- replacing writes that previously went to the orphan `user_kyc` table. To
-- support the screens' existing fields without losing data, we add five
-- columns to `kyc_verifications`:
--
--   - tax_id              — SSN / ITIN / national ID from TaxIDEntryScreen
--   - id_type             — passport / national_id / drivers_license / etc.
--   - id_document_front_url
--   - id_document_back_url — URLs of uploaded photos from DocumentUploadScreen
--   - selfie_url          — placeholder for the future selfie capture step
--
-- Plus a partial unique index on (member_id) WHERE tax_id IS NOT NULL so we
-- catch accidental duplicate tax_id writes per user (the upsert path uses
-- member_id as the natural key).
--
-- Existing data: no rows in kyc_verifications today (0 rows confirmed), so
-- the ADD COLUMNs are zero-risk.

ALTER TABLE public.kyc_verifications
  ADD COLUMN IF NOT EXISTS tax_id                TEXT,
  ADD COLUMN IF NOT EXISTS id_type               TEXT,
  ADD COLUMN IF NOT EXISTS id_document_front_url TEXT,
  ADD COLUMN IF NOT EXISTS id_document_back_url  TEXT,
  ADD COLUMN IF NOT EXISTS selfie_url            TEXT;

COMMENT ON COLUMN public.kyc_verifications.tax_id IS
  'SSN/ITIN for US users, or national ID for others. Written by TaxIDEntryScreen.';
COMMENT ON COLUMN public.kyc_verifications.id_type IS
  'Document type the member uploaded — passport / national_id / drivers_license / residence_permit.';
COMMENT ON COLUMN public.kyc_verifications.id_document_front_url IS
  'Public URL of the front-side photo uploaded by DocumentUploadScreen.';
COMMENT ON COLUMN public.kyc_verifications.id_document_back_url IS
  'Public URL of the back-side photo (where applicable) uploaded by DocumentUploadScreen.';
COMMENT ON COLUMN public.kyc_verifications.selfie_url IS
  'Public URL of the selfie capture once that step ships. Nullable until then.';

-- Partial unique index — natural key for the screens' upsert path. Allows
-- multiple historical rows per member (e.g. rejection + retry) but at any
-- given time only one row carries a non-null tax_id per member, matching
-- how the screen-side upsert logic treats the tax_id surface.
CREATE UNIQUE INDEX IF NOT EXISTS kyc_verifications_member_taxid_partial_idx
  ON public.kyc_verifications (member_id)
  WHERE tax_id IS NOT NULL;

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '151',
  'kyc_verifications_user_columns',
  ARRAY['-- 151: kyc_verifications_user_columns']
)
ON CONFLICT (version) DO NOTHING;
