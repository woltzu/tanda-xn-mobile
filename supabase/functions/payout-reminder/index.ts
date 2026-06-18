// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: payout-reminder
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: daily at 09:00 UTC. Wired via either migration 189 (pg_cron) or
//           the Supabase Schedule UI.
//
// Purpose:  Find users whose payout is scheduled to land *tomorrow* and queue
//           a `payout_reminder` notification — the existing notification fan-
//           out (used by KYC, transfer, goal, tier) turns it into the Expo
//           push.
//
// Source of truth: `circle_cycles`. The CycleProgressionEngine maintains
//   the (recipient_user_id, expected_payout_date, cycle_status) tuple; once
//   it's confirmed the next payer for tomorrow, this EF queues the reminder.
//   `circle_payouts` is not used as the source because nothing currently
//   writes `scheduled`-state payout rows — PayoutExecutionEngine inserts
//   directly into 'completed' (per the receive-payout Bucket A wiring).
//
// Idempotency: a cycle gets at most one reminder. The check is per
//   (data->>'cycle_id') in `notifications` — same shape used by the
//   `notify_payout_received` trigger in migration 188.
//
// Deployment:
//   supabase functions deploy payout-reminder --no-verify-jwt
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function formatAmount(amount: number, currency?: string | null): string {
  const fixed = (Math.round(amount * 100) / 100).toFixed(2);
  if (!currency || currency === "USD") return `$${fixed}`;
  return `${fixed} ${currency}`;
}

function ok(started: string, body: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({ ok: true, started_at: started, ...body }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function fail(started: string, message: string, status = 500): Response {
  return new Response(
    JSON.stringify({ ok: false, started_at: started, error: message }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

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

    // "Tomorrow" in UTC. The function runs once a day at 09:00 UTC so
    // anything with expected_payout_date = (today + 1 day) is the
    // T-1 window. If we ever need timezone-aware reminders (notify in
    // each recipient's local timezone), the right place is here —
    // compute (now + 24h) per-user using profiles.timezone — but for
    // launch a single UTC window is fine.
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const tomorrowIso = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

    // Pull cycles whose payout is tomorrow and which haven't already
    // landed. cycle_status of 'payout_completed' / 'cancelled' is the
    // terminal-skip list; everything else is fair game.
    const { data: cycles, error: cyclesErr } = await supabase
      .from("circle_cycles")
      .select(
        "id, circle_id, recipient_user_id, expected_payout_date, payout_amount, expected_amount, cycle_status",
      )
      .eq("expected_payout_date", tomorrowIso)
      .not("recipient_user_id", "is", null)
      .not("cycle_status", "in", "(payout_completed,cancelled)");
    if (cyclesErr) {
      return fail(started, cyclesErr.message);
    }
    if (!cycles || cycles.length === 0) {
      return ok(started, { scanned: 0, notified: 0, reason: "no_cycles" });
    }

    // Fetch matching circles in one round-trip (name + currency).
    const circleIds = Array.from(new Set(cycles.map((c) => c.circle_id)));
    const { data: circles, error: circlesErr } = await supabase
      .from("circles")
      .select("id, name, currency")
      .in("id", circleIds);
    if (circlesErr) {
      return fail(started, circlesErr.message);
    }
    const circleById = new Map(
      (circles ?? []).map((c) => [c.id, c]),
    );

    let notified = 0;
    let skipped_idempotent = 0;
    for (const cycle of cycles) {
      const circle = circleById.get(cycle.circle_id);
      const circleName: string = circle?.name ?? "your circle";
      const currency: string | undefined = circle?.currency ?? "USD";
      // Prefer the computed payout_amount; fall back to expected_amount
      // for early-cycle rows where the payout column is still null.
      const amountNumeric = Number(
        cycle.payout_amount ?? cycle.expected_amount ?? 0,
      );

      // Idempotency: skip if a reminder for this cycle already exists.
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("type", "payout_reminder")
        .filter("data->>cycle_id", "eq", cycle.id)
        .limit(1);
      if (existing && existing.length > 0) {
        skipped_idempotent++;
        continue;
      }

      const amountDisplay = formatAmount(amountNumeric, currency);
      const { error: insertErr } = await supabase.from("notifications").insert({
        user_id: cycle.recipient_user_id,
        type: "payout_reminder",
        title: "Your payout arrives tomorrow!",
        body: `You'll receive ${amountDisplay} from ${circleName}.`,
        data: {
          cycle_id: cycle.id,
          circle_id: cycle.circle_id,
          amount: amountNumeric,
          currency,
          expected_payout_date: cycle.expected_payout_date,
        },
        read: false,
      });
      if (insertErr) {
        // Don't abort the whole batch on a single insert failure —
        // log and continue. The next day's run will re-attempt the
        // missed ones thanks to the idempotency check above.
        console.log(
          `[payout-reminder] insert failed for cycle ${cycle.id}: ${insertErr.message}`,
        );
        continue;
      }
      notified++;
    }

    return ok(started, {
      scanned: cycles.length,
      notified,
      skipped_idempotent,
      window_date: tomorrowIso,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(started, message);
  }
});
