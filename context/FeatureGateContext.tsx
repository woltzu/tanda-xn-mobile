import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { useXnScore } from "./XnScoreContext";

// ==================== DB ROW TYPES ====================

type FeatureGateRow = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  min_xn_score: number | null;
  min_honor_score: number | null;
  min_circles_completed: number | null;
  min_account_age_days: number | null;
  required_role: string | null;
  requires_id_verified: boolean;
  requires_income_verified: boolean;
  custom_rule: Record<string, any> | null;
  reason_code: string;
  blocked_title: string;
  blocked_message: string;
  unlock_hint: string;
  icon: string;
  color: string;
  enabled: boolean;
  is_premium: boolean;
  display_order: number;
};

type OverrideRow = {
  id: string;
  user_id: string;
  feature_gate_id: string;
  access_granted: boolean;
  reason: string | null;
  granted_by: string | null;
  expires_at: string | null;
  created_at: string;
};

// ==================== APP TYPES ====================

export type ReasonCode =
  | "score_too_low"
  | "honor_too_low"
  | "circles_needed"
  | "account_too_new"
  | "needs_verification"
  | "needs_income_verification"
  | "insufficient_role"
  | "not_elder"
  | "feature_disabled"
  | "account_restricted"
  | "manually_blocked"
  | "none";

export type MissingRequirement = {
  field: string;
  current: number | string | boolean;
  required: number | string | boolean;
  label: string;
};

export type AccessResult = {
  allowed: boolean;
  reasonCode: ReasonCode;
  blockedTitle: string;
  blockedMessage: string;
  unlockHint: string;
  icon: string;
  color: string;
  progress: number; // 0-100
  missingRequirements: MissingRequirement[];
};

export type FeatureGate = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  minXnScore: number | null;
  minHonorScore: number | null;
  minCirclesCompleted: number | null;
  minAccountAgeDays: number | null;
  requiredRole: string | null;
  requiresIdVerified: boolean;
  requiresIncomeVerified: boolean;
  customRule: Record<string, any> | null;
  reasonCode: string;
  blockedTitle: string;
  blockedMessage: string;
  unlockHint: string;
  icon: string;
  color: string;
  enabled: boolean;
  isPremium: boolean;
  displayOrder: number;
};

export type UserFeatureOverride = {
  featureGateId: string;
  accessGranted: boolean;
  reason: string | null;
  expiresAt: string | null;
};

// User's profile data for gate evaluation (fetched once)
type UserGateProfile = {
  honorScore: number;
  circlesCompleted: number;
  role: string;
  accountAgeDays: number;
  idVerified: boolean;
  incomeVerified: boolean;
  phoneVerified: boolean;
  emailVerified: boolean;
  defaultsCount: number;
  onTimePaymentPct: number;
};

// ==================== CONTEXT TYPE ====================

type FeatureGateContextType = {
  checkAccess: (featureKey: string) => AccessResult;
  getGatesByCategory: (category: string) => FeatureGate[];
  getAllGates: () => FeatureGate[];
  gates: FeatureGate[];
  overrides: UserFeatureOverride[];
  isLoading: boolean;
  refreshGates: () => Promise<void>;
};

// ==================== CONSTANTS ====================

const ROLE_HIERARCHY: Record<string, number> = {
  member: 0,
  elder: 1,
  moderator: 2,
  admin: 3,
  owner: 4,
};

const DEFAULT_ACCESS: AccessResult = {
  allowed: true,
  reasonCode: "none",
  blockedTitle: "",
  blockedMessage: "",
  unlockHint: "",
  icon: "",
  color: "",
  progress: 100,
  missingRequirements: [],
};

const BLOCKED_FEATURE_DISABLED: AccessResult = {
  allowed: false,
  reasonCode: "feature_disabled",
  blockedTitle: "Feature Unavailable",
  blockedMessage: "This feature is currently unavailable.",
  unlockHint: "Check back later — this feature may be enabled in a future update.",
  icon: "lock-closed",
  color: "#6B7280",
  progress: 0,
  missingRequirements: [],
};

const UNKNOWN_GATE: AccessResult = {
  allowed: true,
  reasonCode: "none",
  blockedTitle: "",
  blockedMessage: "",
  unlockHint: "",
  icon: "",
  color: "",
  progress: 100,
  missingRequirements: [],
};

// ==================== TRANSFORMS ====================

