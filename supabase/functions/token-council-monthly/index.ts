// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: token-council-monthly
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: 1st of every month at 01:00 UTC (via pg_cron)
// Purpose: Award 100 tokens to each active Elder for monthly council participation
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const COUNCIL_MONTHLY_TOKENS = 100
const COUNCIL_EVENT_TYPE = 'council_monthly'

interface ElderAwardResult {
  user_id: string
  full_name: string | null
  tokens_awarded: number
  transaction_id: string | null
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_elders: number
  successful: number
  failed: number
  total_tokens_awarded: number
  processing_time_ms: number
  month: string
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
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const now = new Date()
    const monthLabel = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

    console.log(`🏛️ Starting token council monthly award for ${monthLabel}...`)

    // Query all active Elders via elder_applications with status = 'approved'
    // joined with profiles for name info
    const { data: activeElders, error: eldersError } = await supabase
      .from('elder_applications')
      .select(`
        user_id,
        community_id,
        profiles:user_id (
          id,
          full_name
        )
      `)
      .eq('status', 'approved')

    if (eldersError) {
      throw new Error(`Failed to fetch active elders: ${eldersError.message}`)
    }

    if (!activeElders || activeElders.length === 0) {
      console.log('📭 No active elders to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active elders to process',
          stats: {
            total_elders: 0,
            successful: 0,
            failed: 0,
            total_tokens_awarded: 0,
            processing_time_ms: Date.now() - startTime,
            month: monthLabel,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Deduplicate elders (an elder may be approved in multiple communities)
    const uniqueElderIds = [...new Set(activeElders.map((e) => e.user_id))]

    console.log(`📊 Found ${uniqueElderIds.length} unique active elders (${activeElders.length} total applications)`)

    const results: ElderAwardResult[] = []
    let successCount = 0
    let failCount = 0
    let totalTokensAwarded = 0

    for (const userId of uniqueElderIds) {
      const elderRecord = activeElders.find((e) => e.user_id === userId)
      const profile = elderRecord?.profiles as any
      const fullName = profile?.full_name || null

      try {
        // Call award_tokens() RPC
        const { data: transactionId, error: awardError } = await supabase.rpc('award_tokens', {
          p_user_id: userId,
          p_amount: COUNCIL_MONTHLY_TOKENS,
          p_category: COUNCIL_EVENT_TYPE,
          p_reference_type: null,
          p_reference_id: null,
          p_description: `Monthly council participation tokens for ${monthLabel}`,
        })

        if (awardError) {
          throw new Error(`award_tokens RPC failed: ${awardError.message}`)
        }

        results.push({
          user_id: userId,
          full_name: fullName,
          tokens_awarded: COUNCIL_MONTHLY_TOKENS,
          transaction_id: transactionId,
          success: true,
        })

        totalTokensAwarded += COUNCIL_MONTHLY_TOKENS
        successCount++

        console.log(`✅ Elder ${userId} (${fullName || 'unknown'}): +${COUNCIL_MONTHLY_TOKENS} tokens`)

      } catch (elderError: any) {
        console.error(`❌ Elder ${userId}: ${elderError.message}`)

        results.push({
          user_id: userId,
          full_name: fullName,
          tokens_awarded: 0,
          transaction_id: null,
          success: false,
          error: elderError.message,
        })

        failCount++
      }
    }

    const stats: ProcessingStats = {
      total_elders: uniqueElderIds.length,
      successful: successCount,
      failed: failCount,
      total_tokens_awarded: totalTokensAwarded,
      processing_time_ms: Date.now() - startTime,
      month: monthLabel,
    }

    // Log summary to cron_job_logs table
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'token-council-monthly',
        status: failCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed'),
        records_processed: uniqueElderIds.length,
        records_succeeded: successCount,
        records_failed: failCount,
        execution_time_ms: stats.processing_time_ms,
        details: {
          month: monthLabel,
          total_tokens_awarded: totalTokensAwarded,
          tokens_per_elder: COUNCIL_MONTHLY_TOKENS,
        },
      })
      .then(() => console.log('📝 Job logged'))
      .catch((e) => console.log('⚠️ Could not log job (table may not exist)'))

    console.log(`\n🏁 Token council monthly complete!`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   🪙 Total tokens: ${totalTokensAwarded}`)
    console.log(`   ⏱️ Time: ${stats.processing_time_ms}ms`)

    return new Response(
      JSON.stringify({ success: true, message: 'Token council monthly completed', stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('💥 Fatal error:', error.message)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processing_time_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
