// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: xnscore-monthly-recalibration
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Monthly (1st of month, 06:00 UTC) — runs after tenure-bonus has
//           already fired at 00:00 UTC the same day, so tenure_bonus_earned is
//           up to date before the full recompute starts.
// Purpose: Walk every active xn_scores row and call recalculate_full_xnscore
//          to rebuild the factor breakdown from authoritative event tables.
//
// Backend RPC: recalculate_full_xnscore(p_user_id UUID) — added in migration
// 021. Rebuilds the 5 weighted factors from contributions, circles, vouches,
// wallet activity, and disputes; writes total_score + score_tier + factor
// breakdown back to xn_scores and xn_score_breakdown_cache.
//
// This function loops in-band rather than via a server-side
// recalculate_all_xnscores wrapper because the per-user RPC is the canonical
// entry point — wrapping it server-side would duplicate the SECURITY DEFINER
// surface for marginal speed.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Page through xn_scores in batches so a single function invocation
// finishes within the Edge runtime budget even with tens of thousands
// of users. Frozen scores are skipped (recalculating them would clobber
// the freeze).
const BATCH_SIZE = 200

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

    console.log('🔵 xnscore-monthly-recalibration: starting full recompute')

    let totalProcessed = 0
    let totalSucceeded = 0
    let totalFailed = 0
    let pageStart = 0
    let lastUserId: string | null = null

    while (true) {
      let q = supabase
        .from('xn_scores')
        .select('user_id')
        .eq('score_frozen', false)
        .order('user_id', { ascending: true })
        .limit(BATCH_SIZE)
      if (lastUserId) q = q.gt('user_id', lastUserId)

      const { data: page, error: pageErr } = await q
      if (pageErr) {
        throw new Error(`xn_scores page read failed at offset ${pageStart}: ${pageErr.message}`)
      }
      if (!page || page.length === 0) break

      for (const row of page) {
        totalProcessed++
        try {
          const { error: rpcErr } = await supabase.rpc('recalculate_full_xnscore', {
            p_user_id: row.user_id,
          })
          if (rpcErr) {
            totalFailed++
            console.warn(`⚠️ recalculate_full_xnscore failed for ${row.user_id}: ${rpcErr.message}`)
            continue
          }
          totalSucceeded++
        } catch (perUserErr: any) {
          totalFailed++
          console.warn(`⚠️ recalculate_full_xnscore threw for ${row.user_id}: ${perUserErr.message}`)
        }
      }

      lastUserId = page[page.length - 1].user_id as string
      pageStart += page.length

      if (page.length < BATCH_SIZE) break
    }

    const elapsed = Date.now() - startTime
    console.log(`✅ xnscore-monthly-recalibration: processed=${totalProcessed} succeeded=${totalSucceeded} failed=${totalFailed} elapsed=${elapsed}ms`)

    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'xnscore-monthly-recalibration',
        status: 'success',
        records_processed: totalProcessed,
        records_succeeded: totalSucceeded,
        records_failed: totalFailed,
        execution_time_ms: elapsed,
        details: { batch_size: BATCH_SIZE },
      })
      .then(() => undefined, () => console.log('⚠️ cron log insert failed (non-fatal)'))

    return new Response(
      JSON.stringify({
        success: true,
        users_processed: totalProcessed,
        users_succeeded: totalSucceeded,
        users_failed: totalFailed,
        execution_time_ms: elapsed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    const elapsed = Date.now() - startTime
    console.error('💥 xnscore-monthly-recalibration fatal:', err.message)
    return new Response(
      JSON.stringify({ success: false, error: err.message, execution_time_ms: elapsed }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
