-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 065: Trip Organizer
-- Full trip management: itinerary builder, participant tracking, payments,
-- vendors, messaging, storage, and realtime subscriptions
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. TRIPS ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trips (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Trip info
  trip_name             VARCHAR(200) NOT NULL,
  destination           VARCHAR(200) NOT NULL,
  tagline               VARCHAR(300),
  description           TEXT,
  cover_image_url       VARCHAR(500),

  -- Dates
  start_date            DATE,
  end_date              DATE,

  -- Capacity
  max_participants      INTEGER CHECK (max_participants > 0),
  waitlist_enabled      BOOLEAN NOT NULL DEFAULT false,
  registration_deadline DATE,

  -- Pricing
  price_per_person      DECIMAL(10,2) CHECK (price_per_person >= 0),
  payment_type          TEXT CHECK (payment_type IN ('lump_sum','installments')),
  installment_schedule  JSONB NOT NULL DEFAULT '[]'::jsonb,
  deposit_required      BOOLEAN NOT NULL DEFAULT false,
  deposit_amount        DECIMAL(10,2) CHECK (deposit_amount >= 0),
  refund_policy         TEXT CHECK (refund_policy IN ('none','partial','full')),
  refund_cutoff_days    INTEGER CHECK (refund_cutoff_days >= 0),

  -- Inclusions
  whats_included        TEXT,
  whats_excluded        TEXT,

  -- Requirements & communication
  trip_requirements     JSONB NOT NULL DEFAULT '[]'::jsonb,
  messaging_mode        TEXT NOT NULL DEFAULT 'organizer_only'
                        CHECK (messaging_mode IN ('organizer_only','group')),
  auto_reminders        BOOLEAN NOT NULL DEFAULT true,

  -- Circle link (optional)
  circle_id             UUID,

  -- Status & sharing
  status                TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','published','closed','cancelled')),
  shareable_slug        VARCHAR(100) UNIQUE,

  -- Timestamps
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- end_date must be on or after start_date when both are set
  CONSTRAINT chk_trips_date_range CHECK (
    start_date IS NULL OR end_date IS NULL OR end_date >= start_date
  )
);

-- ─── 2. TRIP DAYS ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_days (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id       UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  day_number    INTEGER NOT NULL CHECK (day_number >= 1),
  day_title     VARCHAR(200) NOT NULL,
  day_subtitle  VARCHAR(300),
  theme_note    VARCHAR(200),
  sort_order    INTEGER NOT NULL DEFAULT 0,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(trip_id, day_number)
);

-- ─── 3. TRIP ACTIVITIES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_activities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_day_id     UUID NOT NULL REFERENCES trip_days(id) ON DELETE CASCADE,

  start_time      TIME,
  end_time        TIME,
  activity_name   VARCHAR(200) NOT NULL,
  category_tag    TEXT CHECK (category_tag IN (
                    'Arrival','Breakfast','Beach','Adventure','Culture',
                    'Sailing','Dinner','Nightlife','Logistics',
                    'Departure','Accommodation','Other'
                  )),
  description     TEXT,
  organizer_note  TEXT,
  is_optional     BOOLEAN NOT NULL DEFAULT false,
  location_name   VARCHAR(200),
  location_address VARCHAR(400),
  photo_url       VARCHAR(500),
  sort_order      INTEGER NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 4. TRIP PARTICIPANTS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_participants (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Registration
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','waitlist','cancelled')),
  registered_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at        TIMESTAMPTZ,

  -- Payment
  total_paid          DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (total_paid >= 0),
  payment_status      TEXT NOT NULL DEFAULT 'unpaid'
                      CHECK (payment_status IN ('unpaid','deposit_paid','partial','paid_in_full')),

  -- Documents & cancellation
  documents_complete  BOOLEAN NOT NULL DEFAULT false,
  cancellation_reason TEXT,
  refund_amount       DECIMAL(10,2),
  xn_score_at_join    INTEGER,
  notes               TEXT,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(trip_id, user_id)
);

-- ─── 5. TRIP PARTICIPANT SUBMISSIONS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_participant_submissions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_participant_id   UUID NOT NULL REFERENCES trip_participants(id) ON DELETE CASCADE,

  field_key             VARCHAR(100) NOT NULL,
  field_type            TEXT CHECK (field_type IN ('text','file','select','signature')),
  text_value            TEXT,
  file_url              VARCHAR(500),
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by_organizer BOOLEAN NOT NULL DEFAULT false,

  UNIQUE(trip_participant_id, field_key)
);

