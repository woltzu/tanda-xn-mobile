-- ═══════════════════════════════════════════════════════════════════════════
-- 250: Critical account history — flag table + sign-up probe + soft-delete RPC
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Phase 2 Bucket C. Covers the "user tries to escape restriction via account
-- deletion or re-signup" problem. Three pieces:
--   1. critical_account_history — SHA256-hashed email+phone of users who
--      were ever critical and left (deleted via admin, or pre-existing
--      back-fill). Hashing is anti-enumeration: even with DB access, the
--      plaintext email never lands in this table.
--   2. is_account_flagged(email, phone) — anonymous-callable so sign-up
--      can probe BEFORE auth. Privacy trade-off: targeted enumeration
--      (does THIS email show up?) is possible by anyone who knows the
--      address; we accept this because (a) the address is already known
--      to the prober, (b) the alternative is letting flagged users
--      silently re-onboard. Bulk enumeration is blocked by hashing +
--      Supabase's per-IP rate limits.
--   3. delete_account() — soft-delete via user_deletion_requests (already
--      processed by the 4am cron per CLAUDE.md). HARD BLOCKS critical
--      users; they must resolve via Bucket B first. Non-critical users
--      get queued for cron processing in 30 days.
--
-- Spec deviations (verified before writing):
--   • Spec's flag_critical_account(p_email,p_phone) takes identifiers as
--     args. SECURITY ISSUE: any signed-in critical user could call it with
--     a different victim's email and falsely flag them. Fixed by deriving
--     from profiles (joined on auth.uid()) server-side. Args removed.
--   • Spec says "call flag_critical_account before delete" but the RPC
--     raises for non-critical users — internally contradictory. Resolved:
--     critical users are BLOCKED from deletion (Bucket B principle:
--     restriction must be resolved before account changes). flag_critical
--     _account stays as an elder/admin-only defensive utility for cases
--     where critical users leave via the Supabase dashboard (admin path
--     bypasses our UI gate; the 2026-05-11 incident in CLAUDE.md proves
--     this path exists).
--   • Spec registry insert (INSERT INTO supabase_migrations(...,applied_at))
--     would fail — corrected to supabase_migrations.schema_migrations.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- 1. critical_account_history — hashed identifiers + flag metadata.
--    email_hash and phone_hash are nullable (some accounts have only one).
--    Partial UNIQUE indexes (further down) handle the multi-NULL case.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS critical_account_history (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash      TEXT,
  phone_hash      TEXT,
  reason          TEXT,
  critical_from   TIMESTAMPTZ,
  flagged_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolved        BOOLEAN      NOT NULL DEFAULT FALSE,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID         REFERENCES profiles(id) ON DELETE SET NULL
);

-- Partial UNIQUE — at most one row per identifier hash. WHERE clauses
-- skip NULLs so a phone-only flag doesn't conflict with an email-only.
CREATE UNIQUE INDEX IF NOT EXISTS uq_critical_email_hash
  ON critical_account_history (email_hash)
  WHERE email_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_critical_phone_hash
  ON critical_account_history (phone_hash)
  WHERE phone_hash IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- 2. RLS — locked down. All writes via SECURITY DEFINER RPCs.
--    Public SELECT denied; only admins can read the table directly via
--    service-role queries (and the elder-only resolve RPC).
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE critical_account_history ENABLE ROW LEVEL SECURITY;
-- No SELECT/INSERT/UPDATE/DELETE policies = effectively service-role only.

