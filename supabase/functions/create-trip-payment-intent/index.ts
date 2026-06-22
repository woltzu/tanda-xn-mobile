// ═══════════════════════════════════════════════════════════════════════════
// create-trip-payment-intent — Edge Function (Deno runtime)
//
// Stages a Stripe PaymentIntent for a trip deposit / installment / full
// payment. Bucket A.2 of the trip wizard audit — the wizard previously had
// `trip_payments.stripe_payment_intent_id` as an orphan column with no
// code path actually creating an intent. This EF fills that gap.
//
// Auth: caller's JWT verifies user identity. The trip MUST exist and be
// 'published' (organizers cannot collect on draft trips). We don't gate on
// "must be a participant" because participants can be invited via a public
// slug — the PI creation happens before the trip_participants row, so the
// gate at this layer is just "trip is open for join".
//
// Persistence: PI is written to the existing `stripe_payment_intents`
// registry (NOT trip_payments — that table is participant-keyed and the
// participant row may not exist yet at intent-creation time). The
// webhook (separate Bucket C work) reads metadata.trip_id to fan the
// succeeded event into trip_payments + trip_participants.payment_status.
//
// Purpose values added by migration 237:
//   • 'trip_deposit'        — first-time payment that secures a seat
//   • 'trip_installment'    — N-th scheduled installment
//   • 'trip_full_payment'   — lump-sum payer (or post-deposit balance)
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const TRIP_PURPOSES = new Set([
  "trip_deposit",
  "trip_installment",
  "trip_full_payment",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ─── 1. Auth — verify caller's JWT and extract user_id ──────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: userErr,
  } = await authClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse(
      { error: "Unauthenticated", detail: userErr?.message },
      401,
    );
  }

  // ─── 2. Parse + validate body ───────────────────────────────────────────
  let body: {
    trip_id?: unknown;
    amount?: unknown;
    currency?: unknown;
    purpose?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const tripIdRaw = typeof body.trip_id === "string" ? body.trip_id : "";
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(tripIdRaw)) {
    return jsonResponse(
      { error: "trip_id must be a valid UUID" },
      400,
    );
  }
  const tripId = tripIdRaw;

  const amount = body.amount;
  // Stripe rejects < 50¢ on USD; reject early so the user sees a clear
  // error instead of a 502 from the PI create call.
  if (!Number.isInteger(amount) || (amount as number) < 50) {
    return jsonResponse(
      { error: "amount must be an integer number of cents ≥ 50" },
      400,
    );
  }

  const currency =
    typeof body.currency === "string" ? body.currency.toLowerCase() : "usd";
  const purpose =
    typeof body.purpose === "string" ? body.purpose : "trip_deposit";

  if (!TRIP_PURPOSES.has(purpose)) {
    return jsonResponse(
      { error: `purpose '${purpose}' is not supported by this endpoint` },
      400,
    );
  }

  // ─── 3. Verify the trip exists + is published ───────────────────────────
  // We use the service-role client so the lookup isn't filtered by the
  // caller's participant status — a not-yet-joined invitee is a valid
  // caller here.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: trip, error: tripErr } = await serviceClient
    .from("trips")
    .select("id, status, organizer_id")
    .eq("id", tripId)
    .maybeSingle();
  if (tripErr) {
    console.error("[create-trip-payment-intent] trip lookup failed:", tripErr.message);
    return jsonResponse(
      { error: "Failed to look up trip", detail: tripErr.message },
      500,
    );
  }
  if (!trip) {
    return jsonResponse({ error: "Trip not found" }, 404);
  }
  if (trip.status !== "published") {
    return jsonResponse(
      { error: `Trip is not accepting payments (status: ${trip.status})` },
      409,
    );
  }

  // ─── 4. Create PaymentIntent on Stripe ─────────────────────────────────
  const idempotencyKey = crypto.randomUUID();
  const metadata: Record<string, string> = {
    user_id: user.id,
    type: purpose,
    trip_id: tripId,
    organizer_id: trip.organizer_id,
  };
  const description = `Trip ${purpose} ${tripId}`;

  let intent: Stripe.PaymentIntent;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: amount as number,
        currency,
        metadata,
        description,
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[create-trip-payment-intent] stripe.create failed:", msg);
    return jsonResponse({ error: "Stripe error", detail: msg }, 502);
  }

  // ─── 5. Persist to stripe_payment_intents ──────────────────────────────
  // Mirrors the existing create-payment-intent EF shape so the webhook
  // and queries treat trip PIs identically to wallet/goal PIs. Migration
  // 237 widens the purpose CHECK to admit trip_* values.
  const { error: insErr } = await serviceClient
    .from("stripe_payment_intents")
    .insert({
      stripe_payment_intent_id: intent.id,
      member_id: user.id,
      amount_cents: amount as number,
      currency,
      status: intent.status,
      purpose,
      idempotency_key: idempotencyKey,
      description,
      metadata: intent.metadata,
    });

  if (insErr) {
    console.error(
      "[create-trip-payment-intent] DB insert failed for PI",
      intent.id,
      ":",
      insErr.message,
    );
    return jsonResponse(
      {
        error: "Failed to persist payment intent",
        detail: insErr.message,
        stripe_payment_intent_id: intent.id,
      },
      500,
    );
  }

  // ─── 6. Return clientSecret for mobile PaymentSheet ────────────────────
  return jsonResponse({
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
    amount: amount as number,
    currency,
    purpose,
  });
});
