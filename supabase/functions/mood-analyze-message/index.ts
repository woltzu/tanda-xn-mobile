// ═══════════════════════════════════════════════════════════════════════════
// mood-analyze-message — Edge Function (Deno runtime)
//
// Phase D1 of feat(mood). Invoked by the AFTER INSERT trigger on
// member_messages (migration 090). Reads one row, runs the engine's
// per-message NLP, writes back polarity_score, subjectivity,
// lexical_diversity, keyword_flags, response_latency_hours, analyzed_at.
//
// Engine parity — faithful port of:
//   ContributionMoodDetectionEngine.analyzeMessage(messageId) +
//   _computePolarity / _computeSubjectivity / _computeLexicalDiversity /
//   _detectKeywords / response latency calc
//
// One real bug fix vs the engine source — line 1139 has:
//   const negative = lang === "fr" ? negativeEN : negativeEN;  // BUG
// French messages were silently scored against the English negative list,
// producing systematically wrong polarity scores for FR users. Fixed here:
//   const negative = lang === "fr" ? negativeFR : negativeEN;  // FIXED
//
// Idempotency: skip if message already has analyzed_at set (the trigger's
// WHEN clause also gates this, but defensive). Skip if excluded_from_analysis.
//
// FK note: we only UPDATE an existing row, no FK risk.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Word lists ported VERBATIM from ContributionMoodDetectionEngine.ts ───
// (with the FR negative bug fixed, see header note)

const POSITIVE_EN = [
  "excited","great","love","amazing","wonderful","happy","glad","thanks","thank",
  "awesome","perfect","good","excellent","appreciate","enjoy","fantastic",
  "beautiful","helpful","kind",
];
const NEGATIVE_EN = [
  "struggle","can't","cannot","behind","urgent","late","difficult","hard",
  "problem","issue","worried","frustrated","angry","disappointed","confused",
  "stuck","fail","bad","terrible",
];
const POSITIVE_FR = [
  "content","super","merci","excellent","formidable","bien","parfait","génial",
  "heureux","ravie","adore","magnifique",
];
const NEGATIVE_FR = [
  "difficile","problème","retard","urgent","frustré","déçu","inquiet","galère",
  "impossible","pire","nul",
];
const OPINION_WORDS = [
  "think","feel","believe","love","hate","best","worst","amazing","terrible",
  "hope","wish","want","like","dislike","personally","opinion","prefer",
  "beautiful","ugly",
];

function computePolarity(text: string, lang: string): number {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  const positive = lang === "fr" ? POSITIVE_FR : POSITIVE_EN;
  const negative = lang === "fr" ? NEGATIVE_FR : NEGATIVE_EN;  // bug-fixed vs engine source

  let posCount = 0;
  let negCount = 0;
  for (const w of words) {
    if (positive.some((p) => w.includes(p))) posCount++;
    if (negative.some((n) => w.includes(n))) negCount++;
  }

  const total = posCount + negCount;
  if (total === 0) return 0;
  // Normalize to -1..+1 (engine formula)
  return (posCount - negCount) / total;
}

function computeSubjectivity(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const matches = words.filter((w) => OPINION_WORDS.some((o) => w.includes(o))).length;
  return Math.min(1, (matches / Math.max(1, words.length)) * 5);
}

function computeLexicalDiversity(text: string): number {
  const words = text.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= 1) return 0;
  const unique = new Set(words);
  return unique.size / words.length;
}

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
    let messageId: string | undefined;
    try {
      const body = await req.json();
      messageId = body?.messageId ?? body?.record?.id ?? body?.new?.id;
    } catch { /* malformed JSON → 400 below */ }
    if (!messageId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing messageId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Fetch the message
    const { data: msg, error: fetchErr } = await supabase
      .from("member_messages")
      .select("id, member_id, message_text, language, reply_to_id, sent_at, analyzed_at, excluded_from_analysis")
      .eq("id", messageId)
      .single();
    if (fetchErr || !msg) {
      return new Response(
        JSON.stringify({ success: false, error: "Message not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (msg.excluded_from_analysis) {
      return new Response(
        JSON.stringify({ success: true, skipped: "excluded_from_analysis" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (msg.analyzed_at) {
      return new Response(
        JSON.stringify({ success: true, skipped: "already_analyzed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = String(msg.message_text ?? "");
    const lang = String(msg.language ?? "en").toLowerCase();

    // 2) NLP computations
    const polarity = computePolarity(text, lang);
    const subjectivity = computeSubjectivity(text);
    const lexicalDiversity = computeLexicalDiversity(text);

    // 3) Keyword detection vs mood_keywords (the 36 seeded EN+FR keywords).
    //    The engine's _detectKeywords pulls keywords for the message's lang
    //    and returns the matched keyword strings. Same here.
    const { data: keywords } = await supabase
      .from("mood_keywords")
      .select("keyword")
      .eq("language", lang)
      .eq("is_active", true);
    const lower = text.toLowerCase();
    const keywordFlags = (keywords ?? [])
      .filter((kw: any) => lower.includes(String(kw.keyword).toLowerCase()))
      .map((kw: any) => kw.keyword as string);

    // 4) Response latency — if this is a reply, hours between parent.sent_at
    //    and this.sent_at. Mirrors engine logMessage logic, but applied at
    //    analyze time so it works for messages inserted without it set.
    let responseLatencyHours: number | null = null;
    if (msg.reply_to_id) {
      const { data: parent } = await supabase
        .from("member_messages")
        .select("sent_at")
        .eq("id", msg.reply_to_id)
        .single();
      if (parent?.sent_at) {
        const parentMs = new Date(parent.sent_at).getTime();
        const thisMs = new Date(msg.sent_at).getTime();
        responseLatencyHours = Math.max(0, (thisMs - parentMs) / (1000 * 60 * 60));
      }
    }

    // 5) Update the row. NUMERIC(5,3) for polarity_score and
    //    NUMERIC(4,3) for subjectivity / lexical_diversity, so cap precision
    //    to 3 decimal places to avoid 22003 numeric_value_out_of_range.
    const round3 = (n: number) => Math.round(n * 1000) / 1000;
    const { error: upErr } = await supabase
      .from("member_messages")
      .update({
        polarity_score: round3(polarity),
        subjectivity: round3(subjectivity),
        lexical_diversity: round3(lexicalDiversity),
        keyword_flags: keywordFlags,
        response_latency_hours: responseLatencyHours,
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", messageId);
    if (upErr) {
      console.error("[mood-analyze-message] update error:", upErr.message);
      return new Response(
        JSON.stringify({ success: false, error: upErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("✅ Analyzed:", { messageId, polarity: round3(polarity), keywords: keywordFlags.length });

    return new Response(
      JSON.stringify({
        success: true,
        polarity: round3(polarity),
        subjectivity: round3(subjectivity),
        lexical_diversity: round3(lexicalDiversity),
        keyword_count: keywordFlags.length,
        keywords: keywordFlags,
        response_latency_hours: responseLatencyHours,
      }),
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
