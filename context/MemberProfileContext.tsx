// ══════════════════════════════════════════════════════════════════════════════
// MEMBER PROFILE CONTEXT - React context for consolidated behavioral profiles
// Fetches profile on mount when authenticated, provides refresh mechanism,
// and exposes all 5 profile dimensions via useMemberProfileContext().
// ══════════════════════════════════════════════════════════════════════════════

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  memberProfileService,
  MemberBehavioralProfile,
  ProfileSnapshot,
  NetworkMetrics,
  RiskIndicators,
} from "../services/MemberProfileService";

// ==================== CONTEXT TYPE ====================

type MemberProfileContextType = {
  profile: MemberBehavioralProfile | null;
  snapshots: ProfileSnapshot[];
  networkMetrics: NetworkMetrics | null;
  riskIndicators: RiskIndicators | null;
  isLoading: boolean;
  isRefreshing: boolean;
  refreshProfile: () => Promise<void>;
  lastError: string | null;
};

// ==================== CONTEXT ====================

const MemberProfileContext = createContext<MemberProfileContextType | undefined>(
  undefined
);

export const useMemberProfileContext = () => {
  const context = useContext(MemberProfileContext);
  if (!context) {
    throw new Error(
      "useMemberProfileContext must be used within MemberProfileProvider"
    );
  }
  return context;
};

// ==================== PROVIDER ====================

export const MemberProfileProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const { user } = useAuth();

  const [profile, setProfile] = useState<MemberBehavioralProfile | null>(null);
  const [snapshots, setSnapshots] = useState<ProfileSnapshot[]>([]);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics | null>(
    null
  );
  const [riskIndicators, setRiskIndicators] = useState<RiskIndicators | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // ---- Fetch all profile data in parallel ----
  const fetchAll = useCallback(async (userId: string) => {
    try {
      setLastError(null);
      const [profileData, snapshotData, networkData, riskData] =
        await Promise.all([
          memberProfileService.getProfileWithRefresh(userId),
          memberProfileService.getSnapshots(userId, 90),
          memberProfileService.getNetworkMetrics(userId),
          memberProfileService.getRiskIndicators(userId),
        ]);

      setProfile(profileData);
      setSnapshots(snapshotData);
      setNetworkMetrics(networkData);
      setRiskIndicators(riskData);
    } catch (err: any) {
      console.error("[MemberProfile] fetchAll error:", err);
      setLastError(err?.message || "Failed to load member profile");
    }
  }, []);

  // ---- Manual refresh (triggers server-side recomputation) ----
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    setIsRefreshing(true);
    try {
      await memberProfileService.refreshProfile(user.id);
      await fetchAll(user.id);
    } catch (err: any) {
      console.error("[MemberProfile] refresh error:", err);
      setLastError(err?.message || "Failed to refresh profile");
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.id, fetchAll]);

  // ---- Initial load when user authenticates ----
  useEffect(() => {
    if (user?.id) {
      setIsLoading(true);
      fetchAll(user.id).finally(() => setIsLoading(false));
    } else {
      // User logged out — clear state
      setProfile(null);
      setSnapshots([]);
      setNetworkMetrics(null);
      setRiskIndicators(null);
      setIsLoading(false);
      setLastError(null);
    }
  }, [user?.id, fetchAll]);

  // ---- Context value ----
  const value = useMemo<MemberProfileContextType>(
    () => ({
      profile,
      snapshots,
      networkMetrics,
      riskIndicators,
      isLoading,
      isRefreshing,
      refreshProfile,
      lastError,
    }),
    [
      profile,
      snapshots,
      networkMetrics,
      riskIndicators,
      isLoading,
      isRefreshing,
      refreshProfile,
      lastError,
    ]
  );

  return (
    <MemberProfileContext.Provider value={value}>
      {children}
    </MemberProfileContext.Provider>
  );
};
