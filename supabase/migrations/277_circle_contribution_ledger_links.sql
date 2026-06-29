-- ═══════════════════════════════════════════════════════════════════════════
-- 277_circle_contribution_ledger_links.sql
--
-- Stage 2 Bucket A — link circle_contributions rows to the reconciliation
-- ledger so every paid contribution carries a forensic trail back to the
-- Stripe charge that produced it.
--
-- Columns are NULLABLE because:
--   * wallet contributions don't go through Stripe (no pending_intent row)
--   * historical contributions written before this migration won't have
--     linked rows
--   * the stripe-webhook stamps them after the fact, so there is a brief
--     window during PI confirmation where the contribution row exists
--     without ledger linkage
--
-- ON DELETE SET NULL on both FKs so deleting the ledger row (in dev only —
-- prod blocks DELETE via append-only trigger) doesn't cascade into the
-- contribution. ON DELETE CASCADE would be wrong: a contribution outlives
-- the raw Stripe event in our retention story.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE circle_contributions
  ADD COLUMN IF NOT EXISTS pending_intent_id UUID REFERENCES pending_intents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ledger_event_id  UUID REFERENCES ledger_events(id)  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_circle_contributions_pending_intent_id ON circle_contributions(pending_intent_id);
CREATE INDEX IF NOT EXISTS idx_circle_contributions_ledger_event_id  ON circle_contributions(ledger_event_id);

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '277',
  'circle_contribution_ledger_links',
  ARRAY['-- 277: circle_contribution_ledger_links']
)
ON CONFLICT (version) DO NOTHING;
