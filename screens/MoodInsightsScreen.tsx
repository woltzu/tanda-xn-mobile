import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Switch,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import {
  useMoodScore,
  useMoodIntervention,
  useMoodActions,
  type MoodTier,
  type MoodTrend,
  type MoodSignalBreakdown,
} from "../hooks/useContributionMoodDetection";
import { ContributionMoodDetectionEngine } from "../services/ContributionMoodDetectionEngine";
import { useAuth } from "../context/AuthContext";

// ─── Status config ───────────────────────────────────────────────────────────

// Mood Bucket A — STATUS_CONFIG keeps only visual data (colors + emoji).
// The human label is read inline at render via t('mood_insights.tier_<key>').
const STATUS_CONFIG: Record<
  MoodTier,
  { color: string; bgColor: string; emoji: string }
> = {
  stable:      { color: "#22C55E", bgColor: "#22C55E1A", emoji: "\u{1F60A}" },
  drifting:    { color: "#EAB308", bgColor: "#EAB3081A", emoji: "\u{1F610}" },
  disengaging: { color: "#F97316", bgColor: "#F973161A", emoji: "\u{1F614}" },
  at_risk:     { color: "#EF4444", bgColor: "#EF44441A", emoji: "\u{1F198}" },
};

// Mood Bucket A — trend visuals. The icon + color carry the meaning;
// the text label is read via t('mood_insights.trend_<key>').
// Mood is higher-is-worse like Stress, so the "improving" trend uses a
// down arrow (the score going down is what we want).
const TREND_CONFIG: Record<NonNullable<MoodTrend>, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = {
  improving: { icon: "trending-down", color: "#22C55E" },
  stable:    { icon: "remove-outline", color: "#9CA3AF" },
  worsening: { icon: "trending-up",   color: "#EF4444" },
};

// ─── Signal display mapping ──────────────────────────────────────────────────

type SignalKey = keyof MoodSignalBreakdown;

// Mood Bucket A — SIGNAL_META keeps only the icon + canonical key list;
// the localized name + weight label are produced at render via t().
const SIGNAL_META: Record<SignalKey, { icon: keyof typeof Ionicons.glyphMap }> = {
  polarity: { icon: "chatbubble-ellipses-outline" },
  lexical:  { icon: "library-outline" },
  keyword:  { icon: "alert-circle-outline" },
  latency:  { icon: "time-outline" },
  length:   { icon: "text-outline" },
};

// Mood Bucket A — each top-signal key maps to a suggested next step.
// Routes are resolved on tap (navigation.navigate). DreamFeed covers
// the reflective surfaces; Community covers engagement; HelpCenter is
// the support escalation; Circles is where prompt responses land.
type RouteName = "DreamFeed" | "Community" | "HelpCenter" | "Circles";
const SUGGESTION_ROUTE: Record<SignalKey, RouteName> = {
  polarity: "DreamFeed",
  keyword:  "HelpCenter",
  latency:  "Circles",
  lexical:  "Community",
  length:   "Community",
};

function getBarColor(value: number): string {
  if (value > 50) return "#F97316";
  if (value > 30) return "#EAB308";
  return "#22C55E";
}

function getSentimentColor(score: number): string {
  if (score > 50) return "#F97316";
  if (score > 30) return "#EAB308";
  return "#22C55E";
}

