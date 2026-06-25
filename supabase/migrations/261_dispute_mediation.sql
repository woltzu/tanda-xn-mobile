-- ═══════════════════════════════════════════════════════════════════════════
-- 261: Dispute mediation RPCs (file / assign / resolve / message)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Wires up the member-facing dispute flow. Pieces:
--   1. file_dispute(circle, against, title, description, type) → dispute_id
--      Notifies all elders inline (no insert_notification helper exists).
--   2. assign_mediator(dispute, mediator) — elder action; sets assigned_to
--      and status='under_review', notifies mediator.
--   3. resolve_dispute(dispute, resolution, status) — assigned mediator or
--      admin; sets resolution + resolved_at + resolved_by, notifies both
--      parties.
--   4. add_dispute_message(dispute, content, is_private) → message_id
--      Filer / respondent / mediator / elder can post. is_private restricts
--      to mediator/elder view (existing RLS).
--
-- Spec deviations (verified via read-only audit before writing):
--   • Registry insert wrong table (recurring). Corrected.
--   • Tables disputes AND dispute_messages ALREADY EXIST in prod with a
--     RICHER schema than the spec drafts. CREATE TABLE IF NOT EXISTS
--     would silently no-op; spec's column references would then ERROR
--     because the column names don't match. Real → spec mapping:
--       disputes.reporter_user_id       (spec: filed_by)        — required
--       disputes.assigned_to            (spec: mediator_id)
--       disputes.resolution             (spec: resolution_note)
--       disputes.resolved_by            (spec: omitted; populated here)
--       disputes.type      NOT NULL     (spec: missing)         — REQUIRED
--       disputes.priority  default 'medium'                     — defaults ok
--       dispute_messages.sender_user_id (spec: sender_id)
--       dispute_messages.message        (spec: content)
--       dispute_messages.is_private     (spec: is_internal)
--     RPCs below use the real names. CREATE TABLE blocks dropped entirely.
--   • RLS policies (disputes_select, disputes_insert, disputes_elder_select,
--     disputes_elder_update, dispute_messages_select, dispute_messages_insert)
--     ALREADY EXIST in prod. CREATE POLICY in spec would error with
--     "policy already exists". Policy creation blocks dropped entirely —
--     existing policies cover the intent (filer/respondent/mediator/elder
--     read, anyone insert with reporter check, elders update).
--   • Spec calls insert_notification(...) — VERIFIED to NOT EXIST. Inlined
--     INSERT INTO notifications (matches the real columns: user_id, type,
--     title, body, data, created_at).
--   • Spec uses `role LIKE 'admin%'` on profiles for the admin check —
--     profiles.role vocab is member/verified_member/elder_i/_ii/_iii (no
--     'admin'). Real admin authority lives in admin_users (used by the
--     providers RLS and other admin checks). Switched to admin_users.
--   • Spec's notification body uses `p.display_name || ' filed a dispute…'`
--     — display_name can be NULL. Added COALESCE so we don't write NULL
--     bodies that GoTrue's clients render as blank.
--   • disputes.type is NOT NULL no default — RPC requires the caller to
--     pass it. Default 'member_complaint' is supplied so existing callers
--     can omit and we still satisfy the NOT NULL.
--   • Tier 4 hardening (SET search_path = public, pg_temp) on all RPCs.
--   • Dupe-check on file_dispute uses status IN ('open','under_review')
--     to allow refiling after a previous resolution.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. file_dispute — member files a complaint, elders get notified.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION file_dispute(
  p_circle_id        UUID,
  p_against_user_id  UUID,
  p_title            TEXT,
  p_description      TEXT,
  p_type             TEXT DEFAULT 'member_complaint'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_dispute_id UUID;
  v_circle_name TEXT;
  v_against_name TEXT;
  v_filer_name TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_against_user_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot file a dispute against yourself';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) = 0 THEN
    RAISE EXCEPTION 'Dispute title required';
  END IF;

  IF p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RAISE EXCEPTION 'Dispute description required';
  END IF;

  -- Filer must be a participant of the circle the dispute is about.
  IF p_circle_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM circle_members cm
    WHERE cm.circle_id = p_circle_id
      AND cm.user_id   = v_user_id
      AND cm.status   IN ('active', 'pending', 'paused')
  ) THEN
    RAISE EXCEPTION 'You must be a member of the circle to file a dispute';
  END IF;

  -- Dupe-guard: don't allow stacking open disputes against the same person
  -- in the same circle from the same filer.
  IF EXISTS (
    SELECT 1 FROM disputes
    WHERE circle_id       IS NOT DISTINCT FROM p_circle_id
      AND against_user_id IS NOT DISTINCT FROM p_against_user_id
      AND reporter_user_id = v_user_id
      AND status IN ('open', 'under_review')
  ) THEN
    RAISE EXCEPTION 'You already have an open dispute against this user in this circle';
  END IF;

  INSERT INTO disputes (
    reporter_user_id, against_user_id, circle_id,
    type, title, description, status
  )
  VALUES (
    v_user_id, p_against_user_id, p_circle_id,
    COALESCE(p_type, 'member_complaint'), p_title, p_description, 'open'
  )
  RETURNING id INTO v_dispute_id;

  -- Notify all elders inline (no insert_notification helper exists).
  SELECT name INTO v_circle_name FROM circles WHERE id = p_circle_id;
  SELECT COALESCE(display_name, full_name, 'A member') INTO v_against_name
    FROM profiles WHERE id = p_against_user_id;
  SELECT COALESCE(display_name, full_name, 'A member') INTO v_filer_name
    FROM profiles WHERE id = v_user_id;

  INSERT INTO notifications (user_id, type, title, body, data, created_at)
  SELECT
    p.id,
    'dispute_filed',
    'New dispute filed' || CASE WHEN v_circle_name IS NOT NULL THEN ' in ' || v_circle_name ELSE '' END,
    v_filer_name || ' filed a dispute against ' || v_against_name,
    jsonb_build_object('dispute_id', v_dispute_id, 'circle_id', p_circle_id),
    NOW()
  FROM profiles p
  WHERE p.role LIKE 'elder%' AND p.id <> v_user_id;

  RETURN v_dispute_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. assign_mediator — elder assigns a mediator (must be elder themselves).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION assign_mediator(
  p_dispute_id  UUID,
  p_mediator_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
  v_mediator_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Only elders can assign mediators';
  END IF;

  SELECT role INTO v_mediator_role FROM profiles WHERE id = p_mediator_id;
  IF v_mediator_role IS NULL OR v_mediator_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Mediator must be an elder';
  END IF;

  UPDATE disputes
  SET assigned_to = p_mediator_id,
      status      = 'under_review',
      updated_at  = NOW()
  WHERE id = p_dispute_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dispute not found';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, data, created_at)
  VALUES (
    p_mediator_id,
    'dispute_assigned',
    'You have been assigned as mediator',
    'Please review the dispute and mediate.',
    jsonb_build_object('dispute_id', p_dispute_id),
    NOW()
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 3. resolve_dispute — assigned mediator or admin marks resolved/rejected.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_dispute(
  p_dispute_id UUID,
  p_resolution TEXT,
  p_status     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_admin     BOOLEAN;
  v_is_mediator  BOOLEAN;
  v_reporter_id  UUID;
  v_against_id   UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_status NOT IN ('resolved', 'rejected') THEN
    RAISE EXCEPTION 'status must be resolved or rejected';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND is_active = true
  ) INTO v_is_admin;

  SELECT (assigned_to = auth.uid()), reporter_user_id, against_user_id
  INTO v_is_mediator, v_reporter_id, v_against_id
  FROM disputes WHERE id = p_dispute_id;

  IF v_reporter_id IS NULL THEN
    RAISE EXCEPTION 'Dispute not found';
  END IF;

  IF NOT (COALESCE(v_is_mediator, false) OR v_is_admin) THEN
    RAISE EXCEPTION 'Only the assigned mediator or an admin can resolve this dispute';
  END IF;

  UPDATE disputes
  SET status        = p_status,
      resolved_at   = NOW(),
      resolved_by   = auth.uid(),
      resolution    = p_resolution,
      updated_at    = NOW()
  WHERE id = p_dispute_id;

  -- Notify both parties (reporter + respondent).
  INSERT INTO notifications (user_id, type, title, body, data, created_at)
  VALUES
    (
      v_reporter_id,
      'dispute_resolved',
      'Your dispute has been ' || p_status,
      'Mediator notes: ' || COALESCE(p_resolution, '(none)'),
      jsonb_build_object('dispute_id', p_dispute_id),
      NOW()
    );

  IF v_against_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, data, created_at)
    VALUES (
      v_against_id,
      'dispute_resolved',
      'A dispute against you has been ' || p_status,
      'Mediator notes: ' || COALESCE(p_resolution, '(none)'),
      jsonb_build_object('dispute_id', p_dispute_id),
      NOW()
    );
  END IF;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. add_dispute_message — timeline entry. Filer / respondent / mediator /
--    elder can post. is_private restricts visibility (existing RLS handles).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION add_dispute_message(
  p_dispute_id UUID,
  p_content    TEXT,
  p_is_private BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_msg_id  UUID;
  v_allowed BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Message content required';
  END IF;

  SELECT (
    reporter_user_id = v_user_id
    OR against_user_id = v_user_id
    OR assigned_to   = v_user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND role LIKE 'elder%')
  )
  INTO v_allowed
  FROM disputes WHERE id = p_dispute_id;

  IF NOT COALESCE(v_allowed, false) THEN
    RAISE EXCEPTION 'You do not have permission to post in this dispute';
  END IF;

  INSERT INTO dispute_messages (dispute_id, sender_user_id, message, is_private)
  VALUES (p_dispute_id, v_user_id, p_content, COALESCE(p_is_private, false))
  RETURNING id INTO v_msg_id;

  RETURN v_msg_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '261',
  'dispute_mediation',
  ARRAY['-- 261: dispute_mediation']
)
ON CONFLICT (version) DO NOTHING;
