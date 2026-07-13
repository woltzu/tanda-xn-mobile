-- ═══════════════════════════════════════════════════════════════════════════
-- 297_stripe_payment_intents_member_insert_policy.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Fix: AddFundsScreen's Continue path fires
--   StripeConnectEngine.createPaymentIntent → INSERT INTO
--   stripe_payment_intents(...) from the authenticated client. Every
--   attempt errored with
--     new row violates row-level security policy for table
--     "stripe_payment_intents"
-- because the table had only two policies:
--     "Members can view their own payment intents"   (SELECT, member_id)
--     "Service role has full access ..."             (ALL,   service_role)
-- with no INSERT / UPDATE grant for authenticated at all.
--
-- Scope of this fix — INSERT only. Deliberately narrow:
--   * UPDATE stays service-role-only. The stripe-webhook flips status
--     (requires_payment_method → processing → succeeded / failed) and
--     no client-side path should be able to set 'succeeded' — that
--     would be a fraud vector where a caller could self-confirm a
--     PaymentIntent that never actually cleared Stripe.
--   * DELETE stays service-role-only. Nothing on the client deletes
--     PaymentIntents; keeping DELETE closed also means historical
--     audit rows can't be laundered from the caller side.
--   * INSERT WITH CHECK (auth.uid() = member_id) is the standard
--     ownership shape and mirrors the SELECT policy's USING clause,
--     so callers can't spoof member_id.
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE, so a re-apply is safe.
-- Same shape as migration 296 (kyc_verifications_member_write_policies)
-- which fixed the identical class of bug on the KYC path yesterday.
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS stripe_payment_intents_member_insert
  ON public.stripe_payment_intents;
CREATE POLICY stripe_payment_intents_member_insert
  ON public.stripe_payment_intents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = member_id);

-- ── Self-register ─────────────────────────────────────────────────────────

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '297',
  'stripe_payment_intents_member_insert_policy',
  ARRAY['-- 297: allow authenticated to INSERT their own stripe_payment_intents row']
)
ON CONFLICT (version) DO NOTHING;
