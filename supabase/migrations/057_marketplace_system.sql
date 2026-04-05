-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 057: Marketplace System
-- Stores, services, bookings, CSV uploads, SMS invites, reviews, requests
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── ENUM-LIKE DOMAINS ──────────────────────────────────────────────────────

-- Provider categories (8 launch categories)
-- food, beauty, travel, shipping, finance, events, realestate, health

-- Store status lifecycle: draft → claimed → active → suspended → banned
-- Badge tiers: claimed → trusted → verified

-- ─── 1. MARKETPLACE STORES ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_stores (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Business info
  business_name   TEXT NOT NULL,
  owner_name      TEXT NOT NULL,
  phone           TEXT NOT NULL,
  email           TEXT,
  city            TEXT NOT NULL,
  state           TEXT,
  neighborhood    TEXT,
  category        TEXT NOT NULL CHECK (category IN ('food','beauty','travel','shipping','finance','events','realestate','health','other')),
  description     TEXT,
  photo_url       TEXT,
  emoji           TEXT DEFAULT '🏪',

  -- Member discount
  member_discount_pct   INTEGER NOT NULL DEFAULT 10 CHECK (member_discount_pct BETWEEN 0 AND 50),
  exclusive_offer       TEXT,

  -- Status & verification
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','claimed','active','suspended','banned')),
  badge           TEXT NOT NULL DEFAULT 'claimed' CHECK (badge IN ('claimed','trusted','verified')),

  -- Claim flow (Franck creates draft → provider claims later)
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  claimed_at      TIMESTAMPTZ,
  claim_token     TEXT UNIQUE,

  -- Featured listing ($49/month)
  is_featured     BOOLEAN NOT NULL DEFAULT false,
  featured_until  TIMESTAMPTZ,

  -- Stats (denormalized, trigger-updated)
  total_reviews   INTEGER NOT NULL DEFAULT 0,
  avg_rating      NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_bookings  INTEGER NOT NULL DEFAULT 0,
  profile_views   INTEGER NOT NULL DEFAULT 0,

  -- Circles managed by this store owner
  managed_circles JSONB DEFAULT '[]'::jsonb,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. STORE SERVICES / PRODUCTS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES marketplace_stores(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  description     TEXT,
  price_cents     INTEGER NOT NULL CHECK (price_cents > 0),
  emoji           TEXT DEFAULT '✂️',
  category        TEXT,

  -- Availability
  is_available    BOOLEAN NOT NULL DEFAULT true,
  is_popular      BOOLEAN NOT NULL DEFAULT false,
  stock_status    TEXT DEFAULT 'available' CHECK (stock_status IN ('available','limited','sold_out')),

  -- Duration (for appointments)
  duration_minutes INTEGER,

  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 3. STORE REVIEWS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  reviewer_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text     TEXT,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(store_id, reviewer_id)
);

-- ─── 4. BOOKINGS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  service_id      UUID REFERENCES store_services(id) ON DELETE SET NULL,
  member_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Service details (denormalized for history)
  service_name    TEXT NOT NULL,
  original_amount_cents INTEGER NOT NULL,
  discount_amount_cents INTEGER NOT NULL DEFAULT 0,
  final_amount_cents    INTEGER NOT NULL,

  -- Payment
  payment_type    TEXT NOT NULL DEFAULT 'immediate' CHECK (payment_type IN ('immediate','payout_day')),
  payout_date     DATE,                -- when payment_type = 'payout_day'
  circle_id       UUID,                -- which circle's payout funds this
  stripe_payment_intent_id TEXT,

  -- Status
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed','cancelled','refunded','payment_due','payment_failed')),

  -- Escrow (for amounts >= $200)
  is_escrow       BOOLEAN NOT NULL DEFAULT false,
  escrow_released_at TIMESTAMPTZ,

  -- Schedule
  appointment_date TIMESTAMPTZ,
  notes           TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 5. MEMBER INVITES (CSV + SMS) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS member_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  invited_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Invitee info (from CSV or manual entry)
  first_name      TEXT NOT NULL,
  last_name       TEXT,
  phone           TEXT NOT NULL,
  circle_name     TEXT,

  -- Invite token & link
  token           TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  invite_link     TEXT GENERATED ALWAYS AS ('https://tandaxn.app/join/' || token) STORED,

  -- SMS
  sms_status      TEXT NOT NULL DEFAULT 'pending' CHECK (sms_status IN ('pending','sent','delivered','failed','opted_out')),
  sms_language    TEXT NOT NULL DEFAULT 'fr' CHECK (sms_language IN ('fr','en','both')),
  sms_sent_at     TIMESTAMPTZ,
  sms_message_sid TEXT,                -- Twilio message SID

  -- Conversion
  joined_at       TIMESTAMPTZ,
  joined_user_id  UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Batch tracking
  csv_upload_id   UUID,                -- FK added after csv_uploads table
  batch_id        TEXT,                -- groups invites sent together

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 6. CSV UPLOADS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS csv_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  uploaded_by     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  file_name       TEXT NOT NULL,
  file_url        TEXT,
  total_rows      INTEGER NOT NULL DEFAULT 0,
  valid_rows      INTEGER NOT NULL DEFAULT 0,
  duplicate_rows  INTEGER NOT NULL DEFAULT 0,
  error_rows      INTEGER NOT NULL DEFAULT 0,
  errors          JSONB DEFAULT '[]'::jsonb,

  -- Processing
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  processed_at    TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from member_invites to csv_uploads
ALTER TABLE member_invites
  ADD CONSTRAINT fk_member_invites_csv_upload
  FOREIGN KEY (csv_upload_id) REFERENCES csv_uploads(id) ON DELETE SET NULL;

-- ─── 7. PROVIDER REQUESTS ("Request a Provider") ───────────────────────────

CREATE TABLE IF NOT EXISTS provider_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  category        TEXT NOT NULL CHECK (category IN ('food','beauty','travel','shipping','finance','events','realestate','health','other')),
  city            TEXT NOT NULL,
  description     TEXT,

  -- Aggregation (5 requests = recruitment signal)
  is_signal_sent  BOOLEAN NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 8. STORE INQUIRIES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_inquiries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  message         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','read','replied')),
  reply           TEXT,
  replied_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 9. DISPUTES ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID NOT NULL REFERENCES marketplace_bookings(id) ON DELETE CASCADE,
  store_id        UUID NOT NULL REFERENCES marketplace_stores(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  stage           INTEGER NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 3),
  description     TEXT NOT NULL,
  resolution      TEXT,

  -- Stage 2: Elder mediation
  elder_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  elder_recommendation TEXT,

  -- Stage 3: Admin escalation
  admin_id        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_decision  TEXT,

  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','mediation','escalated','resolved','closed')),
  resolved_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 10. MARKET INSIGHTS (Reference Data) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS market_insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city            TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('food','beauty','travel','shipping','finance','events','realestate','health','other')),

  -- City-level data
  diaspora_population   INTEGER NOT NULL DEFAULT 0,
  active_members        INTEGER NOT NULL DEFAULT 0,
  annual_spend_millions NUMERIC(6,2) NOT NULL DEFAULT 0,

  -- Category-level data
  avg_order_value_cents INTEGER NOT NULL DEFAULT 0,
  supply_pct            INTEGER NOT NULL DEFAULT 0,
  provider_count        INTEGER NOT NULL DEFAULT 0,
  spend_multiplier      NUMERIC(3,2) NOT NULL DEFAULT 1.0,

  -- Community breakdown
  community_breakdown   JSONB DEFAULT '[]'::jsonb,

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(city, category)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

