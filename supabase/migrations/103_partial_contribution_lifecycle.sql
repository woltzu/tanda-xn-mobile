-- ════════════════════════════════════════════════════════════════════════════
-- Migration 103: Partial Contribution — lifecycle cron
-- Phase D3 of feat(partial).
-- ════════════════════════════════════════════════════════════════════════════
-- Ports two batch operations from services/PartialContributionEngine.ts
-- (Section C: processCatchUpPayment + handleMissedCatchUp) into a single
-- PL/pgSQL function so they can run from pg_cron / an Edge Function.
--
-- Batch 1 — paid catch-up sync
--   Find cycle_contributions where contribution_type='catch_up' and
--   contribution_status='paid' that aren't yet reflected in the plan's
--   catch_up_schedule. Mark the schedule item paid. If all items paid,
--   complete the plan (status='completed', completed_at=NOW(),
--   remaining_amount_cents=0).
--
-- Batch 2 — missed catch-up defaults
--   Find cycle_contributions where contribution_type='catch_up',
--   contribution_status NOT IN (paid, partial), and due_date < NOW().
--   Mark the schedule item defaulted. If every non-paid item in the
--   plan is defaulted, mark the plan defaulted and notify member + admin.
--
-- Both batches use the engine's column-correct names that D1's migration
-- 102 established: contribution_status (not status), cycle_status (not
-- status), partial_plan_id, etc.
--
-- All updates are idempotent: each batch's SELECT only matches items whose
-- schedule entry isn't already in the target state, so re-running the cron
-- is a no-op for already-processed items.
--
-- paid_amount_cents / remaining_amount_cents math: after every schedule
-- mutation we recompute from the schedule itself
--   remaining = sum(amount_cents WHERE status <> 'paid')
--   paid      = original_amount_cents - remaining
-- which is robust against the TS engine's quirky formula
-- (old_remaining - paid_catchups + unpaid_catchups, which cancels out).
-- ════════════════════════════════════════════════════════════════════════════


CREATE OR REPLACE FUNCTION process_partial_contribution_lifecycle()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_record RECORD;
  v_paid_synced INTEGER := 0;
  v_missed_defaulted INTEGER := 0;
  v_plans_completed INTEGER := 0;
  v_plans_defaulted INTEGER := 0;
  v_errors JSONB := '[]'::jsonb;
  v_new_schedule JSONB;
  v_remaining_cents BIGINT;
  v_original_cents BIGINT;
  v_all_paid BOOLEAN;
  v_all_unpaid_defaulted BOOLEAN;
