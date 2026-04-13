-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 064: Trip Circle System
-- Provider profiles, trip listings, members, contributions, payment schedules,
-- media uploads, storage buckets, and trip summary view
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. PROVIDER PROFILES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS provider_profiles (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Business info
  provider_type               TEXT NOT NULL DEFAULT 'trip_organizer' CHECK (provider_type IN ('trip_organizer','catering','photography','professional')),
  business_name               TEXT NOT NULL,
  bio                         TEXT,
  years_operating             INTEGER,
  avg_group_size              TEXT,
  profile_photo_url           TEXT,

  -- Trust & verification
  trust_level                 TEXT NOT NULL DEFAULT 'claimed' CHECK (trust_level IN ('claimed','verified','elder_endorsed')),
  elder_endorsement_requested BOOLEAN NOT NULL DEFAULT false,
  elder_endorser_id           UUID REFERENCES profiles(id),
  verification_status         TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','under_review','approved','rejected')),
  verified_at                 TIMESTAMPTZ,
  documents                   JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of {type, url, status, uploaded_at}

  -- Status
  is_active                   BOOLEAN NOT NULL DEFAULT true,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ─── 2. TRIP LISTINGS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_listings (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id             UUID NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,

  -- Trip info
  title                   TEXT NOT NULL,
  description             TEXT,
  emoji                   TEXT DEFAULT '🌴',
  cover_photo_url         TEXT,
  cover_video_url         TEXT,

  -- Dates & location
  departure_date          DATE NOT NULL,
  return_date             DATE NOT NULL,
  origin_city             TEXT,
  destination             TEXT NOT NULL,

  -- Pricing
  price_per_person_cents  INTEGER NOT NULL,
  deposit_cents           INTEGER NOT NULL,
  suggested_monthly_cents INTEGER,           -- auto-calculated circle contribution
  suggested_months        INTEGER,

  -- Capacity
  min_travelers           INTEGER NOT NULL DEFAULT 10,
  max_travelers           INTEGER NOT NULL DEFAULT 25,

  -- Inclusions
  includes                JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of {item, emoji, included: boolean}

  -- Status & financials
  status                  TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','full','booking_confirmed','completed','cancelled')),
  escrow_total_cents      INTEGER NOT NULL DEFAULT 0,
  tandaxn_fee_pct         NUMERIC(4,2) NOT NULL DEFAULT 3.50,

  -- Timestamps
  booking_confirmed_at    TIMESTAMPTZ,
  published_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. TRIP MEMBERS ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id             UUID NOT NULL REFERENCES trip_listings(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id           UUID REFERENCES circles(id),  -- linked tanda circle for savings

  -- Payment tracking
  deposit_paid        BOOLEAN NOT NULL DEFAULT false,
  deposit_paid_at     TIMESTAMPTZ,
  total_paid_cents    INTEGER NOT NULL DEFAULT 0,
  payment_status      TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','current','partial','behind','complete')),

  -- Lifecycle
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at        TIMESTAMPTZ,
  refunded_at         TIMESTAMPTZ,
  refund_amount_cents INTEGER,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(trip_id, user_id)
);

-- ─── 4. TRIP CONTRIBUTIONS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_contributions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_member_id      UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  trip_id             UUID NOT NULL REFERENCES trip_listings(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles(id),

  -- Payment details
  amount_cents        INTEGER NOT NULL,
  type                TEXT NOT NULL DEFAULT 'monthly' CHECK (type IN ('deposit','monthly','extra','refund')),
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','refunded')),
  due_date            DATE,
  paid_at             TIMESTAMPTZ,
  stripe_payment_id   TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. TRIP PAYMENT SCHEDULES ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_payment_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_member_id      UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  trip_id             UUID NOT NULL REFERENCES trip_listings(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES profiles(id),

  -- Schedule details
  month_number        INTEGER NOT NULL,      -- 1, 2, 3, etc.
  amount_cents        INTEGER NOT NULL,
  due_date            DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','due','paid','late','missed')),
  contribution_id     UUID REFERENCES trip_contributions(id),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. MEDIA UPLOADS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_uploads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- File info
  bucket              TEXT NOT NULL,          -- 'trip-covers', 'provider-photos', 'verification-docs', 'trip-media'
  file_path           TEXT NOT NULL,          -- path within the bucket
  file_name           TEXT NOT NULL,
  file_type           TEXT NOT NULL,          -- 'image/jpeg', 'video/mp4', etc.
  file_size_bytes     INTEGER,
  url                 TEXT NOT NULL,          -- public URL

  -- Linked entity
  entity_type         TEXT,                   -- 'trip_listing', 'provider_profile', 'verification_doc'
  entity_id           UUID,                   -- the trip/provider/etc ID

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════════════
-- SUPABASE STORAGE BUCKETS
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public) VALUES
  ('trip-covers', 'trip-covers', true),
  ('provider-photos', 'provider-photos', true),
  ('verification-docs', 'verification-docs', false),
  ('trip-media', 'trip-media', true)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage Policies: trip-covers (public read, authenticated upload) ─────

CREATE POLICY storage_trip_covers_select ON storage.objects
  FOR SELECT USING (bucket_id = 'trip-covers');

CREATE POLICY storage_trip_covers_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'trip-covers' AND auth.role() = 'authenticated');

CREATE POLICY storage_trip_covers_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'trip-covers' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'trip-covers' AND auth.uid() = owner);

CREATE POLICY storage_trip_covers_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'trip-covers' AND auth.uid() = owner);

