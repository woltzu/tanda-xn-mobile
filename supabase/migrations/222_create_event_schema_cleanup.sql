-- ════════════════════════════════════════════════════════════════════════════
-- 222_create_event_schema_cleanup.sql
-- Create an event — Bucket A
-- ════════════════════════════════════════════════════════════════════════════
--
-- community_events.full_address has been NOT NULL since migration 137, but
-- the modern create flow has treated it as optional context ("location_name"
-- is the primary address). CreateEventScreen has been working around the
-- NOT NULL constraint by computing
--
--   fullAddressForRow = fullAddress.trim() === '' ? locationName.trim() : fullAddress.trim()
--
-- before the insert. That paperwork-shaped row makes the column meaningless
-- for every event a user creates without expanding "More details", and any
-- analytics that try to use full_address get garbage.
--
-- Bucket A drops the NOT NULL so the column means what it says: the user's
-- optional street-level address. The screen-side fallback comes out in the
-- same commit, so insert payloads now carry `full_address: null` when the
-- field is empty.
--
-- Read-side consumers (EventsScreen lines 244 + 449, hooks/useEvents type
-- definitions) are updated in lockstep to tolerate null.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.community_events
  ALTER COLUMN full_address DROP NOT NULL;

-- Self-register. Idempotent via ON CONFLICT so re-runs are safe.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '222',
  'create_event_schema_cleanup',
  ARRAY['-- 222: create_event_schema_cleanup']
)
ON CONFLICT (version) DO NOTHING;
