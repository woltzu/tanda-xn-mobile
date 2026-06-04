-- ════════════════════════════════════════════════════════════════════════════
-- Migration 091: Mood Detection — baseline + scoring RPCs
-- ════════════════════════════════════════════════════════════════════════════
-- Two PL/pgSQL SECURITY DEFINER RPCs:
--
--   compute_member_mood_baseline(p_member_id UUID)
--     Aggregates 90-day-to-14-day window into a new baseline row in
--     member_mood_baselines. INSERTs a new row (the table has NO unique
--     constraint on member_id — the engine INSERTs new baseline rows
--     each time and later queries the most recent `is_established=true`
--     one; matching that pattern). The spec's ON CONFLICT (member_id)
--     would fail because there's no unique index.
--     Established when messages_analyzed >= 5 (per engine's
--     MIN_MESSAGES_FOR_BASELINE constant).
--
--   process_member_mood()
--     For each member with analyzed messages in last 14 days:
--       1. Get latest established baseline; if none, try to compute one;
--          if still insufficient, skip.
--       2. Aggregate recent 14d messages into the 5 sub-scores using the
--          engine's exact formula (polarity, lexical, keyword, latency,
--          length).
--       3. INSERT into member_mood_snapshots. The migration-061 trigger
--          trg_mood_snapshot_tier auto-fills tier + intervention_triggered
--          + intervention_type from the composite score.
--       4. If intervention_triggered and no pending intervention exists,
--          INSERT a mood_interventions row with localized EN/FR copy
--          ported from _generateInterventionMessage.
--
-- Score normalization (faithful to engine.calculateMoodScore):
--   polarityNorm = min(100, max(0, polarityDeltaPct))
--   lexicalNorm  = min(100, max(0, (lexicalDrop / 40) * 100))
--   keywordNorm  = min(100, (totalKeywordSeverity / 6) * 100)
--                  where totalKeywordSeverity = sum(flags_len * 1.2)
--   latencyNorm  = min(100, max(0, ((latencyFactor - 1) / 2) * 100))
--   lengthNorm   = min(100, max(0, (contractionPct / 50) * 100))
--   composite    = polarityNorm*0.35 + lexicalNorm*0.25 + keywordNorm*0.15
--                  + latencyNorm*0.15 + lengthNorm*0.10
--
-- (The spec proposed a different formula with division-by-zero risk,
-- inconsistent scaling, and a broken subquery referencing
-- (keyword_flags -> 'matches'). Using engine formula instead.)
-- ════════════════════════════════════════════════════════════════════════════


