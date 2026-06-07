-- ============================================================================
-- Migration 129: SyncStream worship extensions
-- ============================================================================
-- Four new tables + eight RPCs. All wallet debits flow through the same
-- SELECT-FOR-UPDATE-then-decrement pattern the migration-121 referral
-- processor uses, so we keep one consistent wallet-modification idiom.
--
--   user_reaction_preferences   per-user emoji -> cents map
--   sync_room_candle_requests   pending / lit / declined candle asks
--   sync_room_mass_intentions   pending / celebrated mass intentions
--   sync_room_donations         immutable ledger of reaction donations
--
-- We deliberately reuse the existing public.notifications table for
-- host-to-user templated responses (mark_*_lit/celebrated insert one
-- row); no new user_notifications table needed.
--
-- Worship rooms get a default mass_fee_cents merged into their
-- room_settings via a back-fill at the end so the client doesn't have
-- to know the default.
--
-- All wallet RPCs return the new main_balance_cents so the client can
-- update the visible balance without a separate fetch.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_reaction_preferences (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{"🙏":1,"❤️":5,"🕊️":10}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sync_room_candle_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES public.sync_rooms(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intention       TEXT NOT NULL,
  donation_cents  INTEGER NOT NULL DEFAULT 0 CHECK (donation_cents >= 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','lit','declined')),
  lit_at          TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_candle_requests_room_status
  ON public.sync_room_candle_requests (room_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sync_room_mass_intentions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID NOT NULL REFERENCES public.sync_rooms(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  is_deceased     BOOLEAN NOT NULL DEFAULT false,
  preferred_date  DATE NOT NULL,
  donation_cents  INTEGER NOT NULL DEFAULT 0 CHECK (donation_cents >= 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','celebrated')),
  celebrated_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mass_intentions_room_status
  ON public.sync_room_mass_intentions (room_id, status, preferred_date);

CREATE TABLE IF NOT EXISTS public.sync_room_donations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID REFERENCES public.sync_rooms(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji         TEXT NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_donations_room ON public.sync_room_donations (room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_user ON public.sync_room_donations (user_id, created_at DESC);


-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_reaction_preferences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_room_candle_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_room_mass_intentions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_room_donations        ENABLE ROW LEVEL SECURITY;

-- reaction prefs: only the user reads/writes their own. service_role
-- bypasses for any future analytics job.
DROP POLICY IF EXISTS service_all_reaction_prefs ON public.user_reaction_preferences;
CREATE POLICY service_all_reaction_prefs ON public.user_reaction_preferences
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS owner_rw_reaction_prefs ON public.user_reaction_preferences;
CREATE POLICY owner_rw_reaction_prefs ON public.user_reaction_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- candle requests: the requesting user reads + the host of the room
-- reads. Inserts go through the RPC (which is SECURITY DEFINER and
-- bypasses this), so we don't need an INSERT policy from clients.
DROP POLICY IF EXISTS service_all_candle ON public.sync_room_candle_requests;
CREATE POLICY service_all_candle ON public.sync_room_candle_requests
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS participants_read_candle ON public.sync_room_candle_requests;
CREATE POLICY participants_read_candle ON public.sync_room_candle_requests
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.sync_rooms r WHERE r.id = room_id AND r.created_by = auth.uid())
  );

DROP POLICY IF EXISTS service_all_mass ON public.sync_room_mass_intentions;
CREATE POLICY service_all_mass ON public.sync_room_mass_intentions
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS participants_read_mass ON public.sync_room_mass_intentions;
CREATE POLICY participants_read_mass ON public.sync_room_mass_intentions
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.sync_rooms r WHERE r.id = room_id AND r.created_by = auth.uid())
  );

DROP POLICY IF EXISTS service_all_donations ON public.sync_room_donations;
CREATE POLICY service_all_donations ON public.sync_room_donations
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
DROP POLICY IF EXISTS participants_read_donations ON public.sync_room_donations;
CREATE POLICY participants_read_donations ON public.sync_room_donations
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.sync_rooms r WHERE r.id = room_id AND r.created_by = auth.uid())
  );


-- ----------------------------------------------------------------------------
-- Realtime publication
-- ----------------------------------------------------------------------------
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_room_candle_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_room_mass_intentions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_room_donations;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ----------------------------------------------------------------------------
-- Wallet debit helper (factored out so all three donation paths share
-- the same SELECT FOR UPDATE -> check -> decrement idiom).
-- Returns the new main_balance_cents on success, raises on insufficient
-- balance.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._debit_wallet(p_user_id UUID, p_amount_cents INT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_balance BIGINT;
  v_new_balance BIGINT;
BEGIN
  IF p_amount_cents <= 0 THEN
    RETURN NULL;       -- no-op; caller treats NULL as "no debit"
  END IF;

  SELECT main_balance_cents INTO v_balance
  FROM user_wallets WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Auto-create wallet at zero so the next failure mode is a clean
    -- insufficient_balance instead of "wallet missing".
    INSERT INTO user_wallets (user_id, main_balance_cents) VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
    v_balance := 0;
  END IF;

  IF v_balance < p_amount_cents THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  UPDATE user_wallets
  SET    main_balance_cents = main_balance_cents - p_amount_cents,
         last_activity_at   = NOW(),
         updated_at         = NOW()
  WHERE  user_id = p_user_id
  RETURNING main_balance_cents INTO v_new_balance;

  RETURN v_new_balance;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public._debit_wallet(UUID, INT) FROM PUBLIC, anon, authenticated;


-- ----------------------------------------------------------------------------
-- RPCs
-- ----------------------------------------------------------------------------

-- get_user_reaction_preferences
CREATE OR REPLACE FUNCTION public.get_user_reaction_preferences()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_prefs JSONB;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;

  SELECT preferences INTO v_prefs
  FROM user_reaction_preferences WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO user_reaction_preferences (user_id) VALUES (v_user_id)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING preferences INTO v_prefs;
    IF v_prefs IS NULL THEN
      SELECT preferences INTO v_prefs FROM user_reaction_preferences WHERE user_id = v_user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'preferences', v_prefs);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_reaction_preferences() TO authenticated;


-- set_user_reaction_preference
CREATE OR REPLACE FUNCTION public.set_user_reaction_preference(
  p_emoji TEXT, p_amount_cents INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_prefs JSONB;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;
  IF p_emoji IS NULL OR length(trim(p_emoji)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'emoji_required');
  END IF;
  IF p_amount_cents < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'negative_amount');
  END IF;

  INSERT INTO user_reaction_preferences (user_id, preferences)
  VALUES (v_user_id, jsonb_build_object(p_emoji, p_amount_cents))
  ON CONFLICT (user_id) DO UPDATE
    SET preferences = user_reaction_preferences.preferences || jsonb_build_object(p_emoji, p_amount_cents),
        updated_at = NOW()
  RETURNING preferences INTO v_prefs;

  RETURN jsonb_build_object('success', true, 'preferences', v_prefs);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_user_reaction_preference(TEXT, INT) TO authenticated;


-- send_reaction_donation
CREATE OR REPLACE FUNCTION public.send_reaction_donation(
  p_room_id UUID, p_emoji TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_amount INT;
  v_new_balance BIGINT;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;

  -- Pull the user's per-emoji cents from their preferences. Auto-init
  -- the row with the default map if missing.
  PERFORM get_user_reaction_preferences();   -- side effect: row exists

  SELECT (preferences ->> p_emoji)::INT INTO v_amount
  FROM user_reaction_preferences WHERE user_id = v_user_id;

  IF v_amount IS NULL OR v_amount = 0 THEN
    -- Reaction without a configured donation -- still record the
    -- reaction row in sync_room_reactions (the existing path) but
    -- don't debit anything. Mirror the contract by returning
    -- "no donation, reaction logged" so the client can decide if it
    -- wants to also write to sync_room_reactions.
    RETURN jsonb_build_object(
      'success', true, 'donated', false, 'reason', 'no_amount_configured',
      'emoji', p_emoji
    );
  END IF;

  BEGIN
    v_new_balance := _debit_wallet(v_user_id, v_amount);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'amount_cents', v_amount);
  END;

  INSERT INTO sync_room_donations (room_id, user_id, emoji, amount_cents)
  VALUES (p_room_id, v_user_id, p_emoji, v_amount);

  RETURN jsonb_build_object(
    'success', true, 'donated', true,
    'emoji', p_emoji,
    'amount_cents', v_amount,
    'new_balance_cents', v_new_balance
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.send_reaction_donation(UUID, TEXT) TO authenticated;


-- request_candle
CREATE OR REPLACE FUNCTION public.request_candle(
  p_room_id UUID, p_intention TEXT, p_donation_cents INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
  v_new_balance BIGINT;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;
  IF p_intention IS NULL OR length(trim(p_intention)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'intention_required');
  END IF;

  IF p_donation_cents > 0 THEN
    BEGIN
      v_new_balance := _debit_wallet(v_user_id, p_donation_cents);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'amount_cents', p_donation_cents);
    END;
  END IF;

  INSERT INTO sync_room_candle_requests (room_id, user_id, intention, donation_cents)
  VALUES (p_room_id, v_user_id, trim(p_intention), COALESCE(p_donation_cents, 0))
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'donation_cents', COALESCE(p_donation_cents, 0),
    'new_balance_cents', v_new_balance
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.request_candle(UUID, TEXT, INT) TO authenticated;


-- request_mass_intention
CREATE OR REPLACE FUNCTION public.request_mass_intention(
  p_room_id UUID,
  p_name TEXT,
  p_is_deceased BOOLEAN,
  p_preferred_date DATE,
  p_donation_cents INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_request_id UUID;
  v_new_balance BIGINT;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'name_required');
  END IF;
  IF p_preferred_date IS NULL OR p_preferred_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'date_in_past');
  END IF;

  IF p_donation_cents > 0 THEN
    BEGIN
      v_new_balance := _debit_wallet(v_user_id, p_donation_cents);
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      RETURN jsonb_build_object('success', false, 'error', 'insufficient_balance', 'amount_cents', p_donation_cents);
    END;
  END IF;

  INSERT INTO sync_room_mass_intentions (
    room_id, user_id, name, is_deceased, preferred_date, donation_cents
  ) VALUES (
    p_room_id, v_user_id, trim(p_name), COALESCE(p_is_deceased, false),
    p_preferred_date, COALESCE(p_donation_cents, 0)
  ) RETURNING id INTO v_request_id;

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'donation_cents', COALESCE(p_donation_cents, 0),
    'new_balance_cents', v_new_balance
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.request_mass_intention(UUID, TEXT, BOOLEAN, DATE, INT) TO authenticated;


-- mark_candle_lit (host only)
CREATE OR REPLACE FUNCTION public.mark_candle_lit(
  p_request_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_request RECORD;
  v_room_creator UUID;
  v_msg TEXT;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;

  SELECT cr.id, cr.room_id, cr.user_id, cr.status, cr.intention, sr.created_by
    INTO v_request
  FROM sync_room_candle_requests cr
  JOIN sync_rooms sr ON sr.id = cr.room_id
  WHERE cr.id = p_request_id;

  IF v_request.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_request.created_by <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'host_only');
  END IF;
  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_resolved', 'current_status', v_request.status);
  END IF;

  UPDATE sync_room_candle_requests SET status = 'lit', lit_at = NOW() WHERE id = p_request_id;

  v_msg := COALESCE(NULLIF(trim(p_message), ''),
    'Your candle has been lit in the church. God bless you.');

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_request.user_id, 'sync_room_candle_lit',
    'Your candle has been lit',
    v_msg,
    jsonb_build_object('request_id', p_request_id, 'room_id', v_request.room_id,
                       'intention', v_request.intention)
  );

  RETURN jsonb_build_object('success', true, 'request_id', p_request_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_candle_lit(UUID, TEXT) TO authenticated;


-- mark_mass_celebrated (host only)
CREATE OR REPLACE FUNCTION public.mark_mass_celebrated(
  p_intention_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_intention RECORD;
  v_msg TEXT;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;

  SELECT mi.id, mi.room_id, mi.user_id, mi.status, mi.name, mi.preferred_date, sr.created_by
    INTO v_intention
  FROM sync_room_mass_intentions mi
  JOIN sync_rooms sr ON sr.id = mi.room_id
  WHERE mi.id = p_intention_id;

  IF v_intention.id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_intention.created_by <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'host_only');
  END IF;
  IF v_intention.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_resolved', 'current_status', v_intention.status);
  END IF;

  UPDATE sync_room_mass_intentions SET status = 'celebrated', celebrated_at = NOW() WHERE id = p_intention_id;

  v_msg := COALESCE(NULLIF(trim(p_message), ''),
    'Your mass intention has been celebrated. May it bring peace.');

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_intention.user_id, 'sync_room_mass_celebrated',
    'Mass intention celebrated',
    v_msg,
    jsonb_build_object('intention_id', p_intention_id, 'room_id', v_intention.room_id,
                       'name', v_intention.name)
  );

  RETURN jsonb_build_object('success', true, 'intention_id', p_intention_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.mark_mass_celebrated(UUID, TEXT) TO authenticated;


-- get_pending_requests (host dashboard)
CREATE OR REPLACE FUNCTION public.get_pending_requests(p_room_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id UUID := auth.uid();
  v_created_by UUID;
  v_candles JSONB;
  v_intentions JSONB;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'unauthenticated'); END IF;

  SELECT created_by INTO v_created_by FROM sync_rooms WHERE id = p_room_id;
  IF v_created_by IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_found'); END IF;
  IF v_created_by <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'host_only');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cr.id, 'user_id', cr.user_id, 'full_name', p.full_name,
    'intention', cr.intention, 'donation_cents', cr.donation_cents,
    'created_at', cr.created_at
  ) ORDER BY cr.created_at), '[]'::jsonb)
  INTO v_candles
  FROM sync_room_candle_requests cr
  LEFT JOIN profiles p ON p.id = cr.user_id
  WHERE cr.room_id = p_room_id AND cr.status = 'pending';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', mi.id, 'user_id', mi.user_id, 'full_name', p.full_name,
    'name', mi.name, 'is_deceased', mi.is_deceased,
    'preferred_date', mi.preferred_date, 'donation_cents', mi.donation_cents,
    'created_at', mi.created_at
  ) ORDER BY mi.preferred_date), '[]'::jsonb)
  INTO v_intentions
  FROM sync_room_mass_intentions mi
  LEFT JOIN profiles p ON p.id = mi.user_id
  WHERE mi.room_id = p_room_id AND mi.status = 'pending';

  RETURN jsonb_build_object(
    'success', true,
    'candles', v_candles,
    'mass_intentions', v_intentions
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_pending_requests(UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- Backfill mass_fee_cents on existing worship rooms (1000 cents = $10).
-- ----------------------------------------------------------------------------
UPDATE public.sync_rooms
SET    room_settings = room_settings || jsonb_build_object('mass_fee_cents', 1000)
WHERE  room_type = 'worship'
  AND  NOT (room_settings ? 'mass_fee_cents');


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('129', 'worship_extensions',
        ARRAY['-- 129: candle + mass + donations + reaction prefs + 8 RPCs'])
ON CONFLICT (version) DO NOTHING;
