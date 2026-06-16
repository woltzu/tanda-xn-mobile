// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: kyc-approval-notification
// ══════════════════════════════════════════════════════════════════════════════
// Purpose:  Deliver Expo push notifications to users whose KYC status just
//           flipped to "approved" (and any other terminal state row queued
//           by migration 160's `kyc_verifications_status_change` trigger).
//
// Why this exists separately from the trigger:
//   Migration 160 already INSERTs a row into `public.notifications` on
//   every approved/rejected/expired transition (see
//   notify_kyc_status_change). The trigger handles the *in-app* surface:
//   the rows are polled by NotificationContext and rendered in the
//   notifications inbox. What the trigger CANNOT do from inside Postgres
//   is hit the Expo Push API for off-app delivery.
//
//   This function closes that gap. It's a small, idempotent sweeper:
//
//     1. Read `notifications` rows where type LIKE 'kyc_%' AND
//        push_sent_at IS NULL.
//     2. Fetch the recipient's `expo_push_token` from `profiles`.
//     3. POST to https://exp.host/--/api/v2/push/send.
//     4. Mark the row push_sent_at = NOW() (and push_error on failure).
//
// Deferred-action resume:
//   The deferred action (KYC P0) lives in client-side AsyncStorage —
//   the server can't carry the resume params in the push payload. We
//   include a `resume_hint: true` flag in `data` so the client
//   notification handler knows that, on tap, it should route the user
//   to KYCHub. KYCHub's existing resume effect (P0.4) consumes the
//   AsyncStorage snapshot and replays the navigate.
//
// Schedule:  every 1 minute via pg_cron or Supabase Scheduler.
//            Short cadence because users expect "approved" to feel
//            instant once the Persona webhook lands.
//
// Deployment:
//   supabase functions deploy kyc-approval-notification --no-verify-jwt
//
// STUB STATUS:
//   This file ships as a working skeleton in P1 of the KYC trigger
//   review. The Expo push token column (`profiles.expo_push_token`)
//   and the `notifications.push_sent_at` column do not yet exist —
//   a future migration will add them and the body below can lose
//   the early-return / fall through to live delivery.
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

    // STUB: pending the `notifications.push_sent_at` column. Until that
    // lands we can only count what would be delivered. The query
    // shape below is the one we'll switch to once the column is in
    // place — keeping it here documents the contract.
    const { data: pending, error: selErr } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, data, type")
      .like("type", "kyc_%")
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
      // does not exist yet — this will silently no-op until the schema
      // adds it. The PostgREST 400 from selecting a missing column is
      // suppressed by the try/catch so the loop continues.
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
          // Client-side hint: on tap, route to KYCHub so the existing
          // P0.4 resume effect can replay any deferred action sitting
          // in AsyncStorage.
          resume_hint: true,
        },
        priority: "high" as const,
        sound: "default" as const,
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
          "delivery counts will be zero until they land.",
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
