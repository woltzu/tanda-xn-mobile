// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: xnscore-decay-check
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Weekly (Sunday 00:00 UTC) — wired via pg_cron / scheduled-tasks
// Purpose: Walk every active xn_scores row, apply inactivity decay where a
//          threshold has been crossed (30, 60, 90, 120, 180, 240, 365 days).
//
// Backend RPC: process_all_inactivity_decays() — added in migration 020. The
// RPC already loops over candidate users, computes the per-user threshold,
// applies the decay via apply_xnscore_adjustment (which now respects the
// recovery multiplier — see migration 213), and returns
// { users_processed, users_decayed, total_decay_applied }.
//
// Prior to Bucket C this function duplicated the threshold logic in JS, used
// a different decay schedule than the RPC, and skipped users in recovery via
// a separate query — leaving the schedules out of sync. The thin wrapper
// fixes the drift.
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

  const startTime = Date.now()

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    console.log('🟡 xnscore-decay-check: starting weekly sweep')

    const { data, error } = await supabase.rpc('process_all_inactivity_decays')

    if (error) {
      throw new Error(`process_all_inactivity_decays RPC failed: ${error.message}`)
    }

    // The RPC returns a single row { users_processed, users_decayed, total_decay_applied }.
    const row = Array.isArray(data) ? data[0] : data
    const usersProcessed = Number(row?.users_processed ?? 0)
    const usersDecayed = Number(row?.users_decayed ?? 0)
    const totalDecay = Number(row?.total_decay_applied ?? 0)
    const elapsed = Date.now() - startTime

    console.log(`✅ xnscore-decay-check: processed=${usersProcessed} decayed=${usersDecayed} totalDecay=${totalDecay} elapsed=${elapsed}ms`)

    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'xnscore-decay-check',
        status: 'success',
        records_processed: usersProcessed,
        records_succeeded: usersDecayed,
        records_failed: 0,
        execution_time_ms: elapsed,
        details: { total_decay_applied: totalDecay },
      })
      .then(() => undefined, () => console.log('⚠️ cron log insert failed (non-fatal)'))

    return new Response(
      JSON.stringify({
        success: true,
        users_processed: usersProcessed,
        users_decayed: usersDecayed,
        total_decay_applied: totalDecay,
        execution_time_ms: elapsed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    const elapsed = Date.now() - startTime
    console.error('💥 xnscore-decay-check fatal:', err.message)
    return new Response(
      JSON.stringify({ success: false, error: err.message, execution_time_ms: elapsed }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
