// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: daily-interest-accrual
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Daily at 00:00 UTC
// Purpose: Accrue daily interest on all active loans
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AccrualResult {
  loan_id: string
  user_id: string
  principal_balance: number
  interest_accrued: number
  annual_rate: number
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_loans: number
  successful: number
  failed: number
  total_interest_accrued: number
  processing_time_ms: number
  results: AccrualResult[]
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
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🏦 Starting daily interest accrual...')

    // Get all active loans that need interest accrual
    const { data: activeLoans, error: loansError } = await supabase
      .from('loans')
      .select('id, user_id, outstanding_principal_cents, apr, status')
      .eq('status', 'active')
      .gt('outstanding_principal_cents', 0)

    if (loansError) {
      throw new Error(`Failed to fetch active loans: ${loansError.message}`)
    }

    if (!activeLoans || activeLoans.length === 0) {
      console.log('📭 No active loans to process')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active loans to process',
          stats: {
            total_loans: 0,
            successful: 0,
            failed: 0,
            total_interest_accrued: 0,
            processing_time_ms: Date.now() - startTime
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${activeLoans.length} active loans to process`)

    const results: AccrualResult[] = []
    let totalInterestAccrued = 0
    let successCount = 0
    let failCount = 0

    // Process each loan
    for (const loan of activeLoans) {
      try {
        // Calculate daily interest: (principal * APR) / 365
        const principalDollars = loan.outstanding_principal_cents / 100
        const dailyRate = loan.apr / 100 / 365
        const dailyInterest = principalDollars * dailyRate
        const dailyInterestCents = Math.round(dailyInterest * 100)

        // Skip if interest is negligible (less than 1 cent)
        if (dailyInterestCents < 1) {
          console.log(`⏭️ Loan ${loan.id}: Interest < 1 cent, skipping`)
          continue
        }

        // Insert interest accrual record
        const { error: accrualError } = await supabase
          .from('loan_interest_accruals')
          .insert({
            loan_id: loan.id,
            accrual_date: new Date().toISOString().split('T')[0],
            principal_balance_cents: loan.outstanding_principal_cents,
            annual_rate: loan.apr,
            daily_rate: dailyRate,
            interest_accrued_cents: dailyInterestCents,
            accrual_method: 'daily_simple',
            is_compounded: false
          })

        if (accrualError) {
          // Check if it's a duplicate (already accrued today)
          if (accrualError.code === '23505') {
            console.log(`⏭️ Loan ${loan.id}: Already accrued today, skipping`)
            continue
          }
          throw accrualError
        }

        // Update outstanding principal with accrued interest
        const { error: updateError } = await supabase
          .from('loans')
          .update({
            outstanding_principal_cents: loan.outstanding_principal_cents + dailyInterestCents,
            total_interest_accrued_cents: supabase.rpc('increment_field', {
              row_id: loan.id,
              field_name: 'total_interest_accrued_cents',
              increment_by: dailyInterestCents
            }),
            updated_at: new Date().toISOString()
          })
          .eq('id', loan.id)

        if (updateError) {
          // Try simpler update without RPC
          const { error: simpleUpdateError } = await supabase
            .from('loans')
            .update({
              outstanding_principal_cents: loan.outstanding_principal_cents + dailyInterestCents,
              updated_at: new Date().toISOString()
            })
            .eq('id', loan.id)

          if (simpleUpdateError) {
            throw simpleUpdateError
          }
        }

        results.push({
          loan_id: loan.id,
          user_id: loan.user_id,
          principal_balance: principalDollars,
          interest_accrued: dailyInterest,
          annual_rate: loan.apr,
          success: true
        })

        totalInterestAccrued += dailyInterest
        successCount++

        console.log(`✅ Loan ${loan.id}: Accrued $${dailyInterest.toFixed(4)} interest`)

      } catch (loanError: any) {
        console.error(`❌ Loan ${loan.id}: ${loanError.message}`)

        results.push({
          loan_id: loan.id,
          user_id: loan.user_id,
          principal_balance: loan.outstanding_principal_cents / 100,
          interest_accrued: 0,
          annual_rate: loan.apr,
          success: false,
          error: loanError.message
        })

        failCount++
      }
    }

    const stats: ProcessingStats = {
      total_loans: activeLoans.length,
      successful: successCount,
      failed: failCount,
      total_interest_accrued: totalInterestAccrued,
      processing_time_ms: Date.now() - startTime,
      results
    }

    // Log summary to cron_job_logs table
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'daily-interest-accrual',
        status: failCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed'),
        records_processed: activeLoans.length,
        records_succeeded: successCount,
        records_failed: failCount,
        execution_time_ms: stats.processing_time_ms,
        details: {
          total_interest_accrued: totalInterestAccrued,
          date: new Date().toISOString().split('T')[0]
        }
      })
      .then(() => console.log('📝 Job logged'))
      .catch((e) => console.log('⚠️ Could not log job (table may not exist)'))

    console.log(`\n🏁 Daily interest accrual complete!`)
    console.log(`   ✅ Successful: ${successCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   💰 Total interest: $${totalInterestAccrued.toFixed(2)}`)
    console.log(`   ⏱️ Time: ${stats.processing_time_ms}ms`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Daily interest accrual completed',
        stats
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('💥 Fatal error:', error.message)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        processing_time_ms: Date.now() - startTime
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
