// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: xnscore-tenure-bonus
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Monthly (1st of month at 00:00 UTC)
// Purpose: Award tenure bonuses to eligible users
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Tenure bonus tiers
function getTenureBonus(monthsActive: number): number {
  if (monthsActive < 1) return 0
  if (monthsActive <= 6) return 0.5   // +0.5 points/month for first 6 months
  if (monthsActive <= 12) return 1.0  // +1 point/month for months 7-12
  if (monthsActive <= 24) return 1.5  // +1.5 points/month for months 13-24
  return 2.0                           // +2 points/month for 24+ months
}

interface TenureResult {
  user_id: string
  months_active: number
  bonus_awarded: number
  previous_score: number
  new_score: number
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_users: number
  bonuses_awarded: number
  total_bonus_points: number
  by_tier: Record<string, number>
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

    console.log('🎂 Starting tenure bonus processing...')

    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7) // YYYY-MM

    // Get all users with XnScores who are active
    const { data: users, error: fetchError } = await supabase
      .from('xn_scores')
      .select(`
        user_id,
        total_score,
        active_months,
        score_frozen,
        profiles!inner (
          id,
          created_at
        )
      `)
      .eq('score_frozen', false)
      .gt('active_months', 0)

    if (fetchError) {
      throw new Error(`Failed to fetch users: ${fetchError.message}`)
    }

    // Check who already received tenure bonus this month
    const { data: alreadyAwarded, error: awardedError } = await supabase
      .from('xnscore_tenure_history')
      .select('user_id')
      .eq('tenure_month', currentMonth)

    const alreadyAwardedIds = new Set((alreadyAwarded || []).map(a => a.user_id))

    if (!users || users.length === 0) {
      console.log('📭 No users to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No users to process',
          stats: { total_users: 0, bonuses_awarded: 0, total_bonus_points: 0, by_tier: {}, processing_time_ms: Date.now() - startTime }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${users.length} users (${alreadyAwardedIds.size} already awarded this month)`)

    const results: TenureResult[] = []
    let awardedCount = 0
    let totalBonusPoints = 0
    const byTier: Record<string, number> = {
      '0-6_months': 0,
      '7-12_months': 0,
      '13-24_months': 0,
      '24+_months': 0
    }

    for (const user of users) {
      // Skip if already awarded this month
      if (alreadyAwardedIds.has(user.user_id)) {
        console.log(`⏭️ User ${user.user_id}: Already awarded this month`)
        continue
      }

      try {
        const monthsActive = user.active_months
        const bonus = getTenureBonus(monthsActive)

        if (bonus <= 0) {
          continue
        }

        const previousScore = user.total_score
        const newScore = Math.min(previousScore + bonus, 100) // Cap at 100
        const actualBonus = newScore - previousScore

        if (actualBonus <= 0) {
          continue
        }

        // Update XnScore
        const { error: updateError } = await supabase
          .from('xn_scores')
          .update({
            total_score: newScore,
            previous_score: previousScore,
            active_months: monthsActive + 1,
            updated_at: now.toISOString()
          })
          .eq('user_id', user.user_id)

        if (updateError) {
          throw new Error(`Failed to update score: ${updateError.message}`)
        }

        // Record tenure history
        await supabase
          .from('xnscore_tenure_history')
          .insert({
            user_id: user.user_id,
            tenure_month: currentMonth,
            months_at_bonus: monthsActive,
            bonus_awarded: actualBonus,
            score_before: previousScore,
            score_after: newScore,
            total_tenure_bonus_earned: actualBonus
          })
          .catch((e) => console.log(`ℹ️ Could not record tenure history: ${e.message}`))

        // Record in xnscore_history
        await supabase
          .from('xnscore_history')
          .insert({
            user_id: user.user_id,
            score: newScore,
            previous_score: previousScore,
            score_change: actualBonus,
            trigger_event: 'tenure_bonus',
            trigger_details: `${monthsActive} months active, +${actualBonus} bonus`
          })
          .catch((e) => console.log(`ℹ️ Could not record history: ${e.message}`))

        // Track tier
        if (monthsActive <= 6) byTier['0-6_months']++
        else if (monthsActive <= 12) byTier['7-12_months']++
        else if (monthsActive <= 24) byTier['13-24_months']++
        else byTier['24+_months']++

        results.push({
          user_id: user.user_id,
          months_active: monthsActive,
          bonus_awarded: actualBonus,
          previous_score: previousScore,
          new_score: newScore,
          success: true
        })

        totalBonusPoints += actualBonus
        awardedCount++

        console.log(`✅ User ${user.user_id}: ${monthsActive} months → +${actualBonus} (${previousScore} → ${newScore})`)

      } catch (error: any) {
        console.error(`❌ User ${user.user_id}: ${error.message}`)

        results.push({
          user_id: user.user_id,
          months_active: user.active_months,
          bonus_awarded: 0,
          previous_score: user.total_score,
          new_score: user.total_score,
          success: false,
          error: error.message
        })
      }
    }

    const stats: ProcessingStats = {
      total_users: users.length,
      bonuses_awarded: awardedCount,
      total_bonus_points: totalBonusPoints,
      by_tier: byTier,
      processing_time_ms: Date.now() - startTime
    }

    // Log job
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'xnscore-tenure-bonus',
        status: 'success',
        records_processed: users.length,
        records_succeeded: awardedCount,
        records_failed: 0,
        execution_time_ms: stats.processing_time_ms,
        details: stats
      })
      .catch(() => console.log('⚠️ Could not log job'))

    console.log(`\n🏁 Tenure bonus complete!`)
    console.log(`   📊 Processed: ${users.length}`)
    console.log(`   🎁 Awarded: ${awardedCount}`)
    console.log(`   🔢 Total points: +${totalBonusPoints}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Tenure bonus completed', stats }),
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
