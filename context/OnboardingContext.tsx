// context/OnboardingContext.tsx
// ─────────────────────────────────────────────────────────────────────────────
// First-launch onboarding state — slimmed (P0 of first-launch review).
//
// Tracks three steps matching the brief's "Sign in → Join circle →
// First contribution" model. All three are AUTO-DERIVED from real data
// (no completeStep imperative calls, no AsyncStorage persistence of
// step state — the source of truth is Supabase):
//
//   verify_email      ← useAuth().isEmailVerified
//   join_circle       ← useCircles().myCircles.length > 0
//   first_contribution ← useHasContribution()
//
// The provider also keeps the `pendingInvite` channel used by
// CircleInviteScreen — an unrelated deep-link parking spot that
// happens to live on this context. And a back-compat no-op
// `completeStep` so legacy call sites (CircleInviteScreen, the
// orphan DashboardScreen destructure cleaned up alongside this) don't
// break the build during the transition.
//
// What's been deleted from the previous version (~600 lines net):
//   • DEFAULT_STEPS (6 steps) + DEFAULT_PROFILE_FIELDS (8 fields)
//     + DEFAULT_TOOLTIPS (5 tooltips)
//   • profileCompletion / profileFields / incompleteFields
//   • tooltips / activeTooltip / dismissTooltip / showNextTooltip
//     / skipAllTooltips
//   • generateCommunitySuggestions (mock data) +
//     suggestedCommunities / dismissSuggestion
//   • completeProfileField / skipOnboarding / resetOnboarding
//   • AsyncStorage @tandaxn_onboarding_* and @tandaxn_tooltips_shown_*
//     persistence (state is now derived, not stored).
//
// The three deleted UI components (`OnboardingTooltip`,
// `ProfileCompletionCard`, `CommunitySuggestions`) lived against the
// removed surface area.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useCircles } from "./CirclesContext";
import { useHasContribution } from "../hooks/useHasContribution";

// Kept for CircleInviteScreen — it lands deep-link invite data here for
// post-auth pickup. Unrelated to the first-launch progress model but
// historically lives on this context.
export interface InviteData {
  type: "circle" | "community";
  id: string;
  name: string;
  emoji?: string;
  invitedBy: string;
  inviterName: string;
  contribution?: number;
  frequency?: string;
  members?: number;
}

export type FirstLaunchStep =
  | "verify_email"
  | "join_circle"
  | "first_contribution";

export type FirstLaunchProgress = Record<FirstLaunchStep, boolean>;

interface OnboardingContextType {
  // First-launch — all three auto-derived from real data.
  firstLaunchProgress: FirstLaunchProgress;
  isComplete: boolean;
  // First incomplete step in order, or null when isComplete.
  nextStep: FirstLaunchStep | null;
  // True while any underlying derivation is still resolving — useful
  // for the future progress strip so it doesn't flash empty pips.
  loading: boolean;

  // Deep-link invite parking (CircleInviteScreen).
  pendingInvite: InviteData | null;
  setPendingInvite: (invite: InviteData | null) => void;
  clearPendingInvite: () => void;

  // Back-compat no-op. Step completion is auto-derived; legacy
  // imperative call sites continue to compile but no longer mutate
  // state. Safe to delete in P1 once those call sites are migrated.
  completeStep: (stepId: string) => void;
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(
  undefined,
);

const STEP_ORDER: FirstLaunchStep[] = [
  "verify_email",
  "join_circle",
  "first_contribution",
];

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { isEmailVerified, isAuthenticated } = useAuth();
  const { myCircles } = useCircles();
  const { hasContribution, loading: contributionsLoading } =
    useHasContribution();

  const [pendingInvite, setPendingInvite] = useState<InviteData | null>(null);

  const firstLaunchProgress = useMemo<FirstLaunchProgress>(
    () => ({
      verify_email: isAuthenticated && isEmailVerified,
      join_circle: (myCircles?.length ?? 0) > 0,
      first_contribution: hasContribution,
    }),
    [isAuthenticated, isEmailVerified, myCircles?.length, hasContribution],
  );

  const isComplete = useMemo(
    () => STEP_ORDER.every((s) => firstLaunchProgress[s]),
    [firstLaunchProgress],
  );

  const nextStep = useMemo<FirstLaunchStep | null>(
    () => STEP_ORDER.find((s) => !firstLaunchProgress[s]) ?? null,
    [firstLaunchProgress],
  );

  const value = useMemo<OnboardingContextType>(
    () => ({
      firstLaunchProgress,
      isComplete,
      nextStep,
      loading: contributionsLoading,
      pendingInvite,
      setPendingInvite,
      clearPendingInvite: () => setPendingInvite(null),
      completeStep: () => {
        /* no-op — first-launch progress is auto-derived from real data */
      },
    }),
    [
      firstLaunchProgress,
      isComplete,
      nextStep,
      contributionsLoading,
      pendingInvite,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextType {
  const ctx = useContext(OnboardingContext);
  if (ctx === undefined) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return ctx;
}
