// Standard CORS headers for Supabase Edge Functions.
// Used by every function we expose to the mobile client (POST + OPTIONS preflight).
// `*` origin is fine for our case because all callers are authenticated via JWT
// in the Authorization header — same pattern used in the Supabase EF docs.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
