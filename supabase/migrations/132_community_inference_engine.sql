-- ════════════════════════════════════════════════════════════════════════════
-- 132: community_inference_engine — Phase 1b inference + suggestions
-- ════════════════════════════════════════════════════════════════════════════
--
-- Builds on migration 131's schema with the actual inference logic:
--
--   1. community_membership_suggestions  — pending-acceptance table.
--   2. infer_groups_for_user(event_type, event_data)  — public RPC.
--   3. accept_suggestion / decline_suggestion / remind_suggestion_later
--      — user-driven state transitions.
--   4. enqueue_worship_room_suggestion()  — trigger fn on
--      sync_room_members INSERT.
--   5. update_room_religion(p_room_id, p_religion)  — host setter so the
--      religion picker has a single call site.
--
-- Privacy model (per the approved scope):
--   - All inference produces SUGGESTIONS, never auto-joined memberships.
--   - The user accepts each suggestion explicitly; accept inserts a row
--     into community_memberships with source='inferred_attendance' or
--     'inferred_location'.
--   - Declining DELETES the suggestion. Re-firing the same event in the
--     future may produce a new suggestion (intentional — a "do not
--     ever suggest" list is Phase 1c).
--
-- Group naming + dedup:
--   - Religion + city → name = "<Religion> – <City>" (e.g. "Catholic –
--     Atlanta"), type='religious', metadata={religion, city, country}.
--   - Religion only → name = "<Religion> Community", type='religious',
--     metadata={religion}.
--   - City only (location event) → name = "<City>" type='neighborhood',
--     metadata={city, country}.
--   - Dedup via (type, metadata->>'religion', metadata->>'city',
--     metadata->>'country') so two users from the same city/religion
--     land in the SAME group.
--
-- Ownership of inferred groups:
--   - communities.created_by is NOT NULL. We set it to the first user who
--     triggers creation. The existing add_community_creator_as_owner
--     trigger (migration 005) will then make them an owner of the new
--     community. This is documented + acceptable behavior; cleaner
--     handling (system user, suppress trigger for type='religious'/'neighborhood')
--     is a Phase 2 follow-up.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. community_membership_suggestions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_membership_suggestions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id  UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL
                CHECK (event_type IN ('sync_room_join', 'location')),
  event_data    JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending')), -- accept/decline DELETE the row
  reminded_at   TIMESTAMPTZ,                  -- NULL = never reminded; tap remind sets NOW()
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, community_id)              -- one open suggestion per user/community
);

CREATE INDEX IF NOT EXISTS idx_suggestions_user
  ON public.community_membership_suggestions(user_id, reminded_at);

ALTER TABLE public.community_membership_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS suggestions_select_own ON public.community_membership_suggestions;
CREATE POLICY suggestions_select_own ON public.community_membership_suggestions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS suggestions_service ON public.community_membership_suggestions;
CREATE POLICY suggestions_service ON public.community_membership_suggestions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 2. infer_groups_for_user (client + trigger callable) ──────────────────
-- Two event types today:
--
--   'sync_room_join'   : event_data = { room_id }. Looks up the room,
--                        reads room_settings->>'religion'. If non-null
--                        and != 'other', upserts a religion(-city)
--                        community group and inserts a suggestion for
--                        the joining user.
--
--   'location'         : event_data is ignored. Reads the caller's
--                        profiles.city / profiles.country. If city is
--                        non-empty, upserts a neighborhood group and
--                        suggests it.
--
-- Returns JSONB summary {success, suggestions_created: int}. Idempotent
-- because of the (user_id, community_id) UNIQUE on suggestions.
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
  v_uid             UUID := auth.uid();
  v_room_id         UUID;
  v_religion        TEXT;
  v_user_city       TEXT;
  v_user_country    TEXT;
  v_community_id    UUID;
  v_community_name  TEXT;
  v_metadata        JSONB;
  v_existing_id     UUID;
  v_suggestions     INT := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Fetch caller's residence (used by both event paths).
  SELECT city, country INTO v_user_city, v_user_country
  FROM public.profiles WHERE id = v_uid;

  IF p_event_type = 'sync_room_join' THEN
    v_room_id := NULLIF(p_event_data->>'room_id', '')::UUID;
    IF v_room_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'room_id required');
    END IF;

    SELECT room_settings->>'religion' INTO v_religion
    FROM public.sync_rooms
    WHERE id = v_room_id;

    -- Skip when religion is unset or the umbrella 'other' value.
    IF v_religion IS NULL OR v_religion = '' OR v_religion = 'other' THEN
      RETURN jsonb_build_object('success', true, 'suggestions_created', 0);
    END IF;

    -- Build community name + metadata. City may be NULL — in that case
    -- the suggested group is just "<Religion> Community".
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

    -- Dedup community: same religion + city + country = same group.
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

  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'unsupported event_type');
  END IF;

  -- Skip if the user is already a member of this community.
  IF EXISTS (
    SELECT 1 FROM public.community_memberships
    WHERE user_id = v_uid AND community_id = v_community_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'suggestions_created', 0,
                              'already_member', true);
  END IF;

  -- Suggest. UNIQUE (user_id, community_id) makes this idempotent.
  INSERT INTO public.community_membership_suggestions
    (user_id, community_id, event_type, event_data)
  VALUES (v_uid, v_community_id, p_event_type, p_event_data)
  ON CONFLICT (user_id, community_id) DO NOTHING;

  GET DIAGNOSTICS v_suggestions = ROW_COUNT;

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

