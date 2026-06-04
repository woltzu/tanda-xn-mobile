-- ════════════════════════════════════════════════════════════════════════════
-- Migration 109: Fix scoring-pipeline alerts step
-- ════════════════════════════════════════════════════════════════════════════
-- evaluate_score_alerts (step 5 of run_scoring_pipeline) crashed daily with:
--
--   ERROR 42703: column "message" of relation "notifications" does not exist
--
-- Notifications has columns id, user_id, type, title, BODY, data, read,
-- created_at, … (no `message`). The function's three INSERTs into
-- notifications all used the wrong column name. Each daily pipeline run
-- the alerts step would fail at the first INSERT, the BEGIN..EXCEPTION
-- in run_scoring_pipeline absorbed it, the pipeline reported overall
-- 'partial' instead of 'success', and no notification was ever delivered
-- for any alert type (member default risk, circle health decline,
-- XnScore drop).
--
-- The score_alerts table actually has a `message` column — those INSERTs
-- work correctly. Only the notifications INSERTs needed the rename.
--
-- Fix: rewrite evaluate_score_alerts with `body` in all 3 notifications
-- INSERTs. All other logic preserved bit-for-bit.
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION public.evaluate_score_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
  v_alert_id UUID;
BEGIN
  -- ALERT 1: High default probability
  FOR v_rec IN
    SELECT dps.user_id, dps.predicted_probability, dps.risk_bucket
    FROM default_probability_scores dps
    WHERE dps.predicted_probability > 0.25
      AND NOT EXISTS (
        SELECT 1 FROM score_alerts sa
        WHERE sa.target_type = 'member' AND sa.target_id = dps.user_id
          AND sa.alert_type = 'member_default_risk'
          AND sa.created_at > NOW() - INTERVAL '7 days'
          AND sa.status IN ('open', 'acknowledged')
      )
  LOOP
    INSERT INTO score_alerts (
      alert_type, target_type, target_id, severity, title, message,
      score_value, threshold_value, context
    ) VALUES (
      'member_default_risk', 'member', v_rec.user_id,
      CASE WHEN v_rec.predicted_probability > 0.50 THEN 'critical' ELSE 'warning' END,
      CASE WHEN v_rec.predicted_probability > 0.50 THEN 'Critical Default Risk' ELSE 'Elevated Default Risk' END,
      'Member default probability is ' || ROUND(v_rec.predicted_probability * 100, 1) || '% (' || v_rec.risk_bucket || ')',
      v_rec.predicted_probability,
      CASE WHEN v_rec.predicted_probability > 0.50 THEN 0.50 ELSE 0.25 END,
      jsonb_build_object('risk_bucket', v_rec.risk_bucket)
    ) RETURNING id INTO v_alert_id;

    -- FIX: column is `body`, not `message`
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (v_rec.user_id, 'score_alert',
      'Your payment risk level has increased',
      'Your account shows signs of elevated default risk. Maintain on-time payments to improve your standing.',
      jsonb_build_object('alert_id', v_alert_id, 'risk_bucket', v_rec.risk_bucket));

    INSERT INTO ops_alerts (alert_type, details, priority)
    VALUES ('member_default_risk',
      jsonb_build_object('user_id', v_rec.user_id, 'probability', v_rec.predicted_probability,
        'risk_bucket', v_rec.risk_bucket, 'score_alert_id', v_alert_id),
      CASE WHEN v_rec.predicted_probability > 0.50 THEN 'critical' ELSE 'high' END);
    v_count := v_count + 1;
  END LOOP;

  -- ALERT 2: Circle health decline
  FOR v_rec IN
    SELECT chs.circle_id, chs.health_score, chs.health_status, chs.trend, c.name as circle_name
    FROM circle_health_scores chs JOIN circles c ON c.id = chs.circle_id
    WHERE chs.health_score < 70
      AND NOT EXISTS (
        SELECT 1 FROM score_alerts sa
        WHERE sa.target_type = 'circle' AND sa.target_id = chs.circle_id
          AND sa.alert_type IN ('circle_health_decline', 'circle_critical')
          AND sa.created_at > NOW() - INTERVAL '7 days'
          AND sa.status IN ('open', 'acknowledged')
      )
  LOOP
    INSERT INTO score_alerts (
      alert_type, target_type, target_id, severity, title, message,
      score_value, threshold_value, context
    ) VALUES (
      CASE WHEN v_rec.health_score < 50 THEN 'circle_critical' ELSE 'circle_health_decline' END,
      'circle', v_rec.circle_id,
      CASE WHEN v_rec.health_score < 50 THEN 'critical' ELSE 'warning' END,
      CASE WHEN v_rec.health_score < 50
        THEN 'Critical: Circle health is critical'
        ELSE 'Circle health declining'
      END,
      'Circle health score is ' || ROUND(v_rec.health_score, 1) || '/100 (' || v_rec.health_status || ')',
      v_rec.health_score,
      CASE WHEN v_rec.health_score < 50 THEN 50 ELSE 70 END,
      jsonb_build_object('health_status', v_rec.health_status, 'trend', v_rec.trend)
    ) RETURNING id INTO v_alert_id;

    -- FIX: column is `body`, not `message`
    INSERT INTO notifications (user_id, type, title, body, data)
    SELECT cm.user_id, 'score_alert', 'Your circle needs attention',
      'Circle health is ' || v_rec.health_status || '. Work together to improve on-time contributions.',
      jsonb_build_object('alert_id', v_alert_id, 'circle_id', v_rec.circle_id)
    FROM circle_members cm
    WHERE cm.circle_id = v_rec.circle_id AND cm.status = 'active';

    INSERT INTO ops_alerts (alert_type, details, priority)
    VALUES ('circle_health_decline',
      jsonb_build_object('circle_id', v_rec.circle_id, 'circle_name', v_rec.circle_name,
        'health_score', v_rec.health_score, 'health_status', v_rec.health_status, 'score_alert_id', v_alert_id),
      CASE WHEN v_rec.health_score < 50 THEN 'critical' ELSE 'high' END);
    v_count := v_count + 1;
  END LOOP;

  -- ALERT 3: XnScore significant drop (> 10 points)
  FOR v_rec IN
    SELECT xs.user_id, xs.total_score, xs.previous_score,
           (xs.previous_score - xs.total_score) as drop_amount
    FROM xn_scores xs
    WHERE xs.previous_score IS NOT NULL AND xs.previous_score - xs.total_score > 10
      AND NOT EXISTS (
        SELECT 1 FROM score_alerts sa
        WHERE sa.target_type = 'member' AND sa.target_id = xs.user_id
          AND sa.alert_type = 'xnscore_drop'
          AND sa.created_at > NOW() - INTERVAL '7 days'
          AND sa.status IN ('open', 'acknowledged')
      )
  LOOP
    INSERT INTO score_alerts (
      alert_type, target_type, target_id, severity, title, message,
      score_value, threshold_value, context
    ) VALUES (
      'xnscore_drop', 'member', v_rec.user_id,
      CASE WHEN v_rec.drop_amount > 20 THEN 'critical' ELSE 'warning' END,
      'XnScore dropped significantly',
      'Your XnScore dropped by ' || ROUND(v_rec.drop_amount, 1) || ' points',
      v_rec.total_score, v_rec.previous_score - 10,
      jsonb_build_object('previous_score', v_rec.previous_score,
        'current_score', v_rec.total_score, 'drop_amount', v_rec.drop_amount)
    ) RETURNING id INTO v_alert_id;

    -- FIX: column is `body`, not `message`
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (v_rec.user_id, 'score_alert', 'Your XnScore has dropped',
      'Your XnScore dropped by ' || ROUND(v_rec.drop_amount, 1) || ' points. Stay active and make on-time payments to recover.',
      jsonb_build_object('alert_id', v_alert_id, 'drop_amount', v_rec.drop_amount));
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$function$;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('109', 'fix_alerts_step',
        ARRAY['-- 109: fix scoring-pipeline alerts step (notifications.message -> notifications.body)'])
ON CONFLICT (version) DO NOTHING;
