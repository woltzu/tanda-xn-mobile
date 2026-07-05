-- ═══════════════════════════════════════════════════════════════════════════
-- 285_get_my_sessions.sql
--
-- Exposes the current user's own auth.sessions rows to the client + lets
-- them revoke a single session by id. Together with
-- supabase.auth.signOut({ scope: 'others' }) (SDK-native) this gives the
-- ActiveSessionsScreen full functionality without any Edge Function.
--
-- Spec deviations (also noted in the commit body):
--
--   * The spec asked for a `revoke-session` Edge Function wrapping
--     supabase.auth.admin.signOut(userId, sessionId). That SDK signature
--     does not exist — admin.signOut takes (jwt, scope) only. Rather than
--     ship an EF that immediately errors, we add revoke_my_session as a
--     SECURITY DEFINER RPC that DELETEs from auth.sessions gated on
--     auth.uid(). One less deploy, no service-role key surface, same
--     behaviour from the client's perspective.
--
--   * `auth.sessions.ip` is INET, `aal` is aal_level enum. Both are cast
--     to TEXT in the RETURNS TABLE so PostgREST returns them as strings
--     and RN never has to reason about Postgres-specific types.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. get_my_sessions: list active sessions for the caller ───────────────
CREATE OR REPLACE FUNCTION public.get_my_sessions()
RETURNS TABLE (
  session_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  user_agent TEXT,
  ip TEXT,
  aal TEXT,
  not_after TIMESTAMPTZ,
  factor_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.created_at,
    s.updated_at,
    s.user_agent,
    s.ip::TEXT,
    s.aal::TEXT,
    s.not_after,
    s.factor_id
  FROM auth.sessions s
  WHERE s.user_id = auth.uid()
  ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_sessions() TO authenticated;


-- ─── 2. revoke_my_session: kill one session by id, gated on caller ─────────
-- Returns TRUE when a row was deleted, FALSE when the id didn't belong to
-- the caller or the session was already revoked. Deleting from
-- auth.sessions is the same primitive Supabase's own admin API uses to
-- kill a session — the refresh token stops working immediately and the
-- next PostgREST call fails auth.
CREATE OR REPLACE FUNCTION public.revoke_my_session(p_session_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM auth.sessions
   WHERE id = p_session_id
     AND user_id = auth.uid();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN v_deleted > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_my_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_my_session(UUID) TO authenticated;


-- ─── Self-register ─────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '285',
  'get_my_sessions',
  ARRAY['-- 285: get_my_sessions']
)
ON CONFLICT (version) DO NOTHING;
