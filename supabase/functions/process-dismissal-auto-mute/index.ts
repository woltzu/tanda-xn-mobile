// ═══════════════════════════════════════════════════════════════════════════
// process-dismissal-auto-mute — Edge Function (Deno runtime)
//
// P2 of the Notification preferences review.
//
// Daily cron. Reads notification_dismissal_log over the last 14 days,
// finds any (user, category) pair with ≥5 dismissals that still has
// push_<cat> = TRUE, and:
//
//   1. flips push_<cat> = FALSE and email_<cat> = FALSE on
//      notification_preferences,
//   2. inserts a single in-app notification telling the user we
//      muted them (and how to re-enable),
//   3. avoids re-firing — the next scan won't re-mute an already-off
//      category, so the notification only lands once.
//
// 'security' is excluded — we never auto-mute that category.
//
// Deploy:
//   supabase functions deploy process-dismissal-auto-mute
//   -- Cron registration (manual, once):
//   --   SELECT cron.schedule('process-dismissal-auto-mute-daily',
//   --     '0 5 * * *',
//   --     $$
--   --       SELECT net.http_post(
--   --         url:='https://<ref>.supabase.co/functions/v1/process-dismissal-auto-mute',
--   --         headers:=jsonb_build_object(
--   --           'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
--   --         )
--   --       );
--   --     $$
--   --   );
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const WINDOW_DAYS = 14;
const THRESHOLD = 5;

const ELIGIBLE_CATEGORIES = [
  "payments",
  "payouts",
  "circles",
  "loans",
  "reminders",
  "marketing",
];

type Dismissal = { user_id: string; category: string };
type AggregateRow = { user_id: string; category: string; count: number };

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ─── 1. Pull recent dismissals (14-day window) ───────────────────
  const since = new Date(
    Date.now() - WINDOW_DAYS * 86_400_000,
  ).toISOString();
  const { data: rows, error } = await supabase
    .from("notification_dismissal_log")
    .select("user_id, category")
    .in("category", ELIGIBLE_CATEGORIES)
    .gte("dismissed_at", since)
    .returns<Dismissal[]>();

  if (error) {
    console.error(
      "[process-dismissal-auto-mute] log query failed:",
      error.message,
    );
    return jsonResponse({ error: error.message }, 500);
  }

  // ─── 2. Aggregate in memory (small N — Phase 2 scale) ────────────
  const buckets = new Map<string, AggregateRow>();
  for (const r of rows ?? []) {
    const k = `${r.user_id}:${r.category}`;
    const cur = buckets.get(k);
    if (cur) {
      cur.count += 1;
    } else {
      buckets.set(k, {
        user_id: r.user_id,
        category: r.category,
        count: 1,
      });
    }
  }

  // ─── 3. For each (user, category) at threshold, mute + notify ────
  let muted = 0;
  for (const agg of buckets.values()) {
    if (agg.count < THRESHOLD) continue;

    const pushCol = `push_${agg.category}`;
    const emailCol = `email_${agg.category}`;

    // Read current values so we only fire the in-app notification on
    // the FIRST time we mute (avoid spamming on subsequent passes).
    const { data: prefsRow } = await supabase
      .from("notification_preferences")
      .select(`${pushCol}, ${emailCol}`)
      .eq("user_id", agg.user_id)
      .maybeSingle<Record<string, boolean | null>>();
    if (!prefsRow) continue;
    if (prefsRow[pushCol] !== true) continue; // already muted; skip

    await supabase
      .from("notification_preferences")
      .update({ [pushCol]: false, [emailCol]: false })
      .eq("user_id", agg.user_id);

    await supabase.from("notifications").insert({
      user_id: agg.user_id,
      type: "auto_mute",
      title: "We've muted some alerts for you",
      body: `You dismissed several ${agg.category} notifications, so we've turned them off. Re-enable them anytime in Notifications.`,
      data: { category: agg.category, source: "process-dismissal-auto-mute" },
    });

    muted++;
  }

  return jsonResponse({ window_days: WINDOW_DAYS, muted });
});
