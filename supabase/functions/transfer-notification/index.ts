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

    // Idempotency: pull rows that haven't been pushed yet
    // (push_sent_at IS NULL). The partial index
    // notifications_push_unsent_idx (migration 182) keeps this query
    // cheap as the notifications table grows.
    const { data: pending, error: selErr } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, data, type")
      .eq("type", "money_received")
      .is("push_sent_at", null)
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
      // Read the recipient's most recent device token. The in-app inbox
      // row is already there (the trigger wrote it), so a missing token
      // is a soft-fail — we skip the off-app push and leave
      // push_sent_at NULL so a later sweep retries after the user opens
      // the app and registers a token.
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("expo_push_token")
        .eq("id", row.user_id)
        .maybeSingle();
      if (profErr) {
        failures.push({ id: row.id, reason: `profile_${profErr.code ?? "err"}` });
        continue;
      }
      const token = (prof as { expo_push_token?: string | null } | null)
        ?.expo_push_token ?? null;
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
        // Mark dispatched so the next sweep skips this row. Failure to
        // stamp doesn't surface as a per-row error (we already pushed
        // successfully) — we just log it so we notice if it starts
        // happening systemically.
        const { error: stampErr } = await supabase
          .from("notifications")
          .update({ push_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        if (stampErr) {
          console.warn(
            `[transfer-notification] failed to stamp push_sent_at on ${row.id}: ${stampErr.message}`,
          );
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
