// ══════════════════════════════════════════════════════════════════════════════
// lib/tiers.ts — Canonical tier catalog (single source of truth)
// ══════════════════════════════════════════════════════════════════════════════
//
// The graduated entry tier system is defined in three places that have
// historically drifted: TIER_DEFINITIONS in services/GraduatedEntryEngine.ts,
// TIER_CONFIG in screens/GraduatedEntryScreen.tsx (with stale bronze/silver/
// gold labels that don't exist in the live DB), and the
// getTierColor/getTierBg/getTierEmoji switch statements in
// screens/DashboardScreen.tsx. This file collapses them into one.
//
// **All client surfaces should import from here.** When the DB seed
// (graduated_entry_tiers via migration 040) changes, update this file too.
// Anything that derives a tier's display from a string key — color, emoji,
// label, benefits copy — should look it up via `getTierByKey` rather than
// hardcoding a switch.
//
// Shape:
//   - tierKey/tierNumber/label: identity
//   - xnScoreMin/Max + minAccountAgeDays: the threshold rules
//   - maxCircleSize/maxContributionCents/positionAccess: the limit benefits
//   - featuresSummary/description: copy for UI
//   - fastTrackEligible/fastTrackMinDays: graduation acceleration
//   - icon/color/bgColor: visual surface
//
// Limits use `null` to mean "unlimited" (matches the DB seed convention).
// ══════════════════════════════════════════════════════════════════════════════

export type TierKey =
  | "critical"
  | "newcomer"
  | "established"
  | "trusted"
  | "elder"
  | "elite";

export type PositionAccess = "none" | "middle_only" | "any";

export type TierDefinition = {
  tierKey: TierKey;
  tierNumber: number;
  label: string;
  xnScoreMin: number;
  xnScoreMax: number;
  maxCircleSize: number | null;
  maxContributionCents: number | null;
  positionAccess: PositionAccess;
  minAccountAgeDays: number;
  featuresSummary: string;
  fastTrackEligible: boolean;
  fastTrackMinDays: number | null;
  icon: string;
  color: string;
  bgColor: string;
  description: string;
};

export const TIER_CATALOG: TierDefinition[] = [
  {
    tierKey: "critical",
    tierNumber: 0,
    label: "Critical",
    xnScoreMin: 0,
    xnScoreMax: 24,
    maxCircleSize: 0,
    maxContributionCents: 0,
    positionAccess: "none",
    minAccountAgeDays: 0,
    featuresSummary: "Observe only — cannot join or create circles",
    fastTrackEligible: false,
    fastTrackMinDays: null,
    icon: "🚫",
    color: "#991B1B",
    bgColor: "#FEE2E2",
    description:
      "Account restricted. Build your XnScore through verification and engagement.",
  },
  {
    tierKey: "newcomer",
    tierNumber: 1,
    label: "Newcomer",
    xnScoreMin: 25,
    xnScoreMax: 44,
    maxCircleSize: 5,
    maxContributionCents: 10000,
    positionAccess: "middle_only",
    minAccountAgeDays: 0,
    featuresSummary: "Basic circles, savings goals, financial coaching",
    fastTrackEligible: true,
    fastTrackMinDays: 45,
    icon: "🌱",
    color: "#EF4444",
    bgColor: "#FEF2F2",
    description: "First 90 days. Small circles, limited contributions.",
  },
  {
    tierKey: "established",
    tierNumber: 2,
    label: "Established",
    xnScoreMin: 45,
    xnScoreMax: 59,
    maxCircleSize: 10,
    maxContributionCents: 50000,
    positionAccess: "any",
    minAccountAgeDays: 90,
    featuresSummary: "Liquidity advance, referral program, marketplace basic",
    fastTrackEligible: false,
    fastTrackMinDays: null,
    icon: "⚡",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
    description: "90+ days with clean history. Standard access, higher limits.",
  },
  {
    tierKey: "trusted",
    tierNumber: 3,
    label: "Trusted",
    xnScoreMin: 60,
    xnScoreMax: 74,
    maxCircleSize: 20,
    maxContributionCents: 200000,
    positionAccess: "any",
    minAccountAgeDays: 365,
    featuresSummary: "Full marketplace, circle admin, matching pool",
    fastTrackEligible: false,
    fastTrackMinDays: null,
    icon: "✓",
    color: "#10B981",
    bgColor: "#D1FAE5",
    description: "12+ months, multiple completed circles. Full access.",
  },
  {
    tierKey: "elder",
    tierNumber: 4,
    label: "Elder",
    xnScoreMin: 75,
    xnScoreMax: 89,
    maxCircleSize: null,
    maxContributionCents: null,
    positionAccess: "any",
    minAccountAgeDays: 730,
    featuresSummary: "All features, governance privileges, reduced fees",
    fastTrackEligible: false,
    fastTrackMinDays: null,
    icon: "🏆",
    color: "#8B5CF6",
    bgColor: "#EDE9FE",
    description: "24+ months, exemplary history. Elder governance rights.",
  },
  {
    tierKey: "elite",
    tierNumber: 5,
    label: "Elite",
    xnScoreMin: 90,
    xnScoreMax: 100,
    maxCircleSize: null,
    maxContributionCents: null,
    positionAccess: "any",
    minAccountAgeDays: 730,
    featuresSummary: "All features, lowest fees, maximum trust",
    fastTrackEligible: false,
    fastTrackMinDays: null,
    icon: "⭐",
    color: "#FFD700",
    bgColor: "#FEF9C3",
    description: "Reserved for long-term exemplary members.",
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// Lookup helpers
// ══════════════════════════════════════════════════════════════════════════════

const FALLBACK_TIER: TierDefinition = {
  tierKey: "critical",
  tierNumber: -1,
  label: "Unknown",
  xnScoreMin: 0,
  xnScoreMax: 0,
  maxCircleSize: 0,
  maxContributionCents: 0,
  positionAccess: "none",
  minAccountAgeDays: 0,
  featuresSummary: "—",
  fastTrackEligible: false,
  fastTrackMinDays: null,
  icon: "🔵",
  color: "#6B7280",
  bgColor: "#F3F4F6",
  description: "—",
};

/**
 * Resolve a tier key to its definition. Returns null on unknown keys —
 * callers that want a safe non-null sentinel for visual rendering should
 * use `getTierByKeyOrFallback`.
 */
export function getTierByKey(key: string | null | undefined): TierDefinition | null {
  if (!key) return null;
  return TIER_CATALOG.find((t) => t.tierKey === key) ?? null;
}

/**
 * Same as `getTierByKey` but returns a neutral grey sentinel for unknown
 * keys instead of null. Use this in render paths where you'd otherwise
 * need a null-guard.
 */
export function getTierByKeyOrFallback(key: string | null | undefined): TierDefinition {
  return getTierByKey(key) ?? FALLBACK_TIER;
}

/**
 * The next tier in the ladder, or null if the input is already at the top
 * (or unknown). Useful for "X% to {{nextTier}}" copy.
 */
export function getNextTier(key: string | null | undefined): TierDefinition | null {
  const current = getTierByKey(key);
  if (!current) return null;
  return TIER_CATALOG.find((t) => t.tierNumber === current.tierNumber + 1) ?? null;
}
