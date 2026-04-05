// ══════════════════════════════════════════════════════════════════════════════
// Financial Stress Prediction Hooks — Feature #33
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import {
  FinancialStressPredictionEngine,
  type StressScore,
  type StressSignal,
  type StressIntervention,
  type StressStatus,
  type StressTrend,
  type StressSignalType,
  type StressInterventionType,
  type InterventionOutcome,
  type SignalBreakdown,
  type MemberStressSummary,
  type StressDashboardRow,
  type EligibilityForIntervention,
  type StressKeyword,
  type ContributionDelayData,
  type TicketLanguageData,
  type LoginDropData,
  type EarlyPayoutRequestData,
} from "../services/FinancialStressPredictionEngine";
import { useAuth } from "../context/AuthContext";

export type {
  StressScore, StressSignal, StressIntervention, StressStatus, StressTrend,
  StressSignalType, StressInterventionType, InterventionOutcome, SignalBreakdown,
  MemberStressSummary, StressDashboardRow, EligibilityForIntervention, StressKeyword,
  ContributionDelayData, TicketLanguageData, LoginDropData, EarlyPayoutRequestData,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. useStressScore — Current score + trend + history
// ═══════════════════════════════════════════════════════════════════════════════

export function useStressScore() {
  const { user } = useAuth();
  const [currentScore, setCurrentScore] = useState<StressScore | null>(null);
  const [history, setHistory] = useState<StressScore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [score, hist] = await Promise.all([
        FinancialStressPredictionEngine.getLatestScore(user.id),
        FinancialStressPredictionEngine.getScoreHistory(user.id, 14),
      ]);
      setCurrentScore(score);
      setHistory(hist);
    } catch (err) {
      console.error("useStressScore error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime score updates
  useEffect(() => {
    if (!user?.id) return;
    const sub = FinancialStressPredictionEngine.subscribeToScores(
      user.id,
      (score) => {
        setCurrentScore(score);
        setHistory(prev => [score, ...prev.slice(0, 13)]);
      }
    );
    return () => { sub.unsubscribe(); };
  }, [user?.id]);

  const stressLevel = currentScore?.status ?? "green";
  const isAtRisk = stressLevel === "orange" || stressLevel === "red";
  const trend = currentScore?.trend ?? "stable";

  return {
    currentScore, history, stressLevel, isAtRisk, trend,
    loading, refresh: fetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. useStressIntervention — Active intervention + response actions
// ═══════════════════════════════════════════════════════════════════════════════

export function useStressIntervention() {
  const { user } = useAuth();
  const [activeIntervention, setActiveIntervention] = useState<StressIntervention | null>(null);
  const [interventionHistory, setInterventionHistory] = useState<StressIntervention[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [active, history] = await Promise.all([
        FinancialStressPredictionEngine.getActiveIntervention(user.id),
        FinancialStressPredictionEngine.getMemberInterventions(user.id),
      ]);
      setActiveIntervention(active);
      setInterventionHistory(history);
    } catch (err) {
      console.error("useStressIntervention error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime intervention updates
  useEffect(() => {
    if (!user?.id) return;
    const sub = FinancialStressPredictionEngine.subscribeToInterventions(
      user.id,
      (intervention) => {
        if (intervention.outcome === "pending") {
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

  const hasActiveIntervention = activeIntervention !== null;
  const acceptedCount = interventionHistory.filter(
    i => i.outcome === "accepted" || i.outcome === "completed"
  ).length;

  return {
    activeIntervention, interventionHistory, hasActiveIntervention, acceptedCount,
    loading, refresh: fetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. useStressSignals — Recent signals for a member
// ═══════════════════════════════════════════════════════════════════════════════

export function useStressSignals(signalType?: StressSignalType) {
  const { user } = useAuth();
  const [signals, setSignals] = useState<StressSignal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = signalType
        ? await FinancialStressPredictionEngine.getSignalsByType(user.id, signalType)
        : await FinancialStressPredictionEngine.getRecentSignals(user.id);
      setSignals(data);
    } catch (err) {
      console.error("useStressSignals error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, signalType]);

  useEffect(() => { fetch(); }, [fetch]);

  const signalCounts = {
    contribution_delay: signals.filter(s => s.signalType === "contribution_delay").length,
    ticket_language: signals.filter(s => s.signalType === "ticket_language").length,
    login_drop: signals.filter(s => s.signalType === "login_drop").length,
    early_payout_request: signals.filter(s => s.signalType === "early_payout_request").length,
  };

  return { signals, signalCounts, loading, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. useStressSummary — Full member stress summary
// ═══════════════════════════════════════════════════════════════════════════════

export function useStressSummary() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<MemberStressSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await FinancialStressPredictionEngine.getMemberSummary(user.id);
      setSummary(data);
    } catch (err) {
      console.error("useStressSummary error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  return { summary, loading, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. useStressActions — Record signals, respond to interventions
// ═══════════════════════════════════════════════════════════════════════════════

export function useStressActions() {
  const { user } = useAuth();
  const [recording, setRecording] = useState(false);
  const [responding, setResponding] = useState(false);

  const recordContributionDelay = useCallback(async (
    data: ContributionDelayData, circleId?: string, cycleId?: string
  ) => {
    if (!user?.id) throw new Error("Not authenticated");
    setRecording(true);
    try {
      return await FinancialStressPredictionEngine.recordContributionDelay(
        user.id, data, circleId, cycleId
      );
    } finally {
      setRecording(false);
    }
  }, [user?.id]);

  const recordTicketLanguage = useCallback(async (
    data: TicketLanguageData, circleId?: string
  ) => {
    if (!user?.id) throw new Error("Not authenticated");
    setRecording(true);
    try {
      return await FinancialStressPredictionEngine.recordTicketLanguage(
        user.id, data, circleId
      );
    } finally {
      setRecording(false);
    }
  }, [user?.id]);

  const recordLoginDrop = useCallback(async (data: LoginDropData) => {
    if (!user?.id) throw new Error("Not authenticated");
    setRecording(true);
    try {
      return await FinancialStressPredictionEngine.recordLoginDrop(user.id, data);
    } finally {
      setRecording(false);
    }
  }, [user?.id]);

  const recordEarlyPayoutRequest = useCallback(async (
    data: EarlyPayoutRequestData, circleId?: string, cycleId?: string
  ) => {
    if (!user?.id) throw new Error("Not authenticated");
    setRecording(true);
    try {
      return await FinancialStressPredictionEngine.recordEarlyPayoutRequest(
        user.id, data, circleId, cycleId
      );
    } finally {
      setRecording(false);
    }
  }, [user?.id]);

  const analyzeText = useCallback(async (text: string, language?: string) => {
    return await FinancialStressPredictionEngine.analyzeText(text, language);
  }, []);

  const acceptIntervention = useCallback(async (interventionId: string) => {
    setResponding(true);
    try {
      return await FinancialStressPredictionEngine.acceptIntervention(interventionId);
    } finally {
      setResponding(false);
    }
  }, []);

  const declineIntervention = useCallback(async (interventionId: string) => {
    setResponding(true);
    try {
      return await FinancialStressPredictionEngine.declineIntervention(interventionId);
    } finally {
      setResponding(false);
    }
  }, []);

  const markViewed = useCallback(async (interventionId: string) => {
    return await FinancialStressPredictionEngine.markViewed(interventionId);
  }, []);

  return {
    recordContributionDelay, recordTicketLanguage, recordLoginDrop,
    recordEarlyPayoutRequest, analyzeText,
    acceptIntervention, declineIntervention, markViewed,
    recording, responding,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. useStressDashboard — Admin dashboard metrics
// ═══════════════════════════════════════════════════════════════════════════════

export function useStressDashboard() {
  const [dashboard, setDashboard] = useState<StressDashboardRow[]>([]);
  const [flaggedMembers, setFlaggedMembers] = useState<StressScore[]>([]);
  const [metrics, setMetrics] = useState<Awaited<
    ReturnType<typeof FinancialStressPredictionEngine.getInterventionMetrics>
  > | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, flagged, met] = await Promise.all([
        FinancialStressPredictionEngine.getDashboard(),
        FinancialStressPredictionEngine.getFlaggedMembers(),
        FinancialStressPredictionEngine.getInterventionMetrics(),
      ]);
      setDashboard(dash);
      setFlaggedMembers(flagged);
      setMetrics(met);
    } catch (err) {
      console.error("useStressDashboard error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { dashboard, flaggedMembers, metrics, loading, refresh: fetch };
}
