import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { useTranslation } from "react-i18next";
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from "react-native-svg";
import { RootStackParamList } from "../App";
import { Routes } from "../lib/routes";
// Bucket A — XnScoreContext is gone. All score / tier / breakdown / history
// data comes from real backend hooks now: the bundle hook reads the same
// shared cache the ScoreHub fills, the breakdown hook calls the server-
// authoritative get_score_breakdown RPC, and the history hook reads
// xnscore_history. Tier metadata is sourced from the canonical TIER_CATALOG
// in lib/tiers.ts so screen + Hub + ProfileScreen all agree.
import {
  useXnScoreFromBundle,
  useXnScoreBreakdown,
  useXnScoreHistory,
} from "../hooks/useXnScore";
import { useUserDefaults } from "../hooks/useDefaultCascade";
import { useLateContributions } from "../hooks/useLateContributions";
import {
  getTierByKeyOrFallback,
  getNextTier,
  TIER_CATALOG,
} from "../lib/tiers";

type XnScoreDashboardNavigationProp = StackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get("window");
const SCORE_RING_SIZE = width * 0.55;

// Bucket A — labels for the 5 server-side factors. The canonical key
// names come from xn_score_factor_definitions (migration 021). We render
// them in the order Postgres returns; this map just supplies localized
// labels + icons.
const FACTOR_META: Record<
  string,
  { labelKey: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  payment_reliability: { labelKey: "xnscore_dashboard.factor_payment_reliability", icon: "card-outline", color: "#00C6AE" },
  circle_completion:   { labelKey: "xnscore_dashboard.factor_circle_completion",   icon: "checkmark-done-circle-outline", color: "#1565C0" },
  tenure_activity:     { labelKey: "xnscore_dashboard.factor_tenure_activity",     icon: "time-outline",                  color: "#6366F1" },
  community_standing:  { labelKey: "xnscore_dashboard.factor_community_standing",  icon: "people-outline",                color: "#10B981" },
  financial_behavior:  { labelKey: "xnscore_dashboard.factor_financial_behavior",  icon: "wallet-outline",                color: "#EC4899" },
};

// Server-event-type icon map. Mirrors the trigger_event tokens the
// xnscore_history table emits (see migration 019 + the score-adjustment
// RPCs). Unknown events fall through to a neutral star.
function getEventIcon(triggerEvent: string): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  if (triggerEvent.startsWith("contribution_on_time") || triggerEvent.startsWith("contribution_early")) {
    return { icon: "checkmark-circle", color: "#00C6AE" };
  }
  if (triggerEvent.startsWith("contribution_late") || triggerEvent.includes("default")) {
    return { icon: "alert-circle", color: "#DC2626" };
  }
  if (triggerEvent.startsWith("circle_")) {
    return { icon: "people", color: "#1565C0" };
  }
  if (triggerEvent.startsWith("vouch_")) {
    return { icon: "shield-checkmark", color: "#10B981" };
  }
  if (triggerEvent.startsWith("tenure_") || triggerEvent.includes("growth")) {
    return { icon: "trending-up", color: "#6366F1" };
  }
  if (triggerEvent.startsWith("inactivity_") || triggerEvent.includes("decay")) {
    return { icon: "trending-down", color: "#F59E0B" };
  }
  if (triggerEvent.startsWith("payout_")) {
    return { icon: "cash-outline", color: "#00C6AE" };
  }
  if (triggerEvent.startsWith("referral_") || triggerEvent.startsWith("streak_")) {
    return { icon: "gift", color: "#EC4899" };
  }
  return { icon: "star", color: "#6B7280" };
}

