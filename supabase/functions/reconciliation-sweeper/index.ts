// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: reconciliation-sweeper
// ══════════════════════════════════════════════════════════════════════════════
// Purpose: hourly check that every Stripe money movement has a matching local
// ledger entry, and vice versa. Anomalies land in public.reconciliation_log
// as append/dedupe rows so an ops dashboard can list unresolved breaks at a
// glance.
//
// Two passes:
//
//   PASS A — local cross-checks (no Stripe API calls):
//     1. pending_intents older than 1h with no matching ledger_events
//        (external_reference_type='pending_intent') → 'stale_pending_intent'.
//     2. stripe_payment_intents.status='succeeded' > 1h ago with no matching
//        ledger_events (event_type in payment_intent.succeeded /
//        charge.succeeded, stripe_object_id = pi.id) → 'pi_ledger_missing'.
//
//   PASS B — Stripe API pull (catches "webhook fired but we never got it"):
//     3. Stripe PaymentIntents.list(created={gte: -24h}, status=succeeded)
//        that don't exist in stripe_payment_intents → 'stripe_pi_missing_locally'.
//     4. Stripe Transfers.list(created={gte: -24h}) that don't exist in
//        stripe_transfers → 'stripe_transfer_missing_locally'.
//     5. PIs where Stripe's amount != stripe_payment_intents.amount_cents
//        → 'amount_mismatch'.
//
// Row-level dedupe: reconciliation_log has UNIQUE(discrepancy_type,
// COALESCE(stripe_id, local_id::text)). Repeat sightings of the same
// discrepancy bump last_seen_at + occurrence_count rather than inserting
// a fresh row.
//
// Cron: '0 * * * *' via mig 351.
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — infra.
//   STRIPE_SECRET_KEY                       — required for PASS B.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Scan windows.
const STALE_PENDING_HOURS = 1;          // Pass A.1 grace period
const PI_LEDGER_GAP_HOURS = 1;          // Pass A.2 grace period
const STRIPE_LIST_WINDOW_HOURS = 24;    // Pass B window
const STRIPE_LIST_PAGE_LIMIT = 100;     // Stripe max is 100

type Severity = "info" | "warning" | "critical";

type DiscrepancyType =
  | "stale_pending_intent"
  | "pi_ledger_missing"
  | "stripe_pi_missing_locally"
  | "stripe_transfer_missing_locally"
  | "amount_mismatch";

