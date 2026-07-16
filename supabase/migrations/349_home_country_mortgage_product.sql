-- ═══════════════════════════════════════════════════════════════════════════
-- 349_home_country_mortgage_product.sql
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Option A (minimum viable) of the Home Country Mortgage rollout —
-- INSERT the new loan_products row using the four gate columns the
-- existing schema already supports. AdvanceHubV2Screen auto-lists
-- every active loan_products row via get_advance_dashboard, so no
-- client change is needed for the card to appear.
--
-- Gates enforced by this row (via the existing get_advance_dashboard
-- RPC + check_advance_eligibility flow):
--   * min_xnscore = 90
--   * min_account_age_days = 365      (12 months from profiles.created_at)
--   * min_completed_circles = 3       (COUNT circle_members WHERE status='completed')
--   * identity_verified = TRUE        (enforced by check_advance_eligibility, mig 183)
--
-- Gates DEFERRED to Option B (would require schema + RPC changes to
-- get_advance_dashboard, higher risk surface — carved off intentionally):
--   * total_payouts_received_cents ≥ $10,000   (lives on user_wallets)
--   * active community membership ≥ 1
--
-- Enum note: allowed_purposes takes loan_product_purpose values
-- (mig 022:75-82: emergency | circle_contribution | education |
-- business | medical | other). No 'housing' value exists. Adding a
-- new enum value in the SAME transaction as an INSERT that references
-- it is unsafe in Postgres (the new value isn't visible to the row
-- yet). Using 'other' for now; adding 'housing' and re-classifying
-- is a small follow-up carved into Option B's migration.
--
-- Product parameters:
--   Amount range: $10,000 – $100,000
--   Term:         120 months (10 years fixed)
--   APR:          10.00% fixed  (base_apr_min = base_apr_max)
--   Origination:  6.00%
--   Late fee:     $50 flat + 5% (vs $5-$15 flat on existing products —
--                 scaled to the larger principal)
--   Grace:        15 days (vs 5-7 on existing — mortgage convention)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.loan_products (
    code, name, description, icon,
    min_xnscore, min_account_age_days, min_completed_circles,
    min_amount_cents, max_amount_cents,
    min_term_months, max_term_months, allowed_terms,
    base_apr_min, base_apr_max,
    origination_fee_percent, late_fee_flat_cents, late_fee_percent, grace_period_days,
    allowed_purposes,
    requires_elder_guarantee, requires_cosigner,
    is_active, display_order
) VALUES (
    'home_country_mortgage',
    'Home Country Mortgage',
    'Buy a home in your country of origin. Fixed 10% APR, long-term financing.',
    '🏠',
    90, 365, 3,
    1000000, 10000000,           -- $10,000 – $100,000
    120, 120, '{120}',           -- fixed 10-year term
    10.00, 10.00,                -- 10% fixed APR
    6.00, 5000, 5.00, 15,        -- 6% origination, $50 + 5% late fee, 15-day grace
    '{other}',                   -- see enum note above
    FALSE, FALSE,                -- elder guarantee + cosigner deferred per spec MVP
    TRUE, 5                      -- active, next slot after the four existing rows
)
ON CONFLICT (code) DO NOTHING;

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '349',
  'home_country_mortgage_product',
  ARRAY['-- 349: home_country_mortgage loan_products row (Option A)']
)
ON CONFLICT (version) DO NOTHING;