-- ─── Storage Policies: provider-photos (public read, authenticated upload) ─

CREATE POLICY storage_provider_photos_select ON storage.objects
  FOR SELECT USING (bucket_id = 'provider-photos');

CREATE POLICY storage_provider_photos_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'provider-photos' AND auth.role() = 'authenticated');

CREATE POLICY storage_provider_photos_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'provider-photos' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'provider-photos' AND auth.uid() = owner);

CREATE POLICY storage_provider_photos_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'provider-photos' AND auth.uid() = owner);

-- ─── Storage Policies: verification-docs (private, service_role read) ──────

CREATE POLICY storage_verification_docs_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'verification-docs' AND auth.role() = 'authenticated');

CREATE POLICY storage_verification_docs_select ON storage.objects
  FOR SELECT USING (bucket_id = 'verification-docs' AND (auth.uid() = owner OR auth.role() = 'service_role'));

CREATE POLICY storage_verification_docs_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'verification-docs' AND auth.uid() = owner);

-- ─── Storage Policies: trip-media (public read, authenticated upload) ──────

CREATE POLICY storage_trip_media_select ON storage.objects
  FOR SELECT USING (bucket_id = 'trip-media');

CREATE POLICY storage_trip_media_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'trip-media' AND auth.role() = 'authenticated');

CREATE POLICY storage_trip_media_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'trip-media' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'trip-media' AND auth.uid() = owner);

CREATE POLICY storage_trip_media_delete ON storage.objects
  FOR DELETE USING (bucket_id = 'trip-media' AND auth.uid() = owner);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- provider_profiles
CREATE INDEX idx_provider_profiles_user ON provider_profiles(user_id);
CREATE INDEX idx_provider_profiles_status ON provider_profiles(verification_status) WHERE is_active = true;

-- trip_listings
CREATE INDEX idx_trip_listings_provider ON trip_listings(provider_id);
CREATE INDEX idx_trip_listings_status ON trip_listings(status) WHERE status = 'live';
CREATE INDEX idx_trip_listings_departure ON trip_listings(departure_date) WHERE status = 'live';

-- trip_members
CREATE INDEX idx_trip_members_trip ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user ON trip_members(user_id);

-- trip_contributions
CREATE INDEX idx_trip_contributions_member ON trip_contributions(trip_member_id);
CREATE INDEX idx_trip_contributions_trip ON trip_contributions(trip_id, status);

-- trip_payment_schedules
CREATE INDEX idx_trip_schedules_member ON trip_payment_schedules(trip_member_id, due_date);

-- media_uploads
CREATE INDEX idx_media_uploads_entity ON media_uploads(entity_type, entity_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_trip_circle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_provider_profiles_updated_at
  BEFORE UPDATE ON provider_profiles
  FOR EACH ROW EXECUTE FUNCTION set_trip_circle_updated_at();

CREATE TRIGGER trg_trip_listings_updated_at
  BEFORE UPDATE ON trip_listings
  FOR EACH ROW EXECUTE FUNCTION set_trip_circle_updated_at();

CREATE TRIGGER trg_trip_members_updated_at
  BEFORE UPDATE ON trip_members
  FOR EACH ROW EXECUTE FUNCTION set_trip_circle_updated_at();

CREATE TRIGGER trg_trip_contributions_updated_at
  BEFORE UPDATE ON trip_contributions
  FOR EACH ROW EXECUTE FUNCTION set_trip_circle_updated_at();

CREATE TRIGGER trg_trip_payment_schedules_updated_at
  BEFORE UPDATE ON trip_payment_schedules
  FOR EACH ROW EXECUTE FUNCTION set_trip_circle_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_listings FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_members FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_contributions FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_payment_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_payment_schedules FORCE ROW LEVEL SECURITY;
ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_uploads FORCE ROW LEVEL SECURITY;

-- ─── provider_profiles: SELECT all authenticated, INSERT/UPDATE/DELETE own ──

CREATE POLICY provider_profiles_select ON provider_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY provider_profiles_insert ON provider_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY provider_profiles_update ON provider_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY provider_profiles_delete ON provider_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- ─── trip_listings: SELECT all authenticated, INSERT/UPDATE/DELETE by provider owner ──

CREATE POLICY trip_listings_select ON trip_listings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY trip_listings_insert ON trip_listings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM provider_profiles WHERE id = trip_listings.provider_id AND user_id = auth.uid())
  );

