// ══════════════════════════════════════════════════════════════════════════════
// hooks/useProfileIconBadge.ts — drives the colored dot on the HomeScreen
// Profile icon.
// ══════════════════════════════════════════════════════════════════════════════
//
// Mirrors the shape of useScoreHubBadge so the two top-bar icons share a
// vocabulary: 'critical' / 'attention' / 'none'. Pure read of state the
// app already has cached — no new RPC, no realtime subscription.
//
// Inputs:
//   1. useAuth() — exposes `user.kyc.status` (already hydrated on session
//      via AuthContext) and `isEmailVerified`. No round-trip required.
//   2. useProfile() — exposes `profile.avatar_url / full_name / country`
//      with a 60-second shared cache. Same source the icon uses to
//      render the real avatar, so we're already paying the cost.
//
// Output:
//   { urgency, isCritical, hasAttention }
//
// Urgency rules (highest priority wins):
//   • critical  — kyc.status IN ('rejected', 'expired')
//                 Money actions are blocked by KYCGate, so the icon
//                 needs to draw the user toward Profile → KYC Hub.
//   • attention — !isEmailVerified
//                 OR profile is loaded AND any of avatar_url / full_name /
//                 country is missing
//                 (the profile-loaded gate prevents the icon from flashing
//                 amber while the 60s cache is still populating)
//   • none      — everything healthy / unknown
//
// Why this isn't redundant with the Home KYC banner:
//   The banner only fires for kyc.status NOT IN ('approved', 'pending',
//   'provider_pending', 'provider_review', 'admin_review') — same risk
//   states this hook calls critical. The banner can scroll off-screen
//   though, and the icon is the canonical entry point to the action, so
//   the icon should signal the same urgency. They reinforce, not
//   duplicate.
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useProfile } from "./useProfile";

export type ProfileIconUrgency = "critical" | "attention" | "none";

export type ProfileIconBadge = {
  urgency: ProfileIconUrgency;
  isCritical: boolean;
  hasAttention: boolean;
};

// KYC statuses that mean "the user must take action before money flows
// can resume". Anything else (approved, pending, provider_*, admin_review,
// null) does not drive a critical badge.
const CRITICAL_KYC_STATUSES = new Set<string>(["rejected", "expired"]);

export function useProfileIconBadge(): ProfileIconBadge {
  const { user, isEmailVerified } = useAuth();
  const { profile, loading } = useProfile();

  return useMemo<ProfileIconBadge>(() => {
    const kycStatus = user?.kyc?.status ?? null;
    const isCritical =
      kycStatus !== null && CRITICAL_KYC_STATUSES.has(kycStatus);

    // Completeness check: only counts when profile has actually loaded.
    // While useProfile is filling its 60s cache, `profile === null` AND
    // `loading === true`; we deliberately ignore the missing-fields path
    // until we know the answer. The email-verified check still drives
    // attention immediately because it doesn't depend on the profiles
    // row.
    const profileIncomplete =
      !loading &&
      profile !== null &&
      (!profile.avatar_url || !profile.full_name || !profile.country);

    const hasAttention =
      !isCritical && (!isEmailVerified || profileIncomplete);

    const urgency: ProfileIconUrgency = isCritical
      ? "critical"
      : hasAttention
        ? "attention"
        : "none";

    return { urgency, isCritical, hasAttention };
  }, [user?.kyc?.status, isEmailVerified, profile, loading]);
}
