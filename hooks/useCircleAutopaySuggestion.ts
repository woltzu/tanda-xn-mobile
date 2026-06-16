// hooks/useCircleAutopaySuggestion.ts
// ─────────────────────────────────────────────────────────────────────────────
// Phase 2 of Circle Contribution Autopay. Returns the active
// circle_autopay_suggestions row for (current user, circleId) and a
// dismiss() helper. Used by the CircleDetailScreen banner.
//
// The row is created by detect_missed_circle_contributions(), which
// the daily EF cron calls (see migration 173). Dismissal stamps
// dismissed_at; subsequent reads return null until the EF inserts a
// new row for a future missed cycle.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export type CircleAutopaySuggestion = {
  id: string;
  user_id: string;
  circle_id: string;
  reason: string;
  suggested_at: string;
  dismissed_at: string | null;
};

export type UseCircleAutopaySuggestionResult = {
  suggestion: CircleAutopaySuggestion | null;
  loading: boolean;
  dismiss: () => Promise<void>;
};

export function useCircleAutopaySuggestion(
  circleId: string | null,
): UseCircleAutopaySuggestionResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [suggestion, setSuggestion] = useState<CircleAutopaySuggestion | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!userId || !circleId) {
      setSuggestion(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("circle_autopay_suggestions")
        .select("id, user_id, circle_id, reason, suggested_at, dismissed_at")
        .eq("user_id", userId)
        .eq("circle_id", circleId)
        .is("dismissed_at", null)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn("[useCircleAutopaySuggestion] read failed", error.message);
        setSuggestion(null);
      } else {
        setSuggestion((data as CircleAutopaySuggestion | null) ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, circleId]);

  const dismiss = useCallback(async () => {
    if (!suggestion) return;
    const prev = suggestion;
    setSuggestion(null); // optimistic
    const { error } = await supabase
      .from("circle_autopay_suggestions")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", prev.id);
    if (error) {
      console.warn("[useCircleAutopaySuggestion] dismiss failed", error.message);
      setSuggestion(prev); // revert
    }
  }, [suggestion]);

  return { suggestion, loading, dismiss };
}