function rowToGate(row: FeatureGateRow): FeatureGate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    minXnScore: row.min_xn_score,
    minHonorScore: row.min_honor_score,
    minCirclesCompleted: row.min_circles_completed,
    minAccountAgeDays: row.min_account_age_days,
    requiredRole: row.required_role,
    requiresIdVerified: row.requires_id_verified,
    requiresIncomeVerified: row.requires_income_verified,
    customRule: row.custom_rule,
    reasonCode: row.reason_code,
    blockedTitle: row.blocked_title,
    blockedMessage: row.blocked_message,
    unlockHint: row.unlock_hint,
    icon: row.icon,
    color: row.color,
    enabled: row.enabled,
    isPremium: row.is_premium,
    displayOrder: row.display_order,
  };
}

function rowToOverride(row: OverrideRow): UserFeatureOverride {
  return {
    featureGateId: row.feature_gate_id,
    accessGranted: row.access_granted,
    reason: row.reason,
    expiresAt: row.expires_at,
  };
}

// ==================== EVALUATION ENGINE ====================

function evaluateGate(
  gate: FeatureGate,
  overrides: UserFeatureOverride[],
  xnScore: number,
  profile: UserGateProfile
): AccessResult {
  // 1. Feature disabled by admin
  if (!gate.enabled) {
    return BLOCKED_FEATURE_DISABLED;
  }

  // 2. Check user-specific overrides
  const override = overrides.find((o) => o.featureGateId === gate.id);
  if (override) {
    // Check expiry
    if (override.expiresAt && new Date(override.expiresAt) < new Date()) {
      // Override expired, fall through to normal evaluation
    } else if (override.accessGranted) {
      return { ...DEFAULT_ACCESS };
    } else {
      return {
        allowed: false,
        reasonCode: "manually_blocked",
        blockedTitle: "Access Restricted",
        blockedMessage: override.reason || "Your access to this feature has been restricted.",
        unlockHint: "Contact support if you believe this is an error.",
        icon: "ban",
        color: "#DC2626",
        progress: 0,
        missingRequirements: [],
      };
    }
  }

  // 3. Evaluate each condition — collect all failures
  const missing: MissingRequirement[] = [];
  let totalConditions = 0;
  let metConditions = 0;

  // XnScore
  if (gate.minXnScore !== null) {
    totalConditions++;
    if (xnScore >= gate.minXnScore) {
      metConditions++;
    } else {
      missing.push({
        field: "xnScore",
        current: xnScore,
        required: gate.minXnScore,
        label: "XnScore",
      });
    }
  }

  // Honor Score
  if (gate.minHonorScore !== null) {
    totalConditions++;
    if (profile.honorScore >= gate.minHonorScore) {
      metConditions++;
    } else {
      missing.push({
        field: "honorScore",
        current: profile.honorScore,
        required: gate.minHonorScore,
        label: "Honor Score",
      });
    }
  }

  // Circles Completed
  if (gate.minCirclesCompleted !== null) {
    totalConditions++;
    if (profile.circlesCompleted >= gate.minCirclesCompleted) {
      metConditions++;
    } else {
      missing.push({
        field: "circlesCompleted",
        current: profile.circlesCompleted,
        required: gate.minCirclesCompleted,
        label: "Circles Completed",
      });
    }
  }

  // Account Age
  if (gate.minAccountAgeDays !== null) {
    totalConditions++;
    if (profile.accountAgeDays >= gate.minAccountAgeDays) {
      metConditions++;
    } else {
      missing.push({
        field: "accountAgeDays",
        current: profile.accountAgeDays,
        required: gate.minAccountAgeDays,
        label: "Account Age (days)",
      });
    }
  }

  // Required Role (hierarchy check)
  if (gate.requiredRole !== null) {
    totalConditions++;
    const userRoleLevel = ROLE_HIERARCHY[profile.role] ?? 0;
    const requiredRoleLevel = ROLE_HIERARCHY[gate.requiredRole] ?? 0;
    if (userRoleLevel >= requiredRoleLevel) {
      metConditions++;
    } else {
      missing.push({
        field: "role",
        current: profile.role,
        required: gate.requiredRole,
        label: "Community Role",
      });
    }
  }

  // ID Verified
  if (gate.requiresIdVerified) {
    totalConditions++;
    if (profile.idVerified) {
      metConditions++;
    } else {
      missing.push({
        field: "idVerified",
        current: false,
        required: true,
        label: "ID Verification",
      });
    }
  }

  // Income Verified
  if (gate.requiresIncomeVerified) {
    totalConditions++;
    if (profile.incomeVerified) {
      metConditions++;
    } else {
      missing.push({
        field: "incomeVerified",
        current: false,
        required: true,
        label: "Income Verification",
      });
    }
  }

  // Custom rules (extensible)
  if (gate.customRule) {
    if (gate.customRule.max_defaults !== undefined) {
      totalConditions++;
      if (profile.defaultsCount <= gate.customRule.max_defaults) {
        metConditions++;
      } else {
        missing.push({
          field: "defaultsCount",
          current: profile.defaultsCount,
          required: `≤ ${gate.customRule.max_defaults}`,
          label: "Defaults",
        });
      }
    }
    if (gate.customRule.min_on_time_pct !== undefined) {
      totalConditions++;
      if (profile.onTimePaymentPct >= gate.customRule.min_on_time_pct) {
        metConditions++;
      } else {
        missing.push({
          field: "onTimePaymentPct",
          current: Math.round(profile.onTimePaymentPct),
          required: gate.customRule.min_on_time_pct,
          label: "On-Time Payment %",
        });
      }
    }
  }

  // 4. All conditions met → allowed
  if (missing.length === 0) {
    return { ...DEFAULT_ACCESS };
  }

  // 5. Calculate progress
  const progress = totalConditions > 0 ? Math.round((metConditions / totalConditions) * 100) : 0;

  // 6. Pick primary reason code from first failing condition
  const primaryReason = pickReasonCode(missing[0], gate);

  return {
    allowed: false,
    reasonCode: primaryReason,
    blockedTitle: gate.blockedTitle,
    blockedMessage: gate.blockedMessage,
    unlockHint: gate.unlockHint,
    icon: gate.icon,
    color: gate.color,
    progress,
    missingRequirements: missing,
  };
}