-- ─── 6. TRIP PAYMENTS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_payments (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_participant_id     UUID NOT NULL REFERENCES trip_participants(id) ON DELETE CASCADE,

  amount                  DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_type            TEXT NOT NULL CHECK (payment_type IN ('deposit','installment','full','refund')),
  installment_number      INTEGER,
  stripe_payment_intent_id TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','succeeded','failed','refunded')),
  paid_at                 TIMESTAMPTZ,
  due_date                DATE,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 7. TRIP VENDORS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_vendors (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id           UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,

  vendor_type       TEXT CHECK (vendor_type IN ('hotel','transport','airline','activity','other')),
  vendor_name       VARCHAR(200) NOT NULL,
  booking_reference VARCHAR(200),
  contact_name      VARCHAR(200),
  contact_phone     VARCHAR(50),
  contact_email     VARCHAR(200),
  notes             TEXT,
  amount_paid       DECIMAL(10,2) NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. TRIP MESSAGES ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trip_messages (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id           UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sender_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,

  recipient_type    TEXT NOT NULL CHECK (recipient_type IN ('all','individual','organizer_only')),
  recipient_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message_body      TEXT NOT NULL,
  is_system_message BOOLEAN NOT NULL DEFAULT false,
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at           TIMESTAMPTZ,

  -- If sending to an individual, recipient_id must be provided
  CONSTRAINT chk_messages_individual_recipient CHECK (
    recipient_type != 'individual' OR recipient_id IS NOT NULL
  )
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- trips
CREATE INDEX idx_trips_organizer ON trips(organizer_id);
CREATE INDEX idx_trips_status ON trips(status);
CREATE INDEX idx_trips_slug ON trips(shareable_slug);
CREATE INDEX idx_trips_start_date ON trips(start_date);

-- trip_days
CREATE INDEX idx_trip_days_trip_sort ON trip_days(trip_id, sort_order);

-- trip_activities
CREATE INDEX idx_trip_activities_day_sort ON trip_activities(trip_day_id, sort_order);

-- trip_participants
CREATE INDEX idx_trip_participants_trip_status ON trip_participants(trip_id, status);
CREATE INDEX idx_trip_participants_user ON trip_participants(user_id);

-- trip_participant_submissions
CREATE INDEX idx_trip_submissions_participant ON trip_participant_submissions(trip_participant_id);

-- trip_payments
CREATE INDEX idx_trip_payments_participant ON trip_payments(trip_participant_id);
CREATE INDEX idx_trip_payments_status ON trip_payments(status);
CREATE INDEX idx_trip_payments_due_date ON trip_payments(due_date);

-- trip_vendors
CREATE INDEX idx_trip_vendors_trip ON trip_vendors(trip_id);

-- trip_messages
CREATE INDEX idx_trip_messages_trip_sent ON trip_messages(trip_id, sent_at DESC);

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_days FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_activities FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_participants FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_participant_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_participant_submissions FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_payments FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_vendors FORCE ROW LEVEL SECURITY;
ALTER TABLE trip_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_messages FORCE ROW LEVEL SECURITY;

-- ─── trips: organizer ALL; public SELECT published; participants SELECT joined ─

CREATE POLICY trips_organizer_all ON trips
  FOR ALL USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY trips_public_select ON trips
  FOR SELECT USING (status = 'published');

CREATE POLICY trips_participant_select ON trips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_participants tp
      WHERE tp.trip_id = trips.id AND tp.user_id = auth.uid()
    )
  );

-- ─── trip_days: organizer ALL; public SELECT on published trips ───────────────

CREATE POLICY trip_days_organizer_all ON trip_days
  FOR ALL USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_days.trip_id AND organizer_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_days.trip_id AND organizer_id = auth.uid())
  );

CREATE POLICY trip_days_public_select ON trip_days
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_days.trip_id AND status = 'published')
  );

-- ─── trip_activities: organizer ALL; public SELECT on published trips ─────────

CREATE POLICY trip_activities_organizer_all ON trip_activities
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = trip_activities.trip_day_id AND t.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = trip_activities.trip_day_id AND t.organizer_id = auth.uid()
    )
  );

CREATE POLICY trip_activities_public_select ON trip_activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_days td
      JOIN trips t ON t.id = td.trip_id
      WHERE td.id = trip_activities.trip_day_id AND t.status = 'published'
    )
  );

-- ─── trip_participants: users INSERT own; users SELECT own; organizer SELECT/UPDATE ─

CREATE POLICY trip_participants_user_insert ON trip_participants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY trip_participants_user_select ON trip_participants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY trip_participants_organizer_select ON trip_participants
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_participants.trip_id AND organizer_id = auth.uid())
  );

CREATE POLICY trip_participants_organizer_update ON trip_participants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_participants.trip_id AND organizer_id = auth.uid())
  );

-- ─── trip_participant_submissions: users INSERT/UPDATE/SELECT own; organizer SELECT/UPDATE ─

