// ═══════════════════════════════════════════════════════════════════════════════
// useKYCFallback.ts — #207 KYC Fallback Intelligence Hooks
// ═══════════════════════════════════════════════════════════════════════════════
//
// 5 hooks:
//   useKYCFallbackScore    — member's current fallback risk score + tier
//   useKYCGateCheck        — check if a specific action is allowed
//   useKYCEscalations      — member's escalation trigger history
//   useKYCTierDistribution — admin view of tier distribution
//   useKYCFallbackActions  — all mutation actions (compute, recompute, gate check)
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  KYCFallbackEngine,
  type RiskTier,
  type SignalType,
  type PhoneCarrierType,
  type DeviceStability,
  type EscalationTriggerType,
  type FallbackScore,
  type TierLimits,
  type SignalInput,
  type GateCheckResult,
  type EscalationRecord,
} from '../services/KYCFallbackEngine';

// Re-export types
export type {
  RiskTier,
  SignalType,
  PhoneCarrierType,
  DeviceStability,
  EscalationTriggerType,
  FallbackScore,
  TierLimits,
  SignalInput,
  GateCheckResult,
  EscalationRecord,
};


// ─────────────────────────────────────────────────────────────────────────────
// Hook 1: useKYCFallbackScore
// ─────────────────────────────────────────────────────────────────────────────

