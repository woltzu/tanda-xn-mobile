-- ════════════════════════════════════════════════════════════════════════════
-- 245 — trip_reviews + trip_activity_reviews
-- ════════════════════════════════════════════════════════════════════════════
-- Leave-review Bucket A.1: greenfield trip review tables, mirroring the
-- provider_reviews precedent (193). Includes the aggregate-recompute
-- triggers on trips + profiles, RLS, the submit_trip_review RPC with
-- eligibility guards, and the two aggregate columns on trips/profiles.
--
-- IMPORTANT CORRECTIONS vs. spec draft:
--   • reviewer_id resolved from trip_participants.user_id, NOT from
--     p_participant_id directly. (Spec wrote `reviewer_id := p_participant_id`,
--     which would point reviewer_id at the participant row UUID instead of
--     the actual user UUID, breaking joins to profiles + RLS reasoning.)
--   • Self-registration uses supabase_migrations.schema_migrations per
--     CLAUDE.md migration template, not the (nonexistent) `supabase_migrations`
--     table at public schema.
--   • Functions get `SET search_path = public, pg_temp` per Tier 4 hardening
--     guidance — SECURITY DEFINER without a fixed search_path is one of the
--     260 advisor lints we want to stop adding to.
--   • uuid_generate_v4() to match the 065 trip-organizer migrations that own
--     the surrounding schema (gen_random_uuid() also works on this project
--     but consistency wins).
-- ════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Aggregate columns on trips + profiles (created first so triggers can
--    update them on the very first review insert without column errors).
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS rating_avg DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS review_count INT NOT NULL DEFAULT 0;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trip_organizer_rating_avg DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS trip_organizer_review_count INT NOT NULL DEFAULT 0;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. trip_reviews — one organizer review per participant per trip.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_reviews (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id               UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  trip_participant_id   UUID NOT NULL REFERENCES trip_participants(id) ON DELETE CASCADE,
  organizer_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewer_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating                INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trip_participant_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_reviews_trip
  ON trip_reviews (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_reviews_organizer
  ON trip_reviews (organizer_id);
CREATE INDEX IF NOT EXISTS idx_trip_reviews_reviewer
  ON trip_reviews (reviewer_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 3. trip_activity_reviews — optional per-activity ratings.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trip_activity_reviews (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_activity_id      UUID NOT NULL REFERENCES trip_activities(id) ON DELETE CASCADE,
  trip_participant_id   UUID NOT NULL REFERENCES trip_participants(id) ON DELETE CASCADE,
  reviewer_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating                INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text           TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(trip_participant_id, trip_activity_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_activity_reviews_activity
  ON trip_activity_reviews (trip_activity_id);
CREATE INDEX IF NOT EXISTS idx_trip_activity_reviews_reviewer
  ON trip_activity_reviews (reviewer_id);

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Recompute trigger — trips.rating_avg + review_count
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION recompute_trip_rating_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_id UUID := COALESCE(NEW.trip_id, OLD.trip_id);
BEGIN
  UPDATE trips SET
    rating_avg   = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM trip_reviews WHERE trip_id = v_trip_id),
    review_count = (SELECT COUNT(*)                       FROM trip_reviews WHERE trip_id = v_trip_id)
  WHERE id = v_trip_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_reviews_recompute_stats ON trip_reviews;
CREATE TRIGGER tr_trip_reviews_recompute_stats
AFTER INSERT OR DELETE OR UPDATE OF rating ON trip_reviews
FOR EACH ROW
EXECUTE FUNCTION recompute_trip_rating_stats();

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Recompute trigger — profiles.trip_organizer_rating_avg + count
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION recompute_organizer_rating_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organizer_id UUID := COALESCE(NEW.organizer_id, OLD.organizer_id);
BEGIN
  UPDATE profiles SET
    trip_organizer_rating_avg   = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM trip_reviews WHERE organizer_id = v_organizer_id),
    trip_organizer_review_count = (SELECT COUNT(*)                       FROM trip_reviews WHERE organizer_id = v_organizer_id)
  WHERE id = v_organizer_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_trip_reviews_recompute_organizer_stats ON trip_reviews;
CREATE TRIGGER tr_trip_reviews_recompute_organizer_stats
AFTER INSERT OR DELETE OR UPDATE OF rating ON trip_reviews
FOR EACH ROW
EXECUTE FUNCTION recompute_organizer_rating_stats();

-- ───────────────────────────────────────────────────────────────────────────
-- 6. RLS — public SELECT, authenticated INSERT (eligibility via RPC),
--    no UPDATE for now (immutability hardens after grace; revisit if needed)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE trip_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_activity_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trip_reviews_select_policy ON trip_reviews;
CREATE POLICY trip_reviews_select_policy ON trip_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS trip_reviews_insert_policy ON trip_reviews;
CREATE POLICY trip_reviews_insert_policy ON trip_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS trip_reviews_update_policy ON trip_reviews;
CREATE POLICY trip_reviews_update_policy ON trip_reviews
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS trip_activity_reviews_select_policy ON trip_activity_reviews;
CREATE POLICY trip_activity_reviews_select_policy ON trip_activity_reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS trip_activity_reviews_insert_policy ON trip_activity_reviews;
CREATE POLICY trip_activity_reviews_insert_policy ON trip_activity_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS trip_activity_reviews_update_policy ON trip_activity_reviews;
CREATE POLICY trip_activity_reviews_update_policy ON trip_activity_reviews
  FOR UPDATE USING (false);

-- ───────────────────────────────────────────────────────────────────────────
-- 7. RPC: submit_trip_review — single entrypoint with eligibility +
--    idempotency. SECURITY DEFINER so it can bypass RLS for the insert
--    while still validating user identity via auth.uid().
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_trip_review(
  p_participant_id        UUID,
  p_organizer_rating      INT,
  p_organizer_review_text TEXT  DEFAULT NULL,
  p_activity_ratings      JSONB DEFAULT NULL   -- [{activity_id, rating, text}, …]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip_id      UUID;
  v_user_id      UUID;
  v_organizer_id UUID;
  v_end_date     DATE;
  v_review_id    UUID;
  v_ar           JSONB;
BEGIN
  -- 1. Auth context — must be a real signed-in user.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Resolve participant + verify ownership + status.
  SELECT tp.trip_id, tp.user_id
    INTO v_trip_id, v_user_id
  FROM trip_participants tp
  WHERE tp.id = p_participant_id
    AND tp.status = 'confirmed';

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'Participant not found or not confirmed';
  END IF;

  IF v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Cannot submit a review for another participant';
  END IF;

  -- 3. Trip must have ended.
  SELECT end_date, organizer_id
    INTO v_end_date, v_organizer_id
  FROM trips
  WHERE id = v_trip_id;

  IF v_end_date IS NULL OR v_end_date > CURRENT_DATE THEN
    RAISE EXCEPTION 'Trip has not yet ended — reviews only allowed after completion';
  END IF;

  -- 4. Idempotency — one review per participant.
  IF EXISTS (SELECT 1 FROM trip_reviews WHERE trip_participant_id = p_participant_id) THEN
    RAISE EXCEPTION 'Review already submitted for this trip';
  END IF;

  -- 5. Insert the organizer review. reviewer_id is the resolved auth user,
  -- NOT the participant row id (spec mismatch fix).
  INSERT INTO trip_reviews (
    trip_id, trip_participant_id, organizer_id, reviewer_id,
    rating, review_text
  ) VALUES (
    v_trip_id, p_participant_id, v_organizer_id, v_user_id,
    p_organizer_rating, NULLIF(TRIM(COALESCE(p_organizer_review_text, '')), '')
  )
  RETURNING id INTO v_review_id;

  -- 6. Optional activity reviews — bulk insert, ignore duplicates per activity.
  IF p_activity_ratings IS NOT NULL THEN
    FOR v_ar IN SELECT * FROM jsonb_array_elements(p_activity_ratings)
    LOOP
      -- Skip malformed entries quietly rather than fail the whole submission.
      IF v_ar ? 'activity_id' AND v_ar ? 'rating' THEN
        INSERT INTO trip_activity_reviews (
          trip_activity_id, trip_participant_id, reviewer_id,
          rating, review_text
        ) VALUES (
          (v_ar->>'activity_id')::UUID,
          p_participant_id,
          v_user_id,
          (v_ar->>'rating')::INT,
          NULLIF(TRIM(COALESCE(v_ar->>'text', '')), '')
        )
        ON CONFLICT (trip_participant_id, trip_activity_id) DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  RETURN v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_trip_review(UUID, INT, TEXT, JSONB) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────
-- 8. Self-register per CLAUDE.md template.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '245',
  'trip_reviews',
  ARRAY['-- 245: trip_reviews']
)
ON CONFLICT (version) DO NOTHING;
