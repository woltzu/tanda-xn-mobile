// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: scoring-pipeline-daily
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 03:00 UTC (via pg_cron — already scheduled, just needed
//   this EF to actually be deployed at the URL the cron POSTs to).
//
// Purpose: Orchestrate the full scoring pipeline. Wraps run_scoring_pipeline()
// which executes 7 steps (each in its own BEGIN..EXCEPTION block so one bad
// step doesn't kill the run):
//   1. compute_all_member_profiles            → member_behavioral_profiles
//   2. compute_all_default_probabilities       → default_probability_scores
//   3. compute_all_circle_health_scores        → circle_health_scores
//   4. recalculate_all_xn_scores               → xn_scores
//   5. evaluate_score_alerts                   → score_alerts
//   6. compute_all_honor_scores                → honor_scores       [migration 037]
//   7. evaluate_all_member_tiers               → member_tier_status  [migration 040]
//
// Returns JSONB: { run_id, profiles, default_probs, circles, xnscores,
//                  alerts, honor_scores, tiers, duration_ms, errors }
//
// Caveat: xn_scores / circle_health / alerts stay at 0 until
// cycle_contributions populates with real user activity. The pipeline is
// being honest about empty upstream data, not broken.
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    // Initialize Supabase client with service role for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('📊 Starting daily scoring pipeline...')

    // Call the orchestrator SQL function
    const { data, error } = await supabase.rpc('run_scoring_pipeline')

    if (error) {
      throw new Error(`Pipeline RPC failed: ${error.message}`)
    }

    // ── Step 8 (mig 320–322): Circle Reputation per Doc 37 v3 ─────────
    // Additive to the 7-step run_scoring_pipeline above. Loops over
    // every non-cancelled circle and calls refresh_circle_reputation
    // (idempotent — recomputes from source every run). Fresh circles
    // (0 cycles completed) return early with score=null; the RPC
    // handles it. Failures are logged and counted, never thrown — a
    // bad circle mustn't kill the run.
    let reputationSuccess = 0
    let reputationFailed = 0
    let reputationNullCount = 0
    try {
      const { data: circlesToScore, error: circlesFetchErr } = await supabase
        .from('circles')
        .select('id')
        .not('status', 'in', '("cancelled")')
      if (circlesFetchErr) {
        console.error('⚠️ Step 8: failed to fetch circles for reputation:', circlesFetchErr.message)
      } else {
        for (const c of circlesToScore ?? []) {
          const { data: repRes, error: repErr } = await supabase.rpc(
            'refresh_circle_reputation',
            { p_circle_id: (c as { id: string }).id },
          )
          if (repErr) {
            reputationFailed++
            console.error(`⚠️ Step 8: reputation failed for ${(c as any).id}:`, repErr.message)
            continue
          }
          const payload = repRes as { success?: boolean; score?: number | null } | null
          if (payload?.success !== true) {
            reputationFailed++
            continue
          }
          if (payload.score === null) reputationNullCount++
          reputationSuccess++
        }
      }
    } catch (e: any) {
      console.error('⚠️ Step 8: reputation loop threw:', e?.message ?? String(e))
    }
    console.log(`🏷️ Reputation: ${reputationSuccess} updated (${reputationNullCount} null, new circles), ${reputationFailed} failed`)

    const processingTimeMs = Date.now() - startTime
    // Include ALL 7 step outputs. Previous version only summed 4 (profiles,
    // default_probs, circles, xnscores), undercounting by alerts + honor_scores
    // + tiers — the two new steps added by migrations 037 and 040.
    const totalRecords =
      (data.profiles || 0) +
      (data.default_probs || 0) +
      (data.circles || 0) +
      (data.xnscores || 0) +
      (data.alerts || 0) +
      (data.honor_scores || 0) +
      (data.tiers || 0)
    const hasErrors = data.errors && data.errors.length > 0

    // Log to cron_job_logs. Use .then().catch() chain (not .catch() directly
    // on the builder) — the builder is thenable but doesn't expose .catch
    // on itself; on the Promise returned by .then() it works.
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'scoring-pipeline-daily',
        status: hasErrors ? 'partial' : 'success',
        records_processed: totalRecords,
        records_succeeded: totalRecords,
        records_failed: hasErrors ? data.errors.length : 0,
        execution_time_ms: processingTimeMs,
        details: {
          run_id: data.run_id,
          step_counts: {
            profiles: data.profiles,
            default_probs: data.default_probs,
            circle_health: data.circles,
            xnscores: data.xnscores,
            alerts: data.alerts,
            honor_scores: data.honor_scores,   // step 6 (mig 037)
            tiers: data.tiers,                  // step 7 (mig 040)
          },
          pipeline_duration_ms: data.duration_ms,
          date: new Date().toISOString().split('T')[0],
          note: 'xn_scores / circle_health / alerts stay at 0 until cycle_contributions populates with real user activity. Pipeline is honest, not broken.',
        },
        error_message: hasErrors ? JSON.stringify(data.errors) : null
      })
      .then(() => console.log('📝 Job logged'))
      .catch((e: any) => console.log('⚠️ Could not log job:', e.message))

    console.log(`\n🏁 Daily scoring pipeline complete!`)
    console.log(`   📋 Profiles computed: ${data.profiles}`)
    console.log(`   🎯 Default probabilities: ${data.default_probs}`)
    console.log(`   ⭕ Circle health scores: ${data.circles}`)
    console.log(`   ⭐ XnScores recalculated: ${data.xnscores}`)
    console.log(`   🔔 Alerts generated: ${data.alerts}`)
    console.log(`   🎖️ Honor scores: ${data.honor_scores}`)
    console.log(`   🥇 Tiers evaluated: ${data.tiers}`)
    console.log(`   ⏱️ Time: ${processingTimeMs}ms`)
    if (hasErrors) {
      console.log(`   ⚠️ Errors: ${JSON.stringify(data.errors)}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily scoring pipeline completed',
        data,
        processing_time_ms: processingTimeMs
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('💥 Fatal error:', error.message)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processing_time_ms: Date.now() - startTime
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
