// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: tier-change-notification
// ══════════════════════════════════════════════════════════════════════════════
// Purpose:  Off-app Expo push for users whose tier just changed
//           (advancement or demotion).
//
// How the row gets there:
//   Migration 185 installs `notify_tier_change` on member_tier_history.
//   When evaluate_member_tier appends a row with
//   change_type IN ('advancement','demotion'), the trigger inserts a
//   notifications row with type='tier_change'. This function sweeps
//   those rows and dispatches Expo push.
//
// Same shape as kyc-approval-notification (P1.5 of KYC review):
//   1. Read notifications WHERE type='tier_change' AND push_sent_at IS NULL
//   2. Fetch profiles.expo_push_token
//   3. POST to https://exp.host/--/api/v2/push/send
//   4. Stamp push_sent_at on success (idempotency)
//
// Deployment:
//   supabase functions deploy tier-change-notification --no-verify-jwt
//
// Schedule (suggested):
//   Every 1 minute via pg_cron — tier changes are infrequent (daily
//   eval cron, possibly less) so the sweeper does almost no work most
//   of the time but lands the notification fast when one shows up.
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

    const { data: pending, error: selErr } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, data, type")
      .eq("type", "tier_change")
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

    for (const row of pending ?? []) {
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
        // Soft-skip — leaves push_sent_at NULL so a later sweep retries
        // after the user opens the app and registers a device.
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
          // Hint for the client tap handler — open the tier detail screen
          // (GraduatedEntryScreen) so the user can see what unlocked or
          // what they need to do to recover.
          route: "GraduatedEntry",
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
        const { error: stampErr } = await supabase
          .from("notifications")
          .update({ push_sent_at: new Date().toISOString() })
          .eq("id", row.id);
        if (stampErr) {
          console.warn(
            `[tier-change-notification] failed to stamp push_sent_at on ${row.id}: ${stampErr.message}`,
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
