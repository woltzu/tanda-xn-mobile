// ═══════════════════════════════════════════════════════════════════════════
// persona-create-inquiry — Edge Function (Deno runtime)
//
// Creates a Persona Inquiry for the authenticated caller and upserts a
// kyc_verifications row so the DB knows we're mid-flow. Returns the
// inquiryId + sessionToken to the client. The client picks the flow:
//   - Native: hands (inquiryId, sessionToken) to the Persona React
//     Native SDK.
//   - Web: opens hostedUrl in the browser (SDK is native-only).
//
// Deployed WITH --verify-jwt (default) — this is a user-authenticated
// call, not a webhook. The caller's UUID (derived from auth.uid()) is
// what we stamp as reference_id on the Persona side; we NEVER trust a
// body-supplied user_id.
//
// Secrets required (set via `supabase secrets set`):
//   - PERSONA_API_KEY        (from Persona Dashboard)
//   - PERSONA_TEMPLATE_ID    (the verification template UUID)
//
// Schema notes (per mig 152 shape + probe):
//   - kyc_verifications.provider_reference_id: TEXT (we store Persona's
//     inquiry id here for the webhook to key on)
//   - provider_status: mirrors Persona's status text
//   - status: our internal status ('provider_pending' during flow)
//   - initiated_at: set to NOW() on first upsert; preserved on retry
//   - trg_sync_kyc_tier_to_profile handles profile updates when webhook
//     later flips status='approved' — we NEVER write to profiles here.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const personaApiKey = Deno.env.get("PERSONA_API_KEY");
  const personaTemplateId = Deno.env.get("PERSONA_TEMPLATE_ID");

  if (!personaApiKey || !personaTemplateId) {
    console.error("[persona-create-inquiry] missing PERSONA_API_KEY or PERSONA_TEMPLATE_ID");
    return jsonResponse(
      { error: "Persona is not configured on the server. Contact support." },
      500,
    );
  }

  // ─── 1. Auth: derive user_id from JWT, never trust body ────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const authClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await authClient.auth.getUser();
  if (userErr || !user) {
    return jsonResponse(
      { error: "Unauthenticated", detail: userErr?.message },
      401,
    );
  }
  const userId = user.id;

  // ─── 2. Create the Persona Inquiry ─────────────────────────────────────
  // https://docs.withpersona.com/reference/create-an-inquiry
  let personaResponseText = "";
  let personaResponseStatus = 0;
  try {
    const personaRes = await fetch("https://withpersona.com/api/v1/inquiries", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${personaApiKey}`,
        "Content-Type": "application/json",
        "Persona-Version": "2023-01-05",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            "inquiry-template-id": personaTemplateId,
            "reference-id": userId,
          },
        },
      }),
    });
    personaResponseStatus = personaRes.status;
    personaResponseText = await personaRes.text();

    if (!personaRes.ok) {
      console.error(
        "[persona-create-inquiry] Persona API returned",
        personaRes.status,
        personaResponseText.slice(0, 500),
      );
      return jsonResponse(
        {
          error: "Persona rejected the inquiry request. Please try again.",
          detail: personaResponseText.slice(0, 300),
        },
        502,
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[persona-create-inquiry] Persona API network error:", msg);
    return jsonResponse(
      { error: "Could not reach Persona. Please try again.", detail: msg },
      502,
    );
  }

  let personaBody: any;
  try {
    personaBody = JSON.parse(personaResponseText);
  } catch {
    return jsonResponse(
      { error: "Persona returned a malformed response.", detail: personaResponseText.slice(0, 300) },
      502,
    );
  }

  const inquiryId = personaBody?.data?.id as string | undefined;
  const attrs = personaBody?.data?.attributes ?? {};
  const sessionToken = (attrs["session-token"] ?? attrs.sessionToken) as
    | string
    | undefined;
  const providerStatus = (attrs.status as string | undefined) ?? "created";

  if (!inquiryId) {
    console.error("[persona-create-inquiry] Persona response missing data.id:", personaResponseText.slice(0, 500));
    return jsonResponse(
      { error: "Persona response missing inquiry id" },
      502,
    );
  }

  // ─── 3. Upsert kyc_verifications row ──────────────────────────────────
  // Service-role client so RLS doesn't block. onConflict=member_id keeps
  // one row per user — a re-invocation (user restarts flow) replaces
  // provider_reference_id with the new inquiry id.
  const dbClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: upsertErr } = await dbClient
    .from("kyc_verifications")
    .upsert(
      {
        member_id: userId,
        kyc_type: "full",
        provider: "persona",
        provider_inquiry_id: inquiryId,
        provider_reference_id: inquiryId,
        provider_template_id: personaTemplateId,
        provider_status: providerStatus,
        status: "provider_pending",
        initiated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id" },
    );

  if (upsertErr) {
    // Don't block the client from proceeding to the SDK — the Persona
    // Inquiry is already created and the webhook will still fire. But
    // log loudly because it means our record is missing.
    console.error(
      "[persona-create-inquiry] kyc_verifications upsert failed:",
      upsertErr.message,
    );
  }

  // ─── 4. Build hosted URL for web fallback ─────────────────────────────
  // Docs: https://docs.withpersona.com/hosted-flow
  const hostedUrl = sessionToken
    ? `https://withpersona.com/verify?inquiry-id=${encodeURIComponent(inquiryId)}` +
      `&session-token=${encodeURIComponent(sessionToken)}`
    : `https://withpersona.com/verify?inquiry-id=${encodeURIComponent(inquiryId)}`;

  return jsonResponse({
    inquiryId,
    sessionToken: sessionToken ?? null,
    hostedUrl,
    providerStatus,
    referenceId: userId,
  });
});
