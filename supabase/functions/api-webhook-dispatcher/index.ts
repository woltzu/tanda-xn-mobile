// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: api-webhook-dispatcher
// ══════════════════════════════════════════════════════════════════════════════
// Trigger: POST request (called internally after partner API events)
// Purpose: Dispatch webhook payloads to partner webhook_url with HMAC-SHA256 signing
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Exponential backoff intervals in seconds: 30s, 2m, 8m, 32m, 2h
const BACKOFF_INTERVALS = [30, 120, 480, 1920, 7200]

interface DispatchRequest {
  api_client_id: string
  event_type: string
  payload: Record<string, any>
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

    // Parse request body
    const body: DispatchRequest = await req.json()

    if (!body.api_client_id || !body.event_type || !body.payload) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: api_client_id, event_type, payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📤 Dispatching webhook: client=${body.api_client_id}, event=${body.event_type}`)

    // Get client's webhook_url and webhook_secret from api_clients
    const { data: client, error: clientError } = await supabase
      .from('api_clients')
      .select('id, name, webhook_url, webhook_secret, is_active')
      .eq('id', body.api_client_id)
      .eq('is_active', true)
      .single()

    if (clientError || !client) {
      console.log(`⚠️ Client not found or inactive: ${body.api_client_id}`)
      return new Response(
        JSON.stringify({ success: false, error: 'API client not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!client.webhook_url) {
      console.log(`⚠️ No webhook URL configured for client: ${client.name}`)
      return new Response(
        JSON.stringify({ success: false, error: 'No webhook URL configured for this client' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare the payload
    const webhookPayload = JSON.stringify({
      event: body.event_type,
      timestamp: new Date().toISOString(),
      data: body.payload,
    })

    // Sign the payload with HMAC-SHA256
    let signature = ''
    if (client.webhook_secret) {
      signature = await signPayload(webhookPayload, client.webhook_secret)
    }

    // Create webhook delivery record
    const { data: delivery, error: deliveryError } = await supabase
      .from('webhook_deliveries')
      .insert({
        api_client_id: body.api_client_id,
        event_type: body.event_type,
        payload: body.payload,
        delivery_url: client.webhook_url,
        status: 'pending',
        attempt_count: 1,
      })
      .select('id')
      .single()

    if (deliveryError) {
      throw new Error(`Failed to create delivery record: ${deliveryError.message}`)
    }

    console.log(`📋 Delivery record created: ${delivery.id}`)

    // POST to webhook_url with signature header
    let httpStatus = 0
    let responseBody = ''
    let deliverySuccess = false

    try {
      const webhookResponse = await fetch(client.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TandaXn-Signature': signature,
          'X-TandaXn-Event': body.event_type,
          'X-TandaXn-Delivery': delivery.id,
        },
        body: webhookPayload,
      })

      httpStatus = webhookResponse.status
      responseBody = await webhookResponse.text().catch(() => '')

      // Consider 2xx as success
      deliverySuccess = httpStatus >= 200 && httpStatus < 300

    } catch (fetchError: any) {
      console.error(`❌ Webhook fetch failed: ${fetchError.message}`)
      responseBody = fetchError.message
    }

    if (deliverySuccess) {
      // Update delivery as successful
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'delivered',
          http_status_code: httpStatus,
          response_body: responseBody.substring(0, 500),
          delivered_at: new Date().toISOString(),
        })
        .eq('id', delivery.id)

      console.log(`✅ Webhook delivered: ${delivery.id} (HTTP ${httpStatus})`)
    } else {
      // Set to retrying with exponential backoff
      const nextRetryDelay = BACKOFF_INTERVALS[0] // 30 seconds for first retry
      const nextRetryAt = new Date(Date.now() + nextRetryDelay * 1000).toISOString()

      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'retrying',
          http_status_code: httpStatus || null,
          response_body: responseBody.substring(0, 500),
          next_retry_at: nextRetryAt,
        })
        .eq('id', delivery.id)

      console.log(`⚠️ Webhook failed, retrying at ${nextRetryAt}: ${delivery.id} (HTTP ${httpStatus})`)
    }

    const processingTimeMs = Date.now() - startTime

    return new Response(
      JSON.stringify({
        success: deliverySuccess,
        delivery_id: delivery.id,
        status: deliverySuccess ? 'delivered' : 'retrying',
        http_status: httpStatus,
        processing_time_ms: processingTimeMs,
      }),
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
