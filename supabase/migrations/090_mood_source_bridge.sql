-- ════════════════════════════════════════════════════════════════════════════
-- Migration 090: Mood Detection — source bridging + per-message NLP trigger
-- ════════════════════════════════════════════════════════════════════════════
-- Reality check vs spec:
--
-- The spec assumed member_messages didn't exist and proposed creating it
-- with columns (text, polarity, response_latency_seconds, analyzed BOOL,
-- channels including feed_comment/trip_message). That schema doesn't match
-- what's already in prod from migration 061:
--
--   message_text TEXT NOT NULL     (NOT 'text')
--   polarity_score NUMERIC(5,3)    (NOT 'polarity')
--   response_latency_hours NUMERIC (NOT response_latency_seconds INT)
--   analyzed_at TIMESTAMPTZ        (NOT analyzed BOOL — null = unanalyzed)
--   channel CHECK ∈ {support_ticket, circle_chat, direct_message,
--                    community_post, contribution_note}
--                                  (feed_comment / trip_message would 23514)
--   message_length INTEGER GENERATED ALWAYS AS (word_count) STORED
--
-- So this migration does NOT touch the table — it only adds:
--   PART A — bridge_support_tickets_to_messages() RPC. Reads support_tickets,
--            inserts new ones into member_messages with channel='support_ticket',
--            using thread_id = ticket.id for idempotent dedup.
--   PART B — notify_mood_analyze() trigger function that POSTs to the
--            mood-analyze-message Edge Function (pg_net, fire-and-forget).
--   PART C — AFTER INSERT trigger on member_messages that fires the EF,
--            but only for rows that aren't already analyzed and aren't
--            excluded — important so cron-bridge inserts get analyzed AND
--            test/admin inserts that pre-set analyzed_at don't double-analyze.
--
-- FK note: member_messages.member_id REFERENCES profiles(id). support_tickets.
-- user_id REFERENCES public.users(id) (NOT auth.users — see the Signal B
-- finding). The bridge function adds a profiles-existence guard so tickets
-- for users-without-profiles silently skip rather than 23503.
-- ════════════════════════════════════════════════════════════════════════════


-- ─── PART A: bridge_support_tickets_to_messages ──────────────────────────

CREATE OR REPLACE FUNCTION bridge_support_tickets_to_messages()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ticket RECORD;
  v_combined_text TEXT;
  v_inserted INTEGER := 0;
  v_skipped_dup INTEGER := 0;
  v_skipped_no_profile INTEGER := 0;
  v_skipped_no_user INTEGER := 0;
BEGIN
  FOR v_ticket IN
    SELECT id, user_id, subject, description, language, created_at
    FROM support_tickets
    WHERE user_id IS NOT NULL
      AND created_at > NOW() - INTERVAL '90 days'  -- baseline window cap
  LOOP
    -- Dedup: thread_id = ticket.id is the canonical link.
    IF EXISTS (
      SELECT 1 FROM member_messages
      WHERE channel = 'support_ticket' AND thread_id = v_ticket.id
    ) THEN
      v_skipped_dup := v_skipped_dup + 1;
      CONTINUE;
    END IF;

    -- FK guard: member_messages.member_id → profiles(id). If no profile,
    -- skip silently. Same pattern as Signals B/C.
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_ticket.user_id) THEN
      v_skipped_no_profile := v_skipped_no_profile + 1;
      CONTINUE;
    END IF;

    -- Combine subject + description for richer text analysis. Both are
    -- NOT NULL on support_tickets so the concat is safe.
    v_combined_text := v_ticket.subject || E'\n' || v_ticket.description;

    INSERT INTO member_messages (
      member_id,
      message_text,
      channel,
      thread_id,           -- ticket.id, for dedup
      language,
      sent_at
    ) VALUES (
      v_ticket.user_id,
      v_combined_text,
      'support_ticket',
      v_ticket.id,
      COALESCE(v_ticket.language, 'en'),
      v_ticket.created_at
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'inserted', v_inserted,
    'skipped_dup', v_skipped_dup,
    'skipped_no_profile', v_skipped_no_profile,
    'source', 'bridge_support_tickets_to_messages',
    'note', 'Bridges support_tickets → member_messages for mood analysis. Uses thread_id = ticket.id for idempotency. Combines subject + description into message_text.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bridge_support_tickets_to_messages() TO service_role;
REVOKE EXECUTE ON FUNCTION public.bridge_support_tickets_to_messages() FROM PUBLIC, anon, authenticated;


-- ─── PART B + C: AFTER INSERT trigger → mood-analyze-message EF ──────────

CREATE OR REPLACE FUNCTION public.notify_mood_analyze()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_url TEXT := 'https://fjqdkyjkwqeoafwvnjgv.supabase.co/functions/v1/mood-analyze-message';
  v_srk TEXT;
BEGIN
  -- Same pattern as the project's other crons / trigger-driven EFs.
  v_srk := COALESCE(current_setting('app.settings.service_role_key', true), '');

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || v_srk,
      'Content-Type',  'application/json'
    ),
    body := jsonb_build_object('messageId', NEW.id)
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_mood_analyze() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_mood_analyze() TO authenticated, service_role;

-- AFTER INSERT trigger. WHEN clause: only fire if NOT excluded AND NOT
-- already analyzed. Important for:
--   - Test rows that explicitly set excluded_from_analysis=true
--   - Rows inserted by an admin tool that pre-sets analyzed_at (e.g.,
--     a backfill that already has scores)
DROP TRIGGER IF EXISTS mood_analyze_trigger ON member_messages;
CREATE TRIGGER mood_analyze_trigger
  AFTER INSERT ON member_messages
  FOR EACH ROW
  WHEN (NEW.excluded_from_analysis = false AND NEW.analyzed_at IS NULL)
  EXECUTE FUNCTION public.notify_mood_analyze();


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('090', 'mood_source_bridge',
        ARRAY['-- 090: bridge_support_tickets_to_messages + AFTER INSERT trigger → mood-analyze-message'])
ON CONFLICT (version) DO NOTHING;
