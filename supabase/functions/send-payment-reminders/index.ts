// ══════════════════════════════════════════════════════════════════════════════
// EDGE FUNCTION: send-payment-reminders
// ══════════════════════════════════════════════════════════════════════════════
// Schedule: Every 4 hours
// Purpose: Process and send due payment reminders via push/email/SMS
// ══════════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReminderResult {
  reminder_id: string
  user_id: string
  channel: string
  reminder_type: string
  success: boolean
  error?: string
}

interface ProcessingStats {
  total_reminders: number
  sent: number
  failed: number
  processing_time_ms: number
  by_channel: { push: number; email: number; sms: number }
  by_type: Record<string, number>
}

// Notification sending functions (placeholders - integrate with actual services)
async function sendPushNotification(userId: string, title: string, message: string, data?: any): Promise<boolean> {
  // TODO: Integrate with Firebase Cloud Messaging or Expo Push
  console.log(`📱 PUSH to ${userId}: ${title}`)
  // For now, simulate success
  return true
}

async function sendEmailNotification(email: string, subject: string, body: string): Promise<boolean> {
  // TODO: Integrate with Resend, SendGrid, or similar
  console.log(`📧 EMAIL to ${email}: ${subject}`)
  // For now, simulate success
  return true
}

async function sendSmsNotification(phone: string, message: string): Promise<boolean> {
  // TODO: Integrate with Twilio or Africa's Talking
  console.log(`📱 SMS to ${phone}: ${message}`)
  // For now, simulate success
  return true
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

    console.log('🔔 Starting payment reminder processing...')

    // Get all scheduled reminders that are due
    const { data: dueReminders, error: remindersError } = await supabase
      .from('loan_payment_reminders')
      .select(`
        id,
        loan_id,
        user_id,
        reminder_type,
        channel,
        scheduled_for,
        title,
        message,
        amount_due_cents,
        due_date,
        status,
        profiles!inner (
          id,
          full_name,
          email,
          phone
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true })
      .limit(100)

    if (remindersError) {
      throw new Error(`Failed to fetch reminders: ${remindersError.message}`)
    }

    if (!dueReminders || dueReminders.length === 0) {
      console.log('📭 No reminders to send')
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No reminders to send',
          stats: { total_reminders: 0, sent: 0, failed: 0, processing_time_ms: Date.now() - startTime, by_channel: { push: 0, email: 0, sms: 0 }, by_type: {} }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`📊 Found ${dueReminders.length} reminders to send`)

    const results: ReminderResult[] = []
    let sentCount = 0
    let failCount = 0
    const byChannel = { push: 0, email: 0, sms: 0 }
    const byType: Record<string, number> = {}

    for (const reminder of dueReminders) {
      const profile = reminder.profiles as any

      try {
        let sent = false

        // Format the message with amount
        const formattedAmount = reminder.amount_due_cents
          ? `$${(reminder.amount_due_cents / 100).toFixed(2)}`
          : ''

        const personalizedMessage = reminder.message
          .replace('{name}', profile.full_name || 'there')
          .replace('{amount}', formattedAmount)
          .replace('{due_date}', reminder.due_date || '')

        const personalizedTitle = reminder.title
          .replace('{amount}', formattedAmount)

        // Send based on channel
        switch (reminder.channel) {
          case 'push':
            sent = await sendPushNotification(
              reminder.user_id,
              personalizedTitle,
              personalizedMessage,
              { loan_id: reminder.loan_id, reminder_type: reminder.reminder_type }
            )
            if (sent) byChannel.push++
            break

          case 'email':
            if (profile.email) {
              sent = await sendEmailNotification(
                profile.email,
                personalizedTitle,
                personalizedMessage
              )
              if (sent) byChannel.email++
            } else {
              throw new Error('No email address on file')
            }
            break

          case 'sms':
            if (profile.phone) {
              sent = await sendSmsNotification(
                profile.phone,
                personalizedMessage
              )
              if (sent) byChannel.sms++
            } else {
              throw new Error('No phone number on file')
            }
            break

          default:
            // Default to push
            sent = await sendPushNotification(
              reminder.user_id,
              personalizedTitle,
              personalizedMessage
            )
            if (sent) byChannel.push++
        }

        if (sent) {
          // Update reminder status
          await supabase
            .from('loan_payment_reminders')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', reminder.id)

          results.push({
            reminder_id: reminder.id,
            user_id: reminder.user_id,
            channel: reminder.channel,
            reminder_type: reminder.reminder_type,
            success: true
          })

          byType[reminder.reminder_type] = (byType[reminder.reminder_type] || 0) + 1
          sentCount++

          console.log(`✅ Reminder ${reminder.id}: Sent ${reminder.reminder_type} via ${reminder.channel}`)
        } else {
          throw new Error('Send function returned false')
        }

      } catch (error: any) {
        console.error(`❌ Reminder ${reminder.id}: ${error.message}`)

        // Update reminder status to failed
        await supabase
          .from('loan_payment_reminders')
          .update({
            status: 'failed',
            failure_reason: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', reminder.id)

        results.push({
          reminder_id: reminder.id,
          user_id: reminder.user_id,
          channel: reminder.channel,
          reminder_type: reminder.reminder_type,
          success: false,
          error: error.message
        })

        failCount++
      }
    }

    const stats: ProcessingStats = {
      total_reminders: dueReminders.length,
      sent: sentCount,
      failed: failCount,
      processing_time_ms: Date.now() - startTime,
      by_channel: byChannel,
      by_type: byType
    }

    // Log job
    await supabase
      .from('cron_job_logs')
      .insert({
        job_name: 'send-payment-reminders',
        status: failCount === 0 ? 'success' : (sentCount > 0 ? 'partial' : 'failed'),
        records_processed: dueReminders.length,
        records_succeeded: sentCount,
        records_failed: failCount,
        execution_time_ms: stats.processing_time_ms,
        details: { by_channel: byChannel, by_type: byType }
      })
      .catch(() => console.log('⚠️ Could not log job'))

    console.log(`\n🏁 Reminder processing complete!`)
    console.log(`   ✅ Sent: ${sentCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   📱 Push: ${byChannel.push}, 📧 Email: ${byChannel.email}, 💬 SMS: ${byChannel.sms}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Reminder processing completed', stats }),
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
