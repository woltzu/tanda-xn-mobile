// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: xnscore-decay-check
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Weekly (Sunday at 00:00 UTC)
// Purpose: Apply inactivity decay to XnScores for dormant users
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Decay configuration
const INACTIVITY_THRESHOLD_DAYS = 30
const DECAY_FLOOR = 10 // Minimum score

// Decay rates based on inactivity period
function getDecayRate(daysInactive: number): number {
  if (daysInactive < 30) return 0
  if (daysInactive < 60) return 1    // -1 point/week
  if (daysInactive < 90) return 2    // -2 points/week
  return 3                            // -3 points/week for 90+ days
}

interface DecayResult {
  user_id: string
  previous_score: number
  new_score: number
  decay_applied: number
  days_inactive: number
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_users_checked: number
  users_decayed: number
  total_points_decayed: number
  users_at_floor: number
  users_in_recovery: number
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

    console.log('📉 Starting XnScore decay check...')

    const now = new Date()
    const inactivityThreshold = new Date(now.getTime() - INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

    // Get users who have been inactive and are not in a recovery period
    const { data: inactiveUsers, error: fetchError } = await supabase
      .from('xn_scores')
      .select(`
        user_id,
        total_score,
        last_activity_at,
        financial_inactive_days,
        total_inactivity_penalty,
        decay_floor_reached,
        score_frozen
      `)
      .lt('last_activity_at', inactivityThreshold.toISOString())
      .eq('score_frozen', false)
      .gt('total_score', DECAY_FLOOR)

    if (fetchError) {
      throw new Error(`Failed to fetch inactive users: ${fetchError.message}`)
    }

    // Get users in active recovery periods (exempt from decay)
    const { data: recoveryUsers, error: recoveryError } = await supabase
      .from('xnscore_recovery_periods')
      .select('user_id')
      .eq('is_active', true)

    const recoveryUserIds = new Set((recoveryUsers || []).map(r => r.user_id))

    if (!inactiveUsers || inactiveUsers.length === 0) {
      console.log('📭 No inactive users to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No inactive users to process',
          stats: { total_users_checked: 0, users_decayed: 0, total_points_decayed: 0, users_at_floor: 0, users_in_recovery: recoveryUserIds.size, processing_time_ms: Date.now() - startTime }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${inactiveUsers.length} inactive users (${recoveryUserIds.size} in recovery)`)

    const results: DecayResult[] = []
    let decayedCount = 0
    let totalPointsDecayed = 0
    let atFloorCount = 0

    for (const user of inactiveUsers) {
      // Skip users in recovery period
      if (recoveryUserIds.has(user.user_id)) {
        console.log(`⏭️ User ${user.user_id}: In recovery period, skipping`)
        continue
      }

      try {
        const lastActivity = new Date(user.last_activity_at)
        const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
        const decayRate = getDecayRate(daysInactive)

        if (decayRate === 0) {
          continue
        }

        // Calculate new score
        const previousScore = user.total_score
        let newScore = previousScore - decayRate

        // Apply floor
        if (newScore <= DECAY_FLOOR) {
          newScore = DECAY_FLOOR
          atFloorCount++
        }

        const actualDecay = previousScore - newScore

        if (actualDecay <= 0) {
          continue
        }

        // Update XnScore
        const { error: updateError } = await supabase
          .from('xn_scores')
          .update({
            total_score: newScore,
            previous_score: previousScore,
            financial_inactive_days: daysInactive,
            total_inactivity_penalty: (user.total_inactivity_penalty || 0) + actualDecay,
            decay_floor_reached: newScore === DECAY_FLOOR,
            updated_at: now.toISOString()
          })
          .eq('user_id', user.user_id)

        if (updateError) {
          throw new Error(`Failed to update score: ${updateError.message}`)
        }

        // Record decay history
        await supabase
          .from('xnscore_decay_history')
          .insert({
            user_id: user.user_id,
            decay_date: now.toISOString().split('T')[0],
            days_inactive: daysInactive,
            score_before: previousScore,
            decay_amount: actualDecay,
            score_after: newScore,
            decay_reason: 'inactivity',
            floor_applied: newScore === DECAY_FLOOR
          })
          .catch((e) => console.log(`ℹ️ Could not record decay history: ${e.message}`))

        // Record in xnscore_history
        await supabase
          .from('xnscore_history')
          .insert({
            user_id: user.user_id,
            score: newScore,
            previous_score: previousScore,
            score_change: -actualDecay,
            trigger_event: 'inactivity_decay',
            trigger_details: `${daysInactive} days inactive, decay rate: ${decayRate}/week`
          })
          .catch((e) => console.log(`ℹ️ Could not record history: ${e.message}`))

        results.push({
          user_id: user.user_id,
          previous_score: previousScore,
          new_score: newScore,
          decay_applied: actualDecay,
          days_inactive: daysInactive,
          success: true
        })

        totalPointsDecayed += actualDecay
        decayedCount++

        console.log(`✅ User ${user.user_id}: ${previousScore} → ${newScore} (-${actualDecay}, ${daysInactive} days inactive)`)

      } catch (error: any) {
        console.error(`❌ User ${user.user_id}: ${error.message}`)

        results.push({
          user_id: user.user_id,
          previous_score: user.total_score,
          new_score: user.total_score,
          decay_applied: 0,
          days_inactive: 0,
          success: false,
          error: error.message
        })
      }
    }

    const stats: ProcessingStats = {
      total_users_checked: inactiveUsers.length,
      users_decayed: decayedCount,
      total_points_decayed: totalPointsDecayed,
      users_at_floor: atFloorCount,
      users_in_recovery: recoveryUserIds.size,
      processing_time_ms: Date.now() - startTime
    }

    // Log job
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'xnscore-decay-check',
        status: 'success',
        records_processed: inactiveUsers.length,
        records_succeeded: decayedCount,
        records_failed: 0,
        execution_time_ms: stats.processing_time_ms,
        details: stats
      })
      .catch(() => console.log('⚠️ Could not log job'))

    console.log(`\n🏁 Decay check complete!`)
    console.log(`   📊 Checked: ${inactiveUsers.length}`)
    console.log(`   📉 Decayed: ${decayedCount}`)
    console.log(`   🔢 Total points: -${totalPointsDecayed}`)
    console.log(`   🏠 At floor: ${atFloorCount}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Decay check completed', stats }),
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
