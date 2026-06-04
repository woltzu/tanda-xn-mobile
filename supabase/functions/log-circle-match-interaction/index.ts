// ═══════════════════════════════════════════════════════════════════════════
// log-circle-match-interaction — Edge Function (Deno runtime)
//
// Phase C of feat(circle). Records every user interaction with circle
// recommendations into circle_match_history (migration 007 + 052). The
// row stores the snapshot data the CircleMatchHistoryEngine wants for
// ML training: profile + circle snapshots + session context + algorithm
// version + match_score breakdown.
//
// Real column names (vs the original spec):
//   - Action column is `action`, NOT `interaction_type` (spec drift)
//   - Circle reference is `circle_id`, NOT `recommended_circle_id`
//   - Action CHECK ∈ {viewed, dismissed, saved, applied, joined,
//                     rejected, returned, shared} (migration 052 expanded
//                     the original 007 list)
//
// Direct-insert alternative: migration 007 RLS allows authenticated users
// to INSERT their own circle_match_history rows. The EF route exists for
// 3 reasons:
//   1. Server-side validation of the action enum (vs RLS-only)
//   2. Easier to add side-effects later (e.g. fire a tracking event,
//      enrich snapshots with server-side data)
//   3. Future webhook integrations don't carry a user JWT
//
// Body shape:
//   {
//     userId: string,
//     circleId: string,
//     action: 'viewed' | 'dismissed' | 'saved' | 'applied' | 'joined'
//             | 'rejected' | 'returned' | 'shared',
//     matchScore?: number,
//     affordabilityScore?: number,
//     trustScore?: number,
//     compatibilityScore?: number,
//     actionReason?: string,
//     sessionContext?: { screen, circlesViewedInSession, positionInFeed,
//                        sessionDurationMs, deviceType?, appVersion? },
//     memberProfileSnapshot?: { ... },
//     circleProfileSnapshot?: { ... },
//     algorithmVersion?: string
//   }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ACTIONS = new Set([
  "viewed", "dismissed", "saved", "applied", "joined",
  "rejected", "returned", "shared",
]);

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Accept both camelCase (frontend convention) and snake_case (HTTP
    // convention) for the required fields.
    const userId = body?.userId ?? body?.user_id;
    const circleId = body?.circleId ?? body?.circle_id;
    const action = body?.action;

    if (!userId || !circleId || !action) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing userId, circleId, or action",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!VALID_ACTIONS.has(action)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid action. Expected one of: ${[...VALID_ACTIONS].join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert into circle_match_history. The schema includes a UNIQUE
    // constraint pattern? No — every interaction is a new row, including
    // multiple 'viewed' events for the same (user, circle). The
    // CircleMatchHistoryEngine wants a full event log, not the latest
    // state, so no UPSERT.
    const insertBody = {
      user_id: userId,
      circle_id: circleId,
      action,
      match_score: body?.matchScore ?? body?.match_score ?? 0,
      affordability_score: body?.affordabilityScore ?? body?.affordability_score ?? null,
      trust_score: body?.trustScore ?? body?.trust_score ?? null,
      compatibility_score: body?.compatibilityScore ?? body?.compatibility_score ?? null,
      action_reason: body?.actionReason ?? body?.action_reason ?? null,
      session_context: body?.sessionContext ?? body?.session_context ?? {},
      member_profile_snapshot: body?.memberProfileSnapshot ?? body?.member_profile_snapshot ?? {},
      circle_profile_snapshot: body?.circleProfileSnapshot ?? body?.circle_profile_snapshot ?? {},
      algorithm_version: body?.algorithmVersion ?? body?.algorithm_version ?? "rule-v1",
    };

    const { data: row, error } = await supabase
      .from("circle_match_history")
      .insert(insertBody)
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[log-circle-match-interaction] insert error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message, code: error.code }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Logged:", { id: row.id, action, userId, circleId });
    return new Response(
      JSON.stringify({ success: true, id: row.id, created_at: row.created_at }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("💥 Fatal:", err?.message);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
