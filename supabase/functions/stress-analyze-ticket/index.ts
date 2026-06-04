// ═══════════════════════════════════════════════════════════════════════════
// stress-analyze-ticket — Edge Function (Deno runtime)
//
// Phase Signal-B of feat(stress). Invoked by a database trigger (migration
// 086) on AFTER INSERT of support_tickets. Reads the ticket's text, runs
// the engine's exact keyword analysis + signal-value formula, and inserts
// one member_stress_signals row of signal_type='ticket_language'.
//
// Engine parity — this is a faithful port of:
//   FinancialStressPredictionEngine.analyzeText(text, language) +
//   FinancialStressPredictionEngine.recordTicketLanguage(...)
//
// Specifically:
//   matched, totalSeverity = scan(text, stress_keywords WHERE language=...)
//   urgencyLevel = totalSeverity >= 5 ? 'high' : >= 2.5 ? 'medium' : 'low'
//   signalValue  = min(100, totalSeverity * 20)
//   if urgencyLevel='high'   signalValue = max(signalValue, 80)
//   if urgencyLevel='medium' signalValue = max(signalValue, 50)
//
// (NOT the simpler matched_count/total_count*100 from the original spec —
// the engine weights each keyword by its severity_weight.)
//
// Schema reality checks (different from spec):
//   - Real column on member_stress_signals is `signal_value` not
//     `signal_strength`, and `raw_data` not `metadata`. Using actuals.
//   - support_tickets has `description` not `message`. We concat
//     subject + description for richer matching.
//   - support_tickets.user_id can be NULL (existing schema quirk). If
//     null, we skip — there's no member to attach the signal to.
//
// Idempotency:
//   The 085 partial unique index on (raw_data->>'ticket_id') WHERE
//   signal_type='ticket_language' enforces "one signal per ticket" at
//   the DB level. We also do a defensive SELECT before INSERT so the
//   common path returns 200 instead of a 23505 error on re-fires.
//
// FK safety:
//   member_stress_signals.member_id REFERENCES profiles(id). If a ticket
//   exists for a user_id that doesn't have a profiles row yet, the
//   INSERT would 23503 — we check profile existence before inserting
//   and return a friendly 200 with skipped=profile_missing.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = Date.now();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // Parse body. We accept either a webhook-shaped payload ({ type, record })
    // or a direct invocation ({ ticketId }) so both the SQL trigger AND
    // manual curl calls work.
    let ticketId: string | undefined;
    try {
      const body = await req.json();
      ticketId = body?.ticketId ?? body?.record?.id ?? body?.new?.id;
    } catch {
      // Empty body / malformed JSON → no ticket. Treated as 400.
    }
    if (!ticketId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing ticketId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Fetch the ticket. Pull subject + description for richer matching
    //    against multi-token stress keywords (e.g. "lost job", "laid off").
    const { data: ticket, error: fetchErr } = await supabase
      .from("support_tickets")
      .select("id, user_id, subject, description, language")
      .eq("id", ticketId)
      .single();

    if (fetchErr || !ticket) {
      console.error("[stress-analyze-ticket] ticket not found:", fetchErr?.message);
      return new Response(
        JSON.stringify({ success: false, error: "Ticket not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!ticket.user_id) {
      // The existing support_tickets.user_id is nullable. Without a member
      // we can't write a signal — skip and return 200 (not an error path).
      return new Response(
        JSON.stringify({ success: true, skipped: "ticket has no user_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2) Idempotency: if we already have a ticket_language signal for this
    //    ticket, no-op. Fast path that avoids hitting the unique index.
    const { data: existing } = await supabase
      .from("member_stress_signals")
      .select("id")
      .eq("signal_type", "ticket_language")
      .eq("member_id", ticket.user_id)
      .filter("raw_data->>ticket_id", "eq", ticketId)
      .limit(1)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ success: true, skipped: "signal already exists", signal_id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3) Verify the user has a profiles row — otherwise the FK on
    //    member_stress_signals.member_id will reject the insert.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", ticket.user_id)
      .limit(1)
      .maybeSingle();
    if (!profile) {
      return new Response(
        JSON.stringify({ success: true, skipped: "no profiles row for user_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4) Pull active keywords for the ticket's language. Fall back to 'en'
    //    so a ticket with NULL language still gets analyzed against the
    //    English corpus.
    const lang = (ticket.language ?? "en").toLowerCase();
    const { data: keywords, error: kwErr } = await supabase
      .from("stress_keywords")
      .select("keyword, severity_weight")
      .eq("language", lang)
      .eq("is_active", true);
    if (kwErr) throw kwErr;

    // 5) Engine-faithful analysis. Lowercase comparison, severity_weight
    //    accumulation, urgency floor, value cap.
    const haystack = `${ticket.subject ?? ""} ${ticket.description ?? ""}`.toLowerCase();
    const matched: string[] = [];
    let totalSeverity = 0;
    for (const kw of keywords ?? []) {
      if (haystack.includes(String(kw.keyword).toLowerCase())) {
        matched.push(kw.keyword);
        totalSeverity += parseFloat(String(kw.severity_weight));
      }
    }

    const urgencyLevel: "low" | "medium" | "high" =
      totalSeverity >= 5 ? "high" : totalSeverity >= 2.5 ? "medium" : "low";

    let signalValue = Math.min(100, totalSeverity * 20);
    if (urgencyLevel === "high")   signalValue = Math.max(signalValue, 80);
    if (urgencyLevel === "medium") signalValue = Math.max(signalValue, 50);
    signalValue = Math.round(signalValue * 100) / 100; // NUMERIC(6,2)

    // 6) Insert the signal. Wrapped in try/catch — the partial unique
    //    index will throw 23505 if we somehow raced past the check above,
    //    in which case we return 200 + skipped instead of 500. Same
    //    pattern as other engine EFs for fault tolerance.
    try {
      const { data: inserted, error: insErr } = await supabase
        .from("member_stress_signals")
        .insert({
          member_id: ticket.user_id,
          signal_type: "ticket_language",
          signal_value: signalValue,
          raw_data: {
            ticket_id: ticketId,
            keywords_matched: matched,
            keyword_count: matched.length,
            urgency_level: urgencyLevel,
            total_severity: totalSeverity,
            source: "stress_analyze_ticket_ef",
          },
        })
        .select()
        .single();

      if (insErr) {
        // Unique violation = treat as already done
        if (insErr.code === "23505") {
          return new Response(
            JSON.stringify({ success: true, skipped: "duplicate (race)" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw insErr;
      }

      console.log("✅ Signal recorded:", {
        ticket_id: ticketId,
        signal_value: signalValue,
        keyword_count: matched.length,
        urgency: urgencyLevel,
      });

      return new Response(
        JSON.stringify({
          success: true,
          signal_id: inserted.id,
          signal_value: signalValue,
          keyword_count: matched.length,
          urgency_level: urgencyLevel,
          total_severity: totalSeverity,
          processing_time_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (err: any) {
      console.error("[stress-analyze-ticket] insert error:", err?.message);
      return new Response(
        JSON.stringify({ success: false, error: err?.message ?? "insert failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    console.error("💥 Fatal:", err?.message);
    return new Response(
      JSON.stringify({ success: false, error: err?.message ?? "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
