// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: api-v1-elders
// ══════════════════════════════════════════════════════════════════════════════
// Partner API: List active Elders with optional filters
// Method: GET (or POST with filters in body)
// Permission: 'elders.list'
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateApiRequest } from '../_shared/apiAuth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const REQUIRED_PERMISSION = 'elders.list'

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

    // Accept GET or POST
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
          p_path: '/api-v1-elders',
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

    // Parse filters from query params (GET) or body (POST)
    let filters: { specialization?: string; tier?: string; available?: boolean } = {}

    if (req.method === 'GET') {
      const url = new URL(req.url)
      filters.specialization = url.searchParams.get('specialization') || undefined
      filters.tier = url.searchParams.get('tier') || undefined
      const availableParam = url.searchParams.get('available')
      if (availableParam !== null) {
        filters.available = availableParam === 'true'
      }
    } else {
      try {
        filters = await req.json()
      } catch {
        // Empty body is fine — no filters
      }
    }

    console.log(`👥 Listing elders with filters:`, JSON.stringify(filters))

    // Query elder_applications with status = 'approved', joined with profiles
    let query = supabase
      .from('elder_applications')
      .select(`
        user_id,
        community_id,
        status,
        xn_score_at_application,
        honor_score_at_application,
        motivation_statement,
        created_at,
        profiles:user_id (
          id,
          full_name,
          xn_score
        )
      `)
      .eq('status', 'approved')

    const { data: elderApps, error: eldersError } = await query

    if (eldersError) {
      throw new Error(`Failed to fetch elders: ${eldersError.message}`)
    }

    if (!elderApps || elderApps.length === 0) {
      const latencyMs = Date.now() - startTime

      await supabase.rpc('log_api_request', {
        p_client_id: auth.clientId,
        p_method: req.method,
        p_path: '/api-v1-elders',
        p_status_code: 200,
        p_response_summary: 'No elders found',
        p_latency_ms: latencyMs,
      }).catch(() => {})

      return new Response(
        JSON.stringify({ elders: [], total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Deduplicate by user_id (elder may be approved in multiple communities)
    const elderMap = new Map<string, any>()
    for (const app of elderApps) {
      if (!elderMap.has(app.user_id)) {
        elderMap.set(app.user_id, app)
      }
    }

    // Build response array with tier calculation
    let elders = Array.from(elderMap.values()).map((app) => {
      const profile = app.profiles as any
      const xnScore = profile?.xn_score || app.xn_score_at_application || 50

      // Calculate tier
      let tier = 'junior_elder'
      if (xnScore >= 90) tier = 'senior_elder'
      else if (xnScore >= 75) tier = 'elder'

      return {
        id: app.user_id,
        name: profile?.full_name || null,
        tier,
        xn_score: xnScore,
        honor_score: app.honor_score_at_application || null,
        community_id: app.community_id,
        approved_since: app.created_at,
      }
    })

    // Apply tier filter if provided
    if (filters.tier) {
      elders = elders.filter((e) => e.tier === filters.tier)
    }

    const total = elders.length
    const latencyMs = Date.now() - startTime

    // Log the API request
    await supabase.rpc('log_api_request', {
      p_client_id: auth.clientId,
      p_method: req.method,
      p_path: '/api-v1-elders',
      p_status_code: 200,
      p_response_summary: `Listed ${total} elders`,
      p_latency_ms: latencyMs,
    }).catch((e) => console.log(`⚠️ Could not log API request: ${e.message}`))

    console.log(`✅ Returned ${total} elders in ${latencyMs}ms`)

    return new Response(
      JSON.stringify({ elders, total }),
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
