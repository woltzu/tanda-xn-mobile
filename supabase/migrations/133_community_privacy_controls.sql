-- ════════════════════════════════════════════════════════════════════════════
-- 133: community_privacy_controls — Phase 1c
-- ════════════════════════════════════════════════════════════════════════════
--
-- Builds on Phase 1b's inference engine with three privacy primitives:
--
--   1. user_inference_opt_outs  — per-user, per-type opt-out registry.
--      Two inference types: 'attendance' (from sync_room_join events) and
--      'location'. Presence of a row means "do not suggest groups via this
--      inference type for this user." Absence = opt-in (the default).
--
--   2. inference_audit_log      — every suggestion lifecycle event recorded
--      for forensic / debug / future user-facing "history" view. Five
--      event types: suggestion_created, suggestion_skipped_opt_out,
--      membership_added, suggestion_declined, suggestion_reminded.
--
--   3. set_inference_opt_out(p_inference_type, p_opt_out) — RPC that flips
--      the opt-out for the calling user. Derives identity from auth.uid()
--      — we DO NOT accept a user_id parameter from the client.
--
-- Plus a refactor of the existing RPCs so they:
--   - Check user_inference_opt_outs before creating a suggestion.
--   - Write audit rows at each lifecycle event.
--   - decline_suggestion now accepts p_never_again BOOLEAN DEFAULT false.
--     When true, the user's opt-out for the suggestion's event_type is
--     persisted (in addition to the row delete) so future events of the
--     same type silently skip.
--
-- Event ↔ inference type mapping:
--   event_type='sync_room_join' ↔ inference_type='attendance'
--   event_type='location'       ↔ inference_type='location'
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. user_inference_opt_outs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_inference_opt_outs (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inference_type TEXT NOT NULL CHECK (inference_type IN ('attendance', 'location')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, inference_type)
);

ALTER TABLE public.user_inference_opt_outs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opt_outs_own ON public.user_inference_opt_outs;
CREATE POLICY opt_outs_own ON public.user_inference_opt_outs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS opt_outs_service ON public.user_inference_opt_outs;
CREATE POLICY opt_outs_service ON public.user_inference_opt_outs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 2. inference_audit_log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.inference_audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
              CHECK (event_type IN (
                'suggestion_created',
                'suggestion_skipped_opt_out',
                'membership_added',
                'suggestion_declined',
                'suggestion_reminded'
              )),
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inference_audit_log_user
  ON public.inference_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_inference_audit_log_created
  ON public.inference_audit_log(created_at DESC);

ALTER TABLE public.inference_audit_log ENABLE ROW LEVEL SECURITY;