// Format the trigger_event token as a human-readable label. Server-side
// event taxonomy uses snake_case; we strip + title-case for display.
// Bucket B will add per-event localized labels.
function humanizeEvent(triggerEvent: string): string {
  return triggerEvent
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function XnScoreDashboardScreen() {
  const navigation = useNavigation<XnScoreDashboardNavigationProp>();
  const { t } = useTranslation();

  // Bucket A data sources — three real hooks replacing XnScoreContext.
  const {
    score,
    tierKey,
    loading: bundleLoading,
    error: bundleError,
    refresh: refreshBundle,
  } = useXnScoreFromBundle();
  const { breakdown } = useXnScoreBreakdown();
  // 30 rows covers the dashboard's "Recent" list and gives Bucket B the
  // raw data for a 30-day sparkline without a second fetch.
  const { history } = useXnScoreHistory(undefined, 30);

  const { hasActiveDefaults } = useUserDefaults();
  const { lateContributions } = useLateContributions();
  const hasRecoveryItems = hasActiveDefaults || lateContributions.length > 0;

  // ── Tier resolution (Bucket A.3) ──────────────────────────────────────
  // The bundle returns a tierKey string ('newcomer' / 'trusted' / …) that
  // maps 1-to-1 to TIER_CATALOG entries. getTierByKeyOrFallback returns a
  // neutral grey "Unknown" entry on miss so the render path stays clean.
  const tier = getTierByKeyOrFallback(tierKey);
  const nextTier = tierKey ? getNextTier(tierKey) : null;
  // Tier-progress strip (Bucket A.7) — N points to next tier + 3 features
  // it unlocks. featuresSummary is one summary line per tier; we split on
  // ", " so the strip can show real bullets without inventing copy.
  const pointsToNext = nextTier && score != null
    ? Math.max(0, Math.round(nextTier.xnScoreMin - score))
    : 0;
  const tierProgressPct = nextTier && score != null && tier.xnScoreMax > tier.xnScoreMin
    ? Math.min(100, ((score - tier.xnScoreMin) / (nextTier.xnScoreMin - tier.xnScoreMin)) * 100)
    : 100;
  const nextTierBullets = nextTier
    ? nextTier.featuresSummary.split(", ").slice(0, 3)
    : [];

  // SVG Score Ring calculations
  const strokeWidth = 12;
  const radius = (SCORE_RING_SIZE - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const scorePercent = score ?? 0;
  const strokeDashoffset = circumference - (scorePercent / 100) * circumference;

  const recentHistory = history.slice(0, 5);

  // Five factors, rendered in TIER_CATALOG's canonical order. The RPC
  // sometimes returns them under a different key order; pull from
  // FACTOR_META so the display stays predictable.
  const factorRows = breakdown
    ? Object.keys(FACTOR_META).map((key) => {
        const factor = (breakdown.factors as Record<string, any>)[key];
        if (!factor) return null;
        return {
          key,
          score: factor.score ?? 0,
          maxScore: factor.max_score ?? 0,
          weight: factor.weight ?? 0,
        };
      }).filter((x): x is NonNullable<typeof x> => x != null)
    : [];

  // ── Loading + error gates ─────────────────────────────────────────────
  if (bundleLoading && score == null && !bundleError) {
    return (
      <View style={styles.skeletonContainer}>
        <ActivityIndicator size="large" color="#00C6AE" />
        <Text style={styles.skeletonText}>{t("xnscore_dashboard.skeleton_loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={["#0A2342", "#143654"]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>XnScore™</Text>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => navigation.navigate("XnScoreHistory")}
            >
              <Ionicons name="time-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Score Ring */}
          <View style={styles.scoreRingContainer}>
            <Svg width={SCORE_RING_SIZE} height={SCORE_RING_SIZE}>
              <Defs>
                <SvgLinearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#00C6AE" />
                  <Stop offset="100%" stopColor="#1565C0" />
                </SvgLinearGradient>
              </Defs>
              <Circle
                cx={SCORE_RING_SIZE / 2}
                cy={SCORE_RING_SIZE / 2}
                r={radius}
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <Circle
                cx={SCORE_RING_SIZE / 2}
                cy={SCORE_RING_SIZE / 2}
                r={radius}
                stroke="url(#scoreGradient)"
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${SCORE_RING_SIZE / 2} ${SCORE_RING_SIZE / 2})`}
              />
            </Svg>
            <View style={styles.scoreTextContainer}>
              <Text style={styles.scoreNumber}>{score ?? "—"}</Text>
              <Text style={styles.scoreLabel}>/ 100</Text>
            </View>
          </View>

          {/* Tier badge — sourced from TIER_CATALOG so this stays
              consistent with the Hub, Profile, and gating logic. */}
          <View style={[styles.tierBadge, { backgroundColor: tier.color + "30" }]}>
            <Text style={styles.tierIcon}>{tier.icon}</Text>
            <Text style={styles.tierLabel}>{tier.label}</Text>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Bundle-error banner — replaces the silent failure path the
              prior screen relied on (cycleError destructured but never
              rendered). */}
          {bundleError ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={20} color="#DC2626" />
              <View style={{ flex: 1 }}>
                <Text style={styles.errorTitle}>{t("xnscore_dashboard.bundle_error_title")}</Text>
                <Text style={styles.errorBody} numberOfLines={2}>{bundleError}</Text>
              </View>
              <TouchableOpacity onPress={() => refreshBundle()} style={styles.errorRetry}>
                <Ionicons name="refresh" size={18} color="#991B1B" />
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Recovery alert */}
          {hasRecoveryItems && (
            <TouchableOpacity
              style={styles.recoveryLink}
              onPress={() => navigation.navigate(Routes.DefaultRecovery)}
              accessibilityRole="button"
              accessibilityLabel={t("xnscore_dashboard.recovery_link_a11y")}
            >
              <Ionicons name="warning" size={18} color="#DC2626" />
              <Text style={styles.recoveryLinkText}>
                {t("xnscore_dashboard.recovery_link_text")}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#DC2626" />
            </TouchableOpacity>
          )}

          {/* Tier-progress strip (Bucket A.7) — N points to next tier
              + the first 3 featuresSummary bullets that next tier
              unlocks. featuresSummary is split on ", " so the bullets
              come straight from lib/tiers.ts without an extra config. */}
          {nextTier ? (
            <View style={styles.tierProgressCard}>
              <View style={styles.tierProgressHeader}>
                <Text style={styles.tierProgressTitle}>
                  {t("xnscore_dashboard.tier_progress_title", {
                    n: pointsToNext,
                    tier: nextTier.label,
                  })}
                </Text>
                <View style={[styles.tierProgressNextChip, { backgroundColor: nextTier.bgColor }]}>
                  <Text style={styles.tierProgressNextIcon}>{nextTier.icon}</Text>
                  <Text style={[styles.tierProgressNextLabel, { color: nextTier.color }]}>
                    {nextTier.label}
                  </Text>
                </View>
              </View>
              <View style={styles.tierProgressBarBg}>
                <View style={[styles.tierProgressBarFill, { width: `${tierProgressPct}%` }]} />
              </View>
              {nextTierBullets.length > 0 ? (
                <>
                  <Text style={styles.tierProgressUnlocksLabel}>
                    {t("xnscore_dashboard.tier_unlocks", { tier: nextTier.label })}
                  </Text>
                  {nextTierBullets.map((bullet, i) => (
                    <View key={i} style={styles.tierProgressBulletRow}>
                      <Ionicons name="checkmark-circle" size={16} color={nextTier.color} />
                      <Text style={styles.tierProgressBulletText}>{bullet}</Text>
                    </View>
                  ))}
                </>
              ) : null}
            </View>
          ) : (
            <View style={styles.tierProgressCard}>
              <Text style={styles.tierProgressAtMax}>
                {t("xnscore_dashboard.tier_progress_at_max", { tier: tier.label })}
              </Text>
              <Text style={styles.tierProgressAtMaxBody}>
                {tier.featuresSummary}
              </Text>
            </View>
          )}

          {/* Score Breakdown — real, server-authoritative 5 factors. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("xnscore_dashboard.section_breakdown")}</Text>
            <View style={styles.breakdownCard}>
              {factorRows.length > 0 ? (
                factorRows.map((factor) => {
                  const meta = FACTOR_META[factor.key];
                  const pct = factor.maxScore > 0
                    ? Math.min(100, (factor.score / factor.maxScore) * 100)
                    : 0;
                  return (
                    <View key={factor.key} style={styles.breakdownRow}>
                      <View style={styles.breakdownLeft}>
                        <View style={styles.breakdownHeader}>
                          <Ionicons name={meta.icon} size={16} color={meta.color} />
                          <Text style={styles.breakdownCategory}>{t(meta.labelKey)}</Text>
                        </View>
                        <View style={styles.breakdownBarContainer}>
                          <View
                            style={[
                              styles.breakdownBar,
                              {
                                width: `${Math.max(pct, 4)}%`,
                                backgroundColor: meta.color,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.breakdownPoints}>
                        {Math.round(factor.score)}/{Math.round(factor.maxScore)}
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.breakdownEmpty}>
                  {t("xnscore_dashboard.breakdown_loading")}
                </Text>
              )}
            </View>
          </View>

          {/* Recent Activity — real rows from xnscore_history. */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t("xnscore_dashboard.section_recent")}</Text>
              <TouchableOpacity onPress={() => navigation.navigate("XnScoreHistory")}>
                <Text style={styles.seeAllText}>{t("xnscore_dashboard.see_all")}</Text>
              </TouchableOpacity>
            </View>
            {recentHistory.length > 0 ? (
              recentHistory.map((event: any, i: number) => {
                const eventStyle = getEventIcon(event.trigger_event ?? "");
                const change = Number(event.score_change ?? 0);
                const dateStr = event.created_at
                  ? new Date(event.created_at).toLocaleDateString()
                  : "";
                return (
                  <View key={event.id ?? i} style={styles.activityCard}>
                    <View style={styles.activityLeft}>
                      <View style={[styles.activityIcon, { backgroundColor: eventStyle.color + "20" }]}>
                        <Ionicons name={eventStyle.icon} size={18} color={eventStyle.color} />
                      </View>
                      <View>
                        <Text style={styles.activityDescription}>
                          {humanizeEvent(event.trigger_event ?? "")}
                        </Text>
                        <Text style={styles.activityDate}>{dateStr}</Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.activityPoints,
                        { color: change >= 0 ? "#00C6AE" : "#DC2626" },
                      ]}
                    >
                      {change >= 0 ? "+" : ""}{Number(change.toFixed(2))}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.emptyActivity}>
                <Ionicons name="star-outline" size={40} color="#D1D5DB" />
                <Text style={styles.emptyText}>{t("xnscore_dashboard.empty_text")}</Text>
                <Text style={styles.emptySubtext}>{t("xnscore_dashboard.empty_subtext")}</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FA" },
  skeletonContainer: { flex: 1, backgroundColor: "#F5F7FA", alignItems: "center", justifyContent: "center", gap: 12 },
  skeletonText: { fontSize: 13, color: "#6B7280", marginTop: 6 },

  header: { paddingTop: 60, paddingBottom: 30, paddingHorizontal: 20, alignItems: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 20 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFFFFF" },
  historyButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },

  scoreRingContainer: { alignItems: "center", justifyContent: "center", marginBottom: 16 },
  scoreTextContainer: { position: "absolute", alignItems: "center" },
  scoreNumber: { fontSize: 48, fontWeight: "700", color: "#FFFFFF" },
  scoreLabel: { fontSize: 16, color: "rgba(255,255,255,0.6)" },

  // Bucket A — tier badge replaces the legacy "level" badge. Reads from
  // TIER_CATALOG so colour + label + icon always match the Hub.
  tierBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 8 },
  tierIcon: { fontSize: 18 },
  tierLabel: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },

  content: { padding: 20 },

  errorBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEE2E2", borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#FCA5A5" },
  errorTitle: { fontSize: 13, fontWeight: "700", color: "#991B1B" },
  errorBody: { fontSize: 12, color: "#7F1D1D", marginTop: 2 },
  errorRetry: { padding: 6 },

  recoveryLink: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEE2E2", borderWidth: 1, borderColor: "#FCA5A5", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  recoveryLinkText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#991B1B" },

  // Bucket A.7 — tier-progress strip.
  tierProgressCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#E5E7EB" },
  tierProgressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  tierProgressTitle: { fontSize: 14, fontWeight: "600", color: "#0A2342", flex: 1, marginRight: 12 },
  tierProgressNextChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  tierProgressNextIcon: { fontSize: 13 },
  tierProgressNextLabel: { fontSize: 12, fontWeight: "700" },
  tierProgressBarBg: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3, overflow: "hidden", marginBottom: 14 },
  tierProgressBarFill: { height: 6, backgroundColor: "#00C6AE", borderRadius: 3 },
  tierProgressUnlocksLabel: { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  tierProgressBulletRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  tierProgressBulletText: { fontSize: 13, color: "#374151", flex: 1 },
  tierProgressAtMax: { fontSize: 15, fontWeight: "700", color: "#0A2342", marginBottom: 4 },
  tierProgressAtMaxBody: { fontSize: 13, color: "#6B7280" },

  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: "#0A2342", marginBottom: 12 },
  seeAllText: { fontSize: 14, fontWeight: "600", color: "#00C6AE" },

  breakdownCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  breakdownRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  breakdownLeft: { flex: 1, marginRight: 16 },
  breakdownHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  breakdownCategory: { fontSize: 14, color: "#6B7280" },
  breakdownBarContainer: { height: 6, backgroundColor: "#E5E7EB", borderRadius: 3 },
  breakdownBar: { height: "100%", borderRadius: 3 },
  breakdownPoints: { fontSize: 15, fontWeight: "600", minWidth: 60, textAlign: "right", color: "#0A2342" },
  breakdownEmpty: { fontSize: 13, color: "#9CA3AF", textAlign: "center", paddingVertical: 16 },

  activityCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E5E7EB", flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  activityLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  activityIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  activityDescription: { fontSize: 14, fontWeight: "500", color: "#0A2342", marginBottom: 2 },
  activityDate: { fontSize: 12, color: "#6B7280" },
  activityPoints: { fontSize: 16, fontWeight: "600" },

  emptyActivity: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 40, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 12 },
  emptySubtext: { fontSize: 13, color: "#9CA3AF", marginTop: 4 },
});
