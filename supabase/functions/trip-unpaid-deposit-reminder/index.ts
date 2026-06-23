// ═══════════════════════════════════════════════════════════════════════════
// trip-unpaid-deposit-reminder — Edge Function (Deno runtime)
//
// Join-trip Bucket C.3. Daily 09:00 UTC cron (migration 242) HTTP-POSTs
// here; we call the SECURITY DEFINER RPC `send_unpaid_deposit_reminders`
// that does the actual reminder fan-out AND the 48h auto-release with
// waitlist promotion.
//
// Auth: --no-verify-jwt at deploy time so the scheduled call (no user
// JWT) can hit it. The RPC itself is gated by the service-role key the
// EF uses, so external clients can still call this EF but won't be able
// to call the RPC without the secret.
//
// Why an EF instead of `SELECT send_unpaid_deposit_reminders()` from
// cron directly? Two reasons:
//   1. Logging — the EF prints the RPC result count so we can see
//      "reminded N, cancelled M, promoted K" in the functions log.
//   2. Future hooks — if we ever want to fan SMS / email after the DB
//      writes, this is the place to do it without re-pointing cron.
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

  const { data, error } = await supabase.rpc("send_unpaid_deposit_reminders");

  if (error) {
    console.error(
      "[trip-unpaid-deposit-reminder] send_unpaid_deposit_reminders RPC failed:",
      error.message,
    );
    return jsonResponse({ error: error.message }, 500);
  }

  console.log(
    "[trip-unpaid-deposit-reminder] success:",
    "reminded=" + (data?.reminded ?? 0),
    "cancelled=" + (data?.cancelled ?? 0),
    "promoted=" + (data?.promoted ?? 0),
  );

  return jsonResponse({ success: true, ...data });
});