-- marketplace_stores
CREATE INDEX idx_stores_owner ON marketplace_stores(owner_id);
CREATE INDEX idx_stores_category ON marketplace_stores(category);
CREATE INDEX idx_stores_city ON marketplace_stores(city);
CREATE INDEX idx_stores_status ON marketplace_stores(status) WHERE status = 'active';
CREATE INDEX idx_stores_featured ON marketplace_stores(is_featured, featured_until) WHERE is_featured = true;
CREATE INDEX idx_stores_badge ON marketplace_stores(badge);
CREATE INDEX idx_stores_claim_token ON marketplace_stores(claim_token) WHERE claim_token IS NOT NULL;

-- store_services
CREATE INDEX idx_store_services_store ON store_services(store_id, sort_order);
CREATE INDEX idx_store_services_available ON store_services(store_id) WHERE is_available = true;

-- store_reviews
CREATE INDEX idx_store_reviews_store ON store_reviews(store_id, created_at DESC);
CREATE INDEX idx_store_reviews_reviewer ON store_reviews(reviewer_id);

-- marketplace_bookings
CREATE INDEX idx_bookings_store ON marketplace_bookings(store_id, created_at DESC);
CREATE INDEX idx_bookings_member ON marketplace_bookings(member_id, created_at DESC);
CREATE INDEX idx_bookings_status ON marketplace_bookings(status) WHERE status IN ('pending','confirmed','payment_due');
CREATE INDEX idx_bookings_payout_date ON marketplace_bookings(payout_date) WHERE payment_type = 'payout_day' AND status = 'payment_due';
CREATE INDEX idx_bookings_circle ON marketplace_bookings(circle_id) WHERE circle_id IS NOT NULL;

