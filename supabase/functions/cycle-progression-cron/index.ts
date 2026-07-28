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

    // ── Doc 39 Phase 3: platform pause check (mig 379 + 383) ─────────────────
    // Read platform_settings.payouts_paused once at cron entry. If paused,
    // we do NOT touch the ready_payout branch below (execute_cycle_payout
    // would refuse anyway per mig 379's guard, but this skips N per-cycle
    // RPC round-trips and produces a single cleanly-labeled log row).
    // Other state transitions (scheduled→collecting, deadline_reached,
    // grace_period entry, closed) still fire — the pause is scoped to
    // outbound Transfers, not internal state bookkeeping.
    let isPaused = false
    let pausedSince: string | null = null
    let pausedByAdminId: string | null = null
    let pausedReason: string | null = null
    let payoutsSkippedDueToPause = 0
    try {
      const { data: settings, error: settingsErr } = await supabase
        .from('platform_settings')
        .select('payouts_paused, payouts_paused_at, payouts_paused_by_admin_id, payouts_paused_reason')
        .eq('id', 1)
        .maybeSingle()
      if (settingsErr) {
        console.warn('⚠️ Could not read platform_settings; proceeding without pause check:', settingsErr.message)
      } else if (settings?.payouts_paused) {
        isPaused = true
        pausedSince = settings.payouts_paused_at ?? null
        pausedByAdminId = settings.payouts_paused_by_admin_id ?? null
        pausedReason = settings.payouts_paused_reason ?? null
        console.log(`⏸️  Platform pause active since ${pausedSince} — ready_payout branch will be skipped this run`)
      }
    } catch (e: any) {
      console.warn('⚠️ platform_settings read threw; proceeding without pause check:', e?.message ?? e)
    }

    // Get all cycles that might need progression
    const { data: activeCycles, error: fetchError } = await supabase
      .from('circle_cycles')
      .select(`
        id,
        circle_id,
        cycle_number,
        cycle_status,
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
      .in('cycle_status', ['scheduled', 'collecting', 'deadline_reached', 'grace_period', 'ready_payout', 'payout_completed'])
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
        const previousStatus = cycle.cycle_status

        // Determine if transition is needed based on current status
        switch (cycle.cycle_status) {
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
            // Doc 39 Phase 3: skip payout execution entirely when platform
            // pause is active. Cycle stays in ready_payout and will be
            // re-picked-up on the next tick once pause clears. NO RPC
            // round-trip, NO payout_pending drift, NO log churn.
            if (isPaused) {
              payoutsSkippedDueToPause++
              console.log(`⏸️  Cycle ${cycle.id} (${(cycle.circles as any).name}): skipped — platform paused`)
              break
            }
            // Trigger payout when its expected date is reached. Two error
            // layers to keep the cycle honest:
            //   1. rpcRes.error → SDK-level failure (network, missing
            //      function, permission). Wrapped in try/catch because
            //      PostgrestBuilder doesn't implement .catch().
            //   2. rpcRes.data.success === false → the RPC itself
            //      returned a business-logic failure (zero_amount,
            //      no_recipient, wallet-credit rollback, …). Without
            //      this branch the cycle would flip to payout_completed
            //      even when no money actually moved — the bug that
            //      let Test Circle Payout 4 stay in a fake-completed
            //      state.
            if (cycle.expected_payout_date <= todayStr) {
              let rpcErr: string | null = null
              let rpcData: any = null
              try {
                const res = await supabase.rpc('execute_cycle_payout', {
                  p_cycle_id: cycle.id,
                })
                rpcData = res.data
                if (res.error) rpcErr = res.error.message
              } catch (e: any) {
                rpcErr = e?.message || 'RPC threw'
              }
              const rpcSaidFail = rpcData && typeof rpcData === 'object' && rpcData.success === false
              if (!rpcErr && !rpcSaidFail) {
                newStatus = 'payout_completed'
              } else {
                const detail = rpcErr || rpcData?.error || 'unknown_error'
                console.log(
                  `ℹ️ Cycle ${cycle.id}: Payout deferred (${detail}) — marking payout_pending for manual review`,
                )
                await supabase
                  .from('circle_cycles')
                  .update({
                    cycle_status: 'payout_pending',
                    status_changed_at: now.toISOString(),
                    notes: `Awaiting manual payout processing: ${detail}`,
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
              cycle_status: newStatus,
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
          previous_status: cycle.cycle_status,
          new_status: cycle.cycle_status,
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

    // Log job. PostgrestBuilder isn't a native Promise — `.catch()` on
    // its return threw at runtime ("supabase.from(...).insert(...).catch
    // is not a function"), aborting the whole function 500 before the
    // 200 response could ship. try/catch wrap keeps this fire-and-
    // forget for real.
    try {
      const { error: logErr } = await supabase
        .from('cron_job_logs')
        .insert({
          job_name: 'cycle-progression-cron',
          status: 'success',
          records_processed: activeCycles.length,
          records_succeeded: transitionCount,
          records_failed: 0,
          execution_time_ms: stats.processing_time_ms,
          details: {
            ...stats,
            paused:                            isPaused,
            payouts_skipped_due_to_pause:      payoutsSkippedDueToPause,
            paused_since:                      pausedSince,
            paused_by_admin_id:                pausedByAdminId,
            paused_reason:                     pausedReason,
          }
        })
      if (logErr) console.log('⚠️ Could not log job:', logErr.message)
    } catch (e: any) {
      console.log('⚠️ Could not log job (threw):', e?.message ?? e)
    }

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
