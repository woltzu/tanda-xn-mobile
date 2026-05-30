// ═══════════════════════════════════════════════════════════════════════════
// stripe-attach-bank-payment-method — Edge Function (Deno runtime)
//
// Companion to stripe-create-bank-session. After the user links a bank
// account in the Stripe Financial Connections sheet, the mobile client
// passes the sessionId back here. We:
//
//   1. Retrieve the session (with expanded `accounts`) and verify it
//      belongs to the caller's stripe_customer.
//   2. For each linked FC account, create a Stripe PaymentMethod of
//      type 'us_bank_account' referencing the financial_connections_account.
//   3. Attach the PaymentMethod to the customer (so it can be used as
//      payment_method on a PaymentIntent later).
//   4. Upsert a row into stripe_bank_accounts so the client can list the
//      linked bank without round-tripping Stripe on every render.
//
// Idempotency:
//   stripe_bank_accounts.stripe_payment_method_id is UNIQUE; we upsert
//   on that key so re-running the attach for the same session is safe.
//   (Stripe.paymentMethods.create with an FC account already returns the
//   existing PM for a previously-converted account, so we don't pile up
//   duplicate PaymentMethods either.)
//
// Auth model: same as the rest of the Stripe edge functions in this
// project — JWT for identity, service role for DB writes.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // ─── 1. Auth ───
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

  // ─── 2. Parse body ───
  let body: { sessionId?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!sessionId) {
    return jsonResponse({ error: "sessionId is required" }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  // ─── 3. Resolve the caller's Stripe customer (no auto-create here — the
  //        session-create endpoint is responsible for that). ───
  const { data: custRow, error: custErr } = await serviceClient
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("member_id", user.id)
    .maybeSingle();
  if (custErr) {
    return jsonResponse({ error: "Failed to look up customer", detail: custErr.message }, 500);
  }
  if (!custRow?.stripe_customer_id) {
    return jsonResponse(
      { error: "No Stripe customer for user — open a bank session first to create one" },
      404
    );
  }
  const customerId = custRow.stripe_customer_id;

  // ─── 4. Retrieve the session and verify ownership ───
  let session: Stripe.FinancialConnections.Session;
  try {
    session = await stripe.financialConnections.sessions.retrieve(sessionId, {
      expand: ["accounts"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stripe-attach-bank-payment-method] session retrieve failed:", msg);
    return jsonResponse({ error: "Failed to retrieve FC session", detail: msg }, 502);
  }

  // account_holder.customer is the Stripe customer id the session was
  // created for. Confirm it matches the caller's customer so a sniffed
  // sessionId can't be used to attach someone else's bank.
  const sessionHolder = session.account_holder as
    | { type: string; customer?: string }
    | null;
  if (sessionHolder?.customer && sessionHolder.customer !== customerId) {
    return jsonResponse(
      { error: "Session does not belong to this user" },
      403
    );
  }

  const accounts = session.accounts?.data ?? [];
  if (accounts.length === 0) {
    return jsonResponse(
      { error: "No accounts were linked in this Financial Connections session" },
      400
    );
  }

  // ─── 5. For each linked FC account: create PaymentMethod, attach, upsert ──
  const created: Array<{
    paymentMethodId: string;
    bankName: string | null;
    last4: string | null;
  }> = [];
  const errors: string[] = [];

  for (const acct of accounts) {
    try {
      // Create payment method from the FC account.
      const pm = await stripe.paymentMethods.create({
        type: "us_bank_account",
        us_bank_account: { financial_connections_account: acct.id },
      });

      // Attach to the customer so subsequent PaymentIntents can reference it.
      // attach() is idempotent for an already-attached PM (returns the PM).
      await stripe.paymentMethods.attach(pm.id, { customer: customerId });

      // Best-effort metadata extraction. Stripe's typing on us_bank_account
      // is narrow; we read defensively.
      const usBank = pm.us_bank_account as
        | { last4?: string; bank_name?: string; account_holder_name?: string }
        | null;
      const last4 = usBank?.last4 ?? (acct as unknown as { last4?: string }).last4 ?? null;
      const bankName =
        usBank?.bank_name ??
        (acct as unknown as { institution_name?: string }).institution_name ??
        null;
      const holderName = usBank?.account_holder_name ?? null;

      // Upsert keyed on stripe_payment_method_id (UNIQUE in the table) so
      // re-linking the same bank account doesn't pile up duplicate rows.
      const { error: upsertErr } = await serviceClient
        .from("stripe_bank_accounts")
        .upsert(
          {
            user_id: user.id,
            stripe_payment_method_id: pm.id,
            stripe_financial_connections_account_id: acct.id,
            bank_name: bankName,
            last4,
            account_holder_name: holderName,
            status: "active",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_payment_method_id" }
        );
      if (upsertErr) {
        // PaymentMethod is attached on Stripe but the local row failed.
        // Log + collect — we still return the PM id so the client knows.
        console.error(
          "[stripe-attach-bank-payment-method] DB upsert failed for PM",
          pm.id,
          ":",
          upsertErr.message
        );
        errors.push(`DB upsert failed for ${pm.id}: ${upsertErr.message}`);
      }

      created.push({ paymentMethodId: pm.id, bankName, last4 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        "[stripe-attach-bank-payment-method] failed for FC account",
        acct.id,
        ":",
        msg
      );
      errors.push(`Failed for FC account ${acct.id}: ${msg}`);
    }
  }

  if (created.length === 0) {
    return jsonResponse(
      {
        success: false,
        error: "No bank accounts could be attached",
        detail: errors,
      },
      502
    );
  }

  return jsonResponse({
    success: true,
    accounts: created,
    ...(errors.length > 0 ? { partial_errors: errors } : {}),
  });
});
