// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: process-autopay
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 06:00 UTC
// Purpose: Execute autopay for due loan payment obligations
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AutopayResult {
  config_id: string
  loan_id: string
  user_id: string
  obligation_id: string
  amount_paid: number
  autopay_type: string
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_autopays: number
  successful: number
  failed: number
  skipped: number
  total_amount_processed: number
  processing_time_ms: number
  results: AutopayResult[]
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

    console.log('💳 Starting autopay processing...')

    // Get all active autopay configs with due obligations
    const { data: autopayQueue, error: queueError } = await supabase
      .from('loan_autopay_configs')
      .select(`
        id,
        loan_id,
        autopay_type,
        fixed_amount_cents,
        max_amount_cents,
        status,
        consecutive_failures,
        loans!inner (
          id,
          user_id,
          status,
          outstanding_principal_cents
        )
      `)
      .eq('status', 'active')
      .eq('loans.status', 'active')
      .lt('consecutive_failures', 3)

    if (queueError) {
      throw new Error(`Failed to fetch autopay queue: ${queueError.message}`)
    }

    if (!autopayQueue || autopayQueue.length === 0) {
      console.log('📭 No autopay configs to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No autopay configs to process',
          stats: { total_autopays: 0, successful: 0, failed: 0, skipped: 0, total_amount_processed: 0, processing_time_ms: Date.now() - startTime }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${autopayQueue.length} autopay configs to process`)

    const results: AutopayResult[] = []
    let successCount = 0
    let failCount = 0
    let skipCount = 0
    let totalProcessed = 0

    for (const config of autopayQueue) {
      const loan = config.loans as any
      const userId = loan.user_id

      try {
        // Get the next due/upcoming obligation for this loan
        const { data: obligation, error: obligationError } = await supabase
          .from('loan_payment_obligations')
          .select('*')
          .eq('loan_id', config.loan_id)
          .in('status', ['due', 'upcoming', 'overdue'])
          .lte('due_date', new Date().toISOString().split('T')[0])
          .order('due_date', { ascending: true })
          .limit(1)
          .single()

        if (obligationError || !obligation) {
          console.log(`⏭️ Config ${config.id}: No due obligation, skipping`)
          skipCount++
          continue
        }

        // Calculate amount to pay based on autopay type
        let amountToPay = 0
        const remainingDue = obligation.total_due_cents - obligation.total_paid_cents

        switch (config.autopay_type) {
          case 'minimum':
            amountToPay = Math.min(obligation.minimum_payment_cents || remainingDue, remainingDue)
            break
          case 'scheduled':
            amountToPay = remainingDue
            break
          case 'fixed':
            amountToPay = Math.min(config.fixed_amount_cents || remainingDue, remainingDue)
            break
          case 'full_balance':
            amountToPay = loan.outstanding_principal_cents
            break
          default:
            amountToPay = remainingDue
        }

        // Apply max amount cap if set
        if (config.max_amount_cents && amountToPay > config.max_amount_cents) {
          amountToPay = config.max_amount_cents
        }

        if (amountToPay <= 0) {
          console.log(`⏭️ Config ${config.id}: Nothing to pay, skipping`)
          skipCount++
          continue
        }

        // Get user's wallet balance
        const { data: wallet, error: walletError } = await supabase
          .from('user_wallets')
          .select('id, available_balance_cents')
          .eq('user_id', userId)
          .single()

        if (walletError || !wallet) {
          throw new Error('User wallet not found')
        }

        // Check sufficient balance
        if (wallet.available_balance_cents < amountToPay) {
          // Record failure
          await supabase
            .from('loan_autopay_configs')
            .update({
              consecutive_failures: config.consecutive_failures + 1,
              last_failure_reason: 'Insufficient wallet balance',
              last_attempt_at: new Date().toISOString()
            })
            .eq('id', config.id)

          throw new Error(`Insufficient balance: need ${amountToPay / 100}, have ${wallet.available_balance_cents / 100}`)
        }

        // Process the payment - debit wallet
        const { error: debitError } = await supabase
          .from('user_wallets')
          .update({
            main_balance_cents: wallet.available_balance_cents - amountToPay,
            updated_at: new Date().toISOString()
          })
          .eq('id', wallet.id)

        if (debitError) {
          throw new Error(`Failed to debit wallet: ${debitError.message}`)
        }

        // Record wallet transaction
        await supabase
          .from('wallet_transactions')
          .insert({
            wallet_id: wallet.id,
            user_id: userId,
            transaction_type: 'autopay_payment',
            direction: 'out',
            amount_cents: amountToPay,
            balance_type: 'main',
            balance_before_cents: wallet.available_balance_cents,
            balance_after_cents: wallet.available_balance_cents - amountToPay,
            reference_type: 'loan_payment',
            reference_id: obligation.id,
            description: `Autopay for loan obligation #${obligation.obligation_number}`,
            transaction_status: 'completed'
          })

        // Update obligation
        const newPaidAmount = obligation.total_paid_cents + amountToPay
        const newStatus = newPaidAmount >= obligation.total_due_cents ? 'paid' : 'partial'

        const { error: obligationUpdateError } = await supabase
          .from('loan_payment_obligations')
          .update({
            total_paid_cents: newPaidAmount,
            status: newStatus,
            last_payment_at: new Date().toISOString(),
            paid_via: 'autopay',
            updated_at: new Date().toISOString()
          })
          .eq('id', obligation.id)

        if (obligationUpdateError) {
          throw new Error(`Failed to update obligation: ${obligationUpdateError.message}`)
        }

        // Update loan outstanding balance
        await supabase
          .from('loans')
          .update({
            outstanding_principal_cents: Math.max(0, loan.outstanding_principal_cents - amountToPay),
            updated_at: new Date().toISOString()
          })
          .eq('id', config.loan_id)

        // Award XnScore points for on-time payment
        if (newStatus === 'paid') {
          await supabase.rpc('award_xnscore_points', {
            p_user_id: userId,
            p_points: 3,
            p_event_type: 'loan_payment_ontime',
            p_details: { loan_id: config.loan_id, obligation_id: obligation.id }
          }).catch(() => {
            // XnScore function might not exist, that's ok
            console.log(`ℹ️ Could not award XnScore points`)
          })
        }

        // Reset autopay failures on success
        await supabase
          .from('loan_autopay_configs')
          .update({
            consecutive_failures: 0,
            last_success_at: new Date().toISOString(),
            last_attempt_at: new Date().toISOString(),
            last_failure_reason: null
          })
          .eq('id', config.id)

        results.push({
          config_id: config.id,
          loan_id: config.loan_id,
          user_id: userId,
          obligation_id: obligation.id,
          amount_paid: amountToPay / 100,
          autopay_type: config.autopay_type,
          success: true
        })

        totalProcessed += amountToPay / 100
        successCount++

        console.log(`✅ Config ${config.id}: Paid $${(amountToPay / 100).toFixed(2)} via ${config.autopay_type}`)

      } catch (error: any) {
        console.error(`❌ Config ${config.id}: ${error.message}`)

        results.push({
          config_id: config.id,
          loan_id: config.loan_id,
          user_id: loan.user_id,
          obligation_id: '',
          amount_paid: 0,
          autopay_type: config.autopay_type,
          success: false,
          error: error.message
        })

        failCount++
      }
    }

    const stats: ProcessingStats = {
      total_autopays: autopayQueue.length,
      successful: successCount,
      failed: failCount,
      skipped: skipCount,
      total_amount_processed: totalProcessed,
      processing_time_ms: Date.now() - startTime,
      results
    }

    // Log job
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'process-autopay',
        status: failCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed'),
        records_processed: autopayQueue.length,
        records_succeeded: successCount,
        records_failed: failCount,
        execution_time_ms: stats.processing_time_ms,
        details: { total_amount_processed: totalProcessed, skipped: skipCount }
      })
      .catch(() => console.log('⚠️ Could not log job'))

    console.log(`\n🏁 Autopay processing complete!`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   ⏭️ Skipped: ${skipCount}`)
    console.log(`   💰 Total processed: $${totalProcessed.toFixed(2)}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Autopay processing completed', stats }),
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
