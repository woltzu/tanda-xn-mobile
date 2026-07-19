-- ═══════════════════════════════════════════════════════════════════════════
-- 359_kyc_profile_autopopulate.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- KYC → profile auto-populate on approval, plus a bug fix to the mig 053
-- trigger it extends.
--
-- Two things this migration does:
--
-- (a) Adds `extracted_*` columns to kyc_verifications. These are populated
--     by whichever verification path is in use (manual admin review today;
--     Persona or another provider tomorrow) with the user's identity
--     fields as they appear on the ID document. Nullable — nothing forces
--     a caller to populate them, and a NULL simply means the trigger has
--     no data to copy for that field.
--
-- (b) Rewrites `sync_kyc_tier_to_profile` (mig 053) to actually work AND
--     to sync the new extracted fields.
--
--     Bug being fixed: the mig 053 body writes
--       UPDATE profiles SET kyc_tier = NEW.kyc_tier, ...
--     but `profiles.kyc_tier` doesn't exist. The real column is
--     `kyc_level` (see mig 268 header, which documents this: "profiles.
--     kyc_level INTEGER DEFAULT 0 already exists for tier tracking").
--     The mig 053 trigger has been a dormant landmine — it hasn't
--     exploded because no code path currently flips kyc_verifications.
--     status to 'approved' in prod. The moment an admin-approval path
--     lands, every approval would error on this trigger. Fixing now.
--
--     Also extending the trigger to:
--       * Stamp `kyc_status = 'verified'` (mig 053 left kyc_status
--         untouched, meaning approving a KYC row via kyc_verifications
--         wouldn't cascade to the profiles.kyc_status field the app
--         actually reads for gates).
--       * COALESCE-populate full_name / date_of_birth / address from the
--         new extracted_* columns. "If NULL (or empty string for TEXT
--         fields), take extracted; else keep whatever the profile
--         already has." Second approval doesn't overwrite anything a
--         user has since edited.
--
--     Not synced: extracted_document_number. profiles has no column for
--     it (verified live); operator opted to skip rather than add one.
--     The column is still added to kyc_verifications so an audit trail
--     of the document number lives with the verification row.
--
-- Idempotency: the trigger fires only on OLD.status <> 'approved' AND
-- NEW.status = 'approved'. Re-approving an already-approved row is a
-- no-op. Re-executing this migration is also a no-op (ADD COLUMN IF
-- NOT EXISTS, CREATE OR REPLACE FUNCTION, ON CONFLICT DO NOTHING on
-- the registry INSERT).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Extend kyc_verifications with extracted-data columns ──────────────

ALTER TABLE public.kyc_verifications
  ADD COLUMN IF NOT EXISTS extracted_full_name       TEXT,
  ADD COLUMN IF NOT EXISTS extracted_dob             DATE,
  ADD COLUMN IF NOT EXISTS extracted_address         TEXT,
  ADD COLUMN IF NOT EXISTS extracted_document_number TEXT;

COMMENT ON COLUMN public.kyc_verifications.extracted_full_name IS
  'Full name as read off the ID document. Populated at approval time by '
  'the verification path (admin review today; provider OCR tomorrow). '
  'NULL = no data to sync; profile field unchanged.';
COMMENT ON COLUMN public.kyc_verifications.extracted_dob IS
  'Date of birth as read off the ID document. Nullable.';
COMMENT ON COLUMN public.kyc_verifications.extracted_address IS
  'Address as read off the ID document. Nullable.';
COMMENT ON COLUMN public.kyc_verifications.extracted_document_number IS
  'Document/ID number as read off the ID. Stored here for audit only; '
  'not synced to profiles (no target column, per operator decision).';

-- ─── 2. Rewrite sync_kyc_tier_to_profile ──────────────────────────────────
-- Same function name + trigger binding as mig 053 — we just replace the
-- body so no DROP/CREATE dance on the trigger itself.

CREATE OR REPLACE FUNCTION public.sync_kyc_tier_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    UPDATE public.profiles
       SET
         -- Tier + status + timestamp. `kyc_level` is the real column
         -- (mig 053 wrote to phantom `kyc_tier`).
         kyc_level       = NEW.kyc_tier,
         kyc_status      = 'verified',
         kyc_verified_at = NOW(),

         -- Extracted-field sync. COALESCE + NULLIF preserves anything
         -- the user has already filled in; only backfills empties.
         full_name = COALESCE(
           NULLIF(full_name, ''),
           NULLIF(NEW.extracted_full_name, '')
         ),
         date_of_birth = COALESCE(
           date_of_birth,
           NEW.extracted_dob
         ),
         address = COALESCE(
           NULLIF(address, ''),
           NULLIF(NEW.extracted_address, '')
         )
     WHERE id = NEW.member_id;
  END IF;
  RETURN NEW;
END;
$$;

-- The trigger binding from mig 053 (`trg_sync_kyc_tier_to_profile`
-- AFTER UPDATE ON kyc_verifications) is unchanged; CREATE OR REPLACE
-- FUNCTION swaps the body in place.

-- ─── 3. Self-register ─────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '359',
  'kyc_profile_autopopulate',
  ARRAY['-- 359: kyc_verifications extracted_* columns + fixed sync_kyc_tier_to_profile']
)
ON CONFLICT (version) DO NOTHING;
