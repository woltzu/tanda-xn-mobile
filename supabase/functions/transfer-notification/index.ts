// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: transfer-notification
// ══════════════════════════════════════════════════════════════════════════════
// Purpose:  Deliver Expo push notifications to recipients of inbound
//           money transfers above the $100 threshold. The
//           `notifications` row itself is written by migration 180's
//           `notify_money_transfer_received` trigger; this function is
//           the sweeper that turns those rows into off-app pushes.
//
// Why this exists separately from the trigger:
//   Postgres can't reach the Expo Push API directly (no outbound HTTP).
//   The trigger handles the in-app inbox surface (NotificationContext
//   polls `notifications`); this function handles the off-app delivery
//   leg. If the user is offline at the moment a transfer lands, the
//   notification is still queued in `notifications` and re-attempted
//   on the next sweep.
//
// Schedule:  every minute via pg_cron or Supabase Scheduler. Inbound
//            money is a high-urgency signal — short cadence keeps the
//            "ding when paid" UX intact.
//
// Deployment:
//   supabase functions deploy transfer-notification --no-verify-jwt
//
// STUB STATUS:
//   This file ships as a working skeleton in P2 of the Access Wallet
//   review. The same two columns the kyc-approval-notification
//   function needs are not yet in schema:
//
//     * profiles.expo_push_token       (target device token)
//     * notifications.push_sent_at     (idempotency cursor)
//
//   Until those land, the loop is safe but inert — the no-token branch
//   short-circuits every row. The shape below documents the contract
//   the columns must satisfy when added.
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

    // STUB: pending the `notifications.push_sent_at` column. Until
    // that lands we read the unread rows of the new type to count
    // what *would* be delivered. The query shape is the one we'll
    // switch to once the cursor column is in place.
    const { data: pending, error: selErr } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, data, type")
      .eq("type", "money_received")
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
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let delivered = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const row of pending ?? []) {
      // STUB: pull the push token from profiles. profiles.expo_push_token
      // does not yet exist — the try/catch swallows the missing-column
      // PostgREST 400 so the loop keeps moving.
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
        // The in-app inbox row is already there (the trigger wrote
        // it). This is the documented fallback — the user will see
        // the notification when they next open the app.
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
          // Client-side hint: on tap, route to Wallet so the user
          // sees the new entry in Recent Activity immediately.
          route_hint: "Wallet",
        },
        priority: "high" as const,
        sound: "default" as const,
        channelId: "money", // Android channel — created on first install
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
        // FUTURE: once notifications.push_sent_at exists, update
        // here so the next sweep skips already-delivered rows.
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
          "in-app inbox rows are already written by trigger 180. Off-app delivery is best-effort until columns land.",
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
