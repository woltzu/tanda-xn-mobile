// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: community-notification
// ══════════════════════════════════════════════════════════════════════════════
// Purpose:  Sweep unpushed community-scoped notifications and dispatch Expo
//           push messages. The `notifications` rows themselves are written by
//           migration 347's triggers (join-request fanout, review reply,
//           new arrival), migration 231 (gathering_created), and migration
//           221 (community_post_created). This function handles only the
//           off-app delivery leg — the in-app inbox is already up to date
//           the moment the trigger fires.
//
// Mirrors transfer-notification / goal-notification / kyc-approval-notification
// verbatim so we stay consistent with the existing sweeper style:
//   * SELECT push_sent_at IS NULL, filter by the community type set.
//   * Read profiles.expo_push_token (mig 182 shadow column — single device
//     per user; the push_tokens table in the live DB is not currently used
//     by any sweeper).
//   * POST one message per row to https://exp.host/--/api/v2/push/send.
//   * Stamp push_sent_at on success. Failures land in the response payload
//     for observability but don't stamp — the next sweep retries them.
//
// Schedule:  suggested every 5 minutes via pg_cron (see the migration 348
//            snippet in the phase report). Community events are lower
//            urgency than money-received, so a longer cadence is fine.
//
// Deployment:
//   supabase functions deploy community-notification --no-verify-jwt
//
// Route hints:
//   Each notification type gets a route_hint in data so the client can
//   deep-link on tap. NotificationsInboxScreen's tap handler already
//   understands route_hint (see kyc-approval-notification for the same
//   pattern).
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// The full set of community-scoped types this sweeper owns. Adding a new
// community type? Add it here + give it a route hint below.
const COMMUNITY_TYPES = [
  "community_join_request",
  "community_join_approved",
  "community_join_rejected",
  "community_new_arrival",
  "gathering_created",
  "community_post_created",
] as const;

type CommunityType = typeof COMMUNITY_TYPES[number];

// Client-side deep-link hint per type. Matches the CommunityHub /
// ElderDashboard / UserDreamProfile routes registered in App.tsx.
// NotificationsInboxScreen's onPress dispatcher reads data.route_hint.
function routeHintFor(type: CommunityType): string {
  switch (type) {
    case "community_join_request":
      // Elders' review queue — Phase 4 wired this into ElderDashboard.
      return "ElderDashboard";
    case "community_join_approved":
    case "community_join_rejected":
    case "community_new_arrival":
    case "gathering_created":
    case "community_post_created":
      // All community-scoped events land back in the community hub.
      return "CommunityHub";
  }
}

// Android notification channel. No dedicated 'community' channel exists
// yet in NotificationContext's setNotificationChannelAsync setup, so
// piggyback on 'default'. Adding one is a small follow-up.
const CHANNEL_ID = "default";

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

    // Idempotency: pull rows that haven't been pushed yet. Partial index
    // notifications_push_unsent_idx (mig 182) keeps this hot even as the
    // notifications table grows.
    const { data: pending, error: selErr } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, data, type")
      .in("type", COMMUNITY_TYPES as unknown as string[])
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
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let delivered = 0;
    const failures: Array<{ id: string; reason: string }> = [];
    // Track tokens Expo told us are dead so we clear them off the profile
    // and stop pushing to them. Same recovery move every other sweeper
    // in this repo makes.
    const deadTokens: Set<string> = new Set();

    for (const row of pending ?? []) {
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("expo_push_token")
        .eq("id", row.user_id)
        .maybeSingle();
      if (profErr) {
        failures.push({
          id: row.id,
          reason: `profile_${profErr.code ?? "err"}`,
        });
        continue;
      }
      const token = (prof as { expo_push_token?: string | null } | null)
        ?.expo_push_token ?? null;
      if (!token) {
        // Soft-fail: leave push_sent_at NULL so a later sweep re-tries
        // once the user opens the app and the client registers a token.
        failures.push({ id: row.id, reason: "no_token" });
        continue;
      }

      const type = row.type as CommunityType;
      const payload = {
        to: token,
        title: row.title,
        body: row.body,
        data: {
          ...(row.data && typeof row.data === "object" ? row.data : {}),
          type: row.type,
          notification_id: row.id,
          route_hint: routeHintFor(type),
        },
        priority: "high" as const,
        sound: "default" as const,
        channelId: CHANNEL_ID,
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

        // Expo returns 200 with a per-message ticket even when the token
        // is dead — the failure is on data[0].status === 'error'. Parse
        // the ticket to catch DeviceNotRegistered so we can retire the
        // token.
        if (!resp.ok) {
          failures.push({ id: row.id, reason: `expo_http_${resp.status}` });
          continue;
        }
        const body = await resp.json().catch(() => null);
        const ticket = body?.data?.[0] ?? body?.data ?? null;
        const status = ticket?.status;
        if (status === "error") {
          const detail: string =
            ticket?.details?.error ?? ticket?.message ?? "unknown";
          if (detail === "DeviceNotRegistered") {
            deadTokens.add(token);
          }
          failures.push({ id: row.id, reason: `expo_${detail}` });
          continue;
        }

        // Success path — stamp push_sent_at so the next sweep skips it.
        const { error: stampErr } = await supabase
          .from("notifications")
          .update({ push_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        if (stampErr) {
          console.warn(
            `[community-notification] failed to stamp push_sent_at on ${row.id}: ${stampErr.message}`,
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

    // Retire dead tokens off every profile that carries one. Cheaper to
    // do once in bulk than per-row inside the loop.
    let deadTokensCleared = 0;
    if (deadTokens.size > 0) {
      const tokens = [...deadTokens];
      const { error: clearErr, count } = await supabase
        .from("profiles")
        .update({ expo_push_token: null }, { count: "exact" })
        .in("expo_push_token", tokens);
      if (clearErr) {
        console.warn(
          `[community-notification] failed to clear ${tokens.length} dead tokens: ${clearErr.message}`,
        );
      } else {
        deadTokensCleared = count ?? 0;
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
        dead_tokens_cleared: deadTokensCleared,
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
