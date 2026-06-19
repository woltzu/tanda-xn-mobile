-- ════════════════════════════════════════════════════════════════════════════
-- Migration 202: goal_templates
-- ════════════════════════════════════════════════════════════════════════════
-- Phase 4 — diaspora-dream goal templates. Browseable cards (house /
-- wedding / business / school) that pre-fill the goal creation flow with
-- a realistic target amount, timeline, milestones, cost breakdown, and
-- suggested provider categories.
--
-- Naming note vs migration 201's `goal_category_templates`: these tables
-- play complementary roles, not duplicate.
--   - goal_templates (this migration)        — pre-creation. Browseable
--     cards a diaspora member taps to start a credible goal. Carries
--     name / icon / target / timeline / cost_breakdown / suggested
--     providers in addition to the milestone shell.
--   - goal_category_templates (migration 201) — post-creation. Read by
--     the disbursement-milestone wizard to one-tap-seed the percent
--     split AFTER the goal already exists and has a provider linked.
-- The 4 categories match across both surfaces so users see the same
-- vocabulary throughout.
--
-- created_by references profiles(id) so it stays consistent with the
-- rest of the staged-disbursement surface (verification_compensation,
-- providers, etc. all FK profiles).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.goal_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('house', 'wedding', 'business', 'school')),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,                              -- emoji or vector-icon name
  default_target_cents BIGINT,            -- realistic mid-range target
  default_timeline_months INTEGER,
  milestones JSONB NOT NULL DEFAULT '[]'::jsonb,       -- [{name, description, default_percent, verification_method}]
  cost_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{item, cost_cents, note}]
  provider_categories TEXT[],                          -- align with provider_category_enum
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_templates_active_category
  ON public.goal_templates (category) WHERE is_active = TRUE;

ALTER TABLE public.goal_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS goal_templates_public_select ON public.goal_templates;
CREATE POLICY goal_templates_public_select ON public.goal_templates
  FOR SELECT USING (is_active = TRUE OR EXISTS (
    SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active
  ));

-- Admin-only writes — templates are a curated surface for now. Community
-- contributions are a Phase 4.2 concern (see project notes).
DROP POLICY IF EXISTS goal_templates_admin_write ON public.goal_templates;
CREATE POLICY goal_templates_admin_write ON public.goal_templates
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid() AND a.is_active));

