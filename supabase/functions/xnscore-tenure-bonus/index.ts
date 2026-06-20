// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: xnscore-tenure-bonus
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Monthly (1st of month, 00:00 UTC) — wired via pg_cron / scheduled-tasks
// Purpose: Award the +1/month tenure bonus to every eligible active user.
//
// Backend RPC: process_all_tenure_bonuses() — added in migration 020. The RPC
// gates on financial activity (must have ≥1 contribution in the last 30 days),
// the +25 cap, the per-month uniqueness constraint
// (xnscore_tenure_history.unique_user_tenure_month), and the recovery
// multiplier (1.5× for users in a recovery period). Returns
// { users_processed, users_awarded, total_bonus_applied }.
//
// Prior to Bucket C this function inserted tenure history rows directly with
// the wrong column names (tenure_month TEXT vs INTEGER, months_at_bonus which
// does not exist) and used its own bonus tier table that did not match the
// per-month schedule the RPC enforces. The thin wrapper fixes the drift.
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

    console.log('🟢 xnscore-tenure-bonus: starting monthly sweep')

    const { data, error } = await supabase.rpc('process_all_tenure_bonuses')

    if (error) {
      throw new Error(`process_all_tenure_bonuses RPC failed: ${error.message}`)
    }

    const row = Array.isArray(data) ? data[0] : data
    const usersProcessed = Number(row?.users_processed ?? 0)
    const usersAwarded = Number(row?.users_awarded ?? 0)
    const totalBonus = Number(row?.total_bonus_applied ?? 0)
    const elapsed = Date.now() - startTime

    console.log(`✅ xnscore-tenure-bonus: processed=${usersProcessed} awarded=${usersAwarded} totalBonus=${totalBonus} elapsed=${elapsed}ms`)

    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'xnscore-tenure-bonus',
        status: 'success',
        records_processed: usersProcessed,
        records_succeeded: usersAwarded,
        records_failed: 0,
        execution_time_ms: elapsed,
        details: { total_bonus_applied: totalBonus },
      })
      .then(() => undefined, () => console.log('⚠️ cron log insert failed (non-fatal)'))

    return new Response(
      JSON.stringify({
        success: true,
        users_processed: usersProcessed,
        users_awarded: usersAwarded,
        total_bonus_applied: totalBonus,
        execution_time_ms: elapsed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    const elapsed = Date.now() - startTime
    console.error('💥 xnscore-tenure-bonus fatal:', err.message)
    return new Response(
      JSON.stringify({ success: false, error: err.message, execution_time_ms: elapsed }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
