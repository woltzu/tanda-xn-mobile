// ══════════════════════════════════════════════════════════════════════════════
// Cross-Circle Liquidity Hooks
// ══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import {
  CrossCircleLiquidityEngine,
  type LiquidityPool,
  type LiquidityAdvance,
  type EligibilityResult,
  type AdvanceCalculation,
  type PoolHealthDashboard,
  type AdvanceStatus,
  type FeeTier,
  type RepaymentMethod,
} from "../services/CrossCircleLiquidityEngine";
import { useAuth } from "../context/AuthContext";

export type {
  LiquidityPool, LiquidityAdvance, EligibilityResult,
  AdvanceCalculation, PoolHealthDashboard, AdvanceStatus, FeeTier, RepaymentMethod,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. useLiquidityPool — Pool status & health
// ═══════════════════════════════════════════════════════════════════════════════

export function useLiquidityPool() {
  const [pool, setPool] = useState<LiquidityPool | null>(null);
  const [dashboard, setDashboard] = useState<PoolHealthDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const [poolData, dashData] = await Promise.all([
        CrossCircleLiquidityEngine.getPool(),
        CrossCircleLiquidityEngine.getPoolDashboard(),
      ]);
      setPool(poolData);
      setDashboard(dashData);
    } catch (err) {
      console.error("useLiquidityPool error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { pool, dashboard, loading, refresh: fetch };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. useLiquidityAdvance — Member's active advance + eligibility
// ═══════════════════════════════════════════════════════════════════════════════

export function useLiquidityAdvance() {
  const { user } = useAuth();
  const [activeAdvance, setActiveAdvance] = useState<LiquidityAdvance | null>(null);
  const [advances, setAdvances] = useState<LiquidityAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [active, all] = await Promise.all([
        CrossCircleLiquidityEngine.getActiveAdvance(user.id),
        CrossCircleLiquidityEngine.getMemberAdvances(user.id),
      ]);
      setActiveAdvance(active);
      setAdvances(all);
    } catch (err) {
      console.error("useLiquidityAdvance error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const sub = CrossCircleLiquidityEngine.subscribeToAdvances(user.id, (advance) => {
      setAdvances(prev => {
        const idx = prev.findIndex(a => a.id === advance.id);
        if (idx >= 0) { const u = [...prev]; u[idx] = advance; return u; }
        return [advance, ...prev];
      });
      if (["approved", "disbursed", "repaying"].includes(advance.status)) {
        setActiveAdvance(advance);
      } else {
        setActiveAdvance(null);
      }
    });
    return () => { sub.unsubscribe(); };
  }, [user?.id]);

  const hasActiveAdvance = activeAdvance !== null;
  const repaidAdvances = advances.filter(a => a.status === "repaid");
  const totalRepaid = repaidAdvances.length;

  return {
    activeAdvance, advances, hasActiveAdvance, repaidAdvances, totalRepaid,
    loading, refresh: fetch,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. useLiquidityActions — Check eligibility, request, repay
// ═══════════════════════════════════════════════════════════════════════════════

export function useLiquidityActions() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const checkEligibility = useCallback(async (
    circleId: string, xnScore: number, expectedPayoutCents: number,
    completedCycles: number, dcr?: number, memberTier?: string
  ): Promise<EligibilityResult> => {
    if (!user?.id) throw new Error("Not authenticated");
    setChecking(true);
    try {
      return await CrossCircleLiquidityEngine.checkEligibility(
        user.id, circleId, xnScore, expectedPayoutCents, completedCycles, dcr, memberTier
      );
    } finally {
      setChecking(false);
    }
  }, [user?.id]);

  const calculateAdvance = useCallback((amountCents: number, feeTier: FeeTier = "30_day") => {
    return CrossCircleLiquidityEngine.calculateAdvance(amountCents, feeTier);
  }, []);

  const requestAdvance = useCallback(async (
    circleId: string, amountCents: number, expectedPayoutCents: number,
    feeTier?: FeeTier, repaymentMethod?: RepaymentMethod, payoutDate?: string,
    eligibility?: EligibilityResult
  ) => {
    if (!user?.id) throw new Error("Not authenticated");
    setRequesting(true);
    try {
      return await CrossCircleLiquidityEngine.requestAdvance(
        user.id, circleId, amountCents, expectedPayoutCents,
        feeTier, repaymentMethod, payoutDate, eligibility
      );
    } finally {
      setRequesting(false);
    }
  }, [user?.id]);

  const recordRepayment = useCallback(async (advanceId: string, amountCents: number) => {
    return await CrossCircleLiquidityEngine.recordRepayment(advanceId, amountCents);
  }, []);

  return {
    checkEligibility, calculateAdvance, requestAdvance, recordRepayment,
    checking, requesting,
  };
}