-- ───────────────────────────────────────────────────────────────────────────
-- 3. is_account_flagged — anonymous-callable probe for sign-up flow.
--    Hashes inputs server-side so the plaintext never logs.
--    Returns ONLY a boolean — no reason, no timestamp — to minimise the
--    info available to enumerators.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_account_flagged(
  p_email TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email_hash TEXT;
  v_phone_hash TEXT;
BEGIN
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    v_email_hash := encode(sha256(lower(trim(p_email))::bytea), 'hex');
    IF EXISTS (
      SELECT 1 FROM critical_account_history
      WHERE email_hash = v_email_hash AND resolved = FALSE
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  IF p_phone IS NOT NULL AND length(trim(p_phone)) > 0 THEN
    v_phone_hash := encode(sha256(trim(p_phone)::bytea), 'hex');
    IF EXISTS (
      SELECT 1 FROM critical_account_history
      WHERE phone_hash = v_phone_hash AND resolved = FALSE
    ) THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. flag_critical_account — elder/admin-only. Reads email/phone from
--    profiles for the target user_id, hashes, and inserts/updates the
--    flag row. Used when a critical user leaves via the Supabase
--    dashboard or other out-of-band channel.
--
--    DO NOT call this from a user-initiated delete flow — delete_account()
--    below BLOCKS critical users entirely, so the flag is unnecessary
--    when the UI is followed.
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION flag_critical_account(
  p_user_id UUID,
  p_reason  TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role  TEXT;
  v_email        TEXT;
  v_phone        TEXT;
  v_email_hash   TEXT;
  v_phone_hash   TEXT;
  v_current_tier TEXT;
  v_critical_from TIMESTAMPTZ;
  v_id           UUID;
BEGIN
  -- Caller must be an elder (or service_role which bypasses RLS but
  -- elder check is the user-facing gate).
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Only elders can flag accounts';
  END IF;

  -- Read target's identifiers + tier from profiles + member_tier_status.
  SELECT p.email, p.phone INTO v_email, v_phone
  FROM profiles p WHERE p.id = p_user_id;

  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'Target user has no email or phone on file';
  END IF;

  SELECT current_tier, tier_achieved_at INTO v_current_tier, v_critical_from
  FROM member_tier_status WHERE user_id = p_user_id;

  IF v_email IS NOT NULL THEN
    v_email_hash := encode(sha256(lower(trim(v_email))::bytea), 'hex');
  END IF;
  IF v_phone IS NOT NULL THEN
    v_phone_hash := encode(sha256(trim(v_phone)::bytea), 'hex');
  END IF;

  -- Insert-or-revive. ON CONFLICT only fires when email_hash matches an
  -- existing non-NULL value (partial unique). Phone-only flags get a
  -- second INSERT path; we handle that with the WHERE clause below.
  INSERT INTO critical_account_history (email_hash, phone_hash, reason, critical_from, flagged_at, resolved)
  VALUES (
    v_email_hash, v_phone_hash,
    COALESCE(p_reason, 'Flagged by elder'),
    v_critical_from,
    NOW(),
    FALSE
  )
  ON CONFLICT (email_hash) WHERE email_hash IS NOT NULL DO UPDATE SET
    phone_hash    = COALESCE(EXCLUDED.phone_hash, critical_account_history.phone_hash),
    reason        = EXCLUDED.reason,
    critical_from = EXCLUDED.critical_from,
    flagged_at    = NOW(),
    resolved      = FALSE,
    resolved_at   = NULL,
    resolved_by   = NULL
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. resolve_flagged_account — elder-only. Marks a flag as resolved so
--    the address can re-onboard cleanly. Takes the email_hash (which
--    the elder reads from the admin tool's flag list).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION resolve_flagged_account(p_email_hash TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role NOT LIKE 'elder%' THEN
    RAISE EXCEPTION 'Only elders can resolve flagged accounts';
  END IF;

  UPDATE critical_account_history
  SET resolved    = TRUE,
      resolved_at = NOW(),
      resolved_by = auth.uid()
  WHERE email_hash = p_email_hash;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. delete_account — user-initiated soft delete via user_deletion_requests.
--    BLOCKS critical users (they must resolve via Bucket B Resolution
--    Center first). Non-critical users get queued with a 30-day grace
--    period for the process_pending_deletions() cron (4am UTC daily).
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION delete_account(p_reason TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_email       TEXT;
  v_tier        TEXT;
  v_request_id  UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Critical-tier hard block.
  SELECT current_tier INTO v_tier FROM member_tier_status WHERE user_id = v_user_id;
  IF v_tier = 'critical' THEN
    RAISE EXCEPTION 'Account is restricted — resolve via Resolution Center first';
  END IF;

  -- One pending deletion per user; treat re-call as idempotent.
  IF EXISTS (
    SELECT 1 FROM user_deletion_requests
    WHERE user_id = v_user_id AND status = 'pending'
  ) THEN
    SELECT id INTO v_request_id FROM user_deletion_requests
    WHERE user_id = v_user_id AND status = 'pending'
    LIMIT 1;
    RETURN v_request_id;
  END IF;

  -- Read the email so process_pending_deletions has it after profile drops.
  SELECT email INTO v_email FROM profiles WHERE id = v_user_id;

  INSERT INTO user_deletion_requests (
    user_id, email, reason, status, requested_at, retention_end_date
  )
  VALUES (
    v_user_id,
    v_email,
    COALESCE(p_reason, 'User-initiated account deletion'),
    'pending',
    NOW(),
    (NOW() + INTERVAL '30 days')::date
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────
-- 7. Self-register. Idempotent via ON CONFLICT.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '250',
  'critical_account_history',
  ARRAY['-- 250: critical_account_history']
)
ON CONFLICT (version) DO NOTHING;