-- member_invites
CREATE INDEX idx_invites_store ON member_invites(store_id);
CREATE INDEX idx_invites_phone ON member_invites(phone);
CREATE INDEX idx_invites_token ON member_invites(token);
CREATE INDEX idx_invites_sms_status ON member_invites(sms_status) WHERE sms_status = 'pending';
CREATE INDEX idx_invites_csv ON member_invites(csv_upload_id) WHERE csv_upload_id IS NOT NULL;
CREATE INDEX idx_invites_batch ON member_invites(batch_id) WHERE batch_id IS NOT NULL;

-- csv_uploads
CREATE INDEX idx_csv_uploads_store ON csv_uploads(store_id, created_at DESC);

-- provider_requests
CREATE INDEX idx_provider_requests_category_city ON provider_requests(category, city);

-- store_inquiries
CREATE INDEX idx_inquiries_store ON store_inquiries(store_id, created_at DESC);
CREATE INDEX idx_inquiries_user ON store_inquiries(user_id);

-- marketplace_disputes
CREATE INDEX idx_disputes_booking ON marketplace_disputes(booking_id);
CREATE INDEX idx_disputes_status ON marketplace_disputes(status) WHERE status != 'closed';

-- market_insights
CREATE INDEX idx_market_insights_city ON market_insights(city);

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_marketplace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON marketplace_stores
  FOR EACH ROW EXECUTE FUNCTION set_marketplace_updated_at();

CREATE TRIGGER trg_store_services_updated_at
  BEFORE UPDATE ON store_services
  FOR EACH ROW EXECUTE FUNCTION set_marketplace_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON marketplace_bookings
  FOR EACH ROW EXECUTE FUNCTION set_marketplace_updated_at();

CREATE TRIGGER trg_member_invites_updated_at
  BEFORE UPDATE ON member_invites
  FOR EACH ROW EXECUTE FUNCTION set_marketplace_updated_at();

CREATE TRIGGER trg_store_reviews_updated_at
  BEFORE UPDATE ON store_reviews
  FOR EACH ROW EXECUTE FUNCTION set_marketplace_updated_at();

CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON marketplace_disputes
  FOR EACH ROW EXECUTE FUNCTION set_marketplace_updated_at();

-- Auto-update store stats on new review
CREATE OR REPLACE FUNCTION update_store_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE marketplace_stores SET
    total_reviews = (SELECT COUNT(*) FROM store_reviews WHERE store_id = NEW.store_id),
    avg_rating = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM store_reviews WHERE store_id = NEW.store_id), 0)
  WHERE id = NEW.store_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_store_reviews_stats
  AFTER INSERT OR DELETE ON store_reviews
  FOR EACH ROW EXECUTE FUNCTION update_store_review_stats();

-- Auto-increment store booking count
CREATE OR REPLACE FUNCTION update_store_booking_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE marketplace_stores SET total_bookings = total_bookings + 1 WHERE id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_store_bookings_count
  AFTER INSERT ON marketplace_bookings
  FOR EACH ROW EXECUTE FUNCTION update_store_booking_count();

