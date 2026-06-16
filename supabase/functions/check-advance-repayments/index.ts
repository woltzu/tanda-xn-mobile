// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: check-advance-repayments
// ══════════════════════════════════════════════════════════════════════════════
// Schedule (suggested): daily at 05:10 UTC (after check-advance-eligibility).
// Purpose:  Two passes against loan_payment_schedule:
//
//   1. Upcoming reminder — rows where due_date is between today + 1 day
//      and today + 3 days (status='pending'). Drop one "due soon"
//      notification per (user, schedule_id). Idempotency via the
//      notifications row data.schedule_id field — a second pass on the
//      same row sees the prior notification and skips.
//
//   2. Overdue escalation — rows where due_date < today - 7 days and
//      status='pending' and late_fee_applied = false. Call the
//      apply_advance_late_penalty RPC (mig 157), drop a warning
//      notification to the borrower, and notify circle elders if the
//      loan was tied to a circle payout.
//
// Deployment:
//   supabase functions deploy check-advance-repayments --no-verify-jwt
//   Schedule via Supabase Scheduler or pg_cron.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REMIND_WINDOW_DAYS = 3;
const OVERDUE_THRESHOLD_DAYS = 7;

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

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const inThreeDays = new Date(today.getTime() + REMIND_WINDOW_DAYS * 86400 * 1000)
      .toISOString()
      .slice(0, 10);
    const overdueThreshold = new Date(today.getTime() - OVERDUE_THRESHOLD_DAYS * 86400 * 1000)
      .toISOString()
      .slice(0, 10);

    // ── Pass 1: upcoming reminders (1..3 days out) ─────────────────────
    const { data: upcoming, error: upErr } = await supabase
      .from("loan_payment_schedule")
      .select(
        "id, loan_id, due_date, total_due_cents, status, loans!inner(user_id)",
      )
      .eq("status", "pending")
      .gte("due_date", todayIso)
      .lte("due_date", inThreeDays)
      .limit(5000);
    if (upErr) throw upErr;

    let reminders = 0;
    for (const row of (upcoming ?? []) as Array<{
      id: string;
      loan_id: string;
      due_date: string;
      total_due_cents: number;
      loans: { user_id: string } | { user_id: string }[];
    }>) {
      const userId = Array.isArray(row.loans)
        ? row.loans[0]?.user_id
        : row.loans?.user_id;
      if (!userId) continue;

      // Has this schedule_id already been reminded? Look for any prior
      // notification carrying it in data.schedule_id. Cheap because
      // notifications.user_id + created_at is indexed and we cap the
      // lookback to 14 days.
      const { count: prior } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("type", "advance_repayment_due_soon")
        .gte("created_at", overdueThreshold)
        .contains("data", { schedule_id: row.id });
      if ((prior ?? 0) > 0) continue;

      const { error: notifErr } = await supabase.from("notifications").insert({
        user_id: userId,
        type: "advance_repayment_due_soon",
        title: "Advance repayment due soon",
        body: `Your repayment of $${
          (row.total_due_cents / 100).toFixed(2)
        } is due on ${row.due_date}. Make sure your wallet has funds.`,
        data: {
          schedule_id: row.id,
          loan_id: row.loan_id,
          due_date: row.due_date,
          amount_cents: row.total_due_cents,
        },
        read: false,
      });
      if (!notifErr) reminders++;
    }

    // ── Pass 2: overdue escalation (> 7 days past due, fee not applied) ─
    const { data: overdue, error: ovErr } = await supabase
      .from("loan_payment_schedule")
      .select(
        "id, loan_id, due_date, total_due_cents, status, late_fee_applied, loans!inner(user_id, application_id)",
      )
      .eq("status", "pending")
      .eq("late_fee_applied", false)
      .lt("due_date", overdueThreshold)
      .limit(2000);
    if (ovErr) throw ovErr;

    let escalations = 0;
    for (const row of (overdue ?? []) as Array<{
      id: string;
      loan_id: string;
      due_date: string;
      total_due_cents: number;
      loans: { user_id: string; application_id: string | null } | { user_id: string; application_id: string | null }[];
    }>) {
      const loanData = Array.isArray(row.loans) ? row.loans[0] : row.loans;
      const userId = loanData?.user_id;
      if (!userId) continue;
      const daysOverdue = Math.floor(
        (today.getTime() - new Date(row.due_date).getTime()) / (86400 * 1000),
      );

      // 1. Apply penalty (idempotent per-schedule via late_fee_applied).
      const { data: penResult, error: penErr } = await supabase.rpc(
        "apply_advance_late_penalty",
        { p_loan_id: row.loan_id, p_days_overdue: daysOverdue },
      );
      if (penErr) {
        console.warn(
          "[check-advance-repayments] penalty rpc failed:",
          penErr.message,
        );
        continue;
      }

      // 2. Warning notification to the borrower.
      const { error: warnErr } = await supabase.from("notifications").insert({
        user_id: userId,
        type: "advance_repayment_overdue",
        title: "Advance repayment is overdue",
        body: `Your repayment of $${
          (row.total_due_cents / 100).toFixed(2)
        } is ${daysOverdue} days late. A late fee has been added and your APR rose by 2%.`,
        data: {
          schedule_id: row.id,
          loan_id: row.loan_id,
          days_overdue: daysOverdue,
          penalty: penResult,
        },
        read: false,
      });
      if (!warnErr) escalations++;

      // 3. Notify circle elders if the loan was tied to a circle payout.
      //    We resolve the link via loans.application_id → loan_applications
      //    when that table carries a circle_id. Best-effort; missing
      //    column is tolerated so we don't bring down the pass.
      if (loanData?.application_id) {
        try {
          const { data: app } = await supabase
            .from("loan_applications")
            .select("circle_id")
            .eq("id", loanData.application_id)
            .maybeSingle();
          const circleId = (app as { circle_id?: string } | null)?.circle_id;
          if (circleId) {
            const { data: elders } = await supabase
              .from("circle_members")
              .select("user_id")
              .eq("circle_id", circleId)
              .eq("role", "elder");
            const elderIds = (elders ?? []).map((e: { user_id: string }) => e.user_id);
            if (elderIds.length > 0) {
              const rows = elderIds.map((eid) => ({
                user_id: eid,
                type: "advance_overdue_elder_alert",
                title: "Circle member's advance is overdue",
                body: `A member of one of your circles is ${daysOverdue} days late on an advance repayment.`,
                data: {
                  schedule_id: row.id,
                  loan_id: row.loan_id,
                  borrower_user_id: userId,
                  circle_id: circleId,
                  days_overdue: daysOverdue,
                },
                read: false,
              }));
              await supabase.from("notifications").insert(rows);
            }
          }
        } catch (e) {
          console.warn(
            "[check-advance-repayments] elder notify best-effort failed:",
            e instanceof Error ? e.message : String(e),
          );
        }
      }
    }

    return ok(started, { reminders, escalations });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[check-advance-repayments] fatal:", msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function ok(started: string, extras: Record<string, unknown>) {
  return new Response(
    JSON.stringify({
      ok: true,
      started,
      finished: new Date().toISOString(),
      ...extras,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