const SEVERITY_FOR: Record<DiscrepancyType, Severity> = {
  stale_pending_intent: "warning",
  pi_ledger_missing: "critical",
  stripe_pi_missing_locally: "critical",
  stripe_transfer_missing_locally: "critical",
  amount_mismatch: "critical",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = new Date().toISOString();
  const findings: Record<DiscrepancyType, number> = {
    stale_pending_intent: 0,
    pi_ledger_missing: 0,
    stripe_pi_missing_locally: 0,
    stripe_transfer_missing_locally: 0,
    amount_mismatch: 0,
  };
  const errors: string[] = [];

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Central log-writer with UPSERT-style dedupe.
    const logDiscrepancy = async (
      type: DiscrepancyType,
      stripeId: string | null,
      localId: string | null,
      details: Record<string, unknown>,
    ) => {
      const { error } = await supabase.from("reconciliation_log").upsert(
        {
          run_at: new Date().toISOString(),
          discrepancy_type: type,
          stripe_id: stripeId,
          local_id: localId,
          severity: SEVERITY_FOR[type],
          details,
          last_seen_at: new Date().toISOString(),
          occurrence_count: 1,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "discrepancy_type,stripe_id,local_id",
          // If the row already exists, only bump these fields — leave
          // first_seen_at + resolved + resolution_note alone.
          ignoreDuplicates: false,
        },
      );
      if (error) {
        // Fall back to a manual "check exists → update or insert" pass
        // because the UNIQUE index uses COALESCE(stripe_id, local_id::text),
        // which upsert's onConflict clause can't express directly. This
        // branch handles the actual repeat-sighting bookkeeping.
        await manualUpsertLog(supabase, type, stripeId, localId, details);
      }
      findings[type]++;
    };

    // ── PASS A.1 — stale pending_intents ─────────────────────────────────
    const staleCutoff = new Date(
      Date.now() - STALE_PENDING_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { data: stalePending, error: stalePendingErr } = await supabase
      .from("pending_intents")
      .select("id, client_reference_id, intent_type, amount_cents, created_at, metadata")
      .lt("created_at", staleCutoff)
      .order("created_at", { ascending: true })
      .limit(200);
    if (stalePendingErr) {
      errors.push(`pass_a1_select: ${stalePendingErr.message}`);
    } else {
      for (const pi of stalePending ?? []) {
        // Check whether any ledger_events row resolved this pending_intent.
        // Two possible pointer shapes in the wild:
        //   * external_reference_id = pending_intents.id (uuid)
        //     with external_reference_type in ('pending_intent',
        //     'circle_payout', 'trip').
        //   * Nothing — some flows write ledger_events without the pointer.
        //     Those are visible to the log but we can't cross-match.
        const { count } = await supabase
          .from("ledger_events")
          .select("id", { count: "exact", head: true })
          .eq("external_reference_id", pi.id);
        if ((count ?? 0) === 0) {
          await logDiscrepancy(
            "stale_pending_intent",
            null,
            pi.id,
            {
              client_reference_id: pi.client_reference_id,
              intent_type: pi.intent_type,
              amount_cents: pi.amount_cents,
              created_at: pi.created_at,
              age_hours: hoursSince(pi.created_at),
            },
          );
        }
      }
    }

    // ── PASS A.2 — succeeded PIs with no ledger_events ───────────────────
    const piCutoff = new Date(
      Date.now() - PI_LEDGER_GAP_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const { data: succeededPIs, error: succeededPIsErr } = await supabase
      .from("stripe_payment_intents")
      .select("id, stripe_payment_intent_id, amount_cents, status, updated_at, purpose")
      .eq("status", "succeeded")
      .lt("updated_at", piCutoff)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (succeededPIsErr) {
      errors.push(`pass_a2_select: ${succeededPIsErr.message}`);
    } else {
      for (const pi of succeededPIs ?? []) {
        const { count } = await supabase
          .from("ledger_events")
          .select("id", { count: "exact", head: true })
          .eq("stripe_object_id", pi.stripe_payment_intent_id)
          .in("event_type", ["payment_intent.succeeded", "charge.succeeded"]);
        if ((count ?? 0) === 0) {
          await logDiscrepancy(
            "pi_ledger_missing",
            pi.stripe_payment_intent_id,
            pi.id,
            {
              amount_cents: pi.amount_cents,
              purpose: pi.purpose,
              updated_at: pi.updated_at,
            },
          );
        }
      }
    }

    // ── PASS B — Stripe API cross-check ───────────────────────────────────
    if (!stripeSecret) {
      errors.push("pass_b_skipped: STRIPE_SECRET_KEY not set");
    } else {
      const stripe = new Stripe(stripeSecret, { apiVersion: "2024-11-20.acacia" });
      const scanFromUnix = Math.floor(
        (Date.now() - STRIPE_LIST_WINDOW_HOURS * 60 * 60 * 1000) / 1000,
      );

      // B.3 — Stripe PIs succeeded in last 24h vs local
      try {
        let iterator = stripe.paymentIntents.list({
          created: { gte: scanFromUnix },
          limit: STRIPE_LIST_PAGE_LIMIT,
        });
        for await (const pi of iterator) {
          if (pi.status !== "succeeded" && pi.status !== "processing") continue;
          const { data: local, error: localErr } = await supabase
            .from("stripe_payment_intents")
            .select("id, amount_cents, status")
            .eq("stripe_payment_intent_id", pi.id)
            .maybeSingle();
          if (localErr) {
            errors.push(`pass_b3_local_lookup ${pi.id}: ${localErr.message}`);
            continue;
          }
          if (!local) {
            await logDiscrepancy(
              "stripe_pi_missing_locally",
              pi.id,
              null,
              {
                amount: pi.amount,
                currency: pi.currency,
                status: pi.status,
                created: pi.created,
                customer: pi.customer,
              },
            );
            continue;
          }
          // B.5 — amount mismatch
          if (local.amount_cents !== pi.amount) {
            await logDiscrepancy(
              "amount_mismatch",
              pi.id,
              local.id,
              {
                stripe_amount: pi.amount,
                local_amount_cents: local.amount_cents,
                status: pi.status,
              },
            );
          }
        }
      } catch (e) {
        errors.push(`pass_b3_stripe: ${(e as Error).message ?? "unknown"}`);
      }

      // B.4 — Stripe transfers in last 24h vs local
      try {
        let iterator = stripe.transfers.list({
          created: { gte: scanFromUnix },
          limit: STRIPE_LIST_PAGE_LIMIT,
        });
        for await (const transfer of iterator) {
          const { data: local, error: localErr } = await supabase
            .from("stripe_transfers")
            .select("id")
            .eq("stripe_transfer_id", transfer.id)
            .maybeSingle();
          if (localErr) {
            errors.push(`pass_b4_local_lookup ${transfer.id}: ${localErr.message}`);
            continue;
          }
          if (!local) {
            await logDiscrepancy(
              "stripe_transfer_missing_locally",
              transfer.id,
              null,
              {
                amount: transfer.amount,
                currency: transfer.currency,
                destination: transfer.destination,
                created: transfer.created,
              },
            );
          }
        }
      } catch (e) {
        errors.push(`pass_b4_stripe: ${(e as Error).message ?? "unknown"}`);
      }
    }

    return json({
      ok: errors.length === 0,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      findings,
      errors,
    });
  } catch (e) {
    return json(
      {
        ok: false,
        stage: "exception",
        error: (e as Error)?.message ?? "unknown",
        started_at: startedAt,
      },
      500,
    );
  }
});

// ─── helpers ───────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hoursSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000);
}

// Manual upsert used when supabase-js's `.upsert(..., {onConflict})` can't
// match the COALESCE-based UNIQUE index. Reads the current row (if any),
// then either UPDATEs the sighting fields or INSERTs fresh.
async function manualUpsertLog(
  supabase: ReturnType<typeof createClient>,
  type: DiscrepancyType,
  stripeId: string | null,
  localId: string | null,
  details: Record<string, unknown>,
) {
  let query = supabase
    .from("reconciliation_log")
    .select("id, occurrence_count")
    .eq("discrepancy_type", type);
  query = stripeId ? query.eq("stripe_id", stripeId) : query.is("stripe_id", null);
  query = localId ? query.eq("local_id", localId) : query.is("local_id", null);
  const { data: existing } = await query.maybeSingle();

  if (existing) {
    await supabase
      .from("reconciliation_log")
      .update({
        last_seen_at: new Date().toISOString(),
        occurrence_count: (existing.occurrence_count ?? 1) + 1,
        details, // refresh with latest context
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("reconciliation_log").insert({
      discrepancy_type: type,
      stripe_id: stripeId,
      local_id: localId,
      severity: SEVERITY_FOR[type],
      details,
    });
  }
}