-- Users read their own audit rows. Inserts go through SECURITY DEFINER
-- functions only; no direct client INSERT path.
DROP POLICY IF EXISTS audit_select_own ON public.inference_audit_log;
CREATE POLICY audit_select_own ON public.inference_audit_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS audit_service ON public.inference_audit_log;
CREATE POLICY audit_service ON public.inference_audit_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ════════════════════════════════════════════════════════════════════════════
-- 3. set_inference_opt_out — opt-out toggle for the calling user
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.set_inference_opt_out(
  p_inference_type TEXT,
  p_opt_out        BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_inference_type NOT IN ('attendance', 'location') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid inference_type');
  END IF;

  IF p_opt_out THEN
    INSERT INTO public.user_inference_opt_outs (user_id, inference_type)
    VALUES (v_uid, p_inference_type)
    ON CONFLICT (user_id, inference_type) DO NOTHING;
  ELSE
    DELETE FROM public.user_inference_opt_outs
    WHERE user_id = v_uid AND inference_type = p_inference_type;
  END IF;

  RETURN jsonb_build_object(
    'success',        true,
    'inference_type', p_inference_type,
    'opted_out',      p_opt_out
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_inference_opt_out(TEXT, BOOLEAN)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.set_inference_opt_out(TEXT, BOOLEAN)
  FROM anon, public;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. CREATE OR REPLACE infer_groups_for_user (originally 132)
--    Adds the opt-out check + audit log writes.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.infer_groups_for_user(
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid              UUID := auth.uid();
  v_inference_type   TEXT;
  v_opted_out        BOOLEAN;
  v_room_id          UUID;
  v_religion         TEXT;
  v_user_city        TEXT;
  v_user_country     TEXT;
  v_community_id     UUID;
  v_community_name   TEXT;
  v_metadata         JSONB;
  v_existing_id      UUID;
  v_suggestions      INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  v_inference_type := CASE p_event_type
    WHEN 'sync_room_join' THEN 'attendance'
    WHEN 'location'       THEN 'location'
    ELSE NULL
  END;

  IF v_inference_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unsupported event_type');
  END IF;

  -- Phase 1c — opt-out gate. If the user has opted out of this inference
  -- type, log + bail. The skip is still observable to the user via the
  -- audit_log read so they can confirm the opt-out is doing what they
  -- expect.
  SELECT EXISTS(
    SELECT 1 FROM public.user_inference_opt_outs
    WHERE user_id = v_uid AND inference_type = v_inference_type
  ) INTO v_opted_out;

  IF v_opted_out THEN
    INSERT INTO public.inference_audit_log (user_id, event_type, details)
    VALUES (v_uid, 'suggestion_skipped_opt_out',
            jsonb_build_object('inference_type', v_inference_type,
                               'event_type',     p_event_type));
    RETURN jsonb_build_object('success', true, 'suggestions_created', 0,
                              'opted_out', true);
  END IF;

  SELECT city, country INTO v_user_city, v_user_country
  FROM public.profiles WHERE id = v_uid;

  IF p_event_type = 'sync_room_join' THEN
    v_room_id := NULLIF(p_event_data->>'room_id', '')::UUID;
    IF v_room_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'room_id required');
    END IF;

    SELECT room_settings->>'religion' INTO v_religion
    FROM public.sync_rooms WHERE id = v_room_id;

    IF v_religion IS NULL OR v_religion = '' OR v_religion = 'other' THEN
      RETURN jsonb_build_object('success', true, 'suggestions_created', 0);
    END IF;

    IF NULLIF(v_user_city, '') IS NOT NULL THEN
      v_community_name := initcap(v_religion) || ' – ' || v_user_city;
      v_metadata := jsonb_build_object(
        'religion', v_religion,
        'city',     v_user_city,
        'country',  v_user_country,
        'auto_created_from_event', 'sync_room_join'
      );
    ELSE
      v_community_name := initcap(v_religion) || ' Community';
      v_metadata := jsonb_build_object(
        'religion', v_religion,
        'auto_created_from_event', 'sync_room_join'
      );
    END IF;

    SELECT id INTO v_existing_id
    FROM public.communities
    WHERE community_type = 'faith'
      AND metadata->>'religion' = v_religion
      AND COALESCE(metadata->>'city',    '') = COALESCE(v_user_city,    '')
      AND COALESCE(metadata->>'country', '') = COALESCE(v_user_country, '')
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.communities (name, community_type, metadata, created_by, is_discoverable)
      VALUES (v_community_name, 'faith', v_metadata, v_uid, true)
      RETURNING id INTO v_community_id;
    ELSE
      v_community_id := v_existing_id;
    END IF;

  ELSIF p_event_type = 'location' THEN
    IF NULLIF(v_user_city, '') IS NULL THEN
      RETURN jsonb_build_object('success', true, 'suggestions_created', 0);
    END IF;

    v_community_name := v_user_city;
    v_metadata := jsonb_build_object(
      'city',    v_user_city,
      'country', v_user_country,
      'auto_created_from_event', 'location'
    );

    SELECT id INTO v_existing_id
    FROM public.communities
    WHERE community_type = 'local'
      AND COALESCE(metadata->>'city',    '') = COALESCE(v_user_city,    '')
      AND COALESCE(metadata->>'country', '') = COALESCE(v_user_country, '')
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.communities (name, community_type, metadata, created_by, is_discoverable)
      VALUES (v_community_name, 'local', v_metadata, v_uid, true)
      RETURNING id INTO v_community_id;
    ELSE
      v_community_id := v_existing_id;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.community_memberships
    WHERE user_id = v_uid AND community_id = v_community_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'suggestions_created', 0,
                              'already_member', true);
  END IF;

  INSERT INTO public.community_membership_suggestions
    (user_id, community_id, event_type, event_data)
  VALUES (v_uid, v_community_id, p_event_type, p_event_data)
  ON CONFLICT (user_id, community_id) DO NOTHING;

  GET DIAGNOSTICS v_suggestions = ROW_COUNT;

  IF v_suggestions > 0 THEN
    INSERT INTO public.inference_audit_log (user_id, event_type, details)
    VALUES (v_uid, 'suggestion_created',
            jsonb_build_object(
              'inference_type', v_inference_type,
              'event_type',     p_event_type,
              'community_id',   v_community_id,
              'event_data',     p_event_data
            ));
  END IF;

  RETURN jsonb_build_object(
    'success',             true,
    'community_id',        v_community_id,
    'suggestions_created', v_suggestions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.infer_groups_for_user(TEXT, JSONB)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.infer_groups_for_user(TEXT, JSONB)
  FROM anon, public;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. CREATE OR REPLACE _enqueue_worship_room_suggestion trigger fn
--    Adds the opt-out check + audit log writes.
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public._enqueue_worship_room_suggestion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room_type      TEXT;
  v_religion       TEXT;
  v_opted_out      BOOLEAN;
  v_user_city      TEXT;
  v_user_country   TEXT;
  v_community_id   UUID;
  v_existing_id    UUID;
  v_metadata       JSONB;
  v_community_name TEXT;
  v_rows_affected  INT;
BEGIN
  SELECT room_type, room_settings->>'religion'
    INTO v_room_type, v_religion
  FROM public.sync_rooms
  WHERE id = NEW.room_id;

  IF v_room_type <> 'worship' OR v_religion IS NULL
     OR v_religion = '' OR v_religion = 'other' THEN
    RETURN NEW;
  END IF;

  -- Phase 1c — opt-out gate. The joining user may have opted out of
  -- attendance-based suggestions; respect that without blocking the join.
  SELECT EXISTS(
    SELECT 1 FROM public.user_inference_opt_outs
    WHERE user_id = NEW.user_id AND inference_type = 'attendance'
  ) INTO v_opted_out;

  IF v_opted_out THEN
    INSERT INTO public.inference_audit_log (user_id, event_type, details)
    VALUES (NEW.user_id, 'suggestion_skipped_opt_out',
            jsonb_build_object('inference_type', 'attendance',
                               'event_type',     'sync_room_join',
                               'room_id',        NEW.room_id));
    RETURN NEW;
  END IF;

  SELECT city, country INTO v_user_city, v_user_country
  FROM public.profiles WHERE id = NEW.user_id;

  IF NULLIF(v_user_city, '') IS NOT NULL THEN
    v_community_name := initcap(v_religion) || ' – ' || v_user_city;
    v_metadata := jsonb_build_object(
      'religion', v_religion,
      'city',     v_user_city,
      'country',  v_user_country,
      'auto_created_from_event', 'sync_room_join'
    );
  ELSE
    v_community_name := initcap(v_religion) || ' Community';
    v_metadata := jsonb_build_object(
      'religion', v_religion,
      'auto_created_from_event', 'sync_room_join'
    );
  END IF;

  SELECT id INTO v_existing_id
  FROM public.communities
  WHERE community_type = 'faith'
    AND metadata->>'religion' = v_religion
    AND COALESCE(metadata->>'city',    '') = COALESCE(v_user_city,    '')
    AND COALESCE(metadata->>'country', '') = COALESCE(v_user_country, '')
  LIMIT 1;

  IF v_existing_id IS NULL THEN
    INSERT INTO public.communities (name, community_type, metadata, created_by, is_discoverable)
    VALUES (v_community_name, 'faith', v_metadata, NEW.user_id, true)
    RETURNING id INTO v_community_id;
  ELSE
    v_community_id := v_existing_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.community_memberships
    WHERE user_id = NEW.user_id AND community_id = v_community_id
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.community_membership_suggestions
    (user_id, community_id, event_type, event_data)
  VALUES (
    NEW.user_id,
    v_community_id,
    'sync_room_join',
    jsonb_build_object('room_id', NEW.room_id, 'religion', v_religion)
  )
  ON CONFLICT (user_id, community_id) DO NOTHING;

  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected > 0 THEN
    INSERT INTO public.inference_audit_log (user_id, event_type, details)
    VALUES (NEW.user_id, 'suggestion_created',
            jsonb_build_object(
              'inference_type', 'attendance',
              'event_type',     'sync_room_join',
              'community_id',   v_community_id,
              'room_id',        NEW.room_id,
              'religion',       v_religion
            ));
  END IF;

  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. CREATE OR REPLACE accept_suggestion — adds audit log write
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.accept_suggestion(p_suggestion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_suggestion RECORD;
  v_source     TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_suggestion
  FROM public.community_membership_suggestions
  WHERE id = p_suggestion_id;

  IF v_suggestion.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Suggestion not found');
  END IF;
  IF v_suggestion.user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your suggestion');
  END IF;

  v_source := CASE v_suggestion.event_type
    WHEN 'sync_room_join' THEN 'inferred_attendance'
    WHEN 'location'       THEN 'inferred_location'
    ELSE 'inferred_attendance'
  END;

  INSERT INTO public.community_memberships
    (user_id, community_id, role, status, source, joined_at)
  VALUES (v_uid, v_suggestion.community_id, 'member', 'active', v_source, NOW())
  ON CONFLICT (user_id, community_id) DO NOTHING;

  DELETE FROM public.community_membership_suggestions WHERE id = p_suggestion_id;

  INSERT INTO public.inference_audit_log (user_id, event_type, details)
  VALUES (v_uid, 'membership_added',
          jsonb_build_object(
            'community_id',   v_suggestion.community_id,
            'event_type',     v_suggestion.event_type,
            'source',         v_source
          ));

  RETURN jsonb_build_object(
    'success',      true,
    'community_id', v_suggestion.community_id,
    'source',       v_source
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_suggestion(UUID)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.accept_suggestion(UUID) FROM anon, public;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. CREATE OR REPLACE decline_suggestion — new p_never_again + audit
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.decline_suggestion(
  p_suggestion_id UUID,
  p_never_again   BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid             UUID := auth.uid();
  v_suggestion      RECORD;
  v_inference_type  TEXT;
  v_opted_out_now   BOOLEAN := false;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_suggestion
  FROM public.community_membership_suggestions
  WHERE id = p_suggestion_id;

  IF v_suggestion.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Suggestion not found');
  END IF;
  IF v_suggestion.user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your suggestion');
  END IF;

  v_inference_type := CASE v_suggestion.event_type
    WHEN 'sync_room_join' THEN 'attendance'
    WHEN 'location'       THEN 'location'
    ELSE NULL
  END;

  IF p_never_again AND v_inference_type IS NOT NULL THEN
    INSERT INTO public.user_inference_opt_outs (user_id, inference_type)
    VALUES (v_uid, v_inference_type)
    ON CONFLICT (user_id, inference_type) DO NOTHING;
    v_opted_out_now := true;
  END IF;

  DELETE FROM public.community_membership_suggestions WHERE id = p_suggestion_id;

  INSERT INTO public.inference_audit_log (user_id, event_type, details)
  VALUES (v_uid, 'suggestion_declined',
          jsonb_build_object(
            'community_id',   v_suggestion.community_id,
            'event_type',     v_suggestion.event_type,
            'inference_type', v_inference_type,
            'never_again',    p_never_again,
            'opted_out_now',  v_opted_out_now
          ));

  RETURN jsonb_build_object(
    'success',       true,
    'opted_out_now', v_opted_out_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_suggestion(UUID, BOOLEAN)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.decline_suggestion(UUID, BOOLEAN)
  FROM anon, public;

-- The 132-era single-arg signature still exists. Drop it so the new
-- two-arg form is the unambiguous entry point.
DROP FUNCTION IF EXISTS public.decline_suggestion(UUID);

-- ════════════════════════════════════════════════════════════════════════════
-- 8. CREATE OR REPLACE remind_suggestion_later — adds audit log write
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.remind_suggestion_later(p_suggestion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_suggestion RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_suggestion
  FROM public.community_membership_suggestions
  WHERE id = p_suggestion_id;

  IF v_suggestion.id IS NULL OR v_suggestion.user_id <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Suggestion not found');
  END IF;

  UPDATE public.community_membership_suggestions
     SET reminded_at = NOW()
   WHERE id = p_suggestion_id;

  INSERT INTO public.inference_audit_log (user_id, event_type, details)
  VALUES (v_uid, 'suggestion_reminded',
          jsonb_build_object(
            'community_id', v_suggestion.community_id,
            'event_type',   v_suggestion.event_type
          ));

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remind_suggestion_later(UUID)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.remind_suggestion_later(UUID)
  FROM anon, public;

-- ════════════════════════════════════════════════════════════════════════════
-- Self-register
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '133',
  'community_privacy_controls',
  ARRAY['-- 133: community_privacy_controls (user_inference_opt_outs + inference_audit_log + opt-out gate in inference RPCs + decline_suggestion p_never_again)']
)
ON CONFLICT (version) DO NOTHING;
