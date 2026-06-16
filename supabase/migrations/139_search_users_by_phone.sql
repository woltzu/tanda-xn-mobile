-- =============================================================================
-- 139: search_users_by_phone RPC
-- =============================================================================
-- Contact-sync matcher for the Send Money flow. Takes an array of normalized
-- phone numbers from the device contact list and returns only the matches —
-- never the full profile table, so authenticated users can't enumerate who's
-- on TandaXn by scanning profiles.
--
-- Auth: callable by any authenticated user. Anonymous users get nothing
-- (REVOKE EXECUTE FROM anon, public).
--
-- Hardening: input array capped at 200 numbers per call (caller is expected
-- to batch). SECURITY DEFINER with explicit search_path to defeat schema
-- shadowing.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.search_users_by_phone(phone_numbers TEXT[])
RETURNS TABLE (
  id          UUID,
  full_name   TEXT,
  phone       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  IF array_length(phone_numbers, 1) IS NULL THEN
    RETURN;
  END IF;

  IF array_length(phone_numbers, 1) > 200 THEN
    RAISE EXCEPTION 'too_many_numbers';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.phone
  FROM public.profiles p
  WHERE p.phone = ANY (phone_numbers)
    AND p.phone IS NOT NULL;
END;
$$;

-- Lock down execution: only authenticated users may call this.
REVOKE ALL ON FUNCTION public.search_users_by_phone(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_users_by_phone(TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_users_by_phone(TEXT[]) TO authenticated;

-- =============================================================================
-- Self-register
-- =============================================================================

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '139',
  'search_users_by_phone',
  ARRAY['-- 139: search_users_by_phone']
)
ON CONFLICT (version) DO NOTHING;
