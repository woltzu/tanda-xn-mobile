// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: expire-swap-requests
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Hourly
// Purpose: Expire unanswered position swap requests
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ExpireResult {
  request_id: string
  requester_id: string
  target_id: string
  previous_status: string
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_checked: number
  expired: number
  failed: number
  by_previous_status: Record<string, number>
  processing_time_ms: number
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    console.log('⏰ Starting swap request expiration check...')

    const now = new Date()

    // Get swap requests that have expired
    const { data: expiredRequests, error: fetchError } = await supabase
      .from('position_swap_requests')
      .select(`
        id,
        circle_id,
        requester_user_id,
        target_user_id,
        swap_status,
        expires_at,
        created_at
      `)
      .in('swap_status', ['pending_target', 'pending_confirmation', 'pending_elder_approval'])
      .lt('expires_at', now.toISOString())

    if (fetchError) {
      throw new Error(`Failed to fetch expired requests: ${fetchError.message}`)
    }

    if (!expiredRequests || expiredRequests.length === 0) {
      console.log('📭 No expired swap requests to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expired swap requests to process',
          stats: { total_checked: 0, expired: 0, failed: 0, by_previous_status: {}, processing_time_ms: Date.now() - startTime }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${expiredRequests.length} expired swap requests`)

    const results: ExpireResult[] = []
    let expiredCount = 0
    let failCount = 0
    const byPreviousStatus: Record<string, number> = {}

    for (const request of expiredRequests) {
      try {
        // Track previous status
        byPreviousStatus[request.swap_status] = (byPreviousStatus[request.swap_status] || 0) + 1

        // Update status to expired
        const { error: updateError } = await supabase
          .from('position_swap_requests')
          .update({
            swap_status: 'expired',
            updated_at: now.toISOString()
          })
          .eq('id', request.id)

        if (updateError) {
          throw new Error(`Failed to update request: ${updateError.message}`)
        }

        // Record swap event
        await supabase
          .from('position_swap_events')
          .insert({
            swap_request_id: request.id,
            event_type: 'swap_expired',
            actor_user_id: null, // System action
            details: {
              previous_status: request.swap_status,
              expired_at: now.toISOString(),
              original_expiry: request.expires_at
            }
          })
          .catch((e) => console.log(`ℹ️ Could not record event: ${e.message}`))

        // Notify the requester that their request expired
        await supabase
          .from('notifications')
          .insert({
            user_id: request.requester_user_id,
            type: 'swap_request_expired',
            title: 'Swap Request Expired',
            message: 'Your position swap request has expired without a response.',
            data: {
              swap_request_id: request.id,
              circle_id: request.circle_id
            },
            read: false
          })
          .catch((e) => console.log(`ℹ️ Could not create notification: ${e.message}`))

        results.push({
          request_id: request.id,
          requester_id: request.requester_user_id,
          target_id: request.target_user_id,
          previous_status: request.swap_status,
          success: true
        })

        expiredCount++

        console.log(`✅ Request ${request.id}: ${request.swap_status} → expired`)

      } catch (error: any) {
        console.error(`❌ Request ${request.id}: ${error.message}`)

        results.push({
          request_id: request.id,
          requester_id: request.requester_user_id,
          target_id: request.target_user_id,
          previous_status: request.swap_status,
          success: false,
          error: error.message
        })

        failCount++
      }
    }

    const stats: ProcessingStats = {
      total_checked: expiredRequests.length,
      expired: expiredCount,
      failed: failCount,
      by_previous_status: byPreviousStatus,
      processing_time_ms: Date.now() - startTime
    }

    // Log job
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'expire-swap-requests',
        status: failCount === 0 ? 'success' : (expiredCount > 0 ? 'partial' : 'failed'),
        records_processed: expiredRequests.length,
        records_succeeded: expiredCount,
        records_failed: failCount,
        execution_time_ms: stats.processing_time_ms,
        details: stats
      })
      .catch(() => console.log('⚠️ Could not log job'))

    console.log(`\n🏁 Swap request expiration complete!`)
    console.log(`   📊 Checked: ${expiredRequests.length}`)
    console.log(`   ⏰ Expired: ${expiredCount}`)
    console.log(`   ❌ Failed: ${failCount}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Swap request expiration completed', stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('💥 Fatal error:', error.message)

    return new Response(
      JSON.stringify({ success: false, error: error.message, processing_time_ms: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
