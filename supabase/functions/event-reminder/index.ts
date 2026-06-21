// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: event-reminder
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: daily at 09:00 UTC. Wired by migration 225 (pg_cron).
//
// Purpose:  Find community events whose `event_datetime` lands in the
//           T+24h window and queue an `event_reminder_24h` notification
//           per recipient. The existing notification fan-out (KYC,
//           transfer, payout, goal) turns each row into the Expo push.
//
// Recipients: For each event, we notify:
//   1. The creator (NEW.user_id from community_events).
//   2. Every active community member who shares at least one community
//      with the creator (mirrors notify_event_created in migration
//      223 — see that trigger for the rationale). community_events
//      has no community_id column today, so this is a bounded
//      approximation. A future column on community_events would let
//      us scope to the exact community the event was posted to.
//
// Idempotency: `(user_id, type, data->>'event_id')` — same shape used
//   by notify_event_created in migration 223 so duplicate inserts are
//   skipped on cron re-runs and on manual invocations.
//
// Window: events where event_datetime falls in (now + 23h, now + 25h]
//   so the daily 09:00 UTC tick catches every event in a ±1h band
//   around T-24h. Drift narrower than that needs a more frequent
//   schedule, which is not worth the cost today.
//
// Deployment:
//   supabase functions deploy event-reminder --no-verify-jwt
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
  // Produces "Fri 21 Jun · 19:30" in UTC. Mirrors the formatEventDateCompact
  // helper on the client so the in-app fallback body matches the card UI.
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

type EventRow = {
  id: string;
  user_id: string;
  title: string;
  event_datetime: string;
  location_name: string;
};

type MembershipRow = {
  community_id: string;
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

    // T-24h band: (now + 23h, now + 25h]. The daily 09:00 UTC tick
    // gives us a ±1h tolerance around the exact 24-hour mark for every
    // event in the window.
    const windowStart = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

    const { data: events, error: eventsErr } = await supabase
      .from("community_events")
      .select("id, user_id, title, event_datetime, location_name")
      .gt("event_datetime", windowStart)
      .lte("event_datetime", windowEnd);
    if (eventsErr) return fail(started, eventsErr.message);
    if (!events || events.length === 0) {
      return ok(started, {
        scanned: 0,
        notified: 0,
        reason: "no_events_in_window",
        window: { start: windowStart, end: windowEnd },
      });
    }
    const rows = events as EventRow[];

    // Build the recipient set per event. The fan-out joins each creator
    // to every active member of each community the creator belongs to,
    // including the creator themselves (creator gets their own
    // reminder — they're hosting). DISTINCT keeps duplicates from
    // overlapping communities at bay.
    const creatorIds = Array.from(new Set(rows.map((r) => r.user_id)));
    const { data: creatorMemberships, error: cmErr } = await supabase
      .from("community_memberships")
      .select("community_id, user_id")
      .in("user_id", creatorIds)
      .eq("status", "active");
    if (cmErr) return fail(started, cmErr.message);

    // creator → Set<communityId>
    const communitiesByCreator = new Map<string, Set<string>>();
    for (const m of (creatorMemberships ?? []) as MembershipRow[]) {
      if (!communitiesByCreator.has(m.user_id)) {
        communitiesByCreator.set(m.user_id, new Set());
      }
      communitiesByCreator.get(m.user_id)!.add(m.community_id);
    }

    // Aggregate all communityIds we need to expand into members.
    const allCommunityIds = new Set<string>();
    for (const set of communitiesByCreator.values()) {
      for (const id of set) allCommunityIds.add(id);
    }
    if (allCommunityIds.size === 0) {
      return ok(started, {
        scanned: rows.length,
        notified: 0,
        reason: "creators_have_no_communities",
      });
    }

    const { data: allMemberships, error: amErr } = await supabase
      .from("community_memberships")
      .select("community_id, user_id")
      .in("community_id", Array.from(allCommunityIds))
      .eq("status", "active");
    if (amErr) return fail(started, amErr.message);

    // community → Set<memberUserId>
    const membersByCommunity = new Map<string, Set<string>>();
    for (const m of (allMemberships ?? []) as MembershipRow[]) {
      if (!membersByCommunity.has(m.community_id)) {
        membersByCommunity.set(m.community_id, new Set());
      }
      membersByCommunity.get(m.community_id)!.add(m.user_id);
    }

    let notified = 0;
    let skipped_idempotent = 0;

    for (const ev of rows) {
      const communities = communitiesByCreator.get(ev.user_id);
      const recipients = new Set<string>();
      recipients.add(ev.user_id); // creator always gets reminded.
      if (communities) {
        for (const cid of communities) {
          const members = membersByCommunity.get(cid);
          if (!members) continue;
          for (const uid of members) recipients.add(uid);
        }
      }

      const whenLabel = formatWhen(ev.event_datetime);
      const bodyFallback =
        `'${ev.title}' is happening tomorrow at ${ev.location_name}.`;

      for (const recipient of recipients) {
        // Idempotency check: skip if we've already reminded this user
        // for this event.
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", recipient)
          .eq("type", "event_reminder_24h")
          .filter("data->>event_id", "eq", ev.id)
          .limit(1);
        if (existing && existing.length > 0) {
          skipped_idempotent++;
          continue;
        }

        const { error: insertErr } = await supabase.from("notifications").insert(
          {
            user_id: recipient,
            type: "event_reminder_24h",
            title: "Event tomorrow",
            body: bodyFallback,
            data: {
              event_id: ev.id,
              creator_id: ev.user_id,
              title: ev.title,
              location: ev.location_name,
              date: whenLabel,
              event_datetime: ev.event_datetime,
              i18n_title_key: "event.notification_reminder_24h_title",
              i18n_body_key: "event.notification_reminder_24h_body",
            },
            read: false,
          },
        );
        if (insertErr) {
          console.log(
            `[event-reminder] insert failed for event ${ev.id} user ${recipient}: ${insertErr.message}`,
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