BEGIN
  -- ── Batch 1: paid catch-up sync ────────────────────────────────────────
  -- Iterate over paid catch-up contributions whose plan schedule item is
  -- not yet 'paid'. The EXISTS predicate is the idempotency guard.
  FOR v_record IN
    SELECT cc.id AS contribution_id,
           cc.partial_plan_id AS plan_id
    FROM cycle_contributions cc
    JOIN partial_contribution_plans p ON p.id = cc.partial_plan_id
    WHERE cc.contribution_type = 'catch_up'
      AND cc.contribution_status = 'paid'
      AND cc.partial_plan_id IS NOT NULL
      AND p.status = 'active'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(p.catch_up_schedule) item
        WHERE item->>'contribution_id' = cc.id::TEXT
          AND COALESCE(item->>'status', '') <> 'paid'
      )
  LOOP
    BEGIN
      -- Build updated schedule: mark the matched item paid
      UPDATE partial_contribution_plans
      SET catch_up_schedule = (
        SELECT jsonb_agg(
          CASE WHEN item->>'contribution_id' = v_record.contribution_id::TEXT
               THEN jsonb_set(item, '{status}', to_jsonb('paid'::TEXT))
               ELSE item
          END
          ORDER BY ((item->>'cycle_number')::INTEGER)
        )
        FROM jsonb_array_elements(catch_up_schedule) AS item
      )
      WHERE id = v_record.plan_id;

      v_paid_synced := v_paid_synced + 1;

      -- Recompute remaining + check completion
      SELECT
        COALESCE(SUM((item->>'amount_cents')::BIGINT) FILTER (WHERE item->>'status' <> 'paid'), 0),
        NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p.catch_up_schedule) item2 WHERE item2->>'status' <> 'paid'),
        p.original_amount_cents
      INTO v_remaining_cents, v_all_paid, v_original_cents
      FROM partial_contribution_plans p,
           jsonb_array_elements(p.catch_up_schedule) AS item
      WHERE p.id = v_record.plan_id
      GROUP BY p.original_amount_cents, p.catch_up_schedule;

      IF v_all_paid THEN
        UPDATE partial_contribution_plans
        SET status = 'completed',
            completed_at = NOW(),
            remaining_amount_cents = 0,
            paid_amount_cents = v_original_cents
        WHERE id = v_record.plan_id;
        v_plans_completed := v_plans_completed + 1;
      ELSE
        UPDATE partial_contribution_plans
        SET remaining_amount_cents = v_remaining_cents,
            paid_amount_cents = v_original_cents - v_remaining_cents
        WHERE id = v_record.plan_id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'batch', 'paid_catchup_sync',
        'plan_id', v_record.plan_id,
        'contribution_id', v_record.contribution_id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  -- ── Batch 2: missed catch-up defaults ──────────────────────────────────
  -- Iterate over past-due catch-ups still unpaid whose schedule item is
  -- not yet 'defaulted'.
  FOR v_record IN
    SELECT cc.id AS contribution_id,
           cc.partial_plan_id AS plan_id
    FROM cycle_contributions cc
    JOIN partial_contribution_plans p ON p.id = cc.partial_plan_id
    WHERE cc.contribution_type = 'catch_up'
      AND cc.contribution_status NOT IN ('paid', 'partial')
      AND cc.due_date < CURRENT_DATE
      AND cc.partial_plan_id IS NOT NULL
      AND p.status = 'active'
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(p.catch_up_schedule) item
        WHERE item->>'contribution_id' = cc.id::TEXT
          AND COALESCE(item->>'status', '') <> 'defaulted'
          AND COALESCE(item->>'status', '') <> 'paid'  -- never reverse paid → defaulted
      )
  LOOP
    BEGIN
      UPDATE partial_contribution_plans
      SET catch_up_schedule = (
        SELECT jsonb_agg(
          CASE WHEN item->>'contribution_id' = v_record.contribution_id::TEXT
               THEN jsonb_set(item, '{status}', to_jsonb('defaulted'::TEXT))
               ELSE item
          END
          ORDER BY ((item->>'cycle_number')::INTEGER)
        )
        FROM jsonb_array_elements(catch_up_schedule) AS item
      )
      WHERE id = v_record.plan_id;

      v_missed_defaulted := v_missed_defaulted + 1;

      -- TS engine handleMissedCatchUp (line ~622): of all non-paid items,
      -- every one is defaulted → plan defaulted. Mirrors that semantic.
      SELECT NOT EXISTS (
        SELECT 1 FROM partial_contribution_plans p2,
             jsonb_array_elements(p2.catch_up_schedule) item3
        WHERE p2.id = v_record.plan_id
          AND item3->>'status' <> 'paid'
          AND item3->>'status' <> 'defaulted'
      ) INTO v_all_unpaid_defaulted;

      IF v_all_unpaid_defaulted THEN
        UPDATE partial_contribution_plans
        SET status = 'defaulted'
        WHERE id = v_record.plan_id AND status = 'active';
        v_plans_defaulted := v_plans_defaulted + 1;

        -- Notify the member (their plan is now defaulted; XnScore impact
        -- and late fees apply per regular rules)
        INSERT INTO notification_queue (member_id, notification_type, title, body, data)
        SELECT p.member_id,
               'payment_critical',
               'Flexible Payment plan defaulted',
               'Your catch-up payments are past due. Standard late-payment rules now apply. Open your circle to see what''s next.',
               jsonb_build_object(
                 'plan_id', p.id,
                 'circle_id', p.circle_id,
                 'cycle_id', p.cycle_id,
                 'type', 'partial_contribution_defaulted'
               )
        FROM partial_contribution_plans p
        WHERE p.id = v_record.plan_id;

        -- Notify circle admins (identity not revealed in body)
        INSERT INTO notification_queue (member_id, notification_type, title, body, data)
        SELECT cm.user_id,
               'circle_events',
               'A Flexible Payment plan has defaulted',
               'A member''s catch-up payments are past due. Standard recovery rules now apply.',
               jsonb_build_object(
                 'plan_id', p.id,
                 'circle_id', p.circle_id,
                 'type', 'partial_contribution_defaulted'
               )
        FROM partial_contribution_plans p
        JOIN circle_members cm ON cm.circle_id = p.circle_id
        WHERE p.id = v_record.plan_id
          AND cm.role IN ('creator', 'admin');
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors || jsonb_build_array(jsonb_build_object(
        'batch', 'missed_catchup_default',
        'plan_id', v_record.plan_id,
        'contribution_id', v_record.contribution_id,
        'error', SQLERRM
      ));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'paid_catchups_synced', v_paid_synced,
    'missed_catchups_defaulted', v_missed_defaulted,
    'plans_completed', v_plans_completed,
    'plans_defaulted', v_plans_defaulted,
    'errors', v_errors,
    'source', 'process_partial_contribution_lifecycle_rpc',
    'note', 'Daily cron: paid catch-up sync + missed-catchup defaults. Idempotent.'
  );
END;
$$;


-- ── Grants ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.process_partial_contribution_lifecycle() TO service_role;
REVOKE EXECUTE ON FUNCTION public.process_partial_contribution_lifecycle()
  FROM PUBLIC, anon, authenticated;


-- Self-register
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('103', 'partial_contribution_lifecycle',
        ARRAY['-- 103: PartialContributionEngine D3 — lifecycle cron (paid sync + missed defaults)'])
ON CONFLICT (version) DO NOTHING;
