// ═══════════════════════════════════════════════════════════════════════════
// release-trip-funds — Edge Function (Deno runtime)
//
// Organizer-triggered release of held trip payments to the organizer's
// Stripe Connect account. Pairs with migration 271 (trips.confirmed_at,
// trip_payments.transfer_id, can_confirm_trip RPC).
//
// Flow:
//   1. Verify caller's JWT, derive user_id. NEVER trust user_id from
//      the body — that's a forgery vector and the spec sample had it.
//   2. Call can_confirm_trip RPC to gate on confirmed_at IS NULL,
//      start_date within 60 days, organizer has Stripe Connect, and at
//      least one succeeded PI not yet released. Also returns gross_cents.
//   3. Verify caller IS the organizer (RPC doesn't check this — anyone
//      could call it for any trip and learn aggregate dollars).
//   4. Re-fetch funded PIs server-side and sum amount_cents (FOR UPDATE
//      semantics aren't free in Postgres without a transaction; we
//      rely on the transfer_id NULL filter + idempotency_key on the
//      Stripe Transfer to make double-release safe).
//   5. Compute 2 % platform fee, issue a Stripe Transfer to the
//      organizer's connected account.
//   6. Stamp trips.confirmed_at + trip_payments.transfer_id on every
//      released payment in a single round-trip.
//
// Deploy WITH JWT verification (no --no-verify-jwt — the EF needs the
// auth header to derive the organizer identity).
// ═══════════════════════════════════════════════════════════════════════════

