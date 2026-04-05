-- ═══════════════════════════════════════════════════════════════════════════════
-- MIGRATION 047: Multilingual Legal Terms Simplifier
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Every legal document gets a plain-language summary in the member's preferred
-- language (15 languages). Two-layer display: summary on top, full text below.
-- Members sign the full document; the summary ensures informed consent.
-- AI simplification pipeline drafts summaries; legal team approves.
--
-- Tables: legal_documents, legal_document_content, member_legal_acceptances,
--         ai_simplification_jobs
-- ═══════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 1: legal_documents
-- Document metadata + versioning. One active version per document type.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  document_type TEXT NOT NULL CHECK (document_type IN (
    'terms_of_service', 'privacy_policy', 'circle_participation',
    'liquidity_advance', 'kyc_consent', 'payout_authorization'
  )),

  version INTEGER NOT NULL,

  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'review', 'active', 'archived'
  )),

  effective_date TIMESTAMPTZ,
  requires_reconfirmation BOOLEAN NOT NULL DEFAULT false,

  -- Per-language bullet points of changes from previous version
  -- Format: {"en": ["Changed X", "Added Y"], "fr": ["Modifié X", "Ajouté Y"], ...}
  change_summary JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(document_type, version)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 2: legal_document_content
-- Full legal text + plain language summary per language per document.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS legal_document_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,

  language TEXT NOT NULL CHECK (language IN (
    'en','fr','es','pt','hi','tl','zh','vi','ko','ar','am','sw','yo','ha','ht'
  )),

  full_text TEXT NOT NULL,
  summary_text TEXT,

  -- AI simplification tracking
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  ai_approved BOOLEAN NOT NULL DEFAULT false,
  ai_approved_by TEXT,
  ai_approved_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(document_id, language)
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 3: member_legal_acceptances
-- Immutable audit trail. Members can INSERT (accept) but never UPDATE/DELETE.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS member_legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,

  -- Denormalized for fast queries without joins
  document_type TEXT NOT NULL,
  version INTEGER NOT NULL,

  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  device_info TEXT,
  language_viewed TEXT NOT NULL DEFAULT 'en',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE 4: ai_simplification_jobs
-- Tracks Claude API simplification requests. Client creates job, backend
-- Edge Function processes it, legal team approves/rejects output.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_simplification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  document_id UUID NOT NULL REFERENCES legal_documents(id) ON DELETE CASCADE,

  language TEXT NOT NULL,
  source_text TEXT NOT NULL,
  prompt_used TEXT NOT NULL,
  ai_output TEXT,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'approved', 'rejected'
  )),

  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_legal_documents_active
  ON legal_documents(document_type, status)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_legal_document_content_lookup
  ON legal_document_content(document_id, language);

CREATE INDEX IF NOT EXISTS idx_member_legal_acceptances_member
  ON member_legal_acceptances(member_id, document_type, version DESC);

CREATE INDEX IF NOT EXISTS idx_member_legal_acceptances_document
  ON member_legal_acceptances(document_id);

CREATE INDEX IF NOT EXISTS idx_ai_simplification_jobs_document
  ON ai_simplification_jobs(document_id, language);

CREATE INDEX IF NOT EXISTS idx_ai_simplification_jobs_status
  ON ai_simplification_jobs(status)
  WHERE status IN ('pending', 'processing');


-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_document_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_simplification_jobs ENABLE ROW LEVEL SECURITY;

-- legal_documents: all authenticated can read, service_role manages
CREATE POLICY "legal_documents_select_auth" ON legal_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "legal_documents_service_all" ON legal_documents
  FOR ALL USING (auth.role() = 'service_role');

-- legal_document_content: all authenticated can read, service_role manages
CREATE POLICY "legal_document_content_select_auth" ON legal_document_content
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "legal_document_content_service_all" ON legal_document_content
  FOR ALL USING (auth.role() = 'service_role');

-- member_legal_acceptances: members SELECT + INSERT own, NO UPDATE/DELETE
CREATE POLICY "member_legal_acceptances_select_own" ON member_legal_acceptances
  FOR SELECT USING (member_id = auth.uid());

CREATE POLICY "member_legal_acceptances_insert_own" ON member_legal_acceptances
  FOR INSERT WITH CHECK (member_id = auth.uid());

CREATE POLICY "member_legal_acceptances_service_all" ON member_legal_acceptances
  FOR ALL USING (auth.role() = 'service_role');

-- ai_simplification_jobs: authenticated can read, service_role manages
CREATE POLICY "ai_simplification_jobs_select_auth" ON ai_simplification_jobs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ai_simplification_jobs_service_all" ON ai_simplification_jobs
  FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────────
-- REALTIME
-- ─────────────────────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE legal_documents;
ALTER PUBLICATION supabase_realtime ADD TABLE member_legal_acceptances;


-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TRIGGER trg_legal_documents_updated_at
  BEFORE UPDATE ON legal_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_legal_document_content_updated_at
  BEFORE UPDATE ON legal_document_content
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ai_simplification_jobs_updated_at
  BEFORE UPDATE ON ai_simplification_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
