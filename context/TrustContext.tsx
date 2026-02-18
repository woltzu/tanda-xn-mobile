import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Trust tier based on XnScore
export type TrustTier = "restricted" | "building" | "standard" | "trusted" | "preferred" | "elder";

// Access permissions based on trust tier
export type CircleAccessType = "contacts_only" | "invitation" | "public";

// Guarantee status for circle members
export type GuaranteeStatus = "guaranteed" | "unguaranteed" | "vouched";

// Vouch record
export type VouchRecord = {
  id: string;
  elderId: string;
  elderName: string;
  vouchedUserId: string;
  vouchedUserName: string;
  createdAt: number;
  status: "active" | "completed" | "defaulted";
  circleId?: string;
};

// Honor stats for a user
export type HonorStats = {
  totalVouchesGiven: number;
  activeVouches: number;
  successfulVouches: number;
  defaultedVouches: number;
  vouchSuccessRate: number;
  honorBadges: HonorBadge[];
  isElder: boolean;
  canVouch: boolean;
  vouchLimit: number;
  vouchesReceived: VouchRecord[];
};

// Honor badges earned through good behavior
export type HonorBadge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
};

// Member trust info for display in circles
export type MemberTrustInfo = {
  id: string;
  name: string;
  score: number;
  trustTier: TrustTier;
  guaranteeStatus: GuaranteeStatus;
  hasDeposit: boolean;
  depositAmount?: number;
  vouchedBy?: {
    id: string;
    name: string;
  };
  honorBadges: HonorBadge[];
  onTimeRate: number;
  circlesCompleted: number;
};

type TrustContextType = {
  // Trust tier calculations
  getTrustTier: (score: number) => TrustTier;
  getCircleAccess: (score: number) => CircleAccessType[];
  canJoinCircle: (score: number, circleType: CircleAccessType, hasVouch: boolean) => boolean;
  canVouchForOthers: (score: number) => boolean;

  // Vouching system
  vouchRecords: VouchRecord[];
  honorStats: HonorStats;
  vouchForUser: (userId: string, userName: string, circleId?: string) => Promise<boolean>;
  revokeVouch: (vouchId: string) => Promise<void>;
  getActiveVouchesForUser: (userId: string) => VouchRecord[];
  recordVouchOutcome: (vouchId: string, outcome: "completed" | "defaulted") => Promise<void>;

  // Guarantee/Deposit
  hasSecurityDeposit: boolean;
  securityDepositAmount: number;
  addSecurityDeposit: (amount: number) => Promise<void>;
  withdrawSecurityDeposit: () => Promise<void>;

  // Honor system
  awardHonorBadge: (badge: Omit<HonorBadge, "id" | "earnedAt">) => Promise<void>;

  // Member info
  getMemberTrustInfo: (memberId: string) => MemberTrustInfo | null;

  isLoading: boolean;
};

// Trust tier thresholds
const TRUST_TIERS = {
  restricted: { min: 0, max: 24 },   // Critical - contacts only + needs vouch
  building: { min: 25, max: 44 },    // Poor - can receive invitations
  standard: { min: 45, max: 59 },    // Fair - public circles, last 3 slots
  trusted: { min: 60, max: 74 },     // Good - full access, slots 4+
  preferred: { min: 75, max: 89 },   // Excellent - can vouch for others
  elder: { min: 90, max: 100 },      // Elite - VIP, priority vouching
};

// Vouch penalties for elder when vouched user defaults
const VOUCH_DEFAULT_PENALTY = 4; // Points deducted from elder's score

// Maximum active vouches per elder
const MAX_ACTIVE_VOUCHES = 3;

const TrustContext = createContext<TrustContextType | undefined>(undefined);

export const useTrust = () => {
  const context = useContext(TrustContext);
  if (!context) {
    throw new Error("useTrust must be used within TrustProvider");
  }
  return context;
};

const STORAGE_KEY = "@tandaxn_trust";

