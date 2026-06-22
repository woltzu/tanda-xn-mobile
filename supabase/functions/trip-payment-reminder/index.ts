// ═══════════════════════════════════════════════════════════════════════════
// trip-payment-reminder — Edge Function (Deno runtime)
//
// Bucket C.2 of the trip wizard audit. The DB trigger
// notify_trip_payment_due fires immediately when a `trip_payments` row
// lands or moves into "due tomorrow" — so this EF is intentionally a
// stub. Its job is to provide a daily safety-net probe (and an obvious
// hook for future SMS / email channels), not to be the primary path.
//
// What it does:
//   1. Counts trip_payments rows where status='pending' and
//      due_date = tomorrow.
//   2. Logs the count and returns it for monitoring.
//
// What it does NOT do:
//   • Insert notifications. The trigger already did that on row create
//     / update.
//   • Send email / SMS. Future work — when an SMS or email channel
//     lands, this EF is where the fan-out should live.
//
// Auth: --no-verify-jwt at deploy time so a scheduled-task caller (no
// user JWT) can hit it.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Tomorrow in UTC (matches what the trigger compares against:
  // CURRENT_DATE + INTERVAL '1 day' in the DB session timezone).
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const { data, error, count } = await supabase
    .from("trip_payments")
    .select("id, trip_participant_id, amount, due_date", { count: "exact" })
    .eq("status", "pending")
    .eq("due_date", tomorrowStr);

  if (error) {
    console.error("[trip-payment-reminder] query failed:", error.message);
    return jsonResponse({ error: error.message }, 500);
  }

  const found = count ?? data?.length ?? 0;
  console.log(
    `[trip-payment-reminder] ${found} trip_payments due ${tomorrowStr} ` +
      `(trigger handles notifications; this EF is a probe stub)`,
  );

  return jsonResponse({ success: true, due_date: tomorrowStr, count: found });
});
