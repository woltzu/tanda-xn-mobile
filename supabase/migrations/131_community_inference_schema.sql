-- ════════════════════════════════════════════════════════════════════════════
-- 131: community_inference_schema — Phase 1a foundation
-- ════════════════════════════════════════════════════════════════════════════
--
-- Schema changes ONLY. No inference logic, no trigger functions, no
-- suggested-group flow — those land in migration 132 (Phase 1b) once we
-- have the privacy / consent surfaces wired.
--
-- Changes:
--
--   1. communities.metadata  JSONB DEFAULT '{}'
--      Carries auxiliary group attributes used by the inference engine
--      (religion, room_id, city, country, …). Existing rows back-fill
--      to '{}' automatically.
--
--   2. community_memberships.source  TEXT NOT NULL DEFAULT 'explicit'
--      CHECK in {'explicit', 'inferred_attendance', 'inferred_location',
--      'admin'}. Distinguishes user-initiated joins from server-driven
--      ones. All existing rows are treated as 'explicit' (default).
--      Phase 1b's inference RPCs will write the 'inferred_*' values.
--
--   3. profiles.city TEXT, profiles.country TEXT
--      CURRENT residence (distinct from the existing `country_of_origin`
--      which is birthplace / heritage). Both NULL by default; inference
--      skips the location path when either is missing.
--
--   4. sync_rooms.room_settings.religion  back-fill
--      Worship rooms get `religion: 'other'` added if they don't carry
--      a value. New worship rooms created by create_sync_room (v3,
--      migration 128) will need the host UI in Phase 1b to set this
--      explicitly; until then 'other' is the safe default.
--
-- Phase 1a does NOT touch:
--   - parent_community_id  (per the tags-model decision; we may still
--     leave the column unused for sync-room-derived groups, but we are
--     not removing it — existing data uses it).
--   - community_type  (free-text column with no CHECK; new values like
--     'sync_room' are allowed without a schema change).
--   - community_memberships RLS or grants  (existing policies cover the
--     new column; insert path is restricted to user_id = auth.uid()).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. communities.metadata ────────────────────────────────────────────────
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 2. community_memberships.source ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'community_memberships'
      AND column_name  = 'source'
  ) THEN
    ALTER TABLE public.community_memberships
      ADD COLUMN source TEXT NOT NULL DEFAULT 'explicit';

    ALTER TABLE public.community_memberships
      ADD CONSTRAINT community_memberships_source_check
      CHECK (source IN (
        'explicit',
        'inferred_attendance',
        'inferred_location',
        'admin'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_community_memberships_source
  ON public.community_memberships(source);

-- ── 3. profiles.city / profiles.country ────────────────────────────────────
-- Both nullable. The inference engine in 1b will skip the location path
-- when either is missing, so adding the columns has no behavior impact
-- until users actually populate them via the settings UI.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city    TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- ── 4. Backfill `religion` on existing worship room_settings ───────────────
-- Targets only rooms missing the key, so re-applying is idempotent. The
-- `?` operator is the JSONB key-exists test.
UPDATE public.sync_rooms
   SET room_settings = COALESCE(room_settings, '{}'::jsonb)
                       || jsonb_build_object('religion', 'other')
 WHERE room_type = 'worship'
   AND NOT (COALESCE(room_settings, '{}'::jsonb) ? 'religion');

-- ════════════════════════════════════════════════════════════════════════════
-- Self-register
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '131',
  'community_inference_schema',
  ARRAY['-- 131: community_inference_schema (Phase 1a: communities.metadata, community_memberships.source, profiles.city/country, worship religion backfill)']
)
ON CONFLICT (version) DO NOTHING;
