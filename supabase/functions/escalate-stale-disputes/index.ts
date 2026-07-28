// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: escalate-stale-disputes
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): daily at 06:00 UTC.
// Purpose: walk open `disputes` rows and bump their escalation_tier based on
//   how long they've sat without action.
//
//   - 48h+ since updated_at, escalation_tier IS NULL
//       → escalation_tier = 'elder_l2'
//       → notify every elder in the circle
//   - 7d+ since updated_at, escalation_tier IN (NULL, 'elder_l2')
//       → escalation_tier = 'global_queue'
//       → notify every active platform admin (admin_users.is_active)
//
// Retargeted from dispute_cases → disputes as part of mig 384. dispute_cases
// is dead — nothing has written to it since mig 249 (verified 2026-07-28).
// All real dispute traffic lives in `disputes` (mig 261 + mig 384).
//
// New in this retarget:
//   * status filter: 'open', 'assigned', 'reviewing' (disputes has no CHECK
//     on status, so we match the same set the dashboard RPC does).
//   * escalated_at TIMESTAMPTZ stamped on both tier bumps (added by mig 384).
//   * escalated_to = tier value maintained for continuity with the legacy
//     text column (mig 261's original design).
//
// Idempotency anchor is the escalation_tier value itself — a row already
// in 'global_queue' is skipped by the WHERE filter, so re-running the
// cron is a no-op for already-escalated rows.
//
// Deployment:
//   supabase functions deploy escalate-stale-disputes --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const HOUR = 3600 * 1000;
const TIER1_THRESHOLD_HOURS = 48;
const TIER2_THRESHOLD_HOURS = 7 * 24;
const ACTIVE_STATUSES = ["open", "assigned", "reviewing"] as const;

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

    const now = Date.now();
    const tier1Cutoff = new Date(now - TIER1_THRESHOLD_HOURS * HOUR).toISOString();
    const tier2Cutoff = new Date(now - TIER2_THRESHOLD_HOURS * HOUR).toISOString();
    const bumpTs = new Date().toISOString();

    // ── Pass 1: 48h+ → elder_l2 ──────────────────────────────────────
    const { data: tier1Rows, error: t1Err } = await supabase
      .from("disputes")
      .select("id, circle_id, against_user_id, type")
      .in("status", ACTIVE_STATUSES as unknown as string[])
      .is("escalation_tier", null)
      .lt("updated_at", tier1Cutoff)
      .limit(2000);
    if (t1Err) throw t1Err;

    let tier1Bumped = 0;
    for (const d of tier1Rows ?? []) {
      const { error: upErr } = await supabase
        .from("disputes")
        .update({
          escalation_tier: "elder_l2",
          escalated_at: bumpTs,
          escalated_to: "elder_l2",
          updated_at: bumpTs,
        })
        .eq("id", d.id)
        .is("escalation_tier", null); // idempotency: only bump if still NULL
      if (upErr) {
        console.warn("[escalate] tier1 update failed:", upErr.message);
        continue;
      }
      tier1Bumped++;

      // Fan out a notification to every elder of the circle.
      if (d.circle_id) {
        const { data: elders } = await supabase
          .from("circle_members")
          .select("user_id")
          .eq("circle_id", d.circle_id)
          .eq("role", "elder");
        const eIds = (elders ?? []).map((e: { user_id: string }) => e.user_id);
        if (eIds.length > 0) {
          const rows = eIds.map((uid) => ({
            user_id: uid,
            type: "dispute_escalated_l2",
            title: "Stale dispute needs an Elder look",
            body: `An open dispute in your circle hasn't been touched in 48 hours. Tap to review.`,
            data: { dispute_id: d.id, circle_id: d.circle_id, tier: "elder_l2" },
            read: false,
          }));
          await supabase.from("notifications").insert(rows);
        }
      }
    }

    // ── Pass 2: 7d+ → global_queue ───────────────────────────────────
    const { data: tier2Rows, error: t2Err } = await supabase
      .from("disputes")
      .select("id, circle_id")
      .in("status", ACTIVE_STATUSES as unknown as string[])
      .or("escalation_tier.is.null,escalation_tier.eq.elder_l2")
      .lt("updated_at", tier2Cutoff)
      .limit(2000);
    if (t2Err) throw t2Err;

    // Resolve the admin audience once for the whole pass.
    const { data: admins } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("is_active", true);
    const adminIds = (admins ?? []).map(
      (a: { user_id: string }) => a.user_id,
    );

    let tier2Bumped = 0;
    for (const d of tier2Rows ?? []) {
      const { error: upErr } = await supabase
        .from("disputes")
        .update({
          escalation_tier: "global_queue",
          escalated_at: bumpTs,
          escalated_to: "global_queue",
          updated_at: bumpTs,
        })
        .eq("id", d.id)
        .or("escalation_tier.is.null,escalation_tier.eq.elder_l2");
      if (upErr) {
        console.warn("[escalate] tier2 update failed:", upErr.message);
        continue;
      }
      tier2Bumped++;

      if (adminIds.length > 0) {
        const rows = adminIds.map((uid) => ({
          user_id: uid,
          type: "dispute_escalated_global",
          title: "Dispute reached the global queue",
          body: `A dispute has been open for 7 days without resolution. Review in the admin dispute dashboard.`,
          data: { dispute_id: d.id, circle_id: d.circle_id, tier: "global_queue" },
          read: false,
        }));
        await supabase.from("notifications").insert(rows);
      }
    }

    return ok(started, { tier1Bumped, tier2Bumped });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[escalate-stale-disputes] fatal:", msg);
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
