-- 178_legal_acceptance_rpc.sql
-- =====================================================================
-- P0 of the Legal documents review.
--
-- Two things:
--
-- 1. record_legal_acceptance(p_document_type, p_language_viewed,
--    p_device_info) — SECURITY INVOKER RPC that:
--      - resolves auth.uid() (NULL → no-op, returns NULL)
--      - looks up the currently active legal_documents row of the given
--        type (NULL → no-op, returns NULL — we don't want signup or any
--        other writer to fail just because the legal team hasn't
--        published a doc yet)
--      - INSERTs into member_legal_acceptances with denormalized
--        document_type + version, server-side accepted_at (NOW())
--      - returns the new acceptance id
--    SECURITY INVOKER is deliberate: the existing RLS on
--    member_legal_acceptances (047_legal_terms_simplifier.sql) already
--    allows the caller to INSERT their own row, so this RPC needs no
--    privilege escalation. Lock search_path to satisfy the Tier 4
--    function_search_path_mutable lint.
--
-- 2. Backfill: for every currently active legal_documents row, insert a
--    placeholder acceptance for every existing profile that does NOT
--    already have one for that document_type. This prevents pre-existing
--    users from being prompted to re-accept the moment the new entry
--    point in Settings goes live. accepted_at is set to the profile's
--    created_at (closest honest stamp we have); device_info is the
--    literal 'backfilled' so audits can distinguish these from real
--    in-app acceptances. language_viewed comes from profiles.language
--    (with 'en' fallback) — the column was constrained to en+fr by
--    migration 177 so this is always valid.
--
-- Idempotent — registry insert uses ON CONFLICT, backfill SELECT excludes
-- already-accepted rows, and CREATE OR REPLACE on the function.
-- =====================================================================

-- 1. RPC
CREATE OR REPLACE FUNCTION public.record_legal_acceptance(
  p_document_type TEXT,
  p_language_viewed TEXT DEFAULT 'en',
  p_device_info TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_doc_id UUID;
  v_doc_type TEXT;
  v_doc_version INTEGER;
  v_acceptance_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, document_type, version
    INTO v_doc_id, v_doc_type, v_doc_version
    FROM public.legal_documents
   WHERE document_type = p_document_type
     AND status = 'active'
   LIMIT 1;

  IF v_doc_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.member_legal_acceptances (
    member_id,
    document_id,
    document_type,
    version,
    accepted_at,
    ip_address,
    device_info,
    language_viewed
  )
  VALUES (
    v_user_id,
    v_doc_id,
    v_doc_type,
    v_doc_version,
    NOW(),
    NULL,
    p_device_info,
    COALESCE(p_language_viewed, 'en')
  )
  RETURNING id INTO v_acceptance_id;

  RETURN v_acceptance_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_legal_acceptance(TEXT, TEXT, TEXT)
  TO authenticated;

-- 2. Backfill — one row per (profile × active doc) that doesn't already exist
INSERT INTO public.member_legal_acceptances (
  member_id,
  document_id,
  document_type,
  version,
  accepted_at,
  ip_address,
  device_info,
  language_viewed
)
SELECT
  p.id AS member_id,
  d.id AS document_id,
  d.document_type,
  d.version,
  COALESCE(p.created_at, NOW()) AS accepted_at,
  NULL AS ip_address,
  'backfilled' AS device_info,
  COALESCE(p.language, 'en') AS language_viewed
FROM public.profiles p
CROSS JOIN public.legal_documents d
WHERE d.status = 'active'
  AND NOT EXISTS (
    SELECT 1
      FROM public.member_legal_acceptances a
     WHERE a.member_id = p.id
       AND a.document_type = d.document_type
  );

-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '178',
  'legal_acceptance_rpc',
  ARRAY['-- 178: legal_acceptance_rpc']
)
ON CONFLICT (version) DO NOTHING;
