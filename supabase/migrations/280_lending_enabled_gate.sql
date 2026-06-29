-- ═══════════════════════════════════════════════════════════════════════════
-- 280_lending_enabled_gate.sql
--
-- Dormant lending scaffold — single feature flag that gates money movement
-- on liquidity advances. The eligibility + approval RPCs (migration 097)
-- and the liquidity_advances table (already populated by feat(tier) /
-- liquidity-pool work) are pre-existing. This migration only adds the
-- flag row admins toggle to enable disbursement.
--
-- The disburse-liquidity-advance Edge Function reads
--   SELECT enabled FROM feature_gates WHERE id = 'lending_enabled'
-- and 403s when false. Everything else in the lending flow (request, queue,
-- admin approval) is reachable with the flag off — admins can see and
-- approve requests, but actual disbursement is blocked until the flag is
-- flipped.
--
-- feature_gates schema note: this table is NOT a generic key/value config —
-- it's an eligibility-rule registry with NOT NULL fields for the standard
-- "feature blocked" UX. The row below populates those fields with sensible
-- messaging in case a UI later queries them; the EF only reads `enabled`.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO feature_gates (
  id,
  name,
  category,
  reason_code,
  blocked_title,
  blocked_message,
  unlock_hint,
  enabled,
  description,
  display_order
) VALUES (
  'lending_enabled',
  'Liquidity advance disbursement',
  'lending',
  'lending_disabled',
  'Advances temporarily unavailable',
  'Liquidity advances are currently disabled by the platform. Approved requests will be disbursed once lending is re-enabled.',
  'Lending will be enabled after the launch validation period.',
  false,
  'Master switch for disbursing liquidity advances. When false, the disburse-liquidity-advance EF returns 403. Eligibility + approval still work — only money movement is gated.',
  9000
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '280',
  'lending_enabled_gate',
  ARRAY['-- 280: lending_enabled_gate']
)
ON CONFLICT (version) DO NOTHING;
