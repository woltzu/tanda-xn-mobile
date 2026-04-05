// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: award-tokens
// ══════════════════════════════════════════════════════════════════════════════
// Trigger: POST request (internal or from other edge functions)
// Purpose: Look up token_award_rules for an event_type and award tokens to a user
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AwardRequest {
  user_id: string
  event_type: string
  reference_type?: string
  reference_id?: string
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
    const body: AwardRequest = await req.json()

    if (!body.user_id || !body.event_type) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: user_id, event_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🎖️ Award tokens request: user=${body.user_id}, event=${body.event_type}`)

    // Look up the token award rule for this event_type
    const { data: rule, error: ruleError } = await supabase
      .from('token_award_rules')
      .select('event_type, token_amount, description, is_active, max_per_day, max_per_month')
      .eq('event_type', body.event_type)
      .eq('is_active', true)
      .single()

    if (ruleError || !rule) {
      console.log(`⚠️ No active award rule found for event_type: ${body.event_type}`)
      return new Response(
        JSON.stringify({ success: false, error: `No active award rule for event_type: ${body.event_type}` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📋 Rule found: ${rule.event_type} = ${rule.token_amount} tokens`)

    // Check daily cap if configured
    if (rule.max_per_day) {
      const todayStart = new Date()
      todayStart.setUTCHours(0, 0, 0, 0)

      const { count: todayCount } = await supabase
        .from('token_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', body.user_id)
        .eq('category', body.event_type)
        .eq('type', 'earn')
        .gte('created_at', todayStart.toISOString())

      if (todayCount !== null && todayCount >= rule.max_per_day) {
        console.log(`⏭️ User ${body.user_id} hit daily cap (${rule.max_per_day}) for ${body.event_type}`)
        return new Response(
          JSON.stringify({ success: false, error: `Daily cap reached for ${body.event_type}` }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Check monthly cap if configured
    if (rule.max_per_month) {
      const monthStart = new Date()
      monthStart.setUTCDate(1)
      monthStart.setUTCHours(0, 0, 0, 0)

      const { count: monthCount } = await supabase
        .from('token_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', body.user_id)
        .eq('category', body.event_type)
        .eq('type', 'earn')
        .gte('created_at', monthStart.toISOString())

      if (monthCount !== null && monthCount >= rule.max_per_month) {
        console.log(`⏭️ User ${body.user_id} hit monthly cap (${rule.max_per_month}) for ${body.event_type}`)
        return new Response(
          JSON.stringify({ success: false, error: `Monthly cap reached for ${body.event_type}` }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Call award_tokens() RPC
    const { data: transactionId, error: awardError } = await supabase.rpc('award_tokens', {
      p_user_id: body.user_id,
      p_amount: rule.token_amount,
      p_category: body.event_type,
      p_reference_type: body.reference_type || null,
      p_reference_id: body.reference_id || null,
      p_description: `Tokens awarded: ${rule.description}`,
    })

    if (awardError) {
      throw new Error(`award_tokens RPC failed: ${awardError.message}`)
    }

    // Get the updated balance
    const { data: newBalance } = await supabase.rpc('get_token_balance', {
      p_user_id: body.user_id,
    })

    const processingTimeMs = Date.now() - startTime

    // Log to cron_job_logs table
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'award-tokens',
        status: 'success',
        records_processed: 1,
        records_succeeded: 1,
        records_failed: 0,
        execution_time_ms: processingTimeMs,
        details: {
          user_id: body.user_id,
          event_type: body.event_type,
          tokens_awarded: rule.token_amount,
          transaction_id: transactionId,
          new_balance: newBalance,
        },
      })
      .then(() => console.log('📝 Job logged'))
      .catch((e) => console.log('⚠️ Could not log job (table may not exist)'))

    console.log(`✅ Awarded ${rule.token_amount} tokens to ${body.user_id} | tx=${transactionId} | balance=${newBalance}`)

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: transactionId,
        tokens_awarded: rule.token_amount,
        new_balance: newBalance,
        event_type: body.event_type,
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
