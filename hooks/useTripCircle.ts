// ══════════════════════════════════════════════════════════════════════════════
// HOOKS: Trip Circle Feature
// ══════════════════════════════════════════════════════════════════════════════
// Provider profiles, live trips, trip details, member dashboards, contributions
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  TripCircleEngine,
  type TripListing,
  type TripMember,
  type TripContribution,
  type TripPaymentSchedule,
  type TripSummary,
  type ProviderProfile,
} from '../services/TripCircleEngine';

// Re-export types for consumer convenience
export type {
  TripListing,
  TripMember,
  TripContribution,
  TripPaymentSchedule,
  TripSummary,
  ProviderProfile,
};

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  1. useProviderProfile — Provider profile management                    │
// └──────────────────────────────────────────────────────────────────────────┘

export function useProviderProfile(userId?: string) {
  const [profile, setProfile] = useState<ProviderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const resolvedId = userId || user?.id;

  const fetch = useCallback(async () => {
    if (!resolvedId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await TripCircleEngine.getProviderProfile(resolvedId);
      setProfile(data);
    } catch (err: any) {
      console.error('useProviderProfile error:', err);
      setError(err.message || 'Failed to load provider profile');
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createProfile = useCallback(async (data: Partial<ProviderProfile>) => {
    if (!resolvedId) return;
    try {
      setError(null);
      await TripCircleEngine.createProviderProfile(resolvedId, data);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to create profile');
      throw err;
    }
  }, [resolvedId, fetch]);

  const updateProfile = useCallback(async (data: Partial<ProviderProfile>) => {
    if (!resolvedId) return;
    try {
      setError(null);
      await TripCircleEngine.updateProviderProfile(resolvedId, data);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      throw err;
    }
  }, [resolvedId, fetch]);

  const submitVerification = useCallback(async (documents: string[]) => {
    if (!resolvedId) return;
    try {
      setError(null);
      await TripCircleEngine.submitVerification(resolvedId, documents);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to submit verification');
      throw err;
    }
  }, [resolvedId, fetch]);

  const requestElderEndorsement = useCallback(async () => {
    if (!resolvedId) return;
    try {
      setError(null);
      await TripCircleEngine.requestElderEndorsement(resolvedId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to request elder endorsement');
      throw err;
    }
  }, [resolvedId, fetch]);

  const isVerified = profile?.verification_status === 'verified';
  const isElderEndorsed = !!profile?.elder_endorsed;

  return {
    profile, loading, error,
    isProvider: !!profile,
    isVerified,
    isElderEndorsed,
    createProfile, updateProfile, submitVerification, requestElderEndorsement,
    refresh: fetch,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  2. useLiveTrips — Browse available trips                               │
// └──────────────────────────────────────────────────────────────────────────┘

export function useLiveTrips(filters?: { category?: string; destination?: string }) {
  const [trips, setTrips] = useState<TripListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      const data = await TripCircleEngine.getLiveTrips(filters);
      setTrips(data);
    } catch (err: any) {
      console.error('useLiveTrips error:', err);
      setError(err.message || 'Failed to load trips');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters?.category, filters?.destination]);

  useEffect(() => { fetch(); }, [fetch]);

  const refresh = useCallback(() => fetch(true), [fetch]);

  return { trips, loading, error, refreshing, refresh };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  3. useProviderTrips — Trips managed by a provider                      │
// └──────────────────────────────────────────────────────────────────────────┘

export function useProviderTrips(providerId?: string) {
  const [trips, setTrips] = useState<TripListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const resolvedId = providerId || user?.id;

  const fetch = useCallback(async () => {
    if (!resolvedId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await TripCircleEngine.getProviderTrips(resolvedId);
      setTrips(data);
    } catch (err: any) {
      console.error('useProviderTrips error:', err);
      setError(err.message || 'Failed to load provider trips');
    } finally {
      setLoading(false);
    }
  }, [resolvedId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createTrip = useCallback(async (data: Partial<TripListing>) => {
    if (!resolvedId) return;
    try {
      setError(null);
      await TripCircleEngine.createTrip(resolvedId, data);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to create trip');
      throw err;
    }
  }, [resolvedId, fetch]);

  const publishTrip = useCallback(async (tripId: string) => {
    try {
      setError(null);
      await TripCircleEngine.publishTrip(tripId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to publish trip');
      throw err;
    }
  }, [fetch]);

  const cancelTrip = useCallback(async (tripId: string) => {
    try {
      setError(null);
      await TripCircleEngine.cancelTrip(tripId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel trip');
      throw err;
    }
  }, [fetch]);

  const activeTrips = useMemo(
    () => trips.filter(t => t.status === 'active' || t.status === 'published'),
    [trips],
  );

  const draftTrips = useMemo(
    () => trips.filter(t => t.status === 'draft'),
    [trips],
  );

  return {
    trips, loading, error,
    activeTrips, draftTrips,
    createTrip, publishTrip, cancelTrip,
    refresh: fetch,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  4. useTripDetail — Single trip with realtime updates                    │
// └──────────────────────────────────────────────────────────────────────────┘

export function useTripDetail(tripId?: string) {
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetch = useCallback(async () => {
    if (!tripId) return;
    try {
      setLoading(true);
      setError(null);
      const [sum, mem] = await Promise.all([
        TripCircleEngine.getTripSummary(tripId),
        TripCircleEngine.getTripMembers(tripId),
      ]);
      setSummary(sum);
      setMembers(mem);
    } catch (err: any) {
      console.error('useTripDetail error:', err);
      setError(err.message || 'Failed to load trip details');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime subscription
  useEffect(() => {
    if (!tripId) return;

    const unsubscribe = TripCircleEngine.subscribeToTrip(tripId, {
      onSummaryUpdate: (updated: TripSummary) => setSummary(updated),
      onMemberUpdate: (updated: TripMember[]) => setMembers(updated),
    });

    return () => { unsubscribe(); };
  }, [tripId]);

  const joinTrip = useCallback(async (userId?: string) => {
    if (!tripId) return;
    const uid = userId || user?.id;
    if (!uid) return;
    try {
      setError(null);
      await TripCircleEngine.joinTrip(tripId, uid);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to join trip');
      throw err;
    }
  }, [tripId, user?.id, fetch]);

  const payDeposit = useCallback(async (memberId: string) => {
    try {
      setError(null);
      await TripCircleEngine.payDeposit(memberId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to pay deposit');
      throw err;
    }
  }, [fetch]);

  // Computed values
  const spotsRemaining = useMemo(() => {
    if (!summary) return 0;
    return (summary.max_members ?? 0) - members.length;
  }, [summary, members]);

  const percentComplete = useMemo(() => {
    if (!summary || !summary.target_amount) return 0;
    return Math.min(100, Math.round(((summary.collected_amount ?? 0) / summary.target_amount) * 100));
  }, [summary]);

  const daysLeft = useMemo(() => {
    if (!summary?.departure_date) return null;
    const diff = new Date(summary.departure_date).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [summary]);

  const isJoined = useCallback((userId?: string) => {
    const uid = userId || user?.id;
    if (!uid) return false;
    return members.some(m => m.user_id === uid);
  }, [members, user?.id]);

  return {
    summary, members, loading, error,
    spotsRemaining, percentComplete, daysLeft, isJoined,
    joinTrip, payDeposit,
    refresh: fetch,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  5. useMemberTripDashboard — Individual member trip progress             │
// └──────────────────────────────────────────────────────────────────────────┘

export function useMemberTripDashboard(userId?: string, tripId?: string) {
  const [memberDetail, setMemberDetail] = useState<TripMember | null>(null);
  const [schedule, setSchedule] = useState<TripPaymentSchedule[]>([]);
  const [contributions, setContributions] = useState<TripContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const resolvedUserId = userId || user?.id;

  const fetch = useCallback(async () => {
    if (!resolvedUserId || !tripId) return;
    try {
      setLoading(true);
      setError(null);
      const detail = await TripCircleEngine.getMemberTripDetail(resolvedUserId, tripId);
      setMemberDetail(detail);

      if (detail?.id) {
        const [sched, contribs] = await Promise.all([
          TripCircleEngine.getPaymentSchedule(detail.id),
          TripCircleEngine.getContributionHistory(detail.id),
        ]);
        setSchedule(sched);
        setContributions(contribs);
      }
    } catch (err: any) {
      console.error('useMemberTripDashboard error:', err);
      setError(err.message || 'Failed to load member trip dashboard');
    } finally {
      setLoading(false);
    }
  }, [resolvedUserId, tripId]);

  useEffect(() => { fetch(); }, [fetch]);

  const makePayment = useCallback(async (scheduleId: string) => {
    try {
      setError(null);
      await TripCircleEngine.makePayment(scheduleId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to make payment');
      throw err;
    }
  }, [fetch]);

  const cancelMembership = useCallback(async () => {
    if (!memberDetail?.id) return;
    try {
      setError(null);
      await TripCircleEngine.cancelMembership(memberDetail.id);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel membership');
      throw err;
    }
  }, [memberDetail?.id, fetch]);

  // Computed values
  const totalPaid = useMemo(
    () => contributions.reduce((sum, c) => sum + (c.amount ?? 0), 0),
    [contributions],
  );

  const remainingAmount = useMemo(
    () => (memberDetail?.total_amount ?? 0) - totalPaid,
    [memberDetail, totalPaid],
  );

  const myProgress = useMemo(() => {
    if (!memberDetail?.total_amount) return 0;
    return Math.min(100, Math.round((totalPaid / memberDetail.total_amount) * 100));
  }, [totalPaid, memberDetail]);

  const nextPaymentDue = useMemo(() => {
    const upcoming = schedule
      .filter(s => s.status === 'pending' || s.status === 'upcoming')
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    return upcoming[0] ?? null;
  }, [schedule]);

  const groupProgress = useMemo(() => {
    if (!memberDetail?.trip_target_amount) return 0;
    return Math.min(100, Math.round(((memberDetail.trip_collected_amount ?? 0) / memberDetail.trip_target_amount) * 100));
  }, [memberDetail]);

  return {
    memberDetail, schedule, contributions, loading, error,
    myProgress, nextPaymentDue, totalPaid, remainingAmount, groupProgress,
    makePayment, cancelMembership,
    refresh: fetch,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  6. useTripContributions — Contribution history for a trip member        │
// └──────────────────────────────────────────────────────────────────────────┘

export function useTripContributions(tripMemberId?: string) {
  const [contributions, setContributions] = useState<TripContribution[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!tripMemberId) return;
    try {
      setLoading(true);
      const data = await TripCircleEngine.getContributionHistory(tripMemberId);
      setContributions(data);
    } catch (err) {
      console.error('useTripContributions error:', err);
    } finally {
      setLoading(false);
    }
  }, [tripMemberId]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalPaid = useMemo(
    () => contributions.reduce((sum, c) => sum + (c.amount ?? 0), 0),
    [contributions],
  );

  const depositPaid = useMemo(
    () => contributions.some(c => c.type === 'deposit'),
    [contributions],
  );

  return { contributions, loading, totalPaid, depositPaid, refresh: fetch };
}