CREATE POLICY trip_listings_update ON trip_listings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM provider_profiles WHERE id = trip_listings.provider_id AND user_id = auth.uid())
  );

CREATE POLICY trip_listings_delete ON trip_listings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM provider_profiles WHERE id = trip_listings.provider_id AND user_id = auth.uid())
  );

-- ─── trip_members: SELECT by participants + provider, INSERT authenticated, UPDATE own ──

CREATE POLICY trip_members_select ON trip_members
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM trip_listings tl
      JOIN provider_profiles pp ON pp.id = tl.provider_id
      WHERE tl.id = trip_members.trip_id AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY trip_members_insert ON trip_members
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY trip_members_update ON trip_members
  FOR UPDATE USING (auth.uid() = user_id);

-- ─── trip_contributions: SELECT own + provider, INSERT service_role ─────────

CREATE POLICY trip_contributions_select ON trip_contributions
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM trip_listings tl
      JOIN provider_profiles pp ON pp.id = tl.provider_id
      WHERE tl.id = trip_contributions.trip_id AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY trip_contributions_insert ON trip_contributions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ─── trip_payment_schedules: SELECT own + provider, UPDATE service_role ─────

CREATE POLICY trip_schedules_select ON trip_payment_schedules
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM trip_listings tl
      JOIN provider_profiles pp ON pp.id = tl.provider_id
      WHERE tl.id = trip_payment_schedules.trip_id AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY trip_schedules_update ON trip_payment_schedules
  FOR UPDATE USING (auth.role() = 'service_role');

-- ─── media_uploads: SELECT own, INSERT own, DELETE own ─────────────────────

CREATE POLICY media_uploads_select ON media_uploads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY media_uploads_insert ON media_uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY media_uploads_delete ON media_uploads
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Service role full access on all tables ────────────────────────────────

CREATE POLICY provider_profiles_service ON provider_profiles FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_listings_service ON trip_listings FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_members_service ON trip_members FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_contributions_service ON trip_contributions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_schedules_service ON trip_payment_schedules FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY media_uploads_service ON media_uploads FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE trip_listings;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_members;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_contributions;

-- ══════════════════════════════════════════════════════════════════════════════
-- VIEWS
-- ══════════════════════════════════════════════════════════════════════════════

-- Trip summary: aggregated member count, total collected, percentage complete
CREATE OR REPLACE VIEW trip_summary AS
SELECT
  tl.id                       AS trip_id,
  tl.title,
  tl.destination,
  tl.departure_date,
  tl.return_date,
  tl.status,
  tl.price_per_person_cents,
  tl.min_travelers,
  tl.max_travelers,
  tl.escrow_total_cents,
  tl.tandaxn_fee_pct,
  pp.business_name            AS provider_name,
  pp.user_id                  AS provider_user_id,
  COUNT(DISTINCT tm.id)       AS member_count,
  COALESCE(SUM(tc.amount_cents) FILTER (WHERE tc.status = 'completed'), 0) AS total_collected_cents,
  CASE
    WHEN tl.price_per_person_cents * GREATEST(COUNT(DISTINCT tm.id), 1) > 0
    THEN ROUND(
      (COALESCE(SUM(tc.amount_cents) FILTER (WHERE tc.status = 'completed'), 0)::NUMERIC /
       (tl.price_per_person_cents * GREATEST(COUNT(DISTINCT tm.id), 1))) * 100,
      2
    )
    ELSE 0
  END                         AS pct_complete
FROM trip_listings tl
JOIN provider_profiles pp ON pp.id = tl.provider_id
LEFT JOIN trip_members tm ON tm.trip_id = tl.id AND tm.cancelled_at IS NULL
LEFT JOIN trip_contributions tc ON tc.trip_id = tl.id
GROUP BY tl.id, tl.title, tl.destination, tl.departure_date, tl.return_date,
         tl.status, tl.price_per_person_cents, tl.min_travelers, tl.max_travelers,
         tl.escrow_total_cents, tl.tandaxn_fee_pct, pp.business_name, pp.user_id;

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE — 6 tables, 11 indexes, 20+ RLS policies, 5 triggers, 3 realtime,
--         4 storage buckets, 1 view
-- ══════════════════════════════════════════════════════════════════════════════
