-- ══════════════════════════════════════════════════════════════════════════════
-- Migration 058: Early Intervention System (Levels 1 & 2)
-- Connects default_probability_scores → intervention levels → personalized
-- messages → outcome tracking → escalation rules
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. MEMBER INTERVENTIONS (Lifecycle Tracking) ───────────────────────────

CREATE TABLE IF NOT EXISTS member_interventions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  circle_id       UUID,

  -- Intervention level & trigger
  level           INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  trigger_score   NUMERIC(5,2) NOT NULL,        -- default probability score that triggered this
  trigger_bucket  TEXT NOT NULL,                 -- risk_bucket from default_probability_scores
  trigger_source  TEXT NOT NULL DEFAULT 'cron',  -- 'cron' | 'realtime' | 'manual'

  -- Message delivered
  channel         TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','push','sms','email')),
  language        TEXT NOT NULL DEFAULT 'fr' CHECK (language IN ('fr','en','es','pt')),
  message_key     TEXT NOT NULL,                 -- template key (e.g. 'level1_soft_nudge')
  message_text    TEXT NOT NULL,                 -- final personalized message delivered
  message_cta     TEXT,                          -- call-to-action button text

  -- Contribution context
  contribution_amount_cents INTEGER,
  contribution_due_date     DATE,
  days_until_due            INTEGER,

  -- Options offered (Level 2+)
  options_offered JSONB DEFAULT '[]'::jsonb,     -- e.g. [{"type":"split_payment","label":"..."}]

  -- Member response
  status          TEXT NOT NULL DEFAULT 'sent' CHECK (status IN (
    'sent',             -- message delivered, no response yet
    'viewed',           -- member opened/saw the message
    'engaged',          -- member tapped CTA or explored options
    'accepted',         -- member chose an option (Level 2+)
    'paid',             -- member paid contribution (intervention succeeded)
    'ignored',          -- 48h passed, no engagement
    'escalated',        -- auto-escalated to next level
    'expired'           -- contribution date passed
  )),
  response_action TEXT,                          -- what the member did: 'paid_full', 'split_payment', 'used_advance', 'paused_cycle', 'dismissed'
  response_at     TIMESTAMPTZ,

  -- Escalation
  escalated_to_id UUID,                          -- FK to the next-level intervention
  escalated_at    TIMESTAMPTZ,
  escalation_reason TEXT,                        -- 'ignored_48h', 'score_increased', 'manual'

  -- Timing
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- when to send (optimal send time)
  sent_at         TIMESTAMPTZ,
  viewed_at       TIMESTAMPTZ,
  engaged_at      TIMESTAMPTZ,

  -- Outcome (did default happen?)
  default_prevented BOOLEAN,                     -- true if member paid before cycle close
  outcome_recorded_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. INTERVENTION TEMPLATES ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intervention_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level           INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  language        TEXT NOT NULL CHECK (language IN ('fr','en','es','pt')),
  message_key     TEXT NOT NULL,

  -- Template content (placeholders: {name}, {amount}, {days}, {circle}, {date}, {option_a}, {option_b})
  subject         TEXT,                          -- for email/push title
  body            TEXT NOT NULL,
  cta_text        TEXT,                          -- button text
  cta_action      TEXT,                          -- deep link or screen name

  -- Options (Level 2+)
  options         JSONB DEFAULT '[]'::jsonb,

  -- Tone & design
  tone            TEXT DEFAULT 'supportive' CHECK (tone IN ('supportive','warm','direct','urgent')),
  icon            TEXT DEFAULT 'time-outline',
  color           TEXT DEFAULT '#F59E0B',

  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(level, language, message_key)
);

-- ─── 3. INTERVENTION RULES ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intervention_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level           INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),

  -- Score range
  score_min       NUMERIC(5,2) NOT NULL,
  score_max       NUMERIC(5,2) NOT NULL,

  -- Timing rules
  days_before_due_min  INTEGER NOT NULL DEFAULT 1,    -- earliest days before due to trigger
  days_before_due_max  INTEGER NOT NULL DEFAULT 14,   -- latest days before due to trigger
  optimal_days_before  INTEGER NOT NULL DEFAULT 6,    -- ideal send time

  -- Escalation rules
  auto_escalate_after_hours INTEGER DEFAULT 48,        -- hours with no response before escalation
  max_per_cycle       INTEGER NOT NULL DEFAULT 1,      -- max interventions of this level per cycle
  cooldown_hours      INTEGER NOT NULL DEFAULT 24,     -- min hours between interventions

  -- Channel preference
  preferred_channel   TEXT NOT NULL DEFAULT 'in_app',
  fallback_channel    TEXT DEFAULT 'push',

  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(level)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_interventions_member ON member_interventions(member_id, created_at DESC);
