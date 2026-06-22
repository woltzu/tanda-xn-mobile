// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: gathering-reminder
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: daily at 09:30 UTC. Wired by migration 232 (pg_cron).
//
// Purpose:  Find community_gatherings whose `starts_at` lands in the T+24h
//           window and queue a `gathering_reminder_24h` notification per
//           recipient. The existing notification fan-out (KYC, transfer,
//           payout, goal, event) turns each row into the Expo push.
//
// Recipients: For each gathering, we notify:
//   1. The organizer (organizer_user_id).
//   2. Every user with a non-cancelled RSVP row (status in
//      ('going','maybe')). gathering_rsvps was created in migration 056;
//      the engine writes 'going' on tap and the screen surfaces a Going
//      count, so this is the canonical "interested" signal for now.
//      Set semantics dedupe the organizer if they also RSVPed.
//
// Idempotency: `(user_id, type, data->>'gathering_id')` — same shape used
//   by notify_gathering_created in migration 231 and by event-reminder. The
//   union of the two filter clauses keeps cron re-runs safe and prevents
//   manual invocations from double-firing.
//
// Window: gatherings where starts_at falls in (now + 23h, now + 25h] so
//   the daily 09:30 UTC tick catches every gathering in a ±1h band around
//   T-24h. Drift narrower than that needs a more frequent schedule, which
//   is not worth the cost today.
//
// Status filter: only 'upcoming' gatherings. Cancelled gatherings stay in
//   the table for the activity log but should never page someone.
//
// Deployment:
//   supabase functions deploy gathering-reminder --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function ok(started: string, body: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ ok: true, started_at: started, ...body }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function fail(started: string, message: string, status = 500): Response {
  return new Response(
    JSON.stringify({ ok: false, started_at: started, error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

function formatWhen(iso: string): string {
  // "Fri 21 Jun · 19:30" in UTC. Mirrors the formatEventDateCompact helper
  // on the client so the in-app fallback body matches the card UI.
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
    const time = d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}

type GatheringRow = {
  id: string;
  organizer_user_id: string;
  title: string;
  starts_at: string;
  is_virtual: boolean;
  location_name: string | null;
};

type RsvpRow = {
  gathering_id: string;
  user_id: string;
};

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

    // T-24h band: (now + 23h, now + 25h]. The daily 09:30 UTC tick gives
    // us a ±1h tolerance around the exact 24-hour mark.
    const windowStart = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

    const { data: gatherings, error: gErr } = await supabase
      .from("community_gatherings")
      .select("id, organizer_user_id, title, starts_at, is_virtual, location_name")
      .eq("status", "upcoming")
      .gt("starts_at", windowStart)
      .lte("starts_at", windowEnd);
    if (gErr) return fail(started, gErr.message);
    if (!gatherings || gatherings.length === 0) {
      return ok(started, {
        scanned: 0,
        notified: 0,
        reason: "no_gatherings_in_window",
        window: { start: windowStart, end: windowEnd },
      });
    }
    const rows = gatherings as GatheringRow[];

    // Pull RSVPs for every gathering in the window. Single round-trip via
    // .in() on the gathering_id list. We treat 'going' and 'maybe' as
    // worth a reminder; 'not_going' is excluded.
    const gatheringIds = rows.map((r) => r.id);
    const { data: rsvpRows, error: rsvpErr } = await supabase
      .from("gathering_rsvps")
      .select("gathering_id, user_id")
      .in("gathering_id", gatheringIds)
      .in("status", ["going", "maybe"]);
    if (rsvpErr) return fail(started, rsvpErr.message);

    const rsvpsByGathering = new Map<string, Set<string>>();
    for (const r of (rsvpRows ?? []) as RsvpRow[]) {
      if (!rsvpsByGathering.has(r.gathering_id)) {
        rsvpsByGathering.set(r.gathering_id, new Set());
      }
      rsvpsByGathering.get(r.gathering_id)!.add(r.user_id);
    }

    let notified = 0;
    let skipped_idempotent = 0;

    for (const g of rows) {
      const recipients = new Set<string>();
      recipients.add(g.organizer_user_id); // organizer always gets reminded.
      const rsvps = rsvpsByGathering.get(g.id);
      if (rsvps) {
        for (const uid of rsvps) recipients.add(uid);
      }

      const whenLabel = formatWhen(g.starts_at);
      const whereLabel = g.is_virtual
        ? "online"
        : g.location_name && g.location_name.trim().length > 0
          ? g.location_name
          : "TBA";
      const bodyFallback =
        `'${g.title}' is happening tomorrow at ${whereLabel}.`;

      for (const recipient of recipients) {
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", recipient)
          .eq("type", "gathering_reminder_24h")
          .filter("data->>gathering_id", "eq", g.id)
          .limit(1);
        if (existing && existing.length > 0) {
          skipped_idempotent++;
          continue;
        }

        const { error: insertErr } = await supabase.from("notifications").insert(
          {
            user_id: recipient,
            type: "gathering_reminder_24h",
            title: "Gathering tomorrow",
            body: bodyFallback,
            data: {
              gathering_id: g.id,
              organizer_id: g.organizer_user_id,
              title: g.title,
              location: whereLabel,
              date: whenLabel,
              starts_at: g.starts_at,
              is_virtual: g.is_virtual,
              i18n_title_key: "gathering.notification_reminder_24h_title",
              i18n_body_key: "gathering.notification_reminder_24h_body",
            },
            read: false,
          },
        );
        if (insertErr) {
          console.log(
            `[gathering-reminder] insert failed for gathering ${g.id} user ${recipient}: ${insertErr.message}`,
          );
          continue;
        }
        notified++;
      }
    }

    return ok(started, {
      scanned: rows.length,
      notified,
      skipped_idempotent,
      window: { start: windowStart, end: windowEnd },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(started, message);
  }
});
