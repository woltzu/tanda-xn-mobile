// ══════════════════════════════════════════════════════════════════════════════
// screens/ScoreHubScreen.tsx — bottom-tab for scoring + wellbeing.
// ══════════════════════════════════════════════════════════════════════════════
//
// P1 rewrite (2026-06-12):
//   - Replaced the 4 independent hooks (useXnScore + useHonorScore +
//     useStressScore + useMoodScore) with a single batched RPC call to
//     `get_user_scores` (migration 144). One round-trip, 5-min in-memory
//     cache, refetch on screen focus.
//   - Added a hero alert card at the top that picks the most urgent score
//     and surfaces a one-tap CTA to its deep dive (stress → mood → honor →
//     low XnScore).
//   - Header card consolidated with the XnScore feature card: the gradient
//     header IS the XnScore surface (tier + streak + delta + "view full
//     profile" link inline). No separate XnScore body below.
//   - Each non-XnScore card now shows a direction badge ("↑ better" /
//     "↓ better") and an inline "+N vs last week" delta line.
//   - First-visit explainer modal (two slides) gated by AsyncStorage flag
//     `@tandaxn_score_hub_seen_v1`.
//   - Each card title gets a (?) help icon that opens Alert.alert with a
//     plain-language explanation of what the score measures.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { colors } from "../theme/tokens";
import { useTypedNavigation } from "../hooks/useTypedNavigation";
import { Routes } from "../lib/routes";
import ScoreExplainerSheet from "../components/ScoreExplainerSheet";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
  type ScoreBundle,
  type StressStatus,
  type StressTrend,
  type MoodTier,
  type MoodTrend,
  type HonorTier,
  getCachedScoreBundle,
  setCachedScoreBundle,
  clearScoreCache,
  setLastVisitAt,
} from "../lib/scoreCache";
import { useEventTracker } from "../hooks/useEventTracker";

// ==========================================================================
// 5-minute in-memory cache keyed by userId. Now lives in lib/scoreCache.ts
// so HomeScreen's badge hook can read it without touching the network.
// useFocusEffect still calls loadScores; getCachedScoreBundle shortcuts
// the RPC when the entry is fresh and matches the current user.
// ==========================================================================

async function fetchScoreBundle(userId: string): Promise<ScoreBundle> {
  const cached = getCachedScoreBundle(userId);
  if (cached) return cached;

  const { data, error } = await supabase.rpc("get_user_scores", {
    p_user_id: userId,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as ScoreBundle | null;
  const bundle: ScoreBundle = row ?? {
    xnscore: null,
    xnscore_tier: null,
    xnscore_delta: null,
    xnscore_previous: null,
    xnscore_7d_ago: null,
    xnscore_percentile: null,
    honor_score: null,
    honor_tier: null,
    honor_delta: null,
    honor_previous: null,
    honor_7d_ago: null,
    honor_percentile: null,
    stress_score: null,
    stress_status: null,
    stress_trend: null,
    stress_top_signal: null,
    stress_delta: null,
    stress_previous: null,
    stress_7d_ago: null,
    stress_percentile: null,
    mood_score: null,
    mood_tier: null,
    mood_trend: null,
    mood_delta: null,
    mood_previous: null,
    mood_7d_ago: null,
    mood_percentile: null,
    last_updated: null,
  };
  setCachedScoreBundle(userId, bundle);
  return bundle;
}

// ==========================================================================
// Color + icon helpers (kept verbatim from P0 — these are the canonical
// palettes referenced by both detail screens and the hub).
// ==========================================================================

function scoreColor(score: number): string {
  if (score >= 75) return colors.accentTeal;
  if (score >= 45) return colors.warningAmber;
  return colors.errorText;
}

function honorColor(tier: HonorTier): string {
  switch (tier) {
    case "Grand Elder":
      return "#7C3AED";
    case "Elder":
      return colors.accentTeal;
    case "Respected":
      return colors.warningAmber;
    case "Trusted":
      return colors.textSecondary;
    case "Novice":
    default:
      return "#92400E";
  }
}

function stressStatusColor(status: StressStatus): string {
  switch (status) {
    case "green":
      return "#10B981";
    case "yellow":
      return "#EAB308";
    case "orange":
      return "#F97316";
    case "red":
      return "#EF4444";
  }
}

function moodTierColor(tier: MoodTier): string {
  switch (tier) {
    case "stable":
      return "#22C55E";
    case "drifting":
      return "#EAB308";
    case "disengaging":
      return "#F97316";
    case "at_risk":
      return "#EF4444";
  }
}
function moodTierEmoji(tier: MoodTier): string {
  switch (tier) {
    case "stable":
      return "\u{1F60A}";
    case "drifting":
      return "\u{1F610}";
    case "disengaging":
      return "\u{1F614}";
    case "at_risk":
      return "\u{1F198}";
  }
}

function trendColor(trend: StressTrend): string {
  if (trend === "improving") return colors.successText;
  if (trend === "stable") return colors.textSecondary;
  return colors.errorText;
}
function trendIcon(trend: StressTrend): "trending-down" | "remove-outline" | "trending-up" {
  if (trend === "improving") return "trending-down";
  if (trend === "stable") return "remove-outline";
  return "trending-up";
}

// ==========================================================================
// Format the inline "+N vs last week" delta. For higher-is-better scores
// (XnScore, Honor) a positive delta is improvement; for lower-is-better
// scores (Stress, Mood) a positive delta is worsening — colour flips.
// ==========================================================================

function formatDeltaLine(
  delta: number | null,
  higherIsBetter: boolean,
  tFn: (key: string, opts?: Record<string, unknown>) => string,
): { text: string; color: string } | null {
  if (delta == null) return null;
  if (delta === 0) {
    return {
      text: tFn("score_hub.delta_no_change"),
      color: colors.textSecondary,
    };
  }
  const isImprovement = higherIsBetter ? delta > 0 : delta < 0;
  const sign = delta > 0 ? "+" : "−"; // proper minus sign
  const abs = Math.abs(delta);
  return {
    text: tFn("score_hub.delta_vs_last_week", { sign, value: abs }),
    color: isImprovement ? colors.successText : colors.errorText,
  };
}

// ==========================================================================
// Hero card priority picker — scans the bundle in spec order and returns
// the first matching alert config, or null when nothing is urgent. Each
// non-null result has its own message + colour + CTA wired to the
// appropriate deep-dive screen.
// ==========================================================================

type HeroAlert = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  kicker: string;
  message: string;
  cta: string;
  onPress: () => void;
};

function pickHeroAlert(
  bundle: ScoreBundle,
  navigate: ReturnType<typeof useTypedNavigation>,
  tFn: (key: string, opts?: Record<string, unknown>) => string,
): HeroAlert | null {
  // 1. Stress red/orange
  if (bundle.stress_status === "red" || bundle.stress_status === "orange") {
    return {
      icon: "pulse-outline",
      color: stressStatusColor(bundle.stress_status),
      kicker: tFn("score_hub.hero_kicker_stress"),
      message: tFn(`score_hub.hero_message_stress_${bundle.stress_status}`),
      cta: tFn("score_hub.hero_cta_stress"),
      onPress: () => navigate.navigate(Routes.StressScoreDashboard),
    };
  }
  // 2. Mood at_risk / disengaging
  if (bundle.mood_tier === "at_risk" || bundle.mood_tier === "disengaging") {
    return {
      icon: "happy-outline",
      color: moodTierColor(bundle.mood_tier),
      kicker: tFn("score_hub.hero_kicker_mood"),
      message: tFn(`score_hub.hero_message_mood_${bundle.mood_tier}`),
      cta: tFn("score_hub.hero_cta_mood"),
      onPress: () => navigate.navigate(Routes.MoodInsights),
    };
  }
  // 3. Honor Novice / Trusted
  if (bundle.honor_tier === "Novice" || bundle.honor_tier === "Trusted") {
    const lower = bundle.honor_tier.toLowerCase();
    return {
      icon: "ribbon-outline",
      color: honorColor(bundle.honor_tier as HonorTier),
      kicker: tFn("score_hub.hero_kicker_honor"),
      message: tFn(`score_hub.hero_message_honor_${lower}`),
      cta: tFn("score_hub.hero_cta_honor"),
      onPress: () => navigate.navigate(Routes.HonorScoreOverview),
    };
  }
  // 4. XnScore < 60
  if (bundle.xnscore != null && bundle.xnscore < 60) {
    return {
      icon: "trophy-outline",
      color: scoreColor(bundle.xnscore),
      kicker: tFn("score_hub.hero_kicker_xnscore"),
      message: tFn("score_hub.hero_message_xnscore_low"),
      cta: tFn("score_hub.hero_cta_xnscore"),
      onPress: () => navigate.navigate(Routes.CreditReport),
    };
  }
  return null;
}

// ==========================================================================
// FeatureCard — extended with optional helpText / helpTitle: when present a
// "?" icon renders next to the title and triggers Alert.alert.
// ==========================================================================

type FeatureCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  description: string;
  statusLabel?: string;
  statusColor?: string;
  headerToggle?: {
    value: boolean;
    onValueChange: (next: boolean) => void;
  };
  ctaLabel: string;
  ctaIcon?: keyof typeof Ionicons.glyphMap;
  onCta: () => void;
  helpTitle?: string;
  helpText?: string;
  helpA11yLabel?: string;
  // Bucket B (Explainable AI) — when supplied, the (?) icon calls this
  // instead of firing Alert.alert. Lets the parent route all 4 help
  // icons to a single unified ScoreExplainerSheet.
  onHelpPress?: () => void;
  children?: React.ReactNode;
};

