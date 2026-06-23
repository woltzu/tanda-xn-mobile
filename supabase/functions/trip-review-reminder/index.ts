// ═══════════════════════════════════════════════════════════════════════════
// Edge Function: trip-review-reminder — Leave-review Bucket C.2
// ═══════════════════════════════════════════════════════════════════════════
//
// Thin wrapper around the public.send_trip_review_reminders() RPC. The
// daily cron job (migration 246) already calls the RPC directly, so this
// function exists only to give us a manual trigger surface for
// debugging / backfilling, and to keep the deployment pattern consistent
// with the other reminder EFs (payout-reminder, event-reminder,
// gathering-reminder).
//
// No JWT — invoked from the cron path or via service_role-authenticated
// curl. Safe to call any time: the RPC's WHERE clauses guarantee at most
// one reminder per (user, trip) per 7-day window.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

serve(async () => {
  const { error } = await supabase.rpc("send_trip_review_reminders");
  if (error) {
    console.error("[trip-review-reminder] RPC failed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
