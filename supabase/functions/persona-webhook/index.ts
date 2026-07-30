// ═══════════════════════════════════════════════════════════════════════════
// persona-webhook — Edge Function (Deno runtime)
//
// Receives Persona webhook deliveries. Verifies the HMAC signature
// FIRST — before parsing or trusting any body content — using Deno's
// Web Crypto (constant-time compare). Persona's signature scheme:
//   Persona-Signature: t=<unix_ts>,v1=<hex_hmac_sha256("<t>.<rawBody>")>
//
// Handles:
//   - inquiry.approved  → kyc_verifications.status = 'approved' +
//                         populates extracted_* columns from included
//                         document verification data
//   - inquiry.declined  → kyc_verifications.status = 'rejected'
//   - inquiry.failed    → kyc_verifications.status = 'rejected'
//   - inquiry.expired   → kyc_verifications.status = 'rejected'
//   - inquiry.marked-for-review → status = 'manual_review'
//   - (other events)    → ledger-only, no state change
//
// Idempotency: the update matches by provider_inquiry_id which is
// unique per Persona Inquiry. Repeat deliveries of the same event just
// re-set the same fields — no-op if already applied.
//
// Deployed with --no-verify-jwt (Persona doesn't send a Supabase JWT;
// the HMAC signature IS the authentication).
//
// Schema notes:
//   - NEVER writes to profiles directly. The existing
//     trg_sync_kyc_tier_to_profile trigger on kyc_verifications flips
//     profile-side state when status='approved'. Bypassing the trigger
//     would create diverging state.
//   - provider_response JSONB stores the raw webhook payload for audit.
//   - extracted_full_name / extracted_dob / extracted_address /
//     extracted_document_number are extracted from included verification
//     records where possible; unavailable fields stay NULL.
//
// Secrets required:
//   - PERSONA_WEBHOOK_SECRET (from Persona Dashboard, HMAC secret)
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

