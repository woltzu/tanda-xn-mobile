-- ═══════════════════════════════════════════════════════════════════════════
-- 303_wallet_transactions_member_insert_policy.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix: wallet_transactions had exactly one RLS policy —
--     pe_wt_select   USING (user_id = auth.uid())         FOR SELECT
-- and no INSERT / UPDATE grant for authenticated. Every client-side
-- INSERT was silently RLS-denied:
--   * WalletContext.addFunds (commit 888aaa9) → wallet_deposit rows
--     never landed, so top-ups never appeared in Home Recent Activity.
--   * (Historical) any other client path that would like to record a
--     ledger row was also blocked.
-- The stripe-webhook + SECURITY DEFINER RPC paths were unaffected because
-- they use the service_role and bypass RLS; that's why goal_milestone
-- rows written by the trigger (mig 294) and the circle-payout rows
-- written by the webhook were fine. Only client-side inserts were
-- broken.
--
-- Same shape as migrations 296 (kyc_verifications) and 297
-- (stripe_payment_intents) — narrow INSERT WITH CHECK on ownership.
--
--   * WITH CHECK (auth.uid() = user_id) — caller can only stamp their
--     own user_id on a new row.
--   * UPDATE stays service-role-only — wallet_transactions is an
--     append-only ledger. Allowing client UPDATE would let a caller
--     retroactively change amount_cents / balance_after_cents /
--     description on any historical row of theirs, which is a fraud
--     vector (fake "someone credited me $5,000" audit trail).
--   * DELETE stays closed for the same reason plus retention.
--
-- Idempotent DROP + CREATE so re-applying the migration is safe.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS wallet_transactions_member_insert
  ON public.wallet_transactions;
CREATE POLICY wallet_transactions_member_insert
  ON public.wallet_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '303',
  'wallet_transactions_member_insert_policy',
  ARRAY['-- 303: allow authenticated to INSERT their own wallet_transactions row']
)
ON CONFLICT (version) DO NOTHING;
