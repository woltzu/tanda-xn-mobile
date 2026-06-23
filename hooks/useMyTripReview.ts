// ═══════════════════════════════════════════════════════════════════════════
// hooks/useMyTripReview.ts — Leave-review Bucket A.4
// ═══════════════════════════════════════════════════════════════════════════
//
// Per-participant trip review state. Wraps:
//   • getMyReview         → existing organizer + activity reviews (if any)
//   • submitReview        → calls the submit_trip_review RPC
//   • eligibility         → derived (trip.endDate < today AND status='confirmed')
//
// The screen layer uses `eligible` to decide whether to render the
// "Rate your trip" CTA and `review.organizerReview` (truthy) to swap into
// the "✓ Reviewed" state. The RPC itself re-enforces eligibility
// server-side, so the client check is purely a UX gate.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import {
  TripOrganizerEngine,
  type MyTripReviewBundle,
  type Trip,
  type TripParticipant,
} from "../services/TripOrganizerEngine";

export interface UseMyTripReviewResult {
  review: MyTripReviewBundle | null;
  isLoading: boolean;
  error: string | null;
  eligible: boolean;
  alreadyReviewed: boolean;
  submit: (
    organizerRating: number,
    organizerReviewText: string | null,
    activityRatings:
      | Array<{ activityId: string; rating: number; text: string | null }>
      | null,
  ) => Promise<string>;
  isSubmitting: boolean;
  refresh: () => Promise<void>;
}

export function useMyTripReview(
  trip: Trip | null,
  participant: TripParticipant | null,
): UseMyTripReviewResult {
  const [review, setReview] = useState<MyTripReviewBundle | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const participantId = participant?.id ?? null;

  const refresh = useCallback(async () => {
    if (!participantId) {
      setReview(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const bundle = await TripOrganizerEngine.getMyReview(participantId);
      setReview(bundle);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load review");
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Eligibility: trip has ended AND participant is confirmed. The
  // ParticipantStatus union has no 'completed' value, so 'confirmed' is
  // the active-attended state we gate on.
  const today = new Date();
  const endDate = trip?.endDate ? new Date(trip.endDate) : null;
  const tripEnded =
    !!endDate &&
    endDate.getTime() <
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() +
        24 * 60 * 60 * 1000;
  const eligible = tripEnded && participant?.status === "confirmed";

  const alreadyReviewed = !!review?.organizerReview;

  const submit = useCallback(
    async (
      organizerRating: number,
      organizerReviewText: string | null,
      activityRatings:
        | Array<{ activityId: string; rating: number; text: string | null }>
        | null,
    ) => {
      if (!participantId) {
        throw new Error("No participant context");
      }
      try {
        setSubmitting(true);
        const id = await TripOrganizerEngine.submitReview(
          participantId,
          organizerRating,
          organizerReviewText,
          activityRatings,
        );
        await refresh();
        return id;
      } finally {
        setSubmitting(false);
      }
    },
    [participantId, refresh],
  );

  return {
    review,
    isLoading,
    error,
    eligible,
    alreadyReviewed,
    submit,
    isSubmitting,
    refresh,
  };
}
