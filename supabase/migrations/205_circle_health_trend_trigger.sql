-- ════════════════════════════════════════════════════════════════════════════
-- Migration 205: circle_health_trend_trigger
-- ════════════════════════════════════════════════════════════════════════════
-- `notify_health_trend_flip` trigger on `circle_health_scores`. Mirrors
-- migration 190's pattern (SECURITY DEFINER, search_path locked, EXCEPTION
-- sub-block so a trigger failure can't roll back the score UPDATE that
-- fired it).
--
-- Fires when the `trend` column transitions FROM non-declining
-- (improving / stable) TO declining. Inserts one notifications row per
-- elder/admin/creator of the circle so they can act before the situation
-- deteriorates further.
--
-- Idempotency: a row is keyed by (user_id, type='health_trend_flip',
-- data->>'circle_id', data->>'flip_at') where flip_at is NEW.last_computed_at.
-- If the same compute run re-fires the trigger (it shouldn't, but defensive),
-- the lookup short-circuits the INSERT.
--
-- Body strings ship in English at the trigger layer — the client renders
-- i18n strings keyed by `data->>'i18n_key'`. Circle name is substituted
-- server-side so the trigger doesn't need locale awareness.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_health_trend_flip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_circle_name TEXT;
  v_existing_id UUID;
  v_recipient   RECORD;
BEGIN
  -- Only act on a real flip into 'declining'. UPDATE OF trend fires for any
  -- write that touches the column even if the value is the same.
  IF NEW.trend IS DISTINCT FROM 'declining' THEN
    RETURN NEW;
  END IF;
  IF OLD.trend = 'declining' THEN
    -- Already in declining; not a flip.
    RETURN NEW;
  END IF;

  -- Resolve display name; defensive fallback.
  SELECT name INTO v_circle_name FROM public.circles WHERE id = NEW.circle_id;
  v_circle_name := COALESCE(v_circle_name, 'your circle');

  -- One row per elder/admin/creator.
  FOR v_recipient IN
    SELECT user_id
      FROM public.circle_members
     WHERE circle_id = NEW.circle_id
       AND role IN ('elder', 'admin', 'creator')
  LOOP
    SELECT id INTO v_existing_id
      FROM public.notifications
     WHERE user_id = v_recipient.user_id
       AND type = 'health_trend_flip'
       AND data->>'circle_id' = NEW.circle_id::text
       AND data->>'flip_at' = NEW.last_computed_at::text
     LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data, read)
      VALUES (
        v_recipient.user_id,
        'health_trend_flip',
        'Circle health trend alert',
        v_circle_name || '''s health has started declining. Please check the health dashboard.',
        jsonb_build_object(
          'circle_id',     NEW.circle_id,
          'health_score',  NEW.health_score,
          'health_status', NEW.health_status,
          'trend',         NEW.trend,
          'flip_at',       NEW.last_computed_at,
          'i18n_key',      'health.notification_body',
          'i18n_title_key','health.notification_title',
          'circle_name',   v_circle_name
        ),
        FALSE
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A trigger failure must NOT roll back the score UPDATE that fired it.
  -- Losing one notification is recoverable; rolling back the recomputed
  -- score would corrupt the next read.
  RAISE NOTICE 'notify_health_trend_flip failed for circle %: %', NEW.circle_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circle_health_scores_trend_flip ON public.circle_health_scores;
CREATE TRIGGER circle_health_scores_trend_flip
  AFTER UPDATE OF trend ON public.circle_health_scores
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_health_trend_flip();

-- ─── Self-register ──────────────────────────────────────────────────────────
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '205',
  'circle_health_trend_trigger',
  ARRAY['-- 205: circle_health_trend_trigger']
)
ON CONFLICT (version) DO NOTHING;