-- Auto-set escrow for bookings >= $200 (20000 cents)
CREATE OR REPLACE FUNCTION auto_set_escrow()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.final_amount_cents >= 20000 THEN
    NEW.is_escrow = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bookings_auto_escrow
  BEFORE INSERT ON marketplace_bookings
  FOR EACH ROW EXECUTE FUNCTION auto_set_escrow();

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE marketplace_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_stores FORCE ROW LEVEL SECURITY;
ALTER TABLE store_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_services FORCE ROW LEVEL SECURITY;
ALTER TABLE store_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE marketplace_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE member_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_invites FORCE ROW LEVEL SECURITY;
ALTER TABLE csv_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_uploads FORCE ROW LEVEL SECURITY;
ALTER TABLE provider_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE store_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_inquiries FORCE ROW LEVEL SECURITY;
ALTER TABLE marketplace_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_disputes FORCE ROW LEVEL SECURITY;
ALTER TABLE market_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_insights FORCE ROW LEVEL SECURITY;

-- Public read for active stores and their services (marketplace is public-facing)
CREATE POLICY stores_public_read ON marketplace_stores
  FOR SELECT USING (status IN ('active','claimed'));

CREATE POLICY store_services_public_read ON store_services
  FOR SELECT USING (true);

CREATE POLICY market_insights_public_read ON market_insights
  FOR SELECT USING (true);

-- Owner manages own store
CREATE POLICY stores_owner_all ON marketplace_stores
  FOR ALL USING (auth.uid() = owner_id OR auth.uid() = created_by)
  WITH CHECK (auth.uid() = owner_id OR auth.uid() = created_by);

-- Authenticated users can review, book, inquire
CREATE POLICY reviews_member_select ON store_reviews
  FOR SELECT USING (true);

CREATE POLICY reviews_member_insert ON store_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY reviews_member_update ON store_reviews
  FOR UPDATE USING (auth.uid() = reviewer_id);

CREATE POLICY bookings_member_select ON marketplace_bookings
  FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY bookings_store_owner_select ON marketplace_bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM marketplace_stores WHERE id = marketplace_bookings.store_id AND owner_id = auth.uid())
  );

CREATE POLICY bookings_member_insert ON marketplace_bookings
  FOR INSERT WITH CHECK (auth.uid() = member_id);

CREATE POLICY inquiries_member_select ON store_inquiries
  FOR SELECT USING (auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM marketplace_stores WHERE id = store_inquiries.store_id AND owner_id = auth.uid())
  );

CREATE POLICY inquiries_member_insert ON store_inquiries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY inquiries_owner_update ON store_inquiries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM marketplace_stores WHERE id = store_inquiries.store_id AND owner_id = auth.uid())
  );

-- Member invites: store owner manages
CREATE POLICY invites_owner_all ON member_invites
  FOR ALL USING (
    auth.uid() = invited_by OR
    EXISTS (SELECT 1 FROM marketplace_stores WHERE id = member_invites.store_id AND owner_id = auth.uid())
  ) WITH CHECK (
    auth.uid() = invited_by OR
    EXISTS (SELECT 1 FROM marketplace_stores WHERE id = member_invites.store_id AND owner_id = auth.uid())
  );

-- CSV uploads: store owner manages
CREATE POLICY csv_uploads_owner_all ON csv_uploads
  FOR ALL USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

-- Provider requests: user manages own
CREATE POLICY provider_requests_member ON provider_requests
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Disputes: participants can see own
CREATE POLICY disputes_participant_select ON marketplace_disputes
  FOR SELECT USING (
    auth.uid() = customer_id OR
    auth.uid() = elder_id OR
    EXISTS (SELECT 1 FROM marketplace_stores WHERE id = marketplace_disputes.store_id AND owner_id = auth.uid())
  );

CREATE POLICY disputes_customer_insert ON marketplace_disputes
  FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Service role full access on all tables
