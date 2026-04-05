// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: api-v1-cases
// ══════════════════════════════════════════════════════════════════════════════
// Partner API: Create a dispute/case
// Method: POST
// Permission: 'cases.create'
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateApiRequest } from '../_shared/apiAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REQUIRED_PERMISSION = 'cases.create'

interface CreateCaseRequest {
  dispute_type: string
  severity: string
  description: string
  reporter_user_id: string
  against_user_id?: string
  community_id: string
  circle_id?: string
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

    // Only accept POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Authenticate the partner API request
    const auth = await validateApiRequest(req, supabase, REQUIRED_PERMISSION)

    if (!auth.valid) {
      console.log(`🚫 Auth failed: ${auth.error}`)

      // Log the failed request
      if (auth.clientId) {
        await supabase.rpc('log_api_request', {
          p_client_id: auth.clientId,
          p_method: 'POST',
          p_path: '/api-v1-cases',
          p_status_code: auth.statusCode,
          p_response_summary: auth.error,
          p_latency_ms: Date.now() - startTime,
        }).catch(() => {})
      }

      return new Response(
        JSON.stringify({ error: auth.error }),
        { status: auth.statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔑 Authenticated: ${auth.clientName} (${auth.clientId})`)

    // Parse request body
    const body: CreateCaseRequest = await req.json()

    // Validate required fields
    if (!body.dispute_type || !body.description || !body.reporter_user_id || !body.community_id) {
      const latencyMs = Date.now() - startTime

      await supabase.rpc('log_api_request', {
        p_client_id: auth.clientId,
        p_method: 'POST',
        p_path: '/api-v1-cases',
        p_status_code: 400,
        p_request_body: body,
        p_response_summary: 'Missing required fields',
        p_latency_ms: latencyMs,
      }).catch(() => {})

      return new Response(
        JSON.stringify({ error: 'Missing required fields: dispute_type, description, reporter_user_id, community_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Insert into disputes table
    const { data: dispute, error: insertError } = await supabase
      .from('disputes')
      .insert({
        type: body.dispute_type,
        priority: body.severity || 'medium',
        description: body.description,
        title: `[API] ${body.dispute_type} case`,
        reporter_user_id: body.reporter_user_id,
        against_user_id: body.against_user_id || null,
        community_id: body.community_id,
        circle_id: body.circle_id || null,
        status: 'open',
      })
      .select('id, status, created_at')
      .single()

    if (insertError) {
      throw new Error(`Failed to create case: ${insertError.message}`)
    }

    console.log(`📋 Case created: ${dispute.id}`)

    // Queue webhook to partner (case.created event)
    await supabase.rpc('queue_webhook', {
      p_client_id: auth.clientId,
      p_event_type: 'case.created',
      p_payload: {
        case_id: dispute.id,
        dispute_type: body.dispute_type,
        severity: body.severity || 'medium',
        reporter_user_id: body.reporter_user_id,
        community_id: body.community_id,
        status: 'open',
        created_at: dispute.created_at,
      },
    }).catch((e) => console.log(`⚠️ Could not queue webhook: ${e.message}`))

    const latencyMs = Date.now() - startTime

    // Log the API request via log_api_request() RPC
    await supabase.rpc('log_api_request', {
      p_client_id: auth.clientId,
      p_method: 'POST',
      p_path: '/api-v1-cases',
      p_status_code: 201,
      p_request_body: body,
      p_response_summary: `Case created: ${dispute.id}`,
      p_latency_ms: latencyMs,
    }).catch((e) => console.log(`⚠️ Could not log API request: ${e.message}`))

    console.log(`✅ Case ${dispute.id} created in ${latencyMs}ms`)

    return new Response(
      JSON.stringify({
        case_id: dispute.id,
        status: 'open',
        created_at: dispute.created_at,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('💥 Fatal error:', error.message)

    return new Response(
      JSON.stringify({
        error: error.message,
        processing_time_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
