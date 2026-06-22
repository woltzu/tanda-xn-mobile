-- ════════════════════════════════════════════════════════════════════════════
-- Migration 237: Trip Wizard Bucket A — data hygiene
-- ════════════════════════════════════════════════════════════════════════════
--
-- Two changes, both gates of the active trip system (Migration 065):
--
-- 1. DROP the 6 tables created by Migration 064 (trip_circle_system) that
--    were superseded by Migration 065 (trip_organizer). All 6 are empty
--    on prod (verified via row-count audit on 2026-06-22) and no app code
--    references them — confirmed by grep across screens/services/hooks.
--    Tables dropped:
--      • trip_listings           — provider-keyed listings, escrow_total_cents
--      • trip_members            — provider-keyed members + payment_status
--      • trip_contributions      — deposit/monthly/refund payments
--      • trip_payment_schedules  — month_number/due_date installments
--      • provider_profiles       — Migration 064's provider table (NOT the
--                                  live one — Migration 193 created a fresh
--                                  `providers` table that powers ProviderList /
--                                  ProviderDetail / etc. This one stayed empty.)
--      • media_uploads           — covers/docs uploaded via Migration 064 path
--    CASCADE handles the dependent indexes, RLS policies, and the 4 updated_at
--    triggers (trg_trip_listings_updated_at, trg_trip_members_updated_at,
--    trg_trip_contributions_updated_at, trg_trip_payment_schedules_updated_at).
--
-- 2. Widen `stripe_payment_intents.purpose` CHECK to admit the three trip
--    purposes the new `create-trip-payment-intent` Edge Function emits:
--    'trip_deposit', 'trip_installment', 'trip_full_payment'. Without this,
--    the EF's INSERT would fail with a CHECK violation on the very first
--    real call. We keep all existing values intact.
--
-- Self-registers per CLAUDE.md convention.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Drop dead Migration 064 tables ─────────────────────────────────────
-- All tables verified empty (0 rows) prior to this migration. CASCADE so
-- the existing indexes / RLS / triggers / publication memberships go with
-- them. If a future migration re-introduces any of these names it should
-- start fresh — there's no data to preserve.
DROP TABLE IF EXISTS public.trip_contributions CASCADE;
DROP TABLE IF EXISTS public.trip_payment_schedules CASCADE;
DROP TABLE IF EXISTS public.trip_members CASCADE;
DROP TABLE IF EXISTS public.trip_listings CASCADE;
DROP TABLE IF EXISTS public.media_uploads CASCADE;
-- provider_profiles last — nothing in the dropped tables FKs it but list
-- order keeps the dependency chain obvious.
DROP TABLE IF EXISTS public.provider_profiles CASCADE;

-- Also drop the shared updated_at helper that ONLY served the trip_circle
-- system (set_trip_circle_updated_at). The Migration 065 tables use
-- `update_updated_at` instead, so dropping this is safe — verified via
-- pg_proc audit 2026-06-22.
DROP FUNCTION IF EXISTS public.set_trip_circle_updated_at() CASCADE;

-- ─── 2. Widen stripe_payment_intents.purpose CHECK ─────────────────────────
-- Existing values (per pg_constraint dump 2026-06-22):
--   'contribution','insurance_premium','late_fee','loan_repayment',
--   'wallet_deposit','membership_fee','goal_deposit'
-- Add three trip purposes so the new EF can write rows without violating
-- the CHECK. Drop + recreate is the only way — Postgres doesn't support
-- ALTER CHECK ... ADD VALUE.
ALTER TABLE public.stripe_payment_intents
  DROP CONSTRAINT IF EXISTS stripe_payment_intents_purpose_check;

ALTER TABLE public.stripe_payment_intents
  ADD CONSTRAINT stripe_payment_intents_purpose_check
  CHECK (purpose = ANY (ARRAY[
    'contribution'::text,
    'insurance_premium'::text,
    'late_fee'::text,
    'loan_repayment'::text,
    'wallet_deposit'::text,
    'membership_fee'::text,
    'goal_deposit'::text,
    'trip_deposit'::text,
    'trip_installment'::text,
    'trip_full_payment'::text
  ]));

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '237',
  'trip_wizard_bucket_a',
  ARRAY['-- 237: trip_wizard_bucket_a']
)
ON CONFLICT (version) DO NOTHING;