CREATE POLICY stores_service ON marketplace_stores FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY store_services_service ON store_services FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY reviews_service ON store_reviews FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY bookings_service ON marketplace_bookings FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY invites_service ON member_invites FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY csv_uploads_service ON csv_uploads FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY provider_requests_service ON provider_requests FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY inquiries_service ON store_inquiries FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY disputes_service ON marketplace_disputes FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY market_insights_service ON market_insights FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE member_invites;
ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_stores;

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED: Market Insights (Reference Data)
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO market_insights (city, category, diaspora_population, active_members, annual_spend_millions, avg_order_value_cents, supply_pct, provider_count, spend_multiplier, community_breakdown) VALUES
  -- Atlanta
  ('atlanta', 'food',       14200, 840,  2.10, 6500,  18, 4, 1.00, '[{"name":"Ivorian","pop":3800},{"name":"Ghanaian","pop":3600},{"name":"Nigerian","pop":4500},{"name":"Senegalese","pop":2900},{"name":"Other West African","pop":2200}]'::jsonb),
  ('atlanta', 'beauty',     14200, 840,  1.68, 9500,  22, 6, 0.80, '[]'::jsonb),
  ('atlanta', 'travel',     14200, 840,  2.94, 48000, 8,  2, 1.40, '[]'::jsonb),
  ('atlanta', 'shipping',   14200, 840,  1.89, 12000, 12, 3, 0.90, '[]'::jsonb),
  ('atlanta', 'finance',    14200, 840,  2.31, 25000, 28, 7, 1.10, '[]'::jsonb),
  ('atlanta', 'events',     14200, 840,  2.52, 38000, 10, 2, 1.20, '[]'::jsonb),
  ('atlanta', 'realestate', 14200, 840,  3.36, 65000, 32, 8, 1.60, '[]'::jsonb),
  ('atlanta', 'health',     14200, 840,  1.47, 11000, 15, 3, 0.70, '[]'::jsonb),
  -- Houston
  ('houston', 'food',       18500, 1120, 2.80, 6500,  18, 5, 1.00, '[]'::jsonb),
  ('houston', 'beauty',     18500, 1120, 2.24, 9500,  22, 7, 0.80, '[]'::jsonb),
  ('houston', 'travel',     18500, 1120, 3.92, 48000, 8,  2, 1.40, '[]'::jsonb),
  ('houston', 'shipping',   18500, 1120, 2.52, 12000, 12, 4, 0.90, '[]'::jsonb),
  ('houston', 'finance',    18500, 1120, 3.08, 25000, 28, 8, 1.10, '[]'::jsonb),
  ('houston', 'events',     18500, 1120, 3.36, 38000, 10, 3, 1.20, '[]'::jsonb),
  ('houston', 'realestate', 18500, 1120, 4.48, 65000, 32, 10, 1.60, '[]'::jsonb),
  ('houston', 'health',     18500, 1120, 1.96, 11000, 15, 4, 0.70, '[]'::jsonb),
  -- DC
  ('dc', 'food',       22000, 1400, 3.40, 6500,  18, 6, 1.00, '[]'::jsonb),
  ('dc', 'beauty',     22000, 1400, 2.72, 9500,  22, 8, 0.80, '[]'::jsonb),
  ('dc', 'travel',     22000, 1400, 4.76, 48000, 8,  3, 1.40, '[]'::jsonb),
  ('dc', 'shipping',   22000, 1400, 3.06, 12000, 12, 5, 0.90, '[]'::jsonb),
  ('dc', 'finance',    22000, 1400, 3.74, 25000, 28, 10, 1.10, '[]'::jsonb),
  ('dc', 'events',     22000, 1400, 4.08, 38000, 10, 3, 1.20, '[]'::jsonb),
  ('dc', 'realestate', 22000, 1400, 5.44, 65000, 32, 12, 1.60, '[]'::jsonb),
  ('dc', 'health',     22000, 1400, 2.38, 11000, 15, 5, 0.70, '[]'::jsonb),
  -- New York
  ('newyork', 'food',       38000, 2200, 5.80, 6500,  18, 10, 1.00, '[]'::jsonb),
  ('newyork', 'beauty',     38000, 2200, 4.64, 9500,  22, 13, 0.80, '[]'::jsonb),
  ('newyork', 'travel',     38000, 2200, 8.12, 48000, 8,  4, 1.40, '[]'::jsonb),
  ('newyork', 'shipping',   38000, 2200, 5.22, 12000, 12, 8, 0.90, '[]'::jsonb),
  ('newyork', 'finance',    38000, 2200, 6.38, 25000, 28, 16, 1.10, '[]'::jsonb),
  ('newyork', 'events',     38000, 2200, 6.96, 38000, 10, 5, 1.20, '[]'::jsonb),
  ('newyork', 'realestate', 38000, 2200, 9.28, 65000, 32, 20, 1.60, '[]'::jsonb),
  ('newyork', 'health',     38000, 2200, 4.06, 11000, 15, 8, 0.70, '[]'::jsonb),
  -- Chicago
  ('chicago', 'food',       11000, 620,  1.70, 6500,  18, 3, 1.00, '[]'::jsonb),
  ('chicago', 'beauty',     11000, 620,  1.36, 9500,  22, 4, 0.80, '[]'::jsonb),
  ('chicago', 'travel',     11000, 620,  2.38, 48000, 8,  1, 1.40, '[]'::jsonb),
  ('chicago', 'shipping',   11000, 620,  1.53, 12000, 12, 2, 0.90, '[]'::jsonb),
  ('chicago', 'finance',    11000, 620,  1.87, 25000, 28, 5, 1.10, '[]'::jsonb),
  ('chicago', 'events',     11000, 620,  2.04, 38000, 10, 2, 1.20, '[]'::jsonb),
  ('chicago', 'realestate', 11000, 620,  2.72, 65000, 32, 6, 1.60, '[]'::jsonb),
  ('chicago', 'health',     11000, 620,  1.19, 11000, 15, 2, 0.70, '[]'::jsonb),
  -- Dallas
  ('dallas', 'food',       13500, 780,  2.00, 6500,  18, 4, 1.00, '[]'::jsonb),
  ('dallas', 'beauty',     13500, 780,  1.60, 9500,  22, 5, 0.80, '[]'::jsonb),
  ('dallas', 'travel',     13500, 780,  2.80, 48000, 8,  2, 1.40, '[]'::jsonb),
  ('dallas', 'shipping',   13500, 780,  1.80, 12000, 12, 3, 0.90, '[]'::jsonb),
  ('dallas', 'finance',    13500, 780,  2.20, 25000, 28, 6, 1.10, '[]'::jsonb),
  ('dallas', 'events',     13500, 780,  2.40, 38000, 10, 2, 1.20, '[]'::jsonb),
  ('dallas', 'realestate', 13500, 780,  3.20, 65000, 32, 7, 1.60, '[]'::jsonb),
  ('dallas', 'health',     13500, 780,  1.40, 11000, 15, 3, 0.70, '[]'::jsonb),
  -- Miami
  ('miami', 'food',       9800,  560,  1.50, 6500,  18, 3, 1.00, '[]'::jsonb),
  ('miami', 'beauty',     9800,  560,  1.20, 9500,  22, 4, 0.80, '[]'::jsonb),
  ('miami', 'travel',     9800,  560,  2.10, 48000, 8,  1, 1.40, '[]'::jsonb),
  ('miami', 'shipping',   9800,  560,  1.35, 12000, 12, 2, 0.90, '[]'::jsonb),
  ('miami', 'finance',    9800,  560,  1.65, 25000, 28, 4, 1.10, '[]'::jsonb),
  ('miami', 'events',     9800,  560,  1.80, 38000, 10, 2, 1.20, '[]'::jsonb),
  ('miami', 'realestate', 9800,  560,  2.40, 65000, 32, 5, 1.60, '[]'::jsonb),
  ('miami', 'health',     9800,  560,  1.05, 11000, 15, 2, 0.70, '[]'::jsonb),
  -- Charlotte
  ('charlotte', 'food',       7200,  410,  1.10, 6500,  18, 2, 1.00, '[]'::jsonb),
  ('charlotte', 'beauty',     7200,  410,  0.88, 9500,  22, 3, 0.80, '[]'::jsonb),
  ('charlotte', 'travel',     7200,  410,  1.54, 48000, 8,  1, 1.40, '[]'::jsonb),
  ('charlotte', 'shipping',   7200,  410,  0.99, 12000, 12, 2, 0.90, '[]'::jsonb),
  ('charlotte', 'finance',    7200,  410,  1.21, 25000, 28, 3, 1.10, '[]'::jsonb),
  ('charlotte', 'events',     7200,  410,  1.32, 38000, 10, 1, 1.20, '[]'::jsonb),
  ('charlotte', 'realestate', 7200,  410,  1.76, 65000, 32, 4, 1.60, '[]'::jsonb),
  ('charlotte', 'health',     7200,  410,  0.77, 11000, 15, 2, 0.70, '[]'::jsonb)
ON CONFLICT (city, category) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE — 10 tables, 30+ indexes, 25+ RLS policies, 8 triggers, 3 realtime
-- ══════════════════════════════════════════════════════════════════════════════
