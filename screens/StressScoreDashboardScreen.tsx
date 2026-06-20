import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useStressScore, useStressIntervention } from "../hooks/useFinancialStressPrediction";
import { useStressActions } from "../hooks/useFinancialStressPrediction";
import type { StressStatus, StressTrend, SignalBreakdown } from "../hooks/useFinancialStressPrediction";

// ─── Constants ───────────────────────────────────────────────────────────────

const NAVY = "#0A2342";
const TEAL = "#00C6AE";
const BG = "#F5F7FA";

// Bucket A \u2014 STATUS_CONFIG now carries only visual data; the human label
// is read inline at render via t('stress_score.status_<key>').
const STATUS_CONFIG: Record<StressStatus, { color: string; bg: string }> = {
  green: { color: "#10B981", bg: "rgba(16,185,129,0.1)" },
  yellow: { color: "#EAB308", bg: "rgba(234,179,8,0.1)" },
  orange: { color: "#F97316", bg: "rgba(249,115,22,0.1)" },
  red: { color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
};

// Bucket A \u2014 same pattern. Icon + color stay in the constant; the
// "Getting better!" / "Holding steady" / "Needs attention" message
// is t('stress_score.trend_<key>') at render.
const TREND_CONFIG: Record<NonNullable<StressTrend>, {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = {
  improving: { icon: "trending-down", color: "#10B981" },
  stable:    { icon: "remove-outline", color: "#9CA3AF" },
  worsening: { icon: "trending-up",   color: "#EF4444" },
};

type SignalKey = keyof SignalBreakdown;

// Bucket A \u2014 SIGNAL_META keeps numeric weight + icon; the localized
// name + weight label are produced at render via
// t('stress_score.signal_<key>_name') and the shared signal_weight_label.
const SIGNAL_META: Record<SignalKey, { weight: number; icon: keyof typeof Ionicons.glyphMap }> = {
  contribution_delay:   { weight: 30, icon: "time-outline" },
  ticket_language:      { weight: 35, icon: "chatbubble-outline" },
  login_drop:           { weight: 20, icon: "log-in-outline" },
  early_payout_request: { weight: 15, icon: "cash-outline" },
};

// Bucket A \u2014 each top-stressor key maps to a suggested next step.
// Routes are resolved on tap. Wallet covers contribution timing; the
// Help Center owns support flows; AdvanceHubV2 handles the liquidity
// advance path; Home is the "open the app more often" landing.
type RouteName =
  | "WalletMain"
  | "HelpCenter"
  | "Home"
  | "MakeContribution"
  | "AdvanceHubV2";
const SUGGESTION_ROUTE: Record<SignalKey, RouteName> = {
  contribution_delay:   "WalletMain",
  ticket_language:      "HelpCenter",
  login_drop:           "Home",
  early_payout_request: "AdvanceHubV2",
};

function getSignalStatus(value: number): StressStatus {
  if (value <= 30) return "green";
  if (value <= 60) return "yellow";
  if (value <= 80) return "orange";
  return "red";
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function StressScoreDashboardScreen() {
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const {
    currentScore, history, stressLevel, isAtRisk, trend,
    loading: scoreLoading, refresh: refreshScore,
  } = useStressScore();
  const {
    activeIntervention, hasActiveIntervention,
    loading: interventionLoading, refresh: refreshIntervention,
  } = useStressIntervention();
  const { acceptIntervention, declineIntervention, responding } = useStressActions();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refreshScore(), refreshIntervention()]);
    setRefreshing(false);
  }, [refreshScore, refreshIntervention]);

  const loading = scoreLoading && interventionLoading;

  // Derived values
  const status = (currentScore?.status ?? "green") as StressStatus;
  const score = currentScore?.stressScore ?? 0;
  const scoreDelta = currentScore?.scoreDelta ?? 0;
  const trendKey = (currentScore?.trend ?? "stable") as NonNullable<StressTrend>;
  const breakdown = currentScore?.signalBreakdown;
  const cfg = STATUS_CONFIG[status];
  const trendCfg = TREND_CONFIG[trendKey];

  // Bucket A — top stressor: highest weighted_value across the 4
  // signals. Used by the prominent card above the breakdown AND by
  // the suggestions section when no active intervention exists.
  const topStressor = useMemo<{ key: SignalKey; value: number; weighted: number } | null>(() => {
    if (!breakdown) return null;
    const entries = (Object.keys(SIGNAL_META) as SignalKey[])
      .map((k) => {
        const c = breakdown[k];
        return c ? { key: k, value: c.raw_value, weighted: c.weighted_value } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    if (entries.length === 0) return null;
    return entries.sort((a, b) => b.weighted - a.weighted)[0];
  }, [breakdown]);

  // Bucket A — placeholder Alert for the (?) header button.
  // Bucket B replaces this with a real HelpSheet.
  const handleHelpPress = useCallback(() => {
    Alert.alert(
      t("stress_score.help_placeholder_title"),
      t("stress_score.help_placeholder_body"),
    );
  }, [t]);

  // Bucket A — view details placeholder for the top-stressor card.
  // Bucket B wires this to the per-signal explainer sheet.
  const handleTopStressorDetails = useCallback(() => {
    if (!topStressor) return;
    Alert.alert(
      t(`stress_score.signal_${topStressor.key}_name`),
      t("stress_score.help_placeholder_body"),
    );
  }, [t, topStressor]);

  // Chart data from history
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return null;
    const CHART_W = Dimensions.get("window").width - 64;
    const CHART_H = 120;
    const scores = history.slice().reverse(); // oldest first
    const points = scores.map((s, i) => ({
      x: scores.length === 1 ? CHART_W / 2 : (i / (scores.length - 1)) * CHART_W,
      y: CHART_H - (s.stressScore / 100) * CHART_H,
      score: s.stressScore,
    }));
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return { points, pathD, width: CHART_W, height: CHART_H };
  }, [history]);

  // ─── Loading State ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={TEAL} />
        <Text style={styles.loadingText}>{t("stress_score.loading")}</Text>
      </View>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAccept = async () => {
    if (!activeIntervention) return;
    try {
      await acceptIntervention(activeIntervention.id);
      refreshIntervention();
    } catch (err) {
      console.error("Accept intervention error:", err);
    }
  };

  const handleDecline = async () => {
    if (!activeIntervention) return;
    try {
      await declineIntervention(activeIntervention.id);
      refreshIntervention();
    } catch (err) {
      console.error("Decline intervention error:", err);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("stress_score.header_title")}</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={handleHelpPress}>
          <Ionicons name="information-circle-outline" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
        }
      >
        {/* ── Main Score Card ── */}
        {currentScore ? (
          <View style={styles.card}>
            <Text style={styles.scoreLabel}>{t("stress_score.score_label")}</Text>

            <View style={styles.scoreRow}>
              <Text style={[styles.scoreValue, { color: cfg.color }]}>{score}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>

            {/* Bucket A — direction subtitle. The #1 misread risk on
                this screen: a fresh user sees the number and the
                green trend arrow and may think "lower is worse".
                This line eliminates the ambiguity. */}
            <Text style={styles.directionSubtitle}>
              {t("stress_score.higher_worse_subtitle")}
            </Text>

            {/* Status badge */}
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
              <Text style={[styles.statusText, { color: cfg.color }]}>
                {t(`stress_score.status_${status}`)}
              </Text>
            </View>

            {/* Trend — Bucket A uses arrows (↑/↓) instead of +/− to
                avoid the "+5" reading-as-good ambiguity. */}
            <View style={styles.trendContainer}>
              <View style={styles.trendRow}>
                <Ionicons name={trendCfg.icon} size={16} color={trendCfg.color} />
                <Text style={[styles.trendDelta, { color: trendCfg.color }]}>
                  {t("stress_score.delta_from_last", {
                    arrow: scoreDelta > 0 ? "↑" : scoreDelta < 0 ? "↓" : "→",
                    pts: Math.abs(scoreDelta),
                  })}
                </Text>
              </View>
              <Text style={styles.trendMessage}>{t(`stress_score.trend_${trendKey}`)}</Text>
            </View>
          </View>
        ) : (
          // Bucket A — empty state when there's no stress score row yet.
          // The user just installed, or hasn't generated any signals.
          <View style={[styles.card, styles.emptyCard]}>
            <Ionicons name="heart-outline" size={36} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>{t("stress_score.empty_title")}</Text>
            <Text style={styles.emptyBody}>{t("stress_score.empty_state")}</Text>
          </View>
        )}

        {/* Bucket A — Top stressor card. Surfaced above the equal-weight
            breakdown so the user knows where to focus first. Skipped
            entirely on the empty state, when no breakdown exists. */}
        {currentScore && topStressor ? (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleTopStressorDetails}
            style={[styles.card, styles.topStressorCard]}
          >
            <View style={styles.topStressorHeader}>
              <View
                style={[
                  styles.topStressorIconWrap,
                  { backgroundColor: STATUS_CONFIG[getSignalStatus(topStressor.value)].bg },
                ]}
              >
                <Ionicons
                  name={SIGNAL_META[topStressor.key].icon}
                  size={22}
                  color={STATUS_CONFIG[getSignalStatus(topStressor.value)].color}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topStressorEyebrow}>
                  {t("stress_score.top_stressor_title")}
                </Text>
                <Text style={styles.topStressorName}>
                  {t(`stress_score.signal_${topStressor.key}_name`)}
                </Text>
              </View>
              <Text
                style={[
                  styles.topStressorValue,
                  { color: STATUS_CONFIG[getSignalStatus(topStressor.value)].color },
                ]}
              >
                {Math.round(topStressor.value)}
              </Text>
            </View>
            <Text style={styles.topStressorBody}>
              {t("stress_score.top_stressor_body")}
            </Text>
            <View style={styles.topStressorCta}>
              <Text style={styles.topStressorCtaText}>
                {t("stress_score.top_stressor_view_details")}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={TEAL} />
            </View>
          </TouchableOpacity>
        ) : null}

        {/* ── Signal Breakdown ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("stress_score.section_contributing")}</Text>
          <Text style={styles.sectionSubtitle}>
            {t("stress_score.section_contributing_subtitle")}
          </Text>

          {breakdown &&
            (Object.keys(SIGNAL_META) as SignalKey[]).map((key) => {
              const meta = SIGNAL_META[key];
              const component = breakdown[key];
              if (!component) return null;
              const sigStatus = getSignalStatus(component.raw_value);
              const sigColor = STATUS_CONFIG[sigStatus].color;

              return (
                <View key={key} style={styles.card}>
                  <View style={styles.signalHeader}>
                    <View style={styles.signalIconWrap}>
                      <Ionicons name={meta.icon} size={20} color={sigColor} />
                    </View>
                    <View style={styles.signalInfo}>
                      <Text style={styles.signalName}>
                        {t(`stress_score.signal_${key}_name`)}
                      </Text>
                      <Text style={styles.signalWeight}>
                        {t("stress_score.signal_weight_label", { pct: meta.weight })}
                      </Text>
                    </View>
                    <Text style={[styles.signalValue, { color: sigColor }]}>
                      {Math.round(component.raw_value)}
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${Math.min(component.raw_value, 100)}%`, backgroundColor: sigColor },
                      ]}
                    />
                  </View>

                  <Text style={styles.signalDetail}>
                    {t("stress_score.signal_detail", {
                      count: component.signals_used,
                      value: component.weighted_value.toFixed(1),
                    })}
                  </Text>
                </View>
              );
            })}
        </View>

        {/* Bucket A \u2014 Suggestions when there's no active intervention.
            The user with a 78 stress score used to see nothing
            actionable here; now we lead with the top-stressor-driven
            next step and link to the right surface. */}
        {currentScore && !hasActiveIntervention && topStressor ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("stress_score.suggestions_title")}</Text>
            <Text style={styles.sectionSubtitle}>{t("stress_score.suggestions_subtitle")}</Text>
            <TouchableOpacity
              style={[styles.card, styles.suggestionCard]}
              onPress={() => {
                const route = SUGGESTION_ROUTE[topStressor.key] ?? "WalletMain";
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
                    name={SIGNAL_META[topStressor.key].icon}
                    size={20}
                    color={TEAL}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestionTitle}>
                    {t(`stress_score.suggestion_${topStressor.key}_title`)}
                  </Text>
                  <Text style={styles.suggestionBody}>
                    {t(`stress_score.suggestion_${topStressor.key}_body`)}
                  </Text>
                </View>
              </View>
              <View style={styles.suggestionCta}>
                <Text style={styles.suggestionCtaText}>
                  {t(`stress_score.suggestion_${topStressor.key}_cta`)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={TEAL} />
              </View>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Intervention Offer ── */}
        {hasActiveIntervention && activeIntervention && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("stress_score.section_support")}</Text>

            <View style={[styles.card, styles.interventionCard]}>
              <View style={styles.interventionIconWrap}>
                <Ionicons name="heart" size={24} color={TEAL} />
              </View>
              <Text style={styles.interventionTitle}>{activeIntervention.messageTitle}</Text>
              <Text style={styles.interventionBody}>{activeIntervention.messageBody}</Text>

              {/* Installment preview */}
              {activeIntervention.installmentAmounts &&
                activeIntervention.installmentAmounts.length > 0 && (
                  <View style={styles.installmentBox}>
                    {activeIntervention.installmentAmounts.map((item: any, i: number) => (
                      <View key={i} style={styles.installmentRow}>
                        <Text style={styles.installmentLabel}>
                          {t("stress_score.installment_payment", { n: i + 1 })}
                        </Text>
                        <Text style={styles.installmentAmount}>
                          {typeof item === "number"
                            ? formatCents(item)
                            : item.amount ?? `$${item}`}
                        </Text>
                        {item.dueDate && (
                          <Text style={styles.installmentDate}>
                            {t("stress_score.installment_due", { date: item.dueDate })}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

              {/* Action buttons */}
              <View style={styles.interventionActions}>
                <TouchableOpacity
                  style={styles.acceptBtn}
                  onPress={handleAccept}
                  disabled={responding}
                >
                  {responding ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.acceptBtnText}>{t("stress_score.btn_accept")}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={handleDecline}
                  disabled={responding}
                >
                  <Text style={styles.declineBtnText}>{t("stress_score.btn_not_now")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ── Score History ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("stress_score.section_history")}</Text>
          <Text style={styles.sectionSubtitle}>{t("stress_score.chart_subtitle")}</Text>

          <View style={styles.card}>
            {chartData ? (
              <View style={styles.chartContainer}>
                <View style={{ width: chartData.width, height: chartData.height }}>
                  {/* Simple dot-line chart rendered with Views */}
                  {chartData.points.map((p, i) => {
                    const statusColor = STATUS_CONFIG[getSignalStatus(p.score)].color;
                    return (
                      <View
                        key={i}
                        style={[
                          styles.chartDot,
                          {
                            left: p.x - 4,
                            top: p.y - 4,
                            backgroundColor: statusColor,
                          },
                        ]}
                      />
                    );
                  })}
                  {/* Connecting lines */}
                  {chartData.points.map((p, i) => {
                    if (i === 0) return null;
                    const prev = chartData.points[i - 1];
                    const dx = p.x - prev.x;
                    const dy = p.y - prev.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                    return (
                      <View
                        key={`line-${i}`}
                        style={[
                          styles.chartLine,
                          {
                            left: prev.x,
                            top: prev.y - 1,
                            width: len,
                            transform: [{ rotate: `${angle}deg` }],
                            transformOrigin: "0 0",
                          },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text style={styles.emptyChart}>{t("stress_score.empty_chart")}</Text>
            )}
          </View>
        </View>

        {/* Bucket A — data-driven tips. Leads with the top stressor's
            tip, then the other 3 in their canonical order. Replaces
            the static 3-string TIPS array. Skipped if no breakdown. */}
        {currentScore && topStressor ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("stress_score.section_tips")}</Text>
            {[
              topStressor.key,
              ...((Object.keys(SIGNAL_META) as SignalKey[]).filter((k) => k !== topStressor.key)),
            ].map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.card}
                onPress={() => {
                  const route = SUGGESTION_ROUTE[key] ?? "WalletMain";
                  navigation.navigate(route as any);
                }}
                activeOpacity={0.85}
              >
                <View style={styles.tipRow}>
                  <View
                    style={[
                      styles.signalIconWrap,
                      { backgroundColor: "rgba(0,198,174,0.12)" },
                    ]}
                  >
                    <Ionicons
                      name={SIGNAL_META[key].icon}
                      size={18}
                      color={TEAL}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tipTitle}>
                      {t(`stress_score.tip_${key}_title`)}
                    </Text>
                    <Text style={styles.tipText}>
                      {t(`stress_score.tip_${key}_body`)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
  },

  // Header
  header: {
    backgroundColor: NAVY,
    paddingTop: 52,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Body
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Card
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },

  // Section
  section: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 14,
  },

  // Main Score
  scoreLabel: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginTop: 4,
  },
  scoreValue: {
    fontSize: 56,
    fontWeight: "800",
  },
  scoreMax: {
    fontSize: 20,
    color: "#9CA3AF",
    marginLeft: 2,
  },

  // Status badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
    marginTop: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Trend
  trendContainer: {
    alignItems: "center",
    marginTop: 14,
    gap: 2,
  },
  trendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trendDelta: {
    fontSize: 13,
    fontWeight: "600",
  },
  trendMessage: {
    fontSize: 12,
    color: "#9CA3AF",
  },

  // Signals
  signalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  signalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  signalInfo: {
    flex: 1,
  },
  signalName: {
    fontSize: 15,
    fontWeight: "600",
    color: NAVY,
  },
  signalWeight: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  signalValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  signalDetail: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 8,
  },

  // Intervention
  interventionCard: {
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.3)",
    alignItems: "center",
  },
  interventionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,198,174,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  interventionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: NAVY,
    textAlign: "center",
    marginBottom: 6,
  },
  interventionBody: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  installmentBox: {
    width: "100%",
    backgroundColor: "rgba(243,244,246,0.5)",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  installmentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  installmentLabel: {
    fontSize: 13,
    color: "#9CA3AF",
    flex: 1,
  },
  installmentAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: NAVY,
    flex: 1,
    textAlign: "center",
  },
  installmentDate: {
    fontSize: 13,
    color: "#9CA3AF",
    flex: 1,
    textAlign: "right",
  },
  interventionActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
    width: "100%",
  },
  acceptBtn: {
    flex: 1,
    backgroundColor: TEAL,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  declineBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtnText: {
    color: "#6B7280",
    fontSize: 15,
    fontWeight: "600",
  },

  // Chart
  chartContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  chartDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLine: {
    position: "absolute",
    height: 2,
    backgroundColor: "#EAB308",
  },
  emptyChart: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    paddingVertical: 24,
  },

  // Tips (Bucket A — tappable rows w/ icon + title + body)
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tipIcon: {
    marginTop: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: NAVY,
    marginBottom: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },

  // Bucket A — direction subtitle under the score number.
  directionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },

  // Bucket A — empty-state card (no stress score row yet).
  emptyCard: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
    marginTop: 6,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
  },

  // Bucket A — top stressor card. Visually distinct: teal-tinted
  // border + slightly larger headline.
  topStressorCard: {
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.3)",
  },
  topStressorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  topStressorIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topStressorEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  topStressorName: {
    fontSize: 16,
    fontWeight: "700",
    color: NAVY,
    marginTop: 2,
  },
  topStressorValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  topStressorBody: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 10,
    lineHeight: 18,
  },
  topStressorCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  topStressorCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEAL,
  },

  // Bucket A — suggestions section (only when no active intervention).
  suggestionCard: {
    borderWidth: 1,
    borderColor: "rgba(0,198,174,0.2)",
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  suggestionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: NAVY,
    marginBottom: 2,
  },
  suggestionBody: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
  },
  suggestionCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 12,
  },
  suggestionCtaText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEAL,
  },
});
