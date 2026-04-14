-- ============================================================================
-- 066: Trip Organizer Fixes
-- 1. Add missing `slug` column to trips table
-- 2. Fix infinite recursion in RLS policies on trips table
-- ============================================================================

-- ─── 1. ADD SLUG COLUMN ───────────────────────────────────────────────────────

ALTER TABLE trips ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slugs for any existing trips
UPDATE trips
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(trip_name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL AND trip_name IS NOT NULL;

-- Unique index on slug (for public trip page lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_trips_slug ON trips (slug) WHERE slug IS NOT NULL;


-- ─── 2. FIX INFINITE RECURSION IN RLS POLICIES ───────────────────────────────
-- The problem: trips has 3 SELECT-applicable policies:
--   - trips_organizer_all (FOR ALL → includes SELECT)
--   - trips_public_select (FOR SELECT)
--   - trips_participant_select (FOR SELECT with subquery on trip_participants)
--
-- trip_participants also has RLS that checks trips, causing circular evaluation.
--
-- Fix: Drop the problematic policies and recreate with SECURITY DEFINER helper.

-- Drop the existing policies that cause recursion
DROP POLICY IF EXISTS trips_participant_select ON trips;
DROP POLICY IF EXISTS trips_public_select ON trips;
DROP POLICY IF EXISTS trips_organizer_all ON trips;

-- Recreate organizer policy (no subquery, safe)
CREATE POLICY trips_organizer_all ON trips
  FOR ALL USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

-- Recreate public select (no subquery, safe)
CREATE POLICY trips_public_select ON trips
  FOR SELECT USING (status = 'published');

-- Create a SECURITY DEFINER function to check participation without triggering RLS
CREATE OR REPLACE FUNCTION public.is_trip_participant(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trip_participants
    WHERE trip_id = p_trip_id AND user_id = p_user_id
  );
$$;

-- Recreate participant policy using the SECURITY DEFINER function (breaks recursion)
CREATE POLICY trips_participant_select ON trips
  FOR SELECT USING (
    public.is_trip_participant(id, auth.uid())
  );


-- ─── 3. FIX trip_participants RLS (may also have recursion) ───────────────────

-- Drop potentially recursive participant policies
DROP POLICY IF EXISTS trip_participants_organizer ON trip_participants;
DROP POLICY IF EXISTS trip_participants_self ON trip_participants;

-- Helper: check trip organizer without triggering trips RLS
CREATE OR REPLACE FUNCTION public.is_trip_organizer(p_trip_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM trips
    WHERE id = p_trip_id AND organizer_id = p_user_id
  );
$$;

-- Organizer can manage all participants in their trips
CREATE POLICY trip_participants_organizer ON trip_participants
  FOR ALL USING (
    public.is_trip_organizer(trip_id, auth.uid())
  ) WITH CHECK (
    public.is_trip_organizer(trip_id, auth.uid())
  );

-- Participants can see their own row
CREATE POLICY trip_participants_self ON trip_participants
  FOR SELECT USING (auth.uid() = user_id);


-- ─── 4. FIX trip_days and trip_activities RLS (same recursion risk) ───────────

DROP POLICY IF EXISTS trip_days_organizer ON trip_days;
DROP POLICY IF EXISTS trip_days_participant ON trip_days;
DROP POLICY IF EXISTS trip_days_public ON trip_days;

CREATE POLICY trip_days_organizer ON trip_days
  FOR ALL USING (
    public.is_trip_organizer(trip_id, auth.uid())
  ) WITH CHECK (
    public.is_trip_organizer(trip_id, auth.uid())
  );

CREATE POLICY trip_days_participant ON trip_days
  FOR SELECT USING (
    public.is_trip_participant(trip_id, auth.uid())
  );

CREATE POLICY trip_days_public ON trip_days
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_days.trip_id AND status = 'published')
  );

DROP POLICY IF EXISTS trip_activities_organizer ON trip_activities;
DROP POLICY IF EXISTS trip_activities_participant ON trip_activities;
DROP POLICY IF EXISTS trip_activities_public ON trip_activities;

CREATE POLICY trip_activities_organizer ON trip_activities
  FOR ALL USING (
    public.is_trip_organizer(
      (SELECT trip_id FROM trip_days WHERE id = trip_activities.trip_day_id),
      auth.uid()
    )
  ) WITH CHECK (
    public.is_trip_organizer(
      (SELECT trip_id FROM trip_days WHERE id = trip_activities.trip_day_id),
      auth.uid()
    )
  );

CREATE POLICY trip_activities_participant ON trip_activities
  FOR SELECT USING (
    public.is_trip_participant(
      (SELECT trip_id FROM trip_days WHERE id = trip_activities.trip_day_id),
      auth.uid()
    )
  );

CREATE POLICY trip_activities_public ON trip_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = trip_activities.trip_day_id AND t.status = 'published'
    )
  );


-- ─── 5. FIX remaining child table policies ──────────────────────────────────

-- trip_messages
DROP POLICY IF EXISTS trip_messages_organizer ON trip_messages;
DROP POLICY IF EXISTS trip_messages_participant ON trip_messages;

CREATE POLICY trip_messages_organizer ON trip_messages
  FOR ALL USING (public.is_trip_organizer(trip_id, auth.uid()))
  WITH CHECK (public.is_trip_organizer(trip_id, auth.uid()));

CREATE POLICY trip_messages_participant ON trip_messages
  FOR SELECT USING (public.is_trip_participant(trip_id, auth.uid()));

-- trip_vendors
DROP POLICY IF EXISTS trip_vendors_organizer ON trip_vendors;
DROP POLICY IF EXISTS trip_vendors_participant ON trip_vendors;

CREATE POLICY trip_vendors_organizer ON trip_vendors
  FOR ALL USING (public.is_trip_organizer(trip_id, auth.uid()))
  WITH CHECK (public.is_trip_organizer(trip_id, auth.uid()));

CREATE POLICY trip_vendors_participant ON trip_vendors
  FOR SELECT USING (public.is_trip_participant(trip_id, auth.uid()));

-- trip_payments
DROP POLICY IF EXISTS trip_payments_organizer ON trip_payments;
DROP POLICY IF EXISTS trip_payments_self ON trip_payments;

CREATE POLICY trip_payments_organizer ON trip_payments
  FOR ALL USING (public.is_trip_organizer(trip_id, auth.uid()))
  WITH CHECK (public.is_trip_organizer(trip_id, auth.uid()));

CREATE POLICY trip_payments_self ON trip_payments
  FOR SELECT USING (auth.uid() = user_id);

-- trip_participant_submissions
DROP POLICY IF EXISTS trip_submissions_organizer ON trip_participant_submissions;
DROP POLICY IF EXISTS trip_submissions_self ON trip_participant_submissions;

CREATE POLICY trip_submissions_organizer ON trip_participant_submissions
  FOR ALL USING (
    public.is_trip_organizer(
      (SELECT tp.trip_id FROM trip_participants tp WHERE tp.id = trip_participant_submissions.participant_id),
      auth.uid()
    )
  ) WITH CHECK (
    public.is_trip_organizer(
      (SELECT tp.trip_id FROM trip_participants tp WHERE tp.id = trip_participant_submissions.participant_id),
      auth.uid()
    )
  );

CREATE POLICY trip_submissions_self ON trip_participant_submissions
  FOR SELECT USING (
    auth.uid() = (SELECT tp.user_id FROM trip_participants tp WHERE tp.id = trip_participant_submissions.participant_id)
  );