-- ─── Seed: 4 diaspora-dream templates ──────────────────────────────────────
-- Defaults sit in the middle of the user-spec cost ranges so members can
-- adjust up or down from a credible starting point rather than from $0.
-- Cost-breakdown items sum to the default target so the math reads
-- honestly to the user; admins can refine the line items via the admin
-- surface (planned).
INSERT INTO public.goal_templates (
  category, name, description, icon,
  default_target_cents, default_timeline_months,
  milestones, cost_breakdown, provider_categories
) VALUES
  (
    'house',
    'Build a house',
    'Construction in your home country — foundation through finishing.',
    '🏠',
    1500000,        -- $15,000 starting point (range $5,000 – $50,000)
    12,
    '[
      {"name": "Foundation",  "description": "Land prep, footings, slab.", "default_percent": 30, "verification_method": "elder"},
      {"name": "Walls",       "description": "Block walls, plaster start.", "default_percent": 25, "verification_method": "elder"},
      {"name": "Roof",        "description": "Roof structure, sheeting, drainage.", "default_percent": 25, "verification_method": "elder"},
      {"name": "Finishing",   "description": "Doors, windows, paint, handover.", "default_percent": 20, "verification_method": "elder"}
    ]'::jsonb,
    '[
      {"item": "Land or site preparation", "cost_cents": 200000, "note": "If land already owned, redirect to materials."},
      {"item": "Materials (cement, blocks, steel)", "cost_cents": 600000, "note": null},
      {"item": "Labour", "cost_cents": 450000, "note": "Skilled mason + helpers across the build."},
      {"item": "Permits + connections", "cost_cents": 150000, "note": "Council permits, water/electric hookup."},
      {"item": "Finishing (doors, windows, paint)", "cost_cents": 100000, "note": null}
    ]'::jsonb,
    ARRAY['construction']
  ),
  (
    'wedding',
    'Traditional wedding',
    'Cover the ceremony, reception, attire, and family obligations.',
    '💍',
    700000,         -- $7,000 (range $2,000 – $15,000)
    6,
    '[
      {"name": "Planning & booking", "description": "Venue, vendors, dates locked.", "default_percent": 20, "verification_method": "owner"},
      {"name": "Catering",           "description": "Food + drinks confirmed.",      "default_percent": 30, "verification_method": "owner"},
      {"name": "Ceremony",           "description": "Day-of execution.",              "default_percent": 30, "verification_method": "owner"},
      {"name": "Reception",          "description": "Post-event wrap-up.",            "default_percent": 20, "verification_method": "owner"}
    ]'::jsonb,
    '[
      {"item": "Venue + decor",   "cost_cents": 200000, "note": "Hall or compound, decoration, lighting."},
      {"item": "Catering",        "cost_cents": 250000, "note": "Food + drinks for the guest count."},
      {"item": "Attire",          "cost_cents": 100000, "note": "Bride + groom traditional outfits."},
      {"item": "Dowry / family",  "cost_cents": 100000, "note": "Customary gifts to the in-laws."},
      {"item": "Music + photo",   "cost_cents": 50000,  "note": "DJ / band + photographer."}
    ]'::jsonb,
    ARRAY['services']
  ),
  (
    'business',
    'Start a business',
    'Get a small business off the ground with stock, premises, and licences.',
    '🛒',
    400000,         -- $4,000 (range $1,000 – $10,000)
    4,
    '[
      {"name": "Registration", "description": "Business registered, bank account.", "default_percent": 10, "verification_method": "owner"},
      {"name": "Inventory",    "description": "First stock purchased.",              "default_percent": 40, "verification_method": "elder"},
      {"name": "Equipment",    "description": "Premises + equipment ready.",         "default_percent": 30, "verification_method": "elder"},
      {"name": "Marketing",    "description": "Open for business + first ads.",      "default_percent": 20, "verification_method": "owner"}
    ]'::jsonb,
    '[
      {"item": "Registration + licences", "cost_cents": 40000,  "note": "Business name, tax, permits."},
      {"item": "Inventory",                "cost_cents": 160000, "note": "Initial stock."},
      {"item": "Equipment + premises",     "cost_cents": 120000, "note": "Rent, deposit, fixtures."},
      {"item": "Marketing",                "cost_cents": 80000,  "note": "Signage, social ads, launch."}
    ]'::jsonb,
    ARRAY['retail', 'services']
  ),
  (
    'school',
    'School fees',
    'Cover a full year — tuition, books, uniforms, transport.',
    '🎒',
    150000,         -- $1,500 (range $500 – $5,000)
    12,
    '[
      {"name": "Tuition",         "description": "Term 1 + 2 + 3 fees.",     "default_percent": 60, "verification_method": "document"},
      {"name": "Books & supplies", "description": "Texts, stationery.",       "default_percent": 20, "verification_method": "document"},
      {"name": "Uniforms",        "description": "Two sets per child.",       "default_percent": 10, "verification_method": "owner"},
      {"name": "Extras",          "description": "Transport, extracurriculars.", "default_percent": 10, "verification_method": "owner"}
    ]'::jsonb,
    '[
      {"item": "Tuition",         "cost_cents": 90000, "note": "All three terms combined."},
      {"item": "Books + supplies", "cost_cents": 30000, "note": null},
      {"item": "Uniforms",        "cost_cents": 15000, "note": "Including sports kit."},
      {"item": "Transport",       "cost_cents": 15000, "note": "Monthly bus pass × 10."}
    ]'::jsonb,
    ARRAY['education']
  )
ON CONFLICT DO NOTHING;

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '202',
  'goal_templates',
  ARRAY['-- 202: goal_templates']
)
ON CONFLICT (version) DO NOTHING;
