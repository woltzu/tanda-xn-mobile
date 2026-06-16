// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: send-event-reminders
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): daily at 09:00 UTC.
// Purpose:  Scan community_events whose event_datetime falls in the next 24
//           hours and drop one "event tomorrow" notification per recipient.
//           Today there's no RSVP table, so the recipient set is "every
//           authenticated user" — capped at NOTIFICATION_USER_CAP per run
//           to stop a single rogue event from broadcasting to 100k rows.
//           When an RSVP table lands, swap the recipient query to scope
//           the notify to interested users.
//
// Idempotency: notifications.data.event_id is the natural anchor. Before
// inserting we count prior rows for (user_id, type=event_reminder,
// data.event_id=event) — skip if any. Cheap because notifications has a
// (user_id, created_at) index and we only look back 48h.
//
// Deployment:
//   supabase functions deploy send-event-reminders --no-verify-jwt
//   Schedule via Supabase Scheduler or pg_cron.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NOTIFICATION_USER_CAP = 5000;
const LOOKBACK_FOR_DUPE_HOURS = 48;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const started = new Date().toISOString();
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

    const { data: events, error: evErr } = await supabase
      .from("community_events")
      .select("id, title, event_datetime, location_name, category")
      .gte("event_datetime", now.toISOString())
      .lte("event_datetime", in24h.toISOString())
      .limit(200);
    if (evErr) throw evErr;
    if (!events || events.length === 0) {
      return ok(started, { events: 0, notifications: 0 });
    }

    // Recipient set. Pull active profiles ordered by recency so a small
    // cap still hits the most-likely-attending users when there are
    // genuinely many recipients.
    const { data: recipients, error: rcptErr } = await supabase
      .from("profiles")
      .select("id")
      .limit(NOTIFICATION_USER_CAP);
    if (rcptErr) throw rcptErr;

    const lookbackIso = new Date(
      now.getTime() - LOOKBACK_FOR_DUPE_HOURS * 3600 * 1000,
    ).toISOString();
    let notifications = 0;

    for (const ev of events) {
      const localDate = new Date(ev.event_datetime).toLocaleString(undefined, {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      for (const r of recipients ?? []) {
        // Per-recipient dupe check — skip if we already reminded them
        // about this event in the last 48h.
        const { count: prior } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", r.id)
          .eq("type", "event_reminder")
          .gte("created_at", lookbackIso)
          .contains("data", { event_id: ev.id });
        if ((prior ?? 0) > 0) continue;

        const { error: nErr } = await supabase.from("notifications").insert({
          user_id: r.id,
          type: "event_reminder",
          title: `Tomorrow: ${ev.title}`,
          body: `${ev.title} — ${localDate}${
            ev.location_name ? ` at ${ev.location_name}` : ""
          }. Tap to see details.`,
          data: {
            event_id: ev.id,
            event_datetime: ev.event_datetime,
            category: ev.category,
          },
          read: false,
        });
        if (!nErr) notifications++;
      }
    }

    return ok(started, {
      events: events.length,
      recipients: recipients?.length ?? 0,
      notifications,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[send-event-reminders] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(started: string, extras: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      ok: true,
      started,
      finished: new Date().toISOString(),
      ...extras,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