-- ── 3. accept_suggestion ──────────────────────────────────────────────────
-- Promotes a pending suggestion to an active community_memberships row
-- with source='inferred_attendance' (or 'inferred_location' based on the
-- suggestion's event_type) and deletes the suggestion row.
CREATE OR REPLACE FUNCTION public.accept_suggestion(p_suggestion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_suggestion   RECORD;
  v_source       TEXT;
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

-- ── 4. decline_suggestion ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decline_suggestion(p_suggestion_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_suggestion  RECORD;
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

  DELETE FROM public.community_membership_suggestions WHERE id = p_suggestion_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_suggestion(UUID)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.decline_suggestion(UUID) FROM anon, public;

-- ── 5. remind_suggestion_later ────────────────────────────────────────────
-- Sets reminded_at = NOW(). The frontend's active-suggestion query filters
-- "reminded_at IS NULL OR reminded_at < NOW() - INTERVAL '7 days'", so the
-- suggestion stays hidden for 7 days then resurfaces.
CREATE OR REPLACE FUNCTION public.remind_suggestion_later(p_suggestion_id UUID)
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

  UPDATE public.community_membership_suggestions
     SET reminded_at = NOW()
   WHERE id = p_suggestion_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Suggestion not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remind_suggestion_later(UUID)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.remind_suggestion_later(UUID) FROM anon, public;

-- ── 6. enqueue_worship_room_suggestion trigger ────────────────────────────
-- Fires on INSERT into sync_room_members. Reads the room; if it's a
-- worship room with a specific religion set, calls infer_groups_for_user
-- via SET LOCAL ROLE so auth.uid() resolves to NEW.user_id inside the
-- inference function. Returns NEW unchanged so the trigger is a side
-- effect, never a join-blocker.
--
-- NB: we set session_replication_role = 'replica' isn't quite right —
-- instead we use SET LOCAL "request.jwt.claims" to spoof the user's
-- auth.uid() because the trigger runs in a no-JWT context. Simpler
-- approach: pass user_id explicitly via SET LOCAL.
CREATE OR REPLACE FUNCTION public._enqueue_worship_room_suggestion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_room_type   TEXT;
  v_religion    TEXT;
  v_user_city   TEXT;
  v_user_country TEXT;
  v_community_id UUID;
  v_existing_id  UUID;
  v_metadata     JSONB;
  v_community_name TEXT;
BEGIN
  SELECT room_type, room_settings->>'religion'
    INTO v_room_type, v_religion
  FROM public.sync_rooms
  WHERE id = NEW.room_id;

  -- Only fire for worship rooms with a SPECIFIC religion. 'other' acts
  -- as "host hasn't categorized" — skip silently.
  IF v_room_type <> 'worship' OR v_religion IS NULL
     OR v_religion = '' OR v_religion = 'other' THEN
    RETURN NEW;
  END IF;

  -- We can't call infer_groups_for_user() here because it reads
  -- auth.uid() which is unavailable in a trigger context. Inline the
  -- same logic, keyed off NEW.user_id directly.
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
    -- created_by must be NOT NULL. Use the joining user. The
    -- add_community_creator_as_owner trigger will then make them an
    -- owner — documented behavior for ad-hoc inferred groups.
    INSERT INTO public.communities (name, community_type, metadata, created_by, is_discoverable)
    VALUES (v_community_name, 'faith', v_metadata, NEW.user_id, true)
    RETURNING id INTO v_community_id;
  ELSE
    v_community_id := v_existing_id;
  END IF;

  -- Skip suggestion if already a member.
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_worship_room_suggestion
  ON public.sync_room_members;
CREATE TRIGGER trg_enqueue_worship_room_suggestion
  AFTER INSERT ON public.sync_room_members
  FOR EACH ROW
  EXECUTE FUNCTION public._enqueue_worship_room_suggestion();

-- ── 7. update_room_religion (host-only setter) ────────────────────────────
-- Single call-site for the religion picker. Validates host + enum value.
CREATE OR REPLACE FUNCTION public.update_room_religion(
  p_room_id  UUID,
  p_religion TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_creator UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF p_religion IS NULL OR p_religion = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'religion required');
  END IF;
  IF p_religion NOT IN (
    'catholic','protestant','orthodox','muslim','jewish',
    'buddhist','hindu','other'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid religion value');
  END IF;

  SELECT created_by INTO v_creator
  FROM public.sync_rooms WHERE id = p_room_id;
  IF v_creator IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;
  IF v_creator <> v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the room host can set the religion');
  END IF;

  UPDATE public.sync_rooms
     SET room_settings = COALESCE(room_settings, '{}'::jsonb)
                         || jsonb_build_object('religion', p_religion)
   WHERE id = p_room_id;

  RETURN jsonb_build_object('success', true, 'religion', p_religion);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_room_religion(UUID, TEXT)
  TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.update_room_religion(UUID, TEXT)
  FROM anon, public;

-- ════════════════════════════════════════════════════════════════════════════
-- Self-register
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '132',
  'community_inference_engine',
  ARRAY['-- 132: community_inference_engine (suggestions table + infer/accept/decline/remind RPCs + worship trigger + update_room_religion)']
)
ON CONFLICT (version) DO NOTHING;
