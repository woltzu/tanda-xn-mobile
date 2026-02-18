// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: update-overdue-obligations
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 01:00 UTC
// Purpose: Mark late obligations as overdue and apply late fees
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GRACE_PERIOD_DAYS = 5
const LATE_FEE_PERCENT = 0.05 // 5%

interface OverdueResult {
  obligation_id: string
  loan_id: string
  user_id: string
  days_overdue: number
  late_fee_applied: number
  previous_status: string
  new_status: string
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_checked: number
  newly_overdue: number
  late_fees_applied: number
  total_late_fees: number
  xnscore_deductions: number
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

    console.log('⏰ Starting overdue obligations check...')

    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Get all unpaid obligations that are past due date
    const { data: unpaidObligations, error: fetchError } = await supabase
      .from('loan_payment_obligations')
      .select(`
        id,
        loan_id,
        user_id,
        obligation_number,
        due_date,
        total_due_cents,
        total_paid_cents,
        late_fee_cents,
        status,
        grace_period_ends_at,
        loans!inner (
          id,
          user_id,
          status
        )
      `)
      .in('status', ['due', 'upcoming', 'partial'])
      .lt('due_date', todayStr)
      .eq('loans.status', 'active')

    if (fetchError) {
      throw new Error(`Failed to fetch obligations: ${fetchError.message}`)
    }

    if (!unpaidObligations || unpaidObligations.length === 0) {
      console.log('📭 No overdue obligations to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No overdue obligations to process',
          stats: { total_checked: 0, newly_overdue: 0, late_fees_applied: 0, total_late_fees: 0, xnscore_deductions: 0, processing_time_ms: Date.now() - startTime }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${unpaidObligations.length} unpaid obligations past due date`)

    const results: OverdueResult[] = []
    let newlyOverdueCount = 0
    let lateFeesApplied = 0
    let totalLateFees = 0
    let xnscoreDeductions = 0

    for (const obligation of unpaidObligations) {
      try {
        const dueDate = new Date(obligation.due_date)
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

        // Skip if not yet past grace period for status change
        const gracePeriodEnd = obligation.grace_period_ends_at
          ? new Date(obligation.grace_period_ends_at)
          : new Date(dueDate.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)

        const updates: any = {
          updated_at: new Date().toISOString()
        }

        let lateFeeApplied = 0
        let statusChanged = false

        // Update status to overdue if past grace period
        if (obligation.status !== 'overdue' && today > gracePeriodEnd) {
          updates.status = 'overdue'
          statusChanged = true
          newlyOverdueCount++

          // Deduct XnScore points (-5 for late)
          await supabase.rpc('deduct_xnscore_points', {
            p_user_id: obligation.user_id,
            p_points: 5,
            p_event_type: 'loan_payment_late',
            p_details: { loan_id: obligation.loan_id, obligation_id: obligation.id, days_overdue: daysOverdue }
          }).catch(() => {
            console.log(`ℹ️ Could not deduct XnScore points for ${obligation.user_id}`)
          })

          xnscoreDeductions++
        }

        // Apply late fee if past grace period and no late fee yet
        if (today > gracePeriodEnd && (obligation.late_fee_cents || 0) === 0) {
          const remainingDue = obligation.total_due_cents - obligation.total_paid_cents
          lateFeeApplied = Math.round(remainingDue * LATE_FEE_PERCENT)

          if (lateFeeApplied > 0) {
            updates.late_fee_cents = lateFeeApplied
            updates.total_due_cents = obligation.total_due_cents + lateFeeApplied

            // Record late fee in loan_late_fees table
            await supabase
              .from('loan_late_fees')
              .insert({
                loan_id: obligation.loan_id,
                obligation_id: obligation.id,
                user_id: obligation.user_id,
                days_overdue: daysOverdue,
                principal_at_assessment_cents: remainingDue,
                fee_rate: LATE_FEE_PERCENT,
                calculated_fee_cents: lateFeeApplied,
                status: 'pending',
                assessed_at: new Date().toISOString()
              })
              .catch((e) => console.log(`ℹ️ Could not record late fee: ${e.message}`))

            lateFeesApplied++
            totalLateFees += lateFeeApplied / 100
          }
        }

        // Set grace period end if not set
        if (!obligation.grace_period_ends_at) {
          updates.grace_period_ends_at = gracePeriodEnd.toISOString()
        }

        // Apply updates
        if (Object.keys(updates).length > 1) { // More than just updated_at
          const { error: updateError } = await supabase
            .from('loan_payment_obligations')
            .update(updates)
            .eq('id', obligation.id)

          if (updateError) {
            throw new Error(`Failed to update obligation: ${updateError.message}`)
          }
        }

        // Schedule overdue reminder if newly overdue
        if (statusChanged) {
          await supabase
            .from('loan_payment_reminders')
            .insert({
              loan_id: obligation.loan_id,
              user_id: obligation.user_id,
              reminder_type: 'overdue_1d',
              channel: 'push',
              scheduled_for: new Date().toISOString(),
              title: 'Payment Overdue',
              message: `Hi {name}, your payment of {amount} is now overdue. Please pay as soon as possible to avoid additional fees.`,
              amount_due_cents: obligation.total_due_cents - obligation.total_paid_cents + lateFeeApplied,
              due_date: obligation.due_date,
              status: 'scheduled'
            })
            .catch(() => console.log(`ℹ️ Could not schedule reminder`))
        }

        results.push({
          obligation_id: obligation.id,
          loan_id: obligation.loan_id,
          user_id: obligation.user_id,
          days_overdue: daysOverdue,
          late_fee_applied: lateFeeApplied / 100,
          previous_status: obligation.status,
          new_status: updates.status || obligation.status,
          success: true
        })

        if (statusChanged || lateFeeApplied > 0) {
          console.log(`✅ Obligation ${obligation.id}: ${daysOverdue} days overdue, status=${updates.status || obligation.status}, late fee=$${(lateFeeApplied / 100).toFixed(2)}`)
        }

      } catch (error: any) {
        console.error(`❌ Obligation ${obligation.id}: ${error.message}`)

        results.push({
          obligation_id: obligation.id,
          loan_id: obligation.loan_id,
          user_id: obligation.user_id,
          days_overdue: 0,
          late_fee_applied: 0,
          previous_status: obligation.status,
          new_status: obligation.status,
          success: false,
          error: error.message
        })
      }
    }

    const stats: ProcessingStats = {
      total_checked: unpaidObligations.length,
      newly_overdue: newlyOverdueCount,
      late_fees_applied: lateFeesApplied,
      total_late_fees: totalLateFees,
      xnscore_deductions: xnscoreDeductions,
      processing_time_ms: Date.now() - startTime
    }

    // Log job
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'update-overdue-obligations',
        status: 'success',
        records_processed: unpaidObligations.length,
        records_succeeded: newlyOverdueCount + lateFeesApplied,
        records_failed: 0,
        execution_time_ms: stats.processing_time_ms,
        details: stats
      })
      .catch(() => console.log('⚠️ Could not log job'))

    console.log(`\n🏁 Overdue check complete!`)
    console.log(`   📊 Checked: ${unpaidObligations.length}`)
    console.log(`   ⚠️ Newly overdue: ${newlyOverdueCount}`)
    console.log(`   💸 Late fees applied: ${lateFeesApplied} ($${totalLateFees.toFixed(2)})`)
    console.log(`   📉 XnScore deductions: ${xnscoreDeductions}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Overdue check completed', stats }),
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
