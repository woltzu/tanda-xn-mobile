-- ════════════════════════════════════════════════════════════════════════════
-- Migration 239: trip_messages.activity_id FK
-- Publish-trip Bucket B.5 — itinerary-item posts.
-- ════════════════════════════════════════════════════════════════════════════
--
-- Adds an optional FK from trip_messages to trip_activities so the
-- TripUpdatesScreen feed can render a "Posting about: <activity>" chip
-- and so the per-activity "Post update" button on ItineraryBuilder can
-- attach context to a broadcast. Null for plain trip-wide updates
-- (the historical behaviour) — the column is purely additive.
--
-- ON DELETE SET NULL — if an organizer deletes the activity the message
-- still survives without the broken FK reference (the body text is what
-- participants saw; preserving it matches the user's mental model better
-- than cascading the delete).
--
-- Spec deviation: spec used
--   INSERT INTO supabase_migrations (version, name, applied_at)
-- Corrected to the canonical
--   INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
-- per CLAUDE.md migration conventions.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trip_messages
  ADD COLUMN IF NOT EXISTS activity_id UUID
    REFERENCES public.trip_activities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trip_messages_activity_id
  ON public.trip_messages(activity_id)
  WHERE activity_id IS NOT NULL;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '239',
  'trip_messages_activity_fk',
  ARRAY['-- 239: trip_messages_activity_fk']
)
ON CONFLICT (version) DO NOTHING;
