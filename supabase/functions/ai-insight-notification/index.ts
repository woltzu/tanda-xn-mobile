// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: ai-insight-notification
// ══════════════════════════════════════════════════════════════════════════════
// Purpose:  Deliver Expo push notifications for both:
//             • per-decision AI insights (type = 'ai_insight')
//             • weekly digest summaries (type = 'ai_weekly_digest')
//
// Why this exists separately from the trigger:
//   Migration 187 already INSERTs an `ai_insight` notifications row on
//   every ai_decisions INSERT. The trigger handles the *in-app* surface
//   — those rows are polled by NotificationContext and rendered in the
//   inbox. What the trigger CANNOT do from inside Postgres is hit the
//   Expo Push API for off-app delivery. This function closes that gap.
//
//   Same idea for the weekly digest (ai-weekly-digest EF inserts the
//   digest row; this dispatcher sees it on the next sweep and pushes).
//
//   Folding both types into one dispatcher keeps the operational
//   surface small. The filter is a single IN (...) list.
//
// Pattern mirrors kyc-approval-notification (P1.5 from KYC review) and
// tier-change-notification (Bucket A of the tier review):
//   1. Read notifications where type IN ('ai_insight','ai_weekly_digest')
//      AND push_sent_at IS NULL.
//   2. (Bucket C) Defensive dedup: if the source ai_decision has a
//      source_event_id that already drove a push for this user via
//      another notification type in the last 5 minutes, skip the push
//      and stamp push_sent_at so the row doesn't retry.
//   3. Fetch the recipient's expo_push_token from `profiles`.
//   4. POST to https://exp.host/--/api/v2/push/send.
//   5. Mark the row push_sent_at = NOW() (or push_error on failure).
//
// Schedule:
//   Every 1–2 minutes via pg_cron or Supabase Scheduler. Short cadence
//   because users expect a score-change explanation to feel close to
//   live once the trigger fires.
//
// Deployment:
//   supabase functions deploy ai-insight-notification --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const SWEEPABLE_TYPES = ["ai_insight", "ai_weekly_digest"];

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

    // Pull pending rows. The partial index notifications_push_unsent_idx
    // (migration 182) keeps this query cheap as the table grows.
    const { data: pending, error: selErr } = await supabase
      .from("notifications")
      .select("id, user_id, title, body, data, type")
      .in("type", SWEEPABLE_TYPES)
      .is("push_sent_at", null)
      .order("created_at", { ascending: true })
      .limit(200);

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
    let deduped = 0;
    const failures: Array<{ id: string; reason: string }> = [];

    for (const row of pending ?? []) {
      // ── Bucket C — defensive dedup ────────────────────────────────────
      // Multiple triggers can fire on the same source event (e.g., an
      // xn_scores tier flip drives both notify_xnscore_tier_change AND
      // record_ai_decision_for_xnscore_tier via migration 219). The score-
      // domain notification is in-app only today, but a future generic
      // push dispatcher could push it. If that ever happens we'd send the
      // same user two pushes for one event. Pre-emptive check: if any
      // other notification for this user shares the same source_event_id
      // from the linked ai_decisions row AND was already push_sent_at
      // stamped within the last 5 minutes, treat this ai_insight as a
      // dup, stamp it sent (so the partial index drops it), and move on.
      //
      // Today this is a no-op — only ai_insight rows currently set
      // push_sent_at — so the check fires zero matches and execution
      // falls through to the normal push path. Keeping it here means
      // adding a source-domain push dispatcher later requires no change
      // to this function.
      const decisionId = (row.data as Record<string, unknown> | null)?.[
        "decision_id"
      ];
      if (row.type === "ai_insight" && typeof decisionId === "string") {
        const { data: decision } = await supabase
          .from("ai_decisions")
          .select("source_event_id, source_event_type")
          .eq("id", decisionId)
          .maybeSingle();
        const srcId = (decision as { source_event_id?: string | null } | null)
          ?.source_event_id;
        if (srcId) {
          const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
          const { data: rivals } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", row.user_id)
            .neq("type", "ai_insight")
            .not("push_sent_at", "is", null)
            .gte("created_at", cutoff)
            .filter("data->>source_event_id", "eq", srcId)
            .limit(1);
          if (rivals && rivals.length > 0) {
            const { error: stampErr } = await supabase
              .from("notifications")
              .update({ push_sent_at: new Date().toISOString() })
              .eq("id", row.id);
            if (stampErr) {
              failures.push({ id: row.id, reason: `dedup_stamp_${stampErr.code ?? "err"}` });
              continue;
            }
            deduped++;
            continue;
          }
        }
      }

      // Read the recipient's most recent device token. A missing token
      // is a soft-fail — we leave push_sent_at NULL so a later sweep
      // retries after the user opens the app and registers a token.
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
          // Client-side hint: tap routes to the AI Insights deep-dive.
          // Specific in-app destination is the client's call; we just
          // flag which deep link is most relevant.
          deep_link: "ai_insights",
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
            `[ai-insight-notification] failed to stamp push_sent_at on ${row.id}: ${stampErr.message}`,
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
        deduped,
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
