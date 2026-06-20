import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Modal,
  Pressable,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// Bucket B — AsyncStorage gate for the first-visit coach mark. Version
// suffix lets us re-prompt every user if the copy shifts.
const COACH_KEY = "@tandaxn_xnscore_coach_seen_v1";

// Bucket B — six topics rendered together in one scrollable HelpSheet,
// opened by the header (?) button.
type HelpTopic =
  | "what_is_xnscore"
  | "five_factors"
  | "age_cap"
  | "velocity_cap"
  | "recovery_multiplier"
  | "tier_flip";
const HELP_TOPICS: HelpTopic[] = [
  "what_is_xnscore",
  "five_factors",
  "age_cap",
  "velocity_cap",
  "recovery_multiplier",
  "tier_flip",
];

// Bucket B — per-factor explainer payload. Captures the factor key plus
// its current score so the sheet can render "32 / 35" alongside the
// localized title + body and any matching improvement tip.
type FactorExplainer = {
  key: string;
  score: number;
  maxScore: number;
  tip: { title: string; description: string; potential_points: number } | null;
} | null;

// Bucket B — factor → destination map for the "Improve your score" tip
// CTAs. Most factors have a natural home in the existing nav; for ones
// without a clearly actionable surface we fall back to ScoreHub (the
// canonical place to see the wider score picture).
type RouteName = keyof RootStackParamList;
function routeForFactor(key: string): RouteName {
  switch (key) {
    case "payment_reliability":
    case "financial_behavior":
      return "WalletMain";
    case "circle_completion":
      return "Circles";
    case "community_standing":
      return "HonorScoreOverview";
    default:
      return "ScoreHub";
  }
}

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

  // Bucket B — HelpSheet visibility + per-factor explainer payload.
  const [helpOpen, setHelpOpen] = useState(false);
  const [factorExplainer, setFactorExplainer] = useState<FactorExplainer>(null);

  // Bucket B — first-visit coach mark. Same Animated.Value + useRef gate
  // pattern as prior buckets. Auto-dismiss after 4 s or on tap.
  const [coachVisible, setCoachVisible] = useState(false);
  const coachOpacity = useRef(new Animated.Value(0)).current;
  const coachCheckedRef = useRef(false);
  useEffect(() => {
    if (coachCheckedRef.current) return;
    coachCheckedRef.current = true;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(COACH_KEY);
        if (seen) return;
        setCoachVisible(true);
        Animated.timing(coachOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }).start();
      } catch {
        // AsyncStorage unavailable — silently skip.
      }
    })();
  }, [coachOpacity]);
  const dismissCoach = useCallback(() => {
    Animated.timing(coachOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setCoachVisible(false));
    AsyncStorage.setItem(COACH_KEY, "1").catch(() => undefined);
  }, [coachOpacity]);
  useEffect(() => {
    if (!coachVisible) return;
    const tid = setTimeout(() => dismissCoach(), 4000);
    return () => clearTimeout(tid);
  }, [coachVisible, dismissCoach]);

  // Helper for the factor row tap — looks up the matching tip from
  // breakdown.improvement_tips so the explainer can show a concrete next
  // action. Falls through to null when no tip targets this factor.
  const openFactorExplainer = useCallback(
    (key: string, score: number, maxScore: number) => {
      const tip = breakdown?.improvement_tips?.find((t) => t.factor === key) ?? null;
      setFactorExplainer({ key, score, maxScore, tip: tip ? {
        title: tip.title,
        description: tip.description,
        potential_points: tip.potential_points,
      } : null });
    },
    [breakdown],
  );

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

  // Bucket B sparkline data — history rows are sorted desc-by-created_at,
  // so reverse to get chronological order. Each row's `score` is the
  // post-event score; for rows missing it (older / partial writes) we
  // derive from previous_score + score_change. The sparkline component
  // is no-op when fewer than 2 points exist.
  const historyForSparkline = useMemo<number[]>(() => {
    const rows = [...history].reverse();
    const values: number[] = [];
    for (const row of rows) {
      const direct = Number((row as any).score);
      if (Number.isFinite(direct)) {
        values.push(direct);
        continue;
      }
      const prev = Number((row as any).previous_score);
      const delta = Number((row as any).score_change ?? 0);
      if (Number.isFinite(prev)) {
        values.push(prev + delta);
      }
    }
    // Append the current score so the rightmost dot reflects "now"
    // even if no history row has landed in the last few hours.
    if (score != null) values.push(Number(score));
    return values;
  }, [history, score]);

  // Bucket B improvement tips — server returns up to 5 ordered by
  // priority. We display the top 3 here; tapping a tip routes the user
  // to a sensible surface for that factor.
  const topTips = breakdown?.improvement_tips?.slice(0, 3) ?? [];

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
            <View style={styles.headerRightCluster}>
              {/* Bucket B — opens the HelpSheet glossary. */}
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() => setHelpOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("xnscore_dashboard.help_open")}
              >
                <Ionicons name="help-circle-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.historyButton}
                onPress={() => navigation.navigate("XnScoreHistory")}
              >
                <Ionicons name="time-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
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

          {/* Bucket B — 30-day sparkline. Reads the same history rows the
              Recent Activity section uses (limit 30 from the hook), then
              walks them in chronological order to plot post-event score
              values. Empty fallback when the user has no history yet. */}
          <Sparkline values={historyForSparkline} />
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
                    // Bucket B — the whole row is tappable. The (?) glyph
                    // next to the label flags the affordance; tapping
                    // anywhere on the row opens the factor explainer.
                    <TouchableOpacity
                      key={factor.key}
                      style={styles.breakdownRow}
                      onPress={() => openFactorExplainer(factor.key, factor.score, factor.maxScore)}
                      accessibilityRole="button"
                      accessibilityLabel={t("xnscore_dashboard.factor_explainer_open", { label: t(meta.labelKey) })}
                    >
                      <View style={styles.breakdownLeft}>
                        <View style={styles.breakdownHeader}>
                          <Ionicons name={meta.icon} size={16} color={meta.color} />
                          <Text style={styles.breakdownCategory}>{t(meta.labelKey)}</Text>
                          <Ionicons
                            name="help-circle-outline"
                            size={13}
                            color={meta.color}
                            style={{ marginLeft: 4 }}
                          />
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
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={styles.breakdownEmpty}>
                  {t("xnscore_dashboard.breakdown_loading")}
                </Text>
              )}
            </View>
          </View>

          {/* Bucket B — "Improve your score" tips. Driven by
              breakdown.improvement_tips (server-prioritized list). Each
              tip is tappable and routes to the surface most relevant to
              that factor via routeForFactor(). Skipped when the server
              returns no tips, which is the steady state for high-tier
              users. */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("xnscore_dashboard.tips_title")}</Text>
            {topTips.length > 0 ? (
              topTips.map((tip, i) => {
                const meta = FACTOR_META[tip.factor];
                const factorLabel = meta ? t(meta.labelKey) : tip.factor;
                const factorColor = meta?.color ?? "#1565C0";
                return (
                  <TouchableOpacity
                    key={`${tip.factor}-${i}`}
                    style={styles.tipCard}
                    onPress={() => {
                      const route = routeForFactor(tip.factor);
                      navigation.navigate(route as any);
                    }}
                    accessibilityRole="button"
                  >
                    <View style={styles.tipHeaderRow}>
                      <View style={[styles.tipFactorChip, { backgroundColor: factorColor + "20" }]}>
                        {meta ? (
                          <Ionicons name={meta.icon} size={12} color={factorColor} />
                        ) : null}
                        <Text style={[styles.tipFactorChipText, { color: factorColor }]}>{factorLabel}</Text>
                      </View>
                      {tip.potential_points > 0 ? (
                        <Text style={styles.tipPoints}>
                          {t("xnscore_dashboard.tip_points_label", { points: Math.round(tip.potential_points) })}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.tipTitle}>{tip.title}</Text>
                    <Text style={styles.tipBody}>{tip.description}</Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.tipsEmptyCard}>
                <Ionicons name="trophy-outline" size={32} color="#9CA3AF" />
                <Text style={styles.tipsEmptyText}>{t("xnscore_dashboard.tip_no_data")}</Text>
              </View>
            )}
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

      {/* Bucket B — modals + coach mark. Mounted as siblings to the
          ScrollView so they sit above content but inside the screen's
          root View. */}
      <HelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} t={t} />
      <PillExplainerSheet
        explainer={factorExplainer}
        onClose={() => setFactorExplainer(null)}
        t={t}
      />
      {coachVisible ? (
        <Animated.View
          style={[styles.coachOverlay, { opacity: coachOpacity }]}
          pointerEvents="box-none"
        >
          <Pressable style={styles.coachBackdrop} onPress={dismissCoach}>
            <View style={styles.coachCard}>
              <Ionicons name="bulb-outline" size={20} color="#FBBF24" />
              <Text style={styles.coachText}>{t("xnscore_dashboard.coach_tip")}</Text>
            </View>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bucket B subcomponents
// ─────────────────────────────────────────────────────────────────────────

type TFn = (key: string, opts?: any) => string;

// Bucket B — 30-day sparkline. Renders post-event score values as dot
// bars. Below 2 data points we show the no-history fallback instead of
// a flat line that conveys nothing.
function Sparkline({ values }: { values: number[] }) {
  const { t } = useTranslation();
  if (!values || values.length < 2) {
    return (
      <View style={styles.sparklineFallback}>
        <Text style={styles.sparklineFallbackText}>
          {t("xnscore_dashboard.no_history")}
        </Text>
      </View>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  // Cap at 30 dots so the sparkline width stays bounded on narrow phones.
  const trimmed = values.slice(-30);
  return (
    <View style={styles.sparklineContainer}>
      {trimmed.map((v, i) => {
        const pct = (v - min) / span;
        const height = 4 + pct * 26;
        return (
          <View
            key={i}
            style={[
              styles.sparklineDot,
              {
                height,
                backgroundColor:
                  i === trimmed.length - 1 ? "#00C6AE" : "rgba(255,255,255,0.55)",
              },
            ]}
          />
        );
      })}
    </View>
  );
}

// Bucket B — HelpSheet glossary. Six topics, each a localized title +
// body block. Modal slides from the bottom; backdrop tap dismisses.
function HelpSheet({
  visible,
  onClose,
  t,
}: {
  visible: boolean;
  onClose: () => void;
  t: TFn;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => undefined}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <Text style={sheetStyles.title}>{t("xnscore_dashboard.help_sheet_title")}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t("xnscore_dashboard.help_close")}>
              <Ionicons name="close" size={22} color="#0A2342" />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={sheetStyles.scroll}>
            {HELP_TOPICS.map((topic) => (
              <View key={topic} style={sheetStyles.helpItem}>
                <Text style={sheetStyles.helpItemTitle}>
                  {t(`xnscore_dashboard.help_${topic}_title`)}
                </Text>
                <Text style={sheetStyles.helpItemBody}>
                  {t(`xnscore_dashboard.help_${topic}_body`)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Bucket B — per-factor explainer. Title/body localized per factor key,
// current score, and (when available) the server-prioritized improvement
// tip for that factor with its potential points.
function PillExplainerSheet({
  explainer,
  onClose,
  t,
}: {
  explainer: FactorExplainer;
  onClose: () => void;
  t: TFn;
}) {
  if (!explainer) return null;
  const meta = FACTOR_META[explainer.key];
  const factorLabel = meta ? t(meta.labelKey) : explainer.key;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose}>
        <Pressable style={sheetStyles.sheet} onPress={() => undefined}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.headerRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {meta ? <Ionicons name={meta.icon} size={18} color={meta.color} /> : null}
              <Text style={sheetStyles.title}>{factorLabel}</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={t("xnscore_dashboard.help_close")}>
              <Ionicons name="close" size={22} color="#0A2342" />
            </TouchableOpacity>
          </View>
          <View style={sheetStyles.scoreChipRow}>
            <Text style={sheetStyles.scoreChipText}>
              {Math.round(explainer.score)} / {Math.round(explainer.maxScore)}
            </Text>
          </View>
          <Text style={sheetStyles.explainerTitle}>
            {t(`xnscore_dashboard.factor_explainer_${explainer.key}_title`)}
          </Text>
          <Text style={sheetStyles.explainerBody}>
            {t(`xnscore_dashboard.factor_explainer_${explainer.key}_body`)}
          </Text>
          {explainer.tip ? (
            <View style={sheetStyles.tipBlock}>
              <Text style={sheetStyles.tipBlockHeading}>
                {t("xnscore_dashboard.tips_title")}
              </Text>
              <Text style={sheetStyles.tipBlockTitle}>{explainer.tip.title}</Text>
              <Text style={sheetStyles.tipBlockBody}>{explainer.tip.description}</Text>
              {explainer.tip.potential_points > 0 ? (
                <Text style={sheetStyles.tipBlockPoints}>
                  {t("xnscore_dashboard.tip_points_label", {
                    points: Math.round(explainer.tip.potential_points),
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}
          <TouchableOpacity style={sheetStyles.closeBtn} onPress={onClose}>
            <Text style={sheetStyles.closeBtnText}>{t("xnscore_dashboard.help_close")}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
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

  // Bucket B — header right cluster holds the (?) help button + the
  // history button side-by-side. Width on each child stays 40 so the
  // grouped block roughly mirrors the back button on the left.
  headerRightCluster: { flexDirection: "row", alignItems: "center", gap: 6 },

  // Bucket B — 30-day sparkline mounted under the tier badge.
  sparklineContainer: { flexDirection: "row", alignItems: "flex-end", gap: 3, marginTop: 14, height: 32 },
  sparklineDot: { width: 4, borderRadius: 2 },
  sparklineFallback: { marginTop: 14, height: 32, alignItems: "center", justifyContent: "center" },
  sparklineFallbackText: { fontSize: 11, color: "rgba(255,255,255,0.55)", fontStyle: "italic" },

  // Bucket B — "Improve your score" tip cards.
  tipCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E5E7EB", marginBottom: 10 },
  tipHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  tipFactorChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  tipFactorChipText: { fontSize: 11, fontWeight: "700" },
  tipPoints: { fontSize: 12, fontWeight: "700", color: "#00C6AE" },
  tipTitle: { fontSize: 14, fontWeight: "600", color: "#0A2342", marginBottom: 4 },
  tipBody: { fontSize: 13, color: "#6B7280", lineHeight: 18 },
  tipsEmptyCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  tipsEmptyText: { fontSize: 13, color: "#6B7280", marginTop: 8, textAlign: "center" },

  // Bucket B — coach mark.
  coachOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-start" },
  coachBackdrop: { flex: 1, alignItems: "center", paddingTop: 110, paddingHorizontal: 24 },
  coachCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(15,23,42,0.96)", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, maxWidth: 320 },
  coachText: { flex: 1, fontSize: 13, color: "#FFFFFF", lineHeight: 18 },
});

// Bucket B — bottom-sheet styles (HelpSheet, PillExplainerSheet).
const sheetStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 30, maxHeight: "82%" },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "700", color: "#0A2342" },
  scroll: { maxHeight: 480 },
  helpItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  helpItemTitle: { fontSize: 14, fontWeight: "700", color: "#0A2342", marginBottom: 4 },
  helpItemBody: { fontSize: 13, color: "#4B5563", lineHeight: 19 },
  scoreChipRow: { flexDirection: "row", marginBottom: 12 },
  scoreChipText: { backgroundColor: "#E0F7F4", color: "#0A2342", fontSize: 13, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  explainerTitle: { fontSize: 15, fontWeight: "700", color: "#0A2342", marginBottom: 6 },
  explainerBody: { fontSize: 13, color: "#4B5563", lineHeight: 19, marginBottom: 14 },
  tipBlock: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 14 },
  tipBlockHeading: { fontSize: 11, fontWeight: "700", color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  tipBlockTitle: { fontSize: 13, fontWeight: "700", color: "#0A2342", marginBottom: 4 },
  tipBlockBody: { fontSize: 13, color: "#4B5563", lineHeight: 18, marginBottom: 8 },
  tipBlockPoints: { fontSize: 12, fontWeight: "700", color: "#00C6AE" },
  closeBtn: { backgroundColor: "#0A2342", borderRadius: 12, alignItems: "center", paddingVertical: 14 },
  closeBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});
