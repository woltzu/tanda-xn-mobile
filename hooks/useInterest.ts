// ══════════════════════════════════════════════════════════════════════════════
// hooks/useInterest.ts — Accrued-interest reader for the Interest-First KYC flow
// ══════════════════════════════════════════════════════════════════════════════
//
// Provides the Dashboard / GoalDetails interest cards with:
//
//   {
//     totalAccruedInterest: number;   // dollars (mock $47.83 for now)
//     isInterestUnlocked: boolean;    // persisted in AsyncStorage
//     refresh: () => Promise<void>;
//   }
//
// ──── KYC-2.3 placeholder note ────
// This hook is intentionally a mock. Phase KYC-3 will replace it
// with a real implementation that:
//   - sums interest accrued across the user's savings goals from
//     supabase (savings_goals + cycle_contributions or a dedicated
//     interest_ledger table)
//   - reads isInterestUnlocked from the user_verification table
//     (tier >= 2 once tax-ID verification ships)
//   - subscribes to realtime updates so the Dashboard reflects
//     state changes without a manual refresh
//
// For now, AsyncStorage is the persistence layer so the unlock state
// survives app restarts during manual testing. To simulate an unlock
// without going through the KYC flow:
//
//   await AsyncStorage.setItem('tandaxn.kyc.interestUnlocked', 'true');
//
// The Dashboard card flips on next mount or after calling refresh().
// ══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../context/AuthContext";

// Storage key — namespaced under tandaxn.kyc so future KYC mocks
// can sit alongside without colliding.
const STORAGE_KEY_UNLOCKED = "tandaxn.kyc.interestUnlocked";

// Mock total. Matches the canonical example in KYC_FLOW_GUIDE.md so
// every screen in the flow shows the same number until KYC-3 lands.
const MOCK_TOTAL_INTEREST = 47.83;

export type UseInterestResult = {
  totalAccruedInterest: number;
  isInterestUnlocked: boolean;
  refresh: () => Promise<void>;
};

export function useInterest(): UseInterestResult {
  const { user } = useAuth();
  // The mock total never changes during a session. Stored in state
  // anyway so KYC-3 can swap in an async fetch without touching call
  // sites.
  const [totalAccruedInterest] = useState<number>(MOCK_TOTAL_INTEREST);
  const [isInterestUnlocked, setIsInterestUnlocked] = useState<boolean>(false);

  const readUnlocked = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_UNLOCKED);
      setIsInterestUnlocked(raw === "true");
    } catch (err) {
      // Silently default to locked if AsyncStorage misbehaves —
      // safest fallback (no false unlock claims).
      console.warn("[useInterest] AsyncStorage read failed:", err);
      setIsInterestUnlocked(false);
    }
  }, []);

  // Initial read on mount (and when the auth user changes, e.g.
  // after sign-in). Phase KYC-3 will replace this with a supabase
  // query keyed on user.id.
  useEffect(() => {
    if (!user?.id) {
      setIsInterestUnlocked(false);
      return;
    }
    readUnlocked();
  }, [user?.id, readUnlocked]);

  return {
    totalAccruedInterest,
    isInterestUnlocked,
    refresh: readUnlocked,
  };
}
