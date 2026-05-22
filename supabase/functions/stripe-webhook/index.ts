// ═══════════════════════════════════════════════════════════════════════════
// stripe-webhook — Edge Function (Deno runtime)
//
// Receives Stripe webhook deliveries, verifies the signature, mirrors the
// event into stripe_webhook_events, and (for payment_intent.* events)
// updates stripe_payment_intents.status.
//
// Deployed with --no-verify-jwt because Stripe doesn't send a Supabase JWT.
// The Stripe-Signature header IS the authentication — without a valid
// signature we 400 immediately.
//
// Idempotency:
//   - stripe_event_id is UNIQUE. Stripe retries up to ~3 days. On any retry,
//     the INSERT errors with duplicate-key — we treat that as "already
//     handled" and 200 to stop retries.
//
// Schema notes (verified against live DB 2026-05-21):
//   - payload JSONB NOT NULL → we store the full event object
//   - processed BOOLEAN DEFAULT false → flipped to true on success
//   - processing_error TEXT → set if our handler fails
//   - livemode BOOLEAN DEFAULT false → mirrored from event.livemode
//   - api_version TEXT → mirrored from event.api_version
//   - created_at default now() — we omit
//   - We do NOT set related_payment_intent_id (would require a lookup;
//     stripe_payment_intent_id in the payload is enough for the smoke test)
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const PI_STATUSES = new Set([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "requires_capture",
  "canceled",
  "succeeded",
  "failed",
]);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ─── 1. Verify Stripe signature ───
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response("Missing Stripe-Signature header", { status: 400 });
  }

  const rawBody = await req.text(); // MUST read raw text for signature verification
  let event: Stripe.Event;
  try {
    // constructEventAsync is required on Deno (uses Web Crypto under the hood
    // — the sync version relies on Node crypto and throws on Deno).
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-webhook] signature verification failed:", msg);
    return new Response(`Signature verification failed: ${msg}`, {
      status: 400,
    });
  }

  // ─── 2. Process the event (update PI status if applicable) ───
  // We do the update FIRST so the retry story is clean: if the update
  // fails we 500 and Stripe retries. The webhook row insert below is
  // a separate concern.
  let processingError: string | null = null;

  if (event.type.startsWith("payment_intent.")) {
    const pi = event.data.object as Stripe.PaymentIntent;
    if (!PI_STATUSES.has(pi.status)) {
      console.warn(
        "[stripe-webhook] unrecognized PI status",
        pi.status,
        "for",
        pi.id
      );
    }

    const { error: updErr, count } = await supabase
      .from("stripe_payment_intents")
      .update(
        {
          status: pi.status,
          updated_at: new Date().toISOString(),
          // Capture failure details if Stripe sent them
          failure_code: pi.last_payment_error?.code ?? null,
          failure_message: pi.last_payment_error?.message ?? null,
        },
        { count: "exact" }
      )
      .eq("stripe_payment_intent_id", pi.id);

    if (updErr) {
      processingError = `PI update failed: ${updErr.message}`;
      console.error("[stripe-webhook]", processingError);
    } else if (count === 0) {
      // PI not in our DB — could be a race (webhook arrived before
      // create-payment-intent's INSERT committed) or an event for a PI
      // we never recorded. Log but don't fail — the webhook row below
      // still captures the event for forensic purposes.
      console.warn(
        "[stripe-webhook] no matching PI row for",
        pi.id,
        "— event recorded but not applied"
      );
    }
  } else {
    console.log("[stripe-webhook] ignoring non-PI event", event.type);
  }

  // ─── 3. Record the event in stripe_webhook_events ───
  const { error: insErr } = await supabase.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    api_version: event.api_version,
    livemode: event.livemode,
    payload: event as unknown,
    processed: processingError === null,
    processed_at: new Date().toISOString(),
    processing_error: processingError,
  });

  if (insErr) {
    // UNIQUE violation on stripe_event_id means this is a Stripe retry of
    // an event we've already recorded. 200 OK so Stripe stops retrying.
    const isDuplicate =
      insErr.code === "23505" ||
      /duplicate key|already exists/i.test(insErr.message);
    if (isDuplicate) {
      console.log("[stripe-webhook] duplicate event", event.id, "— ack");
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error(
      "[stripe-webhook] event insert failed for",
      event.id,
      ":",
      insErr.message
    );
    return new Response(
      `Failed to record webhook event: ${insErr.message}`,
      { status: 500 }
    );
  }

  // ─── 4. Return success ───
  // If processingError is non-null, the event was recorded but our handler
  // failed. We return 500 so Stripe retries — the next retry will hit the
  // duplicate-event path above and we'll need manual intervention to
  // re-process. (Acceptable for a smoke test; real Path B should make
  // event processing retry-safe.)
  if (processingError) {
    return new Response(`Processed with error: ${processingError}`, {
      status: 500,
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
