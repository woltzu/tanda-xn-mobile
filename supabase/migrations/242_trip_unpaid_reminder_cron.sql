-- ════════════════════════════════════════════════════════════════════════════
-- Migration 242: Join-trip Bucket C — unpaid-deposit reminders + auto-release
-- ════════════════════════════════════════════════════════════════════════════
--
-- Daily cron at 09:00 UTC fires the trip-unpaid-deposit-reminder Edge
-- Function, which calls send_unpaid_deposit_reminders() defined below.
-- Two phases happen in that RPC:
--
--   1. REMINDER — for every participant who is pending + unpaid and
--      registered ≥1 day ago AND hasn't been reminded yet, insert a
--      notification AND stamp last_payment_reminder_at so the second
--      run doesn't re-ping them. Migration 241 added the column.
--
--   2. AUTO-RELEASE — for every participant who is STILL pending +
--      unpaid 48 h after registration AND was already reminded, flip to
--      cancelled (with cancelled_at) AND promote the head-of-waitlist
--      on that trip to pending. Notifies the promoted user.
--
-- Spec deviations corrected:
--   1. `notifications` row shape mirrors migration 238/240/241 —
--      (user_id, type, title, body, data, read). No `created_at` (uses
--      the column DEFAULT).
--   2. The spec used `haven\'t` (JS-style escape). PostgreSQL requires
--      `''` for a literal single quote inside a single-quoted string.
--   3. The spec's promote-waitlist CTE was buggy: it picked one
--      waitlist member per trip even if NO cancellation happened on
--      that trip, because PostgreSQL CTEs see the same snapshot and the
--      sibling UPDATE's changes are invisible. Fixed by JOINing the
--      waitlist scan against the cancelled CTE so we only promote when
--      a slot was just freed.
--   4. The spec scheduled `'SELECT send_unpaid_deposit_reminders()'`
--      directly. We instead schedule an HTTP POST to the EF — same
--      pattern as migration 189 (payout_reminder_daily). The EF
--      remains the canonical entry point so future logging /
--      alternative invocations stay aligned.
--   5. Self-register: canonical
--      `supabase_migrations.schema_migrations (version, name, statements)`
--      per CLAUDE.md, NOT the spec's `supabase_migrations`.
--   6. Notification `data` carries i18n_title_key + i18n_body_key so
--      the client / push delivery can re-render in the user's locale,
--      mirroring the carry-through used in migrations 238/240/241.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. send_unpaid_deposit_reminders RPC ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.send_unpaid_deposit_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reminded_count   INTEGER := 0;
  v_cancelled_count  INTEGER := 0;
  v_promoted_count   INTEGER := 0;
  v_row              RECORD;
