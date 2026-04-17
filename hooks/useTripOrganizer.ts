// ══════════════════════════════════════════════════════════════════════════════
// HOOKS: Trip Organizer Feature
// ══════════════════════════════════════════════════════════════════════════════
// Organizer trips, dashboards, itineraries, participants, messaging, vendors,
// public trips, participant status, document submissions, payments
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  TripOrganizerEngine,
  type Trip,
  type TripDay,
  type TripActivity,
  type TripParticipant,
  type TripSubmission,
  type TripPayment,
  type TripVendor,
  type TripMessage,
  type TripDashboard,
  type ParticipantStatus,
} from '../services/TripOrganizerEngine';

// Re-export types for consumer convenience
export type {
  Trip,
  TripDay,
  TripActivity,
  TripParticipant,
  TripSubmission,
  TripPayment,
  TripVendor,
  TripMessage,
  TripDashboard,
  ParticipantStatus,
};

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  1. useOrganizerTrips — Trips managed by the organizer                  │
// └──────────────────────────────────────────────────────────────────────────┘

export function useOrganizerTrips(userId?: string) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // If no userId passed in, resolve from the current auth session
      let resolvedId = userId;
      if (!resolvedId) {
        const { data: { user } } = await supabase.auth.getUser();
        resolvedId = user?.id;
      }
      if (!resolvedId) {
        setTrips([]);
        return;
      }

      const data = await TripOrganizerEngine.getOrganizerTrips(resolvedId);
      setTrips(data);
    } catch (err: any) {
      console.error('useOrganizerTrips error:', err);
      setError(err.message || 'Failed to load organizer trips');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { trips, loading, error, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  2. useTripDashboard — Dashboard with realtime participant updates       │
// └──────────────────────────────────────────────────────────────────────────┘

export function useTripDashboard(tripId: string) {
  const [dashboard, setDashboard] = useState<TripDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tripId || tripId === 'new') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await TripOrganizerEngine.getTripDashboard(tripId);
      setDashboard(data);
    } catch (err: any) {
      console.error('useTripDashboard error:', err);
      setError(err.message || 'Failed to load trip dashboard');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime subscription for participant changes
  useEffect(() => {
    if (!tripId || tripId === 'new') return;

    const channel = TripOrganizerEngine.subscribeToParticipants(tripId, () => {
      fetch();
    });

    return () => { channel?.unsubscribe?.(); };
  }, [tripId, fetch]);

  return { dashboard, loading, error, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  3. useCreateTripWizard — Multi-step trip creation wizard                │
// └──────────────────────────────────────────────────────────────────────────┘

export function useCreateTripWizard() {
  const [currentStep, setCurrentStep] = useState(0);
  const [draftData, setDraftData] = useState<Partial<Trip>>({});
  const [savedTripId, setSavedTripId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, 5));
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const updateStepData = useCallback((data: Partial<Trip>) => {
    setDraftData((prev) => ({ ...prev, ...data }));
  }, []);

  const saveDraft = useCallback(async (dataOverride?: Partial<Trip>): Promise<string> => {
    const dataToSave = dataOverride ?? draftData;
    try {
      setLoading(true);
      setError(null);
      if (savedTripId) {
        await TripOrganizerEngine.updateTrip(savedTripId, dataToSave);
        return savedTripId;
      } else {
        const created = await TripOrganizerEngine.createTrip(dataToSave);
        setSavedTripId(created.id);
        return created.id;
      }
    } catch (err: any) {
      console.error('useCreateTripWizard saveDraft error:', err);
      setError(err.message || 'Failed to save draft');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [savedTripId, draftData]);

  const publish = useCallback(async (tripIdOverride?: string): Promise<Trip | null> => {
    const idToPublish = tripIdOverride || savedTripId;
    if (!idToPublish) {
      setError('No saved trip to publish. Save a draft first.');
      return null;
    }
    try {
      setLoading(true);
      setError(null);
      const publishedTrip = await TripOrganizerEngine.publishTrip(idToPublish);
      return publishedTrip;
    } catch (err: any) {
      console.error('useCreateTripWizard publish error:', err);
      setError(err.message || 'Failed to publish trip');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [savedTripId]);

  // Pre-seed the wizard with an existing tripId so saveDraft performs an
  // update instead of a create (used for edit mode). Optionally hydrate
  // the draft data in the same call.
  const initEditMode = useCallback((tripId: string, data?: Partial<Trip>) => {
    setSavedTripId(tripId);
    if (data) setDraftData(data);
  }, []);

  return {
    currentStep, draftData, savedTripId, loading, error,
    nextStep, prevStep, updateStepData, saveDraft, publish, initEditMode,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  4. useItineraryBuilder — Manage days and activities for a trip          │
// └──────────────────────────────────────────────────────────────────────────┘

type DayWithActivities = TripDay & { activities: TripActivity[] };

export function useItineraryBuilder(tripId: string) {
  const [days, setDays] = useState<DayWithActivities[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tripId || tripId === 'new') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await TripOrganizerEngine.getTripItinerary(tripId);
      setDays(data);
    } catch (err: any) {
      console.error('useItineraryBuilder error:', err);
      setError(err.message || 'Failed to load itinerary');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addDay = useCallback(async (dayData: Partial<TripDay>) => {
    try {
      setError(null);
      await TripOrganizerEngine.addDay(tripId, dayData);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to add day');
      throw err;
    }
  }, [tripId, fetch]);

  const updateDay = useCallback(async (dayId: string, dayData: Partial<TripDay>) => {
    try {
      setError(null);
      await TripOrganizerEngine.updateDay(dayId, dayData);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to update day');
      throw err;
    }
  }, [fetch]);

  const deleteDay = useCallback(async (dayId: string) => {
    try {
      setError(null);
      await TripOrganizerEngine.deleteDay(dayId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to delete day');
      throw err;
    }
  }, [fetch]);

  const reorderDays = useCallback(async (orderedDayIds: string[]) => {
    try {
      setError(null);
      const order = orderedDayIds.map((dayId, i) => ({ dayId, sortOrder: i }));
      await TripOrganizerEngine.reorderDays(tripId, order);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to reorder days');
      throw err;
    }
  }, [tripId, fetch]);

  const addActivity = useCallback(async (dayId: string, activityData: Partial<TripActivity>) => {
    try {
      setError(null);
      await TripOrganizerEngine.addActivity(dayId, activityData);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to add activity');
      throw err;
    }
  }, [fetch]);

  const updateActivity = useCallback(async (activityId: string, activityData: Partial<TripActivity>) => {
    try {
      setError(null);
      await TripOrganizerEngine.updateActivity(activityId, activityData);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to update activity');
      throw err;
    }
  }, [fetch]);

  const deleteActivity = useCallback(async (activityId: string) => {
    try {
      setError(null);
      await TripOrganizerEngine.deleteActivity(activityId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to delete activity');
      throw err;
    }
  }, [fetch]);

  return {
    days, loading, error,
    addDay, updateDay, deleteDay, reorderDays,
    addActivity, updateActivity, deleteActivity,
    refresh: fetch,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  5. useParticipantManager — Manage participants with status filtering    │
// └──────────────────────────────────────────────────────────────────────────┘

export function useParticipantManager(tripId: string) {
  const [participants, setParticipants] = useState<TripParticipant[]>([]);
  const [statusFilter, setStatusFilterState] = useState<ParticipantStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tripId || tripId === 'new') return;
    try {
      setLoading(true);
      setError(null);
      const data = await TripOrganizerEngine.getParticipants(tripId, statusFilter);
      setParticipants(data);
    } catch (err: any) {
      console.error('useParticipantManager error:', err);
      setError(err.message || 'Failed to load participants');
    } finally {
      setLoading(false);
    }
  }, [tripId, statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime subscription
  useEffect(() => {
    if (!tripId || tripId === 'new') return;

    const channel = TripOrganizerEngine.subscribeToParticipants(tripId, () => {
      fetch();
    });

    return () => { channel?.unsubscribe?.(); };
  }, [tripId, fetch]);

  const setStatusFilter = useCallback((status: ParticipantStatus | null) => {
    setStatusFilterState(status);
  }, []);

  const confirmParticipant = useCallback(async (participantId: string) => {
    try {
      setError(null);
      await TripOrganizerEngine.confirmParticipant(participantId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm participant');
      throw err;
    }
  }, [fetch]);

  const cancelParticipant = useCallback(async (participantId: string) => {
    try {
      setError(null);
      await TripOrganizerEngine.cancelParticipant(participantId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel participant');
      throw err;
    }
  }, [fetch]);

  return {
    participants, statusFilter, loading, error,
    setStatusFilter, confirmParticipant, cancelParticipant,
    refresh: fetch,
  };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  6. useParticipantDetail — Single participant with actions               │
// └──────────────────────────────────────────────────────────────────────────┘

export function useParticipantDetail(participantId: string) {
  const [participant, setParticipant] = useState<TripParticipant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!participantId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await TripOrganizerEngine.getParticipantDetail(participantId);
      setParticipant(data);
    } catch (err: any) {
      console.error('useParticipantDetail error:', err);
      setError(err.message || 'Failed to load participant detail');
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const confirm = useCallback(async () => {
    if (!participantId) return;
    try {
      setError(null);
      await TripOrganizerEngine.confirmParticipant(participantId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm participant');
      throw err;
    }
  }, [participantId, fetch]);

  const cancel = useCallback(async () => {
    if (!participantId) return;
    try {
      setError(null);
      await TripOrganizerEngine.cancelParticipant(participantId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel participant');
      throw err;
    }
  }, [participantId, fetch]);

  const verifySubmission = useCallback(async (submissionId: string) => {
    try {
      setError(null);
      await TripOrganizerEngine.verifySubmission(submissionId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to verify submission');
      throw err;
    }
  }, [fetch]);

  return { participant, loading, error, confirm, cancel, verifySubmission, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  7. useTripMessaging — Broadcast, direct, and realtime messages          │
// └──────────────────────────────────────────────────────────────────────────┘

export function useTripMessaging(tripId: string) {
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const fetch = useCallback(async () => {
    if (!tripId || tripId === 'new') return;
    try {
      setLoading(true);
      setError(null);
      const data = await TripOrganizerEngine.getTripMessages(tripId);
      setMessages(data);
    } catch (err: any) {
      console.error('useTripMessaging error:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime subscription — append new messages
  useEffect(() => {
    if (!tripId || tripId === 'new') return;

    const channel = TripOrganizerEngine.subscribeToMessages(tripId, (payload: any) => {
      if (payload?.new) {
        setMessages((prev) => [...prev, payload.new as TripMessage]);
      }
    });

    return () => { channel?.unsubscribe?.(); };
  }, [tripId]);

  const sendBroadcast = useCallback(async (content: string) => {
    try {
      setSending(true);
      setError(null);
      await TripOrganizerEngine.sendBroadcast(tripId, content);
    } catch (err: any) {
      setError(err.message || 'Failed to send broadcast');
      throw err;
    } finally {
      setSending(false);
    }
  }, [tripId]);

  const sendDirect = useCallback(async (participantId: string, content: string) => {
    try {
      setSending(true);
      setError(null);
      await TripOrganizerEngine.sendDirect(tripId, participantId, content);
    } catch (err: any) {
      setError(err.message || 'Failed to send direct message');
      throw err;
    } finally {
      setSending(false);
    }
  }, [tripId]);

  const markRead = useCallback(async (messageId: string) => {
    try {
      setError(null);
      await TripOrganizerEngine.markMessageRead(messageId);
    } catch (err: any) {
      setError(err.message || 'Failed to mark message as read');
      throw err;
    }
  }, []);

  return { messages, loading, error, sending, sendBroadcast, sendDirect, markRead };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  8. useTripVendors — Vendor management with budget tracking             │
// └──────────────────────────────────────────────────────────────────────────┘

export function useTripVendors(tripId: string) {
  const [vendors, setVendors] = useState<TripVendor[]>([]);
  const [budget, setBudget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tripId || tripId === 'new') return;
    try {
      setLoading(true);
      setError(null);
      const [vendorData, budgetData] = await Promise.all([
        TripOrganizerEngine.getTripVendors(tripId),
        TripOrganizerEngine.getTripBudget(tripId),
      ]);
      setVendors(vendorData);
      setBudget(budgetData);
    } catch (err: any) {
      console.error('useTripVendors error:', err);
      setError(err.message || 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { fetch(); }, [fetch]);

  const addVendor = useCallback(async (vendorData: Partial<TripVendor>) => {
    try {
      setError(null);
      await TripOrganizerEngine.addVendor(tripId, vendorData);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to add vendor');
      throw err;
    }
  }, [tripId, fetch]);

  const updateVendor = useCallback(async (vendorId: string, vendorData: Partial<TripVendor>) => {
    try {
      setError(null);
      await TripOrganizerEngine.updateVendor(vendorId, vendorData);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to update vendor');
      throw err;
    }
  }, [fetch]);

  const deleteVendor = useCallback(async (vendorId: string) => {
    try {
      setError(null);
      await TripOrganizerEngine.deleteVendor(vendorId);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to delete vendor');
      throw err;
    }
  }, [fetch]);

  return { vendors, budget, loading, error, addVendor, updateVendor, deleteVendor, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  9. usePublicTrip — Public trip view by slug                            │
// └──────────────────────────────────────────────────────────────────────────┘

export function usePublicTrip(slug: string, tripId?: string) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (slug) {
        const data = await TripOrganizerEngine.getPublicTrip(slug);
        setTrip(data);
      } else if (tripId && tripId !== 'new') {
        // Fallback: organizer preview before publish — look up by tripId
        const data = await TripOrganizerEngine.getPublicTripById(tripId);
        setTrip(data);
      } else {
        setTrip(null);
      }
    } catch (err: any) {
      console.error('usePublicTrip error:', err);
      setError(err.message || 'Failed to load public trip');
    } finally {
      setLoading(false);
    }
  }, [slug, tripId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { trip, loading, error };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  10. useMyTripStatus — Participant's own trip status                     │
// └──────────────────────────────────────────────────────────────────────────┘

export function useMyTripStatus(tripId: string, userId: string) {
  const [participant, setParticipant] = useState<TripParticipant | null>(null);
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [submissions, setSubmissions] = useState<TripSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!tripId || !userId) return;
    try {
      setLoading(true);
      setError(null);
      const participantRecord = await TripOrganizerEngine.findParticipant(tripId, userId);
      setParticipant(participantRecord);

      if (participantRecord?.id) {
        const [paymentData, submissionData] = await Promise.all([
          TripOrganizerEngine.getPaymentHistory(participantRecord.id),
          TripOrganizerEngine.getMySubmissions(participantRecord.id),
        ]);
        setPayments(paymentData);
        setSubmissions(submissionData);
      }
    } catch (err: any) {
      console.error('useMyTripStatus error:', err);
      setError(err.message || 'Failed to load trip status');
    } finally {
      setLoading(false);
    }
  }, [tripId, userId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { participant, payments, submissions, loading, error, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  11. useDocumentSubmission — Submit and track required documents         │
// └──────────────────────────────────────────────────────────────────────────┘

export function useDocumentSubmission(participantId: string, tripId: string) {
  const [submissions, setSubmissions] = useState<TripSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetch = useCallback(async () => {
    if (!participantId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await TripOrganizerEngine.getMySubmissions(participantId);
      setSubmissions(data);
    } catch (err: any) {
      console.error('useDocumentSubmission error:', err);
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => { fetch(); }, [fetch]);

  const submitDocument = useCallback(async (fieldKey: string, fieldType: string, data: any) => {
    try {
      setSubmitting(true);
      setError(null);
      await TripOrganizerEngine.submitDocument(participantId, tripId, fieldKey, fieldType, data);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to submit document');
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [participantId, tripId, fetch]);

  return { submissions, loading, error, submitting, submitDocument, refresh: fetch };
}

// ┌──────────────────────────────────────────────────────────────────────────┐
// │  12. useTripPayment — Payment history with realtime updates             │
// └──────────────────────────────────────────────────────────────────────────┘

export function useTripPayment(participantId: string) {
  const [payments, setPayments] = useState<TripPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetch = useCallback(async () => {
    if (!participantId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await TripOrganizerEngine.getPaymentHistory(participantId);
      setPayments(data);
    } catch (err: any) {
      console.error('useTripPayment error:', err);
      setError(err.message || 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime subscription for payment updates
  useEffect(() => {
    if (!participantId) return;

    const channel = TripOrganizerEngine.subscribeToPayments(participantId, () => {
      fetch();
    });

    return () => { channel?.unsubscribe?.(); };
  }, [participantId, fetch]);

  const recordPayment = useCallback(async (paymentData: Partial<TripPayment>) => {
    try {
      setProcessing(true);
      setError(null);
      await TripOrganizerEngine.recordPayment(participantId, paymentData);
      await fetch();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
      throw err;
    } finally {
      setProcessing(false);
    }
  }, [participantId, fetch]);

  return { payments, loading, error, processing, recordPayment, refresh: fetch };
}
