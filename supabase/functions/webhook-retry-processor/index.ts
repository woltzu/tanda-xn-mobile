// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: webhook-retry-processor
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Every 5 minutes (via pg_cron)
// Purpose: Retry failed webhook deliveries with exponential backoff
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Exponential backoff intervals in seconds indexed by attempt_count
// attempt 1 already happened on initial dispatch, retries start at attempt 2
const BACKOFF_INTERVALS: Record<number, number> = {
  2: 120,    // 2 minutes
  3: 480,    // 8 minutes
  4: 1920,   // 32 minutes
  5: 7200,   // 2 hours
}

interface RetryResult {
  delivery_id: string
  event_type: string
  attempt_count: number
  http_status: number
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_pending: number
  retried: number
  delivered: number
  failed_permanently: number
  still_retrying: number
  processing_time_ms: number
}

/**
 * Signs a payload using HMAC-SHA256 with the given secret.
 */
async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(payload)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)

  // Convert ArrayBuffer to hex string
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
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

    console.log('🔄 Starting webhook retry processor...')

    // Query webhook_deliveries where status='retrying' and next_retry_at <= NOW()
    // and attempt_count < max_attempts
    const now = new Date().toISOString()

    const { data: pendingRetries, error: fetchError } = await supabase
      .from('webhook_deliveries')
      .select(`
        id,
        api_client_id,
        event_type,
        payload,
        delivery_url,
        attempt_count,
        max_attempts,
        api_clients:api_client_id (
          id,
          name,
          webhook_secret,
          is_active
        )
      `)
      .eq('status', 'retrying')
      .lte('next_retry_at', now)
      .order('next_retry_at', { ascending: true })
      .limit(50) // Process up to 50 per run to avoid timeouts

    if (fetchError) {
      throw new Error(`Failed to fetch pending retries: ${fetchError.message}`)
    }

    if (!pendingRetries || pendingRetries.length === 0) {
      console.log('📭 No pending webhook retries')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending webhook retries',
          stats: {
            total_pending: 0,
            retried: 0,
            delivered: 0,
            failed_permanently: 0,
            still_retrying: 0,
            processing_time_ms: Date.now() - startTime,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${pendingRetries.length} pending webhook retries`)

    const results: RetryResult[] = []
    let deliveredCount = 0
    let failedPermanentlyCount = 0
    let stillRetryingCount = 0

    for (const delivery of pendingRetries) {
      const client = delivery.api_clients as any
      const newAttemptCount = delivery.attempt_count + 1

      try {
        // Skip if client is inactive
        if (!client || !client.is_active) {
          console.log(`⏭️ Delivery ${delivery.id}: Client inactive, marking failed`)

          await supabase
            .from('webhook_deliveries')
            .update({
              status: 'failed',
              response_body: 'Client deactivated',
              attempt_count: newAttemptCount,
            })
            .eq('id', delivery.id)

          failedPermanentlyCount++
          continue
        }

        // Prepare payload
        const webhookPayload = JSON.stringify({
          event: delivery.event_type,
          timestamp: new Date().toISOString(),
          data: delivery.payload,
        })

        // Sign payload
        let signature = ''
        if (client.webhook_secret) {
          signature = await signPayload(webhookPayload, client.webhook_secret)
        }

        // POST to delivery_url
        let httpStatus = 0
        let responseBody = ''
        let deliverySuccess = false

        try {
          const webhookResponse = await fetch(delivery.delivery_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-TandaXn-Signature': signature,
              'X-TandaXn-Event': delivery.event_type,
              'X-TandaXn-Delivery': delivery.id,
              'X-TandaXn-Retry': String(newAttemptCount),
            },
            body: webhookPayload,
          })

          httpStatus = webhookResponse.status
          responseBody = await webhookResponse.text().catch(() => '')
          deliverySuccess = httpStatus >= 200 && httpStatus < 300

        } catch (fetchErr: any) {
          console.error(`❌ Delivery ${delivery.id}: Fetch error: ${fetchErr.message}`)
          responseBody = fetchErr.message
        }

        if (deliverySuccess) {
          // Mark as delivered
          await supabase
            .from('webhook_deliveries')
            .update({
              status: 'delivered',
              http_status_code: httpStatus,
              response_body: responseBody.substring(0, 500),
              attempt_count: newAttemptCount,
              delivered_at: new Date().toISOString(),
            })
            .eq('id', delivery.id)

          deliveredCount++
          console.log(`✅ Delivery ${delivery.id}: Delivered on attempt ${newAttemptCount} (HTTP ${httpStatus})`)

          results.push({
            delivery_id: delivery.id,
            event_type: delivery.event_type,
            attempt_count: newAttemptCount,
            http_status: httpStatus,
            success: true,
          })

        } else if (newAttemptCount >= delivery.max_attempts) {
          // Max attempts reached — mark as permanently failed
          await supabase
            .from('webhook_deliveries')
            .update({
              status: 'failed',
              http_status_code: httpStatus || null,
              response_body: responseBody.substring(0, 500),
              attempt_count: newAttemptCount,
            })
            .eq('id', delivery.id)

          failedPermanentlyCount++
          console.log(`💀 Delivery ${delivery.id}: Failed permanently after ${newAttemptCount} attempts`)

          results.push({
            delivery_id: delivery.id,
            event_type: delivery.event_type,
            attempt_count: newAttemptCount,
            http_status: httpStatus,
            success: false,
            error: `Failed after ${newAttemptCount} attempts`,
          })

        } else {
          // Schedule next retry with exponential backoff
          const backoffSeconds = BACKOFF_INTERVALS[newAttemptCount] || 7200
          const nextRetryAt = new Date(Date.now() + backoffSeconds * 1000).toISOString()

          await supabase
            .from('webhook_deliveries')
            .update({
              status: 'retrying',
              http_status_code: httpStatus || null,
              response_body: responseBody.substring(0, 500),
              attempt_count: newAttemptCount,
              next_retry_at: nextRetryAt,
            })
            .eq('id', delivery.id)

          stillRetryingCount++
          console.log(`🔄 Delivery ${delivery.id}: Retry ${newAttemptCount} failed (HTTP ${httpStatus}), next at ${nextRetryAt}`)

          results.push({
            delivery_id: delivery.id,
            event_type: delivery.event_type,
            attempt_count: newAttemptCount,
            http_status: httpStatus,
            success: false,
            error: `Retry scheduled for ${nextRetryAt}`,
          })
        }

      } catch (retryError: any) {
        console.error(`❌ Delivery ${delivery.id}: ${retryError.message}`)

        results.push({
          delivery_id: delivery.id,
          event_type: delivery.event_type,
          attempt_count: newAttemptCount,
          http_status: 0,
          success: false,
          error: retryError.message,
        })
      }
    }

    const stats: ProcessingStats = {
      total_pending: pendingRetries.length,
      retried: pendingRetries.length,
      delivered: deliveredCount,
      failed_permanently: failedPermanentlyCount,
      still_retrying: stillRetryingCount,
      processing_time_ms: Date.now() - startTime,
    }

    // Log to cron_job_logs
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'webhook-retry-processor',
        status: failedPermanentlyCount === 0 ? 'success' : (deliveredCount > 0 ? 'partial' : 'failed'),
        records_processed: pendingRetries.length,
        records_succeeded: deliveredCount,
        records_failed: failedPermanentlyCount,
        execution_time_ms: stats.processing_time_ms,
        details: {
          still_retrying: stillRetryingCount,
        },
      })
      .then(() => console.log('📝 Job logged'))
      .catch((e) => console.log('⚠️ Could not log job (table may not exist)'))

    console.log(`\n🏁 Webhook retry processor complete!`)
    console.log(`   📊 Processed: ${pendingRetries.length}`)
    console.log(`   ✅ Delivered: ${deliveredCount}`)
    console.log(`   💀 Failed permanently: ${failedPermanentlyCount}`)
    console.log(`   🔄 Still retrying: ${stillRetryingCount}`)
    console.log(`   ⏱️ Time: ${stats.processing_time_ms}ms`)

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook retry processor completed', stats }),
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
