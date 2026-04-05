// ══════════════════════════════════════════════════════════════════════════════
// Contribution Mood Detection Hooks — Feature #31
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import {
  ContributionMoodDetectionEngine,
  type MemberMessage,
  type MoodBaseline,
  type MoodSnapshot,
  type MoodIntervention,
  type MoodKeyword,
  type MoodPreference,
  type MoodDashboardRow,
  type MemberMoodSummary,
  type MoodTier,
  type MoodTrend,
  type MoodInterventionType,
  type MoodInterventionOutcome,
  type MoodInterventionChannel,
  type MoodSignalBreakdown,
  type MessageChannel,
} from "../services/ContributionMoodDetectionEngine";
import { useAuth } from "../context/AuthContext";

export type {
  MemberMessage, MoodBaseline, MoodSnapshot, MoodIntervention, MoodKeyword,
  MoodPreference, MoodDashboardRow, MemberMoodSummary, MoodTier, MoodTrend,
  MoodInterventionType, MoodInterventionOutcome, MoodInterventionChannel,
  MoodSignalBreakdown, MessageChannel,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. useMoodScore — Current mood snapshot + tier + trend + history
// ═══════════════════════════════════════════════════════════════════════════════

export function useMoodScore() {
  const { user } = useAuth();
  const [currentSnapshot, setCurrentSnapshot] = useState<MoodSnapshot | null>(null);
  const [history, setHistory] = useState<MoodSnapshot[]>([]);
  const [baseline, setBaseline] = useState<MoodBaseline | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [snap, hist, base] = await Promise.all([
        ContributionMoodDetectionEngine.getLatestSnapshot(user.id),
        ContributionMoodDetectionEngine.getSnapshotHistory(user.id, 12),
        ContributionMoodDetectionEngine.getBaseline(user.id),
      ]);
      setCurrentSnapshot(snap);
      setHistory(hist);
      setBaseline(base);
    } catch (err) {
      console.error("useMoodScore error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime snapshot updates
  useEffect(() => {
    if (!user?.id) return;
    const sub = ContributionMoodDetectionEngine.subscribeToSnapshots(
      user.id,
      (snapshot) => {
        setCurrentSnapshot(snapshot);
        setHistory(prev => [snapshot, ...prev.slice(0, 11)]);
      }
    );
    return () => { sub.unsubscribe(); };
  }, [user?.id]);

  const tier = currentSnapshot?.tier ?? "stable";
  const isAtRisk = tier === "disengaging" || tier === "at_risk";
  const isDrifting = tier !== "stable";
  const trend = currentSnapshot?.trend ?? "stable";
  const hasBaseline = baseline?.isEstablished ?? false;

  return {
    currentSnapshot, history, baseline, tier, isAtRisk, isDrifting,
    trend, hasBaseline, loading, refresh: fetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. useMoodIntervention — Active intervention + response actions
// ═══════════════════════════════════════════════════════════════════════════════

export function useMoodIntervention() {
  const { user } = useAuth();
  const [activeIntervention, setActiveIntervention] = useState<MoodIntervention | null>(null);
  const [interventionHistory, setInterventionHistory] = useState<MoodIntervention[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [active, history] = await Promise.all([
        ContributionMoodDetectionEngine.getActiveIntervention(user.id),
        ContributionMoodDetectionEngine.getMemberInterventions(user.id),
      ]);
      setActiveIntervention(active);
      setInterventionHistory(history);
    } catch (err) {
      console.error("useMoodIntervention error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const sub = ContributionMoodDetectionEngine.subscribeToInterventions(
      user.id,
      (intervention) => {
        const active = ["pending", "pending_review", "sent", "viewed"];
        if (active.includes(intervention.outcome)) {
          setActiveIntervention(intervention);
        } else {
          setActiveIntervention(null);
        }
        setInterventionHistory(prev => {
          const idx = prev.findIndex(i => i.id === intervention.id);
          if (idx >= 0) { const u = [...prev]; u[idx] = intervention; return u; }
          return [intervention, ...prev];
        });
      }
    );
    return () => { sub.unsubscribe(); };
  }, [user?.id]);

  const hasActive = activeIntervention !== null;
  const needsReview = activeIntervention?.requiresReview && !activeIntervention.reviewedAt;

  return {
    activeIntervention, interventionHistory, hasActive, needsReview,
    loading, refresh: fetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. useMoodSummary — Full member mood summary
// ═══════════════════════════════════════════════════════════════════════════════

export function useMoodSummary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MemberMoodSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await ContributionMoodDetectionEngine.getMemberSummary(user.id);
      setSummary(data);
    } catch (err) {
      console.error("useMoodSummary error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { summary, loading, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. useMoodActions — Log messages, respond to interventions, manage opt-out
// ═══════════════════════════════════════════════════════════════════════════════

export function useMoodActions() {
  const { user } = useAuth();
  const [logging, setLogging] = useState(false);
  const [responding, setResponding] = useState(false);

  const logMessage = useCallback(async (
    messageText: string,
    channel: MessageChannel,
    options?: {
      circleId?: string;
      threadId?: string;
      replyToId?: string;
      language?: string;
      sentAt?: string;
    }
  ) => {
    if (!user?.id) throw new Error("Not authenticated");
    setLogging(true);
    try {
      return await ContributionMoodDetectionEngine.logMessage(
        user.id, messageText, channel, options
      );
    } finally {
      setLogging(false);
    }
  }, [user?.id]);

  const acceptIntervention = useCallback(async (interventionId: string) => {
    setResponding(true);
    try {
      return await ContributionMoodDetectionEngine.acceptIntervention(interventionId);
    } finally {
      setResponding(false);
    }
  }, []);

  const declineIntervention = useCallback(async (interventionId: string) => {
    setResponding(true);
    try {
      return await ContributionMoodDetectionEngine.declineIntervention(interventionId);
    } finally {
      setResponding(false);
    }
  }, []);

  const markViewed = useCallback(async (interventionId: string) => {
    return await ContributionMoodDetectionEngine.markViewed(interventionId);
  }, []);

  const setOptOut = useCallback(async (optOut: boolean) => {
    if (!user?.id) throw new Error("Not authenticated");
    return await ContributionMoodDetectionEngine.setOptOut(user.id, optOut);
  }, [user?.id]);

  return {
    logMessage, acceptIntervention, declineIntervention, markViewed,
    setOptOut, logging, responding,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. useMoodDashboard — Admin dashboard metrics
// ═══════════════════════════════════════════════════════════════════════════════

export function useMoodDashboard() {
  const [dashboard, setDashboard] = useState<MoodDashboardRow[]>([]);
  const [flaggedMembers, setFlaggedMembers] = useState<MoodSnapshot[]>([]);
  const [pendingReviews, setPendingReviews] = useState<MoodIntervention[]>([]);
  const [metrics, setMetrics] = useState<Awaited<
    ReturnType<typeof ContributionMoodDetectionEngine.getInterventionMetrics>
  > | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, flagged, reviews, met] = await Promise.all([
        ContributionMoodDetectionEngine.getDashboard(),
        ContributionMoodDetectionEngine.getFlaggedMembers(),
        ContributionMoodDetectionEngine.getPendingReviews(),
        ContributionMoodDetectionEngine.getInterventionMetrics(),
      ]);
      setDashboard(dash);
      setFlaggedMembers(flagged);
      setPendingReviews(reviews);
      setMetrics(met);
    } catch (err) {
      console.error("useMoodDashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { dashboard, flaggedMembers, pendingReviews, metrics, loading, refresh: fetch };
}
