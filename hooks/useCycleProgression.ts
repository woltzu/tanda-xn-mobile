/**
 * ══════════════════════════════════════════════════════════════════════════════
 * CYCLE PROGRESSION HOOKS
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * React hooks for interacting with the cycle progression system.
 *
 * @module useCycleProgression
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  CircleCycle,
  CycleContribution,
  CycleStatus,
} from '@/services/CycleProgressionEngine';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CycleWithDetails extends CircleCycle {
  circle: {
    id: string;
    name: string;
    contribution_amount: number;
    contribution_frequency: string;
    total_cycles: number;
    max_members: number;
    community_id?: string;
    status: string;
  };
  recipient?: {
    id: string;
    full_name: string;
    avatar_url?: string;
  };
  my_contribution?: CycleContribution;
}

export interface CycleStats {
  total_cycles: number;
  completed_cycles: number;
  current_cycle_number: number;
  total_collected: number;
  total_payouts: number;
  on_time_rate: number;
  next_payout_date?: string;
  next_recipient_id?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hook to get current cycle for a circle
 */
export function useCurrentCycle(circleId: string | undefined) {
  const [cycle, setCycle] = useState<CycleWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchCurrentCycle = useCallback(async () => {
    if (!circleId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get current cycle (not closed, cancelled, or skipped)
      const { data: cycleData, error: cycleError } = await supabase
        .from('circle_cycles')
        .select(`
          *,
          circle:circles(
            id, name, contribution_amount, contribution_frequency,
            total_cycles, max_members, community_id, status
          ),
          recipient:profiles!circle_cycles_recipient_user_id_fkey(
            id, full_name, avatar_url
          )
        `)
        .eq('circle_id', circleId)
        .not('status', 'in', '("closed","cancelled","skipped")')
        .order('cycle_number', { ascending: true })
        .limit(1)
        .single();

      if (cycleError && cycleError.code !== 'PGRST116') {
        throw cycleError;
      }

      if (cycleData && user) {
        // Get user's contribution for this cycle
        const { data: contributionData } = await supabase
          .from('cycle_contributions')
          .select('*')
          .eq('cycle_id', cycleData.id)
          .eq('user_id', user.id)
          .single();

        setCycle({
          ...cycleData,
          my_contribution: contributionData || undefined,
        });
      } else {
        setCycle(null);
      }

      setError(null);
    } catch (err: any) {
      console.error('[useCurrentCycle] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId, user]);

  useEffect(() => {
    fetchCurrentCycle();
  }, [fetchCurrentCycle]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!circleId) return;

    const subscription = supabase
      .channel(`cycle-${circleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'circle_cycles',
          filter: `circle_id=eq.${circleId}`,
        },
        () => {
          fetchCurrentCycle();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [circleId, fetchCurrentCycle]);

  return { cycle, loading, error, refetch: fetchCurrentCycle };
}

/**
 * Hook to get all cycles for a circle
 */
export function useCircleCycles(circleId: string | undefined) {
  const [cycles, setCycles] = useState<CycleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCycles = useCallback(async () => {
    if (!circleId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error: cyclesError } = await supabase
        .from('circle_cycles')
        .select(`
          *,
          circle:circles(
            id, name, contribution_amount, contribution_frequency,
            total_cycles, max_members, community_id, status
          ),
          recipient:profiles!circle_cycles_recipient_user_id_fkey(
            id, full_name, avatar_url
          )
        `)
        .eq('circle_id', circleId)
        .order('cycle_number', { ascending: true });

      if (cyclesError) throw cyclesError;

      setCycles(data || []);
      setError(null);
    } catch (err: any) {
      console.error('[useCircleCycles] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchCycles();
  }, [fetchCycles]);

  return { cycles, loading, error, refetch: fetchCycles };
}

/**
 * Hook to get user's contribution for a cycle
 */
export function useMyContribution(cycleId: string | undefined) {
  const [contribution, setContribution] = useState<CycleContribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchContribution = useCallback(async () => {
    if (!cycleId || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error: contribError } = await supabase
        .from('cycle_contributions')
        .select('*')
        .eq('cycle_id', cycleId)
        .eq('user_id', user.id)
        .single();

      if (contribError && contribError.code !== 'PGRST116') {
        throw contribError;
      }

      setContribution(data || null);
      setError(null);
    } catch (err: any) {
      console.error('[useMyContribution] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cycleId, user]);

  useEffect(() => {
    fetchContribution();
  }, [fetchContribution]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!cycleId || !user) return;

    const subscription = supabase
      .channel(`contribution-${cycleId}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cycle_contributions',
          filter: `cycle_id=eq.${cycleId}`,
        },
        (payload) => {
          if ((payload.new as any)?.user_id === user.id) {
            fetchContribution();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [cycleId, user, fetchContribution]);

  return { contribution, loading, error, refetch: fetchContribution };
}

/**
 * Hook to get all contributions for a cycle (for circle leaders)
 */
export function useCycleContributions(cycleId: string | undefined) {
  const [contributions, setContributions] = useState<CycleContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    late: 0,
    missed: 0,
    collectedAmount: 0,
    expectedAmount: 0,
    completionRate: 0,
  });

  const fetchContributions = useCallback(async () => {
    if (!cycleId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error: contribError } = await supabase
        .from('cycle_contributions')
        .select(`
          *,
          user:profiles!cycle_contributions_user_id_fkey(
            id, full_name, avatar_url
          )
        `)
        .eq('cycle_id', cycleId)
        .order('status', { ascending: true });

      if (contribError) throw contribError;

      const contribs = data || [];
      setContributions(contribs);

      // Calculate stats
      const completed = contribs.filter(c => c.status === 'completed' || c.status === 'covered');
      const pending = contribs.filter(c => c.status === 'pending' || c.status === 'partial');
      const late = contribs.filter(c => c.status === 'late');
      const missed = contribs.filter(c => c.status === 'missed');

      const collectedAmount = completed.reduce(
        (sum, c) => sum + parseFloat(c.contributed_amount || '0'),
        0
      );
      const expectedAmount = contribs.reduce(
        (sum, c) => sum + parseFloat(c.expected_amount || '0'),
        0
      );

      setStats({
        total: contribs.length,
        completed: completed.length,
        pending: pending.length,
        late: late.length,
        missed: missed.length,
        collectedAmount,
        expectedAmount,
        completionRate: expectedAmount > 0 ? (collectedAmount / expectedAmount) * 100 : 0,
      });

      setError(null);
    } catch (err: any) {
      console.error('[useCycleContributions] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cycleId]);

  useEffect(() => {
    fetchContributions();
  }, [fetchContributions]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!cycleId) return;

    const subscription = supabase
      .channel(`contributions-${cycleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cycle_contributions',
          filter: `cycle_id=eq.${cycleId}`,
        },
        () => {
          fetchContributions();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [cycleId, fetchContributions]);

  return { contributions, stats, loading, error, refetch: fetchContributions };
}

/**
 * Hook to get cycle stats for a circle
 */
export function useCycleStats(circleId: string | undefined) {
  const [stats, setStats] = useState<CycleStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!circleId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Get circle info
      const { data: circle } = await supabase
        .from('circles')
        .select('total_cycles, current_cycle_number')
        .eq('id', circleId)
        .single();

      // Get all cycles
      const { data: cycles } = await supabase
        .from('circle_cycles')
        .select('*')
        .eq('circle_id', circleId);

      const allCycles = cycles || [];
      const completedCycles = allCycles.filter(c => c.status === 'closed');

      // Get next upcoming cycle
      const nextCycle = allCycles.find(c =>
        ['scheduled', 'collecting'].includes(c.status)
      );

      // Calculate totals
      const totalCollected = allCycles.reduce(
        (sum, c) => sum + parseFloat(c.collected_amount || '0'),
        0
      );
      const totalPayouts = completedCycles.reduce(
        (sum, c) => sum + parseFloat(c.payout_amount || '0'),
        0
      );

      // Calculate on-time rate from contributions
      const { data: allContributions } = await supabase
        .from('cycle_contributions')
        .select('was_on_time')
        .eq('circle_id', circleId)
        .eq('status', 'completed');

      const onTimeCount = allContributions?.filter(c => c.was_on_time).length || 0;
      const totalContribs = allContributions?.length || 0;
      const onTimeRate = totalContribs > 0 ? (onTimeCount / totalContribs) * 100 : 100;

      setStats({
        total_cycles: circle?.total_cycles || 0,
        completed_cycles: completedCycles.length,
        current_cycle_number: circle?.current_cycle_number || 1,
        total_collected: totalCollected,
        total_payouts: totalPayouts,
        on_time_rate: onTimeRate,
        next_payout_date: nextCycle?.expected_payout_date,
        next_recipient_id: nextCycle?.recipient_user_id,
      });

      setError(null);
    } catch (err: any) {
      console.error('[useCycleStats] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Hook to get cycle events (audit log)
 */
export function useCycleEvents(cycleId: string | undefined, limit: number = 20) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!cycleId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error: eventsError } = await supabase
        .from('cycle_events')
        .select(`
          *,
          user:profiles!cycle_events_user_id_fkey(
            id, full_name, avatar_url
          ),
          triggered_by_user:profiles!cycle_events_triggered_by_user_id_fkey(
            id, full_name
          )
        `)
        .eq('cycle_id', cycleId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (eventsError) throw eventsError;

      setEvents(data || []);
      setError(null);
    } catch (err: any) {
      console.error('[useCycleEvents] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [cycleId, limit]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, error, refetch: fetchEvents };
}

/**
 * Hook to get user's scheduled reminders
 */
export function useMyReminders() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchReminders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error: remindersError } = await supabase
        .from('scheduled_notifications')
        .select(`
          *,
          circle:circles(id, name),
          cycle:circle_cycles(id, cycle_number, contribution_deadline)
        `)
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .gte('scheduled_for', new Date().toISOString())
        .order('scheduled_for', { ascending: true });

      if (remindersError) throw remindersError;

      setReminders(data || []);
      setError(null);
    } catch (err: any) {
      console.error('[useMyReminders] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  return { reminders, loading, error, refetch: fetchReminders };
}

/**
 * Hook to get user's defaults
 */
export function useMyDefaults() {
  const [defaults, setDefaults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchDefaults = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error: defaultsError } = await supabase
        .from('member_defaults')
        .select(`
          *,
          circle:circles(id, name),
          cycle:circle_cycles(id, cycle_number)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (defaultsError) throw defaultsError;

      setDefaults(data || []);
      setError(null);
    } catch (err: any) {
      console.error('[useMyDefaults] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDefaults();
  }, [fetchDefaults]);

  const unresolvedCount = defaults.filter(d => d.status === 'unresolved').length;
  const totalDefaultAmount = defaults
    .filter(d => d.status === 'unresolved')
    .reduce((sum, d) => sum + parseFloat(d.default_amount || '0'), 0);

  return {
    defaults,
    unresolvedCount,
    totalDefaultAmount,
    loading,
    error,
    refetch: fetchDefaults,
  };
}

/**
 * Hook to generate cycles for a circle (admin action)
 */
export function useGenerateCycles() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCycles = useCallback(async (circleId: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: rpcError } = await supabase
        .rpc('generate_circle_cycles', { p_circle_id: circleId });

      if (rpcError) throw rpcError;

      return { success: true, cyclesCreated: data };
    } catch (err: any) {
      console.error('[useGenerateCycles] Error:', err);
      setError(err.message);
      return { success: false, cyclesCreated: 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateCycles, loading, error };
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get human-readable status label
 */
export function getCycleStatusLabel(status: CycleStatus): string {
  const labels: Record<CycleStatus, string> = {
    scheduled: 'Scheduled',
    collecting: 'Collecting Contributions',
    deadline_reached: 'Deadline Reached',
    grace_period: 'Grace Period',
    ready_payout: 'Ready for Payout',
    payout_pending: 'Payout Processing',
    payout_completed: 'Payout Complete',
    payout_failed: 'Payout Failed',
    payout_retry: 'Retrying Payout',
    closed: 'Closed',
    skipped: 'Skipped',
    cancelled: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Get status color for UI
 */
export function getCycleStatusColor(status: CycleStatus): string {
  const colors: Record<CycleStatus, string> = {
    scheduled: '#6B7280', // Gray
    collecting: '#3B82F6', // Blue
    deadline_reached: '#F59E0B', // Amber
    grace_period: '#EF4444', // Red
    ready_payout: '#10B981', // Green
    payout_pending: '#8B5CF6', // Purple
    payout_completed: '#059669', // Emerald
    payout_failed: '#DC2626', // Red
    payout_retry: '#F97316', // Orange
    closed: '#6B7280', // Gray
    skipped: '#9CA3AF', // Light gray
    cancelled: '#DC2626', // Red
  };
  return colors[status] || '#6B7280';
}

/**
 * Get contribution status label
 */
export function getContributionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pending',
    partial: 'Partial',
    completed: 'Completed',
    late: 'Late',
    missed: 'Missed',
    excused: 'Excused',
    covered: 'Covered',
  };
  return labels[status] || status;
}

/**
 * Get contribution status color
 */
export function getContributionStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: '#F59E0B', // Amber
    partial: '#3B82F6', // Blue
    completed: '#10B981', // Green
    late: '#EF4444', // Red
    missed: '#DC2626', // Dark red
    excused: '#6B7280', // Gray
    covered: '#8B5CF6', // Purple
  };
  return colors[status] || '#6B7280';
}
