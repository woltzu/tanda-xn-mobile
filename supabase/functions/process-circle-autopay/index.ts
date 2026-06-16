// ═══════════════════════════════════════════════════════════════════════════
// process-circle-autopay — Edge Function (Deno runtime)
//
// Phase 1 of the Circle Contribution Autopay feature. Two passes per
// invocation:
//
//   PASS A — upcoming-notification sweep
//     Find active configs with next_execution_at ~2 days out and
//     upcoming_notified_at IS NULL. Insert a notification row, stamp
//     upcoming_notified_at so we don't re-fire. The EF execution path
//     resets upcoming_notified_at to NULL after each successful run,
//     so the next cycle's window can re-fire.
//
//   PASS B — execution sweep
//     For every active config whose next_execution_at <= now():
//       1. Pick the current active cycle.
//       2. Idempotency-skip if a non-failed contribution already
//          exists for (user, circle, cycle_number).
//       3. Execute payment:
//          - wallet → call process_circle_autopay_wallet_debit RPC
//            (migration 172). Atomic debit + contribution insert.
//          - card / us_bank_account → Stripe.paymentIntents.create
//            with off_session=true, confirm=true. Off-session charges
//            require a previously-saved Stripe payment method, which
//            we resolve via stripe_payment_methods.id →
//            stripe_payment_method_id.
//       4. Log the outcome.
//       5. On success: advance next_execution_at to the next cycle's
//          deadline; null out upcoming_notified_at.
//       6. On failure: increment retry by counting log rows.
//          After 3 failures in 7 days, status='paused' + insert a
//          notification.
//
// Manual run (Phase 1 testing path):
//   curl -X POST -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
//        https://<ref>.supabase.co/functions/v1/process-circle-autopay
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const MAX_FAILURES = 3;
const UPCOMING_LOWER_HOURS = 36; // T-1.5 days
const UPCOMING_UPPER_HOURS = 60; // T-2.5 days

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

type AutopayConfig = {
  id: string;
  user_id: string;
  circle_id: string;
  payment_method_id: string | null;
  payment_method_type: "wallet" | "card" | "us_bank_account";
  enabled: boolean;
  contribution_amount_cents: number;
  schedule_type: "on_due" | "days_before";
  days_before: number;
  status: "active" | "paused" | "disabled";
  next_execution_at: string | null;
  upcoming_notified_at: string | null;
  // Phase 2 — credit accumulator (added by migration 173).
  pending_round_up_credit_cents: number;
};

type Cycle = {
  id: string;
  circle_id: string;
  cycle_number: number;
  contribution_deadline: string;
  cycle_status: string;
};

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

// P2 (notification-prefs review): central gate. Wraps the migration
// 176 RPC; returns true on RPC failure (fail-open — we'd rather
// over-deliver than silently drop a notification because the gate
// errored). Categories pinned to 'circles' because every notification
// this EF emits is circle-scoped.
async function canSend(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  channel: "push" | "email",
  circleId: string | null,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("should_send_notification", {
      p_user_id: userId,
      p_category: "circles",
      p_channel: channel,
      p_circle_id: circleId,
    });
    if (error) {
      console.warn(
        "[process-circle-autopay] should_send_notification failed:",
        error.message,
      );
      return true;
    }
    return data === true;
  } catch (e) {
    console.warn(
      "[process-circle-autopay] should_send_notification threw:",
      (e as Error).message,
    );
    return true;
  }
}