// Mock member data for demo
const MOCK_MEMBERS: MemberTrustInfo[] = [
  {
    id: "member_1",
    name: "Maria Santos",
    score: 78,
    trustTier: "preferred",
    guaranteeStatus: "guaranteed",
    hasDeposit: true,
    depositAmount: 500,
    honorBadges: [
      { id: "b1", name: "Perfect Payer", description: "10 on-time payments", icon: "checkmark-circle", earnedAt: Date.now(), tier: "gold" },
    ],
    onTimeRate: 100,
    circlesCompleted: 3,
  },
  {
    id: "member_2",
    name: "Jean Baptiste",
    score: 45,
    trustTier: "standard",
    guaranteeStatus: "unguaranteed",
    hasDeposit: false,
    honorBadges: [],
    onTimeRate: 85,
    circlesCompleted: 1,
  },
  {
    id: "member_3",
    name: "Fatou Diallo",
    score: 18,
    trustTier: "restricted",
    guaranteeStatus: "vouched",
    hasDeposit: false,
    vouchedBy: { id: "elder_1", name: "Amadou Diallo" },
    honorBadges: [],
    onTimeRate: 0,
    circlesCompleted: 0,
  },
];

export const TrustProvider = ({ children }: { children: ReactNode }) => {
  const [vouchRecords, setVouchRecords] = useState<VouchRecord[]>([]);
  const [honorBadges, setHonorBadges] = useState<HonorBadge[]>([]);
  const [hasSecurityDeposit, setHasSecurityDeposit] = useState(false);
  const [securityDepositAmount, setSecurityDepositAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load trust data on mount
  useEffect(() => {
    loadTrustData();
  }, []);

  const loadTrustData = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.vouchRecords) setVouchRecords(parsed.vouchRecords);
        if (parsed.honorBadges) setHonorBadges(parsed.honorBadges);
        if (parsed.hasSecurityDeposit !== undefined) setHasSecurityDeposit(parsed.hasSecurityDeposit);
        if (parsed.securityDepositAmount !== undefined) setSecurityDepositAmount(parsed.securityDepositAmount);
      }
    } catch (error) {
      console.error("Error loading trust data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveTrustData = async (
    newVouchRecords: VouchRecord[],
    newHonorBadges: HonorBadge[],
    newHasDeposit: boolean,
    newDepositAmount: number
  ) => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          vouchRecords: newVouchRecords,
          honorBadges: newHonorBadges,
          hasSecurityDeposit: newHasDeposit,
          securityDepositAmount: newDepositAmount,
        })
      );
      setVouchRecords(newVouchRecords);
      setHonorBadges(newHonorBadges);
      setHasSecurityDeposit(newHasDeposit);
      setSecurityDepositAmount(newDepositAmount);
    } catch (error) {
      console.error("Error saving trust data:", error);
    }
  };

  // Get trust tier based on XnScore
  const getTrustTier = useCallback((score: number): TrustTier => {
    if (score >= TRUST_TIERS.elder.min) return "elder";
    if (score >= TRUST_TIERS.preferred.min) return "preferred";
    if (score >= TRUST_TIERS.trusted.min) return "trusted";
    if (score >= TRUST_TIERS.standard.min) return "standard";
    if (score >= TRUST_TIERS.building.min) return "building";
    return "restricted";
  }, []);

  // Get allowed circle access types based on score
  const getCircleAccess = useCallback((score: number): CircleAccessType[] => {
    const tier = getTrustTier(score);
    switch (tier) {
      case "restricted":
        return ["contacts_only"];
      case "building":
        return ["contacts_only", "invitation"];
      case "standard":
      case "trusted":
      case "preferred":
      case "elder":
        return ["contacts_only", "invitation", "public"];
      default:
        return ["contacts_only"];
    }
  }, [getTrustTier]);

  // Check if user can join a specific circle type
  const canJoinCircle = useCallback((
    score: number,
    circleType: CircleAccessType,
    hasVouch: boolean
  ): boolean => {
    const tier = getTrustTier(score);

    // Restricted users need a vouch for any circle
    if (tier === "restricted" && !hasVouch) {
      return false;
    }

    const allowedAccess = getCircleAccess(score);
    return allowedAccess.includes(circleType);
  }, [getTrustTier, getCircleAccess]);

  // Check if user can vouch for others (score >= 75)
  const canVouchForOthers = useCallback((score: number): boolean => {
    return score >= TRUST_TIERS.preferred.min;
  }, []);

  // Get active vouches given by current user
  const activeVouches = vouchRecords.filter((v) => v.status === "active");

  // Calculate honor stats
  const honorStats: HonorStats = {
    totalVouchesGiven: vouchRecords.length,
    activeVouches: activeVouches.length,
    successfulVouches: vouchRecords.filter((v) => v.status === "completed").length,
    defaultedVouches: vouchRecords.filter((v) => v.status === "defaulted").length,
    vouchSuccessRate: vouchRecords.length > 0
      ? Math.round((vouchRecords.filter((v) => v.status === "completed").length / vouchRecords.length) * 100)
      : 100,
    honorBadges,
    isElder: false, // Will be set by the component using user's score
    canVouch: false, // Will be set by the component using user's score
    vouchLimit: MAX_ACTIVE_VOUCHES,
    vouchesReceived: [], // For the current user
  };

  // Vouch for a user
  const vouchForUser = async (
    userId: string,
    userName: string,
    circleId?: string
  ): Promise<boolean> => {
    // Check if already at vouch limit
    if (activeVouches.length >= MAX_ACTIVE_VOUCHES) {
      return false;
    }

    // Check if already vouching for this user
    const existingVouch = activeVouches.find((v) => v.vouchedUserId === userId);
    if (existingVouch) {
      return false;
    }

    const newVouch: VouchRecord = {
      id: `vouch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      elderId: "current_user", // Will be replaced with actual user ID
      elderName: "You", // Will be replaced with actual user name
      vouchedUserId: userId,
      vouchedUserName: userName,
      createdAt: Date.now(),
      status: "active",
      circleId,
    };

    const newRecords = [...vouchRecords, newVouch];
    await saveTrustData(newRecords, honorBadges, hasSecurityDeposit, securityDepositAmount);
    return true;
  };

  // Revoke a vouch
  const revokeVouch = async (vouchId: string) => {
    const newRecords = vouchRecords.filter((v) => v.id !== vouchId);
    await saveTrustData(newRecords, honorBadges, hasSecurityDeposit, securityDepositAmount);
  };

  // Get active vouches for a specific user
  const getActiveVouchesForUser = useCallback((userId: string): VouchRecord[] => {
    return vouchRecords.filter((v) => v.vouchedUserId === userId && v.status === "active");
  }, [vouchRecords]);

  // Record the outcome of a vouch (when circle completes or user defaults)
  const recordVouchOutcome = async (vouchId: string, outcome: "completed" | "defaulted") => {
    const newRecords = vouchRecords.map((v) =>
      v.id === vouchId ? { ...v, status: outcome } : v
    );
    await saveTrustData(newRecords, honorBadges, hasSecurityDeposit, securityDepositAmount);

    // If defaulted, the elder's score should be penalized
    // This would be handled by XnScoreContext
    if (outcome === "defaulted") {
      // Signal to XnScoreContext to deduct points
      // This is handled in integration
    }
  };

  // Add security deposit
  const addSecurityDeposit = async (amount: number) => {
    await saveTrustData(vouchRecords, honorBadges, true, amount);
  };

  // Withdraw security deposit
  const withdrawSecurityDeposit = async () => {
    await saveTrustData(vouchRecords, honorBadges, false, 0);
  };

  // Award an honor badge
  const awardHonorBadge = async (badge: Omit<HonorBadge, "id" | "earnedAt">) => {
    const newBadge: HonorBadge = {
      ...badge,
      id: `badge_${Date.now()}`,
      earnedAt: Date.now(),
    };
    const newBadges = [...honorBadges, newBadge];
    await saveTrustData(vouchRecords, newBadges, hasSecurityDeposit, securityDepositAmount);
  };

  // Get member trust info (mock for now)
  const getMemberTrustInfo = useCallback((memberId: string): MemberTrustInfo | null => {
    return MOCK_MEMBERS.find((m) => m.id === memberId) || null;
  }, []);

  return (
    <TrustContext.Provider
      value={{
        getTrustTier,
        getCircleAccess,
        canJoinCircle,
        canVouchForOthers,
        vouchRecords,
        honorStats,
        vouchForUser,
        revokeVouch,
        getActiveVouchesForUser,
        recordVouchOutcome,
        hasSecurityDeposit,
        securityDepositAmount,
        addSecurityDeposit,
        withdrawSecurityDeposit,
        awardHonorBadge,
        getMemberTrustInfo,
        isLoading,
      }}
    >
      {children}
    </TrustContext.Provider>
  );
};