function FeatureCard({
  icon,
  iconColor,
  title,
  description,
  statusLabel,
  statusColor,
  headerToggle,
  ctaLabel,
  ctaIcon,
  onCta,
  helpTitle,
  helpText,
  helpA11yLabel,
  onHelpPress,
  children,
}: FeatureCardProps) {
  return (
    <View style={styles.featureCard}>
      <View style={styles.featureHeaderRow}>
        <View
          style={[
            styles.featureIconBox,
            { backgroundColor: `${iconColor ?? colors.primaryNavy}1A` },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={iconColor ?? colors.primaryNavy}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.featureTitle}>{title}</Text>
            {helpText || onHelpPress ? (
              <TouchableOpacity
                onPress={() =>
                  onHelpPress
                    ? onHelpPress()
                    : Alert.alert(helpTitle ?? title, helpText ?? "")
                }
                accessibilityRole="button"
                accessibilityLabel={helpA11yLabel ?? helpTitle ?? title}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons
                  name="help-circle-outline"
                  size={16}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            ) : null}
          </View>
          <Text style={styles.featureDescription}>{description}</Text>
        </View>
        {headerToggle ? (
          <Switch
            value={headerToggle.value}
            onValueChange={headerToggle.onValueChange}
            trackColor={{ false: colors.border, true: colors.accentTeal }}
            thumbColor={colors.cardBg}
          />
        ) : statusLabel ? (
          <View
            style={[
              styles.featureStatusPill,
              { backgroundColor: `${statusColor ?? colors.textSecondary}1A` },
            ]}
          >
            <Text
              style={[
                styles.featureStatusText,
                { color: statusColor ?? colors.textSecondary },
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {children ? <View style={styles.featureBody}>{children}</View> : null}

      <TouchableOpacity
        style={styles.featureCta}
        onPress={onCta}
        accessibilityRole="button"
      >
        <Text style={styles.featureCtaText}>{ctaLabel}</Text>
        {ctaIcon ? (
          <Ionicons name={ctaIcon} size={14} color={colors.primaryNavy} />
        ) : (
          <Ionicons name="chevron-forward" size={14} color={colors.primaryNavy} />
        )}
      </TouchableOpacity>
    </View>
  );
}

// ==========================================================================
// DirectionBadge — a small inline pill that says whether higher-is-better.
// ==========================================================================

function DirectionBadge({
  higherIsBetter,
  label,
}: {
  higherIsBetter: boolean;
  label: string;
}) {
  return (
    <View style={styles.directionBadge}>
      <Ionicons
        name={higherIsBetter ? "arrow-up" : "arrow-down"}
        size={11}
        color={colors.textSecondary}
      />
      <Text style={styles.directionBadgeText}>{label}</Text>
    </View>
  );
}

// ==========================================================================
// FirstVisitModal — Bucket B single-slide explainer. One screen with a
// 2×2 tile grid of the four scores + a single body line + a single
// "Got it" button. Caller persists the AsyncStorage flag on dismiss so
// it never shows again.
// ==========================================================================

// Bumped v1 → v2 in Bucket B when the 2-slide explainer collapsed to a
// single slide. Re-using the same key would have kept v1-dismissed
// users from ever seeing the new copy; bumping shows them the new
// shorter explainer exactly once.
const FIRST_VISIT_KEY = "@tandaxn_score_hub_seen_v2";
// P2 — 7-day dismissal flag for the action-plan card. Stores the
// dismissal timestamp; re-shows automatically a week later.
const ACTION_PLAN_DISMISSED_KEY = "@tandaxn_score_hub_action_plan_dismissed_v1";

// ──────────────────────────────────────────────────────────────────────────
// P2 helpers — rule-based action plan, anomaly detection, sparkline + percentile
// ──────────────────────────────────────────────────────────────────────────

type ActionPlan = {
  scoreFamily: "xn" | "honor" | "stress" | "mood";
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  message: string;
};

// Worst-first selection. Stress and mood are inverse (high = bad);
// XN and honor are normal (low = bad). Returns null when every score is
// healthy — keeps the screen quiet for power users.
function pickActionPlan(
  b: ScoreBundle,
  tFn: (key: string, opts?: Record<string, unknown>) => string,
): ActionPlan | null {
  if (b.stress_status === "red" || b.stress_status === "orange") {
    return {
      scoreFamily: "stress",
      icon: "warning-outline",
      color: "#EF4444",
      message: tFn("score_hub_p2.action_stress"),
    };
  }
  if (b.mood_tier === "at_risk" || b.mood_tier === "disengaging") {
    return {
      scoreFamily: "mood",
      icon: "happy-outline",
      color: "#F97316",
      message: tFn("score_hub_p2.action_mood"),
    };
  }
  if (b.xnscore != null && b.xnscore < 60) {
    return {
      scoreFamily: "xn",
      icon: "trending-up-outline",
      color: "#2563EB",
      message: tFn("score_hub_p2.action_xn_low"),
    };
  }
  if (b.honor_score != null && b.honor_score < 50) {
    return {
      scoreFamily: "honor",
      icon: "ribbon-outline",
      color: "#7C3AED",
      message: tFn("score_hub_p2.action_honor_low"),
    };
  }
  return null;
}

type AnomalyBanner = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  message: string;
};

// Compares current vs 7-days-ago. Bigger absolute swings dominate; one
// banner at a time so the surface stays calm. Returns null when no
// score moved enough to trip a threshold OR when the *_7d_ago lookup
// returned NULL (no history yet).
function detectAnomaly(
  b: ScoreBundle,
  tFn: (key: string, opts?: Record<string, unknown>) => string,
): AnomalyBanner | null {
  const candidates: { weight: number; banner: AnomalyBanner }[] = [];

  if (b.xnscore != null && b.xnscore_7d_ago != null) {
    const d = b.xnscore - b.xnscore_7d_ago;
    if (d <= -10) {
      candidates.push({
        weight: Math.abs(d),
        banner: {
          icon: "trending-down",
          color: "#EF4444",
          message: tFn("score_hub_p2.anomaly_xn_drop", { points: Math.abs(d) }),
        },
      });
    }
  }
  if (b.stress_score != null && b.stress_7d_ago != null) {
    const d = b.stress_score - b.stress_7d_ago;
    if (d >= 15) {
      candidates.push({
        weight: d,
        banner: {
          icon: "alert-circle",
          color: "#EF4444",
          message: tFn("score_hub_p2.anomaly_stress_jump", { points: d }),
        },
      });
    }
  }
  if (b.mood_score != null && b.mood_7d_ago != null) {
    const d = b.mood_score - b.mood_7d_ago;
    if (Math.abs(d) >= 10) {
      candidates.push({
        weight: Math.abs(d),
        banner: {
          icon: "pulse",
          color: d < 0 ? "#EF4444" : "#10B981",
          message:
            d < 0
              ? tFn("score_hub_p2.anomaly_mood_drop", { points: Math.abs(d) })
              : tFn("score_hub_p2.anomaly_mood_rise", { points: d }),
        },
      });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b2) => b2.weight - a.weight);
  return candidates[0].banner;
}

// P2 — 7-dot sparkline. Real implementation will read a 7-day daily
// snapshot series; today we synthesise three known points (7d-ago,
// previous, current) and linearly interpolate the missing dots so the
// chart has something honest to show. NULL inputs yield an empty band.
function SparklineSeven({
  current,
  previous,
  sevenDayAgo,
  color,
}: {
  current: number | null;
  previous: number | null;
  sevenDayAgo: number | null;
  color: string;
}) {
  if (current == null) return null;
  const start = sevenDayAgo ?? previous ?? current;
  const mid = previous ?? Math.round((start + current) / 2);
  const points = [
    start,
    Math.round((start * 5 + mid) / 6),
    Math.round((start * 4 + mid * 2) / 6),
    mid,
    Math.round((mid * 4 + current * 2) / 6),
    Math.round((mid * 5 + current) / 6),
    current,
  ];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = Math.max(1, max - min);
  return (
    <View style={sparklineStyles.row}>
      {points.map((p, i) => {
        const h = 4 + Math.round(((p - min) / span) * 12);
        const isLast = i === points.length - 1;
        return (
          <View
            key={i}
            style={[
              sparklineStyles.dot,
              {
                height: h,
                backgroundColor: isLast ? color : `${color}55`,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const sparklineStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    height: 16,
    marginTop: 4,
  },
  dot: {
    width: 4,
    borderRadius: 2,
  },
});

// Bucket B — single-slide explainer. The 2-slide version sat on a
// spinner half the time and cost 3 taps before the user saw any
// scores. New shape:
//   • Title + 2×2 tile grid (one per score family with its icon/colour)
//   • One body line lifted from the existing slide2_body key
//   • Single "Got it" button (no Skip, no Next, no dots)
// Storage key bumped from _v1 to _v2 so existing users see the new
// shorter explainer once.
const FIRST_VISIT_TILES: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  labelKey: string;
}> = [
  { icon: "trophy-outline", color: colors.accentTeal, labelKey: "score_hub.header_xnscore_label" },
  { icon: "ribbon-outline", color: "#7C3AED", labelKey: "score_hub.honor_title" },
  { icon: "pulse-outline", color: "#EF4444", labelKey: "score_hub.stress_title" },
  { icon: "happy-outline", color: "#F97316", labelKey: "score_hub.mood_title" },
];

function FirstVisitModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Ionicons
            name="compass-outline"
            size={32}
            color={colors.accentTeal}
            style={styles.modalIcon}
          />
          <Text style={styles.modalTitle}>
            {t("score_hub.first_visit_slide1_title")}
          </Text>

          <View style={styles.modalTileGrid}>
            {FIRST_VISIT_TILES.map((tile) => (
              <View key={tile.labelKey} style={styles.modalTile}>
                <View
                  style={[
                    styles.modalTileIconBox,
                    { backgroundColor: `${tile.color}1A` },
                  ]}
                >
                  <Ionicons name={tile.icon} size={20} color={tile.color} />
                </View>
                <Text style={styles.modalTileLabel} numberOfLines={1}>
                  {t(tile.labelKey)}
                </Text>
              </View>
            ))}
          </View>

          <Text style={styles.modalBody}>
            {t("score_hub.first_visit_slide2_body")}
          </Text>

          <TouchableOpacity
            onPress={onClose}
            style={styles.modalPrimaryBtn}
            accessibilityRole="button"
          >
            <Text style={styles.modalPrimaryText}>
              {t("score_hub.first_visit_got_it")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ==========================================================================
// Screen
// ==========================================================================

export default function ScoreHubScreen() {
  const { t } = useTranslation();
  const navigation = useTypedNavigation();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // ── Batched RPC fetch ─────────────────────────────────────────────────
  const [bundle, setBundle] = useState<ScoreBundle | null>(
    userId ? getCachedScoreBundle(userId) : null,
  );
  const [loading, setLoading] = useState<boolean>(bundle == null);
  const [error, setError] = useState<string | null>(null);

  const loadScores = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      setError(null);
      // Only spin if we have nothing to show — keeps the screen quiet on
      // focus-refetches where the cache may already have data.
      const haveCached = getCachedScoreBundle(userId);
      if (!haveCached) setLoading(true);
      const data = await fetchScoreBundle(userId);
      setBundle(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Bucket C — telemetry channel. Bound by useEventTracker to the
  // current user; emits `screen_view → ScoreHub` via the existing
  // EventService pipeline (no console.log fallback needed). The
  // EventService self-deduplicates same-screen views, so the focus
  // refetch loop doesn't double-fire.
  const { trackScreenView, track } = useEventTracker();

  useFocusEffect(
    useCallback(() => {
      loadScores();
      // Bucket C — stamp the visit timestamp into AsyncStorage on every
      // focus. The badge hook on HomeScreen reads it back to clear the
      // "updated since you last looked" amber dot. Stamping on focus
      // (not just initial mount) covers users who navigate away and
      // back without unmounting the screen.
      setLastVisitAt().catch(() => {});
      trackScreenView("ScoreHub", {
        has_bundle: getCachedScoreBundle(userId ?? "") != null,
      });
      track({
        eventType: "score_hub_opened",
        eventCategory: "score",
        eventAction: "opened",
        eventLabel: userId ?? undefined,
      });
    }, [loadScores, trackScreenView, track, userId]),
  );

  // ── Bucket B — pull-to-refresh ────────────────────────────────────────
  // A user who just contributed and expects stress to drop had no manual
  // refresh path other than switching tabs and coming back. This wires
  // the canonical RefreshControl pattern: clear the shared cache, then
  // re-fetch via the same loadScores path. The spinner state is local
  // (decoupled from `loading`) so the per-card skeletons don't reappear
  // while the user pulls — only the pull-indicator does.
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      clearScoreCache();
      await loadScores();
    } finally {
      setRefreshing(false);
    }
  }, [loadScores]);

  // ── First-visit explainer modal ───────────────────────────────────────
  const [showFirstVisit, setShowFirstVisit] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(FIRST_VISIT_KEY);
        if (!cancelled && seen !== "1") {
          setShowFirstVisit(true);
        }
      } catch {
        // AsyncStorage failure is non-fatal — just skip the modal.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const dismissFirstVisit = useCallback(() => {
    setShowFirstVisit(false);
    AsyncStorage.setItem(FIRST_VISIT_KEY, "1").catch(() => {});
  }, []);

  // ── Derived values from bundle (with null-safe defaults) ──────────────
  const xnScoreValue = bundle?.xnscore ?? 0;
  const xnTier = bundle?.xnscore_tier ?? "";
  const xnDelta = bundle?.xnscore_delta ?? null;
  const honorScoreValue = bundle?.honor_score ?? 0;
  const honorTierName = (bundle?.honor_tier ?? "Novice") as HonorTier;
  const honorDelta = bundle?.honor_delta ?? null;
  const stressScoreValue = bundle?.stress_score ?? 0;
  const stressStatusValue = (bundle?.stress_status ?? "green") as StressStatus;
  const stressTrendValue = (bundle?.stress_trend ?? "stable") as StressTrend;
  const stressTopSignal = bundle?.stress_top_signal ?? null;
  const stressDelta = bundle?.stress_delta ?? null;
  const moodScoreValue = bundle?.mood_score ?? 0;
  const moodTierValue = (bundle?.mood_tier ?? "stable") as MoodTier;
  const moodTrendValue = (bundle?.mood_trend ?? "stable") as MoodTrend;
  const moodDelta = bundle?.mood_delta ?? null;

  // Per-card missing flags — the RPC succeeded but the row for this score
  // family is empty (engine hasn't computed yet).
  const xnPresent = bundle?.xnscore != null;
  const honorPresent = bundle?.honor_score != null;
  const stressPresent = bundle?.stress_score != null;
  const moodPresent = bundle?.mood_score != null;

  // ── Hero alert ────────────────────────────────────────────────────────
  const heroAlert = bundle ? pickHeroAlert(bundle, navigation, t) : null;

  // ── P2 — Action plan card (rule-based) ────────────────────────────────
  // Picks one actionable insight tied to the worst-performing score.
  // Dismissible for 7 days via AsyncStorage. The mapping below is a
  // hand-rolled rule table — replace with an AI-driven recommendation
  // when the engine grows that capability.
  const [actionPlanDismissed, setActionPlanDismissed] = useState<boolean>(false);

  // Bucket B (Explainable AI) — single bottom sheet replaces four
  // separate Alert.alert popups (one per score card). The XnScore inline
  // button and each FeatureCard's (?) icon all open the same sheet.
  const [showExplainer, setShowExplainer] = useState(false);
  const openExplainer = useCallback(() => setShowExplainer(true), []);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ACTION_PLAN_DISMISSED_KEY).then((v) => {
      if (cancelled) return;
      if (!v) return;
      const tsMs = parseInt(v, 10);
      if (Number.isFinite(tsMs) && Date.now() - tsMs < 7 * 24 * 60 * 60 * 1000) {
        setActionPlanDismissed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const actionPlan = bundle ? pickActionPlan(bundle, t) : null;
  // Bucket B — when a Hero alert is up, the Action Plan card is almost
  // always restating the same worst-score story one slot lower. Suppress
  // it when the hero is showing so the user sees one focused CTA instead
  // of two near-duplicates. Action Plan still surfaces when the hero is
  // null but the next-tier rule (e.g. xnscore < 60 with no red flags)
  // catches something.
  const showActionPlan =
    !actionPlanDismissed && actionPlan !== null && heroAlert == null;
  const dismissActionPlan = () => {
    setActionPlanDismissed(true);
    AsyncStorage.setItem(ACTION_PLAN_DISMISSED_KEY, String(Date.now())).catch(
      () => {},
    );
  };

  // ── P2 — Anomaly banner ────────────────────────────────────────────────
  // Surfaces when any score has shifted ≥10 points (XN/honor) or ≥15
  // (stress) from the 7-days-ago snapshot. Stress higher = worse, so
  // the inequality flips. Only one banner at a time, prioritising the
  // most impactful change.
  const anomaly = bundle ? detectAnomaly(bundle, t) : null;

  // ── Navigation handlers ───────────────────────────────────────────────
  const handleViewScoreHistory = () =>
    navigation.navigate(Routes.CreditReport);
  const handleViewCreditProfile = () =>
    navigation.navigate(Routes.CreditProfile);
  const handleOpenAIInsights = () => navigation.navigate(Routes.AIInsights);
  const handleOpenHonor = () => navigation.navigate(Routes.HonorScoreOverview);
  const handleOpenStress = () =>
    navigation.navigate(Routes.StressScoreDashboard);
  const handleOpenMood = () => navigation.navigate(Routes.MoodInsights);

  // ── Colors ────────────────────────────────────────────────────────────
  const xnColor = scoreColor(xnScoreValue);
  const honorTierColor = honorColor(honorTierName);
  const stressColorValue = stressStatusColor(stressStatusValue);
  const moodColorValue = moodTierColor(moodTierValue);

  // ── Delta lines ───────────────────────────────────────────────────────
  const xnDeltaLine = formatDeltaLine(xnDelta, true, t);
  const honorDeltaLine = formatDeltaLine(honorDelta, true, t);
  const stressDeltaLine = formatDeltaLine(stressDelta, false, t);
  const moodDeltaLine = formatDeltaLine(moodDelta, false, t);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryNavy} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentTeal}
            colors={[colors.accentTeal]}
          />
        }
      >
        {/* ===== HERO ALERT (priority) ===== */}
        {heroAlert ? (
          <TouchableOpacity
            onPress={heroAlert.onPress}
            accessibilityRole="button"
            style={[
              styles.heroCard,
              { borderLeftColor: heroAlert.color },
            ]}
          >
            <View
              style={[
                styles.heroIconBox,
                { backgroundColor: `${heroAlert.color}1A` },
              ]}
            >
              <Ionicons
                name={heroAlert.icon}
                size={20}
                color={heroAlert.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroKicker, { color: heroAlert.color }]}>
                {heroAlert.kicker}
              </Text>
              <Text style={styles.heroMessage}>{heroAlert.message}</Text>
            </View>
            <View style={styles.heroCtaRow}>
              <Text style={[styles.heroCtaText, { color: heroAlert.color }]}>
                {heroAlert.cta}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={14}
                color={heroAlert.color}
              />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* ===== P2 — Action plan card ===== */}
        {showActionPlan && actionPlan ? (
          <View
            style={[
              styles.actionPlanCard,
              { borderLeftColor: actionPlan.color },
            ]}
          >
            <View
              style={[
                styles.actionPlanIconBox,
                { backgroundColor: `${actionPlan.color}1A` },
              ]}
            >
              <Ionicons
                name={actionPlan.icon}
                size={18}
                color={actionPlan.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionPlanKicker}>
                {t("score_hub_p2.action_kicker")}
              </Text>
              <Text style={styles.actionPlanMessage}>{actionPlan.message}</Text>
            </View>
            <TouchableOpacity
              onPress={dismissActionPlan}
              accessibilityRole="button"
              accessibilityLabel={t("score_hub_p2.action_dismiss")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ===== P2 — Anomaly banner ===== */}
        {anomaly ? (
          <View
            style={[
              styles.anomalyBanner,
              { backgroundColor: `${anomaly.color}15`, borderColor: anomaly.color },
            ]}
          >
            <Ionicons name={anomaly.icon} size={14} color={anomaly.color} />
            <Text style={[styles.anomalyText, { color: anomaly.color }]}>
              {anomaly.message}
            </Text>
          </View>
        ) : null}

        {/* ===== ERROR BANNER (RPC failed) ===== */}
        {error && !loading ? (
          <View style={styles.bundleErrorRow}>
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={colors.errorText}
            />
            <Text style={styles.bundleErrorText}>
              {t("score_hub.bundle_error")}
            </Text>
            <TouchableOpacity
              onPress={() => {
                clearScoreCache();
                loadScores();
              }}
              accessibilityRole="button"
              style={styles.bundleRetryBtn}
            >
              <Text style={styles.bundleRetryText}>
                {t("score_hub.card_retry")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ===== CONSOLIDATED XNSCORE HEADER ===== */}
        <LinearGradient
          colors={[colors.primaryNavy, "#143654"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerCard}
        >
          <View style={styles.headerEyebrowRow}>
            <Text style={styles.headerEyebrow}>
              {t("score_hub.header_eyebrow")}
            </Text>
            <TouchableOpacity
              onPress={openExplainer}
              accessibilityRole="button"
              accessibilityLabel={t("score_hub.xnscore_help_title")}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons
                name="help-circle-outline"
                size={16}
                color={colors.textOnNavy}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerXnLabel}>
            {t("score_hub.header_xnscore_label")}
            <Text style={styles.headerXnTm}>™</Text>
          </Text>
          <View style={styles.headerScoreRow}>
            {loading && !xnPresent ? (
              <ActivityIndicator color={colors.textWhite} />
            ) : (
              <Text style={styles.headerScoreNumber}>{xnScoreValue}</Text>
            )}
            <Text style={styles.headerScoreOutOf}>
              {t("score_hub.out_of_label", { max: 100 })}
            </Text>
            <View style={styles.headerDirectionBadge}>
              <Ionicons name="arrow-up" size={11} color={colors.textOnNavy} />
              <Text style={styles.headerDirectionBadgeText}>
                {t("score_hub.direction_better")}
              </Text>
            </View>
          </View>

          {/* Inline delta line on the header (XnScore — higher is better) */}
          {xnDeltaLine ? (
            <Text
              style={[
                styles.headerDeltaText,
                { color: xnDeltaLine.color },
              ]}
            >
              {xnDeltaLine.text}
            </Text>
          ) : (
            <Text style={styles.headerScoreSubtitle}>
              {t("score_hub.header_score_subtitle")}
            </Text>
          )}

          {/* Tier + streak rows folded into the header (replaces the prior
              separate XnScore feature card body). Streak hidden until we
              wire it through the RPC; tier comes from the bundle. */}
          {xnTier ? (
            <View style={styles.headerStatRow}>
              <Text style={styles.headerStatLabel}>
                {t("score_hub.xnscore_tier_label")}
              </Text>
              <Text style={styles.headerStatValue}>{xnTier}</Text>
            </View>
          ) : null}

          {/* P2 — XnScore sparkline + percentile inside the navy header */}
          {bundle?.xnscore != null ? (
            <View style={styles.headerSparkRow}>
              <SparklineSeven
                current={bundle.xnscore}
                previous={bundle.xnscore_previous}
                sevenDayAgo={bundle.xnscore_7d_ago}
                color="#FFFFFF"
              />
              {bundle.xnscore_percentile != null ? (
                <Text style={styles.headerPercentile}>
                  {t("score_hub_p2.percentile_label", {
                    percent: bundle.xnscore_percentile,
                  })}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Two footer links — score history + full credit profile */}
          <View style={styles.headerLinkRow}>
            <TouchableOpacity
              onPress={handleViewScoreHistory}
              accessibilityRole="button"
              style={styles.headerLinkBtn}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={colors.textWhite}
              />
              <Text style={styles.headerLinkText}>
                {t("score_hub.xnscore_cta")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleViewCreditProfile}
              accessibilityRole="button"
              style={styles.headerLinkBtn}
            >
              <Ionicons
                name="document-text-outline"
                size={14}
                color={colors.textWhite}
              />
              <Text style={styles.headerLinkText}>
                {t("score_hub.xnscore_credit_profile_link")}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ===== HONOR SCORE ===== */}
        <FeatureCard
          icon="ribbon-outline"
          iconColor={honorTierColor}
          title={t("score_hub.honor_title")}
          description={t("score_hub.honor_description")}
          helpTitle={t("score_hub.honor_help_title")}
          helpText={t("score_hub.honor_help_text")}
          onHelpPress={openExplainer}
          statusLabel={
            loading && !honorPresent
              ? undefined
              : t(
                  `score_hub.honor_tier_${honorTierName
                    .toLowerCase()
                    .replace(/ /g, "_")}`,
                )
          }
          statusColor={honorTierColor}
          ctaLabel={t("score_hub.honor_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenHonor}
        >
          {loading && !honorPresent ? (
            <View style={styles.cardLoadingRow}>
              <ActivityIndicator size="small" color={colors.accentTeal} />
              <Text style={styles.cardLoadingText}>
                {t("score_hub.card_loading")}
              </Text>
            </View>
          ) : !honorPresent ? (
            <View style={styles.cardErrorRow}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={colors.errorText}
              />
              <Text style={styles.cardErrorText}>
                {t("score_hub.card_error")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  clearScoreCache();
                  loadScores();
                }}
                accessibilityRole="button"
                style={styles.cardRetryBtn}
              >
                <Text style={styles.cardRetryText}>
                  {t("score_hub.card_retry")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.gaugeRow}>
                <View style={styles.gaugeLabelRow}>
                  <Text style={styles.gaugeLabel}>
                    {t("score_hub.honor_score_label")}
                  </Text>
                  <DirectionBadge
                    higherIsBetter
                    label={t("score_hub.direction_better")}
                  />
                </View>
                <Text style={[styles.gaugeScore, { color: honorTierColor }]}>
                  {honorScoreValue}
                  <Text style={styles.gaugeOutOf}> / 100</Text>
                </Text>
              </View>
              <View style={styles.gaugeBarBg}>
                <View
                  style={[
                    styles.gaugeBarFill,
                    {
                      width: `${honorScoreValue}%`,
                      backgroundColor: honorTierColor,
                    },
                  ]}
                />
              </View>
              {honorDeltaLine ? (
                <Text
                  style={[styles.deltaInline, { color: honorDeltaLine.color }]}
                >
                  {honorDeltaLine.text}
                </Text>
              ) : null}
              {/* P2 — sparkline + percentile */}
              <View style={styles.cardSparklineRow}>
                <SparklineSeven
                  current={bundle?.honor_score ?? null}
                  previous={bundle?.honor_previous ?? null}
                  sevenDayAgo={bundle?.honor_7d_ago ?? null}
                  color={honorTierColor}
                />
                {bundle?.honor_percentile != null ? (
                  <Text style={styles.percentileText}>
                    {t("score_hub_p2.percentile_label", {
                      percent: bundle.honor_percentile,
                    })}
                  </Text>
                ) : null}
              </View>
            </>
          )}
        </FeatureCard>

        {/* ===== FINANCIAL STRESS SCORE ===== */}
        <FeatureCard
          icon="pulse-outline"
          iconColor={stressColorValue}
          title={t("score_hub.stress_title")}
          description={t("score_hub.stress_description")}
          helpTitle={t("score_hub.stress_help_title")}
          helpText={t("score_hub.stress_help_text")}
          onHelpPress={openExplainer}
          statusLabel={
            loading && !stressPresent
              ? undefined
              : t(`score_hub.stress_status_${stressStatusValue}`)
          }
          statusColor={stressColorValue}
          ctaLabel={t("score_hub.stress_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenStress}
        >
          {loading && !stressPresent ? (
            <View style={styles.cardLoadingRow}>
              <ActivityIndicator size="small" color={colors.accentTeal} />
              <Text style={styles.cardLoadingText}>
                {t("score_hub.card_loading")}
              </Text>
            </View>
          ) : !stressPresent ? (
            <View style={styles.cardErrorRow}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={colors.errorText}
              />
              <Text style={styles.cardErrorText}>
                {t("score_hub.card_error")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  clearScoreCache();
                  loadScores();
                }}
                accessibilityRole="button"
                style={styles.cardRetryBtn}
              >
                <Text style={styles.cardRetryText}>
                  {t("score_hub.card_retry")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.gaugeRow}>
                <View style={styles.gaugeLabelRow}>
                  <Text style={styles.gaugeLabel}>
                    {t("score_hub.stress_score_label")}
                  </Text>
                  <DirectionBadge
                    higherIsBetter={false}
                    label={t("score_hub.direction_better")}
                  />
                </View>
                <Text style={[styles.gaugeScore, { color: stressColorValue }]}>
                  {stressScoreValue}
                  <Text style={styles.gaugeOutOf}> / 100</Text>
                </Text>
              </View>
              <View style={styles.gaugeBarBg}>
                <View
                  style={[
                    styles.gaugeBarFill,
                    {
                      width: `${stressScoreValue}%`,
                      backgroundColor: stressColorValue,
                    },
                  ]}
                />
              </View>
              {stressDeltaLine ? (
                <Text
                  style={[styles.deltaInline, { color: stressDeltaLine.color }]}
                >
                  {stressDeltaLine.text}
                </Text>
              ) : null}
              {/* P2 — sparkline + percentile (stress: lower is better,
                  hence the "lower than X%" label rather than "top X%"). */}
              <View style={styles.cardSparklineRow}>
                <SparklineSeven
                  current={bundle?.stress_score ?? null}
                  previous={bundle?.stress_previous ?? null}
                  sevenDayAgo={bundle?.stress_7d_ago ?? null}
                  color={stressColorValue}
                />
                {bundle?.stress_percentile != null ? (
                  <Text style={styles.percentileText}>
                    {t("score_hub_p2.percentile_label_inverse", {
                      percent: bundle.stress_percentile,
                    })}
                  </Text>
                ) : null}
              </View>

              <View style={styles.trendRow}>
                <Ionicons
                  name={trendIcon(stressTrendValue)}
                  size={14}
                  color={trendColor(stressTrendValue)}
                />
                <Text style={styles.trendLabel}>
                  {t("score_hub.stress_trend_label")}
                </Text>
                <Text
                  style={[
                    styles.trendValue,
                    { color: trendColor(stressTrendValue) },
                  ]}
                >
                  {t(`score_hub.stress_trend_${stressTrendValue}`)}
                </Text>
              </View>

              <Text style={styles.bodyLabel}>
                {t("score_hub.stress_top_stressor_label")}
              </Text>
              <View style={styles.inlineRow}>
                <Ionicons
                  name="warning-outline"
                  size={14}
                  color={stressColorValue}
                />
                <Text style={styles.inlineRowText}>
                  {stressTopSignal
                    ? t(`score_hub.stress_signal_${stressTopSignal}`, {
                        defaultValue: stressTopSignal.replace(/_/g, " "),
                      })
                    : t("score_hub.stress_no_active_signals")}
                </Text>
              </View>
            </>
          )}
        </FeatureCard>

        {/* ===== MOOD DRIFT SCORE ===== */}
        <FeatureCard
          icon="happy-outline"
          iconColor={moodColorValue}
          title={t("score_hub.mood_title")}
          description={t("score_hub.mood_description")}
          helpTitle={t("score_hub.mood_help_title")}
          helpText={t("score_hub.mood_help_text")}
          onHelpPress={openExplainer}
          statusLabel={
            loading && !moodPresent
              ? undefined
              : `${moodTierEmoji(moodTierValue)}  ${t(`score_hub.mood_tier_${moodTierValue}`)}`
          }
          statusColor={moodColorValue}
          ctaLabel={t("score_hub.mood_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenMood}
        >
          {loading && !moodPresent ? (
            <View style={styles.cardLoadingRow}>
              <ActivityIndicator size="small" color={colors.accentTeal} />
              <Text style={styles.cardLoadingText}>
                {t("score_hub.card_loading")}
              </Text>
            </View>
          ) : !moodPresent ? (
            <View style={styles.cardErrorRow}>
              <Ionicons
                name="alert-circle-outline"
                size={16}
                color={colors.errorText}
              />
              <Text style={styles.cardErrorText}>
                {t("score_hub.card_error")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  clearScoreCache();
                  loadScores();
                }}
                accessibilityRole="button"
                style={styles.cardRetryBtn}
              >
                <Text style={styles.cardRetryText}>
                  {t("score_hub.card_retry")}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.gaugeRow}>
                <View style={styles.gaugeLabelRow}>
                  <Text style={styles.gaugeLabel}>
                    {t("score_hub.mood_score_label")}
                  </Text>
                  <DirectionBadge
                    higherIsBetter={false}
                    label={t("score_hub.direction_better")}
                  />
                </View>
                <Text style={[styles.gaugeScore, { color: moodColorValue }]}>
                  {moodScoreValue}
                  <Text style={styles.gaugeOutOf}> / 100</Text>
                </Text>
              </View>
              <View style={styles.gaugeBarBg}>
                <View
                  style={[
                    styles.gaugeBarFill,
                    {
                      width: `${moodScoreValue}%`,
                      backgroundColor: moodColorValue,
                    },
                  ]}
                />
              </View>
              {moodDeltaLine ? (
                <Text
                  style={[styles.deltaInline, { color: moodDeltaLine.color }]}
                >
                  {moodDeltaLine.text}
                </Text>
              ) : null}
              {/* P2 — sparkline + percentile */}
              <View style={styles.cardSparklineRow}>
                <SparklineSeven
                  current={bundle?.mood_score ?? null}
                  previous={bundle?.mood_previous ?? null}
                  sevenDayAgo={bundle?.mood_7d_ago ?? null}
                  color={moodColorValue}
                />
                {bundle?.mood_percentile != null ? (
                  <Text style={styles.percentileText}>
                    {t("score_hub_p2.percentile_label", {
                      percent: bundle.mood_percentile,
                    })}
                  </Text>
                ) : null}
              </View>

              <View style={styles.trendRow}>
                <Ionicons
                  name={trendIcon(moodTrendValue)}
                  size={14}
                  color={trendColor(moodTrendValue)}
                />
                <Text style={styles.trendLabel}>
                  {t("score_hub.mood_trend_label_new")}
                </Text>
                <Text
                  style={[
                    styles.trendValue,
                    { color: trendColor(moodTrendValue) },
                  ]}
                >
                  {t(`score_hub.mood_trend_${moodTrendValue}_new`)}
                </Text>
              </View>
            </>
          )}
        </FeatureCard>

        {/* ===== AI INSIGHTS — EXPLAINABLE AI DEEP DIVE ===== */}
        <FeatureCard
          icon="sparkles-outline"
          iconColor={colors.accentTeal}
          title={t("score_hub.ai_title")}
          description={t("score_hub.ai_description")}
          helpTitle={t("score_hub.ai_help_title")}
          helpText={t("score_hub.ai_help_text")}
          ctaLabel={t("score_hub.ai_cta")}
          ctaIcon="arrow-forward"
          onCta={handleOpenAIInsights}
        >
          <View style={styles.aiTaglineCard}>
            <Ionicons
              name="bulb-outline"
              size={14}
              color={colors.accentTeal}
            />
            <Text style={styles.aiTaglineText}>
              {t("score_hub.ai_tagline")}
            </Text>
          </View>
        </FeatureCard>
      </ScrollView>

      {/* Bucket B — gate on `bundle && !loading` so the explainer only
          overlays meaningful content, never the initial spinner. The
          AsyncStorage check still drives `showFirstVisit`; the render-
          time gate just delays the visual until scores are present. */}
      <FirstVisitModal
        visible={showFirstVisit && bundle != null && !loading}
        onClose={dismissFirstVisit}
      />

      <ScoreExplainerSheet
        visible={showExplainer}
        onClose={() => setShowExplainer(false)}
        onViewFullInsights={() => {
          setShowExplainer(false);
          navigation.navigate(Routes.AIInsights);
        }}
        scores={{
          xnscore: xnScoreValue,
          honor: honorScoreValue,
          stress: stressScoreValue,
          mood: moodScoreValue,
        }}
      />
    </SafeAreaView>
  );
}

// ==========================================================================
// Styles
// ==========================================================================

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.screenBg },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  // ----- P2 — Action plan card -----
  actionPlanCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cardBg,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  actionPlanIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPlanKicker: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  actionPlanMessage: {
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },

  // ----- P2 — Anomaly banner -----
  anomalyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  anomalyText: { fontSize: 12, fontWeight: "600", flex: 1 },

  // ----- P2 — Per-card sparkline + percentile -----
  cardSparklineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  percentileText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  headerSparkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  headerPercentile: {
    fontSize: 11,
    color: "rgba(255,255,255,0.82)",
    fontWeight: "600",
  },

  // ----- Hero alert card -----
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.cardBg,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  heroIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  heroMessage: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "600",
    lineHeight: 17,
  },
  heroCtaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  heroCtaText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ----- Bundle-level error banner -----
  bundleErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    marginBottom: 12,
  },
  bundleErrorText: {
    flex: 1,
    fontSize: 12,
    color: colors.errorText,
    fontWeight: "500",
  },
  bundleRetryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.errorText,
  },
  bundleRetryText: {
    fontSize: 11,
    color: colors.errorText,
    fontWeight: "700",
  },

  // ----- Header / consolidated XnScore card -----
  headerCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  headerEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerEyebrow: {
    color: colors.textOnNavy,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  headerXnLabel: {
    color: colors.textOnNavy,
    fontSize: 13,
    marginBottom: 2,
  },
  headerScoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
  },
  headerScoreNumber: {
    color: colors.textWhite,
    fontSize: 44,
    fontWeight: "700",
  },
  headerScoreOutOf: {
    color: colors.textOnNavy,
    fontSize: 14,
    fontWeight: "500",
  },
  headerScoreSubtitle: {
    color: colors.textOnNavy,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  headerDeltaText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  headerDirectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
    alignSelf: "center",
  },
  headerDirectionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textOnNavy,
    letterSpacing: 0.3,
  },
  headerStatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.15)",
  },
  headerStatLabel: {
    fontSize: 12,
    color: colors.textOnNavy,
    fontWeight: "500",
  },
  headerStatValue: {
    fontSize: 13,
    color: colors.textWhite,
    fontWeight: "700",
  },
  headerLinkRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  headerLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  headerLinkText: {
    fontSize: 12,
    color: colors.textWhite,
    fontWeight: "600",
  },

  // ----- Feature card shell -----
  featureCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  featureDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  featureStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  featureStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  featureBody: { marginTop: 12 },
  featureCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.screenBg,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 12,
  },
  featureCtaText: {
    color: colors.primaryNavy,
    fontSize: 13,
    fontWeight: "600",
  },

  // ----- Shared body label -----
  bodyLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },

  // ----- Gauge -----
  gaugeRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  gaugeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gaugeLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  gaugeScore: {
    fontSize: 22,
    fontWeight: "700",
  },
  gaugeOutOf: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  gaugeBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  gaugeBarFill: {
    height: "100%",
    borderRadius: 4,
  },

  // ----- Direction badge (inline ↑/↓ better) -----
  directionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.screenBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  directionBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  // ----- Inline delta line under gauge -----
  deltaInline: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: -2,
    marginBottom: 10,
  },

  // ----- Trademark superscript -----
  headerXnTm: {
    fontSize: 9,
    color: colors.textOnNavy,
  },

  // ----- Trend row -----
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  trendLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  trendValue: {
    fontSize: 12,
    fontWeight: "700",
  },

  // ----- Stress/Mood inline rows -----
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.screenBg,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  inlineRowText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: "500",
  },

  // ----- Per-card loading + error -----
  cardLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
  },
  cardLoadingText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: "italic",
  },
  cardErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
  },
  cardErrorText: {
    flex: 1,
    fontSize: 12,
    color: colors.errorText,
    fontWeight: "500",
  },
  cardRetryBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.cardBg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.errorText,
  },
  cardRetryText: {
    fontSize: 11,
    color: colors.errorText,
    fontWeight: "700",
  },

  // ----- AI tagline card -----
  aiTaglineCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.tealTintBg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  aiTaglineText: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    fontStyle: "italic",
  },

  // ----- First-visit modal -----
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
  },
  modalIcon: { marginBottom: 12 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: 14,
    textAlign: "center",
  },
  modalBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 18,
  },
  // ----- Bucket B — single-slide tile grid -----
  modalTileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 16,
    rowGap: 10,
  },
  modalTile: {
    width: "48%",
    backgroundColor: colors.screenBg,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalTileIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTileLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textPrimary,
    flex: 1,
  },
  modalPrimaryBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.accentTeal,
  },
  modalPrimaryText: {
    fontSize: 13,
    color: colors.textWhite,
    fontWeight: "700",
  },
});
