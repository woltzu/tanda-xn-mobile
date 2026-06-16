// ═══════════════════════════════════════════════════════════════════════════
// suggest-autopay — Edge Function (Deno runtime)
//
// P2 (autopay review): daily nudge for users who could be on autopay
// but aren't. Reads users with an active advance, checks the wallet
// balance vs the advance's outstanding amount, and accumulates a
// streak in autopay_suggestions. On day 3 of "wallet can cover it",
// inserts a notification ("Enable autopay to save on fees") and
// stamps suggested_at so we never nag the same user twice for the
// same advance.
//
// Schema dependencies (live as of 2026-06-15):
//   - public.autopay_suggestions          (migration 170 — this review)
//   - public.loan_autopay_configs         (migration ?? — existing)
//   - public.loans                        (existing)
//   - public.notifications                (existing)
//   - rpc public.get_advance_dashboard    (migration 145)
//
// IDEMPOTENCY:
//   - The (user_id, loan_id) UNIQUE constraint on autopay_suggestions
//     gates re-insertion. The function uses UPSERT for the streak
//     increment + a guard on suggested_at to skip already-notified
//     pairs.
//
// COVERAGE NOTES:
//   - Wallet balance lookup intentionally TODO'd — this codebase has
//     no single source-of-truth wallet view today (WalletContext
//     synthesises it from user_wallets). A second migration P3 would
//     expose a view like get_user_wallet_balance(uuid) so this
//     function can query authoritatively. Until then, the EF
//     skeleton is wired but the wallet check returns 0 and the
//     suggestion never fires — safe-default behaviour.
//
// DEPLOY:
//   supabase functions deploy suggest-autopay
//   (Cron registration via supabase/migrations or pg_cron — defer.)
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const STREAK_TO_SUGGEST = 3;

type LoanCandidate = {
  user_id: string;
  loan_id: string;
  outstanding_cents: number;
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ─── 1. Pull active advances WITHOUT an active autopay config ──────
  // The brief: we only nudge users who AREN'T already on autopay.
  // anti-join via `status != 'active'` OR no row — done client-side
  // for clarity rather than via a left-join SQL trick.
  const { data: activeLoans, error: loanErr } = await supabase
    .from("loans")
    .select("id, user_id, outstanding_principal_cents")
    .eq("status", "active");

  if (loanErr) {
    console.error("[suggest-autopay] loans query failed:", loanErr.message);
    return jsonResponse({ error: loanErr.message }, 500);
  }

  const candidates: LoanCandidate[] = [];

  for (const row of activeLoans ?? []) {
    const { data: cfg } = await supabase
      .from("loan_autopay_configs")
      .select("status")
      .eq("user_id", row.user_id)
      .eq("loan_id", row.id)
      .maybeSingle();
    if (cfg?.status === "active") continue; // already on autopay
    candidates.push({
      user_id: row.user_id,
      loan_id: row.id,
      outstanding_cents: row.outstanding_principal_cents ?? 0,
    });
  }

  let suggested = 0;
  let streaked = 0;

  for (const c of candidates) {
    // ─── 2. Wallet balance vs outstanding ─────────────────────────────
    // TODO(P3): replace this with a real view query. Without one we
    // conservatively assume the wallet does NOT cover, which means
    // this EF only ever touches the streak counter when wallet data
    // becomes available. Safe-default: never nudge wrongly.
    const walletCovers = false; // TODO(P3): query user_wallets / view

    // ─── 3. Upsert the suggestion row ──────────────────────────────────
    // We use SELECT then INSERT/UPDATE rather than upsert to read the
    // current consecutive_days for the conditional notification fire.
    const { data: existing, error: selErr } = await supabase
      .from("autopay_suggestions")
      .select("id, consecutive_days, suggested_at")
      .eq("user_id", c.user_id)
      .eq("loan_id", c.loan_id)
      .maybeSingle();
    if (selErr) continue;

    if (existing?.suggested_at) continue; // already notified — skip

    const nextStreak = walletCovers ? (existing?.consecutive_days ?? 0) + 1 : 0;

    if (existing) {
      await supabase
        .from("autopay_suggestions")
        .update({
          consecutive_days: nextStreak,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("autopay_suggestions").insert({
        user_id: c.user_id,
        loan_id: c.loan_id,
        consecutive_days: nextStreak,
      });
    }

    streaked++;

    // ─── 4. Fire the notification on the 3rd consecutive day ─────────
    if (nextStreak >= STREAK_TO_SUGGEST) {
      await supabase.from("notifications").insert({
        user_id: c.user_id,
        type: "autopay_suggestion",
        title: "Enable autopay to save on fees",
        body: "Your wallet has been covering your advance for a few days. Switch on autopay so we settle it automatically and save you fees.",
        data: { loan_id: c.loan_id, source: "suggest-autopay" },
      });
      await supabase
        .from("autopay_suggestions")
        .update({ suggested_at: new Date().toISOString() })
        .eq("user_id", c.user_id)
        .eq("loan_id", c.loan_id);
      suggested++;
    }
  }

  return jsonResponse({
    candidates: candidates.length,
    streaked,
    suggested,
  });
});
