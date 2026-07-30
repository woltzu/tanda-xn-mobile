-- ═══════════════════════════════════════════════════════════════════════════
-- 396e_xnscore_v31_retroactive_comms.sql
--
-- One-shot INSERT that notifies every user about the XnScore V3.1 upgrade.
--
-- The original rollout plan said "T-7 days heads-up before the recalc
-- lands." That window passed — mig 396 already recalculated everyone.
-- This mig fires a retroactive announcement so users understand why
-- their score just changed AND how to earn the new savings points.
--
-- Idempotent: excludes users who already have a chargeback_savings_added
-- notification, so re-running the migration in a recovery scenario
-- doesn't double-insert.
--
-- The notifications row will surface in the in-app inbox and trigger
-- push via the existing process-notification-queue cron. Users with
-- push_marketing=false in notification_preferences will still see the
-- in-app row but no push (correct — this is a product announcement).
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO notifications (user_id, type, title, body, data, read, created_at)
SELECT
  p.id,
  'xnscore_savings_added',
  'Your XnScore now rewards savings',
  'Good news — saving now improves your XnScore. Consistent saving habits '
    || 'can earn you up to 10 additional points on top of your existing score. '
    || 'Your score has already been updated to reflect any savings activity. '
    || 'Tap to see your new breakdown and how to earn more.',
  jsonb_build_object(
    'rollout_date',   NOW(),
    'max_new_points', 10,
    'source',         'mig_396e_retroactive_comms'
  ),
  FALSE,
  NOW()
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM notifications n
   WHERE n.user_id = p.id
     AND n.type    = 'xnscore_savings_added'
);

-- Self-register.
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '396e',
  'xnscore_v31_retroactive_comms',
  ARRAY['-- 396e: xnscore_v31_retroactive_comms']
)
ON CONFLICT (version) DO NOTHING;