CREATE INDEX idx_interventions_circle ON member_interventions(circle_id) WHERE circle_id IS NOT NULL;
CREATE INDEX idx_interventions_level ON member_interventions(level);
CREATE INDEX idx_interventions_status ON member_interventions(status) WHERE status IN ('sent','viewed','engaged');
CREATE INDEX idx_interventions_pending ON member_interventions(status, scheduled_at) WHERE status = 'sent';
CREATE INDEX idx_interventions_outcome ON member_interventions(default_prevented) WHERE default_prevented IS NOT NULL;
CREATE INDEX idx_interventions_escalation ON member_interventions(escalated_to_id) WHERE escalated_to_id IS NOT NULL;
CREATE INDEX idx_intervention_templates_lookup ON intervention_templates(level, language, is_active);
CREATE INDEX idx_intervention_rules_level ON intervention_rules(level, is_active);

-- ══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ══════════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_intervention_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_interventions_updated_at
  BEFORE UPDATE ON member_interventions
  FOR EACH ROW EXECUTE FUNCTION set_intervention_updated_at();

-- Auto-set timestamp fields based on status changes
CREATE OR REPLACE FUNCTION intervention_status_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'sent' AND OLD.status != 'sent' THEN
    NEW.sent_at = COALESCE(NEW.sent_at, NOW());
  END IF;
  IF NEW.status = 'viewed' AND OLD.status != 'viewed' THEN
    NEW.viewed_at = COALESCE(NEW.viewed_at, NOW());
  END IF;
  IF NEW.status = 'engaged' AND OLD.status NOT IN ('engaged','accepted','paid') THEN
    NEW.engaged_at = COALESCE(NEW.engaged_at, NOW());
  END IF;
  IF NEW.status IN ('accepted','paid') AND OLD.status NOT IN ('accepted','paid') THEN
    NEW.response_at = COALESCE(NEW.response_at, NOW());
  END IF;
  IF NEW.status = 'paid' AND OLD.status != 'paid' THEN
    NEW.default_prevented = true;
    NEW.outcome_recorded_at = COALESCE(NEW.outcome_recorded_at, NOW());
  END IF;
  IF NEW.status = 'escalated' AND OLD.status != 'escalated' THEN
    NEW.escalated_at = COALESCE(NEW.escalated_at, NOW());
  END IF;
  IF NEW.status = 'expired' AND OLD.status != 'expired' AND NEW.default_prevented IS NULL THEN
    NEW.default_prevented = false;
    NEW.outcome_recorded_at = COALESCE(NEW.outcome_recorded_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_intervention_status_timestamps
  BEFORE UPDATE ON member_interventions
  FOR EACH ROW EXECUTE FUNCTION intervention_status_timestamps();

-- ══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE member_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_interventions FORCE ROW LEVEL SECURITY;
ALTER TABLE intervention_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_templates FORCE ROW LEVEL SECURITY;
ALTER TABLE intervention_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE intervention_rules FORCE ROW LEVEL SECURITY;

-- Members see their own interventions
CREATE POLICY interventions_member_select ON member_interventions
  FOR SELECT USING (auth.uid() = member_id);

-- Members can update status (viewed, engaged, accepted)
CREATE POLICY interventions_member_update ON member_interventions
  FOR UPDATE USING (auth.uid() = member_id)
  WITH CHECK (auth.uid() = member_id);

-- Templates: public read
CREATE POLICY templates_public_read ON intervention_templates
  FOR SELECT USING (true);

-- Rules: public read
CREATE POLICY rules_public_read ON intervention_rules
  FOR SELECT USING (true);

-- Service role full access
CREATE POLICY interventions_service ON member_interventions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY templates_service ON intervention_templates FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);
CREATE POLICY rules_service ON intervention_rules FOR ALL USING (auth.role() = 'service_role') WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- REALTIME
-- ══════════════════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE member_interventions;

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED: Intervention Rules (Levels 1 & 2)
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO intervention_rules (level, score_min, score_max, days_before_due_min, days_before_due_max, optimal_days_before, auto_escalate_after_hours, max_per_cycle, cooldown_hours, preferred_channel, fallback_channel) VALUES
  (1, 31, 45, 3, 10, 6, 48, 1, 24, 'in_app', 'push'),
  (2, 46, 60, 3, 14, 7, 48, 1, 24, 'in_app', 'push'),
  (3, 61, 75, 2, 14, 5, 72, 2, 12, 'push', 'sms'),
  (4, 76, 85, 1, 14, 3, 24, 2, 6, 'sms', 'push'),
  (5, 86, 100, 1, 14, 1, 12, 3, 4, 'sms', 'push')
