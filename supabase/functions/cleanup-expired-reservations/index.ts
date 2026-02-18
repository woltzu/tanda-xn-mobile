// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: cleanup-expired-reservations
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 02:00 UTC
// Purpose: Release expired wallet reservations back to available balance
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXPIRY_DAYS = 7 // Reservations expire after 7 days past due date

interface CleanupResult {
  reservation_id: string
  wallet_id: string
  user_id: string
  amount_released: number
  reason: string
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_checked: number
  released: number
  failed: number
  total_amount_released: number
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

    console.log('🧹 Starting expired reservation cleanup...')

    const now = new Date()
    const expiryThreshold = new Date(now.getTime() - EXPIRY_DAYS * 24 * 60 * 60 * 1000)
    const expiryDateStr = expiryThreshold.toISOString().split('T')[0]

    // Get expired reservations that haven't been used or released
    const { data: expiredReservations, error: fetchError } = await supabase
      .from('contribution_reservations')
      .select(`
        id,
        wallet_id,
        user_id,
        circle_id,
        amount_cents,
        due_date,
        reservation_status,
        user_wallets!wallet_id (
          id,
          user_id,
          reserved_balance_cents,
          main_balance_cents
        )
      `)
      .eq('reservation_status', 'reserved')
      .lt('due_date', expiryDateStr)

    if (fetchError) {
      throw new Error(`Failed to fetch expired reservations: ${fetchError.message}`)
    }

    if (!expiredReservations || expiredReservations.length === 0) {
      console.log('📭 No expired reservations to clean up')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expired reservations to clean up',
          stats: { total_checked: 0, released: 0, failed: 0, total_amount_released: 0, processing_time_ms: Date.now() - startTime }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${expiredReservations.length} expired reservations`)

    const results: CleanupResult[] = []
    let releasedCount = 0
    let failCount = 0
    let totalAmountReleased = 0

    for (const reservation of expiredReservations) {
      const wallet = reservation.user_wallets as any

      try {
        if (!wallet) {
          throw new Error('Wallet not found')
        }

        const amountToRelease = reservation.amount_cents

        // Update wallet: move from reserved to main balance
        const newReservedBalance = Math.max(0, wallet.reserved_balance_cents - amountToRelease)
        const newMainBalance = wallet.main_balance_cents + amountToRelease

        const { error: walletError } = await supabase
          .from('user_wallets')
          .update({
            reserved_balance_cents: newReservedBalance,
            main_balance_cents: newMainBalance,
            updated_at: now.toISOString()
          })
          .eq('id', wallet.id)

        if (walletError) {
          throw new Error(`Failed to update wallet: ${walletError.message}`)
        }

        // Update reservation status
        const { error: reservationError } = await supabase
          .from('contribution_reservations')
          .update({
            reservation_status: 'released',
            released_at: now.toISOString(),
            release_reason: 'expired'
          })
          .eq('id', reservation.id)

        if (reservationError) {
          throw new Error(`Failed to update reservation: ${reservationError.message}`)
        }

        // Record wallet transaction
        await supabase
          .from('wallet_transactions')
          .insert({
            wallet_id: wallet.id,
            user_id: reservation.user_id,
            transaction_type: 'reservation_release',
            direction: 'in',
            amount_cents: amountToRelease,
            balance_type: 'main',
            balance_before_cents: wallet.main_balance_cents,
            balance_after_cents: newMainBalance,
            reference_type: 'reservation',
            reference_id: reservation.id,
            description: `Released expired reservation for circle contribution`,
            transaction_status: 'completed'
          })
          .catch((e) => console.log(`ℹ️ Could not record transaction: ${e.message}`))

        results.push({
          reservation_id: reservation.id,
          wallet_id: wallet.id,
          user_id: reservation.user_id,
          amount_released: amountToRelease / 100,
          reason: 'expired',
          success: true
        })

        totalAmountReleased += amountToRelease / 100
        releasedCount++

        console.log(`✅ Reservation ${reservation.id}: Released $${(amountToRelease / 100).toFixed(2)}`)

      } catch (error: any) {
        console.error(`❌ Reservation ${reservation.id}: ${error.message}`)

        results.push({
          reservation_id: reservation.id,
          wallet_id: reservation.wallet_id,
          user_id: reservation.user_id,
          amount_released: 0,
          reason: 'error',
          success: false,
          error: error.message
        })

        failCount++
      }
    }

    const stats: ProcessingStats = {
      total_checked: expiredReservations.length,
      released: releasedCount,
      failed: failCount,
      total_amount_released: totalAmountReleased,
      processing_time_ms: Date.now() - startTime
    }

    // Log job
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'cleanup-expired-reservations',
        status: failCount === 0 ? 'success' : (releasedCount > 0 ? 'partial' : 'failed'),
        records_processed: expiredReservations.length,
        records_succeeded: releasedCount,
        records_failed: failCount,
        execution_time_ms: stats.processing_time_ms,
        details: stats
      })
      .catch(() => console.log('⚠️ Could not log job'))

    console.log(`\n🏁 Reservation cleanup complete!`)
    console.log(`   📊 Checked: ${expiredReservations.length}`)
    console.log(`   ✅ Released: ${releasedCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   💰 Total released: $${totalAmountReleased.toFixed(2)}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Reservation cleanup completed', stats }),
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
