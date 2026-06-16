-- 179_initial_legal_documents.sql
-- =====================================================================
-- Seed initial v1 placeholders for terms_of_service + privacy_policy.
--
-- Why this migration exists:
--   The legal_documents pipeline (engine, RPC, screens) all came online
--   in earlier migrations. The list screen, the reader screen, the
--   record_legal_acceptance RPC (178), and the signup flow are all
--   wired up — but with zero rows in legal_documents the screen renders
--   an empty state and signups can never record acceptances.
--
--   This migration drops in v1 PLACEHOLDERS so the audit trail starts
--   working. The full_text and summary_text fields MUST be replaced by
--   the legal team with real text before launch. The "[placeholder]"
--   strings here are deliberate — they show up verbatim on the screen
--   so anyone hitting them in QA can see exactly what's missing.
--
-- Schema notes:
--   - legal_documents.version is INTEGER (not semver). Stays 1 until
--     a v2 ships, at which point the legal team publishes a new
--     migration with the new content + flips this row to archived.
--   - legal_document_content.document_id (not legal_document_id) and
--     .language (not language_code) — both names are easy to confuse.
--   - UNIQUE(document_type, version) on legal_documents and
--     UNIQUE(document_id, language) on legal_document_content provide
--     the natural idempotency for ON CONFLICT.
--
-- Idempotent: skip the INSERT entirely when an active doc of the type
-- already exists. Content INSERTs use ON CONFLICT DO NOTHING against
-- the (document_id, language) unique key.
-- =====================================================================

-- Terms of Service v1
DO $$
DECLARE
  v_doc_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.legal_documents
     WHERE document_type = 'terms_of_service'
       AND status = 'active'
  ) THEN
    RAISE NOTICE 'terms_of_service active doc already exists — skipping seed';
  ELSE
    INSERT INTO public.legal_documents (
      document_type,
      version,
      status,
      effective_date,
      requires_reconfirmation,
      change_summary
    )
    VALUES (
      'terms_of_service',
      1,
      'active',
      NOW(),
      FALSE,
      '{}'::jsonb
    )
    RETURNING id INTO v_doc_id;

    INSERT INTO public.legal_document_content (
      document_id,
      language,
      full_text,
      summary_text
    )
    VALUES
      (
        v_doc_id,
        'en',
        E'# Terms of Service (Placeholder)\n\n'
        'This is a placeholder for the TandaXn Terms of Service. '
        'The legal team must replace this text before launch.\n\n'
        '## 1. Acceptance\n\n'
        'By creating an account you agree to placeholder terms that the '
        'legal team will replace.\n\n'
        '## 2. Your account\n\n'
        'Placeholder section on account responsibilities.\n\n'
        '## 3. Contributions and payouts\n\n'
        'Placeholder section on circle contributions, payouts, and how '
        'TandaXn handles funds.\n\n'
        '## 4. Disputes\n\n'
        'Placeholder section on dispute resolution.\n\n'
        '## 5. Contact\n\n'
        'Placeholder contact information.',
        'These are placeholder Terms of Service. The legal team must '
        'replace this summary before launch.'
      ),
      (
        v_doc_id,
        'fr',
        E'# Conditions d''utilisation (espace réservé)\n\n'
        'Ceci est un espace réservé pour les conditions d''utilisation '
        'de TandaXn. L''équipe juridique doit remplacer ce texte avant '
        'le lancement.\n\n'
        '## 1. Acceptation\n\n'
        'En créant un compte, vous acceptez les conditions provisoires '
        'que l''équipe juridique remplacera.\n\n'
        '## 2. Votre compte\n\n'
        'Section provisoire sur les responsabilités du compte.\n\n'
        '## 3. Contributions et paiements\n\n'
        'Section provisoire sur les contributions au cercle, les '
        'paiements et la gestion des fonds par TandaXn.\n\n'
        '## 4. Litiges\n\n'
        'Section provisoire sur la résolution des litiges.\n\n'
        '## 5. Contact\n\n'
        'Coordonnées provisoires.',
        'Conditions d''utilisation provisoires. L''équipe juridique doit '
        'remplacer ce résumé avant le lancement.'
      )
    ON CONFLICT (document_id, language) DO NOTHING;
  END IF;
END $$;

-- Privacy Policy v1
DO $$
DECLARE
  v_doc_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.legal_documents
     WHERE document_type = 'privacy_policy'
       AND status = 'active'
  ) THEN
    RAISE NOTICE 'privacy_policy active doc already exists — skipping seed';
  ELSE
    INSERT INTO public.legal_documents (
      document_type,
      version,
      status,
      effective_date,
      requires_reconfirmation,
      change_summary
    )
    VALUES (
      'privacy_policy',
      1,
      'active',
      NOW(),
      FALSE,
      '{}'::jsonb
    )
    RETURNING id INTO v_doc_id;

    INSERT INTO public.legal_document_content (
      document_id,
      language,
      full_text,
      summary_text
    )
    VALUES
      (
        v_doc_id,
        'en',
        E'# Privacy Policy (Placeholder)\n\n'
        'This is a placeholder for the TandaXn Privacy Policy. '
        'The legal team must replace this text before launch.\n\n'
        '## 1. Information we collect\n\n'
        'Placeholder section on the categories of data TandaXn collects.\n\n'
        '## 2. How we use information\n\n'
        'Placeholder section on the purposes of processing.\n\n'
        '## 3. Sharing and disclosure\n\n'
        'Placeholder section on third parties and data sharing.\n\n'
        '## 4. Your rights\n\n'
        'Placeholder section on data subject rights and how to exercise '
        'them.\n\n'
        '## 5. Contact and complaints\n\n'
        'Placeholder contact information for privacy questions.',
        'This is a placeholder Privacy Policy summary. The legal team '
        'must replace it before launch.'
      ),
      (
        v_doc_id,
        'fr',
        E'# Politique de confidentialité (espace réservé)\n\n'
        'Ceci est un espace réservé pour la politique de confidentialité '
        'de TandaXn. L''équipe juridique doit remplacer ce texte avant '
        'le lancement.\n\n'
        '## 1. Informations que nous collectons\n\n'
        'Section provisoire sur les catégories de données collectées par '
        'TandaXn.\n\n'
        '## 2. Comment nous utilisons les informations\n\n'
        'Section provisoire sur les finalités du traitement.\n\n'
        '## 3. Partage et divulgation\n\n'
        'Section provisoire sur les tiers et le partage des données.\n\n'
        '## 4. Vos droits\n\n'
        'Section provisoire sur les droits des personnes concernées et '
        'leur exercice.\n\n'
        '## 5. Contact et réclamations\n\n'
        'Coordonnées provisoires pour les questions de confidentialité.',
        'Politique de confidentialité provisoire. L''équipe juridique doit '
        'la remplacer avant le lancement.'
      )
    ON CONFLICT (document_id, language) DO NOTHING;
  END IF;
END $$;

-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '179',
  'initial_legal_documents',
  ARRAY['-- 179: initial_legal_documents']
)
ON CONFLICT (version) DO NOTHING;
