// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: scoring-pipeline-daily
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 03:00 UTC (via pg_cron)
// Purpose: Orchestrate the full scoring pipeline:
//   1. Recompute member behavioral profiles
//   2. Compute default probabilities
//   3. Compute circle health scores
//   4. Recalculate XnScores
//   5. Evaluate score-based alerts
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

    const processingTimeMs = Date.now() - startTime
    const totalRecords = (data.profiles || 0) + (data.default_probs || 0) +
                         (data.circles || 0) + (data.xnscores || 0)
    const hasErrors = data.errors && data.errors.length > 0

    // Log to cron_job_logs
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
          profiles: data.profiles,
          default_probs: data.default_probs,
          circles: data.circles,
          xnscores: data.xnscores,
          alerts: data.alerts,
          pipeline_duration_ms: data.duration_ms,
          date: new Date().toISOString().split('T')[0]
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
