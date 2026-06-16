// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: check-advance-eligibility
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): daily at 05:00 UTC.
// Purpose:  For every user with an XnScore row, recompute eligibility for
//           each advance product, compare to advance_eligibility_cache,
//           and emit a notification when a product newly becomes
//           available (false → true). Then UPSERT the cache so the next
//           run sees the latest state.
//
// Eligibility model (mirrors get_advance_dashboard's product rules):
//   - product.is_active = true
//   - user xnscore >= product.min_xnscore
//   - user circles_completed >= product.min_completed_circles
//
// Deployment:
//   supabase functions deploy check-advance-eligibility --no-verify-jwt
//   Schedule via Supabase Scheduler or pg_cron.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    // 1. Load active advance products.
    const { data: products, error: prodErr } = await supabase
      .from("loan_products")
      .select(
        "code, name, min_xnscore, min_completed_circles, is_active, max_amount_cents",
      )
      .eq("is_active", true);
    if (prodErr) throw prodErr;
    if (!products || products.length === 0) {
      return ok(started, { notified: 0, reason: "no_active_products" });
    }

    // 2. Iterate users with recent XnScore activity. The scoring engine
    //    updates xn_scores.updated_at on every recompute, so the 7-day
    //    window catches everyone who's actually moving.
    const { data: users, error: userErr } = await supabase
      .from("xn_scores")
      .select("user_id, total_score, circles_participated, updated_at")
      .gte("updated_at", new Date(Date.now() - 7 * 86400 * 1000).toISOString())
      .limit(10000);
    if (userErr) throw userErr;

    let notified = 0;
    for (const u of users ?? []) {
      const score = Math.round(u.total_score ?? 0);
      const circles = u.circles_participated ?? 0;

      for (const p of products) {
        const eligibleNow =
          score >= (p.min_xnscore ?? 0) &&
          circles >= (p.min_completed_circles ?? 0);

        // Look up the cached state. Missing row = "never computed";
        // treat as eligible=false so a first-time qualifier still notifies.
        const { data: prior } = await supabase
          .from("advance_eligibility_cache")
          .select("eligible")
          .eq("user_id", u.user_id)
          .eq("product_code", p.code)
          .maybeSingle();

        const wasEligible = prior?.eligible ?? false;

        if (eligibleNow && !wasEligible) {
          // false → true: emit a notification.
          const { error: notifErr } = await supabase.from("notifications").insert({
            user_id: u.user_id,
            type: "advance_now_eligible",
            title: `You're eligible for an advance`,
            body: `You're now eligible for a ${p.name ?? p.code} advance up to $${
              Math.round((p.max_amount_cents ?? 0) / 100)
            }. Tap to apply.`,
            data: {
              product_code: p.code,
              max_amount_cents: p.max_amount_cents,
              triggered_by: "eligibility_change",
            },
            read: false,
          });
          if (!notifErr) notified++;
          else {
            console.warn(
              "[check-advance-eligibility] notification insert failed:",
              notifErr.message,
            );
          }
        }

        // Always UPSERT the cache so the next run has fresh state.
        await supabase
          .from("advance_eligibility_cache")
          .upsert(
            {
              user_id: u.user_id,
              product_code: p.code,
              eligible: eligibleNow,
              max_amount_cents: eligibleNow ? p.max_amount_cents : null,
              computed_at: new Date().toISOString(),
            },
            { onConflict: "user_id,product_code" },
          );
      }
    }

    return ok(started, { notified, users_scanned: users?.length ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[check-advance-eligibility] fatal:", msg);
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