CREATE POLICY trip_submissions_user_insert ON trip_participant_submissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_participants tp
      WHERE tp.id = trip_participant_submissions.trip_participant_id AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY trip_submissions_user_update ON trip_participant_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trip_participants tp
      WHERE tp.id = trip_participant_submissions.trip_participant_id AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY trip_submissions_user_select ON trip_participant_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_participants tp
      WHERE tp.id = trip_participant_submissions.trip_participant_id AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY trip_submissions_organizer_select ON trip_participant_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_participants tp
      JOIN trips t ON t.id = tp.trip_id
      WHERE tp.id = trip_participant_submissions.trip_participant_id AND t.organizer_id = auth.uid()
    )
  );

CREATE POLICY trip_submissions_organizer_update ON trip_participant_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM trip_participants tp
      JOIN trips t ON t.id = tp.trip_id
      WHERE tp.id = trip_participant_submissions.trip_participant_id AND t.organizer_id = auth.uid()
    )
  );

-- ─── trip_payments: users SELECT own; organizer SELECT; service_role INSERT ───

CREATE POLICY trip_payments_user_select ON trip_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_participants tp
      WHERE tp.id = trip_payments.trip_participant_id AND tp.user_id = auth.uid()
    )
  );

CREATE POLICY trip_payments_organizer_select ON trip_payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_participants tp
      JOIN trips t ON t.id = tp.trip_id
      WHERE tp.id = trip_payments.trip_participant_id AND t.organizer_id = auth.uid()
    )
  );

CREATE POLICY trip_payments_service_insert ON trip_payments
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ─── trip_vendors: organizer ALL ──────────────────────────────────────────────

CREATE POLICY trip_vendors_organizer_all ON trip_vendors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_vendors.trip_id AND organizer_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_vendors.trip_id AND organizer_id = auth.uid())
  );

-- ─── trip_messages: organizer ALL; participants SELECT broadcasts + own DMs; participants INSERT organizer_only ─

CREATE POLICY trip_messages_organizer_all ON trip_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_messages.trip_id AND organizer_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM trips WHERE id = trip_messages.trip_id AND organizer_id = auth.uid())
  );

CREATE POLICY trip_messages_participant_select ON trip_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM trip_participants tp
      WHERE tp.trip_id = trip_messages.trip_id AND tp.user_id = auth.uid()
    )
    AND (
      recipient_type = 'all'
      OR (recipient_type = 'individual' AND (recipient_id = auth.uid() OR sender_id = auth.uid()))
    )
  );

CREATE POLICY trip_messages_participant_insert ON trip_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND recipient_type = 'organizer_only'
    AND EXISTS (
      SELECT 1 FROM trip_participants tp
      WHERE tp.trip_id = trip_messages.trip_id AND tp.user_id = auth.uid()
    )
  );

-- ─── Service role full access on all tables ───────────────────────────────────

CREATE POLICY trips_service ON trips FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_days_service ON trip_days FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_activities_service ON trip_activities FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_participants_service ON trip_participants FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_submissions_service ON trip_participant_submissions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_payments_service ON trip_payments FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_vendors_service ON trip_vendors FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY trip_messages_service ON trip_messages FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TRIGGER trg_trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_trip_days_updated_at
  BEFORE UPDATE ON trip_days
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_trip_activities_updated_at
  BEFORE UPDATE ON trip_activities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_trip_participants_updated_at
  BEFORE UPDATE ON trip_participants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_trip_vendors_updated_at
  BEFORE UPDATE ON trip_vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE trip_participants;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE trip_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE trip_payments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- SUPABASE STORAGE BUCKET
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-assets', 'trip-assets', true)
ON CONFLICT (id) DO NOTHING;

-- ─── Storage Policies: trip-assets ────────────────────────────────────────────

-- Public read for covers and activity photos
CREATE POLICY storage_trip_assets_select ON storage.objects
  FOR SELECT USING (bucket_id = 'trip-assets');

-- Authenticated users can upload
CREATE POLICY storage_trip_assets_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'trip-assets'
    AND auth.role() = 'authenticated'
  );

-- Owners can update their own uploads
CREATE POLICY storage_trip_assets_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'trip-assets'
    AND auth.uid() = owner
  )
  WITH CHECK (
    bucket_id = 'trip-assets'
    AND auth.uid() = owner
  );

-- Owners can delete their own uploads
CREATE POLICY storage_trip_assets_delete ON storage.objects
  FOR DELETE USING (
    bucket_id = 'trip-assets'
    AND auth.uid() = owner
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE — 8 tables, 14 indexes, 28 RLS policies, 5 triggers, 3 realtime,
--         1 storage bucket (trip-assets: covers, activities, participant-docs)
-- ══════════════════════════════════════════════════════════════════════════════