// ─── HMAC signature verification (Web Crypto, constant-time) ───────────
async function verifyPersonaSignature(
  rawBody: string,
  header: string,
  secret: string,
): Promise<boolean> {
  // Header format: t=<unix_seconds>,v1=<hex>
  const parts = header.split(",").map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Part = parts.find((p) => p.startsWith("v1="));
  if (!tPart || !v1Part) return false;

  const t = tPart.slice(2);
  const providedSig = v1Part.slice(3).toLowerCase();

  const message = `${t}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare — length check first, then XOR bitwise-OR.
  if (expected.length !== providedSig.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ providedSig.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Extract a scalar field from Persona's included[] JSON:API blob ────
// Persona includes verification records (verification/government-id,
// verification/selfie, etc.) with attributes like:
//   { "name-first": "Jane", "name-last": "Doe", "birthdate": "1990-01-01",
//     "address-street-1": "...", "identification-number": "..." }
// We collapse across all included records, latest write wins.
function pickExtracted(included: any[]): {
  full_name: string | null;
  dob: string | null;
  address: string | null;
  document_number: string | null;
} {
  let firstName: string | null = null;
  let lastName: string | null = null;
  let dob: string | null = null;
  let street1: string | null = null;
  let street2: string | null = null;
  let city: string | null = null;
  let subdivision: string | null = null;
  let postalCode: string | null = null;
  let country: string | null = null;
  let docNumber: string | null = null;

  for (const item of included ?? []) {
    if (typeof item !== "object" || !item) continue;
    const type = String(item.type ?? "");
    if (!type.startsWith("verification/") && type !== "inquiry") continue;
    const a = item.attributes ?? {};
    firstName = firstName ?? a["name-first"] ?? a["nameFirst"] ?? null;
    lastName = lastName ?? a["name-last"] ?? a["nameLast"] ?? null;
    dob = dob ?? a["birthdate"] ?? null;
    street1 = street1 ?? a["address-street-1"] ?? a["addressStreet1"] ?? null;
    street2 = street2 ?? a["address-street-2"] ?? a["addressStreet2"] ?? null;
    city = city ?? a["address-city"] ?? a["addressCity"] ?? null;
    subdivision = subdivision ?? a["address-subdivision"] ?? a["addressSubdivision"] ?? null;
    postalCode = postalCode ?? a["address-postal-code"] ?? a["addressPostalCode"] ?? null;
    country = country ?? a["address-country-code"] ?? a["countryCode"] ?? null;
    docNumber = docNumber ?? a["identification-number"] ?? a["identificationNumber"] ?? null;
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  const addressParts = [street1, street2, city, subdivision, postalCode, country]
    .filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ") : null;

  return { full_name: fullName, dob, address, document_number: docNumber };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const signature = req.headers.get("Persona-Signature");
  const secret = Deno.env.get("PERSONA_WEBHOOK_SECRET");

  if (!secret) {
    console.error("[persona-webhook] PERSONA_WEBHOOK_SECRET not configured");
    return jsonResponse({ error: "Server misconfigured" }, 500);
  }
  if (!signature) {
    console.warn("[persona-webhook] request missing Persona-Signature header");
    return jsonResponse({ error: "Missing signature" }, 401);
  }

  const rawBody = await req.text();
  const validSig = await verifyPersonaSignature(rawBody, signature, secret);
  if (!validSig) {
    console.warn("[persona-webhook] HMAC verification failed");
    return jsonResponse({ error: "Invalid signature" }, 401);
  }

  // ─── Signature verified — safe to trust the payload now ──────────────
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    console.error("[persona-webhook] malformed JSON:", e);
    return jsonResponse({ error: "Malformed JSON" }, 400);
  }

  const eventName = payload?.data?.attributes?.name as string | undefined;
  const payloadData = payload?.data?.attributes?.payload?.data ?? {};
  const inquiryId = payloadData?.id as string | undefined;
  const inquiryAttrs = payloadData?.attributes ?? {};
  const providerStatus = inquiryAttrs.status as string | undefined;
  const referenceId = (inquiryAttrs["reference-id"] ??
    inquiryAttrs.referenceId) as string | undefined;
  const included = payload?.data?.attributes?.payload?.included ?? [];

  if (!inquiryId || !referenceId) {
    console.warn(
      "[persona-webhook] event missing inquiry id or reference id:",
      eventName,
      "inquiry=", inquiryId, "ref=", referenceId,
    );
    // 200 so Persona doesn't retry a forensic-only event
    return jsonResponse({ received: true, skipped: "missing_ids" });
  }

  // Map Persona event / status → our internal status
  // - inquiry.approved  → 'approved'
  // - inquiry.declined / .failed / .expired → 'rejected'
  // - inquiry.marked-for-review → 'manual_review'
  // - anything else (e.g. .created, .started, .completed) → no-op
  let internalStatus: "approved" | "rejected" | "manual_review" | null = null;
  let adminNote: string | null = null;

  if (eventName === "inquiry.approved" || providerStatus === "approved") {
    internalStatus = "approved";
  } else if (
    eventName === "inquiry.declined" ||
    eventName === "inquiry.failed" ||
    eventName === "inquiry.expired" ||
    providerStatus === "declined" ||
    providerStatus === "failed" ||
    providerStatus === "expired"
  ) {
    internalStatus = "rejected";
    adminNote = "Persona verification " + (providerStatus ?? eventName ?? "unknown");
  } else if (
    eventName === "inquiry.marked-for-review" ||
    providerStatus === "needs_review"
  ) {
    internalStatus = "manual_review";
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Baseline UPDATE that always runs: refresh provider_status +
  // provider_response for audit. NEVER writes to profiles — the
  // trg_sync_kyc_tier_to_profile trigger handles that when status
  // flips to 'approved'.
  const baseUpdate: Record<string, unknown> = {
    provider_status: providerStatus ?? null,
    provider_response: payload,
    updated_at: new Date().toISOString(),
  };

  if (internalStatus === "approved") {
    const extracted = pickExtracted(included);
    baseUpdate.status = "approved";
    baseUpdate.completed_at = new Date().toISOString();
    baseUpdate.extracted_full_name = extracted.full_name;
    baseUpdate.extracted_dob = extracted.dob;
    baseUpdate.extracted_address = extracted.address;
    baseUpdate.extracted_document_number = extracted.document_number;
    baseUpdate.admin_notes = null;
  } else if (internalStatus === "rejected") {
    baseUpdate.status = "rejected";
    baseUpdate.completed_at = new Date().toISOString();
    baseUpdate.admin_notes = adminNote;
  } else if (internalStatus === "manual_review") {
    baseUpdate.status = "manual_review";
    baseUpdate.admin_notes = "Persona flagged for manual review";
  }

  const { error: updErr, count } = await supabase
    .from("kyc_verifications")
    .update(baseUpdate, { count: "exact" })
    .eq("provider_inquiry_id", inquiryId);

  if (updErr) {
    console.error(
      "[persona-webhook] kyc_verifications update failed:",
      updErr.message,
    );
    return jsonResponse(
      { error: "DB update failed", detail: updErr.message },
      500,
    );
  }

  if (count === 0) {
    // No matching row — likely the create-inquiry EF failed to upsert
    // earlier, or Persona sent an event for an inquiry we don't know
    // about. Fall back to matching by member_id (reference_id) so the
    // user still gets the status flip. If that also finds nothing,
    // insert a fresh row so we at least have a record.
    const { error: fallbackErr, count: fbCount } = await supabase
      .from("kyc_verifications")
      .update(baseUpdate, { count: "exact" })
      .eq("member_id", referenceId);

    if (fallbackErr) {
      console.error(
        "[persona-webhook] fallback update failed:",
        fallbackErr.message,
      );
    } else if (fbCount === 0) {
      // Truly no record — insert one so the webhook doesn't silently drop.
      const { error: insErr } = await supabase
        .from("kyc_verifications")
        .insert({
          member_id: referenceId,
          kyc_type: "full",
          provider: "persona",
          provider_inquiry_id: inquiryId,
          provider_reference_id: inquiryId,
          provider_status: providerStatus,
          provider_response: payload,
          status: internalStatus ?? "provider_pending",
          admin_notes: adminNote,
          initiated_at: new Date().toISOString(),
        });
      if (insErr) {
        console.error(
          "[persona-webhook] backfill insert failed:",
          insErr.message,
        );
      }
    }
  }

  return jsonResponse({
    received: true,
    inquiry_id: inquiryId,
    reference_id: referenceId,
    event: eventName,
    internal_status: internalStatus,
  });
});
