/**
 * ══════════════════════════════════════════════════════════════════════════════
 * NOTIFICATION PRIORITY HOOKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * React hooks for the push notification priority engine.
 * 5 hooks: useNotificationProfile, useNotificationQueue, useNotificationFatigue,
 *          useNotificationTemplates, useNotificationActions
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  NotificationPriorityEngine,
  type NotificationType,
  type NotificationChannel,
  type QueueStatus,
  type FramingVariant,
  type QueueItem,
  type MemberNotificationProfile,
  type NotificationTemplate,
  type ScoringResult,
  type ScoringBreakdown,
  type ChannelSelection,
  type FramingSelection,
  type EnqueueResult,
  type ProcessQueueResult,
} from '@/services/NotificationPriorityEngine';

// Re-export all types for consumer convenience
export type {
  NotificationType,
  NotificationChannel,
  QueueStatus,
  FramingVariant,
  QueueItem,
  MemberNotificationProfile,
  NotificationTemplate,
  ScoringResult,
  ScoringBreakdown,
  ChannelSelection,
  FramingSelection,
  EnqueueResult,
  ProcessQueueResult,
};


// ═══════════════════════════════════════════════════════════════════════════════
// useNotificationProfile — Member's notification delivery intelligence
// ═══════════════════════════════════════════════════════════════════════════════

export function useNotificationProfile(userId?: string) {
  const [profile, setProfile] = useState<MemberNotificationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await NotificationPriorityEngine.getNotificationProfile(userId);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notification profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notif-profile-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'member_notification_profiles',
          filter: `user_id=eq.${userId}`,
        },
        () => { fetchProfile(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchProfile]);

  // Computed: overall open rate across all channels
  const overallOpenRate = useMemo(() => {
    if (!profile) return 0;
    const totalSent = profile.pushSent + profile.emailSent + profile.smsSent + profile.inAppSent;
    const totalOpened = profile.pushOpened + profile.emailOpened + profile.smsOpened + profile.inAppOpened;
    return totalSent > 0 ? totalOpened / totalSent : 0;
  }, [profile]);

  // Computed: primary channel (highest open rate with sufficient data)
  const primaryChannel = useMemo((): NotificationChannel | null => {
    if (!profile) return null;
    const totalSent = profile.pushSent + profile.emailSent + profile.smsSent + profile.inAppSent;
    if (totalSent < 5) return 'push'; // Default for new members

    const channels: { channel: NotificationChannel; rate: number }[] = [
      { channel: 'push', rate: profile.pushOpenRate },
      { channel: 'sms', rate: profile.smsOpenRate },
      { channel: 'email', rate: profile.emailOpenRate },
      { channel: 'in_app', rate: profile.inAppOpenRate },
    ];
    channels.sort((a, b) => b.rate - a.rate);
    return channels[0].channel;
  }, [profile]);

  // Computed: is the member currently fatigued
  const isFatigued = useMemo(() => {
    return (profile?.fatigueScore ?? 0) > 60;
  }, [profile]);

  return {
    profile,
    loading,
    error,
    refetch: fetchProfile,
    overallOpenRate,
    primaryChannel,
    isFatigued,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useNotificationQueue — Pending/recent queue items for a member
// ═══════════════════════════════════════════════════════════════════════════════

export function useNotificationQueue(userId?: string) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    if (!userId) {
      setQueue([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await NotificationPriorityEngine.getQueueStatus(userId);
      setQueue(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notification queue');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = NotificationPriorityEngine.subscribeToQueue(userId, () => {
      fetchQueue();
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchQueue]);

  // Computed: pending items (not yet delivered)
  const pending = useMemo(() => {
    return queue.filter(q =>
      q.status === 'pending' || q.status === 'scored' || q.status === 'delivering'
    );
  }, [queue]);

  // Computed: recently delivered (last 24h)
  const recentDeliveries = useMemo(() => {
    const h24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return queue.filter(q => q.status === 'delivered' && q.deliveredAt && q.deliveredAt > h24);
  }, [queue]);

  const pendingCount = useMemo(() => pending.length, [pending]);

  return {
    queue,
    pending,
    recentDeliveries,
    pendingCount,
    loading,
    error,
    refetch: fetchQueue,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useNotificationFatigue — Fatigue score and status
// ═══════════════════════════════════════════════════════════════════════════════

export function useNotificationFatigue(userId?: string) {
  const [fatigueScore, setFatigueScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFatigue = useCallback(async () => {
    if (!userId) {
      setFatigueScore(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const profile = await NotificationPriorityEngine.getNotificationProfile(userId);
      setFatigueScore(profile?.fatigueScore ?? 0);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch fatigue score');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchFatigue();
  }, [fetchFatigue]);

  const isFatigued = useMemo(() => fatigueScore > 60, [fatigueScore]);

  const fatigueLevel = useMemo((): 'low' | 'moderate' | 'high' => {
    if (fatigueScore > 60) return 'high';
    if (fatigueScore > 30) return 'moderate';
    return 'low';
  }, [fatigueScore]);

  const shouldDelay = useMemo(() => fatigueScore > 60, [fatigueScore]);

  const refresh = useCallback(async () => {
    if (!userId) return 0;
    try {
      const score = await NotificationPriorityEngine.updateFatigueScore(userId);
      setFatigueScore(score);
      return score;
    } catch (err: any) {
      setError(err.message || 'Failed to refresh fatigue');
      return fatigueScore;
    }
  }, [userId, fatigueScore]);

  return {
    fatigueScore,
    isFatigued,
    fatigueLevel,
    shouldDelay,
    loading,
    error,
    refresh,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useNotificationTemplates — Template variants by type
// ═══════════════════════════════════════════════════════════════════════════════

export function useNotificationTemplates(type?: NotificationType) {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await NotificationPriorityEngine.getTemplates(type);
      setTemplates(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch notification templates');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Computed: group by notification type
  const byType = useMemo(() => {
    const grouped: Partial<Record<NotificationType, NotificationTemplate[]>> = {};
    for (const t of templates) {
      if (!grouped[t.notificationType]) grouped[t.notificationType] = [];
      grouped[t.notificationType]!.push(t);
    }
    return grouped;
  }, [templates]);

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
    byType,
  };
}


// ═══════════════════════════════════════════════════════════════════════════════
// useNotificationActions — Action callbacks for triggering operations
// ═══════════════════════════════════════════════════════════════════════════════

export function useNotificationActions() {
  const [enqueueing, setEnqueueing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enqueue = useCallback(async (
    userId: string,
    type: NotificationType,
    data: Record<string, any> = {}
  ): Promise<EnqueueResult | null> => {
    try {
      setEnqueueing(true);
      setError(null);
      return await NotificationPriorityEngine.enqueueNotification(userId, type, data);
    } catch (err: any) {
      setError(err.message || 'Failed to enqueue notification');
      return null;
    } finally {
      setEnqueueing(false);
    }
  }, []);

  const processQueue = useCallback(async (
    batchSize?: number
  ): Promise<ProcessQueueResult | null> => {
    try {
      setProcessing(true);
      setError(null);
      return await NotificationPriorityEngine.processQueue(batchSize);
    } catch (err: any) {
      setError(err.message || 'Failed to process queue');
      return null;
    } finally {
      setProcessing(false);
    }
  }, []);

  const recordOpen = useCallback(async (queueId: string) => {
    try {
      await NotificationPriorityEngine.recordOpen(queueId);
    } catch (err: any) {
      console.warn('[useNotificationActions] recordOpen failed:', err);
    }
  }, []);

  const recordClick = useCallback(async (queueId: string) => {
    try {
      await NotificationPriorityEngine.recordClick(queueId);
    } catch (err: any) {
      console.warn('[useNotificationActions] recordClick failed:', err);
    }
  }, []);

  const cancelItem = useCallback(async (queueId: string): Promise<boolean> => {
    try {
      setError(null);
      return await NotificationPriorityEngine.cancelQueueItem(queueId);
    } catch (err: any) {
      setError(err.message || 'Failed to cancel queue item');
      return false;
    }
  }, []);

  const refreshFatigue = useCallback(async (userId: string): Promise<number> => {
    try {
      return await NotificationPriorityEngine.updateFatigueScore(userId);
    } catch (err: any) {
      console.warn('[useNotificationActions] refreshFatigue failed:', err);
      return 0;
    }
  }, []);

  return {
    enqueueing,
    processing,
    error,
    enqueue,
    processQueue,
    recordOpen,
    recordClick,
    cancelItem,
    refreshFatigue,
  };
}