function pickReasonCode(firstMissing: MissingRequirement, gate: FeatureGate): ReasonCode {
  switch (firstMissing.field) {
    case "xnScore":
      return "score_too_low";
    case "honorScore":
      return "honor_too_low";
    case "circlesCompleted":
      return "circles_needed";
    case "accountAgeDays":
      return "account_too_new";
    case "role":
      return gate.requiredRole === "elder" ? "not_elder" : "insufficient_role";
    case "idVerified":
      return "needs_verification";
    case "incomeVerified":
      return "needs_income_verification";
    default:
      return (gate.reasonCode as ReasonCode) || "feature_disabled";
  }
}

// ==================== CONTEXT ====================

const FeatureGateContext = createContext<FeatureGateContextType | undefined>(undefined);

export const useFeatureGates = () => {
  const context = useContext(FeatureGateContext);
  if (!context) {
    throw new Error("useFeatureGates must be used within FeatureGateProvider");
  }
  return context;
};

// ==================== PROVIDER ====================

export const FeatureGateProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { score: xnScore } = useXnScore();

  const [gates, setGates] = useState<FeatureGate[]>([]);
  const [overrides, setOverrides] = useState<UserFeatureOverride[]>([]);
  const [profile, setProfile] = useState<UserGateProfile>({
    honorScore: 0,
    circlesCompleted: 0,
    role: "member",
    accountAgeDays: 0,
    idVerified: false,
    incomeVerified: false,
    phoneVerified: false,
    emailVerified: false,
    defaultsCount: 0,
    onTimePaymentPct: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // ---- Fetch gate definitions ----
  const fetchGates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("feature_gates")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) {
        console.error("[FeatureGate] Error fetching gates:", error.message);
        return;
      }
      setGates((data || []).map(rowToGate));
    } catch (err) {
      console.error("[FeatureGate] fetchGates exception:", err);
    }
  }, []);

  // ---- Fetch user overrides ----
  const fetchOverrides = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from("user_feature_overrides")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("[FeatureGate] Error fetching overrides:", error.message);
        return;
      }
      setOverrides((data || []).map(rowToOverride));
    } catch (err) {
      console.error("[FeatureGate] fetchOverrides exception:", err);
    }
  }, [user?.id]);

  // ---- Fetch user gate profile (membership + verification data) ----
  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      // Parallel: membership data + verification signals + financial profile
      const [membershipResult, signalsResult, financialResult, profileResult] = await Promise.all([
        // Best membership (highest role across communities)
        supabase
          .from("community_memberships")
          .select("role, circles_completed, defaults_count, honor_score, created_at")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(10),

        // Verification signals
        supabase
          .from("xnscore_initial_signals")
          .select("id_verified, phone_verified, email_verified, profile_complete")
          .eq("user_id", user.id)
          .maybeSingle(),

        // Financial profile (income verification)
        supabase
          .from("financial_profiles")
          .select("income_source, income_verified_at")
          .eq("user_id", user.id)
          .maybeSingle(),

        // Account creation date
        supabase
          .from("profiles")
          .select("created_at")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      // Aggregate membership data across communities
      const memberships = membershipResult.data || [];
      let bestRole = "member";
      let totalCirclesCompleted = 0;
      let totalDefaults = 0;
      let bestHonorScore = 0;

      for (const m of memberships) {
        const roleLevel = ROLE_HIERARCHY[m.role] ?? 0;
        if (roleLevel > (ROLE_HIERARCHY[bestRole] ?? 0)) {
          bestRole = m.role;
        }
        totalCirclesCompleted += m.circles_completed || 0;
        totalDefaults += m.defaults_count || 0;
        if ((m.honor_score || 0) > bestHonorScore) {
          bestHonorScore = m.honor_score || 0;
        }
      }

      // Calculate account age
      const createdAt = profileResult.data?.created_at;
      const accountAgeDays = createdAt
        ? Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Verification signals
      const signals = signalsResult.data;
      const financial = financialResult.data;

      setProfile({
        honorScore: bestHonorScore,
        circlesCompleted: totalCirclesCompleted,
        role: bestRole,
        accountAgeDays,
        idVerified: signals?.id_verified || false,
        incomeVerified: financial?.income_verified_at !== null && financial?.income_verified_at !== undefined,
        phoneVerified: signals?.phone_verified || false,
        emailVerified: signals?.email_verified || false,
        defaultsCount: totalDefaults,
        onTimePaymentPct: 0, // Could be fetched from xn_scores if needed
      });
    } catch (err) {
      console.error("[FeatureGate] fetchProfile exception:", err);
    }
  }, [user?.id]);

  // ---- Refresh all gate data ----
  const refreshGates = useCallback(async () => {
    setIsLoading(true);
    await Promise.all([fetchGates(), fetchOverrides(), fetchProfile()]);
    setIsLoading(false);
  }, [fetchGates, fetchOverrides, fetchProfile]);

  // ---- Initial load ----
  useEffect(() => {
    if (user?.id) {
      refreshGates();
    } else {
      setGates([]);
      setOverrides([]);
      setIsLoading(false);
    }
  }, [user?.id, refreshGates]);

  // ---- Real-time subscriptions ----
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`feature-gates-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feature_gates" },
        () => {
          fetchGates();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_feature_overrides",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchOverrides();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchGates, fetchOverrides]);

  // ---- Gate lookup map for O(1) access ----
  const gateMap = useMemo(() => {
    const map = new Map<string, FeatureGate>();
    for (const gate of gates) {
      map.set(gate.id, gate);
    }
    return map;
  }, [gates]);

  // ---- Core API: checkAccess ----
  const checkAccess = useCallback(
    (featureKey: string): AccessResult => {
      const gate = gateMap.get(featureKey);
      if (!gate) {
        // Unknown gate = allow by default (feature not gated)
        return { ...UNKNOWN_GATE };
      }
      return evaluateGate(gate, overrides, xnScore, profile);
    },
    [gateMap, overrides, xnScore, profile]
  );

  // ---- Category filter ----
  const getGatesByCategory = useCallback(
    (category: string): FeatureGate[] => {
      return gates.filter((g) => g.category === category);
    },
    [gates]
  );

  const getAllGates = useCallback(() => gates, [gates]);

  // ---- Context value ----
  const value = useMemo<FeatureGateContextType>(
    () => ({
      checkAccess,
      getGatesByCategory,
      getAllGates,
      gates,
      overrides,
      isLoading,
      refreshGates,
    }),
    [checkAccess, getGatesByCategory, getAllGates, gates, overrides, isLoading, refreshGates]
  );

  return (
    <FeatureGateContext.Provider value={value}>
      {children}
    </FeatureGateContext.Provider>
  );
};
