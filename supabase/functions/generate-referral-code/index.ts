// =============================================================================
// generate-referral-code -- Edge Function (Deno runtime)
//
// Called by an authenticated client. Returns the caller's referral code,
// generating one if they don't have one yet. Verify_jwt=true so we trust
// the Supabase Auth JWT for the caller's identity; the row write uses
// the service-role key.
//
// Code format: 8 chars from a 32-char alphabet (A-Z + 2-9 with the
// ambiguous letters/digits removed: 0/O, 1/I, L). That yields
// 32^8 = ~1.1 trillion combinations -- enough headroom for collision
// retries to be extremely rare. On the rare collision we retry up to
// MAX_RETRIES times before surfacing an error.
//
// Concurrency: a second concurrent call for the same user would race
// on the uq_referral_codes_user_id unique constraint. On conflict we
// return the existing row rather than failing -- the desired contract
// is "I have one code, it's stable".
//
// Deploy: supabase functions deploy generate-referral-code
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Removed: 0 O 1 I L -- leaves a clean 32-char alphabet.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;
const MAX_RETRIES = 5;

function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    // Identify caller via the JWT in the Authorization header. anon-key
    // client + Authorization header is the Supabase pattern for
    // server-side getUser().
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Fast path: existing code.
    const { data: existing } = await admin
      .from("referral_codes")
      .select("code, created_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.code) {
      return new Response(
        JSON.stringify({ code: existing.code, created: false, created_at: existing.created_at }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Generate + insert. Retry on unique-violation against the global
    // code uniqueness (separate from the per-user uniqueness).
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const code = randomCode();
      const { error: insErr } = await admin
        .from("referral_codes")
        .insert({ user_id: userId, code });

      if (!insErr) {
        return new Response(
          JSON.stringify({ code, created: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const errCode = (insErr as { code?: string }).code;
      if (errCode === "23505") {
        // Could be either uq_referral_codes_user_id (a race; refetch)
        // or the global code UNIQUE (collision; retry with a new code).
        // Refetch first -- if the per-user row exists now, we win.
        const { data: existedAfterRace } = await admin
          .from("referral_codes")
          .select("code, created_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (existedAfterRace?.code) {
          return new Response(
            JSON.stringify({
              code: existedAfterRace.code,
              created: false,
              created_at: existedAfterRace.created_at,
              note: "race_won_by_other_caller",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        // Otherwise it's the global code collision -- loop with a new
        // code.
        continue;
      }

      // Anything other than 23505 is a real error.
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: `Could not allocate a unique code after ${MAX_RETRIES} retries` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
