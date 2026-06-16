-- ============================================================================
-- Migration 154: Send-Money P2 (Automation & Learning)
-- ============================================================================
-- Adds three tracking columns + one helper RPC so the Send-Money screen
-- can predict the most-frequent recent recipient, pre-fill the last
-- amount, and sweep round-up change into a savings goal.
--
--   profiles.round_up_increment   — user choice (0=off | 1 | 5 | 10)
--   send_money_recipients.last_amount_cents — last sent amount in cents
--   send_money_recipients.send_count        — running count of sends
--   bump_recipient_stats(...)     — RPC called after each successful send
--
-- The DomesticSendMoneyScreen calls bump_recipient_stats after
-- WalletContext.sendMoney() returns; the saved-recipient upsert that
-- already happens stays in place and is now followed by this stats bump.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. profiles.round_up_increment
-- ----------------------------------------------------------------------------
-- Stored as the actual round-up denominator (1, 5, 10) so the client
-- doesn't need a lookup table. 0 = feature off (default for everyone).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS round_up_increment INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'profiles_round_up_increment_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_round_up_increment_chk
      CHECK (round_up_increment IN (0, 1, 5, 10));
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.round_up_increment IS
  'Send-Money P2 round-up denominator in dollars. 0 = feature off. '
  'When non-zero, every send rounds up to the nearest multiple and the '
  'delta is swept into the user''s Round-up Savings goal.';


-- ----------------------------------------------------------------------------
-- 2. send_money_recipients tracking columns
-- ----------------------------------------------------------------------------
-- send_count powers the "Send to {name} again?" prediction; the screen
-- picks the highest-count recent recipient. last_amount_cents powers the
-- amount pre-fill when the user taps a recent recipient.
ALTER TABLE public.send_money_recipients
  ADD COLUMN IF NOT EXISTS last_amount_cents BIGINT,
  ADD COLUMN IF NOT EXISTS send_count INTEGER NOT NULL DEFAULT 0;

-- Backfill send_count = 1 for any row already in the table so the
-- prediction has signal from day 0 instead of waiting for a second send.
UPDATE public.send_money_recipients
   SET send_count = 1
 WHERE send_count = 0;

-- Index for "top recipient by frequency" query. user_id is the partition;
-- send_count desc is the primary order; last_sent_at desc breaks ties so
-- a recent send wins over an equally-frequent stale one.
CREATE INDEX IF NOT EXISTS idx_recipients_user_freq
  ON public.send_money_recipients(user_id, send_count DESC, last_sent_at DESC);

COMMENT ON COLUMN public.send_money_recipients.last_amount_cents IS
  'Last amount sent to this recipient, in cents. Drives the auto-fill '
  'on the Send-Money screen.';
COMMENT ON COLUMN public.send_money_recipients.send_count IS
  'Running count of sends to this recipient. Drives the "most-frequent" '
  'recipient prediction chip.';


-- ----------------------------------------------------------------------------
-- 3. RPC — bump_recipient_stats
-- ----------------------------------------------------------------------------
-- Single atomic increment + last_amount + last_sent_at update. SECURITY
-- DEFINER so the caller's RLS doesn't need to re-check ownership — the
-- WHERE clause does that via auth.uid(). Returns nothing; the screen
-- doesn't need a refetch.
CREATE OR REPLACE FUNCTION public.bump_recipient_stats(
  p_recipient_id UUID,
  p_amount_cents BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'bump_recipient_stats: auth required'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.send_money_recipients
     SET last_amount_cents = p_amount_cents,
         last_sent_at      = now(),
         send_count        = COALESCE(send_count, 0) + 1
   WHERE id = p_recipient_id
     AND user_id = v_uid;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.bump_recipient_stats(UUID, BIGINT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.bump_recipient_stats(UUID, BIGINT) TO authenticated;

COMMENT ON FUNCTION public.bump_recipient_stats IS
  'Increments send_count + records last_amount_cents and last_sent_at '
  'for one recipient owned by the caller. No-op if the recipient_id '
  'doesn''t belong to auth.uid().';


-- ----------------------------------------------------------------------------
-- 4. Self-register
-- ----------------------------------------------------------------------------
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '154',
  'send_money_p2',
  ARRAY['-- 154: round_up_increment + recipient stats + bump_recipient_stats']
)
ON CONFLICT (version) DO NOTHING;