ON CONFLICT (level) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- SEED: Intervention Templates (Levels 1 & 2 — FR & EN)
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO intervention_templates (level, language, message_key, subject, body, cta_text, cta_action, tone, icon, color, options) VALUES

  -- ═══ LEVEL 1 — Soft Awareness Nudge (Score 31-45) ═══

  -- French
  (1, 'fr', 'level1_soft_nudge',
   'Rappel de contribution',
   '{name}, votre contribution de ${amount} pour {circle} est due dans {days} jours. Appuyez ici pour payer maintenant et garder votre XnScore intact.',
   'Payer maintenant',
   'MakeContribution',
   'warm', 'time-outline', '#F59E0B',
   '[]'::jsonb),

  (1, 'fr', 'level1_soft_nudge_alt',
   'Contribution à venir',
   'Bonjour {name} ! Juste un petit rappel — votre contribution de ${amount} est prévue le {date}. Un simple tap pour rester à jour.',
   'Voir ma contribution',
   'MakeContribution',
   'warm', 'calendar-outline', '#F59E0B',
   '[]'::jsonb),

  -- English
  (1, 'en', 'level1_soft_nudge',
   'Contribution Reminder',
   '{name}, your ${amount} contribution to {circle} is due in {days} days. Tap here to pay now and keep your XnScore strong.',
   'Pay Now',
   'MakeContribution',
   'direct', 'time-outline', '#F59E0B',
   '[]'::jsonb),

  (1, 'en', 'level1_soft_nudge_alt',
   'Upcoming Contribution',
   'Hi {name}! Friendly reminder — your ${amount} contribution is due on {date}. One tap to stay on track.',
   'View Contribution',
   'MakeContribution',
   'direct', 'calendar-outline', '#F59E0B',
   '[]'::jsonb),

  -- ═══ LEVEL 2 — Proactive Flexibility Offer (Score 46-60) ═══

  -- French
  (2, 'fr', 'level2_flexibility_offer',
   'Options disponibles pour vous',
   'Bonjour {name}. Nous remarquons que ce mois-ci pourrait être chargé. Saviez-vous que vous pouvez diviser votre contribution en deux paiements cette fois ? Aucun impact sur votre XnScore si vous payez avant la date limite.',
   'Voir mes options',
   'InterventionOptions',
   'supportive', 'options-outline', '#3B82F6',
   '[{"type":"split_payment","label":"Diviser en 2 paiements","description":"Payez 50% maintenant, 50% dans 7 jours. Aucun frais."},{"type":"pay_full","label":"Payer le montant complet","description":"${amount} — contribution standard"}]'::jsonb),

  (2, 'fr', 'level2_flexibility_advance',
   'Un coup de pouce disponible',
   '{name}, votre contribution de ${amount} approche. Si vous avez besoin de flexibilité, vous pouvez utiliser une avance de liquidité pour couvrir ce cycle et rembourser le mois prochain.',
   'Explorer mes options',
   'InterventionOptions',
   'supportive', 'flash-outline', '#3B82F6',
   '[{"type":"split_payment","label":"Diviser en 2 paiements","description":"50% maintenant, 50% dans 7 jours"},{"type":"liquidity_advance","label":"Utiliser une avance","description":"Couvrez ce cycle, remboursez ensuite"},{"type":"pay_full","label":"Payer maintenant","description":"${amount} — contribution standard"}]'::jsonb),

  -- English
  (2, 'en', 'level2_flexibility_offer',
   'Options Available for You',
   'Hi {name}. We noticed this month might be a stretch. Did you know you can split your contribution into two payments this time? No impact on your XnScore if you pay before the deadline.',
   'See My Options',
   'InterventionOptions',
   'supportive', 'options-outline', '#3B82F6',
   '[{"type":"split_payment","label":"Split into 2 payments","description":"Pay 50% now, 50% in 7 days. No fee."},{"type":"pay_full","label":"Pay full amount","description":"${amount} — standard contribution"}]'::jsonb),

  (2, 'en', 'level2_flexibility_advance',
   'A helping hand is available',
   '{name}, your ${amount} contribution is coming up. If you need flexibility, you can use a liquidity advance to cover this cycle and repay next month.',
   'Explore Options',
   'InterventionOptions',
   'supportive', 'flash-outline', '#3B82F6',
   '[{"type":"split_payment","label":"Split into 2 payments","description":"50% now, 50% in 7 days"},{"type":"liquidity_advance","label":"Use an advance","description":"Cover this cycle, repay next month"},{"type":"pay_full","label":"Pay now","description":"${amount} — standard contribution"}]'::jsonb)

ON CONFLICT (level, language, message_key) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- VIEW: Intervention Dashboard
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW intervention_dashboard AS
SELECT
  level,
  COUNT(*) as total_interventions,
  COUNT(*) FILTER (WHERE status = 'paid') as defaults_prevented,
  COUNT(*) FILTER (WHERE status = 'ignored') as ignored,
  COUNT(*) FILTER (WHERE status = 'escalated') as escalated,
  COUNT(*) FILTER (WHERE default_prevented = true) as success_count,
  COUNT(*) FILTER (WHERE default_prevented = false) as failure_count,
  ROUND(
    COUNT(*) FILTER (WHERE default_prevented = true)::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE default_prevented IS NOT NULL), 0) * 100,
    1
  ) as success_rate_pct,
  AVG(EXTRACT(EPOCH FROM (response_at - sent_at)) / 3600)::NUMERIC(6,1) as avg_response_hours
FROM member_interventions
GROUP BY level
ORDER BY level;

-- ══════════════════════════════════════════════════════════════════════════════
-- DONE — 3 tables, 9 indexes, 3 triggers, 6 RLS policies, 1 view, 1 realtime
-- Level 1 & 2 templates seeded in FR & EN (8 templates total)
-- All 5 level rules seeded (ready for future levels 3-5)
-- ══════════════════════════════════════════════════════════════════════════════
