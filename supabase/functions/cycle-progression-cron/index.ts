// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: cycle-progression-cron
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Hourly
// Purpose: Auto-progress circle cycles through their state machine
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/*
Cycle State Machine:
  scheduled → collecting → deadline_reached → grace_period → ready_payout → payout_completed → closed
                                                    ↓
                                              (all paid early)
                                                    ↓
                                              ready_payout
*/

interface TransitionResult {
  cycle_id: string
  circle_id: string
  previous_status: string
  new_status: string
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_cycles_checked: number
  transitions_made: number
  by_transition: Record<string, number>
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

    console.log('🔄 Starting cycle progression check...')

    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    // Get all cycles that might need progression
    const { data: activeCycles, error: fetchError } = await supabase
      .from('circle_cycles')
      .select(`
        id,
        circle_id,
        cycle_number,
        status,
        start_date,
        contribution_deadline,
        grace_period_end,
        expected_payout_date,
        expected_contributions,
        received_contributions,
        collected_amount,
        expected_amount,
        recipient_user_id,
        circles!inner (
          id,
          name,
          status
        )
      `)
      .in('status', ['scheduled', 'collecting', 'deadline_reached', 'grace_period', 'ready_payout', 'payout_completed'])
      .eq('circles.status', 'active')

    if (fetchError) {
      throw new Error(`Failed to fetch cycles: ${fetchError.message}`)
    }

    if (!activeCycles || activeCycles.length === 0) {
      console.log('📭 No active cycles to check')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active cycles to check',
          stats: { total_cycles_checked: 0, transitions_made: 0, by_transition: {}, processing_time_ms: Date.now() - startTime }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${activeCycles.length} active cycles to check`)

    const results: TransitionResult[] = []
    let transitionCount = 0
    const byTransition: Record<string, number> = {}

    for (const cycle of activeCycles) {
      try {
        let newStatus: string | null = null
        const previousStatus = cycle.status

        // Determine if transition is needed based on current status
        switch (cycle.status) {
          case 'scheduled':
            // Transition to collecting when start date is reached
            if (cycle.start_date <= todayStr) {
              newStatus = 'collecting'
            }
            break

          case 'collecting':
            // Check if all contributions received (early completion)
            if (cycle.received_contributions >= cycle.expected_contributions) {
              newStatus = 'ready_payout'
            }
            // Or check if deadline reached
            else if (cycle.contribution_deadline <= todayStr) {
              newStatus = 'deadline_reached'
            }
            break

          case 'deadline_reached':
            // Check if all contributions now received
            if (cycle.received_contributions >= cycle.expected_contributions) {
              newStatus = 'ready_payout'
            }
            // Or transition to grace period
            else {
              newStatus = 'grace_period'
            }
            break

          case 'grace_period':
            // Check if all contributions received during grace
            if (cycle.received_contributions >= cycle.expected_contributions) {
              newStatus = 'ready_payout'
            }
            // Or check if grace period ended
            else if (cycle.grace_period_end && cycle.grace_period_end <= todayStr) {
              // Move to ready_payout even with missing contributions
              // The payout will be reduced accordingly
              newStatus = 'ready_payout'
            }
            break

          case 'ready_payout':
            // This transition happens when payout is executed
            // For now, we check if payout should be triggered
            if (cycle.expected_payout_date <= todayStr) {
              // Try to execute payout via stored procedure
              const { error: payoutError } = await supabase.rpc('execute_cycle_payout', {
                p_cycle_id: cycle.id
              }).catch(() => ({ error: { message: 'RPC not found' } }))

              if (!payoutError) {
                newStatus = 'payout_completed'
              } else {
                console.log(`ℹ️ Cycle ${cycle.id}: Payout RPC not available, marking for manual processing`)
                // Mark for manual processing
                await supabase
                  .from('circle_cycles')
                  .update({
                    status: 'payout_pending',
                    status_changed_at: now.toISOString(),
                    notes: 'Awaiting manual payout processing'
                  })
                  .eq('id', cycle.id)
              }
            }
            break

          case 'payout_completed':
            // Transition to closed after payout
            newStatus = 'closed'
            break
        }

        // Apply transition if needed
        if (newStatus && newStatus !== previousStatus) {
          const { error: updateError } = await supabase
            .from('circle_cycles')
            .update({
              status: newStatus,
              status_changed_at: now.toISOString(),
              updated_at: now.toISOString()
            })
            .eq('id', cycle.id)

          if (updateError) {
            throw new Error(`Failed to update status: ${updateError.message}`)
          }

          const transitionKey = `${previousStatus}→${newStatus}`
          byTransition[transitionKey] = (byTransition[transitionKey] || 0) + 1

          results.push({
            cycle_id: cycle.id,
            circle_id: cycle.circle_id,
            previous_status: previousStatus,
            new_status: newStatus,
            success: true
          })

          transitionCount++
          console.log(`✅ Cycle ${cycle.id} (${(cycle.circles as any).name}): ${previousStatus} → ${newStatus}`)

          // Handle specific transition actions
          if (newStatus === 'collecting') {
            // Notify members that contribution period has started
            console.log(`📢 Cycle ${cycle.id}: Contribution period started`)
          } else if (newStatus === 'deadline_reached') {
            // Notify members who haven't paid
            console.log(`⚠️ Cycle ${cycle.id}: Deadline reached, ${cycle.expected_contributions - cycle.received_contributions} contributions missing`)
          } else if (newStatus === 'grace_period') {
            // Send urgent reminders to non-payers
            console.log(`🚨 Cycle ${cycle.id}: Grace period started`)
          } else if (newStatus === 'ready_payout') {
            console.log(`💰 Cycle ${cycle.id}: Ready for payout to recipient ${cycle.recipient_user_id}`)
          } else if (newStatus === 'closed') {
            console.log(`🏁 Cycle ${cycle.id}: Closed`)
          }
        }

      } catch (error: any) {
        console.error(`❌ Cycle ${cycle.id}: ${error.message}`)

        results.push({
          cycle_id: cycle.id,
          circle_id: cycle.circle_id,
          previous_status: cycle.status,
          new_status: cycle.status,
          success: false,
          error: error.message
        })
      }
    }

    const stats: ProcessingStats = {
      total_cycles_checked: activeCycles.length,
      transitions_made: transitionCount,
      by_transition: byTransition,
      processing_time_ms: Date.now() - startTime
    }

    // Log job
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'cycle-progression-cron',
        status: 'success',
        records_processed: activeCycles.length,
        records_succeeded: transitionCount,
        records_failed: 0,
        execution_time_ms: stats.processing_time_ms,
        details: stats
      })
      .catch(() => console.log('⚠️ Could not log job'))

    console.log(`\n🏁 Cycle progression complete!`)
    console.log(`   📊 Checked: ${activeCycles.length}`)
    console.log(`   🔄 Transitions: ${transitionCount}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Cycle progression completed', stats }),
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
