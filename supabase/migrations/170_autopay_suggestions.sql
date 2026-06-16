-- 170_autopay_suggestions.sql
-- =====================================================================
-- P2 of the Advance repayment autopay review — suggestion table backing
-- the suggest-autopay Edge Function.
--
-- The function runs daily, examines each user with an active advance
-- AND no active autopay config, and increments
-- autopay_suggestions.consecutive_days each day their wallet covers
-- the full amount due. Once that counter reaches 3, the function:
--   1. Inserts a notification ("Enable autopay to save on fees").
--   2. Stamps suggested_at.
--   3. Stops touching the row until the user either enables autopay
--      (separate flow nukes the suggestion) or dismisses it
--      (dismissed_at stamped via the bell / notification UI).
--
-- Schema notes:
--   - UNIQUE (user_id, loan_id) is critical — the EF ON CONFLICT path
--     depends on it for the daily increment.
--   - consecutive_days is INTEGER NOT NULL DEFAULT 0; the EF treats 0
--     as "fresh row, just inserted".
--   - suggested_at / dismissed_at are nullable timestamps; both null
--     means "still tracking", non-null suggested_at means "already
--     notified, don't ping again".
--
-- Idempotent.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.autopay_suggestions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  loan_id           UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  consecutive_days  INTEGER NOT NULL DEFAULT 0,
  suggested_at      TIMESTAMPTZ,
  dismissed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT autopay_suggestions_user_loan_unique UNIQUE (user_id, loan_id)
);

CREATE INDEX IF NOT EXISTS idx_autopay_suggestions_user
  ON public.autopay_suggestions (user_id);

CREATE INDEX IF NOT EXISTS idx_autopay_suggestions_pending
  ON public.autopay_suggestions (suggested_at)
  WHERE suggested_at IS NULL;

-- Row-level security. The user can read their own row (so the UI can
-- render a "dismiss this nudge" surface later); writes are
-- service-role only because every row mutation goes through the EF.
ALTER TABLE public.autopay_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS autopay_suggestions_select_own
  ON public.autopay_suggestions;
CREATE POLICY autopay_suggestions_select_own
  ON public.autopay_suggestions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS autopay_suggestions_service_all
  ON public.autopay_suggestions;
CREATE POLICY autopay_suggestions_service_all
  ON public.autopay_suggestions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '170',
  'autopay_suggestions',
  ARRAY['-- 170: autopay_suggestions']
)
ON CONFLICT (version) DO NOTHING;