BEGIN
  -- ─── Phase 1: reminders ────────────────────────────────────────────────
  -- Loop so we can populate each notification's body with the trip name
  -- + deposit amount. Could also be done as INSERT ... SELECT but the
  -- per-row body composition is clearer this way.
  FOR v_row IN
    SELECT
      tp.id            AS participant_id,
      tp.user_id       AS user_id,
      tp.trip_id       AS trip_id,
      t.trip_name      AS trip_name,
      COALESCE(t.deposit_amount, t.price_per_person) AS amount_due
    FROM public.trip_participants tp
    JOIN public.trips t ON t.id = tp.trip_id
    WHERE tp.status = 'pending'
      AND tp.payment_status = 'unpaid'
      AND tp.last_payment_reminder_at IS NULL
      AND tp.registered_at < NOW() - INTERVAL '1 day'
  LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_row.user_id,
        'trip_payment_reminder_unpaid',
        'Reminder: pay your deposit for ' || COALESCE(v_row.trip_name, 'your trip'),
        'You registered for "' || COALESCE(v_row.trip_name, 'your trip')
          || '" but haven''t paid the deposit'
          || CASE
               WHEN v_row.amount_due IS NOT NULL
                 THEN ' ($' || v_row.amount_due::text || ')'
               ELSE ''
             END
          || '. Complete payment to secure your spot.',
        jsonb_build_object(
          'trip_id',         v_row.trip_id,
          'trip_name',       v_row.trip_name,
          'participant_id',  v_row.participant_id,
          'amount_due',      v_row.amount_due,
          'i18n_title_key',  'trip.notification_payment_reminder_unpaid_title',
          'i18n_body_key',   'trip.notification_payment_reminder_unpaid_body'
        ),
        FALSE
      );

      UPDATE public.trip_participants
         SET last_payment_reminder_at = NOW(),
             updated_at = NOW()
       WHERE id = v_row.participant_id;

      v_reminded_count := v_reminded_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[send_unpaid_deposit_reminders] reminder failed for participant %: %',
        v_row.participant_id, SQLERRM;
    END;
  END LOOP;

  -- ─── Phase 2: auto-release + waitlist promotion ────────────────────────
  -- Cancel anyone who's been pending + unpaid for ≥48h AND was
  -- previously reminded. Then promote the head-of-waitlist on each trip
  -- that just had a cancellation. The JOIN against `cancelled` is what
  -- gates the promotion to trips with newly-freed slots — without it,
  -- the spec's CTE would promote waitlist members on every run.
  WITH expired AS (
    SELECT tp.id, tp.trip_id
      FROM public.trip_participants tp
     WHERE tp.status = 'pending'
       AND tp.payment_status = 'unpaid'
       AND tp.registered_at < NOW() - INTERVAL '2 days'
       AND tp.last_payment_reminder_at IS NOT NULL
  ),
  cancelled AS (
    UPDATE public.trip_participants
       SET status = 'cancelled',
           cancelled_at = NOW(),
           updated_at = NOW()
      FROM expired
     WHERE trip_participants.id = expired.id
    RETURNING trip_participants.trip_id, trip_participants.id AS cancelled_id
  ),
  cancelled_count AS (
    SELECT COUNT(*) AS n FROM cancelled
  ),
  waitlist_head AS (
    SELECT DISTINCT ON (tp.trip_id) tp.id, tp.trip_id, tp.user_id
      FROM public.trip_participants tp
      JOIN cancelled c ON c.trip_id = tp.trip_id
     WHERE tp.status = 'waitlist'
     ORDER BY tp.trip_id, tp.registered_at ASC
  ),
  promoted AS (
    UPDATE public.trip_participants
       SET status = 'pending',
           updated_at = NOW()
      FROM waitlist_head
     WHERE trip_participants.id = waitlist_head.id
    RETURNING trip_participants.id, trip_participants.user_id, trip_participants.trip_id
  ),
  promoted_notifications AS (
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    SELECT
      p.user_id,
      'trip_seat_released',
      'A spot opened up for ' || COALESCE(t.trip_name, 'your trip'),
      'You''ve been promoted from the waitlist for "'
        || COALESCE(t.trip_name, 'your trip')
        || '". Complete your payment to confirm.',
      jsonb_build_object(
        'trip_id',          p.trip_id,
        'trip_name',        t.trip_name,
        'participant_id',   p.id,
        'i18n_title_key',   'trip.notification_seat_released_title',
        'i18n_body_key',    'trip.notification_seat_released_body'
      ),
      FALSE
      FROM promoted p
      JOIN public.trips t ON t.id = p.trip_id
    RETURNING id
  )
  SELECT
    (SELECT n FROM cancelled_count),
    (SELECT COUNT(*) FROM promoted)
    INTO v_cancelled_count, v_promoted_count;

  RETURN jsonb_build_object(
    'success',        true,
    'reminded',       v_reminded_count,
    'cancelled',      v_cancelled_count,
    'promoted',       v_promoted_count
  );
END;
$$;

-- ─── 2. Schedule the cron job ─────────────────────────────────────────────
-- Drop any pre-existing schedule with this name so re-applies are safe.
SELECT cron.unschedule('trip_unpaid_deposit_reminder_daily')
 WHERE EXISTS (
   SELECT 1 FROM cron.job WHERE jobname = 'trip_unpaid_deposit_reminder_daily'
 );

SELECT cron.schedule(
  'trip_unpaid_deposit_reminder_daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/trip-unpaid-deposit-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('source', 'pg_cron')
  );
  $$
);

-- ─── Self-register ────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '242',
  'trip_unpaid_reminder_cron',
  ARRAY['-- 242: trip_unpaid_reminder_cron']
)
ON CONFLICT (version) DO NOTHING;
