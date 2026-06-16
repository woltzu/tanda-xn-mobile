// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: goal-notification
// ══════════════════════════════════════════════════════════════════════════════
// Purpose:  Sweep `notifications` rows of type 'goal_milestone' or
//           'goal_deadline' (written by migration 181's trigger +
//           check_goal_deadlines function) and dispatch off-app push
//           payloads via the Expo Push API.
//
// Why this exists separately from migration 181:
//   Postgres can't reach the Expo Push API directly. The trigger /
//   cron-function handles the in-app inbox surface
//   (NotificationContext polls `notifications`); this function is the
//   off-app delivery leg. Same shape as kyc-approval-notification and
//   transfer-notification — one stub-style sweeper per notification
//   family, all reading from the central `notifications` table.
//
// Schedule:  every 5 minutes via pg_cron or Supabase Scheduler.
//            Milestone events are user-driven (a deposit just crossed
//            a threshold) and warrant a near-real-time ding; deadline
//            reminders are batched daily by check_goal_deadlines() and
//            can wait the same cadence.
//
// Deployment:
//   supabase functions deploy goal-notification --no-verify-jwt
//
// STUB STATUS:
//   Ships as a working skeleton in Bucket C of the Goals process
//   review. The same two schema gaps as the kyc-approval-notification
//   and transfer-notification functions:
//
//     * profiles.expo_push_token       (target device token)
//     * notifications.push_sent_at     (idempotency cursor)
//
//   Until those columns land, the loop is safe but inert — the no-token
//   branch short-circuits every row, and the function returns a count
//   of how many rows *would* be dispatched. The shape below documents
//   the contract those columns must satisfy when added.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

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

    // STUB: pending the `notifications.push_sent_at` column. The query
    // shape below is what we'll switch to once the cursor column lands.
    // Both goal notification families share this sweeper — type IN
    // ('goal_milestone', 'goal_deadline') keeps the dispatcher single.
    const { data: pending, error: selErr } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, data, type")
      .in("type", ["goal_milestone", "goal_deadline"])
      .eq("read", false)
      .order("created_at", { ascending: true })
      .limit(100);

    if (selErr) {
      return new Response(
        JSON.stringify({
          ok: false,
          stage: "select",
          error: selErr.message,
          started,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let delivered = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const row of pending ?? []) {
      // STUB: pull the push token from profiles. profiles.expo_push_token
      // does not yet exist — the try/catch swallows the missing-column
      // PostgREST 400 so the loop keeps moving and the function reports
      // an honest scanned count.
      let token: string | null = null;
      try {
        const { data: prof } = await supabase
          .from("profiles")
          .select("expo_push_token")
          .eq("id", row.user_id)
          .maybeSingle();
        token = (prof as { expo_push_token?: string } | null)?.expo_push_token ?? null;
      } catch {
        token = null;
      }
      if (!token) {
        // The in-app inbox row is already there (trigger / cron wrote
        // it). The user sees the notification on next app open.
        failures.push({ id: row.id, reason: "no_token" });
        continue;
      }

      const payload = {
        to: token,
        title: row.title,
        body: row.body,
        data: {
          ...(row.data && typeof row.data === "object" ? row.data : {}),
          type: row.type,
          notification_id: row.id,
          // Client-side hint: on tap, route to the goal's detail screen
          // so the user lands on the surface most relevant to the
          // notification (the new milestone is on the bar; the deadline
          // is in the header). data.goal_id is set by both the trigger
          // and the deadline-check function.
          route_hint: "GoalDetailV2",
        },
        priority: "high" as const,
        sound: "default" as const,
        channelId: "goals", // Android channel — created on first install
      };

      try {
        const resp = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          failures.push({ id: row.id, reason: `expo_${resp.status}` });
          continue;
        }
        delivered++;
        // FUTURE: once notifications.push_sent_at exists, update here
        // so the next sweep skips already-delivered rows.
      } catch (e) {
        failures.push({
          id: row.id,
          reason: `fetch_${(e as Error)?.message ?? "unknown"}`,
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        started,
        finished: new Date().toISOString(),
        scanned: pending?.length ?? 0,
        delivered,
        failed: failures.length,
        failures,
        note:
          "STUB: profiles.expo_push_token and notifications.push_sent_at are not yet in schema; " +
          "in-app inbox rows are already written by trigger 181 and check_goal_deadlines. " +
          "Off-app delivery is best-effort until columns land.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        stage: "exception",
        error: (e as Error)?.message ?? "unknown",
        started,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
