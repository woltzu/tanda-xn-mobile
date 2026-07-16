// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: expire-vouches
// ══════════════════════════════════════════════════════════════════════════════
// Purpose: Manual / admin-facing entry point for the expire_vouches() SQL
//          function (mig 339). Flips past-expires_at System A vouches from
//          active to expired, stamps expired_at, and appends an audit row
//          to xnscore_vouch_audit_log per row processed.
//
// Scheduling: The daily automated sweep at 02:00 UTC is wired via pg_cron
//             calling expire_vouches() directly (see mig 339). This EF exists
//             as an on-demand entry point — call it manually to trigger an
//             immediate sweep and get the count back as JSON.
//
// Auth: JWT-verified (default deploy). Uses the service role internally so
//       the RPC's SECURITY DEFINER surface always runs regardless of caller
//       role. If we later want to restrict callers, add a role check on the
//       decoded JWT before invoking the RPC.
//
// Deploy: `supabase functions deploy expire-vouches` (out-of-band from git
//         push). Redeploy any time SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY
//         rotates.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startedAt = new Date().toISOString()

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    console.log('🔵 expire-vouches: invoking expire_vouches() RPC')

    const { data, error } = await supabase.rpc('expire_vouches')

    if (error) {
      console.error('❌ expire-vouches: RPC failed:', error.message)
      return new Response(
        JSON.stringify({
          ok: false,
          error: error.message,
          startedAt,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const completedAt = new Date().toISOString()
    const expiredCount = typeof data === 'number' ? data : 0
    const durationMs =
      new Date(completedAt).getTime() - new Date(startedAt).getTime()

    console.log(
      `✅ expire-vouches: expired ${expiredCount} vouch(es) in ${durationMs}ms`
    )

    return new Response(
      JSON.stringify({
        ok: true,
        expiredCount,
        startedAt,
        completedAt,
        durationMs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('❌ expire-vouches: uncaught error:', message)
    return new Response(
      JSON.stringify({ ok: false, error: message, startedAt }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