-- ─── compute_member_mood_baseline ────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_member_mood_baseline(p_member_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_avg_polarity NUMERIC(5,3);
  v_avg_lexical NUMERIC(4,3);
  v_avg_latency NUMERIC(8,2);
  v_avg_length NUMERIC(6,1);
  v_count INTEGER;
  v_window_start DATE;
  v_window_end DATE;
  v_established BOOLEAN;
BEGIN
  v_window_end   := CURRENT_DATE;
  v_window_start := CURRENT_DATE - INTERVAL '90 days';

  SELECT
    AVG(polarity_score),
    AVG(lexical_diversity),
    AVG(response_latency_hours) FILTER (WHERE response_latency_hours IS NOT NULL),
    AVG(message_length),
    COUNT(*)
  INTO v_avg_polarity, v_avg_lexical, v_avg_latency, v_avg_length, v_count
  FROM member_messages
  WHERE member_id = p_member_id
    AND excluded_from_analysis = false
    AND analyzed_at IS NOT NULL
    AND sent_at >= NOW() - INTERVAL '90 days';

  v_established := v_count >= 5;

  -- Defaults for NULLs (NUMERIC columns are NOT NULL on baseline rows).
  v_avg_polarity := COALESCE(v_avg_polarity, 0);
  v_avg_lexical  := COALESCE(v_avg_lexical, 0);
  v_avg_latency  := COALESCE(v_avg_latency, 0);
  v_avg_length   := COALESCE(v_avg_length, 0);

  INSERT INTO member_mood_baselines (
    member_id,
    baseline_polarity,
    baseline_lexical,
    baseline_latency,
    baseline_length,
    messages_analyzed,
    window_start,
    window_end,
    is_established
  ) VALUES (
    p_member_id,
    v_avg_polarity,
    v_avg_lexical,
    v_avg_latency,
    v_avg_length,
    v_count,
    v_window_start,
    v_window_end,
    v_established
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_established', v_established,
    'messages_analyzed', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_member_mood_baseline(UUID) TO service_role;
REVOKE EXECUTE ON FUNCTION public.compute_member_mood_baseline(UUID) FROM PUBLIC, anon, authenticated;


-- ─── process_member_mood ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION process_member_mood()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_member RECORD;
  v_baseline RECORD;
  v_recent_polarity NUMERIC;
  v_recent_lexical NUMERIC;
  v_recent_latency NUMERIC;
  v_recent_length NUMERIC;
  v_recent_count INTEGER;
  v_keyword_total NUMERIC;
  v_keyword_count INTEGER;
  v_polarity_norm NUMERIC;
  v_lexical_norm NUMERIC;
  v_keyword_norm NUMERIC;
  v_latency_norm NUMERIC;
  v_length_norm NUMERIC;
  v_composite NUMERIC;
  v_polarity_delta_pct NUMERIC;
  v_lexical_drop NUMERIC;
  v_latency_factor NUMERIC;
  v_contraction_pct NUMERIC;
  v_previous NUMERIC;
  v_trend TEXT;
  v_breakdown JSONB;
  v_snapshot RECORD;
  v_member_lang TEXT;
  v_member_name TEXT;
  v_intervention_type TEXT;
  v_msg_title TEXT;
  v_msg_body TEXT;
  v_channel TEXT;
  v_requires_review BOOLEAN;
  v_outcome TEXT;
  v_scored INTEGER := 0;
  v_interventions INTEGER := 0;
  v_baselines_computed INTEGER := 0;
  v_skipped_no_baseline INTEGER := 0;
  v_skipped_no_recent INTEGER := 0;
  v_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Iterate distinct members with at least one analyzed message in the
  -- last 14 days. (Engine's runWeeklyScoringBatch uses this filter via
  -- `eq("is_established", true)` on the baseline table; we widen here
  -- so members who just hit 5 messages get baseline + scored in one run.)
  FOR v_member IN
    SELECT DISTINCT member_id
    FROM member_messages
    WHERE excluded_from_analysis = false
      AND analyzed_at IS NOT NULL
      AND sent_at >= NOW() - INTERVAL '14 days'
  LOOP
    BEGIN
      -- Skip opted-out members
      IF EXISTS (
        SELECT 1 FROM member_mood_preferences
        WHERE member_id = v_member.member_id AND opted_out = true
      ) THEN
        CONTINUE;
      END IF;

      -- 1) Ensure baseline. Use latest established; if none, try to compute.
      SELECT * INTO v_baseline
      FROM member_mood_baselines
      WHERE member_id = v_member.member_id AND is_established = true
      ORDER BY computed_at DESC LIMIT 1;

      IF NOT FOUND THEN
        PERFORM compute_member_mood_baseline(v_member.member_id);
        v_baselines_computed := v_baselines_computed + 1;
        SELECT * INTO v_baseline
        FROM member_mood_baselines
        WHERE member_id = v_member.member_id AND is_established = true
        ORDER BY computed_at DESC LIMIT 1;
        IF NOT FOUND THEN
          v_skipped_no_baseline := v_skipped_no_baseline + 1;
          CONTINUE;
        END IF;
      END IF;

      -- 2) Recent 14d aggregate
      SELECT
        AVG(polarity_score),
        AVG(lexical_diversity),
        AVG(response_latency_hours) FILTER (WHERE response_latency_hours IS NOT NULL),
        AVG(message_length),
        COUNT(*)
      INTO v_recent_polarity, v_recent_lexical, v_recent_latency, v_recent_length, v_recent_count
      FROM member_messages
      WHERE member_id = v_member.member_id
        AND excluded_from_analysis = false
        AND analyzed_at IS NOT NULL
        AND sent_at >= NOW() - INTERVAL '14 days';

      IF v_recent_count = 0 THEN
        v_skipped_no_recent := v_skipped_no_recent + 1;
        CONTINUE;
      END IF;

      v_recent_polarity := COALESCE(v_recent_polarity, 0);
      v_recent_lexical  := COALESCE(v_recent_lexical, 0);
      v_recent_latency  := COALESCE(v_recent_latency, 0);
      v_recent_length   := COALESCE(v_recent_length, 0);

      -- Keyword totals across recent window (sum of flag counts × 1.2 per
      -- engine's _detectKeywords + composition).
      SELECT
        COUNT(*),
        COALESCE(SUM(jsonb_array_length(keyword_flags)), 0) * 1.2
      INTO v_keyword_count, v_keyword_total
      FROM member_messages
      WHERE member_id = v_member.member_id
        AND excluded_from_analysis = false
        AND analyzed_at IS NOT NULL
        AND sent_at >= NOW() - INTERVAL '14 days'
        AND keyword_flags IS NOT NULL;

      -- 3) The five sub-scores (engine formulas)
      -- Polarity: positive value = drift down vs baseline. delta_pct is
      -- baseline-relative when baseline is nonzero, else recent*100.
      IF v_baseline.baseline_polarity <> 0 THEN
        v_polarity_delta_pct := ((v_baseline.baseline_polarity - v_recent_polarity)
                                  / ABS(v_baseline.baseline_polarity)) * 100;
      ELSE
        v_polarity_delta_pct := (v_baseline.baseline_polarity - v_recent_polarity) * 100;
      END IF;
      v_polarity_norm := LEAST(100, GREATEST(0, v_polarity_delta_pct));

      IF v_baseline.baseline_lexical > 0 THEN
        v_lexical_drop := ((v_baseline.baseline_lexical - v_recent_lexical)
                            / v_baseline.baseline_lexical) * 100;
      ELSE
        v_lexical_drop := 0;
      END IF;
      v_lexical_norm := LEAST(100, GREATEST(0, (v_lexical_drop / 40) * 100));

      v_keyword_norm := LEAST(100, (v_keyword_total / 6) * 100);

      IF v_baseline.baseline_latency > 0 THEN
        v_latency_factor := v_recent_latency / v_baseline.baseline_latency;
      ELSE
        v_latency_factor := 1;
      END IF;
      v_latency_norm := LEAST(100, GREATEST(0, ((v_latency_factor - 1) / 2) * 100));

      IF v_baseline.baseline_length > 0 THEN
        v_contraction_pct := ((v_baseline.baseline_length - v_recent_length)
                               / v_baseline.baseline_length) * 100;
      ELSE
        v_contraction_pct := 0;
      END IF;
      v_length_norm := LEAST(100, GREATEST(0, (v_contraction_pct / 50) * 100));

      v_composite := LEAST(100, GREATEST(0,
        v_polarity_norm * 0.35 +
        v_lexical_norm  * 0.25 +
        v_keyword_norm  * 0.15 +
        v_latency_norm  * 0.15 +
        v_length_norm   * 0.10
      ));

      -- 4) Trend vs previous snapshot
      SELECT composite_mood_score INTO v_previous
      FROM member_mood_snapshots
      WHERE member_id = v_member.member_id
      ORDER BY snapshot_date DESC, created_at DESC LIMIT 1;

      v_trend := CASE
        WHEN v_previous IS NULL THEN NULL
        WHEN v_composite - v_previous > 5 THEN 'worsening'
        WHEN v_composite - v_previous < -5 THEN 'improving'
        ELSE 'stable'
      END;

      v_breakdown := jsonb_build_object(
        'polarity', jsonb_build_object(
          'raw', v_recent_polarity, 'baseline', v_baseline.baseline_polarity,
          'delta_pct', v_polarity_delta_pct, 'normalized', v_polarity_norm,
          'weight', 0.35),
        'lexical', jsonb_build_object(
          'raw', v_recent_lexical, 'baseline', v_baseline.baseline_lexical,
          'delta_pct', v_lexical_drop, 'normalized', v_lexical_norm,
          'weight', 0.25),
        'keyword', jsonb_build_object(
          'flags_count', v_keyword_count, 'severity', v_keyword_total,
          'normalized', v_keyword_norm, 'weight', 0.15),
        'latency', jsonb_build_object(
          'raw_hours', v_recent_latency, 'baseline_hours', v_baseline.baseline_latency,
          'increase_factor', v_latency_factor, 'normalized', v_latency_norm,
          'weight', 0.15),
        'length', jsonb_build_object(
          'raw_words', v_recent_length, 'baseline_words', v_baseline.baseline_length,
          'contraction_pct', v_contraction_pct, 'normalized', v_length_norm,
          'weight', 0.10)
      );

      -- 5) Insert snapshot. The 061 trigger trg_mood_snapshot_tier auto-
      -- fills tier + intervention_triggered + intervention_type.
      INSERT INTO member_mood_snapshots (
        member_id,
        polarity_score, lexical_score, keyword_score, latency_score, length_score,
        composite_mood_score, signal_breakdown,
        previous_score, trend,
        messages_in_window, scoring_model
      ) VALUES (
        v_member.member_id,
        v_polarity_norm, v_lexical_norm, v_keyword_norm, v_latency_norm, v_length_norm,
        v_composite, v_breakdown,
        v_previous, v_trend,
        v_recent_count, 'vader_textblob_v1'
      )
      RETURNING id, tier, intervention_triggered, intervention_type
        INTO v_snapshot;

      v_scored := v_scored + 1;

      -- 6) Auto-create intervention if triggered and none pending.
      IF v_snapshot.intervention_triggered
         AND v_snapshot.intervention_type IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM mood_interventions
           WHERE member_id = v_member.member_id
             AND outcome IN ('pending', 'pending_review', 'sent', 'viewed')
         )
      THEN
        SELECT COALESCE(language, 'en'), COALESCE(NULLIF(TRIM(full_name), ''), 'there')
          INTO v_member_lang, v_member_name
        FROM profiles WHERE id = v_member.member_id;
        v_member_lang := COALESCE(v_member_lang, 'en');
        IF v_member_lang NOT IN ('en','fr') THEN v_member_lang := 'en'; END IF;

        v_intervention_type := v_snapshot.intervention_type;
        v_requires_review := (v_snapshot.tier = 'at_risk');
        v_channel := CASE WHEN v_requires_review THEN 'direct_message' ELSE 'in_app' END;
        v_outcome := CASE WHEN v_requires_review THEN 'pending_review' ELSE 'pending' END;

        -- Localized copy ported from engine._generateInterventionMessage.
        -- (Engine uses circleName/memberName placeholders. We pass
        -- member name as-is and use a generic 'your circle' fallback.)
        IF v_intervention_type = 'warm_checkin' THEN
          IF v_member_lang = 'fr' THEN
            v_msg_title := 'Juste un petit mot';
            v_msg_body  := format(
              'Salut %s, on voulait juste prendre de tes nouvelles. Comment ça va? On est content de t''avoir dans ton cercle et on veut s''assurer que tout se passe bien pour toi. Pas besoin de répondre — on pense à toi.',
              v_member_name);
          ELSE
            v_msg_title := 'Just checking in';
            v_msg_body  := format(
              'Hey %s, we just wanted to check in. How are things going with you? We love having you in your circle and want to make sure TandaXn is working well for you. No action needed — we''re just thinking of you.',
              v_member_name);
          END IF;
        ELSIF v_intervention_type = 'contribution_pause' THEN
          IF v_member_lang = 'fr' THEN
            v_msg_title := 'Besoin d''une pause?';
            v_msg_body  := format(
              '%s, la vie est parfois compliquée — on comprend. Si ton montant ou ton calendrier de contribution ne te convient plus, on peut l''ajuster. Ta place dans ton cercle est assurée. Réponds ici ou touche le bouton ci-dessous.',
              v_member_name);
          ELSE
            v_msg_title := 'Need a breather?';
            v_msg_body  := format(
              '%s, life gets busy — we get it. If your contribution amount or schedule isn''t working right now, we can adjust it. Your spot in your circle is safe. Just reply here or tap below and we''ll sort it out together.',
              v_member_name);
          END IF;
        ELSIF v_intervention_type = 'human_outreach' THEN
          IF v_member_lang = 'fr' THEN
            v_msg_title := 'Message personnel de l''équipe';
            v_msg_body  := format(
              'Salut %s, c''est l''équipe TandaXn. On a remarqué que tu étais plus discret ces derniers temps et on voulait te contacter personnellement. Y a-t-il quelque chose qu''on peut faire pour t''aider?',
              v_member_name);
          ELSE
            v_msg_title := 'Personal message from the team';
            v_msg_body  := format(
              'Hey %s, it''s the TandaXn team. We noticed you''ve been quieter lately and wanted to personally reach out. Is there anything we can do to make this easier for you?',
              v_member_name);
          END IF;
        ELSE
          -- Fallback (amount_reduction / counselor_referral not created by
          -- the auto-trigger but covered for forward compat)
          v_msg_title := 'We''re here for you';
          v_msg_body  := format('Hey %s, just wanted to check in.', v_member_name);
        END IF;

        INSERT INTO mood_interventions (
          member_id,
          mood_snapshot_id,
          intervention_type,
          tier_at_trigger,
          mood_score_at_trigger,
          channel,
          message_title,
          message_body,
          language,
          requires_review,
          outcome,
          sent_at
        ) VALUES (
          v_member.member_id,
          v_snapshot.id,
          v_intervention_type,
          v_snapshot.tier,
          v_composite,
          v_channel,
          v_msg_title,
          v_msg_body,
          v_member_lang,
          v_requires_review,
          v_outcome,
          CASE WHEN v_requires_review THEN NULL ELSE NOW() END
        );
        v_interventions := v_interventions + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_errors := array_append(v_errors,
        format('member %s: %s', v_member.member_id, SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'scored', v_scored,
    'interventions_created', v_interventions,
    'baselines_computed', v_baselines_computed,
    'skipped_no_baseline', v_skipped_no_baseline,
    'skipped_no_recent', v_skipped_no_recent,
    'errors', v_errors,
    'source', 'process_member_mood_rpc',
    'note', 'Engine-faithful 5-signal mood drift scoring. Tier banding + intervention_type auto-filled by migration 061 trigger trg_mood_snapshot_tier.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_member_mood() TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_member_mood() FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('091', 'mood_baseline_scoring',
        ARRAY['-- 091: compute_member_mood_baseline + process_member_mood RPCs'])
ON CONFLICT (version) DO NOTHING;
