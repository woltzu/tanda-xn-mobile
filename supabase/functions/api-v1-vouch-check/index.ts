// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: api-v1-vouch-check
// ══════════════════════════════════════════════════════════════════════════════
// Partner API: Check if a user has active vouches
// Method: POST
// Permission: 'vouch.check'
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateApiRequest } from '../_shared/apiAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REQUIRED_PERMISSION = 'vouch.check'

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

      if (auth.clientId) {
        await supabase.rpc('log_api_request', {
          p_client_id: auth.clientId,
          p_method: 'POST',
          p_path: '/api-v1-vouch-check',
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
    const body = await req.json()
    const userId = body.user_id

    if (!userId) {
      const latencyMs = Date.now() - startTime

      await supabase.rpc('log_api_request', {
        p_client_id: auth.clientId,
        p_method: 'POST',
        p_path: '/api-v1-vouch-check',
        p_status_code: 400,
        p_response_summary: 'Missing user_id',
        p_latency_ms: latencyMs,
      }).catch(() => {})

      return new Response(
        JSON.stringify({ error: 'Missing required field: user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🤝 Checking vouches for user: ${userId}`)

    // Query member_vouches where vouched_user_id = user_id and status = 'active'
    const { data: vouches, error: vouchError } = await supabase
      .from('member_vouches')
      .select('id, voucher_user_id, vouch_weight, community_id, created_at')
      .eq('vouched_user_id', userId)
      .eq('status', 'active')

    if (vouchError) {
      throw new Error(`Failed to fetch vouches: ${vouchError.message}`)
    }

    const vouchCount = vouches?.length || 0
    const hasActiveVouches = vouchCount > 0

    // Find the maximum vouch weight
    let maxVouchWeight = 0
    if (vouches && vouches.length > 0) {
      maxVouchWeight = Math.max(...vouches.map((v) => parseFloat(v.vouch_weight) || 1.0))
    }

    const latencyMs = Date.now() - startTime

    // Log the API request
    await supabase.rpc('log_api_request', {
      p_client_id: auth.clientId,
      p_method: 'POST',
      p_path: '/api-v1-vouch-check',
      p_status_code: 200,
      p_request_body: { user_id: userId },
      p_response_summary: `Vouch check: ${vouchCount} active vouches, max_weight=${maxVouchWeight}`,
      p_latency_ms: latencyMs,
    }).catch((e) => console.log(`⚠️ Could not log API request: ${e.message}`))

    console.log(`✅ Vouch check for ${userId}: ${vouchCount} vouches, max_weight=${maxVouchWeight} (${latencyMs}ms)`)

    return new Response(
      JSON.stringify({
        user_id: userId,
        has_active_vouches: hasActiveVouches,
        vouch_count: vouchCount,
        max_vouch_weight: maxVouchWeight,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
