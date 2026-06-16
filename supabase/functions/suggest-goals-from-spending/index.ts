// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: suggest-goals-from-spending
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): Sunday 04:00 UTC, weekly.
// Purpose: Read every user's last-90-day money_transfers + contributions,
//          aggregate by category, and INSERT/UPDATE rows in
//          spending_patterns when monthly_avg_cents > a threshold.
//          The Goals hub turns these rows into a "Save instead?" banner.
//
// Deployment:
//   supabase functions deploy suggest-goals-from-spending --no-verify-jwt
//   Schedule via Supabase Scheduler or pg_cron.
//
// STATUS — PLACEHOLDER (Goal P2, 2026-06-14)
// ----------------------------------------------------------------------
// The schema landed in migration 155 (spending_patterns table, RLS, the
// dismiss_spending_pattern RPC), and the Goals hub already renders the
// banner. What's missing is the analytics: money_transfers and
// contributions don't carry an enriched category column today, so the
// categorisation pass would mostly buckets to "other" and isn't useful
// yet. Until the category enrichment lands, this function is a no-op
// scaffold that fails open (returns 200 with cleared=0).
//
// To smoke-test the banner without enrichment, seed a row by hand:
//
//   INSERT INTO public.spending_patterns
//     (user_id, category, monthly_avg_cents, suggested_save_cents)
//   VALUES
//     ('<user_uuid>', 'dining', 25000, 20000);  -- $250 spent → save $200
//
// Future work — when categorisation lands:
//   1. SELECT user_id, category, AVG(amount_cents) ... GROUP BY ... HAVING > 100_00
//   2. INSERT … ON CONFLICT (user_id, category) DO UPDATE
//      SET monthly_avg_cents = EXCLUDED.monthly_avg_cents,
//          suggested_save_cents = least(EXCLUDED.monthly_avg_cents * 0.8, ...),
//          last_computed_at = now(),
//          dismissed_at = NULL  -- re-surface a previously-dismissed row only
//                                -- if the average shifts meaningfully
//   3. Notify each user once when a new pattern emerges (notifications insert).
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Client is wired but unused until categorisation lands. Keeping it
    // here so a future PR only has to add the analytics SQL.
    const _supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // TODO(2026-Q3): replace this stub with the aggregate-and-upsert pass
    // described in the header comment. For now we return success without
    // mutating anything so the cron schedule can be wired without
    // breaking.
    return new Response(
      JSON.stringify({
        ok: true,
        status: "placeholder",
        message:
          "spending categorisation not yet implemented; spending_patterns left untouched.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[suggest-goals-from-spending] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