import Stripe from "npm:stripe@^17";
import { createClient } from "npm:@supabase/supabase-js@^2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PLATFORM_FEE_BPS = 200; // 2 % expressed as basis points

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ─── 1. Auth ──────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }
  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await authClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse({ error: "Unauthenticated", detail: userErr?.message }, 401);
  }

  // ─── 2. Parse body ────────────────────────────────────────────────────
  let trip_id: string | undefined;
  try {
    const body = await req.json();
    trip_id = typeof body.trip_id === "string" ? body.trip_id : undefined;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!trip_id || !UUID_RE.test(trip_id)) {
    return jsonResponse({ error: "trip_id must be a valid UUID" }, 400);
  }

  const service = createClient(supabaseUrl, serviceRoleKey);

  // ─── 3. Verify organizer + load destination account ───────────────────
  const { data: trip, error: tripErr } = await service
    .from("trips")
    .select(
      "id, organizer_id, start_date, confirmed_at, organizer:organizer_id(stripe_connect_account_id)",
    )
    .eq("id", trip_id)
    .maybeSingle();
  if (tripErr || !trip) {
    return jsonResponse({ error: "Trip not found", detail: tripErr?.message }, 404);
  }
  if ((trip as { organizer_id: string }).organizer_id !== user.id) {
    return jsonResponse({ error: "Only the organizer can release funds" }, 403);
  }
  if ((trip as { confirmed_at: string | null }).confirmed_at) {
    return jsonResponse({ error: "Trip already confirmed" }, 409);
  }
  const stripeAcct = (trip as {
    organizer?: { stripe_connect_account_id?: string | null } | null;
  }).organizer?.stripe_connect_account_id ?? null;
  if (!stripeAcct) {
    return jsonResponse(
      { error: "Organizer has no Stripe Connect account" },
      400,
    );
  }

  // ─── 4. Eligibility check via RPC (window + funded check) ─────────────
  const { data: eligibility, error: eligErr } = await service.rpc(
    "can_confirm_trip",
    { p_trip_id: trip_id },
  );
  if (eligErr) {
    return jsonResponse(
      { error: "Eligibility check failed", detail: eligErr.message },
      500,
    );
  }
  const elig = (eligibility ?? {}) as {
    eligible?: boolean;
    reason?: string;
    gross_cents?: number;
    days_until?: number;
  };
  if (!elig.eligible) {
    return jsonResponse(
      { error: "Not eligible to confirm", reason: elig.reason ?? "unknown" },
      400,
    );
  }

  // ─── 5. Pull funded PIs server-side (RPC's sum is preview-only) ───────
  const { data: piRows, error: piErr } = await service
    .from("stripe_payment_intents")
    .select("stripe_payment_intent_id, amount_cents")
    .eq("status", "succeeded")
    .filter("metadata->>trip_id", "eq", trip_id);
  if (piErr) {
    return jsonResponse(
      { error: "Failed to load payment intents", detail: piErr.message },
      500,
    );
  }

  // Exclude PIs already linked to a transferred trip_payments row. We do
  // this in app-space because Supabase's PostgREST doesn't express the
  // NOT EXISTS join cleanly; the canonical guard is the RPC's matching
  // filter above so this is belt-and-braces.
  const piIds = (piRows ?? []).map((r) => r.stripe_payment_intent_id);
  const { data: alreadyXfer, error: xferErr } = await service
    .from("trip_payments")
    .select("stripe_payment_intent_id")
    .in("stripe_payment_intent_id", piIds.length ? piIds : ["__none__"])
    .not("transfer_id", "is", null);
  if (xferErr) {
    return jsonResponse(
      { error: "Failed to check existing transfers", detail: xferErr.message },
      500,
    );
  }
  const skipSet = new Set(
    (alreadyXfer ?? []).map((r) => r.stripe_payment_intent_id),
  );
  const releasePis = (piRows ?? []).filter(
    (r) => !skipSet.has(r.stripe_payment_intent_id),
  );
  if (releasePis.length === 0) {
    return jsonResponse(
      { error: "No pending payments to release", reason: "no_payments" },
      400,
    );
  }
  const grossCents = releasePis.reduce(
    (sum, r) => sum + (r.amount_cents ?? 0),
    0,
  );
  const feeCents = Math.round((grossCents * PLATFORM_FEE_BPS) / 10000);
  const netCents = grossCents - feeCents;

  // ─── Reconciliation ledger (migration 276): record pending transfer ───
  // Written BEFORE the Stripe call so an EF crash or Stripe error still
  // leaves a forensic trail. client_reference_id is deterministic on
  // trip_id (same as the Stripe idempotency key) — a re-run by the same
  // organizer is a UNIQUE no-op rather than a duplicate insert.
  const clientReferenceId = `client_ref_release_${trip_id}`;
  const { error: pendingErr } = await service.from("pending_intents").insert({
    client_reference_id: clientReferenceId,
    user_id: null,
    recipient_user_id: user.id,
    trip_id,
    intent_type: "transfer",
    amount_cents: netCents,
    currency: "USD",
    metadata: {
      gross_cents: grossCents,
      fee_cents: feeCents,
      payment_count: releasePis.length,
      destination_account: stripeAcct,
    },
  });
  if (pendingErr) {
    const isDup =
      pendingErr.code === "23505" ||
      /duplicate key|already exists/i.test(pendingErr.message);
    if (!isDup) {
      console.error(
        "[release-trip-funds] pending_intents insert failed:",
        pendingErr.message,
      );
      return jsonResponse(
        { error: "Failed to record pending intent", detail: pendingErr.message },
        500,
      );
    }
    console.log(
      "[release-trip-funds] pending_intents idempotent replay for",
      clientReferenceId,
    );
  }

  // ─── 6. Create the Stripe Transfer (idempotent on trip_id) ────────────
  let transfer: Stripe.Transfer;
  try {
    transfer = await stripe.transfers.create(
      {
        amount: netCents,
        currency: "usd",
        destination: stripeAcct,
        transfer_group: `trip_${trip_id}`,
        description: `Trip confirmation release for ${trip_id}`,
        metadata: {
          trip_id,
          organizer_id: user.id,
          gross_cents: String(grossCents),
          fee_cents: String(feeCents),
          client_reference_id: clientReferenceId,
        },
      },
      { idempotencyKey: `release-${trip_id}` },
    );
  } catch (e) {
    return jsonResponse(
      { error: "Stripe transfer failed", detail: (e as Error).message },
      502,
    );
  }

  // ─── 7. Stamp DB: trips.confirmed_at + trip_payments.transfer_id ──────
  const confirmedAt = new Date().toISOString();
  const { error: confirmErr } = await service
    .from("trips")
    .update({ confirmed_at: confirmedAt })
    .eq("id", trip_id);
  if (confirmErr) {
    console.error(
      "[release-trip-funds] WARNING — transfer succeeded but trips.confirmed_at write failed:",
      transfer.id,
      confirmErr.message,
    );
  }

  const { error: tpErr } = await service
    .from("trip_payments")
    .update({ transfer_id: transfer.id })
    .in(
      "stripe_payment_intent_id",
      releasePis.map((r) => r.stripe_payment_intent_id),
    );
  if (tpErr) {
    console.error(
      "[release-trip-funds] WARNING — transfer_id stamp failed for transfer",
      transfer.id,
      ":",
      tpErr.message,
    );
  }

  return jsonResponse({
    transfer_id: transfer.id,
    confirmed_at: confirmedAt,
    gross_cents: grossCents,
    fee_cents: feeCents,
    net_cents: netCents,
    payment_count: releasePis.length,
  });
});