export function useKYCFallbackScore(memberId?: string) {
  const [score, setScore] = useState<FallbackScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScore = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await KYCFallbackEngine.getScore(memberId);
      setScore(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { fetchScore(); }, [fetchScore]);

  // Realtime
  useEffect(() => {
    if (!memberId) return;
    const channel = KYCFallbackEngine.subscribeToScore(memberId, fetchScore);
    return () => { channel.unsubscribe(); };
  }, [memberId, fetchScore]);

  const computed = useMemo(() => {
    if (!score) return {
      hasScore: false,
      tierLabel: 'Unknown',
      tierColor: '#999',
      maxContribution: '$0',
      maxWithdrawal: '$0',
      canJoin: false,
      canWithdraw: false,
      isHighRisk: true,
      isLowRisk: false,
      hasDeadline: false,
      deadlineDays: null as number | null,
      scoreProgress: 0,
      nextTierScore: 41,
      pointsToNextTier: 41,
    };

    const tierLabels: Record<RiskTier, string> = {
      high_risk: 'High Risk',
      medium_risk: 'Medium Risk',
      lower_risk: 'Lower Risk',
      low_risk: 'Low Risk',
    };
    const tierColors: Record<RiskTier, string> = {
      high_risk: '#D32F2F',
      medium_risk: '#F57C00',
      lower_risk: '#1976D2',
      low_risk: '#388E3C',
    };

    const now = new Date();
    const deadline = score.fullKycRequiredBy ? new Date(score.fullKycRequiredBy) : null;
    const deadlineDays = deadline
      ? Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : null;

    // Next tier thresholds
    const nextTierScore = score.score < 41 ? 41 : score.score < 66 ? 66 : score.score < 81 ? 81 : 100;

    return {
      hasScore: true,
      tierLabel: tierLabels[score.riskTier],
      tierColor: tierColors[score.riskTier],
      maxContribution: `$${(score.maxContributionCents / 100).toFixed(0)}`,
      maxWithdrawal: `$${(score.maxWithdrawalCents / 100).toFixed(0)}`,
      canJoin: score.canJoinCircles,
      canWithdraw: score.canWithdraw,
      isHighRisk: score.riskTier === 'high_risk',
      isLowRisk: score.riskTier === 'low_risk',
      hasDeadline: !!deadline,
      deadlineDays,
      scoreProgress: score.score,
      nextTierScore,
      pointsToNextTier: Math.max(0, nextTierScore - score.score),
    };
  }, [score]);

  return { score, loading, error, refresh: fetchScore, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 2: useKYCGateCheck
// ─────────────────────────────────────────────────────────────────────────────

export function useKYCGateCheck(
  memberId?: string,
  action?: 'join_circle' | 'contribute' | 'withdraw' | 'remit' | 'request_advance',
  amountCents?: number
) {
  const [result, setResult] = useState<GateCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkGate = useCallback(async () => {
    if (!memberId || !action) return;
    setLoading(true);
    setError(null);
    try {
      const gateResult = await KYCFallbackEngine.checkGate(memberId, action, amountCents);
      setResult(gateResult);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [memberId, action, amountCents]);

  useEffect(() => { checkGate(); }, [checkGate]);

  const computed = useMemo(() => ({
    isAllowed: result?.allowed ?? false,
    isBlocked: result ? !result.allowed : true,
    blockReason: result?.reason ?? null,
    needsKYC: result?.requiredAction === 'complete_kyc',
    currentTier: result?.riskTier ?? 'high_risk',
  }), [result]);

  return { result, loading, error, recheck: checkGate, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 3: useKYCEscalations
// ─────────────────────────────────────────────────────────────────────────────

export function useKYCEscalations(memberId?: string) {
  const [escalations, setEscalations] = useState<EscalationRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEscalations = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await KYCFallbackEngine.getEscalations(memberId);
      setEscalations(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => { fetchEscalations(); }, [fetchEscalations]);

  const computed = useMemo(() => ({
    totalEscalations: escalations.length,
    blockedActions: escalations.filter(e => e.actionBlocked).length,
    unnotified: escalations.filter(e => !e.memberNotified).length,
    hasEscalations: escalations.length > 0,
    latestEscalation: escalations[0] ?? null,
    byType: escalations.reduce((acc, e) => {
      acc[e.triggerType] = (acc[e.triggerType] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  }), [escalations]);

  return { escalations, loading, error, refresh: fetchEscalations, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 4: useKYCTierDistribution
// ─────────────────────────────────────────────────────────────────────────────

export function useKYCTierDistribution() {
  const [distribution, setDistribution] = useState<Record<RiskTier, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDistribution = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await KYCFallbackEngine.getTierDistribution();
      setDistribution(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDistribution(); }, [fetchDistribution]);

  const computed = useMemo(() => {
    if (!distribution) return {
      totalMembers: 0,
      highRiskPct: 0,
      lowRiskPct: 0,
    };

    const total = Object.values(distribution).reduce((sum, n) => sum + n, 0);
    return {
      totalMembers: total,
      highRiskPct: total > 0 ? Math.round(distribution.high_risk / total * 100) : 0,
      lowRiskPct: total > 0 ? Math.round(distribution.low_risk / total * 100) : 0,
    };
  }, [distribution]);

  return { distribution, loading, error, refresh: fetchDistribution, ...computed };
}


// ─────────────────────────────────────────────────────────────────────────────
// Hook 5: useKYCFallbackActions
// ─────────────────────────────────────────────────────────────────────────────

export function useKYCFallbackActions() {
  const [computing, setComputing] = useState(false);

  const computeScore = useCallback(async (memberId: string, signals: SignalInput) => {
    setComputing(true);
    try {
      return await KYCFallbackEngine.computeScore(memberId, signals);
    } finally {
      setComputing(false);
    }
  }, []);

  const recomputeOnNewSignal = useCallback(async (memberId: string, newSignals: Partial<SignalInput>) => {
    setComputing(true);
    try {
      return await KYCFallbackEngine.recomputeOnNewSignal(memberId, newSignals);
    } finally {
      setComputing(false);
    }
  }, []);

  const checkGate = useCallback(async (
    memberId: string,
    action: 'join_circle' | 'contribute' | 'withdraw' | 'remit' | 'request_advance',
    amountCents?: number
  ) => {
    return KYCFallbackEngine.checkGate(memberId, action, amountCents);
  }, []);

  const getMembersNearingDeadline = useCallback(async (daysAhead?: number) => {
    return KYCFallbackEngine.getMembersNearingDeadline(daysAhead);
  }, []);

  const processExpiredScores = useCallback(async () => {
    return KYCFallbackEngine.processExpiredScores();
  }, []);

  const markEscalationNotified = useCallback(async (escalationId: string) => {
    return KYCFallbackEngine.markEscalationNotified(escalationId);
  }, []);

  const getSignalLogs = useCallback(async (memberId: string, limit?: number) => {
    return KYCFallbackEngine.getSignalLogs(memberId, limit);
  }, []);

  return {
    computeScore,
    recomputeOnNewSignal,
    checkGate,
    getMembersNearingDeadline,
    processExpiredScores,
    markEscalationNotified,
    getSignalLogs,
    computing,
  };
}
