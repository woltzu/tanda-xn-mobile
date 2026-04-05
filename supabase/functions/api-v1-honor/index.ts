// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: api-v1-honor
// ══════════════════════════════════════════════════════════════════════════════
// Partner API: Get a user's honor score and related data
// Method: GET
// Permission: 'honor.read'
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateApiRequest } from '../_shared/apiAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REQUIRED_PERMISSION = 'honor.read'

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

    // Accept GET (query param) or POST (body)
    if (req.method !== 'GET' && req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed. Use GET or POST.' }),
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
          p_method: req.method,
          p_path: '/api-v1-honor',
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

    // Get user_id from query param or body
    let userId: string | null = null

    if (req.method === 'GET') {
      const url = new URL(req.url)
      userId = url.searchParams.get('user_id')
    } else {
      const body = await req.json()
      userId = body.user_id || null
    }

    if (!userId) {
      const latencyMs = Date.now() - startTime

      await supabase.rpc('log_api_request', {
        p_client_id: auth.clientId,
        p_method: req.method,
        p_path: '/api-v1-honor',
        p_status_code: 400,
        p_response_summary: 'Missing user_id parameter',
        p_latency_ms: latencyMs,
      }).catch(() => {})

      return new Response(
        JSON.stringify({ error: 'Missing required parameter: user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Fetching honor data for user: ${userId}`)

    // Query profile for xn_score
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, xn_score')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      const latencyMs = Date.now() - startTime

      await supabase.rpc('log_api_request', {
        p_client_id: auth.clientId,
        p_method: req.method,
        p_path: '/api-v1-honor',
        p_status_code: 404,
        p_response_summary: `User not found: ${userId}`,
        p_latency_ms: latencyMs,
      }).catch(() => {})

      return new Response(
        JSON.stringify({ error: `User not found: ${userId}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Query honor_scores for real computed honor score
    const { data: honorData } = await supabase
      .from('honor_scores')
      .select('total_score, score_tier, community_score, character_score, expertise_score, last_computed_at')
      .eq('user_id', userId)
      .maybeSingle()

    // Check elder status from elder_applications
    const { data: elderApp } = await supabase
      .from('elder_applications')
      .select('status, community_id')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .limit(1)
      .maybeSingle()

    // Determine tier from honor score (not xn_score)
    const honorScore = honorData?.total_score || 0
    const xnScore = profile.xn_score || 50
    let honorTier = 'Novice'
    if (honorScore >= 90) honorTier = 'Grand Elder'
    else if (honorScore >= 75) honorTier = 'Elder'
    else if (honorScore >= 50) honorTier = 'Respected'
    else if (honorScore >= 25) honorTier = 'Trusted'

    // Count total resolved disputes where user was the assigned elder
    const { count: totalCasesResolved } = await supabase
      .from('disputes')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .eq('status', 'resolved')

    const latencyMs = Date.now() - startTime

    // Log the API request
    await supabase.rpc('log_api_request', {
      p_client_id: auth.clientId,
      p_method: req.method,
      p_path: '/api-v1-honor',
      p_status_code: 200,
      p_response_summary: `Honor data for ${userId}: honor=${honorScore}, tier=${honorTier}`,
      p_latency_ms: latencyMs,
    }).catch((e) => console.log(`⚠️ Could not log API request: ${e.message}`))

    console.log(`✅ Honor data returned for ${userId} in ${latencyMs}ms`)

    return new Response(
      JSON.stringify({
        user_id: userId,
        honor_score: honorScore,
        score_tier: honorData?.score_tier || honorTier,
        pillars: honorData ? {
          community: honorData.community_score,
          character: honorData.character_score,
          expertise: honorData.expertise_score,
        } : null,
        xn_score: xnScore,
        total_cases_resolved: totalCasesResolved || 0,
        is_elder: !!elderApp,
        last_computed_at: honorData?.last_computed_at || null,
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
