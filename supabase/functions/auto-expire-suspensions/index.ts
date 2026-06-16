// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: auto-expire-suspensions
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 03:30 UTC (suggested — actual scheduling via pg_cron
// or Supabase Scheduler is configured separately when this is deployed).
// Purpose:  Clear profiles.suspended_until rows whose timestamp is in the
//           past so the suspension stops applying and a clean audit value
//           is left behind. Logs a moderation_actions row for traceability.
//
// Deployment:
//   supabase functions deploy auto-expire-suspensions --no-verify-jwt
//
// Authentication note: this is cron-triggered (no end-user JWT), so we
// use the SUPABASE_SERVICE_ROLE_KEY to bypass RLS on profiles. Do NOT
// expose this function via a public route.
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

  const startedAt = new Date().toISOString();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Find the profiles whose suspension has run out.
    const nowIso = new Date().toISOString();
    const { data: expired, error: selectErr } = await supabase
      .from("profiles")
      .select("id, suspended_until")
      .lte("suspended_until", nowIso)
      .not("suspended_until", "is", null);

    if (selectErr) throw selectErr;
    const ids = (expired ?? []).map((p: { id: string }) => p.id);

    if (ids.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          startedAt,
          finishedAt: new Date().toISOString(),
          cleared: 0,
          message: "no expired suspensions",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Clear them in one statement.
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ suspended_until: null })
      .in("id", ids);
    if (updateErr) throw updateErr;

    // No audit row — the original suspension is already in
    // moderation_actions, and expiration is a passive event (no admin
    // took an action). moderation_actions.action enum doesn't cover
    // "auto-expired" and we don't want to overload an existing value.

    return new Response(
      JSON.stringify({
        ok: true,
        startedAt,
        finishedAt: new Date().toISOString(),
        cleared: ids.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[auto-expire-suspensions] fatal:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
