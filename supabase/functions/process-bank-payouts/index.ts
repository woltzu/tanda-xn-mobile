// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: process-bank-payouts
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 08:00 UTC
// Purpose: Execute pending bank/mobile money transfers
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Payment gateway integration placeholders
// TODO: Replace with actual Stripe/Flutterwave implementations

interface PaymentGatewayResult {
  success: boolean
  transaction_id?: string
  error?: string
  status: 'completed' | 'pending' | 'failed'
}

async function initiateStripeTransfer(
  amount: number,
  currency: string,
  destination: string,
  metadata: any
): Promise<PaymentGatewayResult> {
  // TODO: Integrate with Stripe Connect for payouts
  console.log(`💳 STRIPE: Transfer $${amount} ${currency} to ${destination}`)

  // Simulate successful transfer
  return {
    success: true,
    transaction_id: `stripe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'pending' // Bank transfers are typically pending until confirmed
  }
}

async function initiateFlutterwaveTransfer(
  amount: number,
  currency: string,
  bankCode: string,
  accountNumber: string,
  accountName: string,
  metadata: any
): Promise<PaymentGatewayResult> {
  // TODO: Integrate with Flutterwave for African bank transfers
  console.log(`🌊 FLUTTERWAVE: Transfer ${currency} ${amount} to ${accountNumber}`)

  // Simulate successful transfer
  return {
    success: true,
    transaction_id: `flw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'pending'
  }
}

