/**
 * NotificationPriorityEngine.ts
 *
 * Intelligence layer between event producers and notification delivery.
 * Every notification is scored, routed, and framed before delivery:
 * 1. Priority scoring — time sensitivity, financial stakes, member stress, fatigue
 * 2. Channel selection — personalized based on historical open rates
 * 3. Framing adaptation — message variant selected per member profile
 * 4. Fatigue management — prevents over-notification and permanent ignore
 * 5. Quiet hours enforcement — respects member timezone
 * 6. Template rendering — {{placeholder}} substitution
 */

import { supabase } from '../lib/supabase';
import { scoringPipelineService } from './ScoringPipelineService';

// ══════════════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════════════

export type NotificationType =
  | 'payment_critical'
  | 'circle_events'
  | 'score_changes'
  | 'coaching_goals'
  | 'platform_community';

export type NotificationChannel = 'push' | 'sms' | 'email' | 'in_app';

export type QueueStatus =
  | 'pending'
  | 'scored'
  | 'delivering'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export type FramingVariant =
  | 'urgent'
  | 'supportive'
  | 'celebratory'
  | 'informational'
  | 'empathetic';

export interface QueueItem {
  id: string;
  memberId: string;
  notificationType: NotificationType;
  priorityScore: number | null;
  channel: NotificationChannel | null;
  templateVariantIndex: number | null;
  title: string | null;
  body: string | null;
  data: Record<string, any>;
  scheduledDeliveryTime: string | null;
  status: QueueStatus;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  notificationId: string | null;
  scoringDetails: Record<string, any>;
  framingDetails: Record<string, any>;
  failureReason: string | null;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemberNotificationProfile {
  id: string;
  userId: string;
  pushOpenRate: number;
  smsOpenRate: number;
  emailOpenRate: number;
  inAppOpenRate: number;
  pushSent: number;
  pushOpened: number;
  pushClicked: number;
  smsSent: number;
  smsOpened: number;
  emailSent: number;
  emailOpened: number;
  emailClicked: number;
  inAppSent: number;
  inAppOpened: number;
  inAppClicked: number;
  fatigueScore: number;
  lastNotificationAt: string | null;
  notificationsLast24h: number;
  notificationsLast48h: number;
  opensLast48h: number;
  bestHourPush: number | null;
  bestHourSms: number | null;
  bestHourEmail: number | null;
  preferredStyle: FramingVariant;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationTemplate {
  id: string;
  notificationType: NotificationType;
  variantIndex: number;
  variantName: FramingVariant;
  titleTemplate: string;
  bodyTemplate: string;
  dataTemplate: Record<string, any>;
  active: boolean;
  createdAt: string;
}

export interface ScoringBreakdown {
  timeSensitivity: number;    // 0-40
  financialStakes: number;    // 0-25
  memberStress: number;       // 0-15
  fatigueAdjustment: number;  // -20 to 0
  engagementBonus: number;    // 0-10
  typeBasePriority: number;   // 0-10
}

export interface ScoringResult {
  priorityScore: number;
  breakdown: ScoringBreakdown;
}

export interface ChannelSelection {
  primaryChannel: NotificationChannel;
  fallbackChannel: NotificationChannel | null;
  reason: string;
  delayed: boolean;
  deliveryTime: string | null;
}

export interface FramingSelection {
  variantIndex: number;
  variantName: FramingVariant;
  reason: string;
}

export interface EnqueueResult {
  queueId: string;
  status: QueueStatus;
  scheduledDeliveryTime: string | null;
  priorityScore: number | null;
  channel: NotificationChannel | null;
  variantName: FramingVariant | null;
}

export interface ProcessQueueResult {
  processed: number;
  delivered: number;
  failed: number;
  delayed: number;
  errors: string[];
}


// ══════════════════════════════════════════════════════════════════════════════
// MAPPERS
// ══════════════════════════════════════════════════════════════════════════════

function mapQueueItem(row: any): QueueItem {
  return {
    id: row.id,
    memberId: row.member_id,
    notificationType: row.notification_type,
    priorityScore: row.priority_score,
    channel: row.channel,
    templateVariantIndex: row.template_variant_index,
    title: row.title,
    body: row.body,
    data: row.data || {},
    scheduledDeliveryTime: row.scheduled_delivery_time,
    status: row.status,
    deliveredAt: row.delivered_at,
    openedAt: row.opened_at,
    clickedAt: row.clicked_at,
    notificationId: row.notification_id,
    scoringDetails: row.scoring_details || {},
    framingDetails: row.framing_details || {},
    failureReason: row.failure_reason,
    retryCount: row.retry_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapNotificationProfile(row: any): MemberNotificationProfile {
  return {
    id: row.id,
    userId: row.user_id,
    pushOpenRate: parseFloat(row.push_open_rate) || 0,
    smsOpenRate: parseFloat(row.sms_open_rate) || 0,
    emailOpenRate: parseFloat(row.email_open_rate) || 0,
    inAppOpenRate: parseFloat(row.in_app_open_rate) || 0,
    pushSent: row.push_sent || 0,
    pushOpened: row.push_opened || 0,
    pushClicked: row.push_clicked || 0,
    smsSent: row.sms_sent || 0,
    smsOpened: row.sms_opened || 0,
    emailSent: row.email_sent || 0,
    emailOpened: row.email_opened || 0,
    emailClicked: row.email_clicked || 0,
    inAppSent: row.in_app_sent || 0,
    inAppOpened: row.in_app_opened || 0,
    inAppClicked: row.in_app_clicked || 0,
    fatigueScore: row.fatigue_score || 0,
    lastNotificationAt: row.last_notification_at,
    notificationsLast24h: row.notifications_last_24h || 0,
    notificationsLast48h: row.notifications_last_48h || 0,
    opensLast48h: row.opens_last_48h || 0,
    bestHourPush: row.best_hour_push,
    bestHourSms: row.best_hour_sms,
    bestHourEmail: row.best_hour_email,
    preferredStyle: row.preferred_style || 'informational',
    timezone: row.timezone || 'UTC',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTemplate(row: any): NotificationTemplate {
  return {
    id: row.id,
    notificationType: row.notification_type,
    variantIndex: row.variant_index,
    variantName: row.variant_name,
    titleTemplate: row.title_template,
    bodyTemplate: row.body_template,
    dataTemplate: row.data_template || {},
    active: row.active ?? true,
    createdAt: row.created_at,
  };
}


// ══════════════════════════════════════════════════════════════════════════════
// ENGINE
// ══════════════════════════════════════════════════════════════════════════════

export class NotificationPriorityEngine {

  // ── Section A: Priority Scoring ──────────────────────────────────────────

  /**
   * Score a notification for priority. Higher = more urgent delivery.
   * Composite of 6 factors, range 0-100 (before fatigue can pull to -20).
   */
  static async scoreNotification(
    item: QueueItem
  ): Promise<ScoringResult> {
    // 1. Type base priority
    const typeBasePriority = this.getTypeBasePriority(item.notificationType);

    // 2. Time sensitivity (from data.hours_until_due or data.due_date)
    const timeSensitivity = this.calculateTimeSensitivity(item.data);

    // 3. Financial stakes (from data.amount_cents)
    const financialStakes = this.calculateFinancialStakes(item.data);

    // 4. Member stress level (from default_probability_scores)
    let memberStress = 0;
    try {
      const score = await scoringPipelineService.getDefaultProbability(item.memberId);
      if (score) {
        // Higher default probability = higher stress = more important to reach them
        memberStress = Math.round(score.predictedProbability * 15);
      }
    } catch (err) {
      console.warn('[NotifPriority] Stress score lookup failed (non-fatal):', err);
    }

    // 5. Engagement bonus (from member_behavioral_profiles)
    let engagementBonus = 0;
    try {
      const { data: profile } = await supabase
        .from('member_behavioral_profiles')
        .select('avg_sessions_per_week, active_days_last_30')
        .eq('user_id', item.memberId)
        .maybeSingle();

      if (profile) {
        const sessionsScore = Math.min(profile.avg_sessions_per_week || 0, 7) / 7;
        const activeDaysScore = Math.min(profile.active_days_last_30 || 0, 30) / 30;
        engagementBonus = Math.round((sessionsScore * 0.5 + activeDaysScore * 0.5) * 10);
      }
    } catch (err) {
      console.warn('[NotifPriority] Engagement lookup failed (non-fatal):', err);
    }

    // 6. Fatigue adjustment (from member_notification_profiles)
    let fatigueAdjustment = 0;
    try {
      const notifProfile = await this.getNotificationProfile(item.memberId);
      if (notifProfile) {
        // If 4+ notifications in 48h with 0 opens → max penalty
        if (notifProfile.notificationsLast48h >= 4 && notifProfile.opensLast48h === 0) {
          fatigueAdjustment = -20;
        } else if (notifProfile.notificationsLast48h >= 3 && notifProfile.opensLast48h === 0) {
          fatigueAdjustment = -15;
        } else if (notifProfile.notificationsLast48h >= 4) {
          fatigueAdjustment = -10;
        } else if (notifProfile.notificationsLast48h >= 2 && notifProfile.opensLast48h === 0) {
          fatigueAdjustment = -5;
        }
      }
    } catch (err) {
      console.warn('[NotifPriority] Fatigue lookup failed (non-fatal):', err);
    }

    const breakdown: ScoringBreakdown = {
      timeSensitivity,
      financialStakes,
      memberStress,
      fatigueAdjustment,
      engagementBonus,
      typeBasePriority,
    };

    const priorityScore = Math.max(0, Math.min(100,
      timeSensitivity + financialStakes + memberStress +
      fatigueAdjustment + engagementBonus + typeBasePriority
    ));

    return { priorityScore, breakdown };
  }

  /** Base priority by notification type. */
  private static getTypeBasePriority(type: NotificationType): number {
    const priorities: Record<NotificationType, number> = {
      payment_critical: 10,
      circle_events: 6,
      score_changes: 4,
      coaching_goals: 3,
      platform_community: 1,
    };
    return priorities[type] ?? 1;
  }

  /** Time sensitivity: closer deadline = higher score. */
  private static calculateTimeSensitivity(data: Record<string, any>): number {
    const hoursUntilDue = data.hours_until_due ?? data.hoursUntilDue;
    if (hoursUntilDue == null) return 0;

    const hours = Number(hoursUntilDue);
    if (hours <= 24) return 40;
    if (hours <= 48) return 30;
    if (hours <= 72) return 20;
    if (hours <= 168) return 10; // 7 days
    return 5;
  }

  /** Financial stakes: higher amounts relative to typical score higher. */
  private static calculateFinancialStakes(data: Record<string, any>): number {
    const amountCents = data.amount_cents ?? data.amountCents ?? 0;
    if (amountCents <= 0) return 0;

    const amount = amountCents / 100;
    if (amount >= 500) return 25;
    if (amount >= 200) return 20;
    if (amount >= 100) return 15;
    if (amount >= 50) return 10;
    return 5;
  }


  // ── Section B: Channel Selection ─────────────────────────────────────────

  /**
   * Select the best delivery channel for this member + notification type.
   * Considers historical open rates, fatigue, quiet hours, and type priority.
   */
  static async selectChannel(
    userId: string,
    notificationType: NotificationType
  ): Promise<ChannelSelection> {
    const profile = await this.ensureNotificationProfile(userId);

    // Check quiet hours first
    const quiet = await this.isQuietHours(userId);

    // payment_critical: push + SMS for members with low push open rates
    if (notificationType === 'payment_critical') {
      if (profile.pushOpenRate < 0.3 && profile.pushSent >= 5) {
        // Member ignores push — use SMS as primary
        return {
          primaryChannel: 'sms',
          fallbackChannel: 'push',
          reason: 'Low push open rate for payment-critical notification',
          delayed: quiet,
          deliveryTime: quiet ? await this.getNextDeliveryWindow(userId) : null,
        };
      }
      return {
        primaryChannel: 'push',
        fallbackChannel: 'sms',
        reason: 'Payment-critical: push with SMS fallback',
        delayed: quiet,
        deliveryTime: quiet ? await this.getNextDeliveryWindow(userId) : null,
      };
    }

    // For non-critical types: check fatigue → switch channel if fatigued
    if (profile.fatigueScore > 60) {
      // Find least-used channel that isn't the one they're ignoring
      const channels: { channel: NotificationChannel; rate: number }[] = [
        { channel: 'push', rate: profile.pushOpenRate },
        { channel: 'email', rate: profile.emailOpenRate },
        { channel: 'in_app', rate: profile.inAppOpenRate },
      ];
      channels.sort((a, b) => b.rate - a.rate);
      const best = channels[0];

      return {
        primaryChannel: best.channel,
        fallbackChannel: null,
        reason: `High fatigue (${profile.fatigueScore}) — using highest open-rate channel`,
        delayed: quiet || true, // Always delay when fatigued
        deliveryTime: quiet
          ? await this.getNextDeliveryWindow(userId)
          : this.getDelayedTime(2), // Delay 2 hours
      };
    }

    // Default: use highest open rate channel
    const channels: { channel: NotificationChannel; rate: number }[] = [
      { channel: 'push', rate: profile.pushOpenRate },
      { channel: 'email', rate: profile.emailOpenRate },
      { channel: 'in_app', rate: profile.inAppOpenRate },
    ];
    channels.sort((a, b) => b.rate - a.rate);

    // If no meaningful data yet, default to push
    const best = (profile.pushSent + profile.emailSent + profile.inAppSent < 5)
      ? { channel: 'push' as NotificationChannel }
      : channels[0];

    return {
      primaryChannel: best.channel,
      fallbackChannel: null,
      reason: profile.pushSent < 5
        ? 'New member — defaulting to push'
        : `Best open rate channel: ${best.channel}`,
      delayed: quiet,
      deliveryTime: quiet ? await this.getNextDeliveryWindow(userId) : null,
    };
  }

  /** Get a delayed delivery time N hours from now. */
  private static getDelayedTime(hours: number): string {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    return d.toISOString();
  }


  // ── Section C: Framing Adaptation ────────────────────────────────────────

  /**
   * Select the best message framing variant for this member.
   * Uses stress level, engagement, account maturity, and honor score.
   */
  static async selectFramingVariant(
    userId: string,
    notificationType: NotificationType
  ): Promise<FramingSelection> {
    // Gather signals
    let stressLevel: 'high' | 'moderate' | 'low' = 'low';
    let isNewMember = false;
    let isHighEngagement = false;
    let isHighHonor = false;

    // 1. Stress from default_probability_scores
    try {
      const score = await scoringPipelineService.getDefaultProbability(userId);
      if (score) {
        if (score.riskBucket === 'high' || score.riskBucket === 'very_high') {
          stressLevel = 'high';
        } else if (score.riskBucket === 'moderate') {
          stressLevel = 'moderate';
        }
      }
    } catch (err) {
      console.warn('[NotifPriority] Framing stress lookup failed:', err);
    }

    // 2. Engagement + maturity from member_behavioral_profiles
    try {
      const { data: profile } = await supabase
        .from('member_behavioral_profiles')
        .select('account_age_days, active_days_last_30, avg_sessions_per_week, feature_adoption_score')
        .eq('user_id', userId)
        .maybeSingle();

      if (profile) {
        isNewMember = (profile.account_age_days || 0) < 30;
        const engagement = (
          (Math.min(profile.active_days_last_30 || 0, 30) / 30) * 0.4 +
          (Math.min(profile.avg_sessions_per_week || 0, 7) / 7) * 0.3 +
          (Math.min(profile.feature_adoption_score || 0, 100) / 100) * 0.3
        );
        isHighEngagement = engagement > 0.6;
      }
    } catch (err) {
      console.warn('[NotifPriority] Framing engagement lookup failed:', err);
    }

    // 3. Honor score tier
    try {
      const { data: honor } = await supabase
        .from('honor_scores')
        .select('total_score, score_tier')
        .eq('user_id', userId)
        .maybeSingle();

      if (honor) {
        isHighHonor = (honor.total_score || 0) >= 80 ||
          honor.score_tier === 'exemplary' || honor.score_tier === 'distinguished';
      }
    } catch (err) {
      console.warn('[NotifPriority] Framing honor lookup failed:', err);
    }

    // Decision tree
    if (stressLevel === 'high') {
      return {
        variantIndex: 1,
        variantName: 'empathetic',
        reason: 'High stress/risk member — empathetic framing to reduce pressure',
      };
    }

    if (isNewMember) {
      return {
        variantIndex: 4,
        variantName: 'informational',
        reason: 'New member (< 30 days) — educational/informational framing',
      };
    }

    if (isHighEngagement && isHighHonor) {
      return {
        variantIndex: 3,
        variantName: 'celebratory',
        reason: 'High engagement + strong honor score — celebratory framing',
      };
    }

    if (isHighEngagement) {
      return {
        variantIndex: 2,
        variantName: 'supportive',
        reason: 'Engaged member — supportive framing to maintain momentum',
      };
    }

    if (stressLevel === 'moderate') {
      return {
        variantIndex: 1,
        variantName: 'empathetic',
        reason: 'Moderate stress member — empathetic framing',
      };
    }

    // Default: urgent for payment_critical, informational for everything else
    if (notificationType === 'payment_critical') {
      return {
        variantIndex: 0,
        variantName: 'urgent',
        reason: 'Default payment-critical framing',
      };
    }

    return {
      variantIndex: 4,
      variantName: 'informational',
      reason: 'Default informational framing',
    };
  }


  // ── Section D: Queue Management ──────────────────────────────────────────

  /**
   * Enqueue a notification. Scores it, selects channel and framing,
   * renders the template, and writes to notification_queue.
   */
  static async enqueueNotification(
    userId: string,
    type: NotificationType,
    data: Record<string, any> = {}
  ): Promise<EnqueueResult> {
    // 1. Ensure profile exists
    await this.ensureNotificationProfile(userId);

    // 2. Create initial queue item
    const { data: row, error: insertErr } = await supabase
      .from('notification_queue')
      .insert({
        member_id: userId,
        notification_type: type,
        data,
        status: 'pending',
      })
      .select()
      .single();

    if (insertErr || !row) {
      throw new Error(`Failed to enqueue notification: ${insertErr?.message}`);
    }

    const queueItem = mapQueueItem(row);

    // 3. Score
    const scoring = await this.scoreNotification(queueItem);

    // 4. Select channel
    const channelSel = await this.selectChannel(userId, type);

    // 5. Select framing
    const framingSel = await this.selectFramingVariant(userId, type);

    // 6. Render template
    let renderedTitle = '';
    let renderedBody = '';
    try {
      const template = await this.getTemplate(type, framingSel.variantIndex);
      if (template) {
        const rendered = this.renderTemplate(template, data);
        renderedTitle = rendered.title;
        renderedBody = rendered.body;
      }
    } catch (err) {
      console.warn('[NotifPriority] Template render failed, using fallback:', err);
      renderedTitle = data.title || `Notification from TandaXn`;
      renderedBody = data.body || data.message || '';
    }

    // 7. Update queue item with scoring + routing + content
    const { error: updateErr } = await supabase
      .from('notification_queue')
      .update({
        priority_score: scoring.priorityScore,
        channel: channelSel.primaryChannel,
        template_variant_index: framingSel.variantIndex,
        title: renderedTitle,
        body: renderedBody,
        scheduled_delivery_time: channelSel.deliveryTime || new Date().toISOString(),
        status: 'scored',
        scoring_details: scoring.breakdown,
        framing_details: {
          variantName: framingSel.variantName,
          reason: framingSel.reason,
          channelReason: channelSel.reason,
          fallbackChannel: channelSel.fallbackChannel,
          delayed: channelSel.delayed,
        },
      })
      .eq('id', queueItem.id);

    if (updateErr) {
      console.error('[NotifPriority] Queue update failed:', updateErr.message);
    }

    // 8. Update fatigue counters
    await this.updateFatigueScore(userId);

    return {
      queueId: queueItem.id,
      status: 'scored',
      scheduledDeliveryTime: channelSel.deliveryTime || new Date().toISOString(),
      priorityScore: scoring.priorityScore,
      channel: channelSel.primaryChannel,
      variantName: framingSel.variantName,
    };
  }

  /**
   * Process scored queue items ready for delivery.
   * Reads items ordered by priority_score DESC, writes to notifications table,
   * and marks as delivering/delivered.
   */
  static async processQueue(batchSize: number = 50): Promise<ProcessQueueResult> {
    const result: ProcessQueueResult = {
      processed: 0,
      delivered: 0,
      failed: 0,
      delayed: 0,
      errors: [],
    };

    const now = new Date().toISOString();

    // Fetch scored items whose delivery time has passed
    const { data: items, error: fetchErr } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'scored')
      .lte('scheduled_delivery_time', now)
      .order('priority_score', { ascending: false })
      .limit(batchSize);

    if (fetchErr || !items) {
      result.errors.push(fetchErr?.message || 'Failed to fetch queue');
      return result;
    }

    for (const row of items) {
      result.processed++;
      const item = mapQueueItem(row);

      try {
        // Mark as delivering (optimistic lock via status check)
        const { data: locked, error: lockErr } = await supabase
          .from('notification_queue')
          .update({ status: 'delivering' })
          .eq('id', item.id)
          .eq('status', 'scored')
          .select('id')
          .single();

        if (lockErr || !locked) {
          // Another process already picked this up
          continue;
        }

        // Write to notifications table for in-app display
        const { data: notif, error: notifErr } = await supabase
          .from('notifications')
          .insert({
            user_id: item.memberId,
            type: item.notificationType,
            title: item.title || 'Notification',
            message: item.body || '',
            data: item.data,
            priority_score: item.priorityScore,
            channel_used: item.channel,
            template_variant: item.framingDetails?.variantName || null,
            queue_id: item.id,
          })
          .select('id')
          .single();

        if (notifErr) {
          throw new Error(`Notification insert failed: ${notifErr.message}`);
        }

        // Mark as delivered
        await this.recordDelivery(item.id, item.channel || 'in_app', true);

        // Link notification_id back to queue item
        await supabase
          .from('notification_queue')
          .update({ notification_id: notif.id })
          .eq('id', item.id);

        result.delivered++;
      } catch (err: any) {
        result.failed++;
        result.errors.push(`${item.id}: ${err.message}`);
        await this.recordDelivery(item.id, item.channel || 'push', false, err.message);
      }
    }

    return result;
  }

  /** Get current queue items for a member. */
  static async getQueueStatus(userId: string): Promise<QueueItem[]> {
    const { data, error } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('member_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data.map(mapQueueItem);
  }

  /** Cancel a pending/scored queue item. */
  static async cancelQueueItem(queueId: string): Promise<boolean> {
    const { error } = await supabase
      .from('notification_queue')
      .update({ status: 'cancelled' })
      .eq('id', queueId)
      .in('status', ['pending', 'scored']);

    return !error;
  }


  // ── Section E: Fatigue Management ────────────────────────────────────────

  /**
   * Recalculate fatigue score from actual queue history.
   * Formula: (notifications_48h * 10) - (opens_48h * 5), clamped 0-100.
   */
  static async updateFatigueScore(userId: string): Promise<number> {
    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const h48 = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    // Count recent notifications from queue
    const { count: count48h } = await supabase
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', userId)
      .in('status', ['delivered', 'delivering', 'scored'])
      .gte('created_at', h48);

    const { count: count24h } = await supabase
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', userId)
      .in('status', ['delivered', 'delivering', 'scored'])
      .gte('created_at', h24);

    const { count: opens48h } = await supabase
      .from('notification_queue')
      .select('id', { count: 'exact', head: true })
      .eq('member_id', userId)
      .not('opened_at', 'is', null)
      .gte('created_at', h48);

    const n48 = count48h || 0;
    const n24 = count24h || 0;
    const o48 = opens48h || 0;

    const fatigue = Math.max(0, Math.min(100, (n48 * 10) - (o48 * 5)));

    // Update profile
    await supabase
      .from('member_notification_profiles')
      .update({
        fatigue_score: fatigue,
        notifications_last_24h: n24,
        notifications_last_48h: n48,
        opens_last_48h: o48,
        last_notification_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return fatigue;
  }

  /** Check if a notification to this member should be delayed. */
  static async shouldDelay(
    userId: string
  ): Promise<{ delay: boolean; reason?: string; resumeAt?: string }> {
    const profile = await this.getNotificationProfile(userId);
    if (!profile) return { delay: false };

    // High fatigue: delay and switch channel later
    if (profile.fatigueScore > 60) {
      return {
        delay: true,
        reason: `Fatigue score ${profile.fatigueScore}/100 — delaying to prevent permanent ignore`,
        resumeAt: this.getDelayedTime(4), // 4 hours
      };
    }

    // Quiet hours
    const quiet = await this.isQuietHours(userId);
    if (quiet) {
      return {
        delay: true,
        reason: 'Quiet hours active',
        resumeAt: await this.getNextDeliveryWindow(userId),
      };
    }

    return { delay: false };
  }


  // ── Section F: Delivery Tracking ─────────────────────────────────────────

  /** Record delivery outcome and update profile channel counts. */
  static async recordDelivery(
    queueId: string,
    channel: NotificationChannel,
    success: boolean,
    failureReason?: string
  ): Promise<void> {
    // Update queue item
    await supabase
      .from('notification_queue')
      .update({
        status: success ? 'delivered' : 'failed',
        delivered_at: success ? new Date().toISOString() : null,
        failure_reason: failureReason || null,
        retry_count: success ? undefined : supabase.rpc ? undefined : 0,
      })
      .eq('id', queueId);

    if (!success) return;

    // Get member_id from queue item
    const { data: item } = await supabase
      .from('notification_queue')
      .select('member_id')
      .eq('id', queueId)
      .single();

    if (!item) return;

    // Increment channel sent count
    const sentCol = `${channel}_sent`;
    const { data: profile } = await supabase
      .from('member_notification_profiles')
      .select(sentCol)
      .eq('user_id', item.member_id)
      .single();

    if (profile) {
      await supabase
        .from('member_notification_profiles')
        .update({ [sentCol]: (profile[sentCol] || 0) + 1 })
        .eq('user_id', item.member_id);
    }
  }

  /** Record that a member opened a notification. Updates open rates. */
  static async recordOpen(queueId: string): Promise<void> {
    // Mark opened
    const { data: item } = await supabase
      .from('notification_queue')
      .update({ opened_at: new Date().toISOString() })
      .eq('id', queueId)
      .select('member_id, channel')
      .single();

    if (!item || !item.channel) return;

    // Increment channel opened count and recalculate rate
    const channel = item.channel as NotificationChannel;
    const openedCol = `${channel}_opened`;
    const sentCol = `${channel}_sent`;
    const rateCol = `${channel}_open_rate`;

    const { data: profile } = await supabase
      .from('member_notification_profiles')
      .select(`${openedCol}, ${sentCol}`)
      .eq('user_id', item.member_id)
      .single();

    if (profile) {
      const newOpened = (profile[openedCol] || 0) + 1;
      const sent = profile[sentCol] || 1;
      const newRate = Math.min(1, newOpened / sent);

      await supabase
        .from('member_notification_profiles')
        .update({
          [openedCol]: newOpened,
          [rateCol]: newRate,
        })
        .eq('user_id', item.member_id);
    }
  }

  /** Record that a member clicked through a notification. */
  static async recordClick(queueId: string): Promise<void> {
    const { data: item } = await supabase
      .from('notification_queue')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', queueId)
      .select('member_id, channel')
      .single();

    if (!item || !item.channel) return;

    const clickedCol = `${item.channel}_clicked`;
    const { data: profile } = await supabase
      .from('member_notification_profiles')
      .select(clickedCol)
      .eq('user_id', item.member_id)
      .single();

    if (profile) {
      await supabase
        .from('member_notification_profiles')
        .update({ [clickedCol]: (profile[clickedCol] || 0) + 1 })
        .eq('user_id', item.member_id);
    }
  }


  // ── Section G: Quiet Hours ───────────────────────────────────────────────

  /**
   * Check if the current time falls within the member's quiet hours.
   * Reads from notification_preferences (shared with NotificationContext).
   */
  static async isQuietHours(userId: string): Promise<boolean> {
    try {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone')
        .eq('user_id', userId)
        .maybeSingle();

      if (!prefs || !prefs.quiet_hours_enabled) return false;

      const tz = prefs.quiet_hours_timezone || 'UTC';
      const now = new Date();

      // Get current hour in member's timezone
      let memberHour: number;
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          hour12: false,
        });
        memberHour = parseInt(formatter.format(now), 10);
      } catch {
        // Fallback to UTC
        memberHour = now.getUTCHours();
      }

      // Parse quiet hours (format: "22:00", "08:00")
      const startHour = parseInt(prefs.quiet_hours_start?.split(':')[0] || '22', 10);
      const endHour = parseInt(prefs.quiet_hours_end?.split(':')[0] || '8', 10);

      // Handle overnight range (e.g., 22:00 to 08:00)
      if (startHour > endHour) {
        return memberHour >= startHour || memberHour < endHour;
      }
      return memberHour >= startHour && memberHour < endHour;
    } catch (err) {
      console.warn('[NotifPriority] Quiet hours check failed:', err);
      return false;
    }
  }

  /** Get the next valid delivery window (after quiet hours end). */
  static async getNextDeliveryWindow(userId: string): Promise<string> {
    try {
      const { data: prefs } = await supabase
        .from('notification_preferences')
        .select('quiet_hours_end, quiet_hours_timezone')
        .eq('user_id', userId)
        .maybeSingle();

      const endHour = parseInt(prefs?.quiet_hours_end?.split(':')[0] || '8', 10);
      const tz = prefs?.quiet_hours_timezone || 'UTC';

      // Calculate next occurrence of endHour in member's timezone
      const now = new Date();
      let targetDate = new Date(now);

      // Get current hour in member timezone
      let memberHour: number;
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          hour: 'numeric',
          hour12: false,
        });
        memberHour = parseInt(formatter.format(now), 10);
      } catch {
        memberHour = now.getUTCHours();
      }

      if (memberHour >= endHour) {
        // Already past end time today — next window is tomorrow
        targetDate.setDate(targetDate.getDate() + 1);
      }

      // Set to endHour UTC (approximate — good enough for scheduling)
      targetDate.setHours(endHour, 0, 0, 0);
      return targetDate.toISOString();
    } catch (err) {
      // Fallback: 8 hours from now
      return this.getDelayedTime(8);
    }
  }


  // ── Section H: Template System ───────────────────────────────────────────

  /** Fetch a template by type and variant index. */
  static async getTemplate(
    type: NotificationType,
    variantIndex: number
  ): Promise<NotificationTemplate | null> {
    const { data, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('notification_type', type)
      .eq('variant_index', variantIndex)
      .eq('active', true)
      .maybeSingle();

    if (error || !data) return null;
    return mapTemplate(data);
  }

  /** Fetch all active templates, optionally filtered by type. */
  static async getTemplates(
    type?: NotificationType
  ): Promise<NotificationTemplate[]> {
    let query = supabase
      .from('notification_templates')
      .select('*')
      .eq('active', true)
      .order('notification_type')
      .order('variant_index');

    if (type) {
      query = query.eq('notification_type', type);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapTemplate);
  }

  /**
   * Render a template by replacing {{placeholder}} tokens with values.
   * Pure function — no DB access. Missing variables replaced with empty string.
   */
  static renderTemplate(
    template: NotificationTemplate,
    variables: Record<string, any>
  ): { title: string; body: string } {
    const replace = (text: string): string => {
      return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const val = variables[key];
        if (val == null) return '';
        return String(val);
      });
    };

    return {
      title: replace(template.titleTemplate),
      body: replace(template.bodyTemplate),
    };
  }


  // ── Section I: Profile Bootstrap ─────────────────────────────────────────

  /**
   * Ensure a notification profile exists for this user.
   * Creates with defaults if not found. Returns the profile.
   */
  static async ensureNotificationProfile(
    userId: string
  ): Promise<MemberNotificationProfile> {
    // Try to get existing
    const existing = await this.getNotificationProfile(userId);
    if (existing) return existing;

    // Create with defaults
    const { data, error } = await supabase
      .from('member_notification_profiles')
      .upsert({ user_id: userId }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error || !data) {
      // If upsert fails, try one more read (race condition)
      const fallback = await this.getNotificationProfile(userId);
      if (fallback) return fallback;
      throw new Error(`Failed to create notification profile: ${error?.message}`);
    }

    return mapNotificationProfile(data);
  }

  /** Get the notification profile for a user. */
  static async getNotificationProfile(
    userId: string
  ): Promise<MemberNotificationProfile | null> {
    const { data, error } = await supabase
      .from('member_notification_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return mapNotificationProfile(data);
  }


  // ── Section J: Realtime ──────────────────────────────────────────────────

  /** Subscribe to queue changes for a member (realtime). */
  static subscribeToQueue(
    userId: string,
    callback: () => void
  ) {
    return supabase
      .channel(`notif-queue-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_queue',
          filter: `member_id=eq.${userId}`,
        },
        () => { callback(); }
      )
      .subscribe();
  }
}
