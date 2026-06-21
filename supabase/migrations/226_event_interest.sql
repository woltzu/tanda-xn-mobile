-- ════════════════════════════════════════════════════════════════════════════
-- 226_event_interest.sql
-- View-event-details Bucket A.4 — Interested / Going toggle table
-- ════════════════════════════════════════════════════════════════════════════
--
-- One row per (user_id, event_id). The status column carries the user's
-- RSVP signal: 'interested' (the soft tap), 'going' (committed), or
-- 'not_going' (explicit pass — useful for hiding the event from a "for
-- you" surface). The client cycles status null → interested → going →
-- not_going → null; the null state is represented by row absence,
-- which is why the cycle's final hop deletes rather than UPDATEs to a
-- new value.
--
-- RLS posture:
--   • SELECT: public to authenticated. Two reasons —
--       1. The user needs to read their own row to render the toggle
--          state on the sheet.
--       2. Any caller needs to count rows for an event to render
--          "{{count}} people interested". Server-side count via
--          policy is simpler than a SECURITY DEFINER RPC.
--   • INSERT / UPDATE / DELETE: owner-only (auth.uid() = user_id).
--
-- The UNIQUE (user_id, event_id) constraint makes the upsert path
-- single-statement on the client side (insert with ON CONFLICT in the
-- hook, or the supabase-js .upsert helper).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.event_interest (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id    UUID NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'interested'
              CHECK (status IN ('interested', 'going', 'not_going')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_event_interest_event_id
  ON public.event_interest (event_id);
CREATE INDEX IF NOT EXISTS idx_event_interest_user_id
  ON public.event_interest (user_id);

ALTER TABLE public.event_interest ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS event_interest_select_all ON public.event_interest;
CREATE POLICY event_interest_select_all
  ON public.event_interest
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS event_interest_insert_own ON public.event_interest;
CREATE POLICY event_interest_insert_own
  ON public.event_interest
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS event_interest_update_own ON public.event_interest;
CREATE POLICY event_interest_update_own
  ON public.event_interest
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS event_interest_delete_own ON public.event_interest;
CREATE POLICY event_interest_delete_own
  ON public.event_interest
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Keep updated_at fresh on UPDATE. The trigger is owned by the
-- existing project-wide convention; we declare a local trigger only.
CREATE OR REPLACE FUNCTION public.touch_event_interest_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_event_interest_touch ON public.event_interest;
CREATE TRIGGER tr_event_interest_touch
BEFORE UPDATE ON public.event_interest
FOR EACH ROW
EXECUTE FUNCTION public.touch_event_interest_updated_at();

-- ─── Self-register ────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '226',
  'event_interest',
  ARRAY['-- 226: event_interest']
)
ON CONFLICT (version) DO NOTHING;