async function initiateMobileMoneyTransfer(
  amount: number,
  currency: string,
  provider: string,
  phoneNumber: string,
  metadata: any
): Promise<PaymentGatewayResult> {
  // TODO: Integrate with mobile money APIs (M-Pesa, MTN MoMo, etc.)
  console.log(`📱 MOBILE MONEY (${provider}): Transfer ${currency} ${amount} to ${phoneNumber}`)

  // Simulate successful transfer
  return {
    success: true,
    transaction_id: `momo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'completed' // Mobile money is usually instant
  }
}

interface PayoutResult {
  payout_id: string
  user_id: string
  amount: number
  destination_type: string
  success: boolean
  transaction_id?: string
  error?: string
}

interface ProcessingStats {
  total_payouts: number
  successful: number
  failed: number
  pending: number
  total_amount: number
  by_type: Record<string, number>
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

    console.log('🏦 Starting bank payout processing...')

    // Get pending payout executions that are for external destinations
    const { data: pendingPayouts, error: fetchError } = await supabase
      .from('payout_executions')
      .select(`
        id,
        circle_id,
        cycle_id,
        recipient_user_id,
        net_amount_cents,
        distribution,
        execution_status,
        retry_count,
        profiles!recipient_user_id (
          id,
          full_name,
          email,
          phone
        ),
        payout_preferences (
          destination,
          bank_account_id
        )
      `)
      .eq('execution_status', 'pending')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      throw new Error(`Failed to fetch pending payouts: ${fetchError.message}`)
    }

    if (!pendingPayouts || pendingPayouts.length === 0) {
      console.log('📭 No pending payouts to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No pending payouts to process',
          stats: { total_payouts: 0, successful: 0, failed: 0, pending: 0, total_amount: 0, by_type: {}, processing_time_ms: Date.now() - startTime }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${pendingPayouts.length} pending payouts`)

    const results: PayoutResult[] = []
    let successCount = 0
    let failCount = 0
    let pendingCount = 0
    let totalAmount = 0
    const byType: Record<string, number> = {}

    for (const payout of pendingPayouts) {
      const profile = payout.profiles as any
      const preferences = payout.payout_preferences as any
      const amountDollars = payout.net_amount_cents / 100

      try {
        // Determine destination type from preferences or distribution
        let destinationType = 'wallet' // default
        let gatewayResult: PaymentGatewayResult | null = null

        if (preferences?.destination) {
          destinationType = preferences.destination
        } else if (payout.distribution) {
          // Check distribution for non-wallet destinations
          const dist = typeof payout.distribution === 'string'
            ? JSON.parse(payout.distribution)
            : payout.distribution

          if (dist.bank_transfer_cents > 0) destinationType = 'bank'
          else if (dist.mobile_money_cents > 0) destinationType = 'mobile_money'
        }

        byType[destinationType] = (byType[destinationType] || 0) + 1

        // Skip wallet payouts (already handled internally)
        if (destinationType === 'wallet') {
          console.log(`⏭️ Payout ${payout.id}: Wallet destination, handled internally`)

          // Mark as completed for wallet payouts
          await supabase
            .from('payout_executions')
            .update({
              execution_status: 'completed',
              executed_at: new Date().toISOString(),
              completed_at: new Date().toISOString()
            })
            .eq('id', payout.id)

          successCount++
          continue
        }

        // Update status to processing
        await supabase
          .from('payout_executions')
          .update({
            execution_status: 'processing',
            executed_at: new Date().toISOString()
          })
          .eq('id', payout.id)

        // Process based on destination type
        switch (destinationType) {
          case 'bank':
            // Get bank account details
            if (preferences?.bank_account_id) {
              const { data: bankAccount } = await supabase
                .from('user_bank_accounts')
                .select('*')
                .eq('id', preferences.bank_account_id)
                .single()

              if (bankAccount) {
                gatewayResult = await initiateStripeTransfer(
                  amountDollars,
                  'USD',
                  bankAccount.stripe_account_id || bankAccount.account_number,
                  { payout_id: payout.id, user_id: payout.recipient_user_id }
                )
              } else {
                throw new Error('Bank account not found')
              }
            } else {
              throw new Error('No bank account configured')
            }
            break

          case 'mobile_money':
            if (profile?.phone) {
              gatewayResult = await initiateMobileMoneyTransfer(
                amountDollars,
                'USD',
                'mpesa', // TODO: Get from user preferences
                profile.phone,
                { payout_id: payout.id, user_id: payout.recipient_user_id }
              )
            } else {
              throw new Error('No phone number for mobile money')
            }
            break

          case 'flutterwave':
            // African bank transfer via Flutterwave
            const { data: flwAccount } = await supabase
              .from('user_bank_accounts')
              .select('*')
              .eq('user_id', payout.recipient_user_id)
              .eq('provider', 'flutterwave')
              .single()

            if (flwAccount) {
              gatewayResult = await initiateFlutterwaveTransfer(
                amountDollars,
                flwAccount.currency || 'NGN',
                flwAccount.bank_code,
                flwAccount.account_number,
                flwAccount.account_name,
                { payout_id: payout.id }
              )
            } else {
              throw new Error('No Flutterwave account configured')
            }
            break

          default:
            throw new Error(`Unknown destination type: ${destinationType}`)
        }

        // Handle gateway result
        if (gatewayResult?.success) {
          const newStatus = gatewayResult.status === 'completed' ? 'completed' : 'processing'

          await supabase
            .from('payout_executions')
            .update({
              execution_status: newStatus,
              bank_transfer_movement_id: gatewayResult.transaction_id,
              completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
              updated_at: new Date().toISOString()
            })
            .eq('id', payout.id)

          results.push({
            payout_id: payout.id,
            user_id: payout.recipient_user_id,
            amount: amountDollars,
            destination_type: destinationType,
            success: true,
            transaction_id: gatewayResult.transaction_id
          })

          if (newStatus === 'completed') {
            successCount++
          } else {
            pendingCount++
          }

          totalAmount += amountDollars
          console.log(`✅ Payout ${payout.id}: $${amountDollars} via ${destinationType} → ${gatewayResult.status}`)

        } else {
          throw new Error(gatewayResult?.error || 'Gateway returned failure')
        }

      } catch (error: any) {
        console.error(`❌ Payout ${payout.id}: ${error.message}`)

        // Update with failure
        await supabase
          .from('payout_executions')
          .update({
            execution_status: 'failed',
            error_message: error.message,
            retry_count: payout.retry_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', payout.id)

        results.push({
          payout_id: payout.id,
          user_id: payout.recipient_user_id,
          amount: amountDollars,
          destination_type: 'unknown',
          success: false,
          error: error.message
        })

        failCount++
      }
    }

    const stats: ProcessingStats = {
      total_payouts: pendingPayouts.length,
      successful: successCount,
      failed: failCount,
      pending: pendingCount,
      total_amount: totalAmount,
      by_type: byType,
      processing_time_ms: Date.now() - startTime
    }

    // Log job
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'process-bank-payouts',
        status: failCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed'),
        records_processed: pendingPayouts.length,
        records_succeeded: successCount,
        records_failed: failCount,
        execution_time_ms: stats.processing_time_ms,
        details: stats
      })
      .catch(() => console.log('⚠️ Could not log job'))

    console.log(`\n🏁 Bank payout processing complete!`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ⏳ Pending: ${pendingCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   💰 Total: $${totalAmount.toFixed(2)}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Bank payout processing completed', stats }),
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