function computeNextExecution(
  deadline: string | null,
  scheduleType: "on_due" | "days_before",
  daysBefore: number,
): string | null {
  if (!deadline) return null;
  const d = new Date(deadline + "T00:00:00Z");
  if (scheduleType === "days_before") {
    d.setUTCDate(d.getUTCDate() - daysBefore);
  }
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const now = new Date().toISOString();

  // ═══════════════════════════════════════════════════════════════════════
  // PASS A — upcoming notification sweep (T-2 day reminder).
  // ═══════════════════════════════════════════════════════════════════════
  const lower = new Date(
    Date.now() + UPCOMING_LOWER_HOURS * 3_600_000,
  ).toISOString();
  const upper = new Date(
    Date.now() + UPCOMING_UPPER_HOURS * 3_600_000,
  ).toISOString();

  const { data: upcoming } = await supabase
    .from("circle_autopay_configs")
    .select(
      "id, user_id, circle_id, payment_method_id, payment_method_type, contribution_amount_cents, pending_round_up_credit_cents, next_execution_at, upcoming_notified_at",
    )
    .eq("enabled", true)
    .eq("status", "active")
    .is("upcoming_notified_at", null)
    .gte("next_execution_at", lower)
    .lte("next_execution_at", upper);

  let upcomingNotified = 0;
  let lowBalanceWarned = 0;
  let cardExpiredWarned = 0;

  for (const cfg of (upcoming ?? []) as Array<
    Pick<
      AutopayConfig,
      | "id"
      | "user_id"
      | "circle_id"
      | "payment_method_id"
      | "payment_method_type"
      | "contribution_amount_cents"
      | "pending_round_up_credit_cents"
      | "next_execution_at"
      | "upcoming_notified_at"
    >
  >) {
    // Pull the circle name so the notification body is meaningful.
    const { data: circleRow } = await supabase
      .from("circles")
      .select("name")
      .eq("id", cfg.circle_id)
      .maybeSingle<{ name: string }>();
    const circleName = circleRow?.name ?? "your circle";
    const netCents = Math.max(
      0,
      cfg.contribution_amount_cents -
        (cfg.pending_round_up_credit_cents ?? 0),
    );
    const amount = (cfg.contribution_amount_cents / 100).toFixed(2);
    const dateLabel = cfg.next_execution_at
      ? new Date(cfg.next_execution_at).toISOString().slice(0, 10)
      : "soon";

    // P2 (notification-prefs review): gate every notification through
    // should_send_notification. We still stamp upcoming_notified_at
    // regardless so we don't re-evaluate this row tomorrow — if the
    // user has the category muted, the suppression is intentional and
    // re-firing won't change their mind.
    if (await canSend(supabase, cfg.user_id, "push", cfg.circle_id)) {
      await supabase.from("notifications").insert({
        user_id: cfg.user_id,
        type: "autopay_upcoming",
        title: "Autopay coming up",
        body: `Autopay will contribute $${amount} to ${circleName} on ${dateLabel}.`,
        data: {
          circle_id: cfg.circle_id,
          config_id: cfg.id,
          scheduled_at: cfg.next_execution_at,
        },
      });
      upcomingNotified++;
    }
    await supabase
      .from("circle_autopay_configs")
      .update({ upcoming_notified_at: now })
      .eq("id", cfg.id);

    // Phase 2 (a) — wallet-balance check. Only relevant when the
    // configured method IS the wallet. netCents already accounts for
    // pending round-up credit so we don't false-warn when the credit
    // covers the cycle.
    if (cfg.payment_method_type === "wallet" && netCents > 0) {
      const { data: walletRow } = await supabase
        .from("user_wallets")
        .select("main_balance_cents")
        .eq("user_id", cfg.user_id)
        .maybeSingle<{ main_balance_cents: number }>();
      if (
        walletRow &&
        (walletRow.main_balance_cents ?? 0) < netCents
      ) {
        if (await canSend(supabase, cfg.user_id, "push", cfg.circle_id)) {
          await supabase.from("notifications").insert({
            user_id: cfg.user_id,
            type: "autopay_low_balance",
            title: "Wallet balance is low for upcoming autopay",
            body: `Your wallet has less than $${(netCents / 100).toFixed(2)} needed for the ${circleName} autopay on ${dateLabel}. Add funds to avoid a failure.`,
            data: {
              circle_id: cfg.circle_id,
              config_id: cfg.id,
              shortfall_cents:
                netCents - (walletRow.main_balance_cents ?? 0),
            },
          });
          lowBalanceWarned++;
        }
      }
    }

    // Phase 2 (b) — expired card check. Cards have an exp_month +
    // exp_year on stripe_payment_methods. If exp date is in the past
    // (or this month), fire the warning so the user can swap method.
    if (
      cfg.payment_method_type === "card" &&
      cfg.payment_method_id
    ) {
      const { data: pmRow } = await supabase
        .from("stripe_payment_methods")
        .select("card_exp_month, card_exp_year, card_brand, card_last4")
        .eq("id", cfg.payment_method_id)
        .maybeSingle<{
          card_exp_month: number | null;
          card_exp_year: number | null;
          card_brand: string | null;
          card_last4: string | null;
        }>();
      if (pmRow?.card_exp_month && pmRow.card_exp_year) {
        const today = new Date();
        const expired =
          pmRow.card_exp_year < today.getUTCFullYear() ||
          (pmRow.card_exp_year === today.getUTCFullYear() &&
            pmRow.card_exp_month <= today.getUTCMonth() + 1);
        if (expired) {
          if (await canSend(supabase, cfg.user_id, "push", cfg.circle_id)) {
            await supabase.from("notifications").insert({
              user_id: cfg.user_id,
              type: "autopay_card_expired",
              title: "Saved card has expired",
              body: `The card ending in ${pmRow.card_last4 ?? "****"} on your ${circleName} autopay has expired. Update the payment method to keep autopay running.`,
              data: {
                circle_id: cfg.circle_id,
                config_id: cfg.id,
              },
            });
            cardExpiredWarned++;
          }
        }
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASS B — execution sweep.
  // ═══════════════════════════════════════════════════════════════════════
  const { data: dueConfigs, error: dueErr } = await supabase
    .from("circle_autopay_configs")
    .select(
      "id, user_id, circle_id, payment_method_id, payment_method_type, enabled, contribution_amount_cents, schedule_type, days_before, status, next_execution_at, upcoming_notified_at, pending_round_up_credit_cents",
    )
    .eq("enabled", true)
    .eq("status", "active")
    .lte("next_execution_at", now)
    .returns<AutopayConfig[]>();

  if (dueErr) {
    console.error("[process-circle-autopay] dueConfigs failed:", dueErr.message);
    return jsonResponse({ error: dueErr.message }, 500);
  }

  let attempted = 0;
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let paused = 0;

  for (const cfg of dueConfigs ?? []) {
    attempted++;
    const todayDate = new Date().toISOString().slice(0, 10);

    // 1. Active cycle for this circle.
    const { data: cycleRow, error: cycErr } = await supabase
      .from("circle_cycles")
      .select(
        "id, circle_id, cycle_number, contribution_deadline, cycle_status",
      )
      .eq("circle_id", cfg.circle_id)
      .in("cycle_status", ["active", "collecting"])
      .order("contribution_deadline", { ascending: true })
      .limit(1)
      .maybeSingle<Cycle>();

    if (cycErr || !cycleRow) {
      skipped++;
      await supabase.from("circle_autopay_log").insert({
        config_id: cfg.id,
        scheduled_date: todayDate,
        status: "skipped",
        error_message: cycErr?.message ?? "no active cycle",
      });
      continue;
    }
    const cycle = cycleRow;

    // 2. Member id (contributions.member_id NOT NULL).
    const { data: memberRow } = await supabase
      .from("circle_members")
      .select("id")
      .eq("circle_id", cfg.circle_id)
      .eq("user_id", cfg.user_id)
      .maybeSingle<{ id: string }>();
    if (!memberRow) {
      failed++;
      await recordFailure(
        supabase,
        cfg,
        cycle,
        todayDate,
        "user is not a member of the circle",
      );
      await maybePause(supabase, cfg);
      continue;
    }

    // 3. Idempotency: manual contribution already? Skip.
    const { data: existingContrib } = await supabase
      .from("contributions")
      .select("id")
      .eq("user_id", cfg.user_id)
      .eq("circle_id", cfg.circle_id)
      .eq("cycle_number", cycle.cycle_number)
      .neq("status", "failed")
      .maybeSingle();
    if (existingContrib) {
      skipped++;
      await supabase.from("circle_autopay_log").insert({
        config_id: cfg.id,
        scheduled_date: todayDate,
        executed_at: now,
        status: "skipped",
        amount_cents: cfg.contribution_amount_cents,
        error_message: "contribution already recorded for cycle",
      });
      await advanceNextExecution(supabase, cfg, cycle);
      continue;
    }

    // 4. Real payment execution.
    let success = false;
    let errorMessage: string | null = null;

    // Phase 2 — apply pending round-up credit. The contribution row
    // is always recorded at the cycle's full expected amount; the
    // *charge* uses net = max(0, amount - credit). On success we
    // decrement the credit by min(credit, amount).
    const creditCents = cfg.pending_round_up_credit_cents ?? 0;
    const chargeCents = Math.max(
      0,
      cfg.contribution_amount_cents - creditCents,
    );
    const creditConsumedCents = Math.min(
      creditCents,
      cfg.contribution_amount_cents,
    );

    if (cfg.payment_method_type === "wallet") {
      if (chargeCents === 0) {
        // Fully covered by credit — no wallet debit needed. Still
        // insert the contribution row (so the cycle counter advances)
        // and the log row, just with a "credit" annotation.
        const { error: insErr } = await supabase
          .from("contributions")
          .insert({
            user_id: cfg.user_id,
            member_id: memberRow.id,
            circle_id: cfg.circle_id,
            cycle_number: cycle.cycle_number,
            amount: cfg.contribution_amount_cents / 100,
            due_date: cycle.contribution_deadline,
            status: "completed",
            payment_method: "round_up_credit",
            paid_at: now,
            paid_date: now,
          });
        if (insErr) {
          success = false;
          errorMessage = insErr.message;
        } else {
          success = true;
        }
      } else {
        const { data: rpcOut, error: rpcErr } = await supabase.rpc(
          "process_circle_autopay_wallet_debit",
          {
            p_user_id: cfg.user_id,
            p_circle_id: cfg.circle_id,
            p_member_id: memberRow.id,
            p_cycle_number: cycle.cycle_number,
            p_amount_cents: chargeCents,
            p_due_date: cycle.contribution_deadline,
          },
        );
        if (rpcErr) {
          errorMessage = rpcErr.message;
        } else if (rpcOut && typeof rpcOut === "object") {
          const out = rpcOut as { success?: boolean; error?: string };
          success = out.success === true;
          if (!success) errorMessage = out.error ?? "wallet debit failed";
        } else {
          errorMessage = "wallet debit returned no payload";
        }
      }
    } else {
      // Card / bank: Stripe off-session charge for the NET amount
      // (after credit). If charge is 0, skip Stripe entirely.
      if (chargeCents === 0) {
        const { error: insErr } = await supabase
          .from("contributions")
          .insert({
            user_id: cfg.user_id,
            member_id: memberRow.id,
            circle_id: cfg.circle_id,
            cycle_number: cycle.cycle_number,
            amount: cfg.contribution_amount_cents / 100,
            due_date: cycle.contribution_deadline,
            status: "completed",
            payment_method: "round_up_credit",
            paid_at: now,
            paid_date: now,
          });
        success = !insErr;
        if (insErr) errorMessage = insErr.message;
      } else {
        const charge = await chargeStripeOffSession(
          supabase,
          cfg,
          cycle,
          chargeCents,
        );
        success = charge.success;
        errorMessage = charge.error;
        if (success) {
          const { error: insErr } = await supabase
            .from("contributions")
            .insert({
              user_id: cfg.user_id,
              member_id: memberRow.id,
              circle_id: cfg.circle_id,
              cycle_number: cycle.cycle_number,
              amount: cfg.contribution_amount_cents / 100,
              due_date: cycle.contribution_deadline,
              status: "completed",
              payment_method_id: cfg.payment_method_id,
              payment_method: cfg.payment_method_type,
              processor_reference: charge.paymentIntentId,
              paid_at: now,
              paid_date: now,
            });
          if (insErr) {
            success = false;
            errorMessage = insErr.message;
          }
        }
      }
    }

    // Decrement the credit on success — credit consumed for this cycle.
    if (success && creditConsumedCents > 0) {
      await supabase
        .from("circle_autopay_configs")
        .update({
          pending_round_up_credit_cents:
            (cfg.pending_round_up_credit_cents ?? 0) - creditConsumedCents,
        })
        .eq("id", cfg.id);
    }

    // 5. Log + bookkeeping.
    await supabase.from("circle_autopay_log").insert({
      config_id: cfg.id,
      scheduled_date: todayDate,
      executed_at: now,
      status: success ? "success" : "failed",
      error_message: errorMessage,
      amount_cents: cfg.contribution_amount_cents,
    });

    if (success) {
      succeeded++;
      await advanceNextExecution(supabase, cfg, cycle);
    } else {
      failed++;
      if (await maybePause(supabase, cfg)) paused++;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // PASS D — detect missed contributions and seed suggestions.
  // Idempotent via UNIQUE(user_id, circle_id) on circle_autopay_suggestions.
  // ═══════════════════════════════════════════════════════════════════════
  let suggestionsCreated = 0;
  const { data: detectResult, error: detectErr } = await supabase.rpc(
    "detect_missed_circle_contributions",
  );
  if (detectErr) {
    console.warn(
      "[process-circle-autopay] detect_missed_circle_contributions failed:",
      detectErr.message,
    );
  } else if (typeof detectResult === "number") {
    suggestionsCreated = detectResult;
  }

  return jsonResponse({
    upcoming_notified: upcomingNotified,
    low_balance_warned: lowBalanceWarned,
    card_expired_warned: cardExpiredWarned,
    attempted,
    succeeded,
    failed,
    skipped,
    paused,
    suggestions_created: suggestionsCreated,
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function chargeStripeOffSession(
  supabase: ReturnType<typeof createClient>,
  cfg: AutopayConfig,
  cycle: Cycle,
  chargeCents: number,
): Promise<{ success: boolean; error: string | null; paymentIntentId?: string }> {
  // Resolve Stripe customer + payment method.
  if (!cfg.payment_method_id) {
    return { success: false, error: "card path requires payment_method_id" };
  }
  const { data: pmRow } = await supabase
    .from("stripe_payment_methods")
    .select("stripe_payment_method_id, member_id")
    .eq("id", cfg.payment_method_id)
    .maybeSingle<{ stripe_payment_method_id: string; member_id: string }>();
  if (!pmRow?.stripe_payment_method_id) {
    return { success: false, error: "saved payment method not found" };
  }
  const { data: custRow } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("member_id", cfg.user_id)
    .maybeSingle<{ stripe_customer_id: string }>();
  if (!custRow?.stripe_customer_id) {
    return { success: false, error: "no Stripe customer for user" };
  }

  try {
    const intent = await stripe.paymentIntents.create(
      {
        amount: chargeCents,
        currency: "usd",
        customer: custRow.stripe_customer_id,
        payment_method: pmRow.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        metadata: {
          source: "circle_autopay",
          user_id: cfg.user_id,
          circle_id: cfg.circle_id,
          cycle_number: String(cycle.cycle_number),
          config_id: cfg.id,
        },
      },
      { idempotencyKey: `${cfg.id}:${cycle.cycle_number}` },
    );
    if (intent.status === "succeeded") {
      return { success: true, error: null, paymentIntentId: intent.id };
    }
    // requires_action / requires_payment_method etc. — treat as failure
    // for autopay. User can retry manually after seeing the notification.
    return {
      success: false,
      error: `payment intent status: ${intent.status}`,
      paymentIntentId: intent.id,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `stripe error: ${msg}` };
  }
}

async function advanceNextExecution(
  supabase: ReturnType<typeof createClient>,
  cfg: AutopayConfig,
  currentCycle: Cycle,
) {
  const { data: nextCycle } = await supabase
    .from("circle_cycles")
    .select("contribution_deadline")
    .eq("circle_id", cfg.circle_id)
    .gt("cycle_number", currentCycle.cycle_number)
    .order("cycle_number", { ascending: true })
    .limit(1)
    .maybeSingle<{ contribution_deadline: string }>();

  const next = computeNextExecution(
    nextCycle?.contribution_deadline ?? null,
    cfg.schedule_type,
    cfg.days_before,
  );

  await supabase
    .from("circle_autopay_configs")
    .update({
      last_executed_at: new Date().toISOString(),
      next_execution_at: next,
      // Reset the upcoming-notification stamp so the new window can fire.
      upcoming_notified_at: null,
    })
    .eq("id", cfg.id);
}

async function recordFailure(
  supabase: ReturnType<typeof createClient>,
  cfg: AutopayConfig,
  cycle: Cycle,
  todayDate: string,
  msg: string,
) {
  await supabase.from("circle_autopay_log").insert({
    config_id: cfg.id,
    scheduled_date: todayDate,
    executed_at: new Date().toISOString(),
    status: "failed",
    error_message: msg,
    amount_cents: cfg.contribution_amount_cents,
  });
}

// Returns true iff we just paused this config in this call.
async function maybePause(
  supabase: ReturnType<typeof createClient>,
  cfg: AutopayConfig,
): Promise<boolean> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { count } = await supabase
    .from("circle_autopay_log")
    .select("*", { count: "exact", head: true })
    .eq("config_id", cfg.id)
    .eq("status", "failed")
    .gte("created_at", sevenDaysAgo);

  if ((count ?? 0) < MAX_FAILURES) return false;

  await supabase
    .from("circle_autopay_configs")
    .update({ status: "paused" })
    .eq("id", cfg.id);

  if (await canSend(supabase, cfg.user_id, "push", cfg.circle_id)) {
    await supabase.from("notifications").insert({
      user_id: cfg.user_id,
      type: "autopay_paused",
      title: "Circle autopay paused",
      body: "We couldn't complete your scheduled circle contribution after several tries. Open the circle to retry.",
      data: { circle_id: cfg.circle_id, config_id: cfg.id },
    });
  }
  return true;
}
