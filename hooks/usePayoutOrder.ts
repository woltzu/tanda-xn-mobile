/**
 * usePayoutOrder Hook
 *
 * A comprehensive React hook for managing payout orders, position preferences,
 * need declarations, and position swaps.
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  payoutOrderService,
  PayoutOrder,
  PayoutOrderEntry,
  PreferenceType,
  NeedCategory,
} from "../services/PayoutOrderService";
import {
  positionPreferenceService,
  PreferenceOption,
  NeedCategoryOption,
  SetPreferenceRequest,
  SetNeedRequest,
} from "../services/PositionPreferenceService";
import {
  positionSwapService,
  SwapRequest,
} from "../services/PositionSwapService";

// ============================================================================
// TYPES
// ============================================================================

export interface UsePayoutOrderResult {
  // State
  payoutOrder: PayoutOrder | null;
  myPosition: PayoutOrderEntry | null;
  positionDetails: PositionDetails | null;
  preference: PreferenceOption | null;
  currentPreference: PreferenceType | null;
  currentNeed: NeedCategory | null;
  swapRequests: {
    incoming: SwapRequest[];
    outgoing: SwapRequest[];
  };
  swapTargets: SwapTarget[];
  isLoading: boolean;
  error: string | null;

  // Payout Order Actions
  loadPayoutOrder: (circleId: string) => Promise<void>;
  loadMyPosition: (circleId: string) => Promise<void>;
  triggerOrderCalculation: (circleId: string) => Promise<void>;

  // Preference Actions
  loadPreferenceOptions: (circleId: string) => Promise<PreferenceOption[]>;
  setPreference: (request: SetPreferenceRequest) => Promise<void>;
  clearPreference: (circleId: string) => Promise<void>;

  // Need Declaration Actions
  loadNeedCategories: () => Promise<NeedCategoryOption[]>;
  setNeedDeclaration: (request: SetNeedRequest) => Promise<void>;
  clearNeedDeclaration: (circleId: string) => Promise<void>;

  // Swap Actions
  loadSwapRequests: () => Promise<void>;
  loadSwapTargets: (circleId: string) => Promise<void>;
  requestSwap: (targetUserId: string, circleId: string, message?: string) => Promise<void>;
  acceptSwap: (swapId: string, message?: string) => Promise<void>;
  declineSwap: (swapId: string, message?: string) => Promise<void>;
  cancelSwap: (swapId: string) => Promise<void>;

  // Helpers
  getPositionLabel: (position: number, total: number) => string;
  getPreferenceLabel: (type: PreferenceType) => string;
  getNeedCategoryLabel: (category: NeedCategory) => string;
  formatPayoutDate: (date: string) => string;
  canSwapPositions: boolean;
}

export interface PositionDetails {
  position: number;
  totalPositions: number;
  expectedPayoutDate: string;
  cyclesUntilPayout: number;
  expectedPayoutAmount: number;
  assignmentReason: string;
  circleName: string;
  contributionAmount: number;
  currentCycle: number;
}

export interface SwapTarget {
  userId: string;
  name: string;
  position: number;
  canSwap: boolean;
  reason?: string;
}

// ============================================================================
// LABELS AND CONFIGURATION
// ============================================================================

const PREFERENCE_LABELS: Record<PreferenceType, string> = {
  need_early: "Need Early Position",
  prefer_early: "Prefer Early",
  flexible: "Flexible",
  prefer_late: "Prefer Late",
};

const NEED_CATEGORY_LABELS: Record<NeedCategory, string> = {
  emergency: "Emergency",
  medical: "Medical",
  education: "Education",
  school_fees: "School Fees",
  housing: "Housing",
  legal: "Legal/Immigration",
  wedding: "Wedding",
  ceremony: "Ceremony",
  business: "Business",
  investment: "Investment",
  travel: "Travel",
  major_purchase: "Major Purchase",
  general: "General Savings",
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export const usePayoutOrder = (): UsePayoutOrderResult => {
  const { user } = useAuth();

  // State
  const [payoutOrder, setPayoutOrder] = useState<PayoutOrder | null>(null);
  const [myPosition, setMyPosition] = useState<PayoutOrderEntry | null>(null);
  const [positionDetails, setPositionDetails] = useState<PositionDetails | null>(null);
  const [currentPreference, setCurrentPreference] = useState<PreferenceType | null>(null);
  const [currentNeed, setCurrentNeed] = useState<NeedCategory | null>(null);
  const [swapRequests, setSwapRequests] = useState<{
    incoming: SwapRequest[];
    outgoing: SwapRequest[];
  }>({ incoming: [], outgoing: [] });
  const [swapTargets, setSwapTargets] = useState<SwapTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // PAYOUT ORDER ACTIONS
  // ============================================================================

  const loadPayoutOrder = useCallback(async (circleId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const order = await payoutOrderService.getPayoutOrder(circleId);
      setPayoutOrder(order);

      if (order && user) {
        const position = order.order.find(e => e.userId === user.id);
        setMyPosition(position || null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const loadMyPosition = useCallback(async (circleId: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const details = await payoutOrderService.getMyPositionDetails(user.id, circleId);

      if (details) {
        setPositionDetails({
          position: details.myPosition.position,
          totalPositions: details.myPosition.totalPositions,
          expectedPayoutDate: details.myPosition.expectedPayoutDate,
          cyclesUntilPayout: details.myPosition.cyclesUntilPayout,
          expectedPayoutAmount: details.myPosition.expectedPayoutAmount,
          assignmentReason: details.myPosition.assignmentReason,
          circleName: details.circle.name,
          contributionAmount: details.circle.contributionAmount,
          currentCycle: details.circle.currentCycle,
        });
      }

      // Also load current preference and need
      const pref = await positionPreferenceService.getPreference(user.id, circleId);
      setCurrentPreference(pref?.preferenceType || null);

      const need = await positionPreferenceService.getNeedDeclaration(user.id, circleId);
      setCurrentNeed(need?.category || null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const triggerOrderCalculation = useCallback(async (circleId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const order = await payoutOrderService.determinePayoutOrder(circleId);
      setPayoutOrder(order);

      if (user) {
        const position = order.order.find(e => e.userId === user.id);
        setMyPosition(position || null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // ============================================================================
  // PREFERENCE ACTIONS
  // ============================================================================

  const loadPreferenceOptions = useCallback(async (circleId: string): Promise<PreferenceOption[]> => {
    if (!user) return [];

    try {
      return await positionPreferenceService.getPreferenceOptions(user.id, circleId);
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, [user]);

  const setPreference = useCallback(async (request: SetPreferenceRequest) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      await positionPreferenceService.setPreference(user.id, request);
      setCurrentPreference(request.preferenceType);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const clearPreference = useCallback(async (circleId: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      await positionPreferenceService.clearPreference(user.id, circleId);
      setCurrentPreference(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // ============================================================================
  // NEED DECLARATION ACTIONS
  // ============================================================================

  const loadNeedCategories = useCallback(async (): Promise<NeedCategoryOption[]> => {
    if (!user) return [];

    try {
      return await positionPreferenceService.getNeedCategories(user.id);
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, [user]);

  const setNeedDeclaration = useCallback(async (request: SetNeedRequest) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      await positionPreferenceService.setNeedDeclaration(user.id, request);
      setCurrentNeed(request.category);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const clearNeedDeclaration = useCallback(async (circleId: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      await positionPreferenceService.clearNeedDeclaration(user.id, circleId);
      setCurrentNeed(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // ============================================================================
  // SWAP ACTIONS
  // ============================================================================

  const loadSwapRequests = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const requests = await positionSwapService.getPendingRequests(user.id);
      setSwapRequests(requests);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const loadSwapTargets = useCallback(async (circleId: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const targets = await positionSwapService.getSwapTargets(user.id, circleId);
      setSwapTargets(targets);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const requestSwap = useCallback(async (targetUserId: string, circleId: string, message?: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      await positionSwapService.requestSwap(user.id, targetUserId, circleId, message);
      await loadSwapRequests();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, loadSwapRequests]);

  const acceptSwap = useCallback(async (swapId: string, message?: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      await positionSwapService.acceptSwap(swapId, user.id, message);
      await loadSwapRequests();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, loadSwapRequests]);

  const declineSwap = useCallback(async (swapId: string, message?: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      await positionSwapService.declineSwap(swapId, user.id, message);
      await loadSwapRequests();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, loadSwapRequests]);

  const cancelSwap = useCallback(async (swapId: string) => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      await positionSwapService.cancelSwap(swapId, user.id);
      await loadSwapRequests();
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [user, loadSwapRequests]);

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  const getPositionLabel = useCallback((position: number, total: number): string => {
    if (position === 1) return "🥇 First";
    if (position === 2) return "🥈 Second";
    if (position === 3) return "🥉 Third";
    if (position === total) return "Last";
    if (position <= total * 0.25) return "Early";
    if (position >= total * 0.75) return "Late";
    return "Middle";
  }, []);

  const getPreferenceLabel = useCallback((type: PreferenceType): string => {
    return PREFERENCE_LABELS[type] || type;
  }, []);

  const getNeedCategoryLabel = useCallback((category: NeedCategory): string => {
    return NEED_CATEGORY_LABELS[category] || category;
  }, []);

  const formatPayoutDate = useCallback((date: string): string => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  // Computed
  const canSwapPositions = positionDetails ? positionDetails.currentCycle <= 1 : false;

  // Load swap requests on mount
  useEffect(() => {
    if (user) {
      loadSwapRequests();
    }
  }, [user]);

  return {
    // State
    payoutOrder,
    myPosition,
    positionDetails,
    preference: null, // Will be set when loading options
    currentPreference,
    currentNeed,
    swapRequests,
    swapTargets,
    isLoading,
    error,

    // Payout Order Actions
    loadPayoutOrder,
    loadMyPosition,
    triggerOrderCalculation,

    // Preference Actions
    loadPreferenceOptions,
    setPreference,
    clearPreference,

    // Need Declaration Actions
    loadNeedCategories,
    setNeedDeclaration,
    clearNeedDeclaration,

    // Swap Actions
    loadSwapRequests,
    loadSwapTargets,
    requestSwap,
    acceptSwap,
    declineSwap,
    cancelSwap,

    // Helpers
    getPositionLabel,
    getPreferenceLabel,
    getNeedCategoryLabel,
    formatPayoutDate,
    canSwapPositions,
  };
};

export default usePayoutOrder;