// Mood Bucket A — locale-aware short date for the recent-sentiment
// timeline. Replaces the inline US-only formatter.
function formatDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString();
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MoodInsightsScreen() {
  const navigation = useNavigation<any>();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const {
    currentSnapshot,
    history,
    baseline,
    tier,
    trend,
    loading: scoreLoading,
    refresh: refreshScore,
  } = useMoodScore();
  const {
    activeIntervention,
    loading: interventionLoading,
    refresh: refreshIntervention,
  } = useMoodIntervention();
  const { setOptOut, acceptIntervention, declineIntervention, responding } = useMoodActions();

  const [optedOut, setOptedOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loading = scoreLoading || interventionLoading;

  // Mood Bucket A — read the real opt-out state from
  // member_mood_preferences on mount. Previously the toggle started at
  // `false` and silently lied to a user who had opted out on another
  // device or in a prior session.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    ContributionMoodDetectionEngine.getOptOut(user.id)
      .then((v) => { if (!cancelled) setOptedOut(v); })
      .catch(() => {
        // Engine read failed — keep the default (analysis enabled).
        // setOptOut is still wired so a user can toggle from here.
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshScore(), refreshIntervention()]);
    setRefreshing(false);
  }, [refreshScore, refreshIntervention]);

  const handleOptToggle = useCallback(async (value: boolean) => {
    // The Switch is "analysis ON" oriented (value=true means analysing).
    // Internal state tracks the negation (optedOut). Optimistic update
    // with revert-on-error matches the prior behaviour.
    const newOptedOut = !value;
    setOptedOut(newOptedOut);
    try {
      await setOptOut(newOptedOut);
    } catch {
      setOptedOut(!newOptedOut);
    }
  }, [setOptOut]);

  // Mood Bucket A — Bucket B will replace this with a real HelpSheet.
  // The placeholder Alert kills the dead-button bug without forking copy.
  const handleHelpPress = useCallback(() => {
    Alert.alert(
      t("mood_insights.help_placeholder_title"),
      t("mood_insights.help_placeholder_body"),
    );
  }, [t]);

  const config = STATUS_CONFIG[tier];
  const score = currentSnapshot?.compositeMoodScore ?? 0;
  const scoreDelta = currentSnapshot?.scoreDelta ?? 0;
  const trendKey = (currentSnapshot?.trend ?? "stable") as NonNullable<MoodTrend>;
  const trendCfg = TREND_CONFIG[trendKey];
  const signals = currentSnapshot?.signalBreakdown;
  // Precedence fix (kept from prior code): `a ?? 0 + b ?? 0` parses as
  // `a ?? (0 + b) ?? 0`. Parenthesize each `?? 0` independently.
  const baselineScore = baseline?.isEstablished
    ? Math.round(
        ((baseline.baselinePolarity ?? 0) + (baseline.baselineLexical ?? 0)) / 2
      )
    : null;

  // Mood Bucket A — top signal: highest weighted_value across the 5
  // signals. Used by the prominent card above the breakdown AND by the
  // suggestions section when no active intervention exists.
  const topSignal = useMemo<{ key: SignalKey; normalized: number; weighted: number } | null>(() => {
    if (!signals) return null;
    const entries = (Object.keys(SIGNAL_META) as SignalKey[])
      .map((k) => {
        const s = signals[k];
        if (!s) return null;
        return {
          key: k,
          normalized: s.normalized ?? 0,
          // Some snapshots carry a `weightedValue`; fall back to
          // normalized × weight when not present.
          weighted: (s as any).weightedValue ?? ((s.normalized ?? 0) * (s.weight ?? 0)),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b.weighted - a.weighted)[0];
  }, [signals]);

  // Mood Bucket A — placeholder for the top-signal explainer. Bucket B
  // replaces this with the per-signal SignalExplainerSheet.
  const handleTopSignalDetails = useCallback(() => {
    if (!topSignal) return;
    Alert.alert(
      t(`mood_insights.signal_${topSignal.key}_name`),
      t("mood_insights.help_placeholder_body"),
    );
  }, [t, topSignal]);

  // ─── Loading state ─────────────────────────────────────────────────────────

  if (loading && !currentSnapshot) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={styles.loadingText}>{t("mood_insights.loading")}</Text>
      </View>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient colors={[NAVY, "#0D2B50"]} style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("mood_insights.header_title")}</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleHelpPress}
          accessibilityRole="button"
          accessibilityLabel={t("mood_insights.help_placeholder_title")}
        >
          <Ionicons name="shield-checkmark" size={24} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Privacy Banner — Bucket A i18n. Bucket B adds the longer
          "What we measure (and what we don't)" disclosure as a
          tappable footer note. */}
      <View style={styles.privacyBanner}>
        <Ionicons name="lock-closed" size={14} color={TEAL} />
        <Text style={styles.privacyText}>{t("mood_insights.privacy_banner")}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
        }
      >
        {/* Main Mood Card OR Empty State */}
        {currentSnapshot ? (
          <View style={styles.card}>
            <View style={styles.moodCardInner}>
              <Text style={styles.moodEmoji}>{config.emoji}</Text>
              <Text style={styles.moodLabel}>{t("mood_insights.label_drift_score")}</Text>
              <View style={styles.scoreRow}>
                <Text style={[styles.scoreValue, { color: config.color }]}>
                  {Math.round(score)}
                </Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>

              {/* Mood Bucket A — direction subtitle. Mood is higher-is-
                  worse like Stress; without this line a first-time user
                  sees the number and the cheerful default emoji and
                  may not realise the direction. */}
              <Text style={styles.directionSubtitle}>
                {t("mood_insights.higher_worse_subtitle")}
              </Text>

              <View style={[styles.statusPill, { backgroundColor: config.bgColor }]}>
                <View style={[styles.statusDot, { backgroundColor: config.color }]} />
                <Text style={[styles.statusLabel, { color: config.color }]}>
                  {t(`mood_insights.tier_${tier}`)}
                </Text>
              </View>

              {/* Mood Bucket A — trend chip with arrow + delta.
                  Previously the trend value from the hook went
                  unrendered entirely. */}
              <View style={styles.trendContainer}>
                <View style={styles.trendRow}>
                  <Ionicons name={trendCfg.icon} size={16} color={trendCfg.color} />
                  <Text style={[styles.trendDelta, { color: trendCfg.color }]}>
                    {t("mood_insights.delta_from_last", {
                      arrow: scoreDelta > 0 ? "↑" : scoreDelta < 0 ? "↓" : "→",
                      pts: Math.abs(scoreDelta),
                    })}
                  </Text>
                </View>
                <Text style={styles.trendMessage}>
                  {t(`mood_insights.trend_${trendKey}`)}
                </Text>
              </View>

              {baselineScore !== null && (
                <Text style={styles.baselineText}>
                  {t("mood_insights.baseline_line", { score: baselineScore })}
                </Text>
              )}
            </View>
          </View>
        ) : (
          // Mood Bucket A — explicit empty state. Replaces the
          // misleading "0 / 100 😊 Feeling Good" default that
          // rendered for users with no snapshot row.
          <View style={[styles.card, styles.emptyCard]}>
            <Ionicons name="heart-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>{t("mood_insights.empty_title")}</Text>
            <Text style={styles.emptyBody}>{t("mood_insights.empty_body")}</Text>
          </View>
        )}

        {/* Mood Bucket A — Top signal card. Surfaced above the equal-
            weight breakdown so the user knows what's driving their
            mood drift. Skipped on the empty state. */}
        {currentSnapshot && topSignal ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleTopSignalDetails}
            style={[styles.card, styles.topSignalCard]}
          >
            <View style={styles.topSignalHeader}>
              <View
                style={[
                  styles.topSignalIconWrap,
                  { backgroundColor: getBarColor(topSignal.normalized) + "1F" },
                ]}
              >
                <Ionicons
                  name={SIGNAL_META[topSignal.key].icon}
                  size={22}
                  color={getBarColor(topSignal.normalized)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topSignalEyebrow}>
                  {t("mood_insights.top_signal_title")}
                </Text>
                <Text style={styles.topSignalName}>
                  {t(`mood_insights.signal_${topSignal.key}_name`)}
                </Text>
              </View>
              <Text
                style={[
                  styles.topSignalValue,
                  { color: getBarColor(topSignal.normalized) },
                ]}
              >
                {Math.round(topSignal.normalized)}
              </Text>
            </View>
            <Text style={styles.topSignalBody}>
              {t("mood_insights.top_signal_body")}
            </Text>
            <View style={styles.topSignalCta}>
              <Text style={styles.topSignalCtaText}>
                {t("mood_insights.top_signal_view_details")}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={TEAL} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Signal Breakdown */}
        {signals && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("mood_insights.section_noticing")}</Text>
            <Text style={styles.sectionSubtitle}>
              {t("mood_insights.section_noticing_subtitle")}
            </Text>

            {(Object.keys(SIGNAL_META) as SignalKey[]).map((key) => {
              const signal = signals[key];
              const meta = SIGNAL_META[key];
              const normalized = signal.normalized ?? 0;
              const weight = signal.weight ?? 0;

              return (
                <View key={key} style={styles.signalCard}>
                  <View style={styles.signalIconWrap}>
                    <Ionicons name={meta.icon} size={18} color={NAVY} />
                  </View>
                  <View style={styles.signalLeft}>
                    <Text style={styles.signalLabel}>
                      {t(`mood_insights.signal_${key}_name`)}
                    </Text>
                    <Text style={styles.signalWeight}>
                      {t("mood_insights.signal_weight_label", { pct: Math.round(weight * 100) })}
                    </Text>
                  </View>
                  <View style={styles.signalBarTrack}>
                    <View
                      style={[
                        styles.signalBarFill,
                        {
                          width: `${Math.min(normalized, 100)}%`,
                          backgroundColor: getBarColor(normalized),
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.signalValue}>{Math.round(normalized)}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Mood Bucket A — Suggestions when no active intervention.
            The user who's drifting (but not yet escalated to an
            offered intervention) used to see nothing actionable;
            now we lead with a top-signal-driven next step. */}
        {currentSnapshot && !activeIntervention && topSignal ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("mood_insights.suggestions_title")}
            </Text>
            <Text style={styles.sectionSubtitle}>
              {t("mood_insights.suggestions_subtitle")}
            </Text>
            <TouchableOpacity
              style={[styles.card, styles.suggestionCard]}
              onPress={() => {
                const route = SUGGESTION_ROUTE[topSignal.key] ?? "Community";
                navigation.navigate(route as any);
              }}
              activeOpacity={0.85}
            >
              <View style={styles.suggestionHeader}>
                <View
                  style={[
                    styles.signalIconWrap,
                    { backgroundColor: "rgba(0,198,174,0.12)" },
                  ]}
                >
                  <Ionicons
                    name={SIGNAL_META[topSignal.key].icon}
                    size={20}
                    color={TEAL}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionTitle}>
                    {t(`mood_insights.suggestion_${topSignal.key}_title`)}
                  </Text>
                  <Text style={styles.suggestionBody}>
                    {t(`mood_insights.suggestion_${topSignal.key}_body`)}
                  </Text>
                </View>
              </View>
              <View style={styles.suggestionCta}>
                <Text style={styles.suggestionCtaText}>
                  {t(`mood_insights.suggestion_${topSignal.key}_cta`)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={TEAL} />
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Recent Sentiment Timeline */}
        {history.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("mood_insights.section_recent_sentiment")}</Text>
            <View style={styles.card}>
              {history.slice(0, 6).map((snap, i) => {
                const isLast = i === Math.min(history.length, 6) - 1;
                return (
                  <View
                    key={snap.id}
                    style={[
                      styles.timelineRow,
                      !isLast && styles.timelineRowBorder,
                    ]}
                  >
                    <Text style={styles.timelineDate}>
                      {formatDate(snap.snapshotDate, i18n.language)}
                    </Text>
                    <View
                      style={[
                        styles.sentimentDot,
                        { backgroundColor: getSentimentColor(snap.compositeMoodScore) },
                      ]}
                    />
                    <Text style={styles.timelineMood}>
                      {t(`mood_insights.tier_${snap.tier}`)}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Intervention Card */}
        {activeIntervention && !optedOut && (
          <View style={styles.section}>
            <View style={styles.interventionCard}>
              <Ionicons name="heart" size={28} color={TEAL} />
              <Text style={styles.interventionTitle}>
                {activeIntervention.messageTitle}
              </Text>
              <Text style={styles.interventionBody}>
                {activeIntervention.messageBody}
              </Text>
              <View style={styles.interventionActions}>
                <TouchableOpacity
                  style={styles.interventionBtnSecondary}
                  disabled={responding}
                  onPress={() => declineIntervention(activeIntervention.id)}
                >
                  <Text style={styles.interventionBtnSecondaryText}>
                    {t("mood_insights.intervention_decline")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.interventionBtnPrimary}
                  disabled={responding}
                  onPress={() => acceptIntervention(activeIntervention.id)}
                >
                  <Text style={styles.interventionBtnPrimaryText}>
                    {t("mood_insights.intervention_accept_elder")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Opt-Out Toggle */}
        <View style={[styles.card, styles.optOutCard]}>
          <View style={styles.optOutLeft}>
            <Text style={styles.optOutTitle}>{t("mood_insights.opt_out_title")}</Text>
            <Text style={styles.optOutSub}>
              {optedOut
                ? t("mood_insights.opt_out_on_sub")
                : t("mood_insights.opt_out_off_sub")}
            </Text>
          </View>
          <Switch
            value={!optedOut}
            onValueChange={handleOptToggle}
            trackColor={{ false: "#D1D5DB", true: TEAL }}
            thumbColor="#FFF"
            accessibilityRole="switch"
            accessibilityLabel={t("mood_insights.opt_out_title")}
          />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BG = "#F5F7FA";
const MUTED = "#6B7280";

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  loadingContainer: { flex: 1, backgroundColor: BG, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: MUTED },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerBtn: { padding: 4, borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#FFF" },

  // Privacy Banner
  privacyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TEAL + "1A",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  privacyText: { fontSize: 12, fontWeight: "500", color: TEAL, flex: 1 },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32, gap: 24 },

  // Cards
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },

  // Main Mood Card
  moodCardInner: { alignItems: "center", padding: 24 },
  moodEmoji: { fontSize: 48, marginBottom: 8 },
  moodLabel: { fontSize: 13, color: MUTED, marginBottom: 4 },
  scoreRow: { flexDirection: "row", alignItems: "baseline" },
  scoreValue: { fontSize: 48, fontWeight: "800" },
  scoreMax: { fontSize: 18, color: MUTED, marginLeft: 4 },

  // Bucket A — direction subtitle under the score number.
  directionSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: MUTED,
    fontStyle: "italic",
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 14, fontWeight: "600" },

  // Bucket A — trend chip below the status pill.
  trendContainer: { alignItems: "center", marginTop: 12, gap: 2 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  trendDelta: { fontSize: 13, fontWeight: "600" },
  trendMessage: { fontSize: 12, color: MUTED },

  baselineText: { marginTop: 12, fontSize: 12, color: MUTED },

  // Bucket A — empty-state card (no snapshot row yet).
  emptyCard: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 24, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: NAVY, marginTop: 6, textAlign: "center" },
  emptyBody: { fontSize: 13, color: MUTED, textAlign: "center", lineHeight: 18 },

  // Bucket A — top-signal card. Teal-tinted border to distinguish
  // from the breakdown rows below it.
  topSignalCard: { borderWidth: 1, borderColor: TEAL + "33", padding: 16, gap: 10 },
  topSignalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  topSignalIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topSignalEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  topSignalName: { fontSize: 16, fontWeight: "700", color: NAVY, marginTop: 2 },
  topSignalValue: { fontSize: 22, fontWeight: "800" },
  topSignalBody: { fontSize: 13, color: MUTED, lineHeight: 18 },
  topSignalCta: { flexDirection: "row", alignItems: "center", gap: 4 },
  topSignalCtaText: { fontSize: 13, fontWeight: "700", color: TEAL },

  // Sections
  section: { gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: NAVY },
  sectionSubtitle: { fontSize: 13, color: MUTED, marginBottom: 4 },

  // Signal breakdown
  signalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  signalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  signalLeft: { width: 110 },
  signalLabel: { fontSize: 13, fontWeight: "600", color: NAVY },
  signalWeight: { fontSize: 11, color: MUTED, marginTop: 2 },
  signalBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "#E5E7EB", overflow: "hidden" },
  signalBarFill: { height: "100%", borderRadius: 3 },
  signalValue: { width: 32, textAlign: "right", fontSize: 14, fontWeight: "700", color: NAVY },

  // Bucket A — suggestion card (rendered when no active intervention).
  suggestionCard: { borderWidth: 1, borderColor: "rgba(0,198,174,0.2)", padding: 14, gap: 12 },
  suggestionHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  suggestionTitle: { fontSize: 15, fontWeight: "700", color: NAVY, marginBottom: 2 },
  suggestionBody: { fontSize: 13, color: MUTED, lineHeight: 18 },
  suggestionCta: { flexDirection: "row", alignItems: "center", gap: 4 },
  suggestionCtaText: { fontSize: 13, fontWeight: "700", color: TEAL },

  // Timeline
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  timelineRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB" },
  timelineDate: { width: 48, fontSize: 13, color: MUTED },
  sentimentDot: { width: 10, height: 10, borderRadius: 5 },
  timelineMood: { flex: 1, fontSize: 14, color: NAVY },

  // Intervention
  interventionCard: {
    alignItems: "center",
    padding: 20,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: TEAL + "33",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  interventionTitle: { marginTop: 8, fontSize: 18, fontWeight: "700", color: NAVY },
  interventionBody: { marginTop: 6, textAlign: "center", fontSize: 14, lineHeight: 22, color: MUTED },
  interventionActions: { marginTop: 16, width: "100%", gap: 8 },
  interventionBtnPrimary: { backgroundColor: TEAL, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  interventionBtnPrimaryText: { color: "#FFF", fontWeight: "600", fontSize: 15 },
  interventionBtnSecondary: { backgroundColor: "#F3F4F6", borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  interventionBtnSecondaryText: { color: NAVY, fontWeight: "600", fontSize: 15 },

  // Opt-out
  optOutCard: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16, marginBottom: 8 },
  optOutLeft: { flex: 1 },
  optOutTitle: { fontSize: 15, fontWeight: "600", color: NAVY },
  optOutSub: { fontSize: 12, color: MUTED, marginTop: 2 },
});
